-- Add 'url-import' as a valid source value for products
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_source_check;

ALTER TABLE products
  ADD CONSTRAINT products_source_check
    CHECK (source IN ('community', 'auto-imported', 'url-import'));
