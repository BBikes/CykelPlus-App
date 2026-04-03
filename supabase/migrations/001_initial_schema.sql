-- ============================================================
-- CykelPlus App — Initial Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── users ────────────────────────────────────────────────────
create table users (
  id                    uuid primary key default gen_random_uuid(),
  phone                 text unique not null,           -- E.164 format
  bikedesk_customer_id  int,
  created_at            timestamptz not null default now(),
  last_login_at         timestamptz
);

-- ── user_profiles ─────────────────────────────────────────────
create table user_profiles (
  id            uuid primary key references users(id) on delete cascade,
  first_name    text,
  last_name     text,
  email         text,
  address       text,
  city          text,
  zip           text,
  sms_reminders boolean not null default true,
  updated_at    timestamptz
);

-- ── user_sessions ─────────────────────────────────────────────
create table user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  token_hash    text unique not null,           -- SHA256 of raw cookie token
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_used_at  timestamptz
);

create index user_sessions_user_id_idx on user_sessions(user_id);
create index user_sessions_expires_at_idx on user_sessions(expires_at);

-- ── phone_verification_sessions ───────────────────────────────
-- One-time OTP tokens (same pattern as booking project)
create table phone_verification_sessions (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  token_hash    text unique not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz
);

create index phone_verification_phone_idx on phone_verification_sessions(phone);

-- ── bikes ─────────────────────────────────────────────────────
create table bikes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  bikedesk_article_id   int,
  brand                 text,
  model                 text,
  year                  int,
  frame_number          text,
  color                 text,
  type                  text,           -- road, mtb, cargo, e-bike, etc.
  notes                 text,
  created_at            timestamptz not null default now()
);

create index bikes_user_id_idx on bikes(user_id);

-- ── bike_images ───────────────────────────────────────────────
create table bike_images (
  id            uuid primary key default gen_random_uuid(),
  bike_id       uuid not null references bikes(id) on delete cascade,
  storage_path  text not null,           -- Supabase Storage path
  is_primary    boolean not null default false,
  uploaded_at   timestamptz not null default now()
);

create index bike_images_bike_id_idx on bike_images(bike_id);

-- ── bike_external_refs ────────────────────────────────────────
create table bike_external_refs (
  id            uuid primary key default gen_random_uuid(),
  bike_id       uuid not null references bikes(id) on delete cascade,
  system        text not null,           -- 'bikedesk'
  external_id   text not null,
  synced_at     timestamptz
);

-- ── bookings ──────────────────────────────────────────────────
create table bookings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  bike_id               uuid not null references bikes(id),
  bikedesk_ticket_id    int,
  status                text not null,           -- booking_created | awaiting_payment | booking_confirmed | payment_expired | cancelled
  method                text,                    -- drop_off | pickup | onsite
  service_type          text,
  description           text,
  scheduled_date        date,
  scheduled_time        text,
  payment_link_url      text,
  payment_expires_at    timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index bookings_user_id_idx on bookings(user_id);
create index bookings_status_idx on bookings(status);
create index bookings_bikedesk_ticket_id_idx on bookings(bikedesk_ticket_id);

-- ── booking_events ────────────────────────────────────────────
create table booking_events (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  event_type    text not null,           -- created | payment_sent | confirmed | payment_expired | cancelled
  actor         text not null,           -- system | user | webhook
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index booking_events_booking_id_idx on booking_events(booking_id);

-- ── booking_payment_status ────────────────────────────────────
create table booking_payment_status (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references bookings(id) on delete cascade,
  payment_ref   text,
  status        text,                    -- pending | paid | expired | refunded
  amount_dkk    numeric,
  paid_at       timestamptz,
  expires_at    timestamptz,
  raw_webhook   jsonb,
  updated_at    timestamptz
);

-- ── bike_history_cache ────────────────────────────────────────
create table bike_history_cache (
  id                    uuid primary key default gen_random_uuid(),
  bike_id               uuid not null references bikes(id) on delete cascade,
  entry_type            text not null,    -- service | repair
  bikedesk_ticket_id    int,
  title                 text not null,
  description           text,
  completed_at          date,
  workshop              text,
  cached_at             timestamptz not null default now()
);

create index bike_history_cache_bike_id_idx on bike_history_cache(bike_id);

-- ── service_reminder_rules ────────────────────────────────────
create table service_reminder_rules (
  id              uuid primary key default gen_random_uuid(),
  rule_name       text not null,
  interval_days   int not null,           -- days since last service
  applies_to      text not null default 'all',
  sms_template    text,
  enabled         boolean not null default true
);

-- Seed default rule
insert into service_reminder_rules (rule_name, interval_days, applies_to)
values ('Årlig service', 365, 'all');

-- ── service_reminders ─────────────────────────────────────────
create table service_reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  bike_id       uuid not null references bikes(id) on delete cascade,
  rule_id       uuid references service_reminder_rules(id),
  due_date      date not null,
  sent_at       timestamptz,
  dismissed_at  timestamptz,
  status        text not null default 'pending'   -- pending | sent | dismissed | snoozed
);

create index service_reminders_user_id_idx on service_reminders(user_id);
create index service_reminders_status_idx on service_reminders(status);

-- ── tracker_addons ────────────────────────────────────────────
create table tracker_addons (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  bike_id         uuid not null references bikes(id) on delete cascade,
  active          boolean not null default false,
  device_id       text,
  last_position   jsonb,                   -- {lat, lng, timestamp}
  battery_pct     int,
  status          text,                    -- active | offline | low_battery
  activated_at    timestamptz,
  expires_at      timestamptz
);

-- ── support_contact_settings ──────────────────────────────────
create table support_contact_settings (
  id          uuid primary key default gen_random_uuid(),
  phone       text,
  email       text,
  faq_url     text,
  updated_at  timestamptz
);

-- Seed default contact settings
insert into support_contact_settings (phone, email)
values ('+4529837883', 'service@b-bikes.dk');

-- ── system_settings ──────────────────────────────────────────
create table system_settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────
-- NOTE: Since we use custom session tokens (not Supabase Auth),
-- all data access goes through service role in API routes.
-- RLS is enabled for defense-in-depth but policies use service role bypass.

alter table users enable row level security;
alter table user_profiles enable row level security;
alter table user_sessions enable row level security;
alter table bikes enable row level security;
alter table bike_images enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;

-- Service role bypasses all RLS — used by all API routes
-- Anon key gets no access by default (no policies = deny all)
