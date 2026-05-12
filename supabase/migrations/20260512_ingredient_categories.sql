-- FLAGGED CATEGORIES

UPDATE ingredients SET category = 'sensitizer'
WHERE status = 'flagged' AND LOWER(TRIM(name)) IN (
  'methylisothiazolinone','methylchloroisothiazolinone',
  'cocamidopropyl betaine','quaternium-15','dmdm hydantoin',
  'methylparaben','ethylparaben','propylparaben','butylparaben','isobutylparaben',
  'triclosan','benzophenone-4','sodium dehydroacetate'
);

UPDATE ingredients SET category = 'pore-clogger'
WHERE status = 'flagged' AND LOWER(TRIM(name)) IN (
  'isopropyl myristate','isopropyl palmitate','isopropyl isostearate',
  'coco-caprylate/caprate','cocoa butter','ethylhexyl palmitate',
  'sorbitan oleate','sorbitan laurate','sorbitan stearate','sorbitan palmitate',
  'polysorbate 20','polysorbate 40','polysorbate 80',
  'carrageenan','chondrus crispus','chondrus crispus extract',
  'algae extract','laminaria digitata extract',
  'cyclopentasiloxane','cyclohexasiloxane','cyclomethicone','trimethylsiloxysilicate'
);

UPDATE ingredients SET category = 'occlusive'
WHERE status = 'flagged' AND LOWER(TRIM(name)) IN (
  'dimethicone','petrolatum','mineral oil','lanolin','beeswax','paraffin'
);

UPDATE ingredients SET category = 'stripping'
WHERE status = 'flagged' AND LOWER(TRIM(name)) IN (
  'sodium lauryl sulfate','sodium laureth sulfate',
  'sodium c14-16 olefin sulfonate','ammonium lauryl sulfate','ammonium laureth sulfate'
);

UPDATE ingredients SET category = 'photosensitizer'
WHERE status = 'flagged' AND LOWER(TRIM(name)) IN (
  'retinol','retinyl palmitate','retinyl acetate','retinaldehyde','tretinoin',
  'lactic acid','glycolic acid','mandelic acid','tartaric acid','gluconolactone',
  'arbutin','alpha-arbutin','citral','limonene','bergapten'
);

UPDATE ingredients SET category = 'fragrance-allergen'
WHERE status = 'flagged' AND (
  LOWER(TRIM(name)) IN ('fragrance','parfum','fragrance (parfum)','parfum/fragrance','aroma')
  OR LOWER(name) LIKE '%fragrance allergen%'
  OR LOWER(name) LIKE '%citrus limon%'
  OR LOWER(name) LIKE '%citrus aurantium%'
  OR LOWER(name) LIKE '%lavandula%'
  OR LOWER(name) LIKE '%cananga%'
  OR LOWER(name) LIKE '%linalool%'
  OR LOWER(name) LIKE '%eugenol%'
  OR LOWER(name) LIKE '%geraniol%'
  OR LOWER(name) LIKE '%cinnamal%'
  OR LOWER(name) LIKE '%cinnamyl%'
  OR LOWER(name) LIKE '%coumarin%'
);

-- SAFE CATEGORIES

UPDATE ingredients SET category = 'humectant'
WHERE status = 'safe' AND LOWER(TRIM(name)) IN (
  'glycerin','glycerine','sodium pca','sodium lactate',
  'sorbitol','xylitol','trehalose','betaine',
  'panthenol','d-panthenol','urea','erythritol','inositol'
);
UPDATE ingredients SET category = 'humectant'
WHERE status = 'safe' AND category IS NULL AND (
  LOWER(name) LIKE '%hyaluronate%' OR LOWER(name) LIKE '%hyaluronic acid%'
);

UPDATE ingredients SET category = 'barrier-repairing'
WHERE status = 'safe' AND (
  LOWER(name) LIKE '%ceramide%'
  OR LOWER(TRIM(name)) IN (
    'cholesterol','phytosphingosine','linoleic acid','linolenic acid',
    'fatty acid','sphingolipid','pseudoceramide','glucosylceramide'
  )
);

UPDATE ingredients SET category = 'soothing'
WHERE status = 'safe' AND (
  LOWER(name) LIKE '%centella%' OR LOWER(name) LIKE '%madecass%'
  OR LOWER(name) LIKE '%asiatic%' OR LOWER(name) LIKE '%cica%'
  OR LOWER(TRIM(name)) IN (
    'allantoin','bisabolol','alpha-bisabolol','beta-glucan','oat kernel extract',
    'aloe vera','aloe barbadensis leaf extract','aloe barbadensis leaf juice',
    'dipotassium glycyrrhizate','licorice root extract','glycyrrhiza glabra root extract',
    'chamomilla recutita flower extract','matricaria flower extract',
    'calendula officinalis flower extract'
  )
);

UPDATE ingredients SET category = 'brightening'
WHERE status = 'safe' AND LOWER(TRIM(name)) IN (
  'niacinamide','nicotinamide','tranexamic acid','kojic acid',
  'ascorbic acid','3-o-ethyl ascorbic acid','ascorbyl glucoside',
  'sodium ascorbyl phosphate','magnesium ascorbyl phosphate',
  'ascorbyl palmitate','ascorbyl tetraisopalmitate','alpha arbutin',
  'arbutin','ethyl ascorbic acid'
);

UPDATE ingredients SET category = 'antioxidant'
WHERE status = 'safe' AND LOWER(TRIM(name)) IN (
  'tocopherol','tocopheryl acetate','ubiquinone','coenzyme q10',
  'resveratrol','ferulic acid','superoxide dismutase','bht','bha',
  'epigallocatechin gallate','gallic acid','astaxanthin'
);

UPDATE ingredients SET category = 'firming'
WHERE status = 'safe' AND (
  LOWER(name) LIKE '%peptide%'
  OR LOWER(TRIM(name)) IN (
    'adenosine','argireline','acetyl hexapeptide-3','acetyl tetrapeptide-5',
    'bakuchiol','retinol alternative'
  )
);

UPDATE ingredients SET category = 'emollient'
WHERE status = 'safe' AND category IS NULL AND LOWER(TRIM(name)) IN (
  'squalane','squalene','cetyl alcohol','cetearyl alcohol','stearyl alcohol',
  'behenyl alcohol','jojoba esters','caprylic/capric triglyceride',
  'c12-15 alkyl benzoate','isononyl isononanoate','coconut oil',
  'argan oil','marula oil','rosehip oil','sea buckthorn oil',
  'safflower oil','sunflower seed oil','grape seed oil','hazelnut oil',
  'meadowfoam seed oil','hemp seed oil','baobab oil','macadamia seed oil'
);
