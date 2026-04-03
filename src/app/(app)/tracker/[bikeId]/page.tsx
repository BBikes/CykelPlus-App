import { notFound } from 'next/navigation';
import { Battery, MapPin, Shield } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getUserBike } from '@/lib/app-bikes';
import { createServiceClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

interface Props {
  params: Promise<{ bikeId: string }>;
}

export default async function TrackerPage({ params }: Props) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { bikeId } = await params;
  const supabase = await createServiceClient();
  const [bike, trackerRes] = await Promise.all([
    getUserBike(session.user.id, bikeId),
    supabase
      .from('tracker_addons')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('bike_id', bikeId)
      .maybeSingle(),
  ]);

  if (!bike) {
    notFound();
  }

  const tracker = trackerRes.data;
  const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Din cykel';

  return (
    <div className="flex flex-col">
      <PageHeader title="Tracker" backHref={`/garage/${bike.id}`} />
      <div className="flex flex-col gap-4 px-4 pb-6 page-bottom-padding">
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">Cykel</p>
          <h2 className="text-xl font-semibold text-gray-900">{displayName}</h2>
          {bike.frame_number && <p className="text-sm text-gray-500">Stelnr: {bike.frame_number}</p>}
        </Card>

        {tracker?.active ? (
          <>
            <Card className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Tracker aktiv</p>
                <p className="text-sm text-gray-500">
                  {tracker.last_position?.timestamp
                    ? `Sidst opdateret ${new Date(tracker.last_position.timestamp).toLocaleString('da-DK')}`
                    : 'Ingen position registreret endnu'}
                </p>
              </div>
              <Badge
                variant={
                  tracker.status === 'active'
                    ? 'green'
                    : tracker.status === 'low_battery'
                      ? 'amber'
                      : 'gray'
                }
              >
                {tracker.status === 'active'
                  ? 'Aktiv'
                  : tracker.status === 'low_battery'
                    ? 'Lavt batteri'
                    : 'Offline'}
              </Badge>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Battery className="h-4 w-4 text-gray-400" />
                Batteri: {tracker.battery_pct ?? 'Ukendt'}%
              </div>
              {tracker.last_position && (
                <div className="text-sm text-gray-700">
                  Position: {tracker.last_position.lat}, {tracker.last_position.lng}
                </div>
              )}
              {tracker.expires_at && (
                <div className="text-sm text-gray-700">
                  Aktiv til: {new Date(tracker.expires_at).toLocaleDateString('da-DK')}
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Shield className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Tracker ikke aktiveret</p>
                <p className="text-sm text-gray-500">
                  Der er ikke et aktivt tracker-abonnement knyttet til denne cykel endnu.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Naar tracker-tilkoebet bliver aktiveret, vises position, batteri og status her i appen.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
