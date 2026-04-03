import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Wrench, Clock, AlertTriangle, Bike as BikeIcon, MapPin } from 'lucide-react';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import type { Bike, BikeHistoryEntry, ServiceReminder, TrackerAddon } from '@/types';

interface Props {
  params: Promise<{ bikeId: string }>;
}

async function getBikeData(bikeId: string, userId: string) {
  const supabase = await createServiceClient();

  const [bikeRes, historyRes, remindersRes, trackerRes] = await Promise.all([
    supabase.from('bikes').select('*').eq('id', bikeId).eq('user_id', userId).maybeSingle(),
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
    bike: bikeRes.data as Bike | null,
    history: (historyRes.data ?? []) as BikeHistoryEntry[],
    reminders: (remindersRes.data ?? []) as ServiceReminder[],
    tracker: trackerRes.data as TrackerAddon | null,
  };
}

export default async function BikeDetailPage({ params }: Props) {
  const { bikeId } = await params;
  const session = await getSession();
  const { bike, history, reminders, tracker } = await getBikeData(bikeId, session!.user.id);

  if (!bike) notFound();

  const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';
  const latestService = history.find((h) => h.entry_type === 'service');
  const latestRepair = history.find((h) => h.entry_type === 'repair');
  const overdueReminders = reminders.filter((r) => new Date(r.due_date) < new Date());

  return (
    <div className="flex flex-col">
      <PageHeader title={displayName} backHref="/garage" />

      <div className="flex flex-col gap-5 px-4 pb-6 page-bottom-padding">
        {/* Bike hero card */}
        <Card className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100">
            <BikeIcon className="h-8 w-8 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900">{displayName}</h2>
            <p className="text-sm text-gray-500">
              {[bike.year, bike.type, bike.color].filter(Boolean).join(' · ')}
            </p>
            {bike.frame_number && (
              <p className="text-xs text-gray-400">Stelnr: {bike.frame_number}</p>
            )}
          </div>
        </Card>

        {/* Book service CTA */}
        <Link href={`/book?bikeId=${bike.id}`}>
          <Button variant="primary" size="lg" fullWidth>
            <Wrench className="h-5 w-5" />
            Book service
          </Button>
        </Link>

        {/* Service reminders */}
        {reminders.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Servicereminders
            </h3>
            <div className="flex flex-col gap-2">
              {reminders.map((r) => (
                <Card key={r.id} className="flex items-center gap-3">
                  <AlertTriangle
                    className={`h-5 w-5 shrink-0 ${
                      overdueReminders.includes(r) ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {r.rule?.rule_name ?? 'Service påmindelse'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Forfaldsdato:{' '}
                      {new Date(r.due_date).toLocaleDateString('da-DK', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {overdueReminders.includes(r) && (
                    <Badge variant="red">Overskredet</Badge>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Latest service */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Seneste service
          </h3>
          {latestService ? (
            <Card className="flex flex-col gap-1.5">
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

        {/* Latest repair */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Seneste reparation
          </h3>
          {latestRepair ? (
            <Card className="flex flex-col gap-1.5">
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

        {/* Full history */}
        {history.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Al historik
            </h3>
            <div className="flex flex-col gap-2">
              {history.map((entry) => (
                <Card key={entry.id} className="flex items-center gap-3">
                  <Badge variant={entry.entry_type === 'service' ? 'blue' : 'amber'}>
                    {entry.entry_type === 'service' ? 'Service' : 'Reparation'}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                    {entry.completed_at && (
                      <p className="text-xs text-gray-500">
                        {new Date(entry.completed_at).toLocaleDateString('da-DK')}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Tracker */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Tracker
          </h3>
          {tracker?.active ? (
            <Link href={`/tracker/${bike.id}`}>
              <Card className="flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Tracker aktiv</p>
                  {tracker.last_position && (
                    <p className="text-xs text-gray-500">
                      Sidst set:{' '}
                      {new Date(tracker.last_position.timestamp).toLocaleString('da-DK')}
                    </p>
                  )}
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
            </Link>
          ) : (
            <Card className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <MapPin className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Tracker ikke aktiveret</p>
                <p className="text-sm text-gray-500">Tilkøb tracker for GPS-sporing</p>
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
