-- ============================================================
-- STRUCTURAL CATEGORIES MIGRATION 2
-- Covers the ~290 ingredients still missing structural_category.
-- All statements guard with WHERE structural_category IS NULL.
-- ============================================================


-- ── SECTION A: Actives ─────────────────────────────────────────────────────

-- Peptides (signaling proteins / collagen boosters)
UPDATE ingredients SET structural_category = 'Peptide'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%peptide%'
    OR LOWER(name) LIKE '%palmitoyl%'
    OR LOWER(name) LIKE '%polypeptide%'
    OR LOWER(name) LIKE '%oligopeptide%'
    OR LOWER(name) LIKE '%sh-oligopeptide%'
    OR LOWER(name) LIKE '%sh-polypeptide%'
    OR LOWER(name) LIKE '%myristoyl%pentapeptide%'
  );

-- Ceramides and sphingolipids (barrier-repairing lipids)
UPDATE ingredients SET structural_category = 'Ceramide'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%ceramide%'
    OR LOWER(TRIM(name)) IN (
      'phytosphingosine', 'sphingosine', 'sphinganine',
      'pseudoceramide', 'glucosylceramide'
    )
  );

-- Retinoids (vitamin A derivatives)
UPDATE ingredients SET structural_category = 'Retinoid'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%retinol%'
    OR LOWER(name) LIKE '%retinal%'
    OR LOWER(name) LIKE '%retinoic%'
    OR LOWER(name) LIKE '%retinyl%'
    OR LOWER(name) LIKE '%tretinoin%'
    OR LOWER(TRIM(name)) = 'bakuchiol'
  );

-- Exfoliant actives (AHAs, BHAs, PHAs)
UPDATE ingredients SET structural_category = 'Exfoliant'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'glycolic acid', 'lactic acid', 'mandelic acid', 'malic acid',
      'tartaric acid', 'citric acid', 'gluconolactone', 'lactobionic acid',
      'salicylic acid', 'glucono-delta-lactone', 'azelaic acid',
      'polyhydroxy acid', 'willow bark extract', 'papain', 'bromelain'
    )
    OR LOWER(name) LIKE '%glycolic acid%'
    OR LOWER(name) LIKE '%lactic acid%'
    OR LOWER(name) LIKE '%salicylic acid%'
    OR LOWER(name) LIKE '%mandelic acid%'
    OR LOWER(name) LIKE '%gluconolactone%'
    OR LOWER(name) LIKE '%lactobionic%'
    OR LOWER(name) LIKE '%azelaic%'
  );

-- Vitamin C and brightening actives
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'ascorbic acid', 'vitamin c', 'sodium ascorbyl phosphate',
      'magnesium ascorbyl phosphate', 'ascorbyl glucoside',
      'ascorbyl tetraisopalmitate', '3-o-ethyl ascorbic acid',
      'ethyl ascorbic acid', 'calcium ascorbate'
    )
    OR LOWER(name) LIKE '%ascorbic acid%'
    OR LOWER(name) LIKE '%ascorbyl%'
  );

-- Niacinamide and vitamin B actives
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND LOWER(TRIM(name)) IN (
    'niacinamide', 'nicotinamide', 'nicotinic acid',
    'biotin', 'pyridoxine', 'riboflavin', 'thiamine'
  );

-- Brightening / skin-tone actives
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'alpha-arbutin', 'arbutin', 'beta-arbutin',
      'tranexamic acid', 'kojic acid',
      'phytic acid'  -- if not already caught as chelating agent above
    )
    OR LOWER(name) LIKE '%arbutin%'
    OR LOWER(name) LIKE '%tranexamic%'
  );

-- Antioxidant actives (tocopherol family, ferulic, coQ10)
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'tocopherol', 'tocopheryl acetate', 'alpha-tocopherol',
      'dl-alpha-tocopherol', 'vitamin e',
      'ferulic acid',
      'resveratrol', 'idebenone',
      'coenzyme q10', 'ubiquinone',
      'astaxanthin', 'lutein', 'lycopene'
    )
    OR LOWER(name) LIKE '%tocopherol%'
    OR LOWER(name) LIKE '%ferulic acid%'
  );

