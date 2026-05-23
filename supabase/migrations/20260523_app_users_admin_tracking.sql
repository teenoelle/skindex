ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS granted_by text,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
