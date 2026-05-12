-- ============================================================
-- STRUCTURAL CATEGORIES MIGRATION
-- Populates structural_category for all ingredients.
--
-- Design rule:
--   structural_category = formulation role (what it does for the product)
--   category            = skin benefit or skin concern (what it does for skin)
--
-- When the structural role IS the skin benefit (Humectant, Emollient),
-- we set category = NULL so the badge alone communicates both without redundancy.
-- ============================================================


-- ── SECTION A: Move structural-role values out of category ────────────────

-- Emulsifiers (help oil + water blend — no distinct skin benefit)
UPDATE ingredients SET structural_category = 'Emulsifier', category = NULL
WHERE category = 'Emulsifier' AND structural_category IS NULL;

-- Thickeners (increase viscosity — no skin benefit)
UPDATE ingredients SET structural_category = 'Thickener', category = NULL
WHERE category = 'Thickener' AND structural_category IS NULL;

-- Film Formers (form a protective film — no skin benefit)
UPDATE ingredients SET structural_category = 'Film Former', category = NULL
WHERE category = 'Film Former' AND structural_category IS NULL;

-- Surfactants (safe) — skin benefit is cleansing
UPDATE ingredients SET structural_category = 'Surfactant', category = 'cleansing'
WHERE category = 'Surfactant' AND status = 'safe' AND structural_category IS NULL;

-- Waxes (occlusive texture agents — no distinct skin benefit beyond emolliency)
UPDATE ingredients SET structural_category = 'Wax', category = NULL
WHERE category = 'Wax' AND structural_category IS NULL;

-- Pigments
UPDATE ingredients SET structural_category = 'Pigment', category = NULL
WHERE category = 'Pigment' AND structural_category IS NULL;

-- Colorants
UPDATE ingredients SET structural_category = 'Colorant', category = NULL
WHERE category = 'Colorant' AND structural_category IS NULL;

-- pH Adjusters
UPDATE ingredients SET structural_category = 'pH Adjuster', category = NULL
WHERE category = 'pH Adjuster' AND structural_category IS NULL;

-- Conditioning agents (coat/smooth hair and skin surfaces)
UPDATE ingredients SET structural_category = 'Conditioning Agent', category = NULL
WHERE category = 'Conditioning' AND structural_category IS NULL;

-- Safe silicones (smoothing/texture — no specific skin benefit)
UPDATE ingredients SET structural_category = 'Silicone', category = NULL
WHERE category = 'Silicone' AND status = 'safe' AND structural_category IS NULL;

-- Fatty acids (safe) — structural role is emolliency; badge communicates skin benefit
UPDATE ingredients SET structural_category = 'Fatty Acid', category = NULL
WHERE category = 'Fatty Acid' AND status = 'safe' AND structural_category IS NULL;

-- Fatty alcohols (safe) — emollient/co-emulsifier
UPDATE ingredients SET structural_category = 'Fatty Alcohol', category = NULL
WHERE category = 'Fatty Alcohol' AND status = 'safe' AND structural_category IS NULL;

-- Botanical waters / hydrosols
UPDATE ingredients SET structural_category = 'Botanical Water', category = NULL
WHERE category = 'Botanical Water' AND structural_category IS NULL;

-- Trace minerals
UPDATE ingredients SET structural_category = 'Mineral', category = NULL
WHERE category = 'Trace Mineral' AND structural_category IS NULL;

-- Preservative boosters
UPDATE ingredients SET structural_category = 'Preservative Booster', category = NULL
WHERE category = 'Preservative Booster' AND structural_category IS NULL;

-- Emollients (safe) — badge communicates skin benefit; remove redundant category
UPDATE ingredients SET structural_category = 'Emollient', category = NULL
WHERE category IN ('Emollient', 'emollient') AND status = 'safe' AND structural_category IS NULL;

-- Humectants (safe) — badge communicates skin benefit; remove redundant category
UPDATE ingredients SET structural_category = 'Humectant', category = NULL
WHERE category IN ('Humectant', 'humectant') AND status = 'safe' AND structural_category IS NULL;

-- Mineral sunscreen actives (UV filter role; keep Mineral Sunscreen as category)
UPDATE ingredients SET structural_category = 'UV Filter'
WHERE structural_category IS NULL
  AND LOWER(TRIM(name)) IN ('zinc oxide', 'titanium dioxide', 'zinc oxide (nano)', 'titanium dioxide (nano)');


-- ── SECTION B: Plant Extracts — assign skin benefit by name pattern ────────
-- Each step only touches rows still awaiting assignment (structural_category IS NULL).

