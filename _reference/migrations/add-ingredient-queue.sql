-- Run in: Supabase Dashboard → SQL Editor → New query
-- Adds the ingredient_queue table for tracking unrecognized ingredients
-- surfaced during product scans.

create table if not exists ingredient_queue (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  found_in text,
  times_seen int default 1,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'in-progress', 'done'))
);

create unique index if not exists ingredient_queue_name_idx on ingredient_queue (lower(name));
create index if not exists ingredient_queue_status_idx on ingredient_queue (status);
create index if not exists ingredient_queue_seen_idx on ingredient_queue (times_seen desc);

grant all on table ingredient_queue to anon, authenticated;
notify pgrst, 'reload schema';
