'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { BookingsPageSkeleton } from '@/components/layout/page-skeletons';
import { BookingStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBookingsData } from '@/hooks/use-app-data';
import { useBackgroundBikedeskSync } from '@/hooks/use-background-bikedesk-sync';
import { BOOKINGS_API_KEY, HOME_API_KEY } from '@/lib/api-keys';

const methodLabels: Record<string, string> = {
  drop_off: 'Indlevering i butik',
  pickup: 'Afhentning og levering',
  onsite: 'Service på arbejdsplads',
};

export function BookingsPageClient() {
  const { data, error, isLoading, mutate } = useBookingsData();
  useBackgroundBikedeskSync(data?.sync, {
    requireBookings: true,
    revalidateKeys: [BOOKINGS_API_KEY, HOME_API_KEY],
  });

  if (isLoading && !data) {
    return (
      <div className="px-4">
        <BookingsPageSkeleton />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="px-4 pb-24 pt-10">
        <Card className="flex flex-col gap-3 rounded-[28px] border border-red-100 bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Aftaler kunne ikke indlæses</h1>
          <p className="text-sm text-slate-500">
            Vi kunne ikke hente dine bookingdetaljer lige nu. Prøv igen.
          </p>
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
      <div className="flex flex-col gap-5">
        <header className="space-y-2">
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">
            Mine Aftaler
          </h1>
          <p className="text-sm text-slate-500">
            Her kan du se aktive og tidligere serviceforløb.
          </p>
        </header>

        {data.bookings.length === 0 ? (
          <Card className="flex flex-col gap-4 rounded-[28px] border border-dashed border-slate-200 bg-white/92 px-5 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
                Ingen bookinger endnu
              </h2>
              <p className="text-sm leading-6 text-slate-500">
                Book din første service, og den vil dukke op her med status og detaljer.
              </p>
            </div>
            <Link href="/book">
              <Button variant="primary" className="rounded-2xl bg-slate-900">
                Book service
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.bookings.map((booking) => {
              const bikeName =
                [booking.bike?.brand, booking.bike?.model].filter(Boolean).join(' ') || 'Cykel';
              return (
                <Link key={booking.id} href={`/bookings/${booking.id}`}>
                  <Card className="flex items-center gap-4 rounded-[24px] border border-white/75 bg-white/95 px-4 py-4 transition-transform active:scale-[0.99]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-blue-50 text-blue-600">
                      <CalendarDays className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">{bikeName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {booking.date
                          ? new Date(booking.date).toLocaleDateString('da-DK', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Dato ikke sat'}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                        {methodLabels[booking.method] ?? booking.method}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-3">
                      {booking.customer_status && (
                        <BookingStatusBadge status={booking.customer_status} />
                      )}
                      <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
