import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { createTicket, findCustomerByPhone, getStore, findOrCreateTag } from '@/lib/bikedesk';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';
import { z } from 'zod';

const schema = z.object({
  bike_id: z.string().uuid(),
  service_type: z.string().min(1),
  description: z.string().optional(),
  method: z.enum(['drop_off', 'pickup', 'onsite']),
  scheduled_date: z.string().min(1),
  scheduled_time: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*, bike:bikes(*)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const supabase = await createServiceClient();

    // Verify bike ownership
    const { data: bike } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', data.bike_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!bike) return NextResponse.json({ error: 'Cykel ikke fundet' }, { status: 404 });

    // Create booking record
    const initialStatus = data.method === 'pickup' ? 'booking_created' : 'booking_created';
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: session.user.id,
        bike_id: data.bike_id,
        status: initialStatus,
        method: data.method,
        service_type: data.service_type,
        description: data.description ?? null,
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time,
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (bookingError || !booking) throw new Error('Kunne ikke oprette booking');

    // Log event
    await supabase.from('booking_events').insert({
      booking_id: booking.id,
      event_type: 'created',
      actor: 'user',
      payload: { method: data.method, service_type: data.service_type },
    });

    // Create ticket in BikeDesk (non-fatal)
    let bikedeskTicketId: number | null = null;
    try {
      const [store, customer] = await Promise.all([
        getStore(),
        session.user.bikedesk_customer_id
          ? null
          : findCustomerByPhone(session.user.phone),
      ]);

      const customerId =
        session.user.bikedesk_customer_id ?? customer?.id;

      if (customerId && store) {
        const methodTag = data.method === 'pickup' ? 'Hent & Bring' : 'Online Booking';
        const tag = await findOrCreateTag(methodTag);

        const startISO = `${data.scheduled_date}T${data.scheduled_time}:00`;
        const pickupISO = `${data.scheduled_date}T${data.scheduled_time}:00`; // Same for now

        const ticket = await createTicket({
          customerid: customerId,
          customerarticleids: bike.bikedesk_article_id ? [bike.bikedesk_article_id] : undefined,
          description: [data.service_type, data.description, data.notes]
            .filter(Boolean)
            .join('\n'),
          type: 'job',
          status: 'new',
          startTime: startISO,
          pickup: pickupISO,
          storeid: store.id,
          tagids: [tag.id],
        });

        bikedeskTicketId = ticket.id;

        await supabase
          .from('bookings')
          .update({ bikedesk_ticket_id: bikedeskTicketId })
          .eq('id', booking.id);
      }
    } catch {
      // BikeDesk failure is non-fatal
    }

    // Update status and send SMS
    const bikeName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'din cykel';
    const smsCtx = {
      customer_name: session.profile?.first_name ?? '',
      bike_title: bikeName,
      booking_date: new Date(data.scheduled_date).toLocaleDateString('da-DK', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      booking_time: data.scheduled_time,
      task_no: bikedeskTicketId ? String(bikedeskTicketId) : booking.id.slice(0, 8),
      store_title: 'B-Bikes',
    };

    if (data.method === 'pickup') {
      // Send payment link SMS — payment link comes from BikeDesk
      const smsBody = SMS_TEMPLATES.bookingCreatedPickup({ ...smsCtx, payment_link: '(se BikeDesk)' });
      try {
        await sendSms(session.user.phone, smsBody);
      } catch {
        // Non-fatal
      }
      await supabase
        .from('bookings')
        .update({ status: 'awaiting_payment', payment_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', booking.id);
      await supabase.from('booking_events').insert({
        booking_id: booking.id,
        event_type: 'payment_sent',
        actor: 'system',
        payload: {},
      });
    } else {
      // Drop-off: auto-confirm
      const smsBody = SMS_TEMPLATES.bookingCreatedDropOff(smsCtx);
      try {
        await sendSms(session.user.phone, smsBody);
      } catch {
        // Non-fatal
      }
      await supabase
        .from('bookings')
        .update({ status: 'booking_confirmed' })
        .eq('id', booking.id);
      await supabase.from('booking_events').insert({
        booking_id: booking.id,
        event_type: 'confirmed',
        actor: 'system',
        payload: {},
      });
    }

    const { data: updatedBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking.id)
      .single();

    return NextResponse.json({ booking: updatedBooking });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
