import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extractIngredientsFromUrl } from "@/lib/extract-ingredients";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to add products" }, { status: 401 });
  }

  const { name, brand, type, ingredient_list, url, image_url, iherb_url, source_url } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  const hasIngredients = !!ingredient_list?.trim();
  const hasUrl = !!url?.trim();

  if (!hasIngredients && !hasUrl) {
    return NextResponse.json({ error: "Provide an ingredient list or a product URL" }, { status: 400 });
  }

  let ingredientText: string | null = ingredient_list?.trim() ?? null;
  let extractedImageUrl: string | null = null;

  if (!ingredientText && hasUrl) {
    const extracted = await extractIngredientsFromUrl(url.trim());
    ingredientText = extracted?.ingredients ?? null;
    extractedImageUrl = extracted?.image_url ?? null;
    if (!ingredientText) {
      return NextResponse.json(
        { error: "Could not find an ingredients list on that page. Try pasting the ingredient list directly instead." },
        { status: 400 }
      );
    }
  }

  // Deduplicate by exact name (case-insensitive)
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A product with this name already exists.", productId: existing.id },
      { status: 409 }
    );
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("products")
    .insert({
      name: name.trim(),
      brand: brand?.trim() || null,
      type: type?.trim() || null,
      ingredient_list: ingredientText,
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
      source: "community",
      is_pending: true,
      ...(image_url?.trim() ? { image_url: image_url.trim() } : extractedImageUrl ? { image_url: extractedImageUrl } : {}),
      ...(iherb_url?.trim() ? { iherb_url: iherb_url.trim() } : {}),
      ...(source_url?.trim() ? { source_url: source_url.trim() } : hasUrl ? { source_url: url.trim() } : {}),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ productId: inserted.id });
}
