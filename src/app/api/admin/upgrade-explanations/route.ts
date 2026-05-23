import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateCuratedExplanation } from "@/lib/curated-explanation";

const BATCH_SIZE = 20;
const CONCURRENCY = 5;

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

type Row = {
  id: string;
  name: string;
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "weak";

  let query = supabaseAdmin
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category")
    .limit(BATCH_SIZE);

  if (mode === "weak") {
    query = query.or("explanation_source.is.null,explanation_source.eq.template");
  } else {
    query = query.neq("explanation_source", "ai");
  }

  const { data: batch, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!batch?.length) return NextResponse.json({ upgraded: 0, remaining: 0 });

  let upgraded = 0;
  let firstError: string | null = null;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = (batch as Row[]).slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(async (row) => {
      const ctx = {
        name: row.name,
        status: row.status,
        structural_category: row.structural_category,
        category: row.category,
        flagged_category: row.flagged_category,
      };
      const aiResult = await generateCuratedExplanation(ctx);
      if (!aiResult) return;
      await supabaseAdmin.from("ingredients").update({
        explanation: aiResult.explanation,
        explanation_source: "ai",
        skin_climate_notes: aiResult.skin_climate_notes,
      }).eq("id", row.id);
      upgraded++;
    }));

    for (const r of results) {
      if (r.status === "rejected" && !firstError) {
        firstError = r.reason instanceof Error ? r.reason.message : String(r.reason);
      }
    }

    // Stop batching if AI is erroring — no point continuing
    if (firstError) break;
  }

  const { count: remaining } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .or("explanation_source.is.null,explanation_source.eq.template");

  return NextResponse.json({
    upgraded,
    total: batch.length,
    remaining: remaining ?? 0,
    ...(firstError ? { ai_error: firstError } : {}),
  });
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
