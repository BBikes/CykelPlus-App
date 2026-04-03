'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, CreditCard, XCircle, CheckCircle, Clock, Bike as BikeIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import type { Booking, Bike, BookingEvent } from '@/types';

type BookingDetail = Booking & { bike: Bike; events: BookingEvent[] };

const methodLabels: Record<string, string> = {
  drop_off: 'Indlevering i butik',
  pickup: 'Afhentning & levering',
  onsite: 'På arbejdsplads',
};

const eventLabels: Record<string, string> = {
  created: 'Booking oprettet',
  payment_sent: 'Betalingslink sendt',
  confirmed: 'Booking bekræftet',
  payment_expired: 'Betaling udløbet',
  cancelled: 'Booking annulleret',
};

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async () => {
    const res = await fetch(`/api/bookings/${bookingId}`);
    if (!res.ok) return;
    const data = await res.json();
    setBooking(data.booking);
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Poll every 5s while awaiting payment
  useEffect(() => {
    if (booking?.status !== 'awaiting_payment') return;
    const interval = setInterval(fetchBooking, 5000);
    return () => clearInterval(interval);
  }, [booking?.status, fetchBooking]);

  const handleCancel = async () => {
    if (!confirm('Er du sikker på, at du vil annullere denne booking?')) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Kunne ikke annullere');
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl');
    } finally {
      setCancelling(false);
    }
  };

  const handleResendPayment = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/resend-payment`, { method: 'POST' });
      if (!res.ok) throw new Error('Kunne ikke gensende betalingslink');
      alert('Betalingslink gensendt!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl');
    } finally {
      setResending(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!booking) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-gray-500">Booking ikke fundet</p>
    </div>
  );

  const bikeName = [booking.bike?.brand, booking.bike?.model].filter(Boolean).join(' ') || 'Cykel';
  const canCancel = ['booking_created', 'awaiting_payment'].includes(booking.status);

  return (
    <div className="flex flex-col">
      {/* Status banner */}
      <div
        className={[
          'px-4 py-5 safe-top',
          booking.status === 'booking_confirmed'
            ? 'bg-green-600'
            : booking.status === 'awaiting_payment'
            ? 'bg-amber-500'
            : booking.status === 'payment_expired'
            ? 'bg-red-600'
            : booking.status === 'cancelled'
            ? 'bg-gray-500'
            : 'bg-blue-600',
        ].join(' ')}
      >
        <Link href="/bookings" className="mb-3 flex items-center gap-1 text-sm text-white/80">
          ← Alle bookinger
        </Link>
        <div className="flex items-center gap-3">
          {booking.status === 'booking_confirmed' ? (
            <CheckCircle className="h-8 w-8 text-white" />
          ) : booking.status === 'payment_expired' || booking.status === 'cancelled' ? (
            <XCircle className="h-8 w-8 text-white" />
          ) : (
            <Clock className="h-8 w-8 text-white" />
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{bikeName}</h1>
            <BookingStatusBadge status={booking.status} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 page-bottom-padding">
        {error && (
          <Card className="border border-red-200 bg-red-50">
            <p className="text-sm text-red-600">{error}</p>
          </Card>
        )}

        {/* Awaiting payment CTA */}
        {booking.status === 'awaiting_payment' && (
          <Card className="flex flex-col gap-3 border border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-600" />
              <p className="font-semibold text-amber-900">Betaling afventes</p>
            </div>
            <p className="text-sm text-amber-800">
              Betalingslinket er sendt til dit mobilnummer. Betal inden 24 timer for at bekræfte
              din booking.
            </p>
            {booking.payment_link_url && (
              <a
                href={booking.payment_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button variant="primary" fullWidth>
                  Åbn betalingslink
                </Button>
              </a>
            )}
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              loading={resending}
              onClick={handleResendPayment}
            >
              Gensend betalingslink
            </Button>
          </Card>
        )}

        {/* Payment expired CTA */}
        {booking.status === 'payment_expired' && (
          <Card className="flex flex-col gap-3 border border-red-200 bg-red-50">
            <p className="font-semibold text-red-900">Betaling udløbet</p>
            <p className="text-sm text-red-800">
              Betalingsvinduet er udløbet. Du er velkommen til at oprette en ny booking.
            </p>
            <Link href={`/book?bikeId=${booking.bike_id}`}>
              <Button variant="primary" fullWidth>
                Book igen
              </Button>
            </Link>
          </Card>
        )}

        {/* Booking details */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Detaljer
          </h2>
          <Card padding="none" className="overflow-hidden divide-y divide-gray-100">
            <div className="flex items-center gap-3 px-4 py-3">
              <BikeIcon className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Cykel</p>
                <p className="text-sm font-medium text-gray-900">{bikeName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Dato</p>
                <p className="text-sm font-medium text-gray-900">
                  {booking.scheduled_date
                    ? new Date(booking.scheduled_date).toLocaleDateString('da-DK', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Ikke angivet'}
                  {booking.scheduled_time ? ` kl. ${booking.scheduled_time}` : ''}
                </p>
              </div>
            </div>
            {booking.method && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-4" />
                <div>
                  <p className="text-xs text-gray-400">Servicetype</p>
                  <p className="text-sm font-medium text-gray-900">
                    {methodLabels[booking.method] ?? booking.method}
                  </p>
                </div>
              </div>
            )}
            {booking.service_type && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-4" />
                <div>
                  <p className="text-xs text-gray-400">Service</p>
                  <p className="text-sm font-medium text-gray-900">{booking.service_type}</p>
                </div>
              </div>
            )}
            {booking.notes && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Note</p>
                  <p className="text-sm text-gray-900">{booking.notes}</p>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Timeline */}
        {booking.events.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Hændelser
            </h2>
            <Card className="flex flex-col gap-3">
              {booking.events.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mt-1" />
                    {i < booking.events.length - 1 && (
                      <div className="mt-1 h-full w-px bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-sm font-medium text-gray-900">
                      {eventLabels[event.event_type] ?? event.event_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleString('da-DK')}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* Cancel */}
        {canCancel && (
          <Button
            variant="danger"
            size="md"
            fullWidth
            loading={cancelling}
            onClick={handleCancel}
          >
            Annuller booking
          </Button>
        )}
      </div>
    </div>
  );
}
