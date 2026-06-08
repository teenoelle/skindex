export type SkinType =
  | "oily" | "dry" | "reactive" | "damaged_barrier" | "acne_prone"
  | "mature" | "hyperpigmentation_prone" | "fungal_acne" | "rosacea"
  | "seborrheic" | "eczema" | "psoriasis" | "lupus_rash"
  | "keratosis_pilaris" | "body_acne" | "fast_shedding";

export type ClimateType =
  | "humid" | "dry_climate" | "cold" | "hot" | "high_uv"
  | "hard_water" | "chlorinated_water" | "iron_water" | "heavy_metal_water"
  | "red_nir" | "blue_light" | "amber_light" | "vibration_sonic" | "heat_steam" | "microcurrent"
  | "iodine_load" | "phytoestrogen_load" | "anti_androgenic" | "vasodilating_supps"
  | "immune_stimulating" | "insulin_sensitizing" | "anabolic_dht" | "high_dose_b12" | "collagen_support"
  | "high_glycemic" | "dairy_regular" | "gluten_sensitive" | "histamine_foods" | "alcohol_regular"
  | "spicy_foods" | "high_iodine_diet" | "sulfites_diet" | "benzoates_diet" | "nitrites_diet"
  | "bha_bht_diet" | "propionates_diet" | "carmine_diet"
  | "pregnant" | "breastfeeding" | "hormone_sensitive" | "thyroid_condition" | "on_hrt"
  | "perimenopausal" | "menopausal" | "pcos" | "on_testosterone"
  | "smoking";

export const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: "oily", label: "Oily" },
  { value: "dry", label: "Dry" },
  { value: "reactive", label: "Reactive" },
  { value: "damaged_barrier", label: "Damaged barrier" },
  { value: "acne_prone", label: "Acne" },
  { value: "mature", label: "Mature" },
  { value: "hyperpigmentation_prone", label: "Hyperpigmentation" },
  { value: "fungal_acne", label: "Fungal acne" },
  { value: "rosacea", label: "Rosacea" },
  { value: "seborrheic", label: "Seborrheic dermatitis" },
  { value: "eczema", label: "Eczema" },
  { value: "psoriasis", label: "Psoriasis" },
  { value: "lupus_rash", label: "Lupus rash" },
  { value: "keratosis_pilaris", label: "Keratosis pilaris" },
  { value: "body_acne", label: "Body acne" },
  { value: "fast_shedding", label: "Fast-shedding" },
];

export const CLIMATE_TYPES: { value: ClimateType; label: string }[] = [
  { value: "humid", label: "Humid" },
  { value: "dry_climate", label: "Dry" },
  { value: "cold", label: "Cold" },
  { value: "hot", label: "Hot" },
  { value: "high_uv", label: "High UV" },
];

export const WATER_TYPES: { value: ClimateType; label: string }[] = [
  { value: "hard_water", label: "Hard / mineral" },
  { value: "chlorinated_water", label: "Chlorinated" },
  { value: "iron_water", label: "Iron / rust" },
  { value: "heavy_metal_water", label: "Lead / metals" },
];

export const DEVICE_TYPES: { value: ClimateType; label: string }[] = [
  { value: "red_nir", label: "Red / NIR" },
  { value: "blue_light", label: "Blue light" },
  { value: "amber_light", label: "Amber / yellow" },
  { value: "vibration_sonic", label: "Vibration / sonic" },
  { value: "heat_steam", label: "Heat / steam" },
  { value: "microcurrent", label: "Microcurrent" },
];

export const SUPPLEMENT_TYPES: { value: ClimateType; label: string }[] = [
  { value: "iodine_load", label: "Iodine load" },
  { value: "phytoestrogen_load", label: "Phytoestrogen" },
  { value: "anti_androgenic", label: "Anti-androgenic" },
  { value: "vasodilating_supps", label: "Vasodilating" },
  { value: "immune_stimulating", label: "Immune stimulating" },
  { value: "insulin_sensitizing", label: "Insulin sensitizing" },
  { value: "anabolic_dht", label: "Anabolic / DHT" },
  { value: "high_dose_b12", label: "High-dose B12" },
  { value: "collagen_support", label: "Collagen support" },
];

