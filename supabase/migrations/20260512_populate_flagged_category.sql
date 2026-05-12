-- Populate flagged_category for all flagged ingredients.
-- For most ingredients, the existing category value is already the correct flagged reason
-- (sensitizer, pore-clogger, etc.) — copy it across.
-- For ingredients where category = their own name (original seed artifact), assign a proper reason.

-- 1. Copy meaningful category codes directly to flagged_category
UPDATE ingredients
SET flagged_category = category
WHERE status = 'flagged'
  AND flagged_category IS NULL
  AND category IN (
    'sensitizer', 'Sensitizer',
    'pore-clogger',
    'occlusive', 'Occlusive',
    'stripping',
    'fragrance-allergen',
    'photosensitizer',
    'exfoliant',
    'retinoid',
    'Fragrance Allergen',
    'Fragrance',
    'Preservative Allergen',
    'Preservative',
    'Irritant',
    'Essential Oil',
    'Chemical Sunscreen',
    'Drying Solvent',
    'Sulfate Surfactant',
    'Synthetic Musk'
  );

-- 2. Fix ingredient-name-as-category artifacts

-- Hyaluronic acid/hyaluronate: flagged because it draws moisture AND bacteria to
-- the skin surface in high concentrations, worsening breakouts on acne-prone skin.
UPDATE ingredients
SET flagged_category = 'bacteria-trap'
WHERE status = 'flagged'
  AND flagged_category IS NULL
  AND (LOWER(name) LIKE '%hyaluronic acid%' OR LOWER(name) LIKE '%hyaluronate%');

-- Shea butter: comedogenic / pore-clogger
UPDATE ingredients
SET flagged_category = 'pore-clogger'
WHERE status = 'flagged'
  AND flagged_category IS NULL
  AND LOWER(TRIM(name)) = 'shea butter';

-- Aloe vera (if flagged): documented sensitizer in some individuals
UPDATE ingredients
SET flagged_category = 'sensitizer'
WHERE status = 'flagged'
  AND flagged_category IS NULL
  AND LOWER(name) LIKE '%aloe%';

-- 3. Fallback: any remaining flagged ingredient with a non-null category
-- that wasn't caught above — copy it anyway so the display has something
UPDATE ingredients
SET flagged_category = category
WHERE status = 'flagged'
  AND flagged_category IS NULL
  AND category IS NOT NULL;
