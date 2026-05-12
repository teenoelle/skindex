// Generates explanations for all ingredients missing one using category data.
// No AI API needed — explanations are built from structural_category, category, flagged_category.
// Run with: node scripts/backfill-explanations.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fqpqlllixjnzsdpqrovv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 200;

function article(word) {
  return /^[aeiouAEIOU]/.test(word) ? "an" : "a";
}

const STRUCTURAL_ROLE = {
  "Emulsifier":         "helps oil and water blend together to keep the formula stable",
  "Thickener":          "increases the formula's viscosity for smooth, even application",
  "Film Former":        "creates a thin protective film on the skin surface",
  "Surfactant":         "reduces surface tension to cleanse skin and rinse away dirt and oil",
  "Wax":                "provides texture, structure, and an occlusive protective layer",
  "Pigment":            "provides color in the formula",
  "Colorant":           "adds or enhances color in the formula",
  "pH Adjuster":        "keeps the formula at an optimal pH for stability and skin compatibility",
  "Conditioning Agent": "coats and smooths skin and hair surfaces to reduce friction and improve feel",
  "Silicone":           "provides a silky texture and slip while forming a breathable barrier on skin",
  "Fatty Acid":         "replenishes the skin's lipid barrier and helps lock in moisture",
  "Fatty Alcohol":      "softens texture and acts as a co-emulsifier in the formula",
  "Botanical Water":    "provides a plant-derived aqueous base with mild skin benefits",
  "Mineral":            "supplies trace elements that support skin function",
  "Preservative Booster": "enhances the effectiveness of preservatives to extend shelf life",
  "Emollient":          "softens and smooths skin by filling gaps in the lipid barrier",
  "Humectant":          "draws moisture from the air into the upper layers of skin",
  "UV Filter":          "absorbs or reflects UV radiation to protect skin from sun damage",
  "Plant Extract":      "delivers concentrated plant-derived actives",
  "Solvent":            "dissolves other ingredients and helps the formula spread on skin",
  "Chelating Agent":    "binds trace metals in water to prevent formula degradation",
  "Preservative":       "prevents microbial growth to extend the product's shelf life",
  "Fragrance":          "adds scent to the formula",
  "Peptide":            "signals skin cells to support collagen production, repair, and moisture retention",
  "Ceramide":           "fills gaps in the skin barrier to lock in moisture and protect against irritants",
  "Retinoid":           "accelerates cell turnover to smooth texture and reduce discoloration",
  "Exfoliant":          "dissolves the bonds between dead skin cells to reveal smoother skin",
  "Protein":            "forms a conditioning film on skin and hair to strengthen and smooth",
  "Clay":               "absorbs excess sebum and draws out impurities from pores",
  "Amino Acid":         "supports hydration and barrier function as a skin-identical NMF component",
  "Active":             "delivers a targeted skin benefit",
};

const SAFE_BENEFIT = {
  "soothing":         "It helps calm redness and irritation, making it well-suited for sensitive skin.",
  "antioxidant":      "It neutralizes free radicals to protect skin from environmental stress and premature aging.",
  "brightening":      "It helps fade discoloration and even skin tone with consistent use.",
  "firming":          "It supports skin elasticity and a firmer, more lifted appearance.",
  "antimicrobial":    "It has antimicrobial properties that help keep skin clear and balanced.",
  "humectant":        "It is generally well-tolerated and effective at maintaining long-lasting hydration.",
  "emollient":        "It leaves skin feeling soft and smooth without clogging pores.",
  "barrier-repairing":"It strengthens the skin barrier to reduce moisture loss and sensitivity.",
  "cleansing":        "It effectively removes impurities and is considered mild and non-stripping.",
  "exfoliant":        "It encourages cell turnover to keep skin smooth, though it should be used with sun protection.",
  "retinoid":         "It promotes cell renewal for smoother texture and reduced fine lines, best introduced gradually.",
  "antifungal":       "It has antifungal properties that help keep skin balanced and clear.",
  "antimicrobial":    "It has antimicrobial properties that help control bacteria on the skin's surface.",
  "firming":          "It supports collagen and skin elasticity for a firmer appearance.",
};

