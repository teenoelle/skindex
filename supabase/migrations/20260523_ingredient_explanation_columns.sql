ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS explanation_source text,
  ADD COLUMN IF NOT EXISTS skin_climate_notes jsonb;
