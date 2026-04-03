import { createServiceClient } from '@/lib/supabase/server';
import type {
  BikedeskServiceCacheSnapshot,
  BikedeskServiceCatalog,
  BikedeskTicketTemplate,
  BikedeskTicketTemplateGroup,
  BookingForm,
  BookingMethodServiceTotals,
  BookingSettings,
} from '@/types';
import {
  getTicketTemplateGroups,
  getTicketTemplateMaterials,
  getTicketTemplates,
} from './bikedesk';

export const BIKEDESK_SERVICE_CACHE_KEY = 'bikedesk_service_cache';

const EMPTY_METHOD_SERVICE_TOTALS: BookingMethodServiceTotals = {
  workshop: 0,
  pickup: 0,
  onsite: 0,
};

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sortGroups(groups: BikedeskTicketTemplateGroup[]): BikedeskTicketTemplateGroup[] {
  return [...groups].sort((left, right) => {
    const positionDiff =
      (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
    if (positionDiff !== 0) return positionDiff;
    return (left.name || left.label || '').localeCompare(right.name || right.label || '', 'da-DK');
  });
}

function sortTemplates(templates: BikedeskTicketTemplate[]): BikedeskTicketTemplate[] {
  return [...templates].sort((left, right) => {
    const positionDiff =
      (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
    if (positionDiff !== 0) return positionDiff;
    return left.label.localeCompare(right.label, 'da-DK');
  });
}

function normalizeGroup(value: unknown): BikedeskTicketTemplateGroup | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) return null;

  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    label: typeof raw.label === 'string' ? raw.label : undefined,
    position: typeof raw.position === 'number' ? raw.position : Number.MAX_SAFE_INTEGER,
    tickettype: typeof raw.tickettype === 'string' ? raw.tickettype : '',
    visible: raw.visible !== false,
  };
}

function normalizeTemplate(value: unknown): BikedeskTicketTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) return null;
  if (typeof raw.groupid !== 'number' || !Number.isFinite(raw.groupid)) return null;

  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : '',
    groupid: raw.groupid,
    position: typeof raw.position === 'number' ? raw.position : Number.MAX_SAFE_INTEGER,
    price: typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : undefined,
    raw_price: toNumberOrNull(raw.raw_price),
    computed_price: toNumberOrNull(raw.computed_price),
    note: typeof raw.note === 'string' ? raw.note : '',
    duration: typeof raw.duration === 'number' ? raw.duration : 0,
  };
}

function hasSnapshotData(snapshot: BikedeskServiceCacheSnapshot): boolean {
  return snapshot.groups.length > 0 || snapshot.templates.length > 0;
}

function createEmptySnapshot(): BikedeskServiceCacheSnapshot {
  return {
    synced_at: null,
    sync_error: null,
    last_sync_cph_date: null,
    groups: [],
    templates: [],
  };
}

async function computeTemplatePrice(template: BikedeskTicketTemplate): Promise<number | null> {
  try {
    const materials = await getTicketTemplateMaterials(template.id);
    return materials.reduce(
      (sum, material) =>
        sum + (material.derivedprice ?? material.price ?? 0) * (material.amount ?? 1),
      0
    );
  } catch {
    return template.price ?? null;
  }
}

async function hydrateTemplatesWithComputedPrices(
  templates: BikedeskTicketTemplate[]
): Promise<BikedeskTicketTemplate[]> {
  const enriched = [...templates];

  for (let index = 0; index < templates.length; index += 8) {
    const chunk = templates.slice(index, index + 8);
    const results = await Promise.allSettled(
      chunk.map(async (template) => ({
        id: template.id,
        computedPrice: await computeTemplatePrice(template),
      }))
    );

    results.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const targetIndex = enriched.findIndex((template) => template.id === result.value.id);
      if (targetIndex === -1) return;
      const target = enriched[targetIndex];
      enriched[targetIndex] = {
        ...target,
        raw_price: target.price ?? null,
        computed_price: result.value.computedPrice,
      };
    });
  }

  return enriched;
}

export function normalizeBikedeskServiceCacheSnapshot(value: unknown): BikedeskServiceCacheSnapshot {
  if (!value || typeof value !== 'object') return createEmptySnapshot();

  const raw = value as Record<string, unknown>;
  const groups = Array.isArray(raw.groups)
    ? raw.groups
        .map(normalizeGroup)
        .filter((entry): entry is BikedeskTicketTemplateGroup => Boolean(entry))
    : [];
  const templates = Array.isArray(raw.templates)
    ? raw.templates
        .map(normalizeTemplate)
        .filter((entry): entry is BikedeskTicketTemplate => Boolean(entry))
    : [];

  return {
    synced_at: typeof raw.synced_at === 'string' ? raw.synced_at : null,
    sync_error: typeof raw.sync_error === 'string' && raw.sync_error.trim() ? raw.sync_error : null,
    last_sync_cph_date:
      typeof raw.last_sync_cph_date === 'string' && raw.last_sync_cph_date.trim()
        ? raw.last_sync_cph_date
        : null,
    groups: sortGroups(groups),
    templates: sortTemplates(templates),
  };
}

