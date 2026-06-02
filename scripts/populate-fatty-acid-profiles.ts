/**
 * Populates fatty_acid_profile for Emollient ingredients with profile_status = 'needs_profile'.
 *
 * For each ingredient the script calls Claude to estimate the fatty acid composition
 * (percentages), then uses that data to:
 *   - Write fatty_acid_profile JSONB
 *   - Recompute category and secondary_benefit_categories (Path B enrichment)
 *   - Regenerate skin_climate_notes via generateFattyAcidNotes()
 *   - Set profile_status = 'ai_generated'  (or leave existing notes intact for 'curated')
 *
 * Non-plant emollients (mineral oil, petrolatum, squalane, silicones, waxes) return null
 * from the AI prompt and are marked profile_status = 'ai_generated' with an empty profile
 * so they don't keep re-queuing.
 *
 * Usage:
 *   npx tsx scripts/populate-fatty-acid-profiles.ts [--dry-run] [--limit N] [--force]
 *
 *   --dry-run  Print what would change, no DB writes
 *   --limit N  Process at most N ingredients (default 20)
 *   --force    Also reprocess ai_generated entries (skip curated)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { getOilCategories, generateFattyAcidNotes } from "../src/lib/fatty-acid-concerns.js";
import { getFattyAcidProfile } from "../src/lib/fatty-acid-ai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const limitArg = process.argv.find((a) => a.startsWith("--limit=") || a === "--limit");
const LIMIT = limitArg
  ? parseInt(process.argv[process.argv.indexOf("--limit") + 1] ?? limitArg.split("=")[1] ?? "20", 10)
  : 20;

async function main() {
  const statusFilter = FORCE
    ? "profile_status.eq.needs_profile,profile_status.eq.ai_generated"
    : "profile_status.eq.needs_profile";

  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, skin_climate_notes, profile_status")
    .or(statusFilter)
    .eq("structural_category", "Emollient")
    .order("name")
    .limit(LIMIT);

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  if (!ingredients?.length) {
    console.log("No ingredients with profile_status = needs_profile found.");
    return;
  }

  console.log(`Found ${ingredients.length} ingredient(s) to profile.`);
  if (DRY_RUN) console.log("-- DRY RUN — no writes --\n");

  let profiled = 0;
  let skipped = 0;

  for (const ing of ingredients) {
    process.stdout.write(`${ing.name} … `);

    const profile = await getFattyAcidProfile(ing.name);

    if (!profile || Object.keys(profile).length === 0) {
      // Synthetic / non-plant emollient — mark as ai_generated with empty profile
      // so it doesn't keep re-queuing
      console.log("no plant profile (synthetic/wax) — marking done");
      if (!DRY_RUN) {
        await supabase
          .from("ingredients")
          .update({ fatty_acid_profile: null, profile_status: "ai_generated" })
          .eq("id", ing.id);
      }
      skipped++;
      continue;
    }

    const { category, secondary_benefit_categories } = getOilCategories(ing.name, profile);
    const fattyNotes = generateFattyAcidNotes(ing.name, profile);

    // Merge fatty acid notes with any existing non-fatty-acid notes
    const existingNotes: typeof fattyNotes = ing.skin_climate_notes ?? [];
    const nonFattyNotes = existingNotes.filter((n) => n.concern !== "occlusive" && n.concern !== "pore-clogger");
    const mergedNotes = [...nonFattyNotes, ...fattyNotes];

    const summary = [
      `profile: ${JSON.stringify(profile)}`,
      `category: ${category}`,
      secondary_benefit_categories.length ? `secondary: [${secondary_benefit_categories.join(", ")}]` : null,
      fattyNotes.length ? `${fattyNotes.length} note(s)` : "no notes",
    ].filter(Boolean).join(" | ");
    console.log(summary);

    if (!DRY_RUN) {
      await supabase
        .from("ingredients")
        .update({
          fatty_acid_profile: profile,
          profile_status: "ai_generated",
          category,
          secondary_benefit_categories,
          skin_climate_notes: mergedNotes.length > 0 ? mergedNotes : null,
        })
        .eq("id", ing.id);
    }
    profiled++;
  }

  console.log(`\nDone. Profiled: ${profiled}, skipped (no plant profile): ${skipped}.`);
  if (DRY_RUN) console.log("(dry run — no writes made)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
