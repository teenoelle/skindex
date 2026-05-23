import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { classifyIngredient } from "@/lib/ingredient-classifier";
import { generateExplanation } from "@/lib/generate-explanation";
import { generateCuratedExplanation } from "@/lib/curated-explanation";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

export async function GET() {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { data, error } = await supabaseAdmin
    .from("ingredient_queue")
    .select("id, name, times_seen, found_in, last_seen")
    .order("times_seen", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

async function classifyOne(queueId: string): Promise<{ classified: boolean; alreadyExists: boolean }> {
  const { data: item } = await supabaseAdmin
    .from("ingredient_queue").select("id, name").eq("id", queueId).maybeSingle();
  if (!item) return { classified: false, alreadyExists: false };

  const { data: existing } = await supabaseAdmin
    .from("ingredients").select("id").ilike("name", item.name).maybeSingle();

  if (!existing) {
    const cl = classifyIngredient(item.name);
    const ctx = { name: item.name, status: cl.status, structural_category: cl.structural_category, category: cl.category, flagged_category: cl.flagged_category };
    const aiResult = await generateCuratedExplanation(ctx);
    const explanation = aiResult?.explanation ?? generateExplanation(item.name, cl.status, cl.structural_category, cl.category, cl.flagged_category);
    await supabaseAdmin.from("ingredients").insert({
      name: item.name,
      status: cl.status,
      structural_category: cl.structural_category,
      category: cl.category,
      flagged_category: cl.flagged_category,
      explanation,
      explanation_source: aiResult ? "ai" : "template",
      skin_climate_notes: aiResult?.skin_climate_notes ?? null,
    });
  }

  await supabaseAdmin.from("ingredient_queue").delete().eq("id", queueId);
  return { classified: !existing, alreadyExists: !!existing };
}

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { action, queueId } = await req.json();

  if (action === "remove") {
    if (!queueId) return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
    await supabaseAdmin.from("ingredient_queue").delete().eq("id", queueId);
    return NextResponse.json({ ok: true });
  }

  if (action === "classify-one") {
    if (!queueId) return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
    const result = await classifyOne(queueId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "classify-all") {
    const { data: allItems } = await supabaseAdmin
      .from("ingredient_queue").select("id").order("times_seen", { ascending: false }).limit(500);
    if (!allItems?.length) return NextResponse.json({ classified: 0, skipped: 0 });

    let classified = 0, skipped = 0;
    const BATCH = 5;
    for (let i = 0; i < allItems.length; i += BATCH) {
      const chunk = allItems.slice(i, i + BATCH);
      const results = await Promise.allSettled(chunk.map((item) => classifyOne(item.id)));
      classified += results.filter((r) => r.status === "fulfilled" && (r.value as { classified: boolean }).classified).length;
      skipped += results.filter((r) => r.status === "fulfilled" && !(r.value as { classified: boolean }).classified).length;
    }
    return NextResponse.json({ classified, skipped });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
