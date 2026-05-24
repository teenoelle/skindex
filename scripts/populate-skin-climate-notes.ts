/**
 * Populates skin_climate_notes for all ingredients using rule-based logic.
 * Derives notes from flagged_category, category, and structural_category — no API cost.
 *
 * Safe to re-run: skips ingredients that already have notes.
 * Pass --force to overwrite all existing notes.
 * Pass --dry-run to preview without writing.
 *
 * Usage:
 *   npx tsx scripts/populate-skin-climate-notes.ts [--force] [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateNotes } from "../src/lib/curated-explanation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, flagged_category, category, structural_category, skin_climate_notes")
    .order("name");

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const toUpdate = ingredients.filter((ing) => {
    if (!FORCE && ing.skin_climate_notes !== null) return false;
    const notes = generateNotes(ing);
    return notes.length > 0;
  });

  const noNotes = ingredients.filter((ing) => {
    if (!FORCE && ing.skin_climate_notes !== null) return false;
    return generateNotes(ing).length === 0;
  });

  console.log(`${ingredients.length} total ingredients.`);
  console.log(`${toUpdate.length} will receive notes.`);
  console.log(`${noNotes.length} have no applicable rules (will stay null).`);
  if (DRY_RUN) console.log("\n-- DRY RUN — no writes --\n");
  console.log("");

  if (DRY_RUN) {
    for (const ing of toUpdate.slice(0, 20)) {
      const notes = generateNotes(ing);
      console.log(`${ing.name} [${ing.flagged_category ?? ing.category ?? ing.structural_category ?? "—"}]`);
      for (const n of notes) {
        console.log(`  ${n.sentiment} | dims: [${n.dimensions.join(",")}] | climate: [${n.climate.join(",")}]`);
        console.log(`  "${n.text}"`);
      }
      console.log("");
    }
    if (toUpdate.length > 20) console.log(`... and ${toUpdate.length - 20} more.`);
    return;
  }

  let ok = 0, failed = 0;
  for (const ing of toUpdate) {
    const skin_climate_notes = generateNotes(ing);
    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ skin_climate_notes })
      .eq("id", ing.id);

    if (updateError) {
      console.error(`✗ ${ing.name}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✓ ${ing.name} (${skin_climate_notes.length} note${skin_climate_notes.length !== 1 ? "s" : ""})`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`);
  if (failed > 0) console.log("Re-run to retry failed ingredients.");
}

main().catch(console.error);
