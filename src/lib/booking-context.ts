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
import type {
  BookingForm,
  BookingMethodServiceTotals,
  BookingSettings,
  BikedeskServiceCatalog,
  VehicleTypeConfig,
} from '@/types';

export const CYKELPLUS_BOOKING_FORM_SLUG = 'cykelplus-app';

export interface CykelPlusBookingContext {
  form: BookingForm;
  globalSettings: BookingSettings;
  serviceCatalog: BikedeskServiceCatalog;
  vehicleTypes: VehicleTypeConfig[];
  methodServiceTotals: BookingMethodServiceTotals;
}

function normalizeFormRow(row: { id: string; title: string; slug: string | null; config: unknown }): BookingForm {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    config: normalizeBookingFormConfig(row.config),
  };
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

export async function getCykelPlusBookingContext(): Promise<CykelPlusBookingContext> {
  const supabase = await createServiceClient();
  const [{ data: formRow }, { data: bookingSettingsRow }, { data: vehicleTypesRow }] =
    await Promise.all([
      supabase
        .from('booking_forms')
        .select('id,title,slug,config')
        .eq('slug', CYKELPLUS_BOOKING_FORM_SLUG)
        .maybeSingle(),
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
    throw new Error(`Booking form '${CYKELPLUS_BOOKING_FORM_SLUG}' blev ikke fundet`);
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

  return {
    form: effectiveForm,
    globalSettings,
    serviceCatalog,
    vehicleTypes,
    methodServiceTotals,
  };
}
