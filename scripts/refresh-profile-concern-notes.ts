/**
 * Regenerates skin_climate_notes for ingredients reclassified in
 * 20260601_profile_secondary_concerns.sql — sensitizers, vasodilators, phytoestrogens.
 *
 * Always overwrites existing notes for matched ingredients (they were reclassified
 * so old notes are stale). Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/refresh-profile-concern-notes.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateNotes } from "../src/lib/curated-explanation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Name patterns matching the migration — same logic, executed in JS.
function isAffected(name: string): boolean {
  const n = name.toLowerCase().trim();
  return (
    // Sensitizers
    n.includes("ascorbic acid") ||
    (n.includes("ascorbyl") && !n.includes("tetraisopalmitate")) ||
    n.includes("hamamelis") ||
    n.includes("witch hazel") ||
    n === "citric acid" ||
    n.includes("kojic acid") ||
    n.includes("kojic dipalmitate") ||
    n.includes("azelaic acid") ||
    n === "urea" ||
    n.includes("benzoyl peroxide") ||
    // Vasodilators
    n === "menthol" ||
    n.includes("mentha piperita") ||
    n.includes("mentha arvensis") ||
    n.includes("peppermint") ||
    n === "camphor" ||
    n.includes("cinnamomum camphora") ||
    n.includes("cinnamomum cassia") ||
    n.includes("cinnamomum zeylanicum") ||
    n.includes("cinnamon bark") ||
    n.includes("cinnamon leaf") ||
    n.includes("eugenia caryophyllus") ||
    n.includes("capsicum") ||
    n.includes("capsaicin") ||
    // Phytoestrogens
    n.includes("resveratrol") ||
    n.includes("glycyrrhiza") ||
    n.includes("licorice root") ||
    n.includes("glycine soja") ||
    n.includes("soy extract") ||
    n.includes("soybean extract") ||
    n.includes("isoflavone") ||
    n === "genistein" ||
    n === "daidzein" ||
    n.includes("humulus lupulus") ||
    n.includes("hop extract") ||
    n.includes("hops extract")
  );
}

async function main() {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, flagged_category, secondary_flagged_categories, category, structural_category, skin_climate_notes")
    .order("name");

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const affected = (ingredients ?? []).filter((ing) => isAffected(ing.name));
  console.log(`${ingredients?.length ?? 0} total ingredients — ${affected.length} match reclassification patterns.\n`);
  if (DRY_RUN) console.log("-- DRY RUN — no writes --\n");

  let ok = 0, unchanged = 0, failed = 0;

  for (const ing of affected) {
    const newNotes = generateNotes(ing);
    const oldCount = Array.isArray(ing.skin_climate_notes) ? ing.skin_climate_notes.length : 0;

    if (DRY_RUN) {
      const cats = [ing.flagged_category, ...(ing.secondary_flagged_categories ?? [])].filter(Boolean).join(", ");
      console.log(`${ing.name} [${cats || ing.category || ing.structural_category || "—"}]`);
      if (newNotes.length === 0) {
        console.log("  (no notes generated)");
      } else {
        for (const n of newNotes) {
          const dims = n.dimensions.length ? `dims:[${n.dimensions.join(",")}]` : "";
          const climate = n.climate.length ? `climate:[${n.climate.join(",")}]` : "";
          console.log(`  ${n.sentiment} ${[dims, climate].filter(Boolean).join(" ")} — "${n.text.slice(0, 80)}${n.text.length > 80 ? "…" : ""}"`);
        }
      }
      console.log(`  ${oldCount} → ${newNotes.length} notes`);
      console.log("");
      continue;
    }

    if (newNotes.length === 0 && oldCount === 0) {
      unchanged++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ skin_climate_notes: newNotes.length > 0 ? newNotes : null })
      .eq("id", ing.id);

    if (updateError) {
      console.error(`✗ ${ing.name}: ${updateError.message}`);
      failed++;
    } else {
      const arrow = `${oldCount} → ${newNotes.length}`;
      console.log(`✓ ${ing.name} (${arrow} note${newNotes.length !== 1 ? "s" : ""})`);
      ok++;
    }
  }

  if (!DRY_RUN) {
    console.log(`\nDone. ${ok} updated, ${unchanged} unchanged, ${failed} failed.`);
    if (failed > 0) console.log("Re-run to retry failed ingredients.");
  }
}

main().catch(console.error);
