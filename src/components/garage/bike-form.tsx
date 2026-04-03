'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BIKES_API_KEY, BOOKING_CONTEXT_API_KEY, HOME_API_KEY, bikeApiKey } from '@/lib/api-keys';
import type { Bike, VehicleTypeConfig } from '@/types';

interface BikeFormProps {
  bike?: Bike | null;
  vehicleTypes: VehicleTypeConfig[];
  submitUrl: string;
  method: 'POST' | 'PUT';
  title: string;
  description: string;
}

export function BikeForm({
  bike,
  vehicleTypes,
  submitUrl,
  method,
  title,
  description,
}: BikeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    brand: bike?.brand ?? '',
    model: bike?.model ?? '',
    year: bike?.year ? String(bike.year) : '',
    frame_number: bike?.frame_number ?? '',
    color: bike?.color ?? '',
    type: bike?.type ?? '',
    notes: bike?.notes ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(submitUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: form.brand,
          model: form.model,
          year: form.year ? Number(form.year) : null,
          frame_number: form.frame_number || null,
          color: form.color || null,
          type: form.type || null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Kunne ikke gemme cyklen');
      }

      await Promise.all([
        mutate(BIKES_API_KEY),
        mutate(HOME_API_KEY),
        mutate(BOOKING_CONTEXT_API_KEY),
        data.bike?.id ? mutate(bikeApiKey(data.bike.id)) : Promise.resolve(undefined),
      ]);
      router.push(`/garage/${data.bike.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ukendt fejl');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6 page-bottom-padding">
      <Card className="flex flex-col gap-4 rounded-[28px] p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Mærke"
          value={form.brand}
          onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
          required
        />

        <Input
          label="Model"
          value={form.model}
          onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Aargang"
            inputMode="numeric"
            value={form.year}
            onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bike-type" className="text-sm font-medium text-slate-600">
              Type
            </label>
            <select
              id="bike-type"
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Vælg type</option>
              {vehicleTypes.map((vehicleType) => (
                <option key={vehicleType.id} value={vehicleType.id}>
                  {vehicleType.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Stelnummer"
          value={form.frame_number}
          onChange={(event) =>
            setForm((current) => ({ ...current, frame_number: event.target.value }))
          }
        />

        <Input
          label="Farve"
          value={form.color}
          onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bike-notes" className="text-sm font-medium text-slate-600">
            Noter
          </label>
          <textarea
            id="bike-notes"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            className="w-full resize-none rounded-[24px] border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Fx dækstørrelsen, særlige behov eller ekstra detaljer"
          />
        </div>
      </Card>

      <Button type="submit" variant="primary" fullWidth loading={submitting} className="bg-slate-900">
        {bike ? 'Gem ændringer' : 'Opret cykel'}
      </Button>
    </form>
  );
}
