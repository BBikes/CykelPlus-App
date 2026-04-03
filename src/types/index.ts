export type BookingMethod = 'drop_off' | 'pickup' | 'onsite';
export type SharedBookingStatus = 'new' | 'ready' | 'done' | 'awaiting' | 'quote' | 'draft';
export type CustomerBookingStatus =
  | 'booking_created'
  | 'awaiting_payment'
  | 'booking_confirmed'
  | 'in_progress'
  | 'quote'
  | 'completed'
  | 'payment_expired'
  | 'cancelled';
export type AvailabilityMode = 'blacklist' | 'whitelist';
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type WeekdayTagMap = Record<WeekdayIndex, number[]>;

export interface AppUser {
  id: string;
  phone: string;
  bikedesk_customer_id: number | null;
  created_at: string;
  last_login_at: string | null;
  last_bikedesk_sync_at: string | null;
}

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  sms_reminders: boolean;
  updated_at: string | null;
}

export interface AppSession {
  user: AppUser;
  profile: UserProfile | null;
}

export interface SyncMeta {
  lastSyncedAt: string | null;
  syncRecommended: boolean;
  syncing: boolean;
}

export interface AppShellSession {
  session: AppSession;
  greetingName: string;
  initials: string;
}

export interface SessionPayload {
  session: AppSession;
  viewer: AppShellSession;
  sync: SyncMeta;
}

export interface Bike {
  id: string;
  user_id: string;
  bikedesk_article_id: number | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  frame_number: string | null;
  color: string | null;
  type: string | null;
  notes: string | null;
  created_at: string;
  primary_image_url?: string | null;
  tracker_active?: boolean;
  tracker_status?: TrackerAddon['status'] | null;
}

export interface BikeImage {
  id: string;
  bike_id: string;
  storage_path: string;
  is_primary: boolean;
  uploaded_at: string;
}

export interface BikeHistoryEntry {
  id: string;
  bike_id: string;
  entry_type: 'service' | 'repair';
  bikedesk_ticket_id: number | null;
  title: string;
  description: string | null;
  completed_at: string | null;
  workshop: string | null;
  cached_at: string;
}

export interface BookingCustomerData {
  name: string;
  phone: string;
  email: string;
  address?: string;
  zip_code?: string;
  city?: string;
  bikedesk_id?: number;
}

export interface BookingBikeData {
  brand: string;
  model: string;
  type?: string;
  frame_number?: string;
  bikedesk_article_id?: number;
  is_new?: boolean;
}

