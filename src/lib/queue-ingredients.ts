/**
 * Shared helper: match a product's ingredient list against the DB, link any
 * recognised ingredients via product_ingredients, and push unrecognised ones
 * to ingredient_queue for Queue 0 in generate-explanations.
 *
 * Call fire-and-forget from API routes:
 *   Promise.resolve().then(() => queueIngredients(id, name, list)).catch(() => {});
 */
import { supabaseAdmin } from "@/lib/supabase-admin";
import { matchIngredients } from "@/lib/scanner";
import { isLikelyJunk } from "@/lib/junk-detector";

export async function queueIngredients(
  productId: string,
  productName: string,
  ingredientList: string,
): Promise<void> {
  const { unreviewed, safe, flagged } = await matchIngredients(ingredientList);

  // Link recognised ingredients — upsert so re-runs are safe
  const seenIds = new Set<string>();
  const rows = [...safe, ...flagged]
    .filter((m) => !m.ingredient.id.startsWith("comedo-"))
    .filter((m) => {
      if (seenIds.has(m.ingredient.id)) return false;
      seenIds.add(m.ingredient.id);
      return true;
    })
    .map((m, idx) => ({ product_id: productId, ingredient_id: m.ingredient.id, position: idx + 1 }));

  if (rows.length > 0) {
    await supabaseAdmin
      .from("product_ingredients")
      .upsert(rows, { onConflict: "product_id,ingredient_id" });
  }

  // Recompute duplicate pairs: clear pending pairs first (keeps dismissed intact),
  // then re-detect against all same-brand approved products.
  await supabaseAdmin
    .from("suspected_duplicates")
    .delete()
    .or(`product_a_id.eq.${productId},product_b_id.eq.${productId}`)
    .eq("status", "pending");
  await supabaseAdmin.rpc("find_duplicates_for_product", { target_id: productId });

  // Queue unrecognised ingredients for AI classification
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
        .insert({ name, found_in: productName, times_seen: 1 });
    }
  }
}
