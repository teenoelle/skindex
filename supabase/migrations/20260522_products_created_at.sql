ALTER TABLE products
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE products SET created_at = submitted_at WHERE submitted_at IS NOT NULL AND created_at IS NULL;
UPDATE products SET created_at = now() WHERE created_at IS NULL;
