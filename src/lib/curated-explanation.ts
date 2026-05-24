import { SENSORY_PATTERNS } from "./sensory";

export type Sentiment = "strong_caution" | "caution" | "benefit" | "neutral";

export type SkinNote = {
  dimensions: string[];
  climate: string[];
  sentiment: Sentiment;
  text: string;
};

export type IngredientContext = {
  name: string;
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

export function getSensoryCategories(name: string): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const rule of SENSORY_PATTERNS) {
    if (rule.pattern.test(name) && !seen.has(rule.sensory_category)) {
      seen.add(rule.sensory_category);
      categories.push(rule.sensory_category);
    }
  }
  return categories;
}

export function generateNotes(ing: {
  status: string;
  flagged_category: string | null;
  category: string | null;
  structural_category: string | null;
}): SkinNote[] {
  const notes: SkinNote[] = [];
  const fc = (ing.flagged_category ?? "").toLowerCase();
  const cat = (ing.category ?? "").toLowerCase();
  const sc = ing.structural_category ?? "";

  // ── FLAGGED CATEGORIES ─────────────────────────────────────────────────────

  if (fc === "occlusive") {
    notes.push({
      dimensions: ["oily", "acne_prone"],
      climate: ["hot", "humid"],
      sentiment: "strong_caution",
      text: "Heavy occlusion traps excess sebum and heat against the skin — significantly worse in hot or humid weather when oil production is already elevated.",
    });
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["cold"],
      sentiment: "neutral",
      text: "For dry or barrier-compromised skin in cold conditions, occlusives offer some protection — but lighter barrier ingredients (ceramides, fatty acids) deliver similar defense without the congestion risk.",
    });
  }

  if (fc === "sensitizer" || fc === "fragrance-allergen") {
    notes.push({
      dimensions: ["reactive", "damaged_barrier"],
      climate: [],
      sentiment: "strong_caution",
      text: "On reactive or compromised skin, contact sensitizers have a lower trigger threshold — reactions can occur faster and at lower concentrations when the barrier is disrupted.",
    });
    notes.push({
      dimensions: [],
      climate: ["hot"],
      sentiment: "caution",
      text: "Warm weather increases skin permeability and absorption, which can amplify sensitizer-triggered reactions even on normally tolerant skin.",
    });
  }

  if (fc === "aha exfoliant") {
    notes.push({
      dimensions: [],
      climate: ["high_uv"],
      sentiment: "strong_caution",
      text: "AHA exfoliants thin the outermost skin layer, significantly increasing UV sensitivity. Daily broad-spectrum SPF is essential when using these.",
    });
    notes.push({
      dimensions: ["reactive", "damaged_barrier"],
      climate: [],
      sentiment: "caution",
      text: "On reactive or compromised skin, AHAs penetrate more deeply and intensify irritation — start at the lowest available percentage and limit frequency.",
    });
  }

  if (fc === "drying solvent") {
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["cold", "dry_climate"],
      sentiment: "strong_caution",
      text: "Drying solvents strip skin lipids — particularly damaging in cold or dry air when the barrier is already under environmental stress and recovery is slowest.",
    });
  }

  if (fc === "sulfate surfactant") {
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["cold", "dry_climate"],
      sentiment: "strong_caution",
      text: "Sulfate surfactants remove the skin's protective lipid film — especially damaging in cold or dry conditions where the barrier needs that film most and takes longest to rebuild.",
    });
    notes.push({
      dimensions: [],
      climate: [],
      sentiment: "neutral",
      text: "After rinsing, the skin's surface film is temporarily gone. Apply your next product promptly — the tight feeling is the post-wash window when barrier disruption is highest.",
    });
  }

  if (fc === "chemical sunscreen") {
    notes.push({
      dimensions: ["reactive"],
      climate: ["hot", "high_uv"],
      sentiment: "caution",
      text: "Chemical UV filters absorb into skin and convert UV energy to heat — the resulting skin warmth can amplify reactivity in already-sensitized skin.",
    });
  }

  if (fc === "barrier-disrupting") {
    notes.push({
      dimensions: ["damaged_barrier", "reactive"],
      climate: ["cold", "dry_climate"],
      sentiment: "strong_caution",
      text: "Barrier-disrupting ingredients compound damage from cold or dry environments, where TEWL (water loss through skin) is already elevated.",
    });
  }

  // ── STRUCTURAL CATEGORIES ──────────────────────────────────────────────────

  if (sc === "Retinoid") {
    notes.push({
      dimensions: [],
      climate: ["high_uv"],
      sentiment: "strong_caution",
      text: "Retinoids increase cell turnover and UV sensitivity simultaneously — strict daily SPF is essential, and evening-only use is strongly recommended.",
    });
    notes.push({
      dimensions: ["reactive", "damaged_barrier"],
      climate: [],
      sentiment: "caution",
      text: "On reactive or barrier-compromised skin, retinoids cause a pronounced adjustment period of redness, peeling, and stinging — start at the lowest available concentration.",
    });
    notes.push({
      dimensions: ["dry"],
      climate: ["cold"],
      sentiment: "caution",
      text: "In cold, dry conditions, retinoid use can tip already-dry skin into significant peeling — buffer with a barrier-repairing moisturizer applied immediately after.",
    });
  }

  if (sc === "Film Former" && fc !== "occlusive") {
    notes.push({
      dimensions: ["acne_prone", "oily"],
      climate: [],
      sentiment: "caution",
      text: "Film-formers slow natural dead skin cell shedding — first causing a subtle surface itch as cells build up, then contributing to milia (small, hard keratin bumps) with extended leave-on use on congestion-prone skin.",
    });
    notes.push({
      dimensions: ["dry"],
      climate: ["dry_climate"],
      sentiment: "strong_caution",
      text: "In dry climates, the skin's natural desquamation (cell-shedding) enzymes are less active — film-formers compound this by additionally blocking the surface, worsening itch and buildup.",
    });
  }

  if (sc === "Silicone") {
    notes.push({
      dimensions: ["acne_prone", "oily"],
      climate: ["hot", "humid"],
      sentiment: "caution",
      text: "In hot or humid conditions, silicone-heavy formulas can create a suffocating layer on oily or acne-prone skin that traps sebum and worsens congestion.",
    });
  }

  if (sc === "UV Filter") {
    notes.push({
      dimensions: [],
      climate: ["high_uv"],
      sentiment: "benefit",
      text: "UV filters provide essential protection in high-UV environments — mineral filters (zinc oxide, titanium dioxide) are preferred for reactive skin due to their low sensitization profile.",
    });
  }

  if (sc === "Exfoliant" && fc !== "aha exfoliant") {
    notes.push({
      dimensions: [],
      climate: ["high_uv"],
      sentiment: "strong_caution",
      text: "Exfoliants expose newer, less-protected skin cells — daily sun protection is essential to prevent UV damage to the freshly revealed surface.",
    });
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["cold"],
      sentiment: "caution",
      text: "In cold, dry conditions, the barrier is already under stress — exfoliation can tip dry or already-compromised skin into irritation and flaking.",
    });
  }

  if (sc === "Humectant") {
    notes.push({
      dimensions: ["dry"],
      climate: ["dry_climate"],
      sentiment: "caution",
      text: "In very dry climates, humectants can pull moisture from deeper skin layers instead of the air — seal them in with an emollient or barrier ingredient.",
    });
    notes.push({
      dimensions: [],
      climate: ["humid"],
      sentiment: "benefit",
      text: "In humid climates, humectants have an abundant atmospheric moisture reservoir to draw from and work at peak effectiveness.",
    });
  }

  if (sc === "Emollient") {
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["cold"],
      sentiment: "benefit",
      text: "Emollients reinforce the skin barrier's lipid layer — most beneficial in cold conditions when environmental lipid depletion is at its highest.",
    });
    notes.push({
      dimensions: ["oily", "acne_prone"],
      climate: ["hot", "humid"],
      sentiment: "caution",
      text: "Heavy emollients in hot or humid weather can feel occlusive on oily or acne-prone skin — lighter formulations or lower concentrations are preferable.",
    });
  }

  if (sc === "Ceramide") {
    notes.push({
      dimensions: [],
      climate: ["cold", "dry_climate"],
      sentiment: "benefit",
      text: "Ceramides are most valuable in cold or dry climates, where the barrier's natural lipid content is depleted fastest by environmental stress.",
    });
  }

  if (sc === "Wax") {
    notes.push({
      dimensions: ["oily", "acne_prone"],
      climate: ["hot", "humid"],
      sentiment: "strong_caution",
      text: "Waxes create a stiff occlusive seal — in hot or humid conditions, the trapped heat and sebum significantly increase congestion risk on oily or acne-prone skin.",
    });
  }

  if (sc === "Clay") {
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["dry_climate", "cold"],
      sentiment: "strong_caution",
      text: "Clay's absorptive and film-forming properties are particularly drying in cold or dry conditions — extended leave-on use is not recommended for dry or compromised skin.",
    });
  }

  if (sc === "Fragrance") {
    notes.push({
      dimensions: ["reactive", "damaged_barrier"],
      climate: ["hot"],
      sentiment: "strong_caution",
      text: "Heat increases absorption of fragrance compounds through the skin — on reactive or compromised skin, this raises both the likelihood and intensity of a contact reaction.",
    });
  }

  if (sc === "Fatty Acid" || sc === "Fatty Alcohol") {
    notes.push({
      dimensions: ["dry", "damaged_barrier"],
      climate: ["cold"],
      sentiment: "benefit",
      text: "Fatty acids and alcohols help restore the lipid matrix of the skin barrier — especially valuable in cold conditions when barrier lipids are most depleted.",
    });
  }

  if (sc === "Peptide" && cat !== "firming") {
    notes.push({
      dimensions: ["mature"],
      climate: ["cold", "dry_climate"],
      sentiment: "benefit",
      text: "Peptides support collagen and elastin production — most impactful in mature skin, where production is already reduced and cold or dry climates accelerate barrier thinning.",
    });
  }

  if (sc === "Plant Extract") {
    notes.push({
      dimensions: ["reactive"],
      climate: ["hot"],
      sentiment: "caution",
      text: "Plant extracts vary widely — in hot weather, increased skin permeability can intensify reactions to botanical compounds in sensitized skin.",
    });
  }

  // ── SAFE FUNCTIONAL CATEGORIES ─────────────────────────────────────────────

  if (cat === "barrier-repairing" || cat === "barrier support" || cat === "strengthening") {
    notes.push({
      dimensions: ["damaged_barrier", "reactive"],
      climate: ["cold", "dry_climate"],
      sentiment: "benefit",
      text: "Barrier-repairing ingredients are most valuable when skin is under environmental stress — cold and dry conditions deplete the barrier's natural defenses fastest.",
    });
  }

  if (cat === "soothing" || cat === "anti-inflammatory") {
    notes.push({
      dimensions: ["reactive"],
      climate: ["hot", "high_uv"],
      sentiment: "benefit",
      text: "Soothing ingredients help calm the inflammatory response that heat and UV exposure can trigger in reactive skin.",
    });
  }

  if (cat === "antioxidant") {
    notes.push({
      dimensions: [],
      climate: ["high_uv"],
      sentiment: "benefit",
      text: "Antioxidants neutralize free radicals generated by UV exposure — most effective when applied before going out in high-UV environments.",
    });
  }

  if (cat === "brightening") {
    notes.push({
      dimensions: ["hyperpigmentation_prone"],
      climate: ["high_uv"],
      sentiment: "caution",
      text: "Many brightening ingredients increase UV sensitivity — daily SPF is essential, especially for hyperpigmentation-prone skin where sun exposure directly undoes brightening progress.",
    });
  }

  if (cat === "firming") {
    notes.push({
      dimensions: ["mature"],
      climate: ["cold", "dry_climate"],
      sentiment: "benefit",
      text: "Firming ingredients are especially relevant in cold or dry climates, where moisture loss accelerates the skin thinning and laxity that mature skin is already prone to.",
    });
  }

  if (cat === "moisturizing") {
    notes.push({
      dimensions: ["dry"],
      climate: ["dry_climate", "cold"],
      sentiment: "benefit",
      text: "Moisturizing ingredients provide the most noticeable benefit in dry or cold climates, where TEWL (water loss through skin) is highest.",
    });
  }

  // Deduplicate identical notes that might arise from overlapping rules
  const seen = new Set<string>();
  return notes.filter((n) => {
    const key = JSON.stringify(n);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
