import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Bike as BikeIcon,
  Clock,
  MapPin,
  Pencil,
  Wrench,
} from 'lucide-react';
import { getSession } from '@/lib/session';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { createServiceClient } from '@/lib/supabase/server';
import { getUserBike } from '@/lib/app-bikes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import type { BikeHistoryEntry, ServiceReminder, TrackerAddon } from '@/types';

interface Props {
  params: Promise<{ bikeId: string }>;
}

async function getBikePageData(userId: string, bikeId: string) {
  const supabase = await createServiceClient();
  const [bike, historyRes, reminderRes, trackerRes] = await Promise.all([
    getUserBike(userId, bikeId),
    supabase
      .from('bike_history_cache')
      .select('*')
      .eq('bike_id', bikeId)
      .order('completed_at', { ascending: false })
      .limit(10),
    supabase
      .from('service_reminders')
      .select('*')
      .eq('bike_id', bikeId)
      .eq('status', 'pending')
      .order('due_date', { ascending: true }),
    supabase
      .from('tracker_addons')
      .select('*')
      .eq('bike_id', bikeId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  return {
    bike,
    history: (historyRes.data ?? []) as BikeHistoryEntry[],
    reminders: (reminderRes.data ?? []) as ServiceReminder[],
    tracker: trackerRes.data as TrackerAddon | null,
  };
}

export default async function BikeDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { bikeId } = await params;
  await ensureBikeDeskSync(session, { requireBikes: true });
  const { bike, history, reminders, tracker } = await getBikePageData(session.user.id, bikeId);

  if (!bike) {
    notFound();
  }

  const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';
  const overdueReminders = reminders.filter((reminder) => new Date(reminder.due_date) < new Date());
  const latestService = history.find((entry) => entry.entry_type === 'service');
  const latestRepair = history.find((entry) => entry.entry_type === 'repair');

  return (
    <div className="flex flex-col">
      <PageHeader
        title={displayName}
        backHref="/garage"
        action={
          <Link href={`/garage/${bike.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Rediger
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-5 px-4 pb-6 page-bottom-padding">
        <Card className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100">
            <BikeIcon className="h-8 w-8 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900">{displayName}</h2>
            <p className="text-sm text-gray-500">
              {[bike.year, bike.type, bike.color].filter(Boolean).join(' · ') || 'Ingen detaljer'}
            </p>
            {bike.frame_number && (
              <p className="text-xs text-gray-400">Stelnr: {bike.frame_number}</p>
            )}
          </div>
        </Card>

        <Link href={`/book?bikeId=${bike.id}`}>
          <Button variant="primary" size="lg" fullWidth>
            <Wrench className="h-5 w-5" />
            Book service
          </Button>
        </Link>

        {reminders.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Servicereminders
            </h3>
            {reminders.map((reminder) => (
              <Card key={reminder.id} className="flex items-center gap-3">
                <AlertTriangle
                  className={[
                    'h-5 w-5 shrink-0',
                    overdueReminders.some((entry) => entry.id === reminder.id)
                      ? 'text-red-500'
                      : 'text-amber-500',
                  ].join(' ')}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Servicepaamindelse</p>
                  <p className="text-xs text-gray-500">
                    Forfaldsdato:{' '}
                    {new Date(reminder.due_date).toLocaleDateString('da-DK', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {overdueReminders.some((entry) => entry.id === reminder.id) && (
                  <Badge variant="red">Overskredet</Badge>
                )}
              </Card>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Seneste service
          </h3>
          {latestService ? (
            <Card className="flex flex-col gap-2">
              <p className="font-medium text-gray-900">{latestService.title}</p>
              {latestService.completed_at && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  {new Date(latestService.completed_at).toLocaleDateString('da-DK', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              )}
              {latestService.description && (
                <p className="text-sm text-gray-600">{latestService.description}</p>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-gray-500">Ingen servicehistorik fundet endnu.</p>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Seneste reparation
          </h3>
          {latestRepair ? (
            <Card className="flex flex-col gap-2">
              <p className="font-medium text-gray-900">{latestRepair.title}</p>
              {latestRepair.completed_at && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  {new Date(latestRepair.completed_at).toLocaleDateString('da-DK', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              )}
              {latestRepair.description && (
                <p className="text-sm text-gray-600">{latestRepair.description}</p>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-gray-500">Ingen reparationshistorik fundet endnu.</p>
            </Card>
          )}
        </section>

        {history.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Historik
            </h3>
            {history.map((entry) => (
              <Card key={entry.id} className="flex items-center gap-3">
                <Badge variant={entry.entry_type === 'service' ? 'blue' : 'amber'}>
                  {entry.entry_type === 'service' ? 'Service' : 'Reparation'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{entry.title}</p>
                  {entry.completed_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(entry.completed_at).toLocaleDateString('da-DK')}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Tracker</h3>
          <Link href={`/tracker/${bike.id}`}>
            <Card className="flex items-center gap-3 transition-transform active:scale-[0.98]">
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  tracker?.active ? 'bg-green-100' : 'bg-gray-100',
                ].join(' ')}
              >
                <MapPin
                  className={[
                    'h-5 w-5',
                    tracker?.active ? 'text-green-600' : 'text-gray-400',
                  ].join(' ')}
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {tracker?.active ? 'Tracker aktiv' : 'Tracker ikke aktiveret'}
                </p>
                <p className="text-sm text-gray-500">
                  {tracker?.last_position?.timestamp
                    ? `Sidst set ${new Date(tracker.last_position.timestamp).toLocaleString('da-DK')}`
                    : 'Aabn trackersiden for status og detaljer'}
                </p>
              </div>
              <Badge
                variant={
                  tracker?.status === 'active'
                    ? 'green'
                    : tracker?.status === 'low_battery'
                      ? 'amber'
                      : 'gray'
                }
              >
                {tracker?.status === 'active'
                  ? 'Aktiv'
                  : tracker?.status === 'low_battery'
                    ? 'Lavt batteri'
                    : 'Ikke aktiv'}
              </Badge>
            </Card>
          </Link>
        </section>
      </div>
    </div>
  );
}
