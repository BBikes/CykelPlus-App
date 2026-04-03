import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureBikeDeskSync, getBikeDeskSyncMeta } from '@/lib/bikedesk-sync';
import { getCykelPlusBookingContext } from '@/lib/booking-context';
import { getUserBooking, listUserBookings } from '@/lib/app-bookings';
import { supportsBookingExtensions } from '@/lib/booking-schema';
import {
  appendTicketNote,
  attachTemplateToTicket,
  createCustomer,
  createTicket,
  findCustomerByPhone,
  findOrCreateTag,
  findPlannerUser,
  getStore,
  getTags,
  getTicketPaymentLink,
  updateCustomer,
} from '@/lib/bikedesk';
import { getBikedeskTicketDisplayNumber, normalizeSharedBookingStatus } from '@/lib/bikedesk-status';
import { formatDateToDanish, parseDateFromISO } from '@/lib/booking/availability';
import {
  getMethodGlobalServiceIds,
  getWeekdayTagIds,
  hasMethodSpecificCapacity,
} from '@/lib/booking/settings';
import { getBikedeskServiceTemplatePrice } from '@/lib/bikedesk-service-cache';
import { sendSms, toDanishPhone } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';
import {
  bookingDebug,
  bookingDebugError,
  createBookingTraceId,
  maskPhone,
  withDebugId,
} from '@/lib/booking-debug';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';
import type {
  AppSession,
  Bike,
  BikedeskCustomer,
  Booking,
  BookingMethod,
  CreateBookingRequest,
  WeekdayIndex,
} from '@/types';

