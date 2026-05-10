import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { flaggedIds, productType } = await req.json();

  if (!flaggedIds?.length) {
    return NextResponse.json({ results: [], sameTypeFallback: false });
  }

  // 1. Products that contain any of the user's flagged ingredients → exclude them
  const { data: hasAny } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .in("ingredient_id", flaggedIds);

  const excludedIds = [...new Set((hasAny ?? []).map((r) => r.product_id))];

  // 2. All flagged ingredient IDs in the DB (for ranking candidates by how many they have)
  const { data: allFlagged } = await supabase
    .from("ingredients")
    .select("id")
    .eq("status", "flagged");
  const allFlaggedIds = (allFlagged ?? []).map((i) => i.id);

  // 3. Candidate products (have an ingredient list, not excluded)
  const base = supabase
    .from("products")
    .select("id, name, brand, type, image_url")
    .not("ingredient_list", "is", null);

  const { data: candidates } = await (
    excludedIds.length > 0
      ? base.not("id", "in", `(${excludedIds.join(",")})`)
      : base
  );

  if (!candidates?.length) {
    return NextResponse.json({ results: [], sameTypeFallback: false });
  }

  // 4. Count flagged ingredients per candidate using the junction table
  const candidateIds = candidates.map((p) => p.id);
  const { data: flaggedLinks } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .in("product_id", candidateIds)
    .in("ingredient_id", allFlaggedIds);

  const flaggedCounts = new Map<string, number>();
  for (const link of flaggedLinks ?? []) {
    flaggedCounts.set(link.product_id, (flaggedCounts.get(link.product_id) ?? 0) + 1);
  }

  // 5. Build and sort results: same type first, then by flagged count ascending
  const normalizedType = productType?.toLowerCase().trim() ?? null;

  const results = candidates.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    type: p.type ?? null,
    image_url: p.image_url ?? null,
    flaggedCount: flaggedCounts.get(p.id) ?? 0,
    sameType: normalizedType ? p.type?.toLowerCase().trim() === normalizedType : false,
  }));

  results.sort((a, b) => {
    if (a.sameType !== b.sameType) return a.sameType ? -1 : 1;
    return a.flaggedCount - b.flaggedCount;
  });

  const sameTypeFallback = normalizedType !== null && results.filter((r) => r.sameType).length < 3;

  return NextResponse.json({ results: results.slice(0, 8), sameTypeFallback });
}
