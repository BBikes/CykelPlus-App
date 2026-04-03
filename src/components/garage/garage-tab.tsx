'use client';

import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import { GarageTabSkeleton } from '@/components/layout/page-skeletons';
import { BikeCard } from '@/components/garage/bike-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGarageData } from '@/hooks/use-app-data';
import { useBackgroundBikedeskSync } from '@/hooks/use-background-bikedesk-sync';
import { BIKES_API_KEY, BOOKING_CONTEXT_API_KEY, HOME_API_KEY } from '@/lib/api-keys';

export function GarageTab() {
  const { data, error, isLoading, mutate } = useGarageData();
  const { isSyncing, triggerSync } = useBackgroundBikedeskSync(data?.sync, {
    requireBikes: true,
    revalidateKeys: [BIKES_API_KEY, HOME_API_KEY, BOOKING_CONTEXT_API_KEY],
  });

  if (isLoading && !data) {
    return (
      <div className="px-4">
        <GarageTabSkeleton />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="px-4 pb-24 pt-10">
        <Card className="flex flex-col gap-3 rounded-[28px] border border-red-100 bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Garage er ikke klar</h1>
          <p className="text-sm text-slate-500">
            Vi kunne ikke hente dine cykler lige nu. Prøv at opdatere igen.
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
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">
              Mine Cykler
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Alt du har registreret i BikeDesk, samlet i appen.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void triggerSync(true);
              }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-slate-500 shadow-sm"
              aria-label="Opdater cykler"
            >
              <RefreshCw className={['h-4 w-4', isSyncing ? 'animate-spin' : ''].join(' ')} />
            </button>
            <Link href="/garage/new">
              <Button
                size="md"
                variant="primary"
                className="h-12 rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Tilfoj
              </Button>
            </Link>
          </div>
        </header>

        {data.bikes.length === 0 ? (
          <Card className="flex flex-col gap-3 rounded-[28px] border border-dashed border-slate-200 bg-white/92 px-5 py-8">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
              Ingen cykler endnu
            </h2>
            <p className="text-sm leading-6 text-slate-500">
              Tilføj din første cykel for at se historik, bookingdetaljer og trackerstatus i
              samme overblik.
            </p>
            <Link href="/garage/new" className="pt-2">
              <Button variant="primary" className="rounded-2xl bg-slate-900">
                Tilføj cykel
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.bikes.map((bike) => (
              <BikeCard key={bike.id} bike={bike} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
