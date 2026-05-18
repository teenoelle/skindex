// Backfills type for products added via URL import before guessProductType was added.
// Run with: node --experimental-strip-types scripts/backfill-url-import-types.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { guessProductType } from "../src/lib/extract-ingredients";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && !k.startsWith("#")) process.env[k.trim()] = v.join("=").trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("source", "url-import")
    .is("type", null);

  if (error) { console.error(error.message); return; }
  if (!products?.length) { console.log("No url-import products with null type found."); return; }

  console.log(`Found ${products.length} products to backfill.`);

  let updated = 0;
  let skipped = 0;

  for (const p of products) {
    const guessed = guessProductType(p.name ?? "");
    if (!guessed) {
      console.log(`  SKIP  "${p.name}" — no type guessed`);
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ type: guessed })
      .eq("id", p.id);

    if (updateError) {
      console.error(`  ERROR "${p.name}": ${updateError.message}`);
    } else {
      console.log(`  OK    "${p.name}" → ${guessed}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (no match): ${skipped}`);
}

run();
