import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { countComedogenicPatternMatches } from "@/lib/comedogenic";
import { countSensoryPatternMatches } from "@/lib/sensory";
import { countPhotoPatternMatches } from "@/lib/photo";
import { UNIVERSAL_CONCERN_SET } from "@/lib/concern-breakdown";

export async function POST(req: NextRequest) {
  const { flaggedIds, productType, profileConcerns = [] } = await req.json();
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

  // 2. All flagged ingredients (id + category) for ranking and breakdown
  const { data: allFlagged } = await supabase
    .from("ingredients")
    .select("id, flagged_category")
    .eq("status", "flagged");
  const allFlaggedIds = (allFlagged ?? []).map((i) => i.id);
  const allFlaggedCatMap = new Map((allFlagged ?? []).map((i) => [i.id, i.flagged_category as string | null]));

  // 3. Candidate products (have an ingredient list, not excluded)
  const base = supabase
    .from("products")
    .select("id, name, brand, type, image_url")
    .not("ingredient_list", "is", null)
    .eq("is_archived", false);

  const { data: candidates } = await (
    excludedIds.length > 0
      ? base.not("id", "in", `(${excludedIds.join(",")})`)
      : base
  ).select("id, name, brand, type, image_url, ingredient_list");

  if (!candidates?.length) {
    return NextResponse.json({ results: [], sameTypeFallback: false });
  }

  // 4. Count flagged ingredients per candidate + compute breakdown
  const candidateIds = candidates.map((p) => p.id);
  const { data: flaggedLinks } = await supabase
    .from("product_ingredients")
    .select("product_id, ingredient_id")
    .in("product_id", candidateIds)
    .in("ingredient_id", allFlaggedIds);

  const flaggedCounts = new Map<string, number>();
  const universalCounts = new Map<string, number>();
  const profileCounts = new Map<string, number>();

  for (const link of flaggedLinks ?? []) {
    flaggedCounts.set(link.product_id, (flaggedCounts.get(link.product_id) ?? 0) + 1);
    const cat = allFlaggedCatMap.get(link.ingredient_id ?? "");
    if (cat && UNIVERSAL_CONCERN_SET.has(cat))
      universalCounts.set(link.product_id, (universalCounts.get(link.product_id) ?? 0) + 1);
    if (cat && profileConcernsSet.has(cat))
      profileCounts.set(link.product_id, (profileCounts.get(link.product_id) ?? 0) + 1);
  }

  // 5. Build, filter to same type, and sort by concern counts ascending
  const normalizedType = productType?.toLowerCase().trim() ?? null;

  const results = candidates
    .filter((p) => !normalizedType || p.type?.toLowerCase().trim() === normalizedType)
    .map((p) => {
      const dbCount = flaggedCounts.get(p.id) ?? 0;
      const patternCount = p.ingredient_list ? countComedogenicPatternMatches(p.ingredient_list) : 0;
      return {
        id: p.id,
        name: p.name,
        brand: p.brand ?? null,
        type: p.type ?? null,
        image_url: p.image_url ?? null,
        flaggedCount: dbCount + patternCount,
        sensoryCount: p.ingredient_list ? countSensoryPatternMatches(p.ingredient_list) : 0,
        photoCount: p.ingredient_list ? countPhotoPatternMatches(p.ingredient_list) : 0,
        universalConcernCount: universalCounts.get(p.id) ?? 0,
        profileMatchedCount: profileConcernsSet.size > 0 ? (profileCounts.get(p.id) ?? 0) : undefined,
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
