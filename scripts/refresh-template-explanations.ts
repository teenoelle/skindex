/**
 * Regenerates template-based explanations for all ingredients where
 * explanation_source is null or 'template'. Safe to re-run.
 *
 * Use this after reclassifying ingredients (new category/structural assignments)
 * to ensure explanation text reflects current categories.
 *
 * Usage:
 *   npx tsx scripts/refresh-template-explanations.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateExplanation } from "../src/lib/generate-explanation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, explanation")
    .or("explanation_source.is.null,explanation_source.eq.template")
    .order("name");

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  console.log(`${ingredients.length} ingredients with template/null explanations.`);
  if (DRY_RUN) console.log("-- DRY RUN — no writes --\n");

  let updated = 0, skipped = 0, failed = 0;

  for (const ing of ingredients) {
    const freshExplanation = generateExplanation(
      ing.name,
      ing.status,
      ing.structural_category,
      ing.category,
      ing.flagged_category,
    );

    if (freshExplanation === ing.explanation) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${ing.name}`);
      console.log(`  was: ${ing.explanation?.slice(0, 80) ?? "(null)"}…`);
      console.log(`  now: ${freshExplanation?.slice(0, 80) ?? "(null)"}…`);
      console.log("");
      updated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ explanation: freshExplanation, explanation_source: "template" })
      .eq("id", ing.id);

    if (updateError) {
      console.error(`✗ ${ing.name}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✓ ${ing.name}`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated} updated, ${skipped} unchanged, ${failed} failed.`);
}

main().catch(console.error);
