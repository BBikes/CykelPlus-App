import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { count: sessionsDeleted } = await supabase
    .from('user_sessions')
    .delete({ count: 'exact' })
    .lt('expires_at', now);

  const { data: expiredPayments, error: expiredPaymentsError } = await supabase
    .from('booking_payment_status')
    .select('booking_id')
    .eq('status', 'pending')
    .lt('expires_at', now);

  if (expiredPaymentsError) {
    return NextResponse.json({ error: expiredPaymentsError.message }, { status: 500 });
  }

  const bookingIds = (expiredPayments ?? []).map((entry) => entry.booking_id);

  if (bookingIds.length > 0) {
    await supabase
      .from('booking_payment_status')
      .update({ status: 'expired', updated_at: now })
      .in('booking_id', bookingIds);

    await supabase
      .from('bookings')
      .update({ updated_at: now })
      .in('id', bookingIds);

    await supabase.from('booking_events').insert(
      bookingIds.map((bookingId) => ({
        booking_id: bookingId,
        event_type: 'payment_expired',
        actor: 'system',
        payload: {},
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    sessionsDeleted,
    paymentsExpired: bookingIds.length,
  });
}
