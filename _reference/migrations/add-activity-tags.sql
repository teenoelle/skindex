-- Run in: Supabase Dashboard → SQL Editor → New query
-- Adds pre_run, activity_tags, and activity_note columns to products.

alter table products
  add column if not exists pre_run text
    check (pre_run in ('yes', 'no', 'maybe')),
  add column if not exists activity_tags text[] default '{}',
  add column if not exists activity_note text;

create index if not exists products_activity_tags_idx on products using gin (activity_tags);
