import Link from 'next/link';
import { Clock, CheckCircle } from 'lucide-react';
import { getSession } from '@/lib/session';
import { getUserBooking } from '@/lib/app-bookings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  searchParams: Promise<{ bookingId?: string }>;
}

export default async function BookConfirmPage({ searchParams }: Props) {
  const { bookingId } = await searchParams;
  const session = await getSession();

  if (!session || !bookingId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-center text-gray-500">Booking ikke fundet.</p>
      </div>
    );
  }

  const booking = await getUserBooking(session.user, bookingId);
  if (!booking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-center text-gray-500">Booking ikke fundet.</p>
      </div>
    );
  }

  const awaitingPayment = booking.customer_status === 'awaiting_payment';

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-12 text-center safe-top">
      <div
        className={[
          'flex h-20 w-20 items-center justify-center rounded-full',
          awaitingPayment ? 'bg-amber-100' : 'bg-green-100',
        ].join(' ')}
      >
        {awaitingPayment ? (
          <Clock className="h-10 w-10 text-amber-600" />
        ) : (
          <CheckCircle className="h-10 w-10 text-green-600" />
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {awaitingPayment ? 'Booking modtaget' : 'Booking bekraeftet'}
        </h1>
        <p className="mt-2 text-gray-600">
          {awaitingPayment
            ? 'Vi afventer betaling, foer afhentningen bliver endeligt bekraeftet.'
            : 'Din booking ligger nu i systemet og er klar til naeste trin.'}
        </p>
      </div>

      {awaitingPayment && (
        <Card className="w-full max-w-sm border border-amber-200 bg-amber-50 text-left">
          <p className="text-sm text-amber-900">
            Betalingslinket bliver gemt paa bookingen. Hvis det ikke vises endnu, kan du aabne
            bookingen og gensende linket.
          </p>
        </Card>
      )}

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href={`/bookings/${booking.id}`}>
          <Button variant="primary" fullWidth>
            Se booking
          </Button>
        </Link>
        <Link href="/home">
          <Button variant="secondary" fullWidth>
            Til hjem
          </Button>
        </Link>
      </div>
    </div>
  );
}
