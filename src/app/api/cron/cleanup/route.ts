import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Called by Vercel cron: "0 2 * * *" (daily at 02:00)
export async function GET() {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Delete expired sessions
  const { count: sessionsDeleted } = await supabase
    .from('user_sessions')
    .delete({ count: 'exact' })
    .lt('expires_at', now);

  // Expire unpaid pickup bookings past 24h
  const { data: expiredBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'awaiting_payment')
    .lt('payment_expires_at', now);

  if (expiredBookings && expiredBookings.length > 0) {
    const ids = expiredBookings.map((b) => b.id);
    await supabase
      .from('bookings')
      .update({ status: 'payment_expired', updated_at: now })
      .in('id', ids);

    // Log events
    await supabase.from('booking_events').insert(
      ids.map((id) => ({
        booking_id: id,
        event_type: 'payment_expired',
        actor: 'system',
        payload: {},
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    sessionsDeleted,
    bookingsExpired: expiredBookings?.length ?? 0,
  });
}
