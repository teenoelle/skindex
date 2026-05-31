-- Allow ingredients to carry additional concern categories beyond the primary one.
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS secondary_flagged_categories text[] NOT NULL DEFAULT '{}';
