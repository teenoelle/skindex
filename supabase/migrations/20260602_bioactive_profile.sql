ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS bioactive_profile JSONB;

-- Queue all existing Plant Extract ingredients for bioactive profile population
UPDATE ingredients
  SET profile_status = 'needs_profile'
  WHERE structural_category = 'Plant Extract'
    AND profile_status IS NULL;
