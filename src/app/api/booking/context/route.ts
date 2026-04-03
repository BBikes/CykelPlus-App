import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getBikeDeskSyncMeta } from '@/lib/bikedesk-sync';
import { getCykelPlusBookingContext } from '@/lib/booking-context';
import {
  bookingDebug,
  bookingDebugError,
  createBookingTraceId,
  getSupabaseDebugSnapshot,
  maskPhone,
  withDebugId,
} from '@/lib/booking-debug';
import { listUserBikes } from '@/lib/app-bikes';

export async function GET() {
  const traceId = createBookingTraceId('context');
  const session = await getSession();
  if (!session) {
    bookingDebug(traceId, 'booking_context.unauthorized');
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  bookingDebug(traceId, 'booking_context.start', {
    userId: session.user.id,
    phone: maskPhone(session.user.phone),
    ...getSupabaseDebugSnapshot(),
  });

  try {
    const [bikes, bookingContext, sync] = await Promise.all([
      listUserBikes(session.user.id),
      getCykelPlusBookingContext({ traceId }),
      getBikeDeskSyncMeta(session, { requireBikes: true }),
    ]);

    bookingDebug(traceId, 'booking_context.success', {
      userId: session.user.id,
      bikeCount: bikes.length,
      formId: bookingContext.form.id,
      formSlug: bookingContext.form.slug,
      serviceTemplateCount: bookingContext.serviceCatalog.templates.length,
      syncRecommended: sync.syncRecommended,
      lastSyncedAt: sync.lastSyncedAt,
    });

    return NextResponse.json({
      bikes,
      form: bookingContext.form,
      serviceCatalog: bookingContext.serviceCatalog,
      methodServiceTotals: bookingContext.methodServiceTotals,
      sync,
    });
  } catch (error) {
    bookingDebugError(traceId, 'booking_context.failed', error, {
      userId: session.user.id,
      phone: maskPhone(session.user.phone),
      ...getSupabaseDebugSnapshot(),
    });

    const message =
      error instanceof Error ? error.message : 'Kunne ikke indlæse bookingopsætningen';

    return NextResponse.json(
      {
        error: withDebugId(message, traceId),
        debugId: traceId,
      },
      { status: 500 }
    );
  }
}
