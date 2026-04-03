'use client';

import Link from 'next/link';
import {
  Bike,
  CalendarClock,
  ChevronRight,
  Headset,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { HomeTabSkeleton } from '@/components/layout/page-skeletons';
import { BookingStatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useHomeData } from '@/hooks/use-app-data';
import { useBackgroundBikedeskSync } from '@/hooks/use-background-bikedesk-sync';
import {
  BIKES_API_KEY,
  BOOKINGS_API_KEY,
  BOOKING_CONTEXT_API_KEY,
  HOME_API_KEY,
} from '@/lib/api-keys';

const quickActions = [
  {
    href: '/book',
    label: 'Book Tid',
    icon: Wrench,
    iconClassName: 'bg-slate-100 text-slate-700',
  },
  {
    href: '/garage',
    label: 'Min Garage',
    icon: Bike,
    iconClassName: 'bg-orange-50 text-orange-500',
  },
  {
    href: '/bookings',
    label: 'Mine Aftaler',
    icon: CalendarClock,
    iconClassName: 'bg-violet-50 text-violet-500',
  },
  {
    href: '/help',
    label: 'Hjælp',
    icon: Headset,
    iconClassName: 'bg-emerald-50 text-emerald-500',
  },
] as const;

export function HomeTab() {
  const { data, error, isLoading, mutate } = useHomeData();
  const { isSyncing, triggerSync } = useBackgroundBikedeskSync(data?.sync, {
    requireBikes: true,
    requireBookings: true,
    revalidateKeys: [HOME_API_KEY, BIKES_API_KEY, BOOKINGS_API_KEY, BOOKING_CONTEXT_API_KEY],
  });

  if (isLoading && !data) {
    return (
      <div className="px-4">
        <HomeTabSkeleton />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="px-4 pb-24 pt-10">
        <Card className="flex flex-col gap-3 rounded-[28px] border border-red-100 bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Kunne ikke hente overblikket</h1>
          <p className="text-sm text-slate-500">
            Appen kunne ikke hente dine data lige nu. Prøv at opdatere igen.
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

  const { viewer, activeBooking, bikes, reminders } = data;

  return (
    <div className="px-4 pb-24 pt-6">
      <div className="flex flex-col gap-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.04em] text-slate-950">
              Hej {viewer.greetingName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">Her er dit overblik</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-2xl border border-orange-300 bg-white px-3 py-1.5 text-sm font-semibold text-orange-500 shadow-sm">
              Pro
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-lg shadow-slate-900/15">
              {viewer.initials}
            </div>
          </div>
        </header>

        <Card className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#8b3dff_0%,#5f49ff_55%,#4865ff_100%)] p-0 text-white shadow-[0_20px_45px_-22px_rgba(94,74,255,0.75)]">
          <div className="flex flex-col gap-4 px-5 py-6">
            <Badge className="w-fit bg-white text-slate-900">BOOK SERVICE</Badge>
            <div className="space-y-2">
              <h2 className="max-w-[16ch] text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.04em]">
                Har du problemer med cyklen?
              </h2>
              <p className="max-w-[28ch] text-sm leading-6 text-white/82">
                Book service direkte i appen og få adgang til dine bookingdetaljer med det samme.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/book">
                <Button variant="secondary" className="min-w-[11rem] bg-white text-violet-700">
                  Start Booking
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  void triggerSync(true);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-medium text-white/92 transition-colors hover:bg-white/10"
              >
                <RefreshCw className={['h-4 w-4', isSyncing ? 'animate-spin' : ''].join(' ')} />
                {isSyncing ? 'Synkroniserer...' : 'Opdater data'}
              </button>
            </div>
          </div>
        </Card>

        {activeBooking && (
          <Link href={`/bookings/${activeBooking.id}`}>
            <Card className="flex items-center justify-between gap-4 rounded-[24px] border border-white/70 bg-white/95 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Aktiv aftale
                </p>
                <p className="mt-1 truncate text-base font-semibold text-slate-950">
                  {[activeBooking.bike?.brand, activeBooking.bike?.model].filter(Boolean).join(' ') ||
                    'Din booking'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {activeBooking.date
                    ? new Date(activeBooking.date).toLocaleDateString('da-DK', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })
                    : 'Dato ikke sat'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3">
                {activeBooking.customer_status && (
                  <BookingStatusBadge status={activeBooking.customer_status} />
                )}
                <span className="text-sm font-semibold text-slate-400">Se mere</span>
              </div>
            </Card>
          </Link>
        )}

        <section className="grid grid-cols-2 gap-3">
          {quickActions.map(({ href, label, icon: Icon, iconClassName }) => (
            <Link key={href} href={href}>
              <Card className="flex min-h-[138px] flex-col items-center justify-center gap-3 rounded-[24px] border border-white/75 bg-white/95 text-center transition-transform active:scale-[0.985]">
                <div
                  className={[
                    'flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-inner',
                    iconClassName,
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-800">
                  {label}
                </span>
              </Card>
            </Link>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Dine Cykler</h2>
            <Link href="/garage" className="text-sm font-semibold text-slate-500">
              Se alle
            </Link>
          </div>

          {bikes.length === 0 ? (
            <Card className="rounded-[24px] border border-dashed border-slate-200 bg-white/92 px-5 py-6">
              <p className="text-sm text-slate-500">
                Ingen cykler endnu. Tilføj din første cykel i garage for at komme i gang.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {bikes.map((bike) => (
                <Link key={bike.id} href={`/garage/${bike.id}`}>
                  <Card className="flex items-center gap-4 rounded-[24px] border border-white/75 bg-white/95 px-4 py-4 transition-transform active:scale-[0.99]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-blue-50 text-blue-600">
                      <Bike className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {[bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel'}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                      {[bike.type, bike.color].filter(Boolean).join(' - ') || 'Klar til service'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {reminders.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                Nærmeste service
              </h2>
            </div>
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <Link key={reminder.id} href={`/book?bikeId=${reminder.bike_id}`}>
                  <Card className="flex items-center gap-4 rounded-[24px] border border-white/75 bg-white/95 px-4 py-4 transition-transform active:scale-[0.99]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {[reminder.bike?.brand, reminder.bike?.model].filter(Boolean).join(' ') ||
                          'Din cykel'}
                      </p>
                      <p className="text-sm text-slate-500">
                        Service forfalder{' '}
                        {new Date(reminder.due_date).toLocaleDateString('da-DK', {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-300">Book</span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