export const DIET_TYPES: { value: ClimateType; label: string }[] = [
  { value: "high_glycemic", label: "High glycemic" },
  { value: "dairy_regular", label: "Dairy" },
  { value: "gluten_sensitive", label: "Gluten" },
  { value: "histamine_foods", label: "Histamine foods" },
  { value: "alcohol_regular", label: "Alcohol" },
  { value: "spicy_foods", label: "Spicy foods" },
  { value: "high_iodine_diet", label: "High-iodine diet" },
  { value: "sulfites_diet", label: "Sulfites" },
  { value: "benzoates_diet", label: "Benzoates" },
  { value: "nitrites_diet", label: "Nitrites / nitrates" },
  { value: "bha_bht_diet", label: "BHT / BHA (food)" },
  { value: "propionates_diet", label: "Propionates" },
  { value: "carmine_diet", label: "Carmine / red dye" },
];

export const HORMONE_TYPES: { value: ClimateType; label: string }[] = [
  { value: "pregnant", label: "Pregnant" },
  { value: "breastfeeding", label: "Breastfeeding" },
  { value: "hormone_sensitive", label: "Hormone-sensitive" },
  { value: "thyroid_condition", label: "Thyroid condition" },
  { value: "on_hrt", label: "On HRT" },
  { value: "perimenopausal", label: "Perimenopausal" },
  { value: "menopausal", label: "Menopausal" },
  { value: "pcos", label: "PCOS" },
  { value: "on_testosterone", label: "On testosterone" },
];

export const LIFESTYLE_TYPES: { value: ClimateType; label: string }[] = [
  { value: "smoking", label: "Smoking / tobacco" },
];

export const ALL_MODIFIER_TYPES = [
  ...CLIMATE_TYPES,
  ...WATER_TYPES,
  ...DEVICE_TYPES,
  ...SUPPLEMENT_TYPES,
  ...DIET_TYPES,
  ...HORMONE_TYPES,
  ...LIFESTYLE_TYPES,
];

export const SKIN_TYPE_NOTES: Record<SkinType, string> = {
  oily: "Oily skin still loses moisture in the minutes after washing. Apply your next product quickly — the itch in that window is what causes barrier damage, not the product itself.",
  dry: "Dry skin has a thinner lipid layer and loses water fastest in cold or dry air — drying solvents, sulfate surfactants, and clay are worth watching closely.",
  reactive: "Reactive skin has a lower tolerance threshold — sensitizers, fragrance allergens, and chemical sunscreens are worth watching closely, especially in warm weather.",
  damaged_barrier: "A compromised barrier lets ingredients penetrate faster and deeper — irritants and sensitizers hit harder and recovery takes longer than it would on intact skin.",
  acne_prone: "For acne skin, pore-clogging ingredients and film-formers are the main risks — watch the Congestion section after scanning.",
  mature: "Mature skin benefits most from peptides, ceramides, and emollients, and is more sensitive to the retinoid adjustment period — start at the lowest available concentration.",
  hyperpigmentation_prone: "For hyperpigmentation-prone skin, UV exposure directly undoes progress — many brightening actives also increase UV sensitivity, making daily SPF essential.",
  fungal_acne: "Fungal acne (Malassezia folliculitis) is caused by yeast, not bacteria — it looks like regular acne but doesn't respond to antibiotics or most OTC acne treatments. Many 'safe' moisturizing oils and fatty acid esters feed Malassezia. Scanning every formula matters more here than for almost any other skin type.",
  rosacea: "Rosacea triggers vary but commonly include heat, vasodilation, and chemical absorption. Chemical UV filters, alcohol-based formulas, menthol, warming agents, and high fragrance load are the main ingredient triggers — mineral sunscreens (zinc oxide, titanium dioxide) are strongly preferred.",
  seborrheic: "Seborrheic dermatitis is driven by Malassezia — a yeast that naturally colonizes everyone's skin and feeds on the fatty acids in sebum. In seborrheic dermatitis, the immune system overreacts to Malassezia's metabolic byproducts, triggering inflammation wherever sebaceous glands are densest.",
  eczema: "Atopic eczema has specific preservative sensitivities. MI/MCI (methylisothiazolinone/methylchloroisothiazolinone) and IPBC are notorious eczema triggers. Ceramides, colloidal oatmeal, and thick emollients are specifically therapeutic here.",
  psoriasis: "Psoriasis causes rapid cell turnover and thick scale. Keratolytics like salicylic acid can help remove scale. Fragrances and harsh surfactants trigger flares.",
  lupus_rash: "The malar (butterfly) rash of lupus is highly photosensitive — UV exposure triggers flares. Chemical UV filters can also cause reactions; mineral-only sunscreens are strongly preferred.",
  keratosis_pilaris: "Keratosis pilaris (the rough, bumpy texture on upper arms and thighs) is caused by keratin plugging follicles. Gentle chemical exfoliants — urea, lactic acid, salicylic acid — dissolve plugs.",
  body_acne: "Body acne is driven by the same pore-clogging and bacterial mechanisms as face acne, but friction and sweat occlusion under clothing are major amplifiers.",
  fast_shedding: "Fast-shedding skin renews quickly — new cells reach the surface before they've fully cornified, leaving them more fragile and sensitive to chemical exfoliants and retinoids.",
};

