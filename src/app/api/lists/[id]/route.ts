import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { UNIVERSAL_CONCERN_SET } from "@/lib/concern-breakdown";
import { countComedogenicPatternMatches } from "@/lib/comedogenic";
import { countSensoryPatternMatches } from "@/lib/sensory";
import { countPhotoPatternMatches } from "@/lib/photo";

async function ownedList(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_lists")
    .select("id, user_id, name, is_public")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await params;

  const concernsParam = req.nextUrl.searchParams.get("concerns");
  const profileConcerns: string[] = concernsParam ? concernsParam.split(",").filter(Boolean) : [];
  const profileConcernsSet = new Set(profileConcerns);

  const { data: list } = await supabaseAdmin
    .from("user_lists")
    .select("id, user_id, name, is_public, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!list.is_public && list.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: rawItems } = await supabaseAdmin
    .from("user_list_items")
    .select("id, product_id, note, position, added_at, products(id, name, brand, image_url, type, ingredient_list)")
    .eq("list_id", id)
    .order("position", { ascending: true })
    .order("added_at", { ascending: true });

  const items = rawItems ?? [];
  const productIds = items.map((it) => it.product_id).filter(Boolean);

  // Fetch all flagged ingredients (id + category) for breakdown
  const { data: allFlagged } = await supabaseAdmin
    .from("ingredients")
    .select("id, flagged_category")
    .eq("status", "flagged");

  const allFlaggedIds = (allFlagged ?? []).map((i) => i.id);
  const allFlaggedCatMap = new Map((allFlagged ?? []).map((i) => [i.id, i.flagged_category as string | null]));

  // Fetch product-ingredient links for listed products × flagged ingredients
  const { data: flaggedLinks } = productIds.length > 0
    ? await supabaseAdmin
        .from("product_ingredients")
        .select("product_id, ingredient_id")
        .in("product_id", productIds)
        .in("ingredient_id", allFlaggedIds)
    : { data: [] };

  const dbCounts = new Map<string, number>();
  const universalCounts = new Map<string, number>();
  const profileCounts = new Map<string, number>();

  for (const link of flaggedLinks ?? []) {
    dbCounts.set(link.product_id, (dbCounts.get(link.product_id) ?? 0) + 1);
    const cat = allFlaggedCatMap.get(link.ingredient_id ?? "");
    if (cat && UNIVERSAL_CONCERN_SET.has(cat))
      universalCounts.set(link.product_id, (universalCounts.get(link.product_id) ?? 0) + 1);
    if (cat && profileConcernsSet.has(cat))
      profileCounts.set(link.product_id, (profileCounts.get(link.product_id) ?? 0) + 1);
  }

  type ProductRow = { id: string; name: string; brand: string | null; image_url: string | null; type: string | null; ingredient_list: string | null };

  // Strip ingredient_list from products in response, add concern fields
  const enrichedItems = items.map((item) => {
    // Supabase types the join as array, but a FK many-to-one returns a single object at runtime
    const p = (item.products as unknown) as (ProductRow | null);
    if (!p) return item;
    const pid = item.product_id;
    const ingredientList = p.ingredient_list ?? null;
    const dbCount = dbCounts.get(pid) ?? 0;
    const patternCount = ingredientList ? countComedogenicPatternMatches(ingredientList) : 0;
    const flaggedCount = dbCount + patternCount;
    const sensoryCount = ingredientList ? countSensoryPatternMatches(ingredientList) : 0;
    const photoCount = ingredientList ? countPhotoPatternMatches(ingredientList) : 0;
    return {
      ...item,
      products: {
        id: p.id,
        name: p.name,
        brand: p.brand,
        image_url: p.image_url,
        type: p.type,
        flaggedCount,
        sensoryCount,
        photoCount,
        universalConcernCount: universalCounts.get(pid) ?? 0,
        profileMatchedCount: profileConcernsSet.size > 0 ? (profileCounts.get(pid) ?? 0) : undefined,
      },
    };
  });

  return NextResponse.json({ list, items: enrichedItems, isOwner: list.user_id === userId });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await ownedList(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.is_public !== undefined) updates.is_public = body.is_public;

  const { data, error } = await supabaseAdmin
    .from("user_lists")
    .update(updates)
    .eq("id", id)
    .select("id, name, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await ownedList(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("user_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
