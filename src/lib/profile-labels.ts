import type { SkinClimateNote } from "@/types";

export const SKIN_LABEL: Record<string, string> = {
  oily: "Oily",
  dry: "Dry",
  reactive: "Reactive",
  damaged_barrier: "Damaged barrier",
  acne_prone: "Acne",
  mature: "Mature",
  hyperpigmentation_prone: "Hyperpigmentation",
  fungal_acne: "Fungal acne",
  rosacea: "Rosacea",
  seborrheic: "Seborrheic dermatitis",
  eczema: "Eczema",
  psoriasis: "Psoriasis",
  lupus_rash: "Lupus rash",
  keratosis_pilaris: "Keratosis pilaris",
  body_acne: "Body acne",
  fast_shedding: "Fast-shedding",
};

export const CLIMATE_LABEL: Record<string, string> = {
  humid: "Humid",
  dry_climate: "Dry",
  cold: "Cold",
  hot: "Hot",
  high_uv: "High UV",
  hard_water: "Hard / mineral",
  chlorinated_water: "Chlorinated",
  iron_water: "Iron / rust",
  heavy_metal_water: "Lead / metals",
  red_nir: "Red / NIR",
  blue_light: "Blue light",
  amber_light: "Amber / yellow",
  vibration_sonic: "Vibration / sonic",
  heat_steam: "Heat / steam",
  microcurrent: "Microcurrent",
  iodine_load: "Iodine load",
  phytoestrogen_load: "Phytoestrogen",
  anti_androgenic: "Anti-androgenic",
  vasodilating_supps: "Vasodilating",
  immune_stimulating: "Immune stimulating",
  insulin_sensitizing: "Insulin sensitizing",
  anabolic_dht: "Anabolic / DHT",
  high_dose_b12: "High-dose B12",
  collagen_support: "Collagen support",
  high_glycemic: "High glycemic",
  dairy_regular: "Dairy",
  gluten_sensitive: "Gluten",
  histamine_foods: "Histamine foods",
  alcohol_regular: "Alcohol",
  spicy_foods: "Spicy foods",
  high_iodine_diet: "High-iodine diet",
  sulfites_diet: "Sulfites",
  benzoates_diet: "Benzoates",
  nitrites_diet: "Nitrites / nitrates",
  bha_bht_diet: "BHT / BHA (food)",
  propionates_diet: "Propionates",
  carmine_diet: "Carmine / red dye",
  pregnant: "Pregnant",
  breastfeeding: "Breastfeeding",
  hormone_sensitive: "Hormone-sensitive",
  thyroid_condition: "Thyroid condition",
  on_hrt: "On HRT",
  smoking: "Smoking / tobacco",
};

function labelsFromNote(note: SkinClimateNote): string[] {
  return [
    ...(note.dimensions ?? []).map((d) => SKIN_LABEL[d]).filter((l): l is string => Boolean(l)),
    ...(note.climate ?? []).map((c) => CLIMATE_LABEL[c]).filter((l): l is string => Boolean(l)),
  ];
}

/**
 * Derives benefit_profiles and concern_profiles from skin_climate_notes.
 *
 * benefit_profiles  — union of all labels from benefit-sentiment notes.
 * concern_profiles  — union of labels from caution/strong_caution notes whose
 *                     `concern` field matches flaggedCategory (case-insensitive).
 */
export function profilesFromNotes(
  notes: SkinClimateNote[],
  flaggedCategory?: string | null,
): { benefit_profiles: string[] | null; concern_profiles: string[] | null } {
  const benefit = new Set<string>();
  const concern = new Set<string>();
  const fcLower = flaggedCategory?.toLowerCase() ?? "";

  for (const note of notes) {
    const labels = labelsFromNote(note);
    if (note.sentiment === "benefit") {
      labels.forEach((l) => benefit.add(l));
    } else if ((note.sentiment === "caution" || note.sentiment === "strong_caution") && fcLower) {
      if (note.concern?.toLowerCase() === fcLower) labels.forEach((l) => concern.add(l));
    }
  }

  return {
    benefit_profiles: benefit.size > 0 ? [...benefit] : null,
    concern_profiles: concern.size > 0 ? [...concern] : null,
  };
}

// Reverse map: lowercase label → canonical label from our label tables
const CANONICAL_LABEL = new Map<string, string>(
  [...Object.values(SKIN_LABEL), ...Object.values(CLIMATE_LABEL)].map((l) => [l.toLowerCase(), l]),
);

/**
 * Returns the canonical form of a profile label (as defined in SKIN_LABEL / CLIMATE_LABEL).
 * Falls back to the input string unchanged if no canonical form is found.
 */
export function canonicalizeProfileLabel(label: string): string {
  return CANONICAL_LABEL.get(label.toLowerCase()) ?? label;
}

/**
 * Union-merges derived profiles into existing ones, preserving manually-set values.
 * Existing labels are canonicalized before merging to fix any capitalization drift.
 * Returns null only when the result is empty.
 */
export function mergeProfileLabels(
  existing: string[] | null | undefined,
  derived: string[] | null | undefined,
): string[] | null {
  // Canonicalize existing first so e.g. "Damaged Barrier" → "Damaged barrier"
  const result = (existing ?? []).map(canonicalizeProfileLabel);
  for (const p of derived ?? []) {
    if (!result.includes(p)) result.push(p);
  }
  return result.length > 0 ? result : null;
}
