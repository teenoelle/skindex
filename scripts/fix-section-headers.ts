/**
 * Finds products whose ingredient_list has an inline section header
 * (e.g. "Zinc Oxide (14.5%) Inactive Ingredients: Bentonite") and fixes them
 * by replacing the header with a comma, then relinks product_ingredients and
 * cleans up corrupted ingredient_queue entries.
 *
 * Usage:
 *   npx tsx scripts/fix-section-headers.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes("--dry-run");

function normalizeIngredientList(raw: string): string {
  return raw
    .replace(/\s*\b(?:active|inactive|other)\s+ingredients?\s*:\s*/gi, ", ")
    .replace(/^,\s*/, "");
}

function parseIngredientList(raw: string): string[] {
  return raw
    .split(/,(?![^(]*\))(?!\s*\d[-\d])/)
    .map((s) => s.replace(/[​‌‍﻿]/g, "").trim())
    .map((s) => s.replace(/\([^)]*\)/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);
}

type DbIngredient = { id: string; name: string; inci_name: string | null; status: string };

function findMatch(item: string, db: DbIngredient[]): DbIngredient | undefined {
  const lower = item.toLowerCase();
  return db.find((ing) => {
    const n = ing.name.toLowerCase();
    const i = ing.inci_name?.toLowerCase();
    const tokenLong = lower.length >= 6;
    const dbNameLong = n.length >= 6;
    return (
      lower === n ||
      (dbNameLong && lower.includes(n)) ||
      (tokenLong && n.includes(lower)) ||
      (i && (lower === i || (i.length >= 6 && lower.includes(i)) || (tokenLong && i.includes(lower))))
    );
  });
}

async function main() {
  console.log(`\nFix Section Headers${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, ingredient_list")
    .or(
      "ingredient_list.ilike.%active ingredients:%," +
      "ingredient_list.ilike.%inactive ingredients:%," +
      "ingredient_list.ilike.%other ingredients:%"
    )
    .not("ingredient_list", "is", null);

  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!products || products.length === 0) {
    console.log("  No affected products found.\n");
    return;
  }

  console.log(`  Found ${products.length} affected product(s):\n`);

  const { data: allIngredients } = await supabase
    .from("ingredients")
    .select("id, name, inci_name, status")
    .limit(10000);
  const db = (allIngredients ?? []) as DbIngredient[];

  let fixed = 0;

  for (const product of products) {
    if (!product.ingredient_list) continue;
    const cleaned = normalizeIngredientList(product.ingredient_list);
    if (cleaned === product.ingredient_list) continue;

    console.log(`  ${product.name}`);
    console.log(`    before: ${product.ingredient_list.slice(0, 120)}...`);
    console.log(`    after:  ${cleaned.slice(0, 120)}...`);

    if (!DRY_RUN) {
      await supabase.from("products").update({ ingredient_list: cleaned }).eq("id", product.id);
      await supabase.from("product_ingredients").delete().eq("product_id", product.id);

      const items = parseIngredientList(cleaned);
      const seenIds = new Set<string>();
      const rows: { product_id: string; ingredient_id: string; position: number }[] = [];
      let pos = 0;
      for (const item of items) {
        const match = findMatch(item, db);
        if (!match || match.id.startsWith("comedo-")) continue;
        if (seenIds.has(match.id)) continue;
        seenIds.add(match.id);
        pos++;
        rows.push({ product_id: product.id, ingredient_id: match.id, position: pos });
      }
      if (rows.length > 0) {
        const { error: insertErr } = await supabase.from("product_ingredients").insert(rows);
        if (insertErr) console.error(`    ✗ relink failed: ${insertErr.message}`);
        else console.log(`    ✓ relinked ${rows.length} ingredient(s)`);
      }
    }

    fixed++;
  }

  if (!DRY_RUN && fixed > 0) {
    const { error: qErr, count } = await supabase
      .from("ingredient_queue")
      .delete({ count: "exact" })
      .or(
        "name.ilike.%inactive ingredients:%," +
        "name.ilike.%active ingredients:%," +
        "name.ilike.%other ingredients:%"
      );
    if (qErr) console.error("\n  ✗ queue cleanup failed:", qErr.message);
    else console.log(`\n  Removed ${count ?? "?"} corrupted ingredient_queue entry(s)`);
  }

  console.log(`\n  ${DRY_RUN ? "Would fix" : "Fixed"} ${fixed} product(s).\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
