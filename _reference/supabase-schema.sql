-- SKINdex database schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  inci_name text,
  status text not null check (status in ('safe', 'flagged')),
  explanation text,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  type text,
  ingredient_list text,
  source text not null default 'community' check (source in ('community', 'auto-imported')),
  submitted_by text,
  merged_into uuid references products(id),
  created_at timestamptz default now()
);

create table scan_results (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  safe_ingredients text[],
  flagged_ingredients text[],
  unreviewed_ingredients text[],
  source_url text,
  created_at timestamptz default now()
);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  ai_extractions_today int default 0,
  last_reset_date date default current_date,
  created_at timestamptz default now()
);

create table user_ingredient_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  note text not null,
  created_at timestamptz default now(),
  unique(user_id, ingredient_id)
);

-- Collects unrecognized ingredients surfaced during product scans.
-- These are reviewed and classified in conversation, then promoted
-- to the ingredients table and skindex-staging.xlsx.
create table ingredient_queue (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  found_in text,               -- product name where first encountered
  times_seen int default 1,    -- incremented each time a scan encounters it
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  notes text,                  -- context added during review
  status text not null default 'pending'
    check (status in ('pending', 'in-progress', 'done')),
  unique(lower(name))          -- one row per unique ingredient name
);

-- Indexes for common lookups
create index on ingredients (lower(name));
create index on products (lower(name));
create index on products (lower(brand));
create index on app_users (clerk_id);
create index on ingredient_queue (status);
create index on ingredient_queue (times_seen desc);