-- Antioxidant extracts
UPDATE ingredients
SET structural_category = 'Plant Extract', category = 'antioxidant'
WHERE category = 'Plant Extract' AND structural_category IS NULL
  AND (
    LOWER(name) LIKE '%green tea%'     OR LOWER(name) LIKE '%camellia sinensis%'
    OR LOWER(name) LIKE '%white tea%'  OR LOWER(name) LIKE '%black tea%'
    OR LOWER(name) LIKE '%ginkgo%'     OR LOWER(name) LIKE '%grape%seed%'
    OR LOWER(name) LIKE '%pomegranate%' OR LOWER(name) LIKE '%blueberry%'
    OR LOWER(name) LIKE '%cranberry%'  OR LOWER(name) LIKE '%acai%'
    OR LOWER(name) LIKE '%goji%'       OR LOWER(name) LIKE '%coffee%'
    OR LOWER(name) LIKE '%turmeric%'   OR LOWER(name) LIKE '%curcuma%'
    OR LOWER(name) LIKE '%rosehip%'    OR LOWER(name) LIKE '%rose hip%'
    OR LOWER(name) LIKE '%sea buckthorn%' OR LOWER(name) LIKE '%hippophae%'
    OR LOWER(name) LIKE '%moringa%'    OR LOWER(name) LIKE '%baobab%'
    OR LOWER(name) LIKE '%lotus%'      OR LOWER(name) LIKE '%nelumbo%'
    OR LOWER(name) LIKE '%raspberry%'  OR LOWER(name) LIKE '%blackberry%'
    OR LOWER(name) LIKE '%elderberry%' OR LOWER(name) LIKE '%sambucus%'
    OR LOWER(name) LIKE '%argan%'      OR LOWER(name) LIKE '%argania%'
    OR LOWER(name) LIKE '%ecklonia%'   OR LOWER(name) LIKE '%pine bark%'
    OR LOWER(name) LIKE '%pycnogenol%'
  );

-- Soothing extracts
UPDATE ingredients
SET structural_category = 'Plant Extract', category = 'soothing'
WHERE category = 'Plant Extract' AND structural_category IS NULL
  AND (
    LOWER(name) LIKE '%centella%'      OR LOWER(name) LIKE '%madecass%'
    OR LOWER(name) LIKE '%asiaticoside%'
    OR LOWER(name) LIKE '%chamomil%'   OR LOWER(name) LIKE '%matricaria%'
    OR LOWER(name) LIKE '%calendula%'  OR LOWER(name) LIKE '%aloe%'
    OR LOWER(name) LIKE '%licorice%'   OR LOWER(name) LIKE '%glycyrrhiza%'
    OR LOWER(name) LIKE '%bisabolol%'
    OR LOWER(name) LIKE '%cucumber%'   OR LOWER(name) LIKE '%cucumis%'
    OR LOWER(name) LIKE '%oat%'        OR LOWER(name) LIKE '%avena%'
    OR LOWER(name) LIKE '%lavender%'   OR LOWER(name) LIKE '%lavandula%'
    OR LOWER(name) LIKE '%echinacea%'  OR LOWER(name) LIKE '%hypericum%'
    OR LOWER(name) LIKE '%althaea%'    OR LOWER(name) LIKE '%marshmallow%'
    OR LOWER(name) LIKE '%plantago%'   OR LOWER(name) LIKE '%arnica%'
    OR LOWER(name) LIKE '%hamamelis%'  OR LOWER(name) LIKE '%witch hazel%'
    OR LOWER(name) LIKE '%helichrysum%' OR LOWER(name) LIKE '%immortelle%'
    OR LOWER(name) LIKE '%comfrey%'    OR LOWER(name) LIKE '%symphytum%'
    OR LOWER(name) LIKE '%boswellia%'  OR LOWER(name) LIKE '%beta-glucan%'
    OR LOWER(name) LIKE '%willowherb%' OR LOWER(name) LIKE '%epilobium%'
  );

-- Brightening extracts
UPDATE ingredients
SET structural_category = 'Plant Extract', category = 'brightening'
WHERE category = 'Plant Extract' AND structural_category IS NULL
  AND (
    LOWER(name) LIKE '%bearberry%'     OR LOWER(name) LIKE '%arctostaphylos%'
    OR LOWER(name) LIKE '%mulberry%'   OR LOWER(name) LIKE '%morus%'
    OR LOWER(name) LIKE '%papaya%'     OR LOWER(name) LIKE '%carica%'
    OR LOWER(name) LIKE '%pineapple%'  OR LOWER(name) LIKE '%ananas%'
    OR LOWER(name) LIKE '%saxifraga%'  OR LOWER(name) LIKE '%daisy%'
    OR LOWER(name) LIKE '%bellis%'     OR LOWER(name) LIKE '%yuzu%'
    OR LOWER(name) LIKE '%licorice%'   OR LOWER(name) LIKE '%glycyrrhiza%'
  );

