import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { computeProductConcerns, type IngredientRow } from "@/lib/compute-concerns";

export async function POST(req: NextRequest) {
  const { flaggedIds, productType, profileConcerns = [], skinTypes = [], climates = [] } = await req.json();
  const profileConcernsSet = new Set(profileConcerns as string[]);

  if (!flaggedIds?.length) {
    return NextResponse.json({ results: [], sameTypeFallback: false });
  }

  // 1. Products that contain any of the user's flagged ingredients → exclude them
  const { data: hasAny } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .in("ingredient_id", flaggedIds);

  const excludedIds = [...new Set((hasAny ?? []).map((r) => r.product_id))];

  // 2. All ingredients (id, name, inci_name, status, flagged_category, structural_category) for text matching
  const { data: allIngredientsDb } = await supabase
    .from("ingredients")
    .select("id, name, inci_name, status, flagged_category, secondary_flagged_categories, structural_category");
  const allIngredients = (allIngredientsDb ?? []) as IngredientRow[];

  // 3. Candidate products (have an ingredient list, not excluded)
  const base = supabase
    .from("products")
    .select("id, name, brand, type, image_url, ingredient_list")
    .not("ingredient_list", "is", null)
    .eq("is_archived", false);

  const { data: candidates } = await (
    excludedIds.length > 0
      ? base.not("id", "in", `(${excludedIds.join(",")})`)
      : base
  );

  if (!candidates?.length) {
    return NextResponse.json({ results: [], sameTypeFallback: false });
  }

  // 4. Filter to same type, compute concerns via shared utility, sort
  const normalizedType = productType?.toLowerCase().trim() ?? null;

  const results = candidates
    .filter((p) => !normalizedType || p.type?.toLowerCase().trim() === normalizedType)
    .map((p) => {
      const counts = computeProductConcerns(
        p.ingredient_list as string,
        allIngredients,
        profileConcernsSet,
        skinTypes as string[],
        climates as string[],
        p.type,
      );
      return {
        id: p.id,
        name: p.name,
        brand: p.brand ?? null,
        type: p.type ?? null,
        image_url: p.image_url ?? null,
        ...counts,
        sameType: true,
      };
    });

  results.sort((a, b) => {
    if (a.flaggedCount !== b.flaggedCount) return a.flaggedCount - b.flaggedCount;
    if (a.sensoryCount !== b.sensoryCount) return a.sensoryCount - b.sensoryCount;
    return a.photoCount - b.photoCount;
  });

  return NextResponse.json({ results: results.slice(0, 20), sameTypeFallback: false });
}
