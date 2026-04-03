'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bike as BikeIcon,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Store,
  Truck,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  addDays,
  formatDateToDanish,
  formatDateToISO,
  generateTimeSlots,
  isDateBlocked,
} from '@/lib/booking/availability';
import type {
  Bike,
  BookingForm,
  BookingMethod,
  BookingMethodServiceTotals,
  BikedeskServiceCatalog,
  MethodLabels,
} from '@/types';

interface BookingWizardProps {
  bikes: Bike[];
  form: BookingForm;
  serviceCatalog: BikedeskServiceCatalog;
  methodServiceTotals?: BookingMethodServiceTotals;
  initialBikeId?: string | null;
}

const DEFAULT_METHOD_LABELS: MethodLabels = {
  workshop: 'Indlevering i butik',
  pickup: 'Hent og bring',
  onsite: 'Paa arbejdsplads',
};

const DEFAULT_METHOD_TOTALS: BookingMethodServiceTotals = {
  workshop: 0,
  pickup: 0,
  onsite: 0,
};

const METHOD_META = {
  drop_off: {
    Icon: Store,
    description: 'Du afleverer cyklen hos os i butikken.',
  },
  pickup: {
    Icon: Truck,
    description: 'Vi henter og bringer cyklen for dig.',
  },
  onsite: {
    Icon: Building2,
    description: 'Vi kommer ud til din arbejdsplads.',
  },
} satisfies Record<BookingMethod, { Icon: typeof Store; description: string }>;

function getMethodLabel(method: BookingMethod, labels: MethodLabels): string {
  if (method === 'drop_off') return labels.workshop;
  if (method === 'pickup') return labels.pickup;
  return labels.onsite;
}

function getMethodKey(method: BookingMethod): keyof BookingMethodServiceTotals {
  if (method === 'drop_off') return 'workshop';
  if (method === 'pickup') return 'pickup';
  return 'onsite';
}

function getTemplatePrice(template: {
  computed_price?: number | null;
  price?: number | null;
  raw_price?: number | null;
}): number {
  return template.computed_price ?? template.price ?? template.raw_price ?? 0;
}

