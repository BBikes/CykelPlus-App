import type {
  BookingFormConfig,
  BookingMethod,
  BookingSettings,
  CalendarSettings,
  MethodLabels,
  VehicleTypeConfig,
  WeekdayIndex,
  WeekdayTagMap,
} from '@/types';

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  buffer_days: 1,
  block_holidays: true,
  block_weekdays: [0, 6],
  blocked_dates: [],
  max_bookings_workshop: 5,
  max_bookings_pickup: 5,
  max_bookings_onsite: 5,
  availability_mode: 'blacklist',
  whitelist_dates: [],
  closed_holiday_names: [],
  workshop_time_slot_enabled: true,
  workshop_time_slot_duration: 60,
  workshop_opening_start: 8,
  workshop_opening_end: 17,
  pickup_time_slot_enabled: false,
  pickup_time_slot_duration: 60,
  pickup_opening_start: 8,
  pickup_opening_end: 17,
  onsite_time_slot_enabled: false,
  onsite_time_slot_duration: 60,
  onsite_opening_start: 8,
  onsite_opening_end: 17,
};

export const DEFAULT_METHOD_LABELS: MethodLabels = {
  workshop: 'Indlevering i butik',
  pickup: 'Hent og Bring',
  onsite: 'Paa arbejdsplads',
};

export const DEFAULT_WEEKDAY_TAGS: WeekdayTagMap = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  visible_group_ids: [],
  visible_template_ids: [],
  template_vehicle_types: {},
  global_service_ids: [],
  workshop_global_service_ids: [],
  pickup_global_service_ids: [],
  onsite_global_service_ids: [],
  calendar_settings: DEFAULT_CALENDAR_SETTINGS,
  pickup_template_id: null,
  workshop_template_id: null,
  global_redirect_url: null,
  terms_link: '',
  workshop_tag_ids: [],
  pickup_tag_ids: [],
  onsite_tag_ids: [],
  workshop_weekday_tag_ids: { ...DEFAULT_WEEKDAY_TAGS },
  pickup_weekday_tag_ids: { ...DEFAULT_WEEKDAY_TAGS },
  onsite_weekday_tag_ids: { ...DEFAULT_WEEKDAY_TAGS },
  method_labels: DEFAULT_METHOD_LABELS,
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function toUniqueNumberArray(value: unknown): number[] {
  return [...new Set(toNumberArray(value))];
}

function normalizeTemplateVehicleTypes(value: unknown): Record<number, string[]> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([templateId, types]) => [
      Number(templateId),
      toStringArray(types),
    ])
  );
}

function normalizeWeekdayTagMap(value: unknown): WeekdayTagMap {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    0: toNumberArray(raw[0] ?? raw.sunday),
    1: toNumberArray(raw[1] ?? raw.monday),
    2: toNumberArray(raw[2] ?? raw.tuesday),
    3: toNumberArray(raw[3] ?? raw.wednesday),
    4: toNumberArray(raw[4] ?? raw.thursday),
    5: toNumberArray(raw[5] ?? raw.friday),
    6: toNumberArray(raw[6] ?? raw.saturday),
  };
}

function normalizeMethodLabels(value: unknown): MethodLabels {
  if (!value || typeof value !== 'object') return { ...DEFAULT_METHOD_LABELS };
  const raw = value as Record<string, unknown>;
  return {
    workshop:
      typeof raw.workshop === 'string' && raw.workshop.trim()
        ? raw.workshop
        : DEFAULT_METHOD_LABELS.workshop,
    pickup:
      typeof raw.pickup === 'string' && raw.pickup.trim()
        ? raw.pickup
        : DEFAULT_METHOD_LABELS.pickup,
    onsite:
      typeof raw.onsite === 'string' && raw.onsite.trim()
        ? raw.onsite
        : DEFAULT_METHOD_LABELS.onsite,
  };
}

