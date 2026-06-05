ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at timestamptz;
