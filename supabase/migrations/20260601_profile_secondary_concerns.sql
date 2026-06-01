-- Profile-specific concern reclassification
-- Ingredients that are safe for most users but carry a real concern for specific profiles.
-- Status → 'flagged'; category (benefit) is preserved so the benefit stripe still shows.
-- explanation_source reset to 'template' so the admin upgrade batch regenerates structured explanations.
-- Where an ingredient is already flagged as something else, the new category is added as secondary.

-- =============================================================================
-- GROUP 1: SENSITIZERS
-- Reactive, damaged barrier, rosacea, eczema, psoriasis
-- =============================================================================

-- Vitamin C / ascorbic acid forms
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (
    LOWER(name) LIKE '%ascorbic acid%'
    OR LOWER(name) LIKE '%ascorbyl glucoside%'
    OR LOWER(name) LIKE '%ascorbyl palmitate%'
    OR LOWER(name) LIKE '%ascorbyl tetraisopalmitate%'
    OR LOWER(name) LIKE '%sodium ascorbyl phosphate%'
    OR LOWER(name) LIKE '%magnesium ascorbyl phosphate%'
    OR LOWER(name) LIKE '%3-o-ethyl ascorbic%'
    OR LOWER(name) LIKE '%ethyl ascorbic acid%'
  );

-- Already-flagged ascorbyl forms get sensitizer as secondary
UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'sensitizer'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('sensitizer' = ANY(secondary_flagged_categories))
  AND (
    LOWER(name) LIKE '%ascorbic acid%'
    OR LOWER(name) LIKE '%ascorbyl%'
  );

-- Witch hazel
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (LOWER(name) LIKE '%hamamelis%' OR LOWER(name) LIKE '%witch hazel%');

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'sensitizer'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('sensitizer' = ANY(secondary_flagged_categories))
  AND (LOWER(name) LIKE '%hamamelis%' OR LOWER(name) LIKE '%witch hazel%');

-- Citric acid (not already flagged as AHA in most DBs)
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND LOWER(TRIM(name)) = 'citric acid';

-- Kojic acid
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (LOWER(name) LIKE '%kojic acid%' OR LOWER(name) LIKE '%kojic dipalmitate%');

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'sensitizer'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('sensitizer' = ANY(secondary_flagged_categories))
  AND (LOWER(name) LIKE '%kojic acid%' OR LOWER(name) LIKE '%kojic dipalmitate%');

-- Azelaic acid
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND LOWER(name) LIKE '%azelaic acid%';

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'sensitizer'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('sensitizer' = ANY(secondary_flagged_categories))
  AND LOWER(name) LIKE '%azelaic acid%';

-- Urea (keratolytic at functional concentrations)
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND LOWER(TRIM(name)) = 'urea';

-- Benzoyl peroxide
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'sensitizer',
    explanation_source = 'template'
WHERE status = 'safe'
  AND LOWER(name) LIKE '%benzoyl peroxide%';

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'sensitizer'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('sensitizer' = ANY(secondary_flagged_categories))
  AND LOWER(name) LIKE '%benzoyl peroxide%';

-- =============================================================================
-- GROUP 2: VASODILATORS (new category)
-- Rosacea, lupus rash
-- =============================================================================

-- Menthol and peppermint/mint oils
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'vasodilator',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (
    LOWER(TRIM(name)) = 'menthol'
    OR LOWER(name) LIKE '%mentha piperita%'
    OR LOWER(name) LIKE '%mentha arvensis%'
    OR LOWER(name) LIKE '%peppermint oil%'
    OR LOWER(name) LIKE '%peppermint extract%'
  );

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'vasodilator'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('vasodilator' = ANY(secondary_flagged_categories))
  AND (
    LOWER(TRIM(name)) = 'menthol'
    OR LOWER(name) LIKE '%mentha piperita%'
    OR LOWER(name) LIKE '%mentha arvensis%'
    OR LOWER(name) LIKE '%peppermint%'
  );

