import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeProductConcerns, type IngredientRow } from "@/lib/compute-concerns";

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
  const skinTypesParam = req.nextUrl.searchParams.get("skinTypes");
  const climatesParam = req.nextUrl.searchParams.get("climates");

  const profileConcerns: string[] = concernsParam ? concernsParam.split(",").filter(Boolean) : [];
  const profileConcernsSet = new Set(profileConcerns);
  const skinTypes: string[] = skinTypesParam ? skinTypesParam.split(",").filter(Boolean) : [];
  const climates: string[] = climatesParam ? climatesParam.split(",").filter(Boolean) : [];

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

  // Fetch ALL ingredients once — same as matchIngredients() in @/lib/scanner
  const { data: ingredientsDb } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, inci_name, status, flagged_category, structural_category");
  const allIngredients = (ingredientsDb ?? []) as IngredientRow[];

  type ProductRow = { id: string; name: string; brand: string | null; image_url: string | null; type: string | null; ingredient_list: string | null };

  const enrichedItems = items.map((item) => {
    const p = (item.products as unknown) as (ProductRow | null);
    if (!p) return item;
    const ingredientList = p.ingredient_list ?? null;

    if (!ingredientList) {
      return {
        ...item,
        products: {
          id: p.id, name: p.name, brand: p.brand, image_url: p.image_url, type: p.type,
          flaggedCount: 0, sensoryCount: 0, photoCount: 0,
          universalConcernCount: 0,
          profileMatchedCount: (profileConcernsSet.size > 0 || skinTypes.length > 0 || climates.length > 0) ? 0 : undefined,
        },
      };
    }

    const counts = computeProductConcerns(
      ingredientList,
      allIngredients,
      profileConcernsSet,
      skinTypes,
      climates,
      p.type,
    );

    return {
      ...item,
      products: {
        id: p.id, name: p.name, brand: p.brand, image_url: p.image_url, type: p.type,
        ...counts,
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
