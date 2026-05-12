import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const BATCH_SIZE = 20;

type Ingredient = {
  id: string;
  name: string;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

function buildPrompt(ingredient: Ingredient): string {
  const structuralNote = ingredient.structural_category
    ? `Its role in the formula is: ${ingredient.structural_category}.`
    : "";
  if (ingredient.status === "flagged") {
    const concern = ingredient.flagged_category ?? ingredient.category;
    return `You are a skincare ingredient expert writing for someone with reactive or sensitive skin. Explain why "${ingredient.name}" is flagged. ${structuralNote}${concern ? ` The concern category is: ${concern}.` : ""} Write 1–2 sentences. Start the response with the ingredient name (e.g. "${ingredient.name} is..."). Cover what it does in the formula and why it is a concern for reactive skin. Be specific — avoid generic filler.`;
  }
  const benefit = ingredient.category;
  return `You are a skincare ingredient expert. Briefly explain what "${ingredient.name}" does in a skincare product. ${structuralNote}${benefit ? ` Its skin benefit category is: ${benefit}.` : ""} Write 1–2 sentences. Start the response with the ingredient name (e.g. "${ingredient.name} is..."). Cover its formulation role and why it is considered well-tolerated. Be specific — avoid generic filler.`;
}

async function generateOne(ingredient: Ingredient): Promise<string | null> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: buildPrompt(ingredient) }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
  } catch {
    return null;
  }
}

async function processBatch(): Promise<NextResponse> {
  const { data: batch, error } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category")
    .is("explanation", null)
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!batch?.length) return NextResponse.json({ updated: 0, remaining: 0 });

  // Generate all explanations in parallel
  const results = await Promise.allSettled(
    batch.map((ingredient) =>
      generateOne(ingredient as Ingredient).then((explanation) => ({ ingredient, explanation }))
    )
  );

  // Update DB in parallel for successful generations
  const updateOps = results
    .filter(
      (r): r is PromiseFulfilledResult<{ ingredient: Ingredient; explanation: string }> =>
        r.status === "fulfilled" && r.value.explanation !== null
    )
    .map(({ value: { ingredient, explanation } }) =>
      supabaseAdmin.from("ingredients").update({ explanation }).eq("id", ingredient.id)
    );

  const updateResults = await Promise.allSettled(updateOps);
  const updated = updateResults.filter((r) => r.status === "fulfilled").length;

  const { count: remaining } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .is("explanation", null);

  return NextResponse.json({ updated, total: batch.length, remaining: remaining ?? 0 });
}

export async function GET() {
  return processBatch();
}

export async function POST() {
  return processBatch();
}
