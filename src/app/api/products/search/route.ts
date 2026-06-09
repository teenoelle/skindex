import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { countComedogenicPatternMatches } from "@/lib/comedogenic";
import { countSensoryPatternMatches, countProfileSensoryMatches } from "@/lib/sensory";
import { countPhotoPatternMatches } from "@/lib/photo";

const UNIVERSAL_CATS = [
  "fragrance-allergen", "preservative-allergen", "formaldehyde releaser",
  "sensitizing preservative", "biocide",
];

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ products: [] });

  const concernsParam = req.nextUrl.searchParams.get("concerns");
  const skinTypesParam = req.nextUrl.searchParams.get("skinTypes");
  const climatesParam = req.nextUrl.searchParams.get("climates");
  const concerns = concernsParam ? concernsParam.split(",").filter(Boolean) : [];
  const skinTypes = skinTypesParam ? skinTypesParam.split(",").filter(Boolean) : [];
  const climates = climatesParam ? climatesParam.split(",").filter(Boolean) : [];

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, image_url, ingredient_list, type")
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    .not("ingredient_list", "is", null)
    .eq("is_archived", false)
    .eq("is_pending", false)
    .limit(40);

  if (!products?.length) return NextResponse.json({ products: [] });

  const productIds = products.map((p) => p.id);

  const [
    { data: allFlagged },
    { data: universalIngredients },
  ] = await Promise.all([
    supabase.from("ingredients").select("id").eq("status", "flagged"),
    supabase.from("ingredients").select("id").in("flagged_category", UNIVERSAL_CATS),
  ]);

  const allFlaggedIds = (allFlagged ?? []).map((i) => i.id);
  const universalIds = (universalIngredients ?? []).map((i) => i.id);

  const [
    { data: flaggedLinks },
    { data: universalLinks },
  ] = await Promise.all([
    allFlaggedIds.length > 0
      ? supabase.from("product_ingredients").select("product_id").in("product_id", productIds).in("ingredient_id", allFlaggedIds)
      : Promise.resolve({ data: [] }),
    universalIds.length > 0
      ? supabase.from("product_ingredients").select("product_id").in("product_id", productIds).in("ingredient_id", universalIds)
      : Promise.resolve({ data: [] }),
  ]);

  const dbCounts = new Map<string, number>();
  for (const link of flaggedLinks ?? []) {
    dbCounts.set(link.product_id, (dbCounts.get(link.product_id) ?? 0) + 1);
  }
  const universalCounts = new Map<string, number>();
  for (const link of universalLinks ?? []) {
    universalCounts.set(link.product_id, (universalCounts.get(link.product_id) ?? 0) + 1);
  }

  const profileCounts = new Map<string, number>();
  if (concerns.length > 0) {
    const { data: concernIngredients } = await supabase
      .from("ingredients").select("id").in("flagged_category", concerns);
    const concernIds = (concernIngredients ?? []).map((i) => i.id);
    if (concernIds.length > 0) {
      const { data: concernLinks } = await supabase
        .from("product_ingredients").select("product_id")
        .in("product_id", productIds).in("ingredient_id", concernIds);
      for (const link of concernLinks ?? []) {
        profileCounts.set(link.product_id, (profileCounts.get(link.product_id) ?? 0) + 1);
      }
    }
  }

  const scored = products
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand ?? null,
      image_url: p.image_url ?? null,
      ingredient_list: p.ingredient_list ?? null,
      type: p.type ?? null,
      flaggedCount: (dbCounts.get(p.id) ?? 0) + (p.ingredient_list ? countComedogenicPatternMatches(p.ingredient_list) : 0),
      sensoryCount: p.ingredient_list ? countSensoryPatternMatches(p.ingredient_list) : 0,
      photoCount: p.ingredient_list ? countPhotoPatternMatches(p.ingredient_list) : 0,
      universalConcernCount: universalCounts.get(p.id) ?? 0,
      profileFlaggedCount: concerns.length > 0 ? (profileCounts.get(p.id) ?? 0) : undefined,
      profileSensoryCount:
        skinTypes.length > 0 || climates.length > 0
          ? (p.ingredient_list ? countProfileSensoryMatches(p.ingredient_list, skinTypes, climates, false) : 0)
          : undefined,
    }))
    .sort((a, b) => {
      if (a.flaggedCount !== b.flaggedCount) return a.flaggedCount - b.flaggedCount;
      if (a.sensoryCount !== b.sensoryCount) return a.sensoryCount - b.sensoryCount;
      return a.photoCount - b.photoCount;
    })
    .slice(0, 8);

  return NextResponse.json({ products: scored });
}
