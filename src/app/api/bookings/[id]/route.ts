import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserBooking } from '@/lib/app-bookings';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: Props) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    await ensureCykelPlusSchemaReady('app');

    const { id } = await params;
    const booking = await getUserBooking(session.user, id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking ikke fundet' }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
