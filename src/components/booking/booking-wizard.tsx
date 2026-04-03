'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  addDays,
  formatDateToDanish,
  formatDateToISO,
  generateTimeSlots,
  isDateBlocked,
} from '@/lib/booking/availability';
import { BOOKINGS_API_KEY, HOME_API_KEY } from '@/lib/api-keys';
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
  onsite: 'På arbejdsplads',
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

function getStepTitle(step: number): string {
  if (step === 1) return 'Vælg køretøj';
  if (step === 2) return 'Vælg service';
  if (step === 3) return 'Dato og metode';
  return 'Bekræft booking';
}

function getStepDescription(step: number): string {
  if (step === 1) return 'Vælg den cykel, som skal have service.';
  if (step === 2) return 'Vi viser kun services, der passer til din cykel.';
  if (step === 3) return 'Vælg hvordan og hvornår servicen skal ske.';
  return 'Gennemgå dine valg, før vi sender bookinganmodningen.';
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
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function BookingWizard({
  bikes,
  form,
  serviceCatalog,
  methodServiceTotals = DEFAULT_METHOD_TOTALS,
  initialBikeId,
}: BookingWizardProps) {
  const router = useRouter();
  const initialSelectedBike =
    initialBikeId && bikes.some((bike) => bike.id === initialBikeId) ? initialBikeId : null;
  const [step, setStep] = useState(initialSelectedBike ? 2 : 1);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(initialSelectedBike);
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

  const filteredTemplates = useMemo(() => {
    return serviceCatalog.templates.filter((template) => {
      const allowedTypes = config.template_vehicle_types?.[template.id] ?? [];
      if (allowedTypes.length === 0 || !selectedBike?.type) {
        return true;
      }

      return allowedTypes.includes(selectedBike.type);
    });
  }, [config.template_vehicle_types, selectedBike?.type, serviceCatalog.templates]);

  useEffect(() => {
    if (selectedTemplateId && !filteredTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(null);
    }
  }, [filteredTemplates, selectedTemplateId]);

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
        console.error('[booking-debug] booking_wizard.availability_failed', {
          error:
            availabilityError instanceof Error ? availabilityError.message : String(availabilityError),
          formId: form.id,
          method: selectedMethod,
          startDate,
          endDate,
        });
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
      <Card className="flex flex-col gap-4 rounded-[28px] p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
          Ingen cykler endnu
        </h2>
        <p className="text-sm leading-6 text-slate-500">
          Tilføj en cykel i din garage før du kan booke service fra appen.
        </p>
        <Link href="/garage/new">
          <Button variant="primary" className="rounded-2xl bg-slate-900">
            Tilføj cykel
          </Button>
        </Link>
      </Card>
    );
  }

  const groupedTemplates = serviceCatalog.groups
    .map((group) => ({
      group,
      items: filteredTemplates.filter((template) => template.groupid === group.id),
    }))
    .filter((entry) => entry.items.length > 0);

  const ungroupedTemplates = filteredTemplates.filter(
    (template) => !serviceCatalog.groups.some((group) => group.id === template.groupid)
  );

  const calendarSettings = form.config.calendar_settings;
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

  const showBudget = form.config.enable_budget_module;
  const selectedTemplate =
    serviceCatalog.templates.find((template) => template.id === selectedTemplateId) ?? null;
  const canProceedDate = selectedDate && (!timeSlots.length || selectedTime);

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

  function canContinue(): boolean {
    if (step === 1) return Boolean(selectedBikeId);
    if (step === 2) return Boolean(selectedTemplateId);
    if (step === 3) return Boolean(canProceedDate);
    return true;
  }

  function handleContinue() {
    if (!canContinue()) return;
    setStep((current) => Math.min(4, current + 1));
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
        console.error('[booking-debug] booking_wizard.submit_failed_response', {
          status: res.status,
          error: data?.error ?? 'Kunne ikke oprette booking',
          bikeId: selectedBikeId,
          templateId: selectedTemplateId,
          method: selectedMethod,
          date: selectedDate,
        });
        throw new Error(data.error ?? 'Kunne ikke oprette booking');
      }

      await Promise.all([mutate(HOME_API_KEY), mutate(BOOKINGS_API_KEY)]);
      router.push(`/bookings/${data.booking.id}`);
    } catch (submitError) {
      console.error('[booking-debug] booking_wizard.submit_failed', {
        error: submitError instanceof Error ? submitError.message : String(submitError),
        bikeId: selectedBikeId,
        templateId: selectedTemplateId,
        method: selectedMethod,
        date: selectedDate,
        time: timeSlots.length > 0 ? selectedTime : null,
      });
      setError(submitError instanceof Error ? submitError.message : 'Ukendt fejl');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm font-medium text-slate-500">
        {step === 1 ? (
          <Link href="/home" className="transition-colors hover:text-slate-700">
            Annuller
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="inline-flex items-center gap-1 transition-colors hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Tilbage
          </button>
        )}
        <span>Trin {step} af 4</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((value) => (
          <div
            key={value}
            className={[
              'h-1.5 rounded-full transition-colors',
              value <= step ? 'bg-slate-900' : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="space-y-1">
        <h2 className="text-[1.9rem] font-semibold leading-none tracking-[-0.04em] text-slate-950">
          {getStepTitle(step)}
        </h2>
        <p className="text-sm leading-6 text-slate-500">{getStepDescription(step)}</p>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          {bikes.map((bike) => {
            const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';
            const selected = selectedBikeId === bike.id;

            return (
              <button
                key={bike.id}
                type="button"
                onClick={() => setSelectedBikeId(bike.id)}
                className={[
                  'w-full rounded-[24px] border px-4 py-4 text-left transition-colors',
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_44px_-28px_rgba(15,23,42,0.95)]'
                    : 'border-white/80 bg-white/92 text-slate-900',
                ].join(' ')}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={[
                      'flex h-14 w-14 items-center justify-center rounded-[18px]',
                      selected ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600',
                    ].join(' ')}
                  >
                    <BikeIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{displayName}</p>
                    <p className={['truncate text-sm', selected ? 'text-white/70' : 'text-slate-500'].join(' ')}>
                      {[bike.type, bike.color].filter(Boolean).join(' - ') || 'Klar til service'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <StepTwo
          config={config}
          groupedTemplates={groupedTemplates}
          ungroupedTemplates={ungroupedTemplates}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          syncError={serviceCatalog.sync_error}
        />
      )}

      {step === 3 && (
        <StepThree
          calendarMonth={calendarMonth}
          calendarSettings={calendarSettings}
          daysInMonth={daysInMonth}
          enabledMethods={enabledMethods}
          isBlocked={isBlocked}
          loadingAvailability={loadingAvailability}
          methodLabels={methodLabels}
          methodServiceTotals={methodServiceTotals}
          selectedDate={selectedDate}
          selectedMethod={selectedMethod}
          selectedTime={selectedTime}
          setCalendarMonth={setCalendarMonth}
          setSelectedDate={setSelectedDate}
          setSelectedMethod={setSelectedMethod}
          setSelectedTime={setSelectedTime}
          timeSlots={timeSlots}
        />
      )}

      {step === 4 && (
        <StepFour
          budgetLimit={budgetLimit}
          budgetQuote={budgetQuote}
          error={error}
          form={form}
          methodLabels={methodLabels}
          notes={notes}
          selectedBike={selectedBike}
          selectedDate={selectedDate}
          selectedMethod={selectedMethod}
          selectedTemplate={selectedTemplate}
          selectedTime={selectedTime}
          setBudgetLimit={setBudgetLimit}
          setBudgetQuote={setBudgetQuote}
          setNotes={setNotes}
          showBudget={showBudget}
        />
      )}

      <div className="sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)] z-20 mt-2">
        <Card className="rounded-[28px] bg-white/96 p-3 shadow-[0_24px_54px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          {step === 4 ? (
            <Button variant="primary" fullWidth loading={submitting} onClick={handleSubmit}>
              {submitting ? 'Sender booking...' : 'Send booking'}
            </Button>
          ) : (
            <Button variant="primary" fullWidth disabled={!canContinue()} onClick={handleContinue}>
              Næste trin
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

function StepTwo({
  config,
  groupedTemplates,
  ungroupedTemplates,
  selectedTemplateId,
  setSelectedTemplateId,
  syncError,
}: {
  config: BookingForm['config'];
  groupedTemplates: Array<{
    group: { id: number; name: string; label?: string };
    items: BikedeskServiceCatalog['templates'];
  }>;
  ungroupedTemplates: BikedeskServiceCatalog['templates'];
  selectedTemplateId: number | null;
  setSelectedTemplateId: (value: number) => void;
  syncError: string | null;
}) {
  if (syncError && groupedTemplates.length === 0 && ungroupedTemplates.length === 0) {
    return (
      <Card className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Kunne ikke hente services. Prøv at genindlæse siden.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {config.service_message && (
        <Card className="rounded-[24px] bg-blue-50/80 p-4 text-sm text-blue-700">
          {config.service_message}
        </Card>
      )}

      {groupedTemplates.map(({ group, items }) => (
        <section key={group.id} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {group.name || group.label}
          </p>
          <div className="space-y-3">
            {items.map((template) => (
              <TemplateCard
                key={template.id}
                config={config}
                selected={selectedTemplateId === template.id}
                template={template}
                onSelect={() => setSelectedTemplateId(template.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {ungroupedTemplates.map((template) => (
        <TemplateCard
          key={template.id}
          config={config}
          selected={selectedTemplateId === template.id}
          template={template}
          onSelect={() => setSelectedTemplateId(template.id)}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  config,
  onSelect,
  selected,
  template,
}: {
  config: BookingForm['config'];
  onSelect: () => void;
  selected: boolean;
  template: BikedeskServiceCatalog['templates'][number];
}) {
  const price = config.template_price_overrides?.[template.id] ?? getTemplatePrice(template);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full rounded-[24px] border px-4 py-4 text-left transition-colors',
        selected
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_44px_-28px_rgba(15,23,42,0.95)]'
          : 'border-white/80 bg-white/92 text-slate-900',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold">{template.label}</p>
          {template.note && (
            <p className={['mt-1 text-sm leading-6', selected ? 'text-white/70' : 'text-slate-500'].join(' ')}>
              {template.note}
            </p>
          )}
        </div>
        {!config.hide_prices && price > 0 && (
          <span
            className={[
              'shrink-0 rounded-full px-3 py-1 text-sm font-semibold',
              selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700',
            ].join(' ')}
          >
            {price.toLocaleString('da-DK')} kr.
          </span>
        )}
      </div>
    </button>
  );
}

function StepThree({
  calendarMonth,
  calendarSettings,
  daysInMonth,
  enabledMethods,
  isBlocked,
  loadingAvailability,
  methodLabels,
  methodServiceTotals,
  selectedDate,
  selectedMethod,
  selectedTime,
  setCalendarMonth,
  setSelectedDate,
  setSelectedMethod,
  setSelectedTime,
  timeSlots,
}: {
  calendarMonth: Date;
  calendarSettings: BookingForm['config']['calendar_settings'];
  daysInMonth: Array<string | null>;
  enabledMethods: BookingMethod[];
  isBlocked: (dateString: string) => boolean;
  loadingAvailability: boolean;
  methodLabels: MethodLabels;
  methodServiceTotals: BookingMethodServiceTotals;
  selectedDate: string | null;
  selectedMethod: BookingMethod | null;
  selectedTime: string | null;
  setCalendarMonth: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedMethod: React.Dispatch<React.SetStateAction<BookingMethod | null>>;
  setSelectedTime: React.Dispatch<React.SetStateAction<string | null>>;
  timeSlots: string[];
}) {
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${enabledMethods.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {enabledMethods.map((method) => {
          const { Icon, description } = METHOD_META[method];
          const total = methodServiceTotals[getMethodKey(method)] ?? 0;
          const selected = selectedMethod === method;

          return (
            <button
              key={method}
              type="button"
              onClick={() => {
                setSelectedMethod(method);
                setSelectedDate(null);
                setSelectedTime(null);
              }}
              className={[
                'rounded-[24px] border px-4 py-4 text-left transition-colors',
                selected
                  ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_44px_-28px_rgba(15,23,42,0.95)]'
                  : 'border-white/80 bg-white/92 text-slate-900',
              ].join(' ')}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div
                  className={[
                    'flex h-11 w-11 items-center justify-center rounded-full',
                    selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {total > 0 && (
                  <span
                    className={[
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
                    ].join(' ')}
                  >
                    {total.toLocaleString('da-DK')} kr.
                  </span>
                )}
              </div>
              <p className="font-semibold">{getMethodLabel(method, methodLabels)}</p>
              <p className={['mt-1 text-sm leading-6', selected ? 'text-white/70' : 'text-slate-500'].join(' ')}>
                {description}
              </p>
            </button>
          );
        })}
      </div>

      {selectedMethod && (
        <Card className="space-y-4 rounded-[28px] p-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                )
              }
              className="rounded-2xl p-2 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-slate-700">
              {calendarMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                )
              }
              className="rounded-2xl p-2 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lo', 'So'].map((label) => (
              <div key={label} className="py-1 text-center text-xs font-medium text-slate-400">
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
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    setSelectedDate(day);
                    if (!timeSlots.length) {
                      setSelectedTime(null);
                    }
                  }}
                  className={[
                    'aspect-square rounded-2xl text-sm font-medium transition-colors',
                    blocked
                      ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                      : selected
                        ? 'bg-slate-900 text-white shadow-[0_16px_34px_-22px_rgba(15,23,42,0.95)]'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {new Date(day).getDate()}
                </button>
              );
            })}
          </div>

          {loadingAvailability && <p className="text-sm text-slate-500">Henter kapacitet...</p>}

          {timeSlots.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock3 className="h-4 w-4" />
                Vælg tidspunkt
              </div>
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={[
                      'rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors',
                      selectedTime === slot
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700',
                    ].join(' ')}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!calendarSettings && (
            <p className="text-sm text-slate-500">Kalenderen er ikke sat op endnu.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function StepFour({
  budgetLimit,
  budgetQuote,
  error,
  form,
  methodLabels,
  notes,
  selectedBike,
  selectedDate,
  selectedMethod,
  selectedTemplate,
  selectedTime,
  setBudgetLimit,
  setBudgetQuote,
  setNotes,
  showBudget,
}: {
  budgetLimit: number;
  budgetQuote: boolean;
  error: string | null;
  form: BookingForm;
  methodLabels: MethodLabels;
  notes: string;
  selectedBike: Bike | null;
  selectedDate: string | null;
  selectedMethod: BookingMethod | null;
  selectedTemplate: BikedeskServiceCatalog['templates'][number] | null;
  selectedTime: string | null;
  setBudgetLimit: React.Dispatch<React.SetStateAction<number>>;
  setBudgetQuote: React.Dispatch<React.SetStateAction<boolean>>;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  showBudget: boolean;
}) {
  return (
    <div className="space-y-4">
      {form.config.booking_message && (
        <Card className="rounded-[24px] bg-blue-50/80 p-4 text-sm text-blue-700">
          {form.config.booking_message}
        </Card>
      )}

      {error && (
        <Card className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </Card>
      )}

      <Card className="space-y-4 rounded-[28px] p-5">
        <SummaryRow
          icon={<BikeIcon className="h-4 w-4 text-slate-400" />}
          label="Cykel"
          value={[selectedBike?.brand, selectedBike?.model].filter(Boolean).join(' ') || 'Ukendt cykel'}
        />
        <SummaryRow
          icon={<Wrench className="h-4 w-4 text-slate-400" />}
          label="Service"
          value={selectedTemplate?.label ?? 'Ikke valgt'}
        />
        <SummaryRow
          icon={<CalendarDays className="h-4 w-4 text-slate-400" />}
          label="Dato"
          value={
            selectedDate
              ? `${formatDateToDanish(selectedDate)}${selectedTime ? ` kl. ${selectedTime}` : ''}`
              : 'Ikke valgt'
          }
        />
        <SummaryRow
          icon={<Clock3 className="h-4 w-4 text-slate-400" />}
          label="Metode"
          value={selectedMethod ? getMethodLabel(selectedMethod, methodLabels) : 'Ikke valgt'}
        />
      </Card>

      {showBudget && (
        <Card className="space-y-4 rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">Budgetgrænse</p>
              <p className="text-sm leading-6 text-slate-500">
                Vi kontakter dig, hvis arbejdet overstiger beløbet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBudgetQuote((value) => !value)}
              className={[
                'rounded-full px-3 py-1 text-sm font-semibold',
                budgetQuote ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
              ].join(' ')}
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
                className="flex-1 accent-slate-900"
              />
              <span className="w-20 text-right text-sm font-semibold text-slate-800">
                {budgetLimit} kr.
              </span>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3 rounded-[28px] p-5">
        <label className="text-sm font-semibold text-slate-700" htmlFor="booking-notes">
          Bemærkninger
        </label>
        <textarea
          id="booking-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Fx gear springer, bremser knirker eller andre detaljer"
          className="w-full resize-none rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {selectedMethod === 'pickup' && (
          <p className="text-sm text-amber-700">
            Pickup-bookinger bliver først bekræftet, når betalingen er registreret.
          </p>
        )}
      </Card>
    </div>
  );
}
