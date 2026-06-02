import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

type FlagRow = {
  id: string;
  ingredient_id: string;
  reason: string | null;
  created_at: string;
  ingredients: { id: string; name: string; explanation_source: string | null } | null;
};

export async function GET() {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { data, error } = await supabaseAdmin
    .from("ingredient_flags")
    .select("id, ingredient_id, reason, created_at, ingredients(id, name, explanation_source)")
    .is("reviewed_at", null)
    .order("created_at", { ascending: false })
    .limit(200) as { data: FlagRow[] | null; error: unknown };

  if (error) return NextResponse.json({ error: "Failed to load flags" }, { status: 500 });

  // Group by ingredient_id so each ingredient appears once with all its reasons
  const grouped = new Map<string, {
    ingredient_id: string;
    ingredient_name: string;
    explanation_source: string | null;
    flag_count: number;
    reasons: string[];
    latest_flag: string;
    flag_ids: string[];
  }>();

  for (const row of data ?? []) {
    const ingId = row.ingredient_id;
    if (!grouped.has(ingId)) {
      grouped.set(ingId, {
        ingredient_id: ingId,
        ingredient_name: row.ingredients?.name ?? ingId,
        explanation_source: row.ingredients?.explanation_source ?? null,
        flag_count: 0,
        reasons: [],
        latest_flag: row.created_at,
        flag_ids: [],
      });
    }
    const g = grouped.get(ingId)!;
    g.flag_count++;
    if (row.reason) g.reasons.push(row.reason);
    g.flag_ids.push(row.id);
    if (row.created_at > g.latest_flag) g.latest_flag = row.created_at;
  }

  return NextResponse.json({ flags: [...grouped.values()] });
}

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { ingredientId, action } = await req.json().catch(() => ({}));
  if (!ingredientId) return NextResponse.json({ error: "Missing ingredientId" }, { status: 400 });
  if (!["reclassify", "regenerate", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Apply the action to the ingredient
  if (action === "reclassify") {
    await supabaseAdmin
      .from("ingredients")
      .update({ explanation_source: "template_unclassified" })
      .eq("id", ingredientId);
  } else if (action === "regenerate") {
    await supabaseAdmin
      .from("ingredients")
      .update({ explanation_source: "template" })
      .eq("id", ingredientId);
  }
  // dismiss: no change to the ingredient

  // Mark all pending flags for this ingredient as reviewed
  await supabaseAdmin
    .from("ingredient_flags")
    .update({ reviewed_at: new Date().toISOString(), review_action: action })
    .eq("ingredient_id", ingredientId)
    .is("reviewed_at", null);

  return NextResponse.json({ ok: true });
}
