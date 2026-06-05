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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { productId } = await params;

  // Get the most recent in_review report's snapshot
  const { data: report } = await supabaseAdmin
    .from("product_reports")
    .select("ingredient_snapshot, created_at, note, user_id")
    .eq("product_id", productId)
    .eq("status", "in_review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get current ingredient explanations for the product
  const { data: ingRows } = await supabaseAdmin
    .from("product_ingredients")
    .select("ingredients(name, explanation, explanation_structured, status, category)")
    .eq("product_id", productId);

  type IngRow = { ingredients: { name: string; explanation: string | null; explanation_structured: unknown; status: string | null; category: string | null } | null };
  const current: Record<string, { explanation: string | null; explanation_structured: unknown; status: string | null; category: string | null }> = {};
  for (const row of ((ingRows ?? []) as unknown as IngRow[])) {
    if (row.ingredients) {
      current[row.ingredients.name] = {
        explanation: row.ingredients.explanation,
        explanation_structured: row.ingredients.explanation_structured,
        status: row.ingredients.status,
        category: row.ingredients.category,
      };
    }
  }

  return NextResponse.json({
    snapshot: report?.ingredient_snapshot ?? null,
    current,
    hasInReviewReports: !!report,
  });
}
