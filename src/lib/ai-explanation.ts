import { anthropic } from "./anthropic";
import { generateExplanation } from "./generate-explanation";
import type { ExplanationStructured } from "@/types";

type IngredientInfo = {
  name: string;
  status: "flagged" | "safe";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

type ExplanationOutput = {
  explanation_structured: ExplanationStructured;
  explanation: string;
  source: "curated" | "template";
};

function buildPrompt(ingredient: IngredientInfo): string {
  const { name, status, structural_category, category, flagged_category } = ingredient;
  const structNote = structural_category ? ` Its structural role in the formula is: ${structural_category}.` : "";

  if (status === "flagged") {
    const concern = flagged_category ?? category;
    return `You are a skincare ingredient expert writing for someone with reactive or sensitive skin.

Ingredient: "${name}"${structNote}${concern ? ` Concern category: ${concern}.` : ""}

Return a JSON object with exactly these three fields — no other text:
{
  "formula_role": "1 sentence: what ${name} does technically in the formula. Start with '${name} is...'",
  "benefit": "1 sentence: any meaningful skin benefit or why some people use it despite the concern. Start with '${name}...' or null if there is no notable benefit.",
  "concern": "1 sentence: why ${name} is a concern for reactive or sensitive skin. Start with '${name} is...' or '${name} can...'"
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
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(ingredient) }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ExplanationStructured;
        if (parsed && typeof parsed === "object") {
          const structured: ExplanationStructured = {
            formula_role: parsed.formula_role ?? null,
            benefit: parsed.benefit ?? null,
            concern: parsed.concern ?? null,
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
