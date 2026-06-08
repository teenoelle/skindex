// Profile key → display labels of safe ingredient categories that are
// specifically beneficial for that profile. Values must match CATEGORY_LABELS
// display values in Scanner.tsx so the UI comparison works directly.
export const PROFILE_BENEFIT_CATS: Partial<Record<string, string[]>> = {
  // Skin types
  acne_prone:              ["Sebum-regulating", "BHA Exfoliant", "Anti-inflammatory"],
  mature:                  ["Retinoid", "Firming", "Cell-communicating", "Humectant"],
  hyperpigmentation_prone: ["Photo-protective", "Brightening", "Antioxidant"],
  damaged_barrier:         ["Barrier-repairing", "Barrier support", "Prebiotic"],
  eczema:                  ["Barrier-repairing", "Soothing", "Anti-inflammatory", "Prebiotic"],
  rosacea:                 ["Soothing", "Anti-inflammatory"],
  fungal_acne:             ["Antifungal"],
  seborrheic:              ["Antifungal", "Sebum-regulating"],
  // Hormonal / health
  menopausal:        ["Humectant", "Emollient", "Barrier-repairing", "Retinoid", "Firming", "Cell-communicating", "Antioxidant", "Skin-replenishing"],
  perimenopausal:    ["Barrier-repairing", "Humectant", "Antioxidant", "Soothing"],
  pcos:              ["Sebum-regulating", "BHA Exfoliant", "Anti-inflammatory", "Antioxidant"],
  on_testosterone:   ["Sebum-regulating", "BHA Exfoliant", "Anti-inflammatory"],
  thyroid_condition: ["Humectant", "Emollient", "Barrier-repairing"],
  // Diet / lifestyle
  smoking:           ["Antioxidant", "Cell-communicating"],
  high_glycemic:     ["Sebum-regulating", "Anti-inflammatory"],
  dairy_regular:     ["Sebum-regulating"],
  // Environmental
  chlorinated_water: ["Antioxidant"],
  iron_water:        ["Chelating", "Antioxidant"],
};

// Which SkinClimateNote field the profile key belongs in.
// SkinType profiles go in "dimensions"; ClimateType profiles go in "climate".
export const PROFILE_NOTE_FIELD: Partial<Record<string, "dimensions" | "climate">> = {
  acne_prone: "dimensions", mature: "dimensions", hyperpigmentation_prone: "dimensions",
  damaged_barrier: "dimensions", eczema: "dimensions", rosacea: "dimensions",
  fungal_acne: "dimensions", seborrheic: "dimensions",
  menopausal: "climate", perimenopausal: "climate", pcos: "climate",
  on_testosterone: "climate", thyroid_condition: "climate",
  smoking: "climate", high_glycemic: "climate", dairy_regular: "climate",
  chlorinated_water: "climate", iron_water: "climate",
};

