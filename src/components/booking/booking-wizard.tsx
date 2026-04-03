'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bike as BikeIcon, Wrench, CalendarDays, CheckCircle } from 'lucide-react';
import type { Bike } from '@/types';

type BookingMethod = 'drop_off' | 'pickup' | 'onsite';

interface BookingWizardState {
  step: number;
  bikeId: string | null;
  serviceType: string | null;
  description: string;
  method: BookingMethod | null;
  date: string | null;
  time: string | null;
  notes: string;
}

interface BookingWizardProps {
  bikes: Bike[];
  initialBikeId?: string | null;
}

const SERVICE_TYPES = [
  { id: 'service', label: 'Almindelig service', description: 'Grundlæggende eftersyn og smøring' },
  { id: 'repair', label: 'Reparation', description: 'Afhjælpning af konkret fejl eller skade' },
  { id: 'tuning', label: 'Tuning', description: 'Gearskift, bremser og generel indstilling' },
  { id: 'elektrisk', label: 'El-cykel service', description: 'Motor, batteri og elektronik' },
];

const METHODS: { id: BookingMethod; label: string; description: string; hasPayment: boolean }[] = [
  {
    id: 'drop_off',
    label: 'Indlevering i butik',
    description: 'Du afleverer cyklen i butikken på den valgte dato.',
    hasPayment: false,
  },
  {
    id: 'pickup',
    label: 'Afhentning & levering',
    description: 'Vi henter og afleverer cyklen hos dig. Betaling kræves ved booking.',
    hasPayment: true,
  },
];

const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

