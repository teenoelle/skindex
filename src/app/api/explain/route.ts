import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateExplanation } from "@/lib/generate-explanation";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { id } = await req.json();

  const { data: ingredient } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, explanation, structural_category, category, flagged_category")
    .eq("id", id)
    .single();

  if (!ingredient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ingredient.explanation) {
    return NextResponse.json({ explanation: ingredient.explanation });
  }

  let explanation: string | null = null;

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

    explanation = msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
  } catch {
    // Anthropic unavailable — fall through to template
  }

  // Fallback: template-based generation (no API required)
  if (!explanation) {
    explanation = generateExplanation(
      ingredient.name,
      ingredient.status,
      ingredient.structural_category,
      ingredient.category,
      ingredient.flagged_category,
    );
  }

  if (explanation) {
    await supabaseAdmin
      .from("ingredients")
      .update({ explanation })
      .eq("id", id);
  }

  return NextResponse.json({ explanation });
}
