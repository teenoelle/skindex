import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { classifyIngredient } from "@/lib/ingredient-classifier";
import { generateExplanation } from "@/lib/generate-explanation";
import { generateNotes } from "@/lib/curated-explanation";

const BATCH_SIZE = 20;

async function processQueue(): Promise<NextResponse> {
  const { data: queue, error } = await supabaseAdmin
    .from("ingredient_queue")
    .select("id, name")
    .order("times_seen", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!queue?.length) return NextResponse.json({ reviewed: 0, total: 0, remaining: 0 });

  // Classify and insert all in parallel
  const insertOps = queue.map(async (item): Promise<boolean> => {
    const { data: existing } = await supabaseAdmin
      .from("ingredients")
      .select("id")
      .ilike("name", item.name)
      .maybeSingle();

    if (existing) return false;

    const classification = classifyIngredient(item.name);
    const explanation = generateExplanation(
      item.name,
      classification.status,
      classification.structural_category,
      classification.category,
      classification.flagged_category,
    );
    const notes = generateNotes(classification);
    await supabaseAdmin.from("ingredients").insert({
      name: item.name,
      status: classification.status,
      structural_category: classification.structural_category,
      category: classification.category,
      flagged_category: classification.flagged_category,
      explanation,
      // template_unclassified signals the AI upgrade path to also reclassify, not just rewrite text
      explanation_source: classification.structural_category ? "template" : "template_unclassified",
      skin_climate_notes: notes.length > 0 ? notes : null,
    });
    return true;
  });

  const results = await Promise.allSettled(insertOps);
  const reviewed = results.filter((r) => r.status === "fulfilled" && r.value === true).length;

  // Batch-delete all processed items from queue (keeps queue draining regardless of outcome)
  const allIds = queue.map((item) => item.id);
  await supabaseAdmin.from("ingredient_queue").delete().in("id", allIds);

  const { count: remaining } = await supabaseAdmin
    .from("ingredient_queue")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ reviewed, total: queue.length, remaining: remaining ?? 0 });
}

export async function GET() {
  return processQueue();
}

export async function POST() {
  return processQueue();
}
