/**
 * Re-scrapes INCIDecoder product pages to fix image URLs stored before the
 * improved image extraction logic (regex + srcset picker) was deployed.
 *
 * Targets products where:
 *   - image_url points to incidecoder-content.storage.googleapis.com
 *   - source_url points to incidecoder.com  (so we know the page to re-fetch)
 *
 * Usage:
 *   npx tsx scripts/refresh-incidecoder-images.ts           # live run
 *   npx tsx scripts/refresh-incidecoder-images.ts --dry-run # preview only
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { extractIngredientsFromUrl } from "../src/lib/extract-ingredients.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 1200; // be polite to INCIDecoder

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no DB writes" : "LIVE RUN — will update DB");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, brand, image_url, source_url")
    .like("image_url", "%incidecoder-content.storage.googleapis.com%")
    .like("source_url", "%incidecoder.com%");

  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!products?.length) { console.log("No products matched."); return; }

  console.log(`Found ${products.length} products to check.\n`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const product of products) {
    await sleep(DELAY_MS);

    const label = `${product.brand ?? "?"} – ${product.name} (${product.id})`;
    let extracted;
    try {
      extracted = await extractIngredientsFromUrl(product.source_url!);
    } catch (e) {
      console.error(`  FAIL  ${label}: ${e instanceof Error ? e.message : e}`);
      failed++;
      continue;
    }

    const newUrl = extracted?.image_url ?? null;

    if (!newUrl) {
      console.log(`  SKIP  ${label}: no image found`);
      failed++;
      continue;
    }

    if (newUrl === product.image_url) {
      console.log(`  same  ${label}`);
      unchanged++;
      continue;
    }

    console.log(`  UPDATE ${label}`);
    console.log(`    old: ${product.image_url}`);
    console.log(`    new: ${newUrl}`);

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ image_url: newUrl })
        .eq("id", product.id);

      if (updateError) {
        console.error(`    DB error: ${updateError.message}`);
        failed++;
        continue;
      }
    }

    updated++;
  }

  console.log(`\nDone. updated=${updated}  unchanged=${unchanged}  failed=${failed}`);
  if (DRY_RUN) console.log("(dry run — no changes written)");
}

main();
