-- Audit columns for product image updates
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_updated_by text,
  ADD COLUMN IF NOT EXISTS image_updated_at timestamptz;
