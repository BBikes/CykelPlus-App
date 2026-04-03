import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { BookingStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { Booking, Bike } from '@/types';

export const metadata = { title: 'Bookings — CykelPlus' };

async function getUserBookings(userId: string): Promise<(Booking & { bike: Bike })[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('bookings')
    .select('*, bike:bikes(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as (Booking & { bike: Bike })[];
}

const methodLabels: Record<string, string> = {
  drop_off: 'Indlevering i butik',
  pickup: 'Afhentning & levering',
  onsite: 'På arbejdsplads',
};

export default async function BookingsPage() {
  const session = await getSession();
  const bookings = await getUserBookings(session!.user.id);

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 page-bottom-padding safe-top">
      <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-16 w-16" />}
          title="Ingen bookinger endnu"
          description="Book en service, og den vil dukke op her."
          action={{ label: 'Book service', onClick: () => {} }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => {
            const bikeName =
              [booking.bike?.brand, booking.bike?.model].filter(Boolean).join(' ') || 'Cykel';
            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <Card className="flex flex-col gap-3 active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 truncate">{bikeName}</span>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    {booking.scheduled_date
                      ? new Date(booking.scheduled_date).toLocaleDateString('da-DK', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Dato ikke sat'}
                  </div>
                  {booking.method && (
                    <p className="text-xs text-gray-400">
                      {methodLabels[booking.method] ?? booking.method}
                    </p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