const FLAGGED_CONCERN = {
  "sensitizer":        "It is a known sensitizer that can trigger allergic reactions or contact dermatitis in reactive skin over time.",
  "pore-clogger":      "It is comedogenic and can clog pores, contributing to breakouts on acne-prone skin.",
  "stripping":         "It strips the skin's natural oils, disrupting the barrier and worsening dryness and sensitivity.",
  "fragrance-allergen":"It is a fragrance allergen that commonly triggers contact dermatitis in sensitive individuals.",
  "occlusive":         "Its heavy occlusive nature can trap heat and bacteria against the skin, worsening congestion and breakouts.",
  "bacteria-trap":     "At high concentrations it can draw moisture and bacteria to the skin surface, potentially worsening breakouts.",
  "photosensitizer":   "It increases the skin's sensitivity to UV radiation, raising the risk of sun damage and reactions.",
  "exfoliant":         "As a chemical exfoliant it can cause dryness, irritation, and increased sun sensitivity if overused.",
  "retinoid":          "Retinoids can cause dryness, peeling, and irritation, especially during initial use on reactive skin.",
  "Fragrance":         "Fragrance is a leading trigger for contact dermatitis and sensitization in reactive skin.",
  "Preservative":      "This preservative type can cause sensitization and allergic reactions with repeated exposure.",
  "Preservative Allergen": "This preservative is a common allergen that can cause sensitization and contact dermatitis.",
  "Irritant":          "It is a direct irritant that can cause redness, stinging, or inflammation on reactive skin.",
  "Drying Solvent":    "This alcohol-based solvent strips the skin's natural moisture barrier, increasing dryness and irritation.",
  "Sulfate Surfactant":"Sulfate surfactants are aggressive cleansers that strip the skin barrier and commonly cause dryness and irritation.",
  "Chemical Sunscreen":"Chemical UV filters are absorbed into skin and are associated with sensitization and hormonal disruption concerns.",
  "Synthetic Musk":    "Synthetic musks are fragrance compounds linked to sensitization and potential bioaccumulation.",
  "Essential Oil":     "Essential oils contain volatile aromatic compounds that commonly cause sensitization and irritation on reactive skin.",
  "Silicone":          "Certain silicones can form an occlusive film that traps sebum and bacteria, potentially worsening congestion.",
};

function generateExplanation(ingredient) {
  const { name, status, structural_category: sc, category: cat, flagged_category: fc } = ingredient;

  const roleText = sc ? STRUCTURAL_ROLE[sc] : null;
  const scLabel = sc ? sc.toLowerCase() : null;

  let sentence1;
  if (roleText && scLabel) {
    sentence1 = `${name} is ${article(scLabel)} ${scLabel} that ${roleText}.`;
  } else {
    sentence1 = `${name} is a skincare ingredient.`;
  }

  let sentence2;
  if (status === "flagged") {
    const concern = fc ?? cat;
    sentence2 = (concern && FLAGGED_CONCERN[concern])
      ? FLAGGED_CONCERN[concern]
      : "It may cause irritation or sensitization in reactive or sensitive skin.";
  } else {
    const benefit = cat;
    sentence2 = (benefit && SAFE_BENEFIT[benefit])
      ? SAFE_BENEFIT[benefit]
      : "It is generally considered well-tolerated in skincare formulations.";
  }

  return `${sentence1} ${sentence2}`;
}

async function main() {
  let totalUpdated = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category")
      .is("explanation", null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data?.length) break;

    const updates = data.map((ingredient) => ({
      id: ingredient.id,
      explanation: generateExplanation(ingredient),
    }));

    const results = await Promise.allSettled(
      updates.map(({ id, explanation }) =>
        supabase.from("ingredients").update({ explanation }).eq("id", id)
      )
    );

    const saved = results.filter((r) => r.status === "fulfilled").length;
    totalUpdated += saved;
    console.log(`Updated ${totalUpdated} so far…`);
  }

  console.log(`\nDone. ${totalUpdated} explanations written.`);
}

main();
