import { createServiceClient } from '@/lib/supabase/server';
import {
  buildBookingServiceCatalog,
  getMethodServiceTotalsFromCatalog,
  loadServiceCatalogFromSettings,
} from '@/lib/bikedesk-service-cache';
import {
  buildEffectiveFormConfig,
  DEFAULT_BOOKING_SETTINGS,
  normalizeBookingFormConfig,
  normalizeBookingSettings,
  normalizeVehicleTypes,
} from '@/lib/booking/settings';
import { bookingDebug } from '@/lib/booking-debug';
import type {
  BookingForm,
  BookingMethodServiceTotals,
  BookingSettings,
  BikedeskServiceCatalog,
  VehicleTypeConfig,
} from '@/types';

export const CYKELPLUS_BOOKING_FORM_SLUG = 'cykelplus-app';
const BOOKING_FORM_SLUG_FALLBACKS = ['booking', 'standard'] as const;

export interface CykelPlusBookingContext {
  form: BookingForm;
  globalSettings: BookingSettings;
  serviceCatalog: BikedeskServiceCatalog;
  vehicleTypes: VehicleTypeConfig[];
  methodServiceTotals: BookingMethodServiceTotals;
}

interface BookingContextOptions {
  traceId?: string;
}

function normalizeFormRow(row: { id: string; title: string; slug: string | null; config: unknown }): BookingForm {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    config: normalizeBookingFormConfig(row.config),
  };
}

async function findBookingFormRow(
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<{ id: string; title: string; slug: string | null; config: unknown } | null> {
  const preferredSlugs = [CYKELPLUS_BOOKING_FORM_SLUG, ...BOOKING_FORM_SLUG_FALLBACKS];
  const { data: matchingRows } = await supabase
    .from('booking_forms')
    .select('id,title,slug,config')
    .in('slug', preferredSlugs);

  if (matchingRows && matchingRows.length > 0) {
    return (
      [...matchingRows].sort(
        (left, right) =>
          preferredSlugs.indexOf(left.slug as (typeof preferredSlugs)[number]) -
          preferredSlugs.indexOf(right.slug as (typeof preferredSlugs)[number])
      )[0] ?? null
    );
  }

  const { data: fallbackRow } = await supabase
    .from('booking_forms')
    .select('id,title,slug,config')
    .limit(1)
    .maybeSingle();

  return fallbackRow ?? null;
}

export async function getConfiguredVehicleTypes(): Promise<VehicleTypeConfig[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'vehicle_types')
    .maybeSingle();

  return normalizeVehicleTypes(data?.value ?? []);
}

export async function getCykelPlusBookingContext(
  options: BookingContextOptions = {}
): Promise<CykelPlusBookingContext> {
  const supabase = await createServiceClient();
  const [{ data: formRow }, { data: bookingSettingsRow }, { data: vehicleTypesRow }] =
    await Promise.all([
      findBookingFormRow(supabase).then((row) => ({ data: row })),
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'booking_settings')
        .maybeSingle(),
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'vehicle_types')
        .maybeSingle(),
    ]);

  if (!formRow) {
    throw new Error('Ingen bookingformular blev fundet');
  }

  if (options.traceId) {
    bookingDebug(options.traceId, 'booking_context.form_resolved', {
      formId: formRow.id,
      formSlug: formRow.slug,
      fallbackUsed: formRow.slug !== CYKELPLUS_BOOKING_FORM_SLUG,
      hasBookingSettings: Boolean(bookingSettingsRow?.value),
      hasVehicleTypes: Boolean(vehicleTypesRow?.value),
    });
  }

  const globalSettings = normalizeBookingSettings(bookingSettingsRow?.value ?? DEFAULT_BOOKING_SETTINGS);
  const form = normalizeFormRow(formRow);
  const effectiveForm: BookingForm = {
    ...form,
    config: buildEffectiveFormConfig(form.config, globalSettings),
  };
  const vehicleTypes = normalizeVehicleTypes(vehicleTypesRow?.value ?? []);
  const baseCatalog = await loadServiceCatalogFromSettings();
  const serviceCatalog = buildBookingServiceCatalog(baseCatalog, effectiveForm, globalSettings);
  const methodServiceTotals = getMethodServiceTotalsFromCatalog(
    effectiveForm,
    globalSettings,
    serviceCatalog.templates
  );

  if (options.traceId) {
    bookingDebug(options.traceId, 'booking_context.catalog_ready', {
      formId: effectiveForm.id,
      formSlug: effectiveForm.slug,
      vehicleTypeCount: vehicleTypes.length,
      groupCount: serviceCatalog.groups.length,
      templateCount: serviceCatalog.templates.length,
      source: serviceCatalog.source,
      isStale: serviceCatalog.is_stale,
      syncError: serviceCatalog.sync_error,
    });
  }

  return {
    form: effectiveForm,
    globalSettings,
    serviceCatalog,
    vehicleTypes,
    methodServiceTotals,
  };
}
