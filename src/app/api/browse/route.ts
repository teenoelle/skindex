import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { countComedogenicPatternMatches } from "@/lib/comedogenic";
import { countSensoryPatternMatches } from "@/lib/sensory";
import { countPhotoPatternMatches } from "@/lib/photo";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");

  if (!type) {
    // Return type counts for the grid
    const { data } = await supabase
      .from("products")
      .select("type")
      .not("ingredient_list", "is", null)
      .eq("is_archived", false);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const t = row.type?.trim();
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }

    const types = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ types });
  }

  // Return products for a specific type
  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, image_url, ingredient_list")
    .eq("type", type)
    .not("ingredient_list", "is", null)
    .eq("is_archived", false);

  if (!products?.length) return NextResponse.json({ products: [] });

  const productIds = products.map((p) => p.id);

  const { data: allFlagged } = await supabase
    .from("ingredients")
    .select("id")
    .eq("status", "flagged");
  const allFlaggedIds = (allFlagged ?? []).map((i) => i.id);

  const { data: flaggedLinks } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .in("product_id", productIds)
    .in("ingredient_id", allFlaggedIds);

  const dbCounts = new Map<string, number>();
  for (const link of flaggedLinks ?? []) {
    dbCounts.set(link.product_id, (dbCounts.get(link.product_id) ?? 0) + 1);
  }

  const results = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    image_url: p.image_url ?? null,
    flaggedCount: (dbCounts.get(p.id) ?? 0) + (p.ingredient_list ? countComedogenicPatternMatches(p.ingredient_list) : 0),
    sensoryCount: p.ingredient_list ? countSensoryPatternMatches(p.ingredient_list) : 0,
    photoCount: p.ingredient_list ? countPhotoPatternMatches(p.ingredient_list) : 0,
  })).sort((a, b) => {
    if (a.flaggedCount !== b.flaggedCount) return a.flaggedCount - b.flaggedCount;
    if (a.sensoryCount !== b.sensoryCount) return a.sensoryCount - b.sensoryCount;
    return a.photoCount - b.photoCount;
  });

  return NextResponse.json({ products: results });
}
