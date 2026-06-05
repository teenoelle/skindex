import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { queueIngredients } from "@/lib/queue-ingredients";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401, userId: null };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403, userId: null };
  return { error: null, status: 200, userId };
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  // Fetch product + linked ingredients with their current explanations
  const [productRes, ingredientsRes] = await Promise.all([
    supabaseAdmin.from("products").select("name, ingredient_list").eq("id", productId).maybeSingle(),
    supabaseAdmin
      .from("product_ingredients")
      .select("ingredients(name, explanation, explanation_structured)")
      .eq("product_id", productId),
  ]);

  const product = productRes.data;
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Build snapshot: { ingredientName → { explanation, explanation_structured } }
  type IngRow = { ingredients: { name: string; explanation: string | null; explanation_structured: unknown } | null };
  const snapshot: Record<string, { explanation: string | null; explanation_structured: unknown }> = {};
  for (const row of ((ingredientsRes.data ?? []) as unknown as IngRow[])) {
    if (row.ingredients) {
      snapshot[row.ingredients.name] = {
        explanation: row.ingredients.explanation,
        explanation_structured: row.ingredients.explanation_structured,
      };
    }
  }

  // Mark all open reports for this product as in_review and save snapshot
  await supabaseAdmin
    .from("product_reports")
    .update({ status: "in_review", ingredient_snapshot: snapshot })
    .eq("product_id", productId)
    .eq("status", "open");

  // Re-queue ingredients for reclassification
  if (product.ingredient_list) {
    Promise.resolve()
      .then(() => queueIngredients(productId, product.name, product.ingredient_list!))
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
