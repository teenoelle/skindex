import { callClaude } from "./claude-cli";
import { generateExplanation } from "./generate-explanation";
import type { ExplanationStructured } from "@/types";

type IngredientInfo = {
  name: string;
  status: "flagged" | "safe";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  secondary_flagged_categories?: string[] | null;
};

type ExplanationOutput = {
  explanation_structured: ExplanationStructured;
  explanation: string;
  source: "curated" | "template";
};

export type ReclassifyOutput = ExplanationOutput & {
  status?: "safe" | "flagged";
  structural_category?: string | null;
  category?: string | null;
  flagged_category?: string | null;
};

function buildPrompt(ingredient: IngredientInfo): string {
  const { name, status, structural_category, category, flagged_category, secondary_flagged_categories } = ingredient;
  const structNote = structural_category ? ` Its structural role in the formula is: ${structural_category}.` : "";

  if (status === "flagged") {
    const allConcernCats = [flagged_category, ...(secondary_flagged_categories ?? [])].filter(Boolean) as string[];
    const multiCategory = allConcernCats.length > 1;
    const concernNote = multiCategory
      ? ` Concern categories: ${allConcernCats.join(", ")}.`
      : allConcernCats[0] ? ` Concern category: ${allConcernCats[0]}.` : (category ? ` Concern category: ${category}.` : "");

    const concernItemsField = multiCategory
      ? `,\n  "concern_items": ${JSON.stringify(allConcernCats.map(c => ({ category: c, text: `1 sentence: why ${name} is a concern specifically as a ${c}. Start with '${name}...'` })), null, 2)}`
      : "";

    return `You are a skincare ingredient expert writing for someone with reactive or sensitive skin.

Ingredient: "${name}"${structNote}${concernNote}

Return a JSON object with exactly these fields — no other text:
{
  "formula_role": "1 sentence: what ${name} does technically in the formula. Start with '${name} is...'",
  "benefit": "1 sentence: any meaningful skin benefit or why some people use it despite the concern. Start with '${name}...' or null if there is no notable benefit.",
  "concern": "1 sentence: why ${name} is a concern for reactive or sensitive skin (primary concern). Start with '${name} is...' or '${name} can...'"${concernItemsField ? `,
  "concern_items": [
${allConcernCats.map(c => `    { "category": "${c}", "text": "1 sentence specific to the ${c} concern" }`).join(",\n")}
  ]` : ""}
}

Be specific. Avoid generic filler. Respond ONLY with valid JSON.`;
  }

  const benefit = category;
  return `You are a skincare ingredient expert.

Ingredient: "${name}"${structNote}${benefit ? ` Skin benefit category: ${benefit}.` : ""}

Return a JSON object with exactly these three fields — no other text:
{
  "formula_role": "1 sentence: what ${name} does technically in the formula. Start with '${name} is...'",
  "benefit": "1 sentence: its skin benefit and why it is well-tolerated. Start with '${name}...'",
  "concern": null
}

Be specific. Avoid generic filler. Respond ONLY with valid JSON.`;
}

function flattenStructured(s: ExplanationStructured): string {
  return [s.formula_role, s.benefit, s.concern].filter(Boolean).join(" ");
}

function templateFallback(ingredient: IngredientInfo): ExplanationOutput {
  const flat = generateExplanation(
    ingredient.name,
    ingredient.status,
    ingredient.structural_category,
    ingredient.category,
    ingredient.flagged_category,
  ) ?? `${ingredient.name} is a skincare ingredient.`;

  const structured: ExplanationStructured =
    ingredient.status === "flagged"
      ? { formula_role: null, benefit: null, concern: flat }
      : { formula_role: null, benefit: flat, concern: null };

  return { explanation_structured: structured, explanation: flat, source: "template" };
}

