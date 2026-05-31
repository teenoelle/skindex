-- Run this in the Supabase SQL editor to enable multiple named routines.

CREATE TABLE IF NOT EXISTS routines (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT      NOT NULL,
  name        TEXT        NOT NULL DEFAULT 'My Routine',
  products    JSONB       NOT NULL DEFAULT '[]',
  display_order INT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS routines_clerk_user_id_idx ON routines (clerk_user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_routines_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routines_updated_at ON routines;
CREATE TRIGGER routines_updated_at
  BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION update_routines_updated_at();
