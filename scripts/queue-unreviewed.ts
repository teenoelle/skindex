/**
 * Scans all DB products with an ingredient_list, finds any ingredients not
 * in the ingredients table, and pushes them to ingredient_queue for the next
 * generate-explanations run. Skips names that are likely junk.
 *
 * Does NOT touch product_ingredients — only queues unknowns.
 *
 * --dry-run  Report counts without writing to the queue.
 *
 * Usage:
 *   npx tsx scripts/queue-unreviewed.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { isLikelyJunk } from "../src/lib/junk-detector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error("NEXT_PUBLIC_SUPABASE_URL not set"); })(),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY not set"); })(),
);

const DRY_RUN = process.argv.includes("--dry-run");

function parseIngredientList(raw: string): string[] {
  return raw
    .split(/,(?![^(]*\))(?!\s*\d[-\d])/)
    .map((s) => s.replace(/[​‌‍﻿]/g, "").trim())
    .map((s) => s.replace(/\([^)]*\)/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);
}

async function main() {
  console.log(`\nQueue Unreviewed Ingredients${DRY_RUN ? " — DRY RUN" : ""}\n`);

  // Load all known ingredient names + inci_names for matching
  const { data: dbIngredients, error: ingErr } = await supabase
    .from("ingredients")
    .select("name, inci_name")
    .limit(10000);
  if (ingErr) throw new Error(`Failed to fetch ingredients: ${ingErr.message}`);

  const known = new Set<string>();
  for (const ing of dbIngredients ?? []) {
    known.add(ing.name.toLowerCase());
    if (ing.inci_name) known.add(ing.inci_name.toLowerCase());
  }

  // Load all existing queue names so we can skip already-queued items
  const { data: queueRows, error: qErr } = await supabase
    .from("ingredient_queue")
    .select("name");
  if (qErr) throw new Error(`Failed to fetch queue: ${qErr.message}`);

  const alreadyQueued = new Set((queueRows ?? []).map((r) => r.name.toLowerCase()));

  // Fetch all products with an ingredient list
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, ingredient_list")
    .not("ingredient_list", "is", null);
  if (prodErr) throw new Error(`Failed to fetch products: ${prodErr.message}`);

  console.log(`  Products with ingredient list : ${(products ?? []).length}`);
  console.log(`  Known ingredients in DB       : ${known.size / 2 | 0} (approx)`);
  console.log(`  Already in queue              : ${alreadyQueued.size}\n`);

  // Collect new unknowns — deduplicated across all products
  const toQueue = new Map<string, string>(); // name → found_in (first product seen)

  for (const product of products ?? []) {
    const items = parseIngredientList(product.ingredient_list!);
    for (const item of items) {
      const lower = item.toLowerCase();
      if (alreadyQueued.has(lower)) continue;
      if (toQueue.has(lower)) continue;
      if (isLikelyJunk(item)) continue;

      // Check against known ingredients using the same substring logic as matchIngredients
      const tokenLong = lower.length >= 6;
      const matched = [...known].some((n) => {
        const dbLong = n.length >= 6;
        return (
          lower === n ||
          (dbLong && lower.includes(n)) ||
          (tokenLong && n.includes(lower))
        );
      });

      if (!matched) {
        toQueue.set(lower, product.name ?? product.id);
      }
    }
  }

  console.log(`  New unknowns to queue: ${toQueue.size}\n`);

  if (toQueue.size === 0) {
    console.log("  Nothing to queue — all ingredients are known or already queued.\n");
    return;
  }

  if (DRY_RUN) {
    for (const [name] of toQueue) {
      console.log(`  would queue: ${name}`);
    }
    console.log();
    return;
  }

  let queued = 0;
  for (const [name, foundIn] of toQueue) {
    const { error } = await supabase
      .from("ingredient_queue")
      .insert({ name, found_in: foundIn, times_seen: 1 });
    if (error) {
      console.error(`  ✗ failed to queue "${name}": ${error.message}`);
    } else {
      queued++;
    }
  }

  console.log(`  ✓ Queued ${queued} new ingredient(s).\n`);
  console.log(`  Run: npx tsx scripts/generate-explanations.ts --loop\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
