-- Extend ingredient_flags to support multi-select chip reasons,
-- a product context link, and a user skin profile snapshot.

ALTER TABLE ingredient_flags
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reasons TEXT[],
  ADD COLUMN IF NOT EXISTS user_profile_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_ingredient_flags_product ON ingredient_flags(product_id)
  WHERE product_id IS NOT NULL;