const bookingSchema = z.object({
  bikeId: z.string().uuid(),
  templateId: z.number().int().positive(),
  method: z.enum(['drop_off', 'pickup', 'onsite']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  budgetLimit: z.number().int().positive().nullable().optional(),
  budgetQuote: z.boolean().optional(),
});

const PAYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;

function normalizeBookingNotes(notes: CreateBookingRequest['notes']): string | null {
  const normalized = notes?.trim();
  return normalized ? normalized : null;
}

function buildCustomerName(session: AppSession): string {
  const fullName = [session.profile?.first_name, session.profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || session.user.phone;
}

function buildBikeTitle(bike: Pick<Bike, 'brand' | 'model'>): string {
  const model = bike.model?.trim() ?? '';
  const brand = bike.brand?.trim() ?? '';
  if (model && brand) return `${model} - ${brand}`;
  return model || brand || 'Cykel';
}

function isMethodEnabled(method: BookingMethod, booking: Awaited<ReturnType<typeof getCykelPlusBookingContext>>) {
  if (method === 'drop_off') return booking.form.config.enable_workshop;
  if (method === 'pickup') return booking.form.config.enable_pickup;
  return booking.form.config.enable_onsite;
}

function isTemplateAllowedForBike(
  bike: Bike,
  templateId: number,
  templateVehicleTypes: Record<number, string[]> | undefined
): boolean {
  const allowedTypes = templateVehicleTypes?.[templateId] ?? [];
  if (allowedTypes.length === 0) {
    return true;
  }

  if (!bike.type) {
    return true;
  }

  return allowedTypes.includes(bike.type);
}

function getMethodDescription(method: BookingMethod): string {
  if (method === 'pickup') return 'Afhentning og levering';
  if (method === 'onsite') return 'Service på arbejdsplads';
  return 'Indlevering i butik';
}

async function ensureBikeDeskCustomer(session: AppSession): Promise<BikedeskCustomer> {
  const supabase = await createServiceClient();
  const profile = session.profile;
  const customerPayload = {
    name: buildCustomerName(session),
    phone: toDanishPhone(session.user.phone),
    email: profile?.email ?? '',
    address: profile?.address ?? '',
    zipcode: profile?.zip ?? '',
    city: profile?.city ?? '',
  };

  let customer: BikedeskCustomer | null = null;

  if (session.user.bikedesk_customer_id) {
    try {
      customer = await updateCustomer(session.user.bikedesk_customer_id, customerPayload);
    } catch {
      customer = null;
    }
  }

  if (!customer) {
    customer = await findCustomerByPhone(session.user.phone);
    if (customer) {
      customer = await updateCustomer(customer.id, customerPayload);
    }
  }

  if (!customer) {
    customer = await createCustomer(customerPayload);
  }

  await supabase
    .from('users')
    .update({
      bikedesk_customer_id: customer.id,
      last_bikedesk_sync_at: new Date().toISOString(),
    })
    .eq('id', session.user.id);

  return customer;
}

async function sendBookingSmsMessage(
  session: AppSession,
  bike: Bike,
  method: BookingMethod,
  date: string,
  time: string | null,
  ticketNumber: string | null,
  paymentLink: string | null
): Promise<void> {
  if (session.profile?.sms_reminders === false) {
    return;
  }

  const context = {
    customer_name: session.profile?.first_name ?? buildCustomerName(session),
    bike_title: [bike.brand, bike.model].filter(Boolean).join(' ') || 'din cykel',
    booking_date: formatDateToDanish(date),
    booking_time: time,
    task_no: ticketNumber,
    store_title: 'B-Bikes',
    payment_link: paymentLink ?? 'Kontakt B-Bikes for betalingslink',
  };

  if (method === 'pickup') {
    await sendSms(session.user.phone, SMS_TEMPLATES.bookingCreatedPickup(context));
    return;
  }

  await sendSms(session.user.phone, SMS_TEMPLATES.bookingCreatedDropOff(context));
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    await ensureCykelPlusSchemaReady('app');

    const [bookings, sync] = await Promise.all([
      listUserBookings(session.user),
      getBikeDeskSyncMeta(session, { requireBookings: true }),
    ]);
    return NextResponse.json({ bookings, sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const traceId = createBookingTraceId('submit');
  let session: Awaited<ReturnType<typeof getSession>> = null;

  try {
    session = await getSession();
    if (!session) {
      bookingDebug(traceId, 'booking_submit.unauthorized');
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    await ensureCykelPlusSchemaReady('app', {
      traceId,
      source: 'booking_submit',
    });

    bookingDebug(traceId, 'booking_submit.start', {
      userId: session.user.id,
      phone: maskPhone(session.user.phone),
    });

    const payload: CreateBookingRequest = bookingSchema.parse(await req.json());
    const normalizedNotes = normalizeBookingNotes(payload.notes);
    bookingDebug(traceId, 'booking_submit.payload_parsed', {
      bikeId: payload.bikeId,
      templateId: payload.templateId,
      method: payload.method,
      date: payload.date,
      time: payload.time ?? null,
      budgetLimit: payload.budgetLimit ?? null,
      budgetQuote: payload.budgetQuote ?? false,
      notesLength: normalizedNotes?.length ?? 0,
    });

    const supabase = await createServiceClient();

    await ensureBikeDeskSync(session, { requireBikes: true });
    bookingDebug(traceId, 'booking_submit.sync_completed', {
      userId: session.user.id,
    });

    const [{ data: bikeRow }, bookingContext, extensionsSupported] = await Promise.all([
      supabase
        .from('bikes')
        .select('*')
        .eq('id', payload.bikeId)
        .eq('user_id', session.user.id)
        .maybeSingle(),
      getCykelPlusBookingContext({ traceId }),
      supportsBookingExtensions(),
    ]);

    bookingDebug(traceId, 'booking_submit.dependencies_loaded', {
      bikeFound: Boolean(bikeRow),
      extensionsSupported,
      formId: bookingContext.form.id,
      formSlug: bookingContext.form.slug,
      templateCount: bookingContext.serviceCatalog.templates.length,
    });

    const bike = bikeRow as Bike | null;
    if (!bike) {
      bookingDebug(traceId, 'booking_submit.bike_missing', {
        bikeId: payload.bikeId,
        userId: session.user.id,
      });
      return NextResponse.json({ error: 'Cykel ikke fundet' }, { status: 404 });
    }

    if (!isMethodEnabled(payload.method, bookingContext)) {
      bookingDebug(traceId, 'booking_submit.method_disabled', {
        method: payload.method,
        formId: bookingContext.form.id,
      });
      return NextResponse.json({ error: 'Metoden er ikke aktiveret' }, { status: 400 });
    }

    const selectedTemplate = bookingContext.serviceCatalog.templates.find(
      (template) => template.id === payload.templateId
    );

    if (!selectedTemplate) {
      bookingDebug(traceId, 'booking_submit.template_missing', {
        templateId: payload.templateId,
        formId: bookingContext.form.id,
      });
      return NextResponse.json({ error: 'Service blev ikke fundet' }, { status: 400 });
    }

    if (
      !isTemplateAllowedForBike(
        bike,
        selectedTemplate.id,
        bookingContext.form.config.template_vehicle_types
      )
    ) {
      bookingDebug(traceId, 'booking_submit.template_not_allowed', {
        templateId: selectedTemplate.id,
        bikeId: bike.id,
        bikeType: bike.type,
      });
      return NextResponse.json({ error: 'Servicen matcher ikke den valgte cykel' }, { status: 400 });
    }

    const useFormSpecificCapacity = hasMethodSpecificCapacity(
      bookingContext.form.config,
      payload.method
    );
    let capacityQuery = supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('date', payload.date)
      .eq('method', payload.method)
      .neq('status', 'draft');

    if (useFormSpecificCapacity) {
      capacityQuery = capacityQuery.eq('form_id', bookingContext.form.id);
    }

    const { count: bookingCount, error: capacityError } = await capacityQuery;
    if (capacityError) {
      throw new Error(capacityError.message);
    }

    const calendar = bookingContext.form.config.calendar_settings;
    const capacityLimit =
      payload.method === 'drop_off'
        ? calendar?.max_bookings_workshop ?? 0
        : payload.method === 'pickup'
          ? calendar?.max_bookings_pickup ?? 0
          : calendar?.max_bookings_onsite ?? 0;

    bookingDebug(traceId, 'booking_submit.capacity_checked', {
      method: payload.method,
      date: payload.date,
      useFormSpecificCapacity,
      bookingCount: bookingCount ?? 0,
      capacityLimit,
    });

    if (capacityLimit > 0 && (bookingCount ?? 0) >= capacityLimit) {
      bookingDebug(traceId, 'booking_submit.capacity_full', {
        method: payload.method,
        date: payload.date,
        bookingCount: bookingCount ?? 0,
        capacityLimit,
      });
      return NextResponse.json({ error: 'Ingen ledige tider på den valgte dato' }, { status: 409 });
    }

    const [customer, onlineBookingTag, availableTags, planner, store] = await Promise.all([
      ensureBikeDeskCustomer(session),
      findOrCreateTag('Online Booking'),
      getTags(),
      findPlannerUser().catch(() => null),
      getStore(),
    ]);

    if (!planner?.id) {
      throw new Error('BikeDesk assignee "Planlægningen" blev ikke fundet');
    }

    bookingDebug(traceId, 'booking_submit.bikedesk_resolved', {
      customerId: customer.id,
      plannerId: planner.id,
      storeId: store.id,
      availableTagCount: availableTags.length,
    });

    const weekdayIndex = parseDateFromISO(payload.date).getDay() as WeekdayIndex;
    const configuredMethodTagIds =
      payload.method === 'drop_off'
        ? bookingContext.form.config.workshop_tag_ids
        : payload.method === 'pickup'
          ? bookingContext.form.config.pickup_tag_ids
          : bookingContext.form.config.onsite_tag_ids;
    const weekdayTagIds =
      payload.method === 'drop_off'
        ? getWeekdayTagIds(bookingContext.globalSettings.workshop_weekday_tag_ids, weekdayIndex)
        : payload.method === 'pickup'
          ? getWeekdayTagIds(bookingContext.globalSettings.pickup_weekday_tag_ids, weekdayIndex)
          : getWeekdayTagIds(bookingContext.globalSettings.onsite_weekday_tag_ids, weekdayIndex);
    const validTagIds = new Set([...availableTags.map((tag) => tag.id), onlineBookingTag.id]);
    const tagIds = [...new Set([onlineBookingTag.id, ...configuredMethodTagIds, ...weekdayTagIds])].filter(
      (tagId) => validTagIds.has(tagId)
    );

    const excludedGlobalServiceIds = new Set(
      bookingContext.form.config.excluded_global_service_ids ?? []
    );
    const attachedTemplateIds = [
      ...new Set([
        payload.templateId,
        ...getMethodGlobalServiceIds(bookingContext.globalSettings, payload.method),
      ]),
    ].filter((templateId) => !excludedGlobalServiceIds.has(templateId));

    bookingDebug(traceId, 'booking_submit.ticket_inputs_ready', {
      tagIds,
      attachedTemplateIds,
      selectedTemplateId: payload.templateId,
      excludedGlobalServiceIds: [...excludedGlobalServiceIds],
    });

    const descriptionLines = [
      `Kilde: CykelPlus App`,
      `Metode: ${getMethodDescription(payload.method)}`,
      `Service: ${selectedTemplate.label}`,
      `Cykel: ${[bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel'}`,
      payload.budgetQuote ? 'Oensker tilbud inden reparation' : null,
      payload.budgetLimit ? `Budgetgrænse: ${payload.budgetLimit} kr.` : null,
      normalizedNotes ? `Note: ${normalizedNotes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const startTime = payload.time ? `${payload.date}T${payload.time}:00` : `${payload.date}T08:00:00`;
    const pickupTime =
      payload.method === 'pickup' && payload.time
        ? `${payload.date}T${payload.time}:00`
        : `${payload.date}T17:00:00`;

    const ticket = await createTicket({
      customerid: customer.id,
      customerarticleids: bike.bikedesk_article_id ? [bike.bikedesk_article_id] : undefined,
      description: descriptionLines,
      type: 'repair',
      status: 'awaiting',
      startTime,
      pickup: pickupTime,
      storeid: store.id,
      assignee: planner.id,
      tagids: tagIds,
    });

    bookingDebug(traceId, 'booking_submit.ticket_created', {
      ticketId: ticket.id,
      ticketStatus: ticket.status,
      tagIds,
      attachedTemplateCount: attachedTemplateIds.length,
    });

    for (const templateId of attachedTemplateIds) {
      await attachTemplateToTicket(ticket.id, templateId);
    }

    bookingDebug(traceId, 'booking_submit.templates_attached', {
      ticketId: ticket.id,
      attachedTemplateIds,
    });

    const ticketNumber = getBikedeskTicketDisplayNumber(ticket);
    const now = new Date().toISOString();
    const paymentExpiresAt =
      payload.method === 'pickup' ? new Date(Date.now() + PAYMENT_EXPIRY_MS).toISOString() : null;
    const paymentLink =
      payload.method === 'pickup'
        ? await getTicketPaymentLink(ticket.id).catch(() => ({ url: null, expires_at: null, raw: null }))
        : { url: null, expires_at: null, raw: null };
    const paymentLinkUrl = paymentLink.url;
    const effectivePaymentExpiresAt = paymentLink.expires_at ?? paymentExpiresAt;
    const templateMap = new Map(
      bookingContext.serviceCatalog.templates.map((template) => [template.id, template])
    );
    const paymentAmount =
      payload.method === 'pickup'
        ? attachedTemplateIds.reduce(
            (sum, templateId) =>
              sum + getBikedeskServiceTemplatePrice(templateMap.get(templateId) ?? { price: 0 }),
            0
          )
        : null;

    const baseInsertPayload = {
      form_id: bookingContext.form.id,
      status: normalizeSharedBookingStatus(ticket.status),
      method: payload.method,
      date: payload.date,
      time: payload.time ?? null,
      service_ids: attachedTemplateIds,
      addon_ids: [],
      customer_data: {
        name: customer.name,
        phone: session.user.phone,
        email: customer.email,
        address: customer.address,
        zip_code: customer.zipcode,
        city: customer.city,
        bikedesk_id: customer.id,
      },
      bike_data: {
        brand: bike.brand ?? '',
        model: bike.model ?? '',
        type: bike.type ?? '',
        frame_number: bike.frame_number ?? undefined,
        bikedesk_article_id: bike.bikedesk_article_id ?? undefined,
        is_new: false,
      },
      budget_limit: payload.budgetQuote ? null : payload.budgetLimit ?? null,
      notes: normalizedNotes,
      bikedesk_ticket_id: ticket.id,
      bikedesk_ticket_cardno: ticketNumber,
      updated_at: now,
    };
    const insertPayload = extensionsSupported
      ? {
          ...baseInsertPayload,
          user_id: session.user.id,
          bike_id: bike.id,
          payment_link_url: paymentLinkUrl,
          payment_expires_at: effectivePaymentExpiresAt,
        }
      : baseInsertPayload;

    const { data: insertedBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert(insertPayload)
      .select('id')
      .single();

    if (bookingError || !insertedBooking) {
      throw new Error(bookingError?.message ?? 'Kunne ikke oprette booking');
    }

    bookingDebug(traceId, 'booking_submit.booking_inserted', {
      bookingId: insertedBooking.id,
      ticketId: ticket.id,
      paymentLinkPresent: Boolean(paymentLinkUrl),
      paymentExpiresAt: effectivePaymentExpiresAt,
      paymentAmount,
    });

    if (payload.method === 'pickup') {
      await supabase.from('booking_payment_status').upsert(
        {
          booking_id: insertedBooking.id,
          payment_ref: String(ticket.id),
          status: 'pending',
          amount_dkk: paymentAmount ? Math.round(paymentAmount) : null,
          expires_at: effectivePaymentExpiresAt,
          raw_webhook: {
            ...(paymentLink.raw ?? {}),
            payment_link_url: paymentLinkUrl,
            payment_expires_at: effectivePaymentExpiresAt,
          },
          updated_at: now,
        },
        { onConflict: 'booking_id' }
      );
    }

    await supabase.from('booking_events').insert(
      [
        {
          booking_id: insertedBooking.id,
          event_type: 'created',
          actor: 'user',
          payload: { method: payload.method, service_ids: attachedTemplateIds },
        },
        payload.method === 'pickup'
          ? {
              booking_id: insertedBooking.id,
              event_type: 'payment_sent',
              actor: 'system',
              payload: {
                payment_link_url: paymentLinkUrl,
                payment_expires_at: effectivePaymentExpiresAt,
              },
            }
          : {
              booking_id: insertedBooking.id,
              event_type: 'confirmed',
              actor: 'system',
              payload: {},
            },
      ].filter(Boolean)
    );

    bookingDebug(traceId, 'booking_submit.events_inserted', {
      bookingId: insertedBooking.id,
      eventCount: payload.method === 'pickup' ? 2 : 2,
    });

    try {
      await appendTicketNote(
        {
          ...ticket,
          assignee: planner.id,
          storeid: store.id,
          tagids: tagIds,
        },
        `---\nCykelPlus booking-id: ${insertedBooking.id}`
      );
    } catch (error) {
      console.warn('Could not append CykelPlus booking reference to BikeDesk ticket:', error);
    }

    try {
      await sendBookingSmsMessage(
        session,
        bike,
        payload.method,
        payload.date,
        payload.time ?? null,
        ticketNumber,
        paymentLinkUrl
      );
    } catch (error) {
      console.warn('Booking SMS failed (non-fatal):', error);
    }

    const booking = await getUserBooking(session.user, insertedBooking.id);
    bookingDebug(traceId, 'booking_submit.success', {
      bookingId: insertedBooking.id,
      hasBookingPayload: Boolean(booking),
      customerStatus: booking?.customer_status ?? null,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    bookingDebugError(traceId, 'booking_submit.failed', error, {
      userId: session?.user.id ?? null,
      phone: maskPhone(session?.user.phone),
    });
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json(
      { error: withDebugId(message, traceId), debugId: traceId },
      { status: 400 }
    );
  }
}
