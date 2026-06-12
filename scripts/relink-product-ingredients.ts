/**
 * Re-links product_ingredients for any product whose join table is missing rows
 * that can now be matched against the ingredients table.
 *
 * Typical cause: ingredients were unreviewed at add/import time, later classified
 * via Queue 0, but the product's join table was never updated.
 *
 * Safe to re-run — uses upsert with (product_id, ingredient_id) conflict target.
 *
 * Usage:
 *   npx tsx scripts/relink-product-ingredients.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseIngredientList, findMatch, type DbIngredient } from "../src/lib/ingredient-matcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\nRelink Product Ingredients${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // Load all ingredients and all existing product_ingredient links
  const [{ data: allIngredients }, { data: products }] = await Promise.all([
    supabase.from("ingredients").select("id, name, inci_name, status").limit(10000),
    supabase
      .from("products")
      .select("id, name, ingredient_list")
      .eq("is_archived", false)
      .eq("is_pending", false)
      .not("ingredient_list", "is", null),
  ]);

  const db = (allIngredients ?? []) as DbIngredient[];
  const productList = products ?? [];

  // Build a set of existing links: "productId:ingredientId"
  const { data: existingLinks } = await supabase
    .from("product_ingredients")
    .select("product_id, ingredient_id");
  const linked = new Set((existingLinks ?? []).map((r) => `${r.product_id}:${r.ingredient_id}`));

  let totalNewLinks = 0;
  let productsPatched = 0;

  for (const product of productList) {
    const items = parseIngredientList(product.ingredient_list as string);
    const toInsert: { product_id: string; ingredient_id: string; position: number }[] = [];
    let position = 0;

    for (const item of items) {
      const match = findMatch(item, db);
      if (!match) continue;
      if (match.id.startsWith("comedo-")) continue;
      position++;
      if (!linked.has(`${product.id}:${match.id}`)) {
        toInsert.push({ product_id: product.id, ingredient_id: match.id, position });
      }
    }

    if (toInsert.length === 0) continue;

    console.log(`  ${product.name} — +${toInsert.length} link(s)`);
    if (!DRY_RUN) {
      const { error } = await supabase
        .from("product_ingredients")
        .upsert(toInsert, { onConflict: "product_id,ingredient_id" });
      if (error) console.error(`    ✗ ${error.message}`);
      else totalNewLinks += toInsert.length;
    } else {
      totalNewLinks += toInsert.length;
    }
    productsPatched++;
  }

  if (productsPatched === 0) {
    console.log("  All product_ingredients links are up to date.\n");
  } else {
    console.log(`\n  ${productsPatched} product(s) patched, ${totalNewLinks} new link(s) added.\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
