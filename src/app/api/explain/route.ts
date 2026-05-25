import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateCuratedExplanation } from "@/lib/ai-explanation";

export async function POST(req: NextRequest) {
  const { id } = await req.json();

  const { data: ingredient } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, explanation, explanation_structured, structural_category, category, flagged_category")
    .eq("id", id)
    .single();

  if (!ingredient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ingredient.explanation_structured) {
    return NextResponse.json({
      explanation: ingredient.explanation,
      explanation_structured: ingredient.explanation_structured,
    });
  }

  const { explanation_structured, explanation, source } = await generateCuratedExplanation(ingredient);

  await supabaseAdmin
    .from("ingredients")
    .update({ explanation, explanation_structured, explanation_source: source })
    .eq("id", id);

  return NextResponse.json({ explanation, explanation_structured });
}
