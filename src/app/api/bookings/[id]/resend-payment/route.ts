import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getUserBooking } from '@/lib/app-bookings';
import { getTicketPaymentLink } from '@/lib/bikedesk';
import { supportsBookingExtensions } from '@/lib/booking-schema';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';
import { formatDateToDanish } from '@/lib/booking/availability';

interface Props {
  params: Promise<{ id: string }>;
}

const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export async function POST(_: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  const { id } = await params;
  const booking = await getUserBooking(session.user, id);
  if (!booking) {
    return NextResponse.json({ error: 'Booking ikke fundet' }, { status: 404 });
  }

  if (booking.method !== 'pickup' || booking.customer_status !== 'awaiting_payment') {
    return NextResponse.json({ error: 'Ingen betaling afventer' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const extensionsSupported = await supportsBookingExtensions();
  const { data: lastEvent } = await supabase
    .from('booking_events')
    .select('created_at')
    .eq('booking_id', booking.id)
    .eq('event_type', 'payment_sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEvent) {
    const elapsed = Date.now() - new Date(lastEvent.created_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'Vent venligst 5 minutter mellem gensendte links' },
        { status: 429 }
      );
    }
  }

  let paymentLinkUrl = booking.payment_link_url;
  if (!paymentLinkUrl && booking.bikedesk_ticket_id) {
    try {
      const paymentLink = await getTicketPaymentLink(booking.bikedesk_ticket_id);
      if (paymentLink.url) {
        paymentLinkUrl = paymentLink.url;
        if (extensionsSupported) {
          await supabase
            .from('bookings')
            .update({
              payment_link_url: paymentLink.url,
              payment_expires_at: paymentLink.expires_at ?? booking.payment_expires_at,
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.id);
        }

        await supabase
          .from('booking_payment_status')
          .update({
            raw_webhook: {
              ...(paymentLink.raw ?? {}),
              payment_link_url: paymentLink.url,
              payment_expires_at: paymentLink.expires_at ?? booking.payment_expires_at,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('booking_id', booking.id);
      }
    } catch (error) {
      console.warn('Could not refresh BikeDesk payment link:', error);
    }
  }

  await sendSms(
    session.user.phone,
    SMS_TEMPLATES.bookingCreatedPickup({
      customer_name: session.profile?.first_name ?? '',
      bike_title: [booking.bike?.brand, booking.bike?.model].filter(Boolean).join(' '),
      booking_date: formatDateToDanish(booking.date),
      booking_time: booking.time,
      payment_link: paymentLinkUrl ?? 'Kontakt B-Bikes for betalingslink',
      task_no: booking.bikedesk_ticket_cardno ?? booking.id.slice(0, 8),
      store_title: 'B-Bikes',
    })
  );

  await supabase.from('booking_events').insert({
    booking_id: booking.id,
    event_type: 'payment_sent',
    actor: 'system',
    payload: {
      payment_link_url: paymentLinkUrl,
      resent: true,
    },
  });

  return NextResponse.json({ success: true, payment_link_url: paymentLinkUrl });
}
