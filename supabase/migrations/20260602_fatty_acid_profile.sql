ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS fatty_acid_profile JSONB,
  ADD COLUMN IF NOT EXISTS profile_status TEXT;

CREATE INDEX IF NOT EXISTS idx_ingredients_profile_status
  ON ingredients (profile_status)
  WHERE profile_status IS NOT NULL;

-- Queue all existing Emollient ingredients for fatty acid profile population
UPDATE ingredients
  SET profile_status = 'needs_profile'
  WHERE structural_category = 'Emollient'
    AND fatty_acid_profile IS NULL;
