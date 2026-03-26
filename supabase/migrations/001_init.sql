create extension if not exists pgcrypto;

create table if not exists sneakers (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  brand text,
  model text,
  official_product_name text,
  common_nickname text,
  aliases text[],
  colorway text,
  sku text,
  size text,
  condition text,
  box_condition text,
  purchase_source text,
  purchase_date date,
  purchase_price numeric,
  estimated_value_low numeric,
  estimated_value_mid numeric,
  estimated_value_high numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists wear_logs (
  id uuid primary key default gen_random_uuid(),
  sneaker_id uuid not null references sneakers(id) on delete cascade,
  wear_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sneaker_photos (
  id uuid primary key default gen_random_uuid(),
  sneaker_id uuid not null references sneakers(id) on delete cascade,
  photo_type text not null,
  image_url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists value_history (
  id uuid primary key default gen_random_uuid(),
  sneaker_id uuid not null references sneakers(id) on delete cascade,
  source text,
  price_low numeric,
  price_mid numeric,
  price_high numeric,
  notes text,
  recorded_at timestamptz not null default now()
);