import { anthropic } from "./anthropic";
import { generateExplanation } from "./generate-explanation";

type IngredientInfo = {
  name: string;
  status: "flagged" | "safe";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

export async function generateCuratedExplanation(
  ingredient: IngredientInfo,
): Promise<{ explanation: string; source: "curated" | "template" }> {
  try {
    const structuralNote = ingredient.structural_category
      ? `Its role in the formula is: ${ingredient.structural_category}.`
      : "";

    let prompt: string;
    if (ingredient.status === "flagged") {
      const concern = ingredient.flagged_category ?? ingredient.category;
      prompt = `You are a skincare ingredient expert writing for someone with reactive or sensitive skin. Explain why "${ingredient.name}" is flagged. ${structuralNote}${concern ? ` The concern category is: ${concern}.` : ""} Write 1–2 sentences. Start the response with the ingredient name (e.g. "${ingredient.name} is..."). Cover what it does in the formula and why it is a concern for reactive skin. Be specific — avoid generic filler.`;
    } else {
      const benefit = ingredient.category;
      prompt = `You are a skincare ingredient expert. Briefly explain what "${ingredient.name}" does in a skincare product. ${structuralNote}${benefit ? ` Its skin benefit category is: ${benefit}.` : ""} Write 1–2 sentences. Start the response with the ingredient name (e.g. "${ingredient.name} is..."). Cover its formulation role and why it is considered well-tolerated. Be specific — avoid generic filler.`;
    }

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
    if (text) return { explanation: text, source: "curated" };
  } catch {
    // Anthropic unavailable — fall through to template
  }

  const explanation = generateExplanation(
    ingredient.name,
    ingredient.status,
    ingredient.structural_category,
    ingredient.category,
    ingredient.flagged_category,
  ) ?? `${ingredient.name} is a skincare ingredient.`;

  return { explanation, source: "template" };
}