export const CLIMATE_NOTES: Record<ClimateType, string> = {
  humid: "In humid climates, film-forming and occlusive ingredients are more likely to trap heat and sebum against the skin — lighter formulations are preferable.",
  dry_climate: "In dry climates, humectants need to be sealed in with an emollient or occlusive — without one, they can pull moisture from deeper skin layers instead of the air.",
  cold: "Cold air depletes skin lipids fastest — barrier-repairing ingredients (ceramides, fatty acids, emollients) are most effective and most needed in this climate.",
  hot: "In hot weather, skin permeability increases, making sensitizers and chemical UV filters absorb more readily and triggering stronger reactions.",
  high_uv: "In high-UV environments (UV Index 6+ on the WHO scale — 6–7 is High, 8–10 Very High, 11+ Extreme), daily broad-spectrum SPF is essential — AHAs, retinoids, and many brightening ingredients all increase UV sensitivity.",
  hard_water: "Hard (mineral-rich) water is alkaline (pH 7–9) and leaves a calcium/magnesium film on skin after rinsing. This disrupts the skin's natural acid mantle and is a documented eczema aggravator.",
  chlorinated_water: "Chlorinated tap water can oxidize skin barrier lipids on contact. A vitamin C toner applied immediately after washing neutralizes residual disinfectant before it can damage the barrier.",
  iron_water: "Iron-bearing water introduces ferrous ions that generate free radicals on contact with skin. Chelating agents and antioxidants counteract this.",
  heavy_metal_water: "Lead or heavy metal contamination in tap water — filtering your water or using bottled/filtered water for face washing is the most effective intervention.",
  red_nir: "Red and near-infrared light amplifies collagen-synthesis pathways. Do not apply retinoids, AHAs, or chemical sunscreens immediately before sessions.",
  blue_light: "Blue light targets acne bacteria. Do not combine with benzoyl peroxide in the same session. Not recommended over rosacea-affected skin.",
  amber_light: "Amber and yellow light reduces vascular reactivity — beneficial for rosacea. No retinoids, AHAs, or chemical sunscreens immediately before use.",
  vibration_sonic: "Vibration and sonic tools improve cleanser penetration. Use only during the cleansing step — not after applying actives.",
  heat_steam: "Heat opens the skin barrier. Never apply retinoids, AHAs, or benzoyl peroxide before facial steamers. Strongly contraindicated for rosacea.",
  microcurrent: "Microcurrent requires a water-based conductive medium — silicones and heavy waxes block conductivity.",
  iodine_load: "Iodine-rich supplements (kelp, spirulina) can trigger iodine acne — uniform papular eruptions that don't respond to BP or salicylic acid.",
  phytoestrogen_load: "Phytoestrogen supplements amplify estrogen-sensitive skin responses. Combined with UV exposure, this significantly elevates melasma risk.",
  anti_androgenic: "Anti-androgenic supplements reduce DHT-driven sebum production — directly beneficial for acne-prone, oily, and seborrheic skin.",
  vasodilating_supps: "Vasodilating supplements increase blood flow and can trigger flushing. If rosacea is active, this supplement combination is a likely contributor.",
  immune_stimulating: "Immune-stimulating supplements can trigger flares for autoimmune conditions like lupus or psoriasis.",
  insulin_sensitizing: "Insulin-sensitizing supplements reduce IGF-1-driven sebum production — a meaningful systemic benefit for acne-prone and oily skin.",
  anabolic_dht: "Creatine and similar supplements raise the DHT:testosterone ratio, increasing sebum. A modifiable factor worth testing if acne is active.",
  high_dose_b12: "High-dose vitamin B12 has a documented mechanism for triggering acne by altering porphyrin metabolism.",
  collagen_support: "Collagen-support supplements provide systemic raw materials for the same repair pathways that topical retinoids, peptides, and vitamin C signal.",
  high_glycemic: "A high glycemic index diet raises insulin and IGF-1, directly increasing androgen-driven sebum production.",
  dairy_regular: "Regular dairy intake — particularly skim milk and whey protein — raises serum IGF-1 and is correlated with acne.",
  gluten_sensitive: "Gluten sensitivity is associated with systemic inflammation that can manifest in the skin as eczema flares and psoriasis worsening.",
  histamine_foods: "High-histamine foods trigger histamine-mediated flushing and skin reactivity — particularly relevant for rosacea and reactive skin.",
  alcohol_regular: "Alcohol is a direct vasodilator, a reliable rosacea flush trigger, and impairs the skin barrier repair cycle.",
  spicy_foods: "Capsaicin activates TRPV1 in facial skin — the same receptor that responds to menthol. On rosacea-affected skin this triggers the same flush cycle.",
  high_iodine_diet: "A high-iodine diet (seaweed, shellfish) can contribute to iodine acne through the same mechanism as iodine supplements.",
  sulfites_diet: "Sulfites can trigger flushing and rosacea flares — sulfite sensitivity is an enzyme deficiency. Also associated with eczema flares in atopic skin.",
  benzoates_diet: "Sodium benzoate can trigger urticaria and contact-type reactions, especially in people sensitive to aspirin.",
  nitrites_diet: "Nitrites (processed meats, cured fish) are associated with rosacea flares and acne worsening via systemic inflammatory pathways.",
  bha_bht_diet: "BHT and BHA are antioxidant preservatives in packaged snacks. BHA is a recognized contact allergen — regular oral exposure can worsen topical sensitization.",
  propionates_diet: "Calcium and sodium propionate are associated with eczema flares and urticaria in propionate-sensitive individuals.",
  carmine_diet: "Carmine is a potent allergen — sensitization from dietary carmine can trigger topical reactions to the same ingredient in cosmetics.",
  pregnant: "During pregnancy, retinoids are the highest-risk topical ingredient and should be avoided entirely. Oxybenzone crosses the placental barrier; mineral-only sunscreens are strongly preferred.",
  breastfeeding: "During breastfeeding, retinoids applied to the chest or breast tissue should be avoided. Oxybenzone is excreted in breast milk; mineral sunscreens are preferred.",
  hormone_sensitive: "For hormone-sensitive conditions, phytoestrogens and estrogen-mimicking topical ingredients are a relevant concern. Key: parabens, lavender oil, tea tree oil, soy isoflavones.",
  thyroid_condition: "For thyroid conditions, iodine-containing topical ingredients are worth noting — povidone-iodine, kelp extract, sea algae may affect thyroid function.",
  on_hrt: "For those on HRT, phytoestrogens and estrogen-mimicking topical ingredients can theoretically interact with hormone levels.",
  perimenopausal: "During perimenopause, fluctuating estrogen causes alternating acne and dryness. Phytoestrogens and endocrine-disrupting topicals are relevant.",
  menopausal: "Post-menopausal estrogen decline causes dryness and skin thinning. Topical phytoestrogens are studied as beneficial for this phase — endocrine-disrupting ingredients (parabens, oxybenzone) remain a consideration.",
  pcos: "PCOS elevates androgens, driving sebum, acne, and oiliness. Phytoestrogen and endocrine-disrupting topical ingredients are relevant considerations.",
  on_testosterone: "Exogenous testosterone increases sebum and acne risk via DHT conversion. Phytoestrogen and endocrine-disrupting ingredients are relevant.",
  smoking: "Tobacco smoke depletes skin vitamins C and E, activates metalloproteinases that break down collagen, and impairs microcirculation. Key priorities: antioxidants, peptides, ceramides.",
};

export function climateNoteStyle(c: ClimateType): string {
  const amberSet = new Set<ClimateType>(["heavy_metal_water", "heat_steam", "iodine_load", "immune_stimulating", "anabolic_dht", "high_dose_b12", "smoking"]);
  if (amberSet.has(c)) return "text-amber-800 bg-amber-50 border-amber-200";
  if (DEVICE_TYPES.some(d => d.value === c)) return "text-blue-800 bg-blue-50 border-blue-200";
  if (DIET_TYPES.some(d => d.value === c)) return "text-emerald-800 bg-emerald-50 border-emerald-200";
  if (SUPPLEMENT_TYPES.some(s => s.value === c)) return "text-violet-800 bg-violet-50 border-violet-100";
  if (HORMONE_TYPES.some(h => h.value === c)) return "text-pink-800 bg-pink-50 border-pink-200";
  return "text-gray-600 bg-gray-50 border-gray-100";
}