export function getBikedeskServiceTemplatePrice(
  template: Pick<BikedeskTicketTemplate, 'computed_price' | 'price' | 'raw_price'>
): number {
  return template.computed_price ?? template.price ?? template.raw_price ?? 0;
}

export async function buildBikedeskServiceCacheSnapshot(): Promise<BikedeskServiceCacheSnapshot> {
  const [groups, templates] = await Promise.all([getTicketTemplateGroups(), getTicketTemplates()]);
  return {
    synced_at: new Date().toISOString(),
    sync_error: null,
    last_sync_cph_date: new Date().toISOString().slice(0, 10),
    groups: sortGroups(groups),
    templates: await hydrateTemplatesWithComputedPrices(sortTemplates(templates)),
  };
}

export async function resolveBikedeskServiceCatalog(
  snapshotValue: unknown
): Promise<BikedeskServiceCatalog> {
  const snapshot = normalizeBikedeskServiceCacheSnapshot(snapshotValue);
  if (hasSnapshotData(snapshot) && !snapshot.sync_error) {
    return {
      groups: snapshot.groups,
      templates: snapshot.templates,
      source: 'cache',
      synced_at: snapshot.synced_at,
      is_stale: false,
      sync_error: null,
    };
  }

  try {
    const liveSnapshot = await buildBikedeskServiceCacheSnapshot();
    return {
      groups: liveSnapshot.groups,
      templates: liveSnapshot.templates,
      source: 'live',
      synced_at: liveSnapshot.synced_at,
      is_stale: false,
      sync_error: snapshot.sync_error,
    };
  } catch (error) {
    if (hasSnapshotData(snapshot)) {
      return {
        groups: snapshot.groups,
        templates: snapshot.templates,
        source: 'stale-cache',
        synced_at: snapshot.synced_at,
        is_stale: true,
        sync_error:
          snapshot.sync_error ??
          (error instanceof Error ? error.message : 'Kunne ikke hente live BikeDesk services'),
      };
    }

    return {
      groups: [],
      templates: [],
      source: 'empty',
      synced_at: null,
      is_stale: true,
      sync_error:
        error instanceof Error ? error.message : 'Ingen servicecache tilgaengelig',
    };
  }
}

export function buildBookingServiceCatalog(
  catalog: BikedeskServiceCatalog,
  form: BookingForm,
  globalSettings: BookingSettings
): BikedeskServiceCatalog {
  const { config } = form;
  const filteredTemplates =
    config.allowed_template_ids.length > 0
      ? catalog.templates.filter((template) => config.allowed_template_ids.includes(template.id))
      : catalog.templates.filter((template) => {
          if (config.ignore_global_rules) return true;
          if (
            globalSettings.visible_group_ids.length > 0 &&
            !globalSettings.visible_group_ids.includes(template.groupid)
          ) {
            return false;
          }
          if (
            globalSettings.visible_template_ids.length > 0 &&
            !globalSettings.visible_template_ids.includes(template.id)
          ) {
            return false;
          }
          return true;
        });

  const visibleGroupIds = new Set(filteredTemplates.map((template) => template.groupid));

  return {
    ...catalog,
    groups: catalog.groups.filter((group) => visibleGroupIds.has(group.id)),
    templates: filteredTemplates,
  };
}

export function getMethodServiceTotalsFromCatalog(
  form: BookingForm,
  globalSettings: BookingSettings,
  templates: BikedeskTicketTemplate[]
): BookingMethodServiceTotals {
  if (form.config.ignore_global_rules) return EMPTY_METHOD_SERVICE_TOTALS;

  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const excludedIds = new Set(form.config.excluded_global_service_ids ?? []);

  const totals = {
    workshop: (globalSettings.workshop_global_service_ids ?? []).filter((id) => !excludedIds.has(id)),
    pickup: (globalSettings.pickup_global_service_ids ?? []).filter((id) => !excludedIds.has(id)),
    onsite: (globalSettings.onsite_global_service_ids ?? []).filter((id) => !excludedIds.has(id)),
  };

  return {
    workshop: totals.workshop.reduce(
      (sum, id) => sum + getBikedeskServiceTemplatePrice(templateMap.get(id) ?? { price: 0 }),
      0
    ),
    pickup: totals.pickup.reduce(
      (sum, id) => sum + getBikedeskServiceTemplatePrice(templateMap.get(id) ?? { price: 0 }),
      0
    ),
    onsite: totals.onsite.reduce(
      (sum, id) => sum + getBikedeskServiceTemplatePrice(templateMap.get(id) ?? { price: 0 }),
      0
    ),
  };
}

export async function loadServiceCatalogFromSettings(): Promise<BikedeskServiceCatalog> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', BIKEDESK_SERVICE_CACHE_KEY)
    .maybeSingle();

  return resolveBikedeskServiceCatalog(data?.value ?? null);
}
