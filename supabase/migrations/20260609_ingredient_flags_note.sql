-- Add free-text note field to ingredient_flags
ALTER TABLE ingredient_flags
  ADD COLUMN IF NOT EXISTS note TEXT;
