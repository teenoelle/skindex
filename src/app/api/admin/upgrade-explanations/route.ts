import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateCuratedExplanation } from "@/lib/ai-explanation";

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
    .or("explanation_source.is.null,explanation_source.eq.template");

  const { count: total } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ weak: weak ?? 0, total: total ?? 0 });
}

// Upgrades a batch of template/null explanations to AI-curated.
// Call repeatedly until weak count reaches 0.
export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { batchSize = 20 } = await req.json().catch(() => ({}));

  const { data: ingredients } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category")
    .or("explanation_source.is.null,explanation_source.eq.template")
    .order("name")
    .limit(Math.min(batchSize, 50));

  if (!ingredients?.length) return NextResponse.json({ upgraded: 0, remaining: 0 });

  let upgraded = 0;
  for (const ing of ingredients) {
    const { explanation, source } = await generateCuratedExplanation(ing);
    if (source === "curated") {
      await supabaseAdmin
        .from("ingredients")
        .update({ explanation, explanation_source: "curated" })
        .eq("id", ing.id);
      upgraded++;
    }
  }

  const { count: remaining } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .or("explanation_source.is.null,explanation_source.eq.template");

  return NextResponse.json({ upgraded, remaining: remaining ?? 0 });
}