export function normalizeBookingSettings(rawValue: unknown): BookingSettings {
  const raw = rawValue && typeof rawValue === 'object' ? (rawValue as Record<string, unknown>) : {};
  const calendar =
    raw.calendar_settings && typeof raw.calendar_settings === 'object'
      ? (raw.calendar_settings as Record<string, unknown>)
      : {};

  return {
    visible_group_ids: toNumberArray(raw.visible_group_ids),
    visible_template_ids: toNumberArray(raw.visible_template_ids),
    template_vehicle_types: normalizeTemplateVehicleTypes(raw.template_vehicle_types),
    global_service_ids: toUniqueNumberArray(raw.global_service_ids),
    workshop_global_service_ids: toUniqueNumberArray(raw.workshop_global_service_ids),
    pickup_global_service_ids: toUniqueNumberArray(raw.pickup_global_service_ids),
    onsite_global_service_ids: toUniqueNumberArray(raw.onsite_global_service_ids),
    calendar_settings: {
      ...DEFAULT_CALENDAR_SETTINGS,
      buffer_days: toNumber(calendar.buffer_days, DEFAULT_CALENDAR_SETTINGS.buffer_days),
      block_holidays:
        typeof calendar.block_holidays === 'boolean'
          ? calendar.block_holidays
          : DEFAULT_CALENDAR_SETTINGS.block_holidays,
      block_weekdays: toNumberArray(calendar.block_weekdays),
      blocked_dates: toStringArray(calendar.blocked_dates),
      max_bookings_workshop: toNumber(
        calendar.max_bookings_workshop,
        DEFAULT_CALENDAR_SETTINGS.max_bookings_workshop
      ),
      max_bookings_pickup: toNumber(
        calendar.max_bookings_pickup,
        DEFAULT_CALENDAR_SETTINGS.max_bookings_pickup
      ),
      max_bookings_onsite: toNumber(
        calendar.max_bookings_onsite,
        DEFAULT_CALENDAR_SETTINGS.max_bookings_onsite
      ),
      availability_mode:
        calendar.availability_mode === 'whitelist' ? 'whitelist' : 'blacklist',
      whitelist_dates: toStringArray(calendar.whitelist_dates),
      closed_holiday_names: toStringArray(calendar.closed_holiday_names),
      workshop_time_slot_enabled:
        typeof calendar.workshop_time_slot_enabled === 'boolean'
          ? calendar.workshop_time_slot_enabled
          : DEFAULT_CALENDAR_SETTINGS.workshop_time_slot_enabled,
      workshop_time_slot_duration: toNumber(
        calendar.workshop_time_slot_duration,
        DEFAULT_CALENDAR_SETTINGS.workshop_time_slot_duration
      ),
      workshop_opening_start: toNumber(
        calendar.workshop_opening_start,
        DEFAULT_CALENDAR_SETTINGS.workshop_opening_start
      ),
      workshop_opening_end: toNumber(
        calendar.workshop_opening_end,
        DEFAULT_CALENDAR_SETTINGS.workshop_opening_end
      ),
      pickup_time_slot_enabled:
        typeof calendar.pickup_time_slot_enabled === 'boolean'
          ? calendar.pickup_time_slot_enabled
          : DEFAULT_CALENDAR_SETTINGS.pickup_time_slot_enabled,
      pickup_time_slot_duration: toNumber(
        calendar.pickup_time_slot_duration,
        DEFAULT_CALENDAR_SETTINGS.pickup_time_slot_duration
      ),
      pickup_opening_start: toNumber(
        calendar.pickup_opening_start,
        DEFAULT_CALENDAR_SETTINGS.pickup_opening_start
      ),
      pickup_opening_end: toNumber(
        calendar.pickup_opening_end,
        DEFAULT_CALENDAR_SETTINGS.pickup_opening_end
      ),
      onsite_time_slot_enabled:
        typeof calendar.onsite_time_slot_enabled === 'boolean'
          ? calendar.onsite_time_slot_enabled
          : DEFAULT_CALENDAR_SETTINGS.onsite_time_slot_enabled,
      onsite_time_slot_duration: toNumber(
        calendar.onsite_time_slot_duration,
        DEFAULT_CALENDAR_SETTINGS.onsite_time_slot_duration
      ),
      onsite_opening_start: toNumber(
        calendar.onsite_opening_start,
        DEFAULT_CALENDAR_SETTINGS.onsite_opening_start
      ),
      onsite_opening_end: toNumber(
        calendar.onsite_opening_end,
        DEFAULT_CALENDAR_SETTINGS.onsite_opening_end
      ),
    },
    pickup_template_id: typeof raw.pickup_template_id === 'number' ? raw.pickup_template_id : null,
    workshop_template_id:
      typeof raw.workshop_template_id === 'number' ? raw.workshop_template_id : null,
    global_redirect_url:
      typeof raw.global_redirect_url === 'string' ? raw.global_redirect_url : null,
    terms_link: typeof raw.terms_link === 'string' ? raw.terms_link : '',
    workshop_tag_ids: toUniqueNumberArray(raw.workshop_tag_ids),
    pickup_tag_ids: toUniqueNumberArray(raw.pickup_tag_ids),
    onsite_tag_ids: toUniqueNumberArray(raw.onsite_tag_ids),
    workshop_weekday_tag_ids: normalizeWeekdayTagMap(raw.workshop_weekday_tag_ids),
    pickup_weekday_tag_ids: normalizeWeekdayTagMap(raw.pickup_weekday_tag_ids),
    onsite_weekday_tag_ids: normalizeWeekdayTagMap(raw.onsite_weekday_tag_ids),
    method_labels: normalizeMethodLabels(raw.method_labels),
  };
}