-- Firming extracts
UPDATE ingredients
SET structural_category = 'Plant Extract', category = 'firming'
WHERE category = 'Plant Extract' AND structural_category IS NULL
  AND (
    LOWER(name) LIKE '%ginseng%'       OR LOWER(name) LIKE '%panax%'
    OR LOWER(name) LIKE '%caffeine%'   OR LOWER(name) LIKE '%guarana%'
    OR LOWER(name) LIKE '%paullinia%'
    OR LOWER(name) LIKE '%horse chestnut%' OR LOWER(name) LIKE '%aesculus%'
    OR LOWER(name) LIKE '%ivy%'        OR LOWER(name) LIKE '%hedera%'
    OR LOWER(name) LIKE '%algae%'      OR LOWER(name) LIKE '%fucus%'
    OR LOWER(name) LIKE '%spirulina%'  OR LOWER(name) LIKE '%chlorella%'
    OR LOWER(name) LIKE '%seaweed%'    OR LOWER(name) LIKE '%kelp%'
  );

-- Antimicrobial extracts
UPDATE ingredients
SET structural_category = 'Plant Extract', category = 'antimicrobial'
WHERE category = 'Plant Extract' AND structural_category IS NULL
  AND (
    LOWER(name) LIKE '%tea tree%'      OR LOWER(name) LIKE '%melaleuca%'
    OR LOWER(name) LIKE '%neem%'       OR LOWER(name) LIKE '%azadirachta%'
    OR LOWER(name) LIKE '%oregano%'    OR LOWER(name) LIKE '%origanum%'
    OR LOWER(name) LIKE '%thyme%'      OR LOWER(name) LIKE '%thymus%'
    OR LOWER(name) LIKE '%eucalyptus%'
    OR LOWER(name) LIKE '%rosemary%'   OR LOWER(name) LIKE '%rosmarinus%'
    OR LOWER(name) LIKE '%goldenseal%' OR LOWER(name) LIKE '%hydrastis%'
    OR LOWER(name) LIKE '%manuka%'
  );

-- All remaining unassigned plant extracts — default to antioxidant
UPDATE ingredients
SET structural_category = 'Plant Extract', category = 'antioxidant'
WHERE category = 'Plant Extract' AND structural_category IS NULL;


-- ── SECTION C: Add structural_category by name pattern (no category changes) ─

-- Solvents (water, glycols, alcohols)
UPDATE ingredients SET structural_category = 'Solvent'
WHERE structural_category IS NULL
  AND LOWER(TRIM(name)) IN (
    'water', 'aqua', 'aqua (water)', 'water (aqua)', 'purified water',
    'distilled water', 'deionized water', 'spring water',
    'butylene glycol', 'propylene glycol', 'dipropylene glycol',
    'pentylene glycol', 'hexylene glycol', '1,3-butylene glycol',
    '1,3-propanediol', 'propanediol', 'caprylyl glycol',
    'alcohol denat', 'alcohol denat.', 'ethanol', 'sd alcohol 40',
    'isopropyl alcohol', 'denatured alcohol', 'alcohol'
  );

-- Chelating agents (bind metals to stabilize formula)
UPDATE ingredients SET structural_category = 'Chelating Agent'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%edta%'
    OR LOWER(TRIM(name)) IN ('phytic acid', 'sodium phytate', 'trisodium phosphate', 'sodium gluconate')
  );

-- Preservatives — safe
UPDATE ingredients SET structural_category = 'Preservative'
WHERE structural_category IS NULL AND status = 'safe'
  AND LOWER(TRIM(name)) IN (
    'phenoxyethanol', 'sodium benzoate', 'potassium sorbate',
    'ethylhexylglycerin', 'benzyl alcohol',
    'dehydroacetic acid', 'sodium dehydroacetate', 'chlorphenesin',
    'p-anisic acid', 'sodium anisate', '1,2-hexanediol',
    'glyceryl caprylate', 'glyceryl caprate',
    'sorbic acid', 'benzoic acid', 'levulinic acid', 'sodium levulinate',
    'caprylhydroxamic acid', 'polyaminopropyl biguanide'
  );

