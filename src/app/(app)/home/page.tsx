import Link from 'next/link';
import { Plus, Wrench, CalendarDays, AlertTriangle } from 'lucide-react';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { getLatestActiveBooking } from '@/lib/app-bookings';
import { Card } from '@/components/ui/card';
import { BookingStatusBadge } from '@/components/ui/badge';
import type { Booking, ServiceReminder, Bike } from '@/types';

export const metadata = { title: 'Hjem - CykelPlus' };

async function getHomeData(user: { id: string; phone: string }) {
  const supabase = await createServiceClient();
  const [activeBooking, remindersRes] = await Promise.all([
    getLatestActiveBooking(user),
    supabase
      .from('service_reminders')
      .select('*, bike:bikes(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte(
        'due_date',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
      .order('due_date', { ascending: true })
      .limit(3),
  ]);

  return {
    activeBooking,
    reminders: (remindersRes.data ?? []) as (ServiceReminder & { bike: Bike })[],
  };
}

export default async function HomePage() {
  const session = await getSession();
  await ensureBikeDeskSync(session!, { requireBikes: true, requireBookings: true });

  const refreshedSession = await getSession();
  const firstName = refreshedSession?.profile?.first_name ?? 'der';
  const { activeBooking, reminders } = await getHomeData(refreshedSession!.user);

  return (
    <div className="flex flex-col gap-5 px-4 pt-12 page-bottom-padding safe-top">
      <div>
        <p className="text-sm text-gray-500">Hej, {firstName}</p>
        <h1 className="text-2xl font-bold text-gray-900">CykelPlus</h1>
      </div>

      {activeBooking?.customer_status && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Aktiv booking
          </h2>
          <Link href={`/bookings/${activeBooking.id}`}>
            <Card className="flex flex-col gap-3 transition-transform active:scale-[0.98]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">
                  {activeBooking.bike?.brand} {activeBooking.bike?.model}
                </span>
                <BookingStatusBadge status={activeBooking.customer_status} />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CalendarDays className="h-4 w-4" />
                {activeBooking.date
                  ? new Date(activeBooking.date).toLocaleDateString('da-DK', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })
                  : 'Dato ikke sat'}
              </div>
              <p className="text-sm font-medium text-blue-600">Se detaljer →</p>
            </Card>
          </Link>
        </section>
      )}

      {reminders.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Servicereminders
          </h2>
          <div className="flex flex-col gap-2">
            {reminders.map((reminder) => (
              <Card key={reminder.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {reminder.bike?.brand} {reminder.bike?.model}
                  </p>
                  <p className="text-xs text-gray-500">
                    Service forfaldsdato:{' '}
                    {new Date(reminder.due_date).toLocaleDateString('da-DK', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>
                <Link href={`/book?bikeId=${reminder.bike_id}`}>
                  <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                    Book
                  </button>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Hurtige handlinger
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/book">
            <Card className="flex flex-col items-center gap-2 py-6 text-center transition-transform active:scale-[0.97]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-gray-900">Book service</span>
            </Card>
          </Link>
          <Link href="/garage">
            <Card className="flex flex-col items-center gap-2 py-6 text-center transition-transform active:scale-[0.97]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Plus className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm font-semibold text-gray-900">Min garage</span>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