function getNextDays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // Start from tomorrow
  while (days.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function BookingWizard({ bikes, initialBikeId }: BookingWizardProps) {
  const router = useRouter();
  const [state, setState] = useState<BookingWizardState>({
    step: initialBikeId ? 2 : 1,
    bikeId: initialBikeId ?? null,
    serviceType: null,
    description: '',
    method: null,
    date: null,
    time: null,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<BookingWizardState>) =>
    setState((s) => ({ ...s, ...patch }));

  const selectedBike = bikes.find((b) => b.id === state.bikeId);
  const availableDays = getNextDays(14);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bike_id: state.bikeId,
          service_type: state.serviceType,
          description: state.description,
          method: state.method,
          scheduled_date: state.date,
          scheduled_time: state.time,
          notes: state.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fejl ved oprettelse af booking');
      router.push(`/book/confirm?bookingId=${data.booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step indicators ─────────────────────────────────────────
  const TOTAL_STEPS = 5;
  const stepLabels = ['Cykel', 'Problem', 'Metode', 'Dato', 'Bekræft'];

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 page-bottom-padding">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={[
              'h-1.5 flex-1 rounded-full transition-colors',
              i < state.step ? 'bg-blue-600' : 'bg-gray-200',
            ].join(' ')}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Trin {state.step} af {TOTAL_STEPS} — {stepLabels[state.step - 1]}
      </p>

      {/* ── Step 1: Select bike ────────────────────────────────── */}
      {state.step === 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-gray-900">Vælg cykel</h2>
          {bikes.map((bike) => {
            const name = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';
            return (
              <button
                key={bike.id}
                onClick={() => update({ bikeId: bike.id, step: 2 })}
                className={[
                  'w-full text-left rounded-2xl border-2 p-4 transition-colors touch-manipulation',
                  state.bikeId === bike.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <BikeIcon className="h-6 w-6 text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-900">{name}</p>
                    <p className="text-sm text-gray-500">
                      {[bike.year, bike.type].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
          {bikes.length === 0 && (
            <p className="text-gray-500 text-sm">
              Du har ingen cykler i din garage. Tilføj en cykel først.
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: Service type ───────────────────────────────── */}
      {state.step === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-gray-900">Hvad handler det om?</h2>
          {SERVICE_TYPES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => update({ serviceType: svc.id })}
              className={[
                'w-full text-left rounded-2xl border-2 p-4 transition-colors touch-manipulation',
                state.serviceType === svc.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white',
              ].join(' ')}
            >
              <p className="font-semibold text-gray-900">{svc.label}</p>
              <p className="text-sm text-gray-500">{svc.description}</p>
            </button>
          ))}
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-sm font-medium text-gray-700">
              Beskriv problemet (valgfrit)
            </label>
            <textarea
              value={state.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="F.eks. gearskift springer, bremserne knirker..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="secondary" onClick={() => update({ step: 1 })} fullWidth>
              Tilbage
            </Button>
            <Button
              variant="primary"
              onClick={() => update({ step: 3 })}
              disabled={!state.serviceType}
              fullWidth
            >
              Fortsæt
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Method ────────────────────────────────────── */}
      {state.step === 3 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-gray-900">Hvordan ønsker du service?</h2>
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => update({ method: m.id })}
              className={[
                'w-full text-left rounded-2xl border-2 p-4 transition-colors touch-manipulation',
                state.method === m.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white',
              ].join(' ')}
            >
              <p className="font-semibold text-gray-900">{m.label}</p>
              <p className="text-sm text-gray-500">{m.description}</p>
              {m.hasPayment && (
                <p className="mt-1 text-xs text-amber-600 font-medium">
                  Betaling påkrævet for at bekræfte booking
                </p>
              )}
            </button>
          ))}
          <div className="flex gap-3 mt-2">
            <Button variant="secondary" onClick={() => update({ step: 2 })} fullWidth>
              Tilbage
            </Button>
            <Button
              variant="primary"
              onClick={() => update({ step: 4 })}
              disabled={!state.method}
              fullWidth
            >
              Fortsæt
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Date & time ──────────────────────────────── */}
      {state.step === 4 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900">Vælg dato og tid</h2>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-700">Dato</p>
            <div className="grid grid-cols-3 gap-2">
              {availableDays.slice(0, 9).map((day) => {
                const d = new Date(day);
                return (
                  <button
                    key={day}
                    onClick={() => update({ date: day })}
                    className={[
                      'rounded-xl border-2 p-2 text-center transition-colors touch-manipulation',
                      state.date === day
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white',
                    ].join(' ')}
                  >
                    <p className="text-xs text-gray-500">
                      {d.toLocaleDateString('da-DK', { weekday: 'short' })}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-700">Tidspunkt</p>
            <div className="grid grid-cols-3 gap-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  onClick={() => update({ time: t })}
                  className={[
                    'rounded-xl border-2 py-2 text-center font-medium transition-colors touch-manipulation',
                    state.time === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <Button variant="secondary" onClick={() => update({ step: 3 })} fullWidth>
              Tilbage
            </Button>
            <Button
              variant="primary"
              onClick={() => update({ step: 5 })}
              disabled={!state.date || !state.time}
              fullWidth
            >
              Fortsæt
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Review & confirm ─────────────────────────── */}
      {state.step === 5 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900">Bekræft booking</h2>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <BikeIcon className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Cykel:</span>
              <span className="font-medium text-gray-900">
                {[selectedBike?.brand, selectedBike?.model].filter(Boolean).join(' ') ||
                  'Ukendt cykel'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Service:</span>
              <span className="font-medium text-gray-900">
                {SERVICE_TYPES.find((s) => s.id === state.serviceType)?.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Dato:</span>
              <span className="font-medium text-gray-900">
                {state.date
                  ? new Date(state.date).toLocaleDateString('da-DK', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })
                  : ''}
                {state.time ? ` kl. ${state.time}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Metode:</span>
              <span className="font-medium text-gray-900">
                {state.method === 'pickup' ? 'Afhentning & levering' : 'Indlevering i butik'}
              </span>
            </div>
          </Card>

          {state.method === 'pickup' && (
            <Card className="border border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800">
                Bemærk: Du modtager et betalingslink på SMS. Booking bekræftes først, når betaling
                er registreret inden for 24 timer.
              </p>
            </Card>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Note (valgfrit)</label>
            <textarea
              value={state.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Eventuelle ekstra informationer..."
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => update({ step: 4 })} fullWidth>
              Tilbage
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              fullWidth
            >
              Opret booking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
