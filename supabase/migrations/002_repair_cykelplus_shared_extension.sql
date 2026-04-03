-- Repair the CykelPlus extension schema on top of the shared Booking database.
-- This migration is additive and idempotent, and is safe to rerun.

create extension if not exists "pgcrypto";

alter table if exists booking_forms
  add column if not exists slug text;

create unique index if not exists idx_booking_forms_slug_nonnull
  on booking_forms (slug)
  where slug is not null;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone text,
  bikedesk_customer_id integer,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_bikedesk_sync_at timestamptz
);

alter table if exists users
  add column if not exists phone text,
  add column if not exists bikedesk_customer_id integer,
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_login_at timestamptz,
  add column if not exists last_bikedesk_sync_at timestamptz;

create unique index if not exists idx_users_phone_unique
  on users (phone)
  where phone is not null;

create table if not exists user_profiles (
  id uuid primary key references users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  address text,
  city text,
  zip text,
  sms_reminders boolean not null default true,
  updated_at timestamptz
);

alter table if exists user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists zip text,
  add column if not exists sms_reminders boolean default true,
  add column if not exists updated_at timestamptz;

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz
);

alter table if exists user_sessions
  add column if not exists user_id uuid,
  add column if not exists token_hash text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists last_used_at timestamptz;

create unique index if not exists idx_user_sessions_token_hash_unique
  on user_sessions (token_hash)
  where token_hash is not null;

create table if not exists bikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bikedesk_article_id integer,
  brand text,
  model text,
  year integer,
  frame_number text,
  color text,
  type text,
  notes text,
  created_at timestamptz not null default now()
);

alter table if exists bikes
  add column if not exists user_id uuid,
  add column if not exists bikedesk_article_id integer,
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists year integer,
  add column if not exists frame_number text,
  add column if not exists color text,
  add column if not exists type text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

create table if not exists bike_images (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references bikes(id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  uploaded_at timestamptz not null default now()
);

alter table if exists bike_images
  add column if not exists bike_id uuid,
  add column if not exists storage_path text,
  add column if not exists is_primary boolean default false,
  add column if not exists uploaded_at timestamptz default now();

create table if not exists bike_external_refs (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references bikes(id) on delete cascade,
  system text not null,
  external_id text not null,
  synced_at timestamptz
);

alter table if exists bike_external_refs
  add column if not exists bike_id uuid,
  add column if not exists system text,
  add column if not exists external_id text,
  add column if not exists synced_at timestamptz;

create table if not exists booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  event_type text not null,
  actor text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table if exists booking_events
  add column if not exists booking_id uuid,
  add column if not exists event_type text,
  add column if not exists actor text,
  add column if not exists payload jsonb,
  add column if not exists created_at timestamptz default now();

create table if not exists booking_payment_status (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  payment_ref text,
  status text,
  amount_dkk numeric,
  paid_at timestamptz,
  expires_at timestamptz,
  raw_webhook jsonb,
  updated_at timestamptz
);

alter table if exists booking_payment_status
  add column if not exists booking_id uuid,
  add column if not exists payment_ref text,
  add column if not exists status text,
  add column if not exists amount_dkk numeric,
  add column if not exists paid_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists raw_webhook jsonb,
  add column if not exists updated_at timestamptz;

create unique index if not exists idx_booking_payment_status_booking_id_unique
  on booking_payment_status (booking_id)
  where booking_id is not null;

create table if not exists bike_history_cache (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references bikes(id) on delete cascade,
  entry_type text not null,
  bikedesk_ticket_id integer,
  title text not null,
  description text,
  completed_at date,
  workshop text,
  cached_at timestamptz not null default now()
);

alter table if exists bike_history_cache
  add column if not exists bike_id uuid,
  add column if not exists entry_type text,
  add column if not exists bikedesk_ticket_id integer,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists completed_at date,
  add column if not exists workshop text,
  add column if not exists cached_at timestamptz default now();

create table if not exists service_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  interval_days integer not null,
  applies_to text not null default 'all',
  sms_template text,
  enabled boolean not null default true
);

