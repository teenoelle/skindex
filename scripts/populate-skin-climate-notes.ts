/**
 * Populates skin_climate_notes for all ingredients using rule-based logic.
 * Derives notes from flagged_category, category, structural_category, and
 * ingredient name — no API cost.
 *
 * Default (no flags): skips ingredients that already have notes.
 *
 * --force  Regenerates rule-based notes for ALL ingredients and merges with
 *          any existing profile-enrichment notes (fatty acid / bioactive) that
 *          generateNotes() does not produce. Safe to run after adding new note
 *          rules (e.g. smoking profile) without losing profile-enrichment data.
 *
 * --dry-run  Preview without writing. Shows up to 20 ingredients.
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

type ExistingNote = { text: string; [key: string]: unknown };

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
  if (FORCE) console.log("--force: profile-enrichment notes (fatty acid / bioactive) will be preserved.");
  if (DRY_RUN) console.log("\n-- DRY RUN — no writes --\n");
  console.log("");

  if (DRY_RUN) {
    for (const ing of toUpdate.slice(0, 20)) {
      const freshNotes = generateNotes(ing);
      const existingNotes: ExistingNote[] = ing.skin_climate_notes ?? [];
      const freshTextSet = new Set(freshNotes.map(n => n.text));
      const profileNotes = existingNotes.filter(n => !freshTextSet.has(n.text));
      console.log(`${ing.name} [${ing.flagged_category ?? ing.category ?? ing.structural_category ?? "—"}]${profileNotes.length > 0 ? ` (+${profileNotes.length} profile note(s) preserved)` : ""}`);
      for (const n of freshNotes) {
        console.log(`  ${n.sentiment} | dims: [${n.dimensions.join(",")}] | climate: [${n.climate.join(",")}]`);
        console.log(`  "${n.text}"`);
      }
      console.log("");
    }
    if (toUpdate.length > 20) console.log(`... and ${toUpdate.length - 20} more.`);
    return;
  }

  let ok = 0, failed = 0, preserved = 0;
  for (const ing of toUpdate) {
    const freshNotes = generateNotes(ing);
    const existingNotes: ExistingNote[] = ing.skin_climate_notes ?? [];

    // Preserve profile-enrichment notes (fatty acid / bioactive) whose text
    // doesn't appear in the freshly generated rule-based set. These notes
    // contain specific percentages and compound names that generateNotes()
    // never produces, so text-based identity is unambiguous.
    const freshTextSet = new Set(freshNotes.map(n => n.text));
    const profileNotes = existingNotes.filter(n => !freshTextSet.has(n.text));
    const skin_climate_notes = [...freshNotes, ...profileNotes];

    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ skin_climate_notes })
      .eq("id", ing.id);

    if (updateError) {
      console.error(`✗ ${ing.name}: ${updateError.message}`);
      failed++;
    } else {
      if (profileNotes.length > 0) preserved++;
      const suffix = profileNotes.length > 0 ? ` (+${profileNotes.length} preserved)` : "";
      console.log(`✓ ${ing.name} (${freshNotes.length} note${freshNotes.length !== 1 ? "s" : ""}${suffix})`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} updated (${preserved} with preserved profile notes), ${failed} failed.`);
  if (failed > 0) console.log("Re-run to retry failed ingredients.");
}

main().catch(console.error);
