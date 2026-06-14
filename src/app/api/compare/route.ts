import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) return NextResponse.json({ error: "ids required" }, { status: 400 });

  const ids = [...new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 6);
  if (ids.length === 0) return NextResponse.json({ error: "No valid ids" }, { status: 400 });

  const [{ data: products }, { data: piRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, type, image_url, iherb_url, source_url, ingredient_list, is_pending, created_at, source")
      .in("id", ids),
    supabase
      .from("product_ingredients")
      .select("product_id, position, ingredient_id")
      .in("product_id", ids)
      .order("position"),
  ]);

  if (!products) return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });

  const ingredientIds = [...new Set((piRows ?? []).map((r) => r.ingredient_id))];

  const ingredientMap = new Map<string, Record<string, unknown>>();
  if (ingredientIds.length > 0) {
    const { data: ingRows } = await supabase
      .from("ingredients")
      .select("id, name, inci_name, status, explanation, explanation_structured, category, flagged_category, secondary_flagged_categories, secondary_benefit_categories, structural_category, skin_climate_notes")
      .in("id", ingredientIds);
    for (const ing of ingRows ?? []) {
      ingredientMap.set(ing.id, ing);
    }
  }

  const linksByProduct = new Map<string, { position: number; ingredient_id: string }[]>();
  for (const row of piRows ?? []) {
    if (!linksByProduct.has(row.product_id)) linksByProduct.set(row.product_id, []);
    linksByProduct.get(row.product_id)!.push({ position: row.position, ingredient_id: row.ingredient_id });
  }

  const result = ids.map((id) => {
    const p = products.find((q) => q.id === id);
    if (!p) return null;
    const linked = (linksByProduct.get(id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ position: l.position, ingredient: ingredientMap.get(l.ingredient_id) ?? null }));
    return { ...p, linked };
  }).filter(Boolean);

  return NextResponse.json({ products: result });
}
