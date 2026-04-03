'use client';

import { ProfileTabSkeleton } from '@/components/layout/page-skeletons';
import { ProfileForm } from '@/components/profile/profile-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSessionData } from '@/hooks/use-app-data';
import { useBackgroundBikedeskSync } from '@/hooks/use-background-bikedesk-sync';
import { BIKES_API_KEY, BOOKINGS_API_KEY, HOME_API_KEY } from '@/lib/api-keys';

export function ProfileTab() {
  const { data, error, isLoading, mutate } = useSessionData();
  const { isSyncing, triggerSync } = useBackgroundBikedeskSync(data?.sync, {
    revalidateKeys: [HOME_API_KEY, BIKES_API_KEY, BOOKINGS_API_KEY],
  });

  if (isLoading && !data) {
    return (
      <div className="px-4">
        <ProfileTabSkeleton />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="px-4 pb-24 pt-10">
        <Card className="flex flex-col gap-3 rounded-[28px] border border-red-100 bg-white/95 p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Profilen kunne ikke indlaeses</h1>
          <p className="text-sm text-slate-500">
            Vi kunne ikke hente dine oplysninger lige nu. Proev igen.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              void mutate();
            }}
          >
            Proev igen
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ProfileForm
      session={data.session}
      viewer={data.viewer}
      syncRecommended={data.sync.syncRecommended}
      syncInProgress={isSyncing}
      onRefreshData={() => triggerSync(true)}
    />
  );
}
