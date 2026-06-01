import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { countComedogenicPatternMatches } from "@/lib/comedogenic";
import { countSensoryPatternMatches, countProfileSensoryMatches } from "@/lib/sensory";
import { countPhotoPatternMatches } from "@/lib/photo";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");

  if (!type) {
    // Fetch all canonical types and live product counts in parallel
    const [{ data: allTypes }, { data: products }] = await Promise.all([
      supabase.from("product_types").select("name"),
      supabase
        .from("products")
        .select("type")
        .not("ingredient_list", "is", null)
        .eq("is_archived", false),
    ]);

    const counts: Record<string, number> = {};
    for (const row of products ?? []) {
      const t = row.type?.trim();
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }

    // Merge: every canonical type appears, 0 if no products yet
    const types = (allTypes ?? [])
      .map(({ name }) => ({ name, count: counts[name] ?? 0 }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ types });
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, image_url, ingredient_list")
    .eq("type", type)
    .not("ingredient_list", "is", null)
    .eq("is_archived", false);

  if (!products?.length) return NextResponse.json({ products: [] });

  const productIds = products.map((p) => p.id);

  // All flagged ingredients (for general flaggedCount)
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

  // Profile-specific flagged count (optional — when concerns param is present)
  const concernsParam = req.nextUrl.searchParams.get("concerns");
  const concerns = concernsParam ? concernsParam.split(",").filter(Boolean) : [];
  const isRinseOff = req.nextUrl.searchParams.get("isRinseOff") === "1";
  const RINSE_OFF_SUPPRESS_DB_CATS = new Set(["pore-clogger", "occlusive", "bacteria-trap"]);
  const effectiveConcerns = isRinseOff
    ? concerns.filter((c) => !RINSE_OFF_SUPPRESS_DB_CATS.has(c))
    : concerns;
  const profileCounts = new Map<string, number>();

  if (effectiveConcerns.length > 0) {
    const { data: concernIngredients } = await supabase
      .from("ingredients")
      .select("id")
      .in("flagged_category", effectiveConcerns);
    const concernIds = (concernIngredients ?? []).map((i) => i.id);

    if (concernIds.length > 0) {
      const { data: concernLinks } = await supabase
        .from("product_ingredients")
        .select("product_id")
        .in("product_id", productIds)
        .in("ingredient_id", concernIds);
      for (const link of concernLinks ?? []) {
        profileCounts.set(link.product_id, (profileCounts.get(link.product_id) ?? 0) + 1);
      }
    }
  }

  // Universal concern count — ingredients that are concerns for all skin types
  const UNIVERSAL_CATS = [
    "fragrance-allergen", "preservative-allergen", "formaldehyde releaser",
    "sensitizing preservative", "biocide", "Sulfate Surfactant", "Drying Solvent",
  ];
  const { data: universalIngredients } = await supabase
    .from("ingredients").select("id").in("flagged_category", UNIVERSAL_CATS);
  const universalIds = (universalIngredients ?? []).map((i) => i.id);
  const universalCounts = new Map<string, number>();
  if (universalIds.length > 0) {
    const { data: universalLinks } = await supabase
      .from("product_ingredients").select("product_id")
      .in("product_id", productIds).in("ingredient_id", universalIds);
    for (const link of universalLinks ?? []) {
      universalCounts.set(link.product_id, (universalCounts.get(link.product_id) ?? 0) + 1);
    }
  }

  // Profile-specific sensory count (runtime pattern matches that match the user's skin types)
  const skinTypesParam = req.nextUrl.searchParams.get("skinTypes");
  const climatesParam = req.nextUrl.searchParams.get("climates");
  const skinTypes = skinTypesParam ? skinTypesParam.split(",").filter(Boolean) : [];
  const climates = climatesParam ? climatesParam.split(",").filter(Boolean) : [];

  const results = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    image_url: p.image_url ?? null,
    ingredient_list: p.ingredient_list ?? null,
    flaggedCount: (dbCounts.get(p.id) ?? 0) + (p.ingredient_list ? countComedogenicPatternMatches(p.ingredient_list) : 0),
    sensoryCount: p.ingredient_list ? countSensoryPatternMatches(p.ingredient_list) : 0,
    photoCount: p.ingredient_list ? countPhotoPatternMatches(p.ingredient_list) : 0,
    universalConcernCount: universalCounts.get(p.id) ?? 0,
    profileFlaggedCount: concerns.length > 0 ? (profileCounts.get(p.id) ?? 0) : undefined,
    profileSensoryCount: skinTypes.length > 0 || climates.length > 0
      ? (p.ingredient_list ? countProfileSensoryMatches(p.ingredient_list, skinTypes, climates, isRinseOff) : 0)
      : undefined,
  })).sort((a, b) => {
    if (a.flaggedCount !== b.flaggedCount) return a.flaggedCount - b.flaggedCount;
    if (a.sensoryCount !== b.sensoryCount) return a.sensoryCount - b.sensoryCount;
    return a.photoCount - b.photoCount;
  });

  return NextResponse.json({ products: results });
}