alter table if exists service_reminder_rules
  add column if not exists rule_name text,
  add column if not exists interval_days integer,
  add column if not exists applies_to text default 'all',
  add column if not exists sms_template text,
  add column if not exists enabled boolean default true;

create table if not exists service_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bike_id uuid not null references bikes(id) on delete cascade,
  rule_id uuid references service_reminder_rules(id),
  due_date date not null,
  sent_at timestamptz,
  dismissed_at timestamptz,
  status text not null default 'pending'
);

alter table if exists service_reminders
  add column if not exists user_id uuid,
  add column if not exists bike_id uuid,
  add column if not exists rule_id uuid,
  add column if not exists due_date date,
  add column if not exists sent_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists status text default 'pending';

create table if not exists tracker_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bike_id uuid not null references bikes(id) on delete cascade,
  active boolean not null default false,
  device_id text,
  last_position jsonb,
  battery_pct integer,
  status text,
  activated_at timestamptz,
  expires_at timestamptz
);

alter table if exists tracker_addons
  add column if not exists user_id uuid,
  add column if not exists bike_id uuid,
  add column if not exists active boolean default false,
  add column if not exists device_id text,
  add column if not exists last_position jsonb,
  add column if not exists battery_pct integer,
  add column if not exists status text,
  add column if not exists activated_at timestamptz,
  add column if not exists expires_at timestamptz;

create table if not exists support_contact_settings (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  faq_url text,
  updated_at timestamptz not null default now()
);

alter table if exists support_contact_settings
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists faq_url text,
  add column if not exists updated_at timestamptz default now();

alter table if exists bookings
  add column if not exists user_id uuid,
  add column if not exists bike_id uuid,
  add column if not exists payment_link_url text,
  add column if not exists payment_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_id_fkey'
  ) then
    alter table if exists user_profiles
      add constraint user_profiles_id_fkey
      foreign key (id) references users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_sessions_user_id_fkey'
  ) then
    alter table if exists user_sessions
      add constraint user_sessions_user_id_fkey
      foreign key (user_id) references users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bikes_user_id_fkey'
  ) then
    alter table if exists bikes
      add constraint bikes_user_id_fkey
      foreign key (user_id) references users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bike_images_bike_id_fkey'
  ) then
    alter table if exists bike_images
      add constraint bike_images_bike_id_fkey
      foreign key (bike_id) references bikes(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bike_external_refs_bike_id_fkey'
  ) then
    alter table if exists bike_external_refs
      add constraint bike_external_refs_bike_id_fkey
      foreign key (bike_id) references bikes(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'booking_events_booking_id_fkey'
  ) then
    alter table if exists booking_events
      add constraint booking_events_booking_id_fkey
      foreign key (booking_id) references bookings(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'booking_payment_status_booking_id_fkey'
  ) then
    alter table if exists booking_payment_status
      add constraint booking_payment_status_booking_id_fkey
      foreign key (booking_id) references bookings(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bike_history_cache_bike_id_fkey'
  ) then
    alter table if exists bike_history_cache
      add constraint bike_history_cache_bike_id_fkey
      foreign key (bike_id) references bikes(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_reminders_user_id_fkey'
  ) then
    alter table if exists service_reminders
      add constraint service_reminders_user_id_fkey
      foreign key (user_id) references users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_reminders_bike_id_fkey'
  ) then
    alter table if exists service_reminders
      add constraint service_reminders_bike_id_fkey
      foreign key (bike_id) references bikes(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_reminders_rule_id_fkey'
  ) then
    alter table if exists service_reminders
      add constraint service_reminders_rule_id_fkey
      foreign key (rule_id) references service_reminder_rules(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tracker_addons_user_id_fkey'
  ) then
    alter table if exists tracker_addons
      add constraint tracker_addons_user_id_fkey
      foreign key (user_id) references users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tracker_addons_bike_id_fkey'
  ) then
    alter table if exists tracker_addons
      add constraint tracker_addons_bike_id_fkey
      foreign key (bike_id) references bikes(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_user_id_fkey'
  ) then
    alter table if exists bookings
      add constraint bookings_user_id_fkey
      foreign key (user_id) references users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_bike_id_fkey'
  ) then
    alter table if exists bookings
      add constraint bookings_bike_id_fkey
      foreign key (bike_id) references bikes(id) on delete set null;
  end if;
