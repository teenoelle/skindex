import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateCuratedExplanation, generateWithReclassification } from "@/lib/ai-explanation";
import { generateNotes } from "@/lib/curated-explanation";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

export async function GET(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { count: weak } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified");

  const { count: total } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ weak: weak ?? 0, total: total ?? 0 });
}

// Upgrades a batch of template/null explanations to AI-curated.
// Also saves explanation_structured and regenerates skin_climate_notes.
// Call repeatedly until weak count reaches 0.
export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { batchSize = 20 } = await req.json().catch(() => ({}));

  const { data: ingredients } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_source")
    .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified")
    .order("name")
    .limit(Math.min(batchSize, 50));

  if (!ingredients?.length) return NextResponse.json({ upgraded: 0, remaining: 0 });

  let upgraded = 0;
  for (const ing of ingredients) {
    if (ing.explanation_source === "template_unclassified") {
      // AI reclassification: determines correct status/categories + writes explanation
      const result = await generateWithReclassification(ing.name);
      if (result.source === "curated") {
        const updatedIng = {
          status: result.status ?? ing.status,
          structural_category: result.structural_category !== undefined ? result.structural_category : ing.structural_category,
          category: result.category !== undefined ? result.category : ing.category,
          flagged_category: result.flagged_category !== undefined ? result.flagged_category : ing.flagged_category,
        };
        const notes = generateNotes(updatedIng as typeof ing);
        await supabaseAdmin
          .from("ingredients")
          .update({
            ...updatedIng,
            explanation: result.explanation,
            explanation_structured: result.explanation_structured,
            explanation_source: "curated",
            skin_climate_notes: notes.length > 0 ? notes : null,
          })
          .eq("id", ing.id);
        upgraded++;
      }
    } else {
      const { explanation, explanation_structured, source } = await generateCuratedExplanation(ing);
      if (source === "curated") {
        const notes = generateNotes(ing);
        await supabaseAdmin
          .from("ingredients")
          .update({
            explanation,
            explanation_structured,
            explanation_source: "curated",
            skin_climate_notes: notes.length > 0 ? notes : null,
          })
          .eq("id", ing.id);
        upgraded++;
      }
    }
  }

  const { count: remaining } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified");

  return NextResponse.json({ upgraded, remaining: remaining ?? 0 });
}