export async function generateCuratedExplanation(ingredient: IngredientInfo): Promise<ExplanationOutput> {
  try {
    const raw = await callClaude(buildPrompt(ingredient));
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ExplanationStructured;
        if (parsed && typeof parsed === "object") {
          const rawItems = parsed.concern_items;
          const structured: ExplanationStructured = {
            formula_role: parsed.formula_role ?? null,
            benefit: parsed.benefit ?? null,
            concern: parsed.concern ?? null,
            concern_items: Array.isArray(rawItems) && rawItems.length > 1
              ? rawItems.map((ci: { category: string; text: string }) => ({ category: String(ci.category), text: String(ci.text) }))
              : null,
          };
          return {
            explanation_structured: structured,
            explanation: flattenStructured(structured),
            source: "curated",
          };
        }
      }
    }
  } catch {
    // Anthropic unavailable — fall through to template
  }

  return templateFallback(ingredient);
}

// ── Reclassification prompt (for template_unclassified entries) ──────────────

const SAFE_STRUCTURAL = [
  "Humectant","Emollient","Fatty Acid","Fatty Alcohol","Ceramide","Peptide",
  "Silicone","Surfactant","Emulsifier","Thickener","Preservative","Mineral UV Filter","Chemical UV Filter",
  "Plant Extract","Chelating Agent","pH Adjuster","Solvent","Conditioning Agent",
  "Protein","Amino Acid","Active","Colorant","Clay","Exfoliant","Fragrance",
].join(", ");

const FLAGGED_CATEGORIES = [
  "sensitizer","fragrance-allergen","Synthetic Musk","Chemical Sunscreen",
  "AHA Exfoliant","BHA Exfoliant","Barrier-disrupting","pore-clogger","occlusive",
  "Sulfate Surfactant","Drying Solvent","Irritant","vasodilator","phytoestrogen",
].join(", ");

const SAFE_CATEGORIES = [
  "soothing","brightening","antioxidant","firming","barrier-repairing","moisturizing",
  "smoothing","Softening","antimicrobial","anti-malassezia","wound-healing","cleansing",
  "Pore-cleansing","Strengthening","Conditioning","chelating","PHA Exfoliant",
  "Anti-inflammatory",
].join(", ");

function buildReclassifyPrompt(name: string): string {
  return `You are a cosmetic chemist and skincare ingredient expert.

Ingredient name: "${name}"

Step 1 — classify this ingredient:
- status: "safe" or "flagged" (flagged = a documented skin concern for some users)
- structural_category: one of [${SAFE_STRUCTURAL}] — what it IS chemically in the formula. null if none fits.
- If safe: category — one of [${SAFE_CATEGORIES}]. null if none fits.
- If flagged: flagged_category — one of [${FLAGGED_CATEGORIES}]. null if none fits.

Step 2 — write three short explanations:
- formula_role: 1 sentence starting "${name} is..." describing its technical function.
- benefit: 1 sentence starting "${name}..." describing its skin benefit (or null if flagged with no benefit).
- concern: 1 sentence starting "${name} is..." or "${name} can..." describing the concern (or null if safe with no concern).

Return ONLY valid JSON — no other text:
{
  "status": "safe" | "flagged",
  "structural_category": string | null,
  "category": string | null,
  "flagged_category": string | null,
  "formula_role": string,
  "benefit": string | null,
  "concern": string | null
}`;
}

export async function generateWithReclassification(name: string): Promise<ReclassifyOutput> {
  try {
    const raw = await callClaude(buildReclassifyPrompt(name));
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === "object") {
          const structured: ExplanationStructured = {
            formula_role: parsed.formula_role ?? null,
            benefit: parsed.benefit ?? null,
            concern: parsed.concern ?? null,
          };
          return {
            status: parsed.status === "flagged" ? "flagged" : "safe",
            structural_category: parsed.structural_category ?? null,
            category: parsed.category ?? null,
            flagged_category: parsed.flagged_category ?? null,
            explanation_structured: structured,
            explanation: flattenStructured(structured),
            source: "curated",
          };
        }
      }
    }
  } catch {
    // fall through
  }
  // Fallback: return empty reclassification so caller can keep existing values
  const fallback = templateFallback({ name, status: "safe", structural_category: null, category: null, flagged_category: null });
  return { ...fallback };
}