end $$;

create index if not exists idx_user_sessions_user_id
  on user_sessions (user_id);

create index if not exists idx_user_sessions_expires_at
  on user_sessions (expires_at);

create index if not exists idx_bikes_user_id
  on bikes (user_id);

create unique index if not exists idx_bikes_user_article_unique
  on bikes (user_id, bikedesk_article_id)
  where bikedesk_article_id is not null;

create index if not exists idx_bike_images_bike_id
  on bike_images (bike_id);

create index if not exists idx_bike_external_refs_bike_system
  on bike_external_refs (bike_id, system);

create index if not exists idx_bookings_user_id
  on bookings (user_id);

create index if not exists idx_bookings_bike_id
  on bookings (bike_id);

create unique index if not exists idx_bookings_ticket_unique
  on bookings (bikedesk_ticket_id)
  where bikedesk_ticket_id is not null;

create index if not exists idx_booking_events_booking_id
  on booking_events (booking_id, created_at);

create index if not exists idx_booking_payment_status_status_expires
  on booking_payment_status (status, expires_at);

create index if not exists idx_bike_history_cache_bike_id
  on bike_history_cache (bike_id, completed_at desc);

create index if not exists idx_service_reminders_user_status
  on service_reminders (user_id, status);

create index if not exists idx_service_reminders_bike_status
  on service_reminders (bike_id, status);

create index if not exists idx_tracker_addons_user_bike
  on tracker_addons (user_id, bike_id);

insert into service_reminder_rules (rule_name, interval_days, applies_to)
select 'Årlig service', 365, 'all'
where not exists (
  select 1
  from service_reminder_rules
  where rule_name in ('Årlig service', 'Aarlig service')
);

insert into support_contact_settings (phone, email)
select '+4529837883', 'service@b-bikes.dk'
where not exists (
  select 1
  from support_contact_settings
);

insert into booking_forms (title, slug, config)
select
  'CykelPlus App',
  'cykelplus-app',
  coalesce(
    (select config from booking_forms where slug = 'booking' limit 1),
    (select config from booking_forms where slug = 'standard' limit 1),
    '{
      "enable_workshop": true,
      "enable_pickup": true,
      "enable_onsite": false,
      "enable_budget_module": true,
      "allowed_vehicle_types": [],
      "allowed_template_ids": [],
      "excluded_global_service_ids": [],
      "calendar_settings": null,
      "template_vehicle_types": {},
      "workshop_tag_ids": [],
      "pickup_tag_ids": [],
      "onsite_tag_ids": [],
      "ignore_global_rules": false,
      "auto_skip_vehicle_step": false,
      "force_hide_step1": false,
      "service_message": null,
      "booking_message": null,
      "redirect_url": null,
      "hide_prices": false,
      "otp_allowed_embed_origins": [],
      "method_labels": {
        "workshop": "Indlevering i butik",
        "pickup": "Hent og bring",
        "onsite": "På arbejdsplads"
      }
    }'::jsonb
  )
where not exists (
  select 1
  from booking_forms
  where slug = 'cykelplus-app'
);

alter table if exists users enable row level security;
alter table if exists user_profiles enable row level security;
alter table if exists user_sessions enable row level security;
alter table if exists bikes enable row level security;
alter table if exists bike_images enable row level security;
alter table if exists bike_external_refs enable row level security;
alter table if exists booking_events enable row level security;
alter table if exists booking_payment_status enable row level security;
alter table if exists bike_history_cache enable row level security;
alter table if exists service_reminder_rules enable row level security;
alter table if exists service_reminders enable row level security;
alter table if exists tracker_addons enable row level security;
alter table if exists support_contact_settings enable row level security;
