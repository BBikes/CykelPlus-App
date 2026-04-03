import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';

interface Props {
  params: Promise<{ id: string }>;
}

const CANCELLABLE_STATUSES = ['booking_created', 'awaiting_payment'];

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
  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    return NextResponse.json({ error: 'Denne booking kan ikke annulleres' }, { status: 400 });
  }

  await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  await supabase.from('booking_events').insert({
    booking_id: bookingId,
    event_type: 'cancelled',
    actor: 'user',
    payload: {},
  });

  // SMS (non-fatal)
  try {
    const bike = booking.bike as { brand?: string; model?: string };
    const smsBody = SMS_TEMPLATES.bookingCancelled({
      customer_name: session.profile?.first_name ?? '',
      bike_title: [bike?.brand, bike?.model].filter(Boolean).join(' '),
      task_no: booking.bikedesk_ticket_id ? String(booking.bikedesk_ticket_id) : bookingId.slice(0, 8),
      store_title: 'B-Bikes',
      store_phone: '+4529837883',
    });
    await sendSms(session.user.phone, smsBody);
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true });
}
