'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { ServiceTabSkeleton } from '@/components/layout/page-skeletons';
import { BookingWizard } from '@/components/booking/booking-wizard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBookingContextData } from '@/hooks/use-app-data';
import { useBackgroundBikedeskSync } from '@/hooks/use-background-bikedesk-sync';
import { BIKES_API_KEY, BOOKING_CONTEXT_API_KEY, HOME_API_KEY } from '@/lib/api-keys';

export function ServiceTab() {
  const searchParams = useSearchParams();
  const initialBikeId = searchParams.get('bikeId');
  const { data, error, isLoading, mutate } = useBookingContextData();
  const errorMessage =
    error instanceof Error && error.message !== 'Request failed'
      ? error.message
      : 'Vi kunne ikke hente serviceopsætningen lige nu. Prøv igen om et øjeblik.';
  const { isSyncing, triggerSync } = useBackgroundBikedeskSync(data?.sync, {
    requireBikes: true,
    revalidateKeys: [BOOKING_CONTEXT_API_KEY, BIKES_API_KEY, HOME_API_KEY],
  });

  if (isLoading && !data) {
    return (
      <div className="px-4">
        <ServiceTabSkeleton />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="px-4 pb-24 pt-10">
        <Card className="flex flex-col gap-3 rounded-[28px] border border-red-100 bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Booking kunne ikke indlæses</h1>
          <p className="text-sm text-slate-500">{errorMessage}</p>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              void mutate();
            }}
          >
            Prøv igen
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Planlæg service</p>
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">
            Service
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/bookings"
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/80 bg-white/90 px-4 text-sm font-semibold text-slate-600 shadow-sm"
          >
            <CalendarClock className="h-4 w-4" />
            Aftaler
          </Link>
          <button
            type="button"
            onClick={() => {
              void triggerSync(true);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-slate-500 shadow-sm"
            aria-label="Opdater serviceopsætning"
          >
            <RefreshCw className={['h-4 w-4', isSyncing ? 'animate-spin' : ''].join(' ')} />
          </button>
        </div>
      </div>

      <BookingWizard
        bikes={data.bikes}
        form={data.form}
        serviceCatalog={data.serviceCatalog}
        methodServiceTotals={data.methodServiceTotals}
        initialBikeId={initialBikeId}
      />
    </div>
  );
}
