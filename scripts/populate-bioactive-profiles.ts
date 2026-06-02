/**
 * Populates bioactive_profile for Plant Extract ingredients with
 * profile_status = 'needs_profile'.
 *
 * For each ingredient the script calls Claude to get a structured bioactive
 * profile (primary action, secondary actions, key compounds, sensitization
 * risk), then uses that data to:
 *   - Write bioactive_profile JSONB
 *   - Recompute category and secondary_benefit_categories
 *   - Reclassify to flagged/sensitizer when sensitization_risk = "high"
 *   - Regenerate skin_climate_notes
 *   - Set profile_status = 'ai_generated'
 *
 * Non-plant or unrecognisable ingredients return null from the AI and are
 * marked profile_status = 'ai_generated' with a null profile so they don't
 * keep re-queuing.
 *
 * Usage:
 *   npx tsx scripts/populate-bioactive-profiles.ts [--dry-run] [--limit N] [--force]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { getBioactiveProfile } from "../src/lib/bioactive-ai.js";
import { getBioactiveCategories, generateBioactiveNotes } from "../src/lib/bioactive-concerns.js";
import { generateNotes } from "../src/lib/curated-explanation.js";

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
    .eq("structural_category", "Plant Extract")
    .order("name")
    .limit(LIMIT);

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  if (!ingredients?.length) {
    console.log("No Plant Extract ingredients with profile_status = needs_profile found.");
    return;
  }

  console.log(`Found ${ingredients.length} ingredient(s) to profile.`);
  if (DRY_RUN) console.log("-- DRY RUN — no writes --\n");

  let profiled = 0;
  let skipped = 0;

  for (const ing of ingredients) {
    process.stdout.write(`${ing.name} … `);

    const profile = await getBioactiveProfile(ing.name);

    if (!profile) {
      console.log("no profile returned — marking done");
      if (!DRY_RUN) {
        await supabase
          .from("ingredients")
          .update({ bioactive_profile: null, profile_status: "ai_generated" })
          .eq("id", ing.id);
      }
      skipped++;
      continue;
    }

    const classification = getBioactiveCategories(profile);
    const bioNotes = generateBioactiveNotes(profile);

    // Build the updated ingredient context for generateNotes()
    const updatedContext = {
      name: ing.name,
      status: classification.status ?? ing.status,
      structural_category: ing.structural_category,
      category: classification.category,
      flagged_category: classification.flagged_category ?? ing.flagged_category,
    };
    const ruleNotes = generateNotes(updatedContext);
    const allNotes = [...ruleNotes, ...bioNotes];

    const update: Record<string, unknown> = {
      bioactive_profile: profile,
      profile_status: "ai_generated",
      category: classification.category,
      secondary_benefit_categories: classification.secondary_benefit_categories,
      skin_climate_notes: allNotes.length > 0 ? allNotes : null,
    };

    if (classification.status === "flagged") {
      update.status = "flagged";
      update.flagged_category = "sensitizer";
      update.category = null;
      update.secondary_benefit_categories = [];
    }

    const summary = [
      `action: ${profile.primary_action}`,
      profile.secondary_actions?.length ? `secondary: [${profile.secondary_actions.join(", ")}]` : null,
      profile.key_compounds?.length ? `compounds: [${profile.key_compounds.join(", ")}]` : null,
      `risk: ${profile.sensitization_risk}`,
      classification.status === "flagged" ? "→ RECLASSIFIED flagged/sensitizer" : null,
    ].filter(Boolean).join(" | ");
    console.log(summary);

    if (!DRY_RUN) {
      await supabase.from("ingredients").update(update).eq("id", ing.id);
    }
    profiled++;
  }

  console.log(`\nDone. Profiled: ${profiled}, skipped (no profile): ${skipped}.`);
  if (DRY_RUN) console.log("(dry run — no writes made)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
