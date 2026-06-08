-- Split structural_category 'UV Filter' into 'Mineral UV Filter' and 'Chemical UV Filter'.
-- Mineral sunscreens also get category = 'Mineral Sunscreen' (benefit pill).
-- Modern safe chemical filters (Tinosorb S, Mexoryl SX, Uvinul T 150) are reclassified
-- as flagged with flagged_category = 'Chemical Sunscreen' so profile-matched amber pills
-- appear for rosacea, lupus, pregnant, breastfeeding, and hormonal profiles.

-- Step 1: Mineral UV filters → Mineral UV Filter structural + Mineral Sunscreen benefit
UPDATE ingredients SET
  structural_category = 'Mineral UV Filter',
  category = 'Mineral Sunscreen'
WHERE structural_category = 'UV Filter'
  AND status = 'safe'
  AND LOWER(TRIM(name)) IN (
    'zinc oxide',
    'titanium dioxide',
    'zinc oxide (nano)',
    'titanium dioxide (nano)',
    'ci 77891 / titanium dioxide',
    'ci 77891'
  );

-- Step 2: Remaining safe UV filters are modern chemical filters → reclassify as flagged
-- (Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine / Tinosorb S,
--  Ethylhexyl Triazone / Uvinul T 150,
--  Terephthalylidene Dicamphor Sulfonic Acid / Mexoryl SX)
UPDATE ingredients SET
  structural_category = 'Chemical UV Filter',
  status = 'flagged',
  flagged_category = 'Chemical Sunscreen',
  category = NULL
WHERE structural_category = 'UV Filter'
  AND status = 'safe';

-- Step 3: Already-flagged chemical UV filters → Chemical UV Filter structural
UPDATE ingredients SET structural_category = 'Chemical UV Filter'
WHERE structural_category = 'UV Filter'
  AND status = 'flagged';
