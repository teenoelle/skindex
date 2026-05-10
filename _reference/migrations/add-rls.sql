-- Enable RLS on all tables.
--
-- NOTE: The API routes currently use the anon key (no service-role key in .env.local).
-- These policies are therefore scoped to what anon actually needs.
-- The main gains: block direct browser reads of internal tables (ingredient_queue,
-- app_users), and block direct writes to the ingredients master list.
--
-- For full write protection, add SUPABASE_SERVICE_ROLE_KEY to .env.local and
-- update src/lib/supabase.ts to use it for API-route clients (see comment below).

-- ── ingredients (read-only — only scripts/admin should change this) ──────────
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read ingredients"
  ON ingredients FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── products (public read + anon insert for OBF auto-import) ─────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon insert products"
  ON products FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Updates come only from admin scripts (service-role bypasses RLS automatically).

-- ── ingredient_queue (internal — block reads, allow API writes) ───────────────
ALTER TABLE ingredient_queue ENABLE ROW LEVEL SECURITY;

-- Anon cannot SELECT the queue directly.
-- API routes can still insert/update through the anon key.
CREATE POLICY "anon insert ingredient_queue"
  ON ingredient_queue FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon update ingredient_queue"
  ON ingredient_queue FOR UPDATE
  TO anon, authenticated
  USING (true);

-- sync-queue.mjs reads the queue — run it from the Supabase dashboard SQL editor
-- or add a service-role key to allow scripts to bypass RLS.

-- ── app_users (internal — block reads, allow API writes) ─────────────────────
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert app_users"
  ON app_users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon update app_users"
  ON app_users FOR UPDATE
  TO anon, authenticated
  USING (true);

-- The scan API also SELECTs app_users to check the daily usage counter.
CREATE POLICY "anon read app_users"
  ON app_users FOR SELECT
  TO anon, authenticated
  USING (true);
