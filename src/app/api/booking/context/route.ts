import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getBikeDeskSyncMeta } from '@/lib/bikedesk-sync';
import { getCykelPlusBookingContext } from '@/lib/booking-context';
import { listUserBikes } from '@/lib/app-bikes';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  try {
    const [bikes, bookingContext, sync] = await Promise.all([
      listUserBikes(session.user.id),
      getCykelPlusBookingContext(),
      getBikeDeskSyncMeta(session, { requireBikes: true }),
    ]);

    return NextResponse.json({
      bikes,
      form: bookingContext.form,
      serviceCatalog: bookingContext.serviceCatalog,
      methodServiceTotals: bookingContext.methodServiceTotals,
      sync,
    });
  } catch (error) {
    console.error('Failed to load booking context:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Kunne ikke indlæse bookingopsætningen',
      },
      { status: 500 }
    );
  }
}
