import type { FattyAcidProfile } from "@/types";
import type { SkinNote } from "./curated-explanation";

export type { FattyAcidProfile };

// Matches cold-pressed, cold pressed, unrefined, virgin, extra virgin, extra-virgin
export const QUALITY_DESCRIPTOR = /\b(cold[\s-]?pressed|unrefined|virgin|extra[\s-]?virgin)\b/i;

/**
 * Returns the enriched category and secondary_benefit_categories for a plant oil
 * based on its fatty acid profile and whether a quality descriptor is in the name.
 *
 * Category logic:
 *   - Quality descriptor + high EFA (linoleic >40, ALA >20, or GLA >10) → barrier-repairing
 *   - Quality descriptor + high oleic (>40) with moderate linoleic → antioxidant
 *   - Quality descriptor + high palmitoleic (>15) with neither EFA nor oleic dominant → barrier-repairing
 *   - No quality descriptor, or unrecognised profile → Moisturizing
 *
 * Secondary categories capture a meaningful secondary profile (e.g. argan: oleic-dominant
 * but 36% linoleic earns a secondary barrier-repairing alongside primary antioxidant).
 */
export function getOilCategories(
  name: string,
  profile: FattyAcidProfile,
): { category: string; secondary_benefit_categories: string[] } {
  if (!QUALITY_DESCRIPTOR.test(name)) {
    return { category: "Moisturizing", secondary_benefit_categories: [] };
  }

  const la = profile.linoleic ?? 0;
  const oa = profile.oleic ?? 0;
  const ala = profile.alpha_linolenic ?? 0;
  const gla = profile.gamma_linolenic ?? 0;
  const pa = profile.palmitoleic ?? 0;

  const highEfa = la > 40 || ala > 20 || gla > 10;
  const highOleic = oa > 40;
  const highPalmitoleic = pa > 15;

  if (highEfa) {
    const secondary = highOleic ? ["antioxidant"] : [];
    return { category: "barrier-repairing", secondary_benefit_categories: secondary };
  }

  if (highOleic) {
    // Oils with meaningful linoleic alongside high oleic earn a secondary barrier note
    const secondary = la >= 20 ? ["barrier-repairing"] : [];
    return { category: "antioxidant", secondary_benefit_categories: secondary };
  }

  if (highPalmitoleic) {
    return { category: "barrier-repairing", secondary_benefit_categories: [] };
  }

  return { category: "Moisturizing", secondary_benefit_categories: [] };
}

/**
 * Generates skin_climate_notes for a plant oil from its fatty acid profile.
 *
 * Concern thresholds (B+C hybrid, leave-on only — callers are responsible for rinse-off suppression):
 *   Tier 1: oleic >40 AND linoleic <20  → caution for acne_prone, reactive, fungal_acne, seborrheic
 *   Tier 2: oleic >40 AND linoleic 20–40 → caution for acne_prone, fungal_acne only
 *   Lauric: lauric >40                  → caution for acne_prone, fungal_acne
 *
 * Benefit notes:
 *   Quality descriptor + high EFA        → benefit for damaged_barrier, acne_prone, reactive, eczema, psoriasis
 *   Palmitoleic >15                       → benefit for damaged_barrier, rosacea, eczema
 */
export function generateFattyAcidNotes(
  name: string,
  profile: FattyAcidProfile,
): SkinNote[] {
  const notes: SkinNote[] = [];
  const la = profile.linoleic ?? 0;
  const oa = profile.oleic ?? 0;
  const ala = profile.alpha_linolenic ?? 0;
  const gla = profile.gamma_linolenic ?? 0;
  const pa = profile.palmitoleic ?? 0;
  const lau = profile.lauric ?? 0;

  // ── Occlusive / pore-clogger concern ──────────────────────────────────────

  if (oa > 40 && la < 20) {
    // Tier 1: strongly linoleic-deficient, oleic-dominant
    notes.push({
      dimensions: ["acne_prone", "reactive", "fungal_acne", "seborrheic"],
      climate: [],
      sentiment: "caution",
      text: `This oil is oleic-dominant (~${Math.round(oa)}% oleic) with low linoleic acid (~${Math.round(la)}%). In leave-on products, oleic-dominant oils can disrupt the linoleic:oleic balance in follicular sebum — a known contributor to closed comedones on reactive and congestion-prone skin.`,
      concern: "occlusive",
    });
  } else if (oa > 40 && la >= 20 && la < 40) {
    // Tier 2: moderately linoleic-deficient — concern for most sensitive profiles only
    notes.push({
      dimensions: ["acne_prone", "fungal_acne"],
      climate: [],
      sentiment: "caution",
      text: `This oil has elevated oleic acid (~${Math.round(oa)}%) alongside moderate linoleic acid (~${Math.round(la)}%). For congestion-prone skin, the oleic content may contribute to closed comedones in leave-on products, though the linoleic presence partially offsets the risk.`,
      concern: "occlusive",
    });
  }

  // ── Lauric concern ────────────────────────────────────────────────────────
  if (lau > 40) {
    notes.push({
      dimensions: ["acne_prone", "fungal_acne"],
      climate: [],
      sentiment: "caution",
      text: `This oil is high in lauric acid (~${Math.round(lau)}%). Despite lauric acid's antimicrobial properties, it is comedogenic at high concentrations and may contribute to clogged pores in leave-on products for congestion-prone skin.`,
      concern: "pore-clogger",
    });
  }

  // ── Barrier-repairing benefit (quality oils only) ─────────────────────────
  const highEfa = la > 40 || ala > 20 || gla > 10;
  if (highEfa && QUALITY_DESCRIPTOR.test(name)) {
    const efaDescription =
      la > 40 ? `linoleic acid (~${Math.round(la)}%)`
      : ala > 20 ? `alpha-linolenic acid (~${Math.round(ala)}%)`
      : `gamma-linolenic acid (~${Math.round(gla)}%)`;
    notes.push({
      dimensions: ["damaged_barrier", "acne_prone", "reactive", "eczema", "psoriasis"],
      climate: [],
      sentiment: "benefit",
      text: `Cold-pressed and unrefined, this oil retains its essential fatty acid content — rich in ${efaDescription}. EFA-rich oils help restore the barrier by replenishing the fatty acids that are deficient in compromised and congestion-prone skin.`,
    });
  }

  // ── Palmitoleic benefit ───────────────────────────────────────────────────
  if (pa > 15) {
    notes.push({
      dimensions: ["damaged_barrier", "rosacea", "eczema"],
      climate: [],
      sentiment: "benefit",
      text: `Rich in palmitoleic acid (~${Math.round(pa)}%), an omega-7 fatty acid naturally present in human sebum. Palmitoleic acid supports wound healing and has antimicrobial properties, making this oil particularly suited to sensitive and barrier-compromised skin.`,
    });
  }

  return notes;
}
