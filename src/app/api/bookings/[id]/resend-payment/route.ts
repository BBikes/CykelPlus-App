import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';

interface Props {
  params: Promise<{ id: string }>;
}

// Allow resend max once per 5 minutes
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { id: bookingId } = await params;
  const supabase = await createServiceClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, bike:bikes(*)')
    .eq('id', bookingId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking ikke fundet' }, { status: 404 });
  if (booking.status !== 'awaiting_payment') {
    return NextResponse.json({ error: 'Ingen betaling afventer' }, { status: 400 });
  }

  // Check cooldown (look at last payment_sent event)
  const { data: lastEvent } = await supabase
    .from('booking_events')
    .select('created_at')
    .eq('booking_id', bookingId)
    .eq('event_type', 'payment_sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEvent) {
    const elapsed = Date.now() - new Date(lastEvent.created_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Vent venligst 5 minutter mellem gensendte links' }, { status: 429 });
    }
  }

  const bike = booking.bike as { brand?: string; model?: string };
  const smsBody = SMS_TEMPLATES.bookingCreatedPickup({
    customer_name: session.profile?.first_name ?? '',
    bike_title: [bike?.brand, bike?.model].filter(Boolean).join(' '),
    booking_date: booking.scheduled_date
      ? new Date(booking.scheduled_date).toLocaleDateString('da-DK', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : '',
    payment_link: booking.payment_link_url ?? '(se BikeDesk)',
    store_title: 'B-Bikes',
  });

  try {
    await sendSms(session.user.phone, smsBody);
  } catch {
    return NextResponse.json({ error: 'Kunne ikke sende SMS' }, { status: 500 });
  }

  await supabase.from('booking_events').insert({
    booking_id: bookingId,
    event_type: 'payment_sent',
    actor: 'user',
    payload: { resent: true },
  });

  return NextResponse.json({ success: true });
}
