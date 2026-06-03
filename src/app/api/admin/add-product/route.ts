import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { matchIngredients } from "@/lib/scanner";
import { isLikelyJunk } from "@/lib/junk-detector";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, brand, type, ingredient_list, image_url, iherb_url, source_url } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  if (!ingredient_list?.trim()) return NextResponse.json({ error: "Ingredient list is required" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A product with this name already exists.", productId: existing.id }, { status: 409 });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("products")
    .insert({
      name: name.trim(),
      brand: brand?.trim() || null,
      type: type?.trim() || null,
      ingredient_list: ingredient_list.trim(),
      source: "community",
      is_pending: false,
      ...(image_url?.trim() ? { image_url: image_url.trim() } : {}),
      ...(iherb_url?.trim() ? { iherb_url: iherb_url.trim() } : {}),
      ...(source_url?.trim() ? { source_url: source_url.trim() } : {}),
    })
    .select("id, name, brand, type, image_url, iherb_url, source_url, source, created_at, ingredient_list")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(userId, "add_product", "product", inserted.id, { name: inserted.name });

  // Fire-and-forget: queue any unrecognised ingredients for /generate-explanations
  const productName = inserted.name;
  const productId = inserted.id;
  Promise.resolve().then(async () => {
    try {
      const { unreviewed, safe, flagged } = await matchIngredients(ingredient_list.trim());

      // Link recognised ingredients to the product
      const seenIds = new Set<string>();
      const rows = [...safe, ...flagged]
        .filter((m) => !m.ingredient.id.startsWith("comedo-"))
        .filter((m) => { if (seenIds.has(m.ingredient.id)) return false; seenIds.add(m.ingredient.id); return true; })
        .map((m, idx) => ({ product_id: productId, ingredient_id: m.ingredient.id, position: idx + 1 }));
      if (rows.length > 0) {
        await supabaseAdmin.from("product_ingredients").insert(rows);
      }

      // Queue unknowns for AI classification
      for (const name of unreviewed) {
        if (isLikelyJunk(name)) continue;
        const { data: existing } = await supabase
          .from("ingredient_queue")
          .select("id, times_seen")
          .ilike("name", name)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("ingredient_queue")
            .update({ times_seen: existing.times_seen + 1, last_seen: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("ingredient_queue")
            .insert({ name, found_in: productName, times_seen: 1 });
        }
      }
    } catch { /* never block the response */ }
  });

  return NextResponse.json({ product: inserted });
}