-- Camphor
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'vasodilator',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (
    LOWER(TRIM(name)) = 'camphor'
    OR LOWER(name) LIKE '%cinnamomum camphora%'
  );

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'vasodilator'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('vasodilator' = ANY(secondary_flagged_categories))
  AND (LOWER(TRIM(name)) = 'camphor' OR LOWER(name) LIKE '%cinnamomum camphora%');

-- Cinnamon bark oil/extract
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'vasodilator',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (
    LOWER(name) LIKE '%cinnamomum cassia%'
    OR LOWER(name) LIKE '%cinnamomum zeylanicum%'
    OR LOWER(name) LIKE '%cinnamon bark%'
    OR LOWER(name) LIKE '%cinnamon leaf%'
  );

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'vasodilator'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('vasodilator' = ANY(secondary_flagged_categories))
  AND (
    LOWER(name) LIKE '%cinnamomum cassia%'
    OR LOWER(name) LIKE '%cinnamomum zeylanicum%'
    OR LOWER(name) LIKE '%cinnamon bark%'
    OR LOWER(name) LIKE '%cinnamon leaf%'
  );

-- Clove bud oil / eugenia caryophyllus
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'vasodilator',
    explanation_source = 'template'
WHERE status = 'safe'
  AND LOWER(name) LIKE '%eugenia caryophyllus%';

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'vasodilator'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('vasodilator' = ANY(secondary_flagged_categories))
  AND LOWER(name) LIKE '%eugenia caryophyllus%';

-- Capsicum / capsaicin
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'vasodilator',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (LOWER(name) LIKE '%capsicum%' OR LOWER(name) LIKE '%capsaicin%');

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'vasodilator'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('vasodilator' = ANY(secondary_flagged_categories))
  AND (LOWER(name) LIKE '%capsicum%' OR LOWER(name) LIKE '%capsaicin%');

-- =============================================================================
-- GROUP 3: PHYTOESTROGENS (additions to currently-safe ingredients)
-- Hormone sensitive, on HRT, pregnant, breastfeeding
-- =============================================================================

-- Resveratrol
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'phytoestrogen',
    explanation_source = 'template'
WHERE status = 'safe'
  AND LOWER(name) LIKE '%resveratrol%';

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'phytoestrogen'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('phytoestrogen' = ANY(secondary_flagged_categories))
  AND LOWER(name) LIKE '%resveratrol%';

-- Licorice root / glycyrrhiza
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'phytoestrogen',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (LOWER(name) LIKE '%glycyrrhiza%' OR LOWER(name) LIKE '%licorice root%');

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'phytoestrogen'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('phytoestrogen' = ANY(secondary_flagged_categories))
  AND (LOWER(name) LIKE '%glycyrrhiza%' OR LOWER(name) LIKE '%licorice root%');

-- Soy / isoflavones
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'phytoestrogen',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (
    LOWER(name) LIKE '%glycine soja%'
    OR LOWER(name) LIKE '%soy extract%'
    OR LOWER(name) LIKE '%soybean extract%'
    OR LOWER(name) LIKE '%isoflavone%'
    OR LOWER(TRIM(name)) IN ('genistein', 'daidzein')
  );

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'phytoestrogen'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('phytoestrogen' = ANY(secondary_flagged_categories))
  AND (
    LOWER(name) LIKE '%glycine soja%'
    OR LOWER(name) LIKE '%isoflavone%'
    OR LOWER(TRIM(name)) IN ('genistein', 'daidzein')
  );

-- Hop extract
UPDATE ingredients
SET status = 'flagged',
    flagged_category = 'phytoestrogen',
    explanation_source = 'template'
WHERE status = 'safe'
  AND (LOWER(name) LIKE '%humulus lupulus%' OR LOWER(name) LIKE '%hop extract%' OR LOWER(name) LIKE '%hops extract%');

UPDATE ingredients
SET secondary_flagged_categories = array_append(secondary_flagged_categories, 'phytoestrogen'),
    explanation_source = 'template'
WHERE status = 'flagged'
  AND NOT ('phytoestrogen' = ANY(secondary_flagged_categories))
  AND (LOWER(name) LIKE '%humulus lupulus%' OR LOWER(name) LIKE '%hop extract%');