// Mechanism context injected into the AI prompt so notes are profile-specific.
export const PROFILE_BENEFIT_CONTEXT: Partial<Record<string, string>> = {
  menopausal:        "Post-menopausal estrogen loss reduces ceramide synthesis, collagen production, cell turnover, and moisture retention — skin thins, dries, and loses elasticity.",
  perimenopausal:    "Fluctuating estrogen during perimenopause causes barrier instability, simultaneous dryness and breakouts, and unpredictable sensitivity spikes.",
  pcos:              "PCOS elevates androgens (testosterone/DHT), driving excess sebum, comedonal and inflammatory acne concentrated along the jawline and chin.",
  on_testosterone:   "Exogenous testosterone (TRT or gender-affirming HRT) amplifies DHT conversion, significantly increasing sebum production and acne risk.",
  thyroid_condition: "Hypothyroidism slows cell turnover and reduces moisture-binding capacity, causing pronounced dryness, coarseness, and sluggish barrier repair.",
  smoking:           "Tobacco smoke depletes vitamins C and E, activates metalloproteinases that degrade collagen and elastin, and impairs microcirculation — accelerating photoaging and barrier breakdown.",
  high_glycemic:     "High-glycemic diet raises insulin and IGF-1, amplifying androgen signaling and sebum overproduction — a significant systemic driver of acne.",
  dairy_regular:     "Regular dairy raises IGF-1, a growth factor that amplifies sebum production and comedone formation.",
  acne_prone:        "Acne-prone skin has overactive sebaceous glands, follicular hyperkeratinization, and elevated C. acnes populations leading to comedones and inflammatory lesions.",
  mature:            "Mature skin has reduced collagen synthesis, slower cell turnover, decreased hyaluronic acid production, and a thinner, drier barrier.",
  hyperpigmentation_prone: "Hyperpigmentation-prone skin has overactive or easily triggered melanocytes — excess melanin deposits from UV, inflammation, or hormonal changes.",
  damaged_barrier:   "Damaged barrier skin has impaired tight junction function, increased TEWL, heightened sensitivity to irritants, and slower post-inflammatory recovery.",
  eczema:            "Eczema involves filaggrin deficiency causing barrier defects, Staphylococcus aureus colonization, and Th2-skewed immune activation driving chronic itch-scratch inflammation.",
  rosacea:           "Rosacea involves neurovascular dysregulation, mast cell activation, Demodex overpopulation, and barrier dysfunction causing flushing, persistent redness, and sensitivity.",
  fungal_acne:       "Malassezia folliculitis is caused by Malassezia yeast overgrowth in hair follicles, triggered by certain fatty acids and humid conditions.",
  seborrheic:        "Seborrheic dermatitis involves Malassezia yeast, sebaceous gland overactivity, and immune dysregulation causing oily, scaly, inflamed patches.",
  chlorinated_water: "Chlorinated water generates reactive oxygen species on contact with skin, depleting antioxidant defenses and disrupting the lipid barrier over time.",
  iron_water:        "Iron-rich water causes oxidative stress on contact with skin and can bind to barrier lipids and cleansers, reducing their effectiveness.",
};

// Display label → all raw DB category key variants that map to it.
// Covers both kebab-case (newer AI output) and Title-case (legacy seed).
export const BENEFIT_LABEL_TO_DB_KEYS: Record<string, string[]> = {
  "Humectant":        ["humectant", "Humectant"],
  "Emollient":        ["emollient", "Emollient"],
  "Barrier-repairing":["barrier-repairing"],
  "Barrier support":  ["Barrier support"],
  "Skin-replenishing":["skin-replenishing"],
  "Prebiotic":        ["prebiotic"],
  "Soothing":         ["soothing", "Soothing", "Soothing Agent"],
  "Anti-inflammatory":["Anti-inflammatory"],
  "Antioxidant":      ["antioxidant", "Antioxidant"],
  "Brightening":      ["brightening", "Brightening"],
  "Photo-protective": ["photo-protective"],
  "Firming":          ["firming", "Firming"],
  "Cell-communicating":["cell-communicating"],
  "Retinoid":         ["Retinoid"],
  "Sebum-regulating": ["sebum-regulating"],
  "BHA Exfoliant":    ["BHA Exfoliant"],
  "Antifungal":       ["antifungal"],
  "Chelating":        ["chelating"],
};

const _dbKeyToLabel = new Map<string, string>(
  Object.entries(BENEFIT_LABEL_TO_DB_KEYS).flatMap(([label, keys]) =>
    keys.map((k) => [k, label] as [string, string]),
  ),
);

/** Converts a raw DB category key to its display label. */
export function getCategoryDisplayLabel(rawKey: string): string {
  return _dbKeyToLabel.get(rawKey) ?? rawKey;
}

/** All raw DB category key values that correspond to any benefit category. */
export function getAllBenefitDbKeys(): string[] {
  return [...new Set(Object.values(BENEFIT_LABEL_TO_DB_KEYS).flat())];
}
