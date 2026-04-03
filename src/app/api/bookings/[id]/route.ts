import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { getUserBooking } from '@/lib/app-bookings';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  const { id } = await params;
  await ensureBikeDeskSync(session, { requireBookings: true });
  const booking = await getUserBooking(session.user, id);

  if (!booking) {
    return NextResponse.json({ error: 'Booking ikke fundet' }, { status: 404 });
  }

  return NextResponse.json({ booking });
}