export function BookingWizard({
  bikes,
  form,
  serviceCatalog,
  methodServiceTotals = DEFAULT_METHOD_TOTALS,
  initialBikeId,
}: BookingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialBikeId ? 2 : 1);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(initialBikeId ?? null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<BookingMethod | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [budgetQuote, setBudgetQuote] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState(800);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBike = bikes.find((bike) => bike.id === selectedBikeId) ?? null;
  const selectedTemplate =
    serviceCatalog.templates.find((template) => template.id === selectedTemplateId) ?? null;
  const config = form.config;
  const methodLabels = config.method_labels ?? DEFAULT_METHOD_LABELS;
  const enabledMethods = [
    config.enable_workshop ? ('drop_off' as const) : null,
    config.enable_pickup ? ('pickup' as const) : null,
    config.enable_onsite ? ('onsite' as const) : null,
  ].filter(Boolean) as BookingMethod[];

  useEffect(() => {
    if (enabledMethods.length === 1 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0]);
    }
  }, [enabledMethods, selectedMethod]);

  useEffect(() => {
    if (!selectedMethod) {
      setBookingCounts({});
      return;
    }

    const startDate = formatDateToISO(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    );
    const endDate = formatDateToISO(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0)
    );
    const params = new URLSearchParams({
      formId: form.id,
      startDate,
      endDate,
      method: selectedMethod,
    });

    let cancelled = false;
    setLoadingAvailability(true);

    async function loadAvailability() {
      try {
        const res = await fetch(`/api/booking/availability?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Kunne ikke hente ledige tider');
        }

        if (!cancelled) {
          setBookingCounts(data.counts ?? {});
        }
      } catch (availabilityError) {
        console.error('Availability request failed:', availabilityError);
        if (!cancelled) {
          setBookingCounts({});
        }
      } finally {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      }
    }

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [calendarMonth, form.id, selectedMethod]);

  if (bikes.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6 page-bottom-padding">
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Ingen cykler endnu</h2>
          <p className="text-sm text-gray-600">
            Tilfoej en cykel i din garage foer du kan booke service fra appen.
          </p>
          <Link href="/garage/new">
            <Button variant="primary" fullWidth>
              Tilfoej cykel
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const filteredTemplates = serviceCatalog.templates.filter((template) => {
    const allowedTypes = config.template_vehicle_types?.[template.id] ?? [];
    if (allowedTypes.length === 0) {
      return true;
    }

    if (!selectedBike?.type) {
      return true;
    }

    return allowedTypes.includes(selectedBike.type);
  });

  const groupedTemplates = serviceCatalog.groups
    .map((group) => ({
      group,
      items: filteredTemplates.filter((template) => template.groupid === group.id),
    }))
    .filter((entry) => entry.items.length > 0);

  const ungroupedTemplates = filteredTemplates.filter(
    (template) => !serviceCatalog.groups.some((group) => group.id === template.groupid)
  );

  const calendarSettings = config.calendar_settings;
  const timeSlots =
    selectedMethod && calendarSettings
      ? selectedMethod === 'drop_off' && calendarSettings.workshop_time_slot_enabled
        ? generateTimeSlots(
            calendarSettings.workshop_opening_start,
            calendarSettings.workshop_opening_end,
            calendarSettings.workshop_time_slot_duration
          )
        : selectedMethod === 'pickup' && calendarSettings.pickup_time_slot_enabled
          ? generateTimeSlots(
              calendarSettings.pickup_opening_start,
              calendarSettings.pickup_opening_end,
              calendarSettings.pickup_time_slot_duration
            )
          : selectedMethod === 'onsite' && calendarSettings.onsite_time_slot_enabled
            ? generateTimeSlots(
                calendarSettings.onsite_opening_start,
                calendarSettings.onsite_opening_end,
                calendarSettings.onsite_time_slot_duration
              )
            : []
      : [];

  const daysInMonth = (() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const days: Array<string | null> = [];
    const leadingEmpty = (firstDay + 6) % 7;

    for (let index = 0; index < leadingEmpty; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysCount; day += 1) {
      days.push(formatDateToISO(new Date(year, month, day)));
    }

    return days;
  })();

  const canProceedDate = selectedDate && (!timeSlots.length || selectedTime);
  const showBudget = config.enable_budget_module;

  function isBlocked(dateString: string): boolean {
    if (!calendarSettings || !selectedMethod) {
      return false;
    }

    const today = formatDateToISO(new Date());
    if (dateString <= today) {
      return true;
    }

    const bufferDate = formatDateToISO(addDays(new Date(), calendarSettings.buffer_days));
    if (dateString <= bufferDate) {
      return true;
    }

    return isDateBlocked(dateString, calendarSettings, bookingCounts, getMethodKey(selectedMethod));
  }

  async function handleSubmit() {
    if (!selectedBikeId || !selectedTemplateId || !selectedMethod || !selectedDate) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeId: selectedBikeId,
          templateId: selectedTemplateId,
          method: selectedMethod,
          date: selectedDate,
          time: timeSlots.length > 0 ? selectedTime : null,
          notes: notes.trim() || null,
          budgetLimit: showBudget && !budgetQuote ? budgetLimit : null,
          budgetQuote: showBudget ? budgetQuote : false,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Kunne ikke oprette booking');
      }

      router.push(`/book/confirm?bookingId=${data.booking.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ukendt fejl');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 page-bottom-padding">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((value) => (
          <div
            key={value}
            className={[
              'h-1.5 flex-1 rounded-full transition-colors',
              value <= step ? 'bg-blue-600' : 'bg-gray-200',
            ].join(' ')}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-gray-900">Vaelg cykel</h2>
          {bikes.map((bike) => {
            const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';
            return (
              <button
                key={bike.id}
                onClick={() => {
                  setSelectedBikeId(bike.id);
                  setStep(2);
                }}
                className={[
                  'w-full rounded-2xl border-2 p-4 text-left transition-colors',
                  selectedBikeId === bike.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                    <BikeIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{displayName}</p>
                    <p className="text-sm text-gray-500">
                      {[bike.year, bike.type].filter(Boolean).join(' · ') || 'Ingen detaljer'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Tilbage
          </button>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Vaelg service</h2>
            {config.service_message && (
              <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {config.service_message}
              </p>
            )}
          </div>

          {serviceCatalog.sync_error && filteredTemplates.length === 0 ? (
            <Card className="border border-red-200 bg-red-50">
              <p className="text-sm text-red-700">
                Kunne ikke hente services. Proev at genindlaese siden.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {groupedTemplates.map(({ group, items }) => (
                <section key={group.id} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {group.name || group.label}
                  </p>
                  {items.map((template) => {
                    const price =
                      config.template_price_overrides?.[template.id] ??
                      getTemplatePrice(template);
                    return (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setStep(3);
                        }}
                        className="w-full rounded-2xl border-2 border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900">{template.label}</p>
                            {template.note && (
                              <p className="mt-1 text-sm text-gray-500">{template.note}</p>
                            )}
                          </div>
                          {!config.hide_prices && price > 0 && (
                            <span className="shrink-0 text-sm font-semibold text-gray-700">
                              {price.toLocaleString('da-DK')} kr.
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </section>
              ))}

              {ungroupedTemplates.map((template) => {
                const price =
                  config.template_price_overrides?.[template.id] ??
                  getTemplatePrice(template);
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setStep(3);
                    }}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{template.label}</p>
                        {template.note && (
                          <p className="mt-1 text-sm text-gray-500">{template.note}</p>
                        )}
                      </div>
                      {!config.hide_prices && price > 0 && (
                        <span className="shrink-0 text-sm font-semibold text-gray-700">
                          {price.toLocaleString('da-DK')} kr.
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Tilbage
          </button>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Vaelg dato og metode</h2>
            <p className="mt-1 text-sm text-gray-500">
              Ledige dage styres af Booking-indstillingerne for formularen.
            </p>
          </div>

          <div className={`grid gap-3 ${enabledMethods.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {enabledMethods.map((method) => {
              const { Icon, description } = METHOD_META[method];
              const total = methodServiceTotals[getMethodKey(method)] ?? 0;
              const selected = selectedMethod === method;
              return (
                <button
                  key={method}
                  onClick={() => {
                    setSelectedMethod(method);
                    setSelectedDate(null);
                    setSelectedTime(null);
                  }}
                  className={[
                    'rounded-2xl border-2 p-4 text-left transition-colors',
                    selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white',
                  ].join(' ')}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${selected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {total > 0 && (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {total.toLocaleString('da-DK')} kr.
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">
                    {getMethodLabel(method, methodLabels)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{description}</p>
                </button>
              );
            })}
          </div>

          {selectedMethod && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                    )
                  }
                  className="rounded-lg p-1.5 hover:bg-gray-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-gray-700 capitalize">
                  {calendarMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                    )
                  }
                  className="rounded-lg p-1.5 hover:bg-gray-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lo', 'So'].map((label) => (
                  <div key={label} className="py-1 text-center text-xs text-gray-400">
                    {label}
                  </div>
                ))}
                {daysInMonth.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} />;
                  }

                  const blocked = isBlocked(day);
                  const selected = selectedDate === day;
                  return (
                    <button
                      key={day}
                      disabled={blocked}
                      onClick={() => {
                        setSelectedDate(day);
                        if (!timeSlots.length) {
                          setSelectedTime(null);
                        }
                      }}
                      className={[
                        'aspect-square rounded-lg text-sm transition-colors',
                        blocked
                          ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                          : selected
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-blue-50 text-gray-700',
                      ].join(' ')}
                    >
                      {new Date(day).getDate()}
                    </button>
                  );
                })}
              </div>

              {loadingAvailability && (
                <p className="text-sm text-gray-500">Henter kapacitet...</p>
              )}

              {timeSlots.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Clock3 className="h-4 w-4" />
                    Vaelg tidspunkt
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={[
                          'rounded-xl border-2 py-2 text-sm font-medium transition-colors',
                          selectedTime === slot
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700',
                        ].join(' ')}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Button
            variant="primary"
            fullWidth
            disabled={!canProceedDate}
            onClick={() => setStep(4)}
          >
            Fortsaet
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setStep(3)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Tilbage
          </button>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Bekraeft booking</h2>
            {config.booking_message && (
              <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {config.booking_message}
              </p>
            )}
          </div>

          {error && (
            <Card className="border border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <SummaryRow
              icon={<BikeIcon className="h-4 w-4 text-gray-400" />}
              label="Cykel"
              value={[selectedBike?.brand, selectedBike?.model].filter(Boolean).join(' ') || 'Ukendt cykel'}
            />
            <SummaryRow
              icon={<Wrench className="h-4 w-4 text-gray-400" />}
              label="Service"
              value={selectedTemplate?.label ?? 'Ikke valgt'}
            />
            <SummaryRow
              icon={<CalendarDays className="h-4 w-4 text-gray-400" />}
              label="Dato"
              value={
                selectedDate
                  ? `${formatDateToDanish(selectedDate)}${selectedTime ? ` kl. ${selectedTime}` : ''}`
                  : 'Ikke valgt'
              }
            />
            <SummaryRow
              icon={<Clock3 className="h-4 w-4 text-gray-400" />}
              label="Metode"
              value={selectedMethod ? getMethodLabel(selectedMethod, methodLabels) : 'Ikke valgt'}
            />
          </Card>

          {showBudget && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Budgetgraense</p>
                  <p className="text-sm text-gray-500">
                    Vi kontakter dig hvis arbejdet overstiger beloebet.
                  </p>
                </div>
                <button
                  onClick={() => setBudgetQuote((value) => !value)}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${budgetQuote ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {budgetQuote ? 'Kun tilbud' : 'Fast budget'}
                </button>
              </div>
              {!budgetQuote && (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={300}
                    max={3000}
                    step={100}
                    value={budgetLimit}
                    onChange={(event) => setBudgetLimit(Number(event.target.value))}
                    className="flex-1"
                  />
                  <span className="w-20 text-right text-sm font-semibold text-gray-800">
                    {budgetLimit} kr.
                  </span>
                </div>
              )}
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700" htmlFor="booking-notes">
              Bemerkninger
            </label>
            <textarea
              id="booking-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Fx gear springer, bremser knirker eller andre detaljer"
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedMethod === 'pickup' && (
              <p className="text-sm text-amber-700">
                Pickup-bookinger bliver foerst bekraeftet, naar betalingen er registreret.
              </p>
            )}
          </Card>

          <Button variant="primary" fullWidth loading={submitting} onClick={handleSubmit}>
            {submitting ? 'Sender booking...' : 'Send booking'}
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
