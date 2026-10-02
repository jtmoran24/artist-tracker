-- Milestone 1 schema. References auth.users(id) for the owning user.
-- Run via `supabase db push` once the project exists, or paste into the SQL editor.

create extension if not exists pgcrypto;

create table artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spotify_id text,
  official_site_url text,
  created_at timestamptz not null default now()
);

create table artist_identities (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  identity_type text not null, -- spotify | official_site | ticketing | venue | social | merch
  identifier text not null,
  confidence text not null default 'unconfirmed', -- unconfirmed | confirmed
  created_at timestamptz not null default now()
);

create table user_artist_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  origin text not null default 'manual', -- manual | spotify_import
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, artist_id)
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_km numeric not null default 50,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table artist_location_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  scope text not null, -- radius | city | region | country | worldwide
  radius_km numeric,
  region text,
  created_at timestamptz not null default now(),
  unique (user_id, artist_id)
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  adapter_type text not null, -- e.g. songkick, bandsintown, shopify_store, generic_html
  url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table source_checks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  checked_at timestamptz not null default now(),
  success boolean not null,
  error_message text,
  raw_snapshot_hash text
);

create table events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  name text,
  venue text,
  city text,
  region text,
  country text,
  latitude double precision,
  longitude double precision,
  event_date date,
  event_type text, -- solo | tour | festival
  is_festival boolean not null default false,
  announcement_at timestamptz,
  presale_at timestamptz,
  general_sale_at timestamptz,
  ticket_url text,
  status text not null default 'announced', -- announced | cancelled | postponed
  confidence text not null default 'uncertain', -- uncertain | likely | confirmed
  first_detected_at timestamptz not null default now()
);

create table event_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  raw_data jsonb,
  detected_at timestamptz not null default now()
);

create table merch_products (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  name text not null,
  url text,
  image_url text,
  price numeric,
  currency text,
  status text not null default 'available', -- available | sold_out | restocked
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table merch_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references merch_products(id) on delete cascade,
  variant_name text,
  size text,
  availability text not null default 'available',
  last_seen_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null, -- concert | merch
  event_id uuid references events(id) on delete cascade,
  product_id uuid references merch_products(id) on delete cascade,
  priority text not null default 'normal', -- low | normal | high | urgent
  message text not null,
  is_uncertain boolean not null default false,
  requires_ack boolean not null default false,
  repeat_interval_minutes integer default 5,
  created_at timestamptz not null default now()
);

create table delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  channel text not null, -- push | email | sms
  status text not null, -- sent | failed
  error_message text,
  attempted_at timestamptz not null default now()
);

create table acknowledgements (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (alert_id, user_id)
);

-- Row Level Security: every user-owned table restricts to the owning row.
alter table user_artist_follows enable row level security;
alter table locations enable row level security;
alter table artist_location_overrides enable row level security;
alter table alerts enable row level security;
alter table acknowledgements enable row level security;

create policy "own rows" on user_artist_follows for all using (auth.uid() = user_id);
create policy "own rows" on locations for all using (auth.uid() = user_id);
create policy "own rows" on artist_location_overrides for all using (auth.uid() = user_id);
create policy "own rows" on alerts for all using (auth.uid() = user_id);
create policy "own rows" on acknowledgements for all using (auth.uid() = user_id);
