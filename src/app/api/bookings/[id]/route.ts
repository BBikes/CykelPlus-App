import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { id: bookingId } = await params;
  const supabase = await createServiceClient();

  const [bookingRes, eventsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, bike:bikes(*)')
      .eq('id', bookingId)
      .eq('user_id', session.user.id)
      .maybeSingle(),
    supabase
      .from('booking_events')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true }),
  ]);

  if (!bookingRes.data) {
    return NextResponse.json({ error: 'Booking ikke fundet' }, { status: 404 });
  }

  return NextResponse.json({
    booking: { ...bookingRes.data, events: eventsRes.data ?? [] },
  });
}
