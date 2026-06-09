import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { matchIngredients } from "@/lib/scanner";
import { isLikelyJunk } from "@/lib/junk-detector";

function normalizeIngredientList(raw: string): string {
  return raw
    .replace(/\s*\b(?:active|inactive|other)\s+ingredients?\s*:\s*/gi, ", ")
    .replace(/^,\s*/, "");
}

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401, userId: null };
  const { data: user } = await supabase
    .from("app_users")
    .select("role")
    .eq("clerk_id", userId)
    .maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403, userId: null };
  return { error: null, status: 200, userId };
}

export async function POST(req: NextRequest) {
  void req;
  const g = await guard();
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, ingredient_list")
    .or(
      "ingredient_list.ilike.%active ingredients:%," +
      "ingredient_list.ilike.%inactive ingredients:%," +
      "ingredient_list.ilike.%other ingredients:%"
    )
    .not("ingredient_list", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!products || products.length === 0) return NextResponse.json({ fixed: 0, products: [] });

  const fixed: { id: string; name: string }[] = [];

  for (const product of products) {
    if (!product.ingredient_list) continue;
    const cleaned = normalizeIngredientList(product.ingredient_list);
    if (cleaned === product.ingredient_list) continue;

    await supabaseAdmin
      .from("products")
      .update({ ingredient_list: cleaned })
      .eq("id", product.id);

    await supabaseAdmin.from("product_ingredients").delete().eq("product_id", product.id);

    const { safe, flagged, unreviewed } = await matchIngredients(cleaned);
    const seenIds = new Set<string>();
    const rows = [...safe, ...flagged]
      .filter((m) => !m.ingredient.id.startsWith("comedo-"))
      .filter((m) => {
        if (seenIds.has(m.ingredient.id)) return false;
        seenIds.add(m.ingredient.id);
        return true;
      })
      .map((m, idx) => ({
        product_id: product.id,
        ingredient_id: m.ingredient.id,
        position: idx + 1,
      }));

    if (rows.length > 0) {
      await supabaseAdmin.from("product_ingredients").insert(rows);
    }

    for (const name of unreviewed) {
      if (isLikelyJunk(name)) continue;
      const { data: existing } = await supabaseAdmin
        .from("ingredient_queue")
        .select("id, times_seen")
        .ilike("name", name)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("ingredient_queue")
          .update({ times_seen: existing.times_seen + 1, last_seen: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("ingredient_queue")
          .insert({ name, found_in: product.name, times_seen: 1 });
      }
    }

    fixed.push({ id: product.id, name: product.name });
  }

  // Remove corrupted queue entries whose names contain the section-header text
  await supabaseAdmin
    .from("ingredient_queue")
    .delete()
    .or(
      "name.ilike.%inactive ingredients:%," +
      "name.ilike.%active ingredients:%," +
      "name.ilike.%other ingredients:%"
    );

  return NextResponse.json({ fixed: fixed.length, products: fixed });
}
