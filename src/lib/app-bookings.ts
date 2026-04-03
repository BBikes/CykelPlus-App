import { createServiceClient } from '@/lib/supabase/server';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';
import { withCustomerBookingStatus, isBookingActive } from '@/lib/customer-booking-status';
import { loadServiceCatalogFromSettings } from '@/lib/bikedesk-service-cache';
import { supportsBookingExtensions } from '@/lib/booking-schema';
import type {
  AppUser,
  Bike,
  Booking,
  BookingEvent,
  BookingPaymentStatusRecord,
} from '@/types';

function toBookingArray(value: unknown): Booking[] {
  return (Array.isArray(value) ? value : []) as Booking[];
}

function toEventArray(value: unknown): BookingEvent[] {
  return (Array.isArray(value) ? value : []) as BookingEvent[];
}

function buildServiceLabelMap(templates: Array<{ id: number; label: string }>): Map<number, string> {
  return new Map(templates.map((template) => [template.id, template.label]));
}

function getBikeArticleId(booking: Booking): number | null {
  const bikeData =
    booking.bike_data && typeof booking.bike_data === 'object'
      ? (booking.bike_data as unknown as Record<string, unknown>)
      : null;
  return typeof bikeData?.bikedesk_article_id === 'number' ? bikeData.bikedesk_article_id : null;
}

function getPaymentLinkUrl(booking: Booking, paymentStatus: BookingPaymentStatusRecord | null): string | null {
  if (booking.payment_link_url) {
    return booking.payment_link_url;
  }

  if (!paymentStatus?.raw_webhook || typeof paymentStatus.raw_webhook !== 'object') {
    return null;
  }

  const raw = paymentStatus.raw_webhook as Record<string, unknown>;
  if (typeof raw.payment_link_url === 'string') {
    return raw.payment_link_url;
  }
  if (typeof raw.url === 'string') {
    return raw.url;
  }
  if (typeof raw.link === 'string') {
    return raw.link;
  }
  return null;
}

async function enrichBookings(bookings: Booking[]): Promise<Booking[]> {
  if (bookings.length === 0) return [];

  const supabase = await createServiceClient();
  const explicitBikeIds = [
    ...new Set(bookings.map((booking) => booking.bike_id).filter(Boolean)),
  ] as string[];
  const articleIds = [
    ...new Set(bookings.map((booking) => getBikeArticleId(booking)).filter((value): value is number => value !== null)),
  ];
  const bookingIds = bookings.map((booking) => booking.id);

  const [directBikeResponse, articleBikeResponse, paymentResponse, serviceCatalog] = await Promise.all([
    explicitBikeIds.length > 0
      ? supabase.from('bikes').select('*').in('id', explicitBikeIds)
      : Promise.resolve({ data: [] as Bike[], error: null }),
    articleIds.length > 0
      ? supabase.from('bikes').select('*').in('bikedesk_article_id', articleIds)
      : Promise.resolve({ data: [] as Bike[], error: null }),
    supabase.from('booking_payment_status').select('*').in('booking_id', bookingIds),
    loadServiceCatalogFromSettings(),
  ]);

  const directBikeMap = new Map((directBikeResponse.data ?? []).map((bike) => [bike.id, bike as Bike]));
  const articleBikeMap = new Map(
    ((articleBikeResponse.data ?? []) as Bike[])
      .filter((bike) => typeof bike.bikedesk_article_id === 'number')
      .map((bike) => [bike.bikedesk_article_id as number, bike])
  );
  const paymentMap = new Map(
    ((paymentResponse.data ?? []) as BookingPaymentStatusRecord[]).map((paymentStatus) => [
      paymentStatus.booking_id,
      paymentStatus,
    ])
  );
  const serviceLabelMap = buildServiceLabelMap(serviceCatalog.templates);

  return bookings.map((booking) => {
    const paymentStatus = paymentMap.get(booking.id) ?? null;
    const articleId = getBikeArticleId(booking);
    const resolvedBike =
      (booking.bike_id ? directBikeMap.get(booking.bike_id) : null) ??
      (articleId ? articleBikeMap.get(articleId) : null) ??
      null;

    return withCustomerBookingStatus({
      ...booking,
      bike_id: booking.bike_id ?? resolvedBike?.id ?? null,
      bike: resolvedBike,
      payment_status: paymentStatus,
      payment_link_url: getPaymentLinkUrl(booking, paymentStatus),
      payment_expires_at: booking.payment_expires_at ?? paymentStatus?.expires_at ?? null,
      service_labels: booking.service_ids
        .map((serviceId) => serviceLabelMap.get(serviceId))
        .filter((label): label is string => Boolean(label)),
    });
  });
}

export async function listUserBookings(user: Pick<AppUser, 'id' | 'phone'>): Promise<Booking[]> {
  await ensureCykelPlusSchemaReady('app');

  const supabase = await createServiceClient();
  const extensionsSupported = await supportsBookingExtensions();
  let query = supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  query = extensionsSupported
    ? query.eq('user_id', user.id)
    : query.eq('customer_data->>phone', user.phone);

  const { data } = await query;
  return enrichBookings(toBookingArray(data));
}

export async function getUserBooking(
  user: Pick<AppUser, 'id' | 'phone'>,
  bookingId: string
): Promise<Booking | null> {
  await ensureCykelPlusSchemaReady('app');

  const supabase = await createServiceClient();
  const extensionsSupported = await supportsBookingExtensions();
  let bookingQuery = supabase.from('bookings').select('*').eq('id', bookingId);

  bookingQuery = extensionsSupported
    ? bookingQuery.eq('user_id', user.id)
    : bookingQuery.eq('customer_data->>phone', user.phone);

  const [bookingResponse, eventsResponse] = await Promise.all([
    bookingQuery.maybeSingle(),
    supabase
      .from('booking_events')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true }),
  ]);

  if (!bookingResponse.data) return null;

  const [booking] = await enrichBookings([
    {
      ...(bookingResponse.data as Booking),
      events: toEventArray(eventsResponse.data),
    },
  ]);

  return booking ?? null;
}

export async function getLatestActiveBooking(
  user: Pick<AppUser, 'id' | 'phone'>
): Promise<Booking | null> {
  const bookings = await listUserBookings(user);
  return bookings.find((booking) => booking.customer_status && isBookingActive(booking.customer_status)) ?? null;
}
