import { Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Booking } from '@/types';

interface Props {
  searchParams: Promise<{ bookingId?: string }>;
}

async function BookingConfirmContent({ bookingId }: { bookingId: string }) {
  const session = await getSession();
  const supabase = await createServiceClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('user_id', session!.user.id)
    .maybeSingle();

  if (!booking) {
    return <p className="text-gray-500">Booking ikke fundet.</p>;
  }

  const b = booking as Booking;
  const isPickup = b.method === 'pickup';

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-12 text-center safe-top">
      <div
        className={[
          'flex h-20 w-20 items-center justify-center rounded-full',
          isPickup ? 'bg-amber-100' : 'bg-green-100',
        ].join(' ')}
      >
        {isPickup ? (
          <Clock className="h-10 w-10 text-amber-600" />
        ) : (
          <CheckCircle className="h-10 w-10 text-green-600" />
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isPickup ? 'Booking modtaget!' : 'Booking bekræftet!'}
        </h1>
        <p className="mt-2 text-gray-600">
          {isPickup
            ? 'Du modtager et betalingslink på SMS inden for kort tid. Betaling skal gennemføres inden 24 timer.'
            : 'Din booking er bekræftet. Vi ses på den aftalte dato!'}
        </p>
      </div>

      {isPickup && (
        <Card className="w-full max-w-sm border border-amber-200 bg-amber-50 text-left">
          <p className="text-sm text-amber-800">
            Husk: Booking bekræftes først, når betaling er registreret.
          </p>
        </Card>
      )}

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href={`/bookings/${b.id}`}>
          <Button variant="primary" fullWidth>
            Se booking
          </Button>
        </Link>
        <Link href="/home">
          <Button variant="secondary" fullWidth>
            Til forsiden
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default async function BookConfirmPage({ searchParams }: Props) {
  const { bookingId } = await searchParams;

  if (!bookingId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-gray-500">Ingen booking-ID angivet.</p>
      </div>
    );
  }

  return (
    <Suspense>
      <BookingConfirmContent bookingId={bookingId} />
    </Suspense>
  );
}
