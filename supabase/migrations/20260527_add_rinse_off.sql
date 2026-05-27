-- Add is_rinse_off flag to product_types
-- Admins can toggle this per type; it controls the default toggle position in scan results
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS is_rinse_off boolean NOT NULL DEFAULT false;
