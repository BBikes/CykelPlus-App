import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';

// BikeDesk sends webhooks when ticket status changes
// This handler processes payment confirmations and updates booking status

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const supabase = await createServiceClient();

    // BikeDesk webhook structure (adapt to actual BikeDesk webhook format)
    const ticketId = payload?.ticket_id ?? payload?.id;
    const newStatus = payload?.status;
    const paymentStatus = payload?.payment_status;

    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket_id' }, { status: 400 });
    }

    // Find matching booking by BikeDesk ticket ID
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, users:users(phone, user_profiles(first_name))')
      .eq('bikedesk_ticket_id', ticketId)
      .maybeSingle();

    if (!booking) {
      // Not managed by our app — ignore
      return NextResponse.json({ ok: true });
    }

    // Payment confirmed
    if (
      paymentStatus === 'paid' ||
      newStatus === 'paid' ||
      newStatus === 'confirmed'
    ) {
      if (booking.status !== 'awaiting_payment') {
        return NextResponse.json({ ok: true });
      }

      await supabase
        .from('bookings')
        .update({
          status: 'booking_confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      await supabase.from('booking_events').insert({
        booking_id: booking.id,
        event_type: 'confirmed',
        actor: 'webhook',
        payload: { bikedesk_ticket_id: ticketId, raw: payload },
      });

      // Upsert booking_payment_status
      await supabase
        .from('booking_payment_status')
        .upsert({
          booking_id: booking.id,
          status: 'paid',
          paid_at: new Date().toISOString(),
          raw_webhook: payload,
          updated_at: new Date().toISOString(),
        });

      // Send confirmation SMS
      try {
        const user = booking.users as { phone: string; user_profiles?: { first_name?: string } };
        const smsBody = SMS_TEMPLATES.bookingConfirmedAfterPayment({
          customer_name: user.user_profiles?.first_name ?? '',
          booking_date: booking.scheduled_date
            ? new Date(booking.scheduled_date).toLocaleDateString('da-DK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : '',
          task_no: String(ticketId),
          store_title: 'B-Bikes',
        });
        await sendSms(user.phone, smsBody);
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
