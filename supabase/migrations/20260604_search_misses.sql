-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Creates the search_misses table and upsert function for tracking user search gaps.

CREATE TABLE IF NOT EXISTS search_misses (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  query     text        NOT NULL,
  kind      text        NOT NULL DEFAULT 'search',   -- 'search' | 'url'
  failure   text        NOT NULL DEFAULT 'no_match', -- 'no_match' | 'extraction_failed' | 'iherb_blocked'
  times_seen integer    NOT NULL DEFAULT 1,
  last_seen  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_misses_query_kind_failure_idx
  ON search_misses (query, kind, failure);

-- Upsert function: increment times_seen atomically on conflict
CREATE OR REPLACE FUNCTION upsert_search_miss(p_query text, p_kind text, p_failure text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO search_misses (query, kind, failure)
  VALUES (p_query, p_kind, p_failure)
  ON CONFLICT (query, kind, failure)
  DO UPDATE SET
    times_seen = search_misses.times_seen + 1,
    last_seen  = now();
END;
$$;