export function normalizeVehicleTypes(rawValue: unknown): VehicleTypeConfig[] {
  if (!Array.isArray(rawValue)) return [];

  return rawValue
    .filter((item): item is Partial<VehicleTypeConfig> => !!item && typeof item === 'object')
    .map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `type-${index + 1}`,
      name: typeof item.name === 'string' ? item.name : `Type ${index + 1}`,
      icon_url: typeof item.icon_url === 'string' ? item.icon_url : '',
      active: typeof item.active === 'boolean' ? item.active : true,
      position: typeof item.position === 'number' ? item.position : index + 1,
    }))
    .sort((left, right) => left.position - right.position);
}

export function normalizeBookingFormConfig(rawValue: unknown): BookingFormConfig {
  const raw = rawValue && typeof rawValue === 'object' ? (rawValue as Record<string, unknown>) : {};

  return {
    enable_workshop:
      typeof raw.enable_workshop === 'boolean' ? raw.enable_workshop : true,
    enable_pickup:
      typeof raw.enable_pickup === 'boolean' ? raw.enable_pickup : false,
    enable_onsite:
      typeof raw.enable_onsite === 'boolean' ? raw.enable_onsite : false,
    enable_budget_module:
      typeof raw.enable_budget_module === 'boolean' ? raw.enable_budget_module : false,
    allowed_vehicle_types: toStringArray(raw.allowed_vehicle_types),
    allowed_template_ids: toUniqueNumberArray(raw.allowed_template_ids),
    excluded_global_service_ids: toUniqueNumberArray(raw.excluded_global_service_ids),
    calendar_settings:
      raw.calendar_settings === null
        ? null
        : raw.calendar_settings && typeof raw.calendar_settings === 'object'
          ? { ...DEFAULT_CALENDAR_SETTINGS, ...(raw.calendar_settings as Partial<CalendarSettings>) }
          : null,
    template_vehicle_types: normalizeTemplateVehicleTypes(raw.template_vehicle_types),
    workshop_tag_ids: toUniqueNumberArray(raw.workshop_tag_ids),
    pickup_tag_ids: toUniqueNumberArray(raw.pickup_tag_ids),
    onsite_tag_ids: toUniqueNumberArray(raw.onsite_tag_ids),
    ignore_global_rules:
      typeof raw.ignore_global_rules === 'boolean' ? raw.ignore_global_rules : false,
    auto_skip_vehicle_step:
      typeof raw.auto_skip_vehicle_step === 'boolean' ? raw.auto_skip_vehicle_step : false,
    force_hide_step1:
      typeof raw.force_hide_step1 === 'boolean' ? raw.force_hide_step1 : false,
    service_message: typeof raw.service_message === 'string' ? raw.service_message : null,
    booking_message: typeof raw.booking_message === 'string' ? raw.booking_message : null,
    redirect_url: typeof raw.redirect_url === 'string' ? raw.redirect_url : null,
    template_price_overrides:
      raw.template_price_overrides && typeof raw.template_price_overrides === 'object'
        ? Object.fromEntries(
            Object.entries(raw.template_price_overrides as Record<string, unknown>)
              .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
              .map(([templateId, value]) => [Number(templateId), value as number])
          )
        : {},
    hide_prices: typeof raw.hide_prices === 'boolean' ? raw.hide_prices : false,
    limit_strategy: raw.limit_strategy === 'custom' ? 'custom' : 'global',
    custom_max_workshop:
      typeof raw.custom_max_workshop === 'number' ? raw.custom_max_workshop : undefined,
    custom_max_pickup:
      typeof raw.custom_max_pickup === 'number' ? raw.custom_max_pickup : undefined,
    custom_max_onsite:
      typeof raw.custom_max_onsite === 'number' ? raw.custom_max_onsite : undefined,
    sms_template_id: typeof raw.sms_template_id === 'string' ? raw.sms_template_id : null,
    otp_allowed_embed_origins: toStringArray(raw.otp_allowed_embed_origins),
    method_labels:
      raw.method_labels === null || raw.method_labels === undefined
        ? null
        : normalizeMethodLabels(raw.method_labels),
  };
}