-- Zinc actives (sebum control, antimicrobial)
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'zinc gluconate', 'zinc sulfate', 'zinc acetate', 'zinc pca',
      'zinc chloride', 'zinc stearate'
    )
    OR (LOWER(name) LIKE '%zinc%' AND LOWER(name) NOT LIKE '%zinc oxide%')
  );

-- Probiotic / ferment actives
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%probiotic%'
    OR LOWER(name) LIKE '%lactobacillus%'
    OR LOWER(name) LIKE '%bifida%'
    OR LOWER(name) LIKE '%galactomyces%'
    OR LOWER(name) LIKE '%saccharomyces%'
  );


-- ── SECTION B: Proteins ────────────────────────────────────────────────────

UPDATE ingredients SET structural_category = 'Protein'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%hydrolyzed%'
    OR LOWER(name) LIKE '%collagen%'
    OR LOWER(name) LIKE '%keratin%'
    OR LOWER(name) LIKE '%elastin%'
    OR (LOWER(name) LIKE '%silk%' AND (LOWER(name) LIKE '%protein%' OR LOWER(name) LIKE '%amino%'))
  );

-- Amino acids (skin-identical NMF components)
UPDATE ingredients SET structural_category = 'Amino Acid'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'arginine', 'lysine', 'serine', 'glycine', 'alanine', 'proline',
      'threonine', 'histidine', 'valine', 'leucine', 'isoleucine',
      'methionine', 'cysteine', 'tyrosine', 'phenylalanine', 'tryptophan',
      'aspartic acid', 'glutamic acid', 'asparagine', 'glutamine',
      'acetyl glucosamine', 'glucosamine'
    )
    OR LOWER(name) LIKE '% amino acid'
    OR LOWER(name) LIKE '%amino acids%'
  );


-- ── SECTION C: Texture and Formulation Agents ─────────────────────────────

-- Thickeners: gums, carbomers, celluloses, starches, silica
UPDATE ingredients SET structural_category = 'Thickener'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'xanthan gum', 'carbomer', 'hydroxyethylcellulose',
      'hydroxypropyl methylcellulose', 'hydroxypropyl cellulose',
      'sodium carboxymethylcellulose', 'carboxymethylcellulose',
      'microcrystalline cellulose', 'cellulose',
      'guar gum', 'locust bean gum', 'carrageenan',
      'gelatin', 'pectin', 'agar', 'sodium alginate',
      'silica', 'fumed silica', 'hydrated silica',
      'polyacrylate crosspolymer-6',
      'acrylates/c10-30 alkyl acrylate crosspolymer',
      'hydrogenated styrene/isoprene copolymer'
    )
    OR LOWER(name) LIKE '%carbomer%'
    OR LOWER(name) LIKE '%xanthan%'
    OR LOWER(name) LIKE '% gum'
    OR LOWER(name) LIKE '%cellulose%'
    OR LOWER(name) LIKE '%acrylate%copolymer%'
    OR LOWER(name) LIKE '%starch%'
    OR (LOWER(name) LIKE '%silica%' AND LOWER(name) NOT LIKE '%silicone%')
  );

-- Surfactants not caught in migration 1 (mild cleansers: glucosides, betaines)
UPDATE ingredients SET structural_category = 'Surfactant', category = 'cleansing'
WHERE structural_category IS NULL AND status = 'safe'
  AND (
    LOWER(name) LIKE '%glucoside%'
    OR LOWER(name) LIKE '%betaine%'
    OR LOWER(name) LIKE '%sulfosuccinate%'
    OR LOWER(name) LIKE '%amphoacetate%'
    OR LOWER(name) LIKE '%amphodiacetate%'
    OR LOWER(TRIM(name)) IN (
      'sodium cocoyl isethionate', 'sodium lauroyl isethionate',
      'sodium lauroyl sarcosinate', 'disodium lauryl sulfosuccinate',
      'cocamidopropyl betaine', 'lauryl betaine',
      'sodium cocoamphoacetate', 'disodium cocoamphodiacetate',
      'sodium lauryl glucose carboxylate'
    )
  );

-- Flagged surfactants (sulfates) not caught in migration 1
UPDATE ingredients SET structural_category = 'Surfactant'
WHERE structural_category IS NULL AND status = 'flagged'
  AND (
    LOWER(name) LIKE '%sulfate%'
    OR LOWER(name) LIKE '%sulfonate%'
  );