-- Preservatives — flagged (parabens, isothiazolinones, formaldehyde releasers)
UPDATE ingredients SET structural_category = 'Preservative'
WHERE structural_category IS NULL AND status = 'flagged'
  AND (
    LOWER(name) LIKE '%paraben%'
    OR LOWER(TRIM(name)) IN (
      'methylisothiazolinone', 'methylchloroisothiazolinone',
      'quaternium-15', 'dmdm hydantoin', 'imidazolidinyl urea',
      'diazolidinyl urea', 'triclosan', 'triclocarban',
      'benzophenone-4', 'sodium dehydroacetate'
    )
  );

-- Chemical UV filters (flagged)
UPDATE ingredients SET structural_category = 'UV Filter'
WHERE structural_category IS NULL AND status = 'flagged'
  AND LOWER(TRIM(name)) IN (
    'oxybenzone', 'benzophenone-3', 'octinoxate',
    'ethylhexyl methoxycinnamate', 'octisalate',
    'ethylhexyl salicylate', 'avobenzone',
    'butyl methoxydibenzoylmethane', 'octocrylene', 'homosalate',
    'iscotrizinol', 'drometrizole trisiloxane'
  );

-- Silicones — flagged (not already assigned in section A)
UPDATE ingredients SET structural_category = 'Silicone'
WHERE structural_category IS NULL AND status = 'flagged'
  AND (
    LOWER(name) LIKE '%siloxane%' OR LOWER(name) LIKE '%silicone%'
    OR LOWER(TRIM(name)) IN (
      'dimethicone', 'dimethiconol', 'cyclopentasiloxane',
      'cyclohexasiloxane', 'cyclomethicone', 'trimethylsiloxysilicate'
    )
  );

-- Silicones — safe (amodimethicone etc.)
UPDATE ingredients SET structural_category = 'Silicone'
WHERE structural_category IS NULL AND status = 'safe'
  AND (
    LOWER(name) LIKE '%silicone%' OR LOWER(name) LIKE '%dimethicone%'
    OR LOWER(name) LIKE '%siloxane%'
  );

-- Fragrances and fragrance allergens (already have skin concern category; add structural role)
UPDATE ingredients SET structural_category = 'Fragrance'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN ('parfum', 'fragrance', 'aroma', 'fragrance (parfum)', 'parfum/fragrance')
    OR category IN ('Fragrance', 'fragrance-allergen', 'Fragrance Allergen')
    OR LOWER(name) LIKE '% essential oil'
    OR LOWER(name) LIKE '%essential oil%'
    OR LOWER(TRIM(name)) LIKE '%synthetic musk%'
  );

-- Humectants not already assigned (have skin category 'humectant' from prior migration)
-- Add structural role; leave category as-is since prior migration assigned it correctly
UPDATE ingredients SET structural_category = 'Humectant'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'glycerin', 'glycerine', 'glycerol',
      'sodium hyaluronate', 'hyaluronic acid',
      'sodium pca', 'sodium lactate', 'sorbitol', 'xylitol',
      'trehalose', 'betaine', 'urea', 'erythritol', 'inositol',
      'panthenol', 'd-panthenol', 'polyglutamic acid'
    )
    OR LOWER(name) LIKE '%hyaluronate%'
    OR LOWER(name) LIKE '%hyaluronic%'
  );

-- Emollient oils and esters not already assigned
UPDATE ingredients SET structural_category = 'Emollient'
WHERE structural_category IS NULL AND status = 'safe'
  AND (
    LOWER(name) LIKE '%triglyceride%'
    OR LOWER(name) LIKE '%caprylic%capric%'
    OR (LOWER(name) LIKE '% oil' AND LOWER(name) NOT LIKE '%mineral oil%' AND LOWER(name) NOT LIKE '%essential oil%')
    OR LOWER(TRIM(name)) IN (
      'squalane', 'squalene', 'isononyl isononanoate',
      'c12-15 alkyl benzoate', 'ethylhexyl palmitate',
      'jojoba esters', 'lanolin', 'shea butter'
    )
  );


-- ── SECTION D: Normalize duplicate category spellings ─────────────────────

UPDATE ingredients SET category = 'sensitizer'  WHERE category = 'Sensitizer';
UPDATE ingredients SET category = 'soothing'    WHERE category IN ('Soothing', 'Soothing Agent');
UPDATE ingredients SET category = 'antioxidant' WHERE category = 'Antioxidant';
UPDATE ingredients SET category = 'occlusive'   WHERE category = 'Occlusive';
UPDATE ingredients SET category = 'exfoliant'   WHERE category = 'Exfoliant';
