import type { BioactiveProfile } from "@/types";
import type { SkinNote } from "./curated-explanation";

export type { BioactiveProfile };

// Maps a bioactive primary/secondary action to the ingredient category field value.
// These align with the existing CATEGORY_LABELS in Scanner.tsx.
const ACTION_TO_CATEGORY: Record<string, string> = {
  "antioxidant":       "antioxidant",
  "soothing":          "soothing",
  "brightening":       "brightening",
  "firming":           "firming",
  "barrier-repairing": "barrier-repairing",
  "antimicrobial":     "antimicrobial",
  "anti-malassezia":   "anti-malassezia",
  "wound-healing":     "wound-healing",
  "anti-inflammatory": "soothing",   // maps to "soothing" category for UI; mechanism noted in explanation
};

export type BioactiveClassification = {
  status?: "flagged";           // only present when sensitization_risk = "high"
  flagged_category?: "sensitizer"; // only present when status = "flagged"
  category: string | null;
  secondary_benefit_categories: string[];
};

/**
 * Returns the enriched classification for a Plant Extract based on its
 * bioactive profile. Returns a safe classification with null profile
 * when no profile is available.
 *
 * High sensitization risk triggers a reclassification to flagged/sensitizer.
 */
export function getBioactiveCategories(
  profile: BioactiveProfile | null,
): BioactiveClassification {
  if (!profile) {
    return { category: null, secondary_benefit_categories: [] };
  }

  if (profile.sensitization_risk === "high") {
    return {
      status: "flagged",
      flagged_category: "sensitizer",
      category: null,
      secondary_benefit_categories: [],
    };
  }

  const category = ACTION_TO_CATEGORY[profile.primary_action] ?? null;
  const secondary_benefit_categories = (profile.secondary_actions ?? [])
    .map(a => ACTION_TO_CATEGORY[a])
    .filter((c): c is string => !!c && c !== category);

  return { category, secondary_benefit_categories };
}

/**
 * Generates skin_climate_notes for a Plant Extract based on its bioactive profile.
 * Only produces notes for moderate sensitization risk — everything else is handled
 * by generateNotes() in curated-explanation.ts after the category is updated.
 */
export function generateBioactiveNotes(
  profile: BioactiveProfile | null,
): SkinNote[] {
  if (!profile) return [];

  const notes: SkinNote[] = [];

  if (profile.sensitization_risk === "moderate") {
    notes.push({
      dimensions: ["reactive", "damaged_barrier"],
      climate: [],
      sentiment: "caution",
      text: "This extract has mild sensitization potential in some individuals. On reactive or barrier-compromised skin, consider patch-testing before full-face application.",
    });
  }

  return notes;
}