-- Clays and absorbents
UPDATE ingredients SET structural_category = 'Clay'
WHERE structural_category IS NULL
  AND (
    LOWER(TRIM(name)) IN (
      'kaolin', 'bentonite', 'montmorillonite', 'illite', 'smectite',
      'zeolite', 'fullers earth', 'calcium bentonite',
      'french green clay', 'white kaolin clay', 'pink clay'
    )
    OR LOWER(name) LIKE '%kaolin%'
    OR LOWER(name) LIKE '%bentonite%'
    OR LOWER(name) LIKE '%montmorillonite%'
    OR LOWER(name) LIKE '%zeolite%'
    OR (LOWER(name) LIKE '% clay' AND LOWER(name) NOT LIKE '%claymation%')
  );


-- ── SECTION D: Emollients not caught in migration 1 ───────────────────────

-- Butters (safe)
UPDATE ingredients SET structural_category = 'Emollient'
WHERE structural_category IS NULL AND status = 'safe'
  AND LOWER(name) LIKE '%butter%';

-- Butters (flagged)
UPDATE ingredients SET structural_category = 'Emollient'
WHERE structural_category IS NULL AND status = 'flagged'
  AND LOWER(name) LIKE '%butter%';

-- Mineral oil, petrolatum, and heavy occlusives
UPDATE ingredients SET structural_category = 'Emollient'
WHERE structural_category IS NULL
  AND LOWER(TRIM(name)) IN (
    'mineral oil', 'petrolatum', 'white petrolatum',
    'paraffin', 'isopropyl myristate', 'isopropyl palmitate',
    'isopropyl stearate', 'isopropyl isostearate',
    'c12-15 alkyl benzoate', 'ethylhexyl palmitate',
    'diisopropyl adipate', 'dimethyl isosorbide',
    'octyldodecanol', 'hexyldecanol', 'isohexadecane',
    'isododecane', 'isoeicosane', 'polyisobutene',
    'hydrogenated polyisobutene'
  );

-- Esters not caught by migration 1 oil/triglyceride patterns
UPDATE ingredients SET structural_category = 'Emollient'
WHERE structural_category IS NULL AND status = 'safe'
  AND (
    LOWER(name) LIKE '%myristate%'
    OR LOWER(name) LIKE '%palmitate%'
    OR LOWER(name) LIKE '%stearate%'
    OR LOWER(name) LIKE '%behenate%'
    OR LOWER(name) LIKE '%isostearate%'
    OR LOWER(name) LIKE '%adipate%'
    OR LOWER(name) LIKE '%octanoate%'
    OR LOWER(name) LIKE '%decanoate%'
  );


-- ── SECTION E: Remaining Humectants ────────────────────────────────────────

UPDATE ingredients SET structural_category = 'Humectant'
WHERE structural_category IS NULL
  AND LOWER(TRIM(name)) IN (
    'propanediol', '1,3-propanediol',
    'dipropylene glycol', 'hexylene glycol',
    'methyl gluceth-20', 'peg-400', 'peg-8',
    'aloe vera gel', 'aloe barbadensis leaf juice'
  );

-- Polyglyceryl emulsifiers (not yet assigned)
UPDATE ingredients SET structural_category = 'Emulsifier'
WHERE structural_category IS NULL
  AND (
    LOWER(name) LIKE '%polyglyceryl%'
    OR LOWER(name) LIKE '%glyceryl stearate%'
    OR LOWER(name) LIKE '%sorbitan%'
    OR LOWER(name) LIKE '%polysorbate%'
    OR LOWER(name) LIKE '%lecithin%'
    OR LOWER(name) LIKE '%peg-%stearate%'
    OR LOWER(name) LIKE '%ceteareth%'
    OR LOWER(name) LIKE '%oleth%'
    OR LOWER(name) LIKE '%laureth%'
    OR LOWER(name) LIKE '%steareth%'
  );

-- Ferment filtrates not caught by Active rules (contain 'ferment' but not 'filtrate' pattern above)
UPDATE ingredients SET structural_category = 'Active'
WHERE structural_category IS NULL
  AND LOWER(name) LIKE '%ferment%';
