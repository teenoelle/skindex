import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { matchIngredients } from "@/lib/scanner";

async function rescanIngredients(productId: string, productName: string, newList: string) {
  try {
    const { safe, flagged, unreviewed } = await matchIngredients(newList);

    const seenIds = new Set<string>();
    const rows = [...safe, ...flagged]
      .filter((m) => !m.ingredient.id.startsWith("comedo-"))
      .filter((m) => { if (seenIds.has(m.ingredient.id)) return false; seenIds.add(m.ingredient.id); return true; })
      .map((m, idx) => ({ product_id: productId, ingredient_id: m.ingredient.id, position: idx + 1 }));

    await supabaseAdmin.from("product_ingredients").delete().eq("product_id", productId);
    if (rows.length > 0) {
      await supabaseAdmin.from("product_ingredients").insert(rows);
    }

    for (const name of unreviewed) {
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
  } catch { /* fire-and-forget: never block the save response */ }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users")
    .select("role")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { productId, name, brand, type, ingredient_list, iherb_url, image_url, source_url } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const patch: Record<string, string | null> = {};
  if (name !== undefined) patch.name = name?.trim() || null;
  if (brand !== undefined) patch.brand = brand?.trim() || null;
  if (type !== undefined) patch.type = type?.trim() || null;
  if (ingredient_list !== undefined) patch.ingredient_list = ingredient_list?.trim() || null;
  if (iherb_url !== undefined) patch.iherb_url = iherb_url?.trim() || null;
  if (image_url !== undefined) patch.image_url = image_url?.trim() || null;
  if (source_url !== undefined) patch.source_url = source_url?.trim() || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("name, brand, type, source_url, image_url, iherb_url, ingredient_list")
    .eq("id", productId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changes: Record<string, { before: string | null; after: string | null }> = {};
  if (name !== undefined) changes.name = { before: existing?.name ?? null, after: patch.name ?? null };
  if (brand !== undefined) changes.brand = { before: existing?.brand ?? null, after: patch.brand ?? null };
  if (type !== undefined) changes.type = { before: existing?.type ?? null, after: patch.type ?? null };
  if (source_url !== undefined) changes.source_url = { before: existing?.source_url ?? null, after: patch.source_url ?? null };
  if (image_url !== undefined) changes.image_url = { before: existing?.image_url ?? null, after: patch.image_url ?? null };
  if (iherb_url !== undefined) changes.iherb_url = { before: existing?.iherb_url ?? null, after: patch.iherb_url ?? null };

  await writeAuditLog(userId, "update_product", "product", productId, {
    name: existing?.name ?? productId,
    changes,
  });

  const newList = patch.ingredient_list;
  if (newList && newList !== existing?.ingredient_list) {
    const productDisplayName = patch.name ?? existing?.name ?? productId;
    rescanIngredients(productId, productDisplayName, newList);
  }

  return NextResponse.json({ ok: true });
}