export function buildEffectiveFormConfig(
  rawConfig: BookingFormConfig,
  globalSettings: BookingSettings
): BookingFormConfig {
  const normalizedConfig = normalizeBookingFormConfig(rawConfig);
  const ignoreGlobalRules = Boolean(normalizedConfig.ignore_global_rules);
  const globalCalendarSettings = globalSettings.calendar_settings ?? DEFAULT_CALENDAR_SETTINGS;
  const baseCalendarSettings = normalizedConfig.calendar_settings ?? globalCalendarSettings;

  return {
    ...normalizedConfig,
    calendar_settings: {
      ...baseCalendarSettings,
      max_bookings_workshop:
        typeof normalizedConfig.custom_max_workshop === 'number'
          ? normalizedConfig.custom_max_workshop
          : globalCalendarSettings.max_bookings_workshop,
      max_bookings_pickup:
        typeof normalizedConfig.custom_max_pickup === 'number'
          ? normalizedConfig.custom_max_pickup
          : globalCalendarSettings.max_bookings_pickup,
      max_bookings_onsite:
        typeof normalizedConfig.custom_max_onsite === 'number'
          ? normalizedConfig.custom_max_onsite
          : globalCalendarSettings.max_bookings_onsite,
    },
    workshop_tag_ids:
      normalizedConfig.workshop_tag_ids.length > 0 || ignoreGlobalRules
        ? normalizedConfig.workshop_tag_ids
        : globalSettings.workshop_tag_ids,
    pickup_tag_ids:
      normalizedConfig.pickup_tag_ids.length > 0 || ignoreGlobalRules
        ? normalizedConfig.pickup_tag_ids
        : globalSettings.pickup_tag_ids,
    onsite_tag_ids:
      normalizedConfig.onsite_tag_ids.length > 0 || ignoreGlobalRules
        ? normalizedConfig.onsite_tag_ids
        : globalSettings.onsite_tag_ids,
    redirect_url:
      normalizedConfig.redirect_url ??
      (!ignoreGlobalRules ? globalSettings.global_redirect_url : null),
    method_labels: normalizedConfig.method_labels ?? globalSettings.method_labels,
  };
}

export function getWeekdayTagIds(
  weekdayTagMap: WeekdayTagMap,
  weekdayIndex: WeekdayIndex
): number[] {
  return weekdayTagMap[weekdayIndex] ?? [];
}

export function getMethodGlobalServiceIds(
  settings: BookingSettings,
  method: BookingMethod
): number[] {
  if (method === 'drop_off') return settings.workshop_global_service_ids ?? [];
  if (method === 'pickup') return settings.pickup_global_service_ids ?? [];
  return settings.onsite_global_service_ids ?? [];
}

export function getMethodCapacityOverride(
  config: Pick<
    BookingFormConfig,
    'custom_max_workshop' | 'custom_max_pickup' | 'custom_max_onsite'
  >,
  method: BookingMethod
): number | undefined {
  if (method === 'drop_off') return config.custom_max_workshop;
  if (method === 'pickup') return config.custom_max_pickup;
  return config.custom_max_onsite;
}

export function hasMethodSpecificCapacity(
  config: Pick<
    BookingFormConfig,
    'custom_max_workshop' | 'custom_max_pickup' | 'custom_max_onsite'
  >,
  method: BookingMethod
): boolean {
  return typeof getMethodCapacityOverride(config, method) === 'number';
}
