// ─── Auth / Session ─────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  phone: string;
  bikedesk_customer_id: number | null;
  created_at: string;
  last_login_at: string | null;
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

// ─── Bikes ───────────────────────────────────────────────────────────────────

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

// ─── Bookings ────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'booking_created'
  | 'awaiting_payment'
  | 'booking_confirmed'
  | 'payment_expired'
  | 'cancelled';

export type BookingMethod = 'drop_off' | 'pickup' | 'onsite';

export interface Booking {
  id: string;
  user_id: string;
  bike_id: string;
  bikedesk_ticket_id: number | null;
  status: BookingStatus;
  method: BookingMethod;
  service_type: string | null;
  description: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  payment_link_url: string | null;
  payment_expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  bike?: Bike;
}

export interface BookingEvent {
  id: string;
  booking_id: string;
  event_type: string;
  actor: 'system' | 'user' | 'webhook';
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ─── Service Reminders ───────────────────────────────────────────────────────

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

// ─── Tracker ─────────────────────────────────────────────────────────────────

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

// ─── BikeDesk ────────────────────────────────────────────────────────────────

export interface BikedeskCustomer {
  id: number;
  name: string;
  phone: string;
  email: string;
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

export interface BikedeskTicket {
  id: number;
  customerid: number;
  type: string;
  status: string;
  description: string;
  startTime: string;
  pickup: string;
  assignee?: number;
  storeid?: number;
  tagids?: number[];
}

export interface BikedeskStore {
  id: number;
  title: string;
  phone: string;
  email: string;
}

export interface BikedeskTag {
  id: number;
  label: string;
}

export interface BikedeskUser {
  id: number;
  name?: string;
  username?: string;
  deleted?: number;
}

export interface BikedeskTicketTemplate {
  id: number;
  name: string;
  price?: number;
  groupid?: number;
}

export interface BikedeskTicketTemplateGroup {
  id: number;
  name: string;
}

// ─── SMS Templates ───────────────────────────────────────────────────────────

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  active: boolean;
  updated_at: string;
}

// ─── Support ─────────────────────────────────────────────────────────────────

export interface SupportContactSettings {
  phone: string | null;
  email: string | null;
  faq_url: string | null;
}