export interface BookingPaymentStatusRecord {
  id: string;
  booking_id: string;
  payment_ref: string | null;
  status: 'pending' | 'paid' | 'expired' | 'refunded' | null;
  amount_dkk: number | null;
  paid_at: string | null;
  expires_at: string | null;
  raw_webhook: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface Booking {
  id: string;
  form_id: string | null;
  user_id: string | null;
  bike_id: string | null;
  service_ids: number[];
  addon_ids: number[];
  method: BookingMethod;
  date: string;
  time: string | null;
  status: SharedBookingStatus;
  notes: string | null;
  budget_limit: number | null;
  bikedesk_ticket_cardno: string | null;
  customer_data: BookingCustomerData | null;
  bike_data: BookingBikeData | null;
  bikedesk_ticket_id: number | null;
  payment_link_url: string | null;
  payment_expires_at: string | null;
  created_at: string;
  updated_at: string;
  bike?: Bike | null;
  events?: BookingEvent[];
  payment_status?: BookingPaymentStatusRecord | null;
  customer_status?: CustomerBookingStatus;
  service_labels?: string[];
}

export interface BookingEvent {
  id: string;
  booking_id: string;
  event_type: string;
  actor: 'system' | 'user' | 'webhook';
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ServiceReminder {
  id: string;
  user_id: string;
  bike_id: string;
  due_date: string;
  sent_at: string | null;
  dismissed_at: string | null;
  status: 'pending' | 'sent' | 'dismissed' | 'snoozed';
  rule?: {
    rule_name: string;
    interval_days: number;
  };
  bike?: Bike;
}

export interface HomePayload {
  viewer: AppShellSession;
  activeBooking: Booking | null;
  reminders: Array<ServiceReminder & { bike: Bike | null }>;
  bikes: Bike[];
  sync: SyncMeta;
}

export interface BookingContextPayload {
  bikes: Bike[];
  form: BookingForm;
  serviceCatalog: BikedeskServiceCatalog;
  methodServiceTotals: BookingMethodServiceTotals;
  sync: SyncMeta;
}

export interface BikesPayload {
  bikes: Bike[];
  sync: SyncMeta;
}

export interface BookingsPayload {
  bookings: Booking[];
  sync: SyncMeta;
}

export interface TrackerAddon {
  id: string;
  user_id: string;
  bike_id: string;
  active: boolean;
  device_id: string | null;
  last_position: { lat: number; lng: number; timestamp: string } | null;
  battery_pct: number | null;
  status: 'active' | 'offline' | 'low_battery' | null;
  activated_at: string | null;
  expires_at: string | null;
}

export interface BookingForm {
  id: string;
  title: string;
  slug: string | null;
  config: BookingFormConfig;
  created_at?: string;
  updated_at?: string;
}

export interface BookingFormConfig {
  enable_workshop: boolean;
  enable_pickup: boolean;
  enable_onsite: boolean;
  enable_budget_module: boolean;
  allowed_vehicle_types: string[];
  allowed_template_ids: number[];
  excluded_global_service_ids: number[];
  calendar_settings: CalendarSettings | null;
  template_vehicle_types?: Record<number, string[]>;
  workshop_tag_ids: number[];
  pickup_tag_ids: number[];
  onsite_tag_ids: number[];
  ignore_global_rules?: boolean;
  auto_skip_vehicle_step: boolean;
  force_hide_step1: boolean;
  service_message: string | null;
  booking_message: string | null;
  redirect_url: string | null;
  template_price_overrides?: Record<number, number>;
  hide_prices?: boolean;
  limit_strategy?: 'global' | 'custom';
  custom_max_workshop?: number;
  custom_max_pickup?: number;
  custom_max_onsite?: number;
  sms_template_id?: string | null;
  otp_allowed_embed_origins: string[];
  method_labels?: MethodLabels | null;
}

export interface CalendarSettings {
  buffer_days: number;
  block_holidays: boolean;
  block_weekdays: number[];
  blocked_dates: string[];
  max_bookings_workshop: number;
  max_bookings_pickup: number;
  max_bookings_onsite: number;
  availability_mode: AvailabilityMode;
  whitelist_dates: string[];
  closed_holiday_names: string[];
  workshop_time_slot_enabled: boolean;
  workshop_time_slot_duration: number;
  workshop_opening_start: number;
  workshop_opening_end: number;
  pickup_time_slot_enabled: boolean;
  pickup_time_slot_duration: number;
  pickup_opening_start: number;
  pickup_opening_end: number;
  onsite_time_slot_enabled: boolean;
  onsite_time_slot_duration: number;
  onsite_opening_start: number;
  onsite_opening_end: number;
}

export interface VehicleTypeConfig {
  id: string;
  name: string;
  icon_url: string;
  active: boolean;
  position: number;
}

export interface MethodLabels {
  workshop: string;
  pickup: string;
  onsite: string;
}

export interface BookingMethodServiceTotals {
  workshop: number;
  pickup: number;
  onsite: number;
}

export interface BookingSettings {
  visible_group_ids: number[];
  visible_template_ids: number[];
  template_vehicle_types: Record<number, string[]>;
  global_service_ids: number[];
  workshop_global_service_ids: number[];
  pickup_global_service_ids: number[];
  onsite_global_service_ids: number[];
  calendar_settings: CalendarSettings;
  pickup_template_id: number | null;
  workshop_template_id: number | null;
  global_redirect_url: string | null;
  terms_link: string;
  workshop_tag_ids: number[];
  pickup_tag_ids: number[];
  onsite_tag_ids: number[];
  workshop_weekday_tag_ids: WeekdayTagMap;
  pickup_weekday_tag_ids: WeekdayTagMap;
  onsite_weekday_tag_ids: WeekdayTagMap;
  method_labels: MethodLabels;
}

export interface BikedeskCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  zipcode: string;
  city: string;
}

export interface BikedeskCustomerArticle {
  id: number;
  customerid: number;
  title: string;
  serieno: string;
  color?: string;
  size?: string;
}

export interface BikedeskTag {
  id: number;
  label: string;
  color?: string;
}

export interface BikedeskTicket {
  id: number;
  number?: number;
  cardno?: string | null;
  autoincrementno?: number | null;
  customerid: number;
  description: string;
  type: string;
  status: string;
  startTime: string;
  pickup: string;
  storeid?: number;
  assignee?: number;
  tagids?: number[];
  customerarticleids?: number[];
  total?: number;
}

export interface BikedeskStore {
  id: number;
  title: string;
  phone: string;
  email: string;
}

export interface BikedeskUser {
  id: number;
  name?: string;
  username?: string;
  deleted?: number;
}

export interface BikedeskTicketTemplate {
  id: number;
  label: string;
  groupid: number;
  position: number;
  price: number | undefined;
  raw_price?: number | null;
  computed_price?: number | null;
  note: string;
  duration: number;
}

export interface BikedeskTicketTemplateGroup {
  id: number;
  name: string;
  label?: string;
  position?: number;
  tickettype?: string;
  visible?: boolean;
}

export interface BikedeskServiceCatalog {
  groups: BikedeskTicketTemplateGroup[];
  templates: BikedeskTicketTemplate[];
  source: 'cache' | 'live' | 'stale-cache' | 'empty';
  synced_at: string | null;
  is_stale: boolean;
  sync_error: string | null;
}

export interface BikedeskServiceCacheSnapshot {
  synced_at: string | null;
  sync_error: string | null;
  last_sync_cph_date: string | null;
  groups: BikedeskTicketTemplateGroup[];
  templates: BikedeskTicketTemplate[];
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  active: boolean;
  updated_at: string;
}

export interface SupportContactSettings {
  phone: string | null;
  email: string | null;
  faq_url: string | null;
}
