/**
 * Backfills concern_profiles in explanation_structured from skin_climate_notes,
 * and clears any previously auto-derived benefit_profiles.
 *
 * concern_profiles  — union of profile labels from caution/strong_caution notes
 *                     whose `concern` field matches the ingredient's flagged_category.
 *                     Only applied to flagged ingredients.
 *
 * benefit_profiles  — cleared (set to null/removed) for all ingredients.
 *                     benefit_profiles is manual-only; auto-derivation duplicates
 *                     what profileBenefitNotes already shows in the UI.
 *
 * Usage:
 *   npx tsx scripts/backfill-explanation-profiles.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { profilesFromNotes, mergeProfileLabels } from "../src/lib/profile-labels.js";
import type { SkinClimateNote } from "../src/types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error("NEXT_PUBLIC_SUPABASE_URL not set"); })(),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY not set"); })(),
);

const DRY_RUN = process.argv.includes("--dry-run");

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nBackfill Explanation Profiles${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, flagged_category, explanation_structured, skin_climate_notes")
    .not("skin_climate_notes", "is", null)
    .not("explanation_structured", "is", null)
    .order("name");

  if (error) throw new Error(`Fetch error: ${error.message}`);
  if (!ingredients?.length) { console.log("No eligible ingredients found.\n"); return; }

  console.log(`Checking ${ingredients.length} ingredients with notes + structured data.\n`);

  let updated = 0, noop = 0, failed = 0;

  for (const ing of ingredients) {
    const notes = Array.isArray(ing.skin_climate_notes) ? ing.skin_climate_notes as SkinClimateNote[] : [];
    const structured = ing.explanation_structured as Record<string, unknown>;

    const hasBenefitProfiles = Array.isArray(structured.benefit_profiles) && (structured.benefit_profiles as unknown[]).length > 0;
    const existingConcern = Array.isArray(structured.concern_profiles)
      ? (structured.concern_profiles as string[]).filter(Boolean)
      : [];

    const { concern_profiles: derivedConcern } = profilesFromNotes(notes, ing.flagged_category ?? null);

    const newConcern = ing.status === "flagged"
      ? mergeProfileLabels(existingConcern.length ? existingConcern : null, derivedConcern)
      : null;

    const benefitClear = hasBenefitProfiles;
    const concernChanged = newConcern !== null &&
      JSON.stringify(newConcern) !== JSON.stringify(existingConcern.length ? existingConcern : null);

    if (!benefitClear && !concernChanged) { noop++; continue; }

    const label = ing.name.length > 50 ? ing.name.slice(0, 47) + "…" : ing.name;

    if (DRY_RUN) {
      console.log(`  ${label}`);
      if (benefitClear) console.log(`    benefit_profiles: cleared`);
      if (concernChanged) console.log(`    concern_profiles: ${JSON.stringify(newConcern)}`);
      updated++;
      continue;
    }

    process.stdout.write(`  ${label} … `);

    // Build updated structured: remove benefit_profiles key, set concern_profiles if changed
    const { benefit_profiles: _drop, ...structuredWithoutBenefit } = structured as Record<string, unknown> & { benefit_profiles?: unknown };
    void _drop;
    const updatedStructured = {
      ...structuredWithoutBenefit,
      ...(concernChanged && newConcern ? { concern_profiles: newConcern } : {}),
    };

    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ explanation_structured: updatedStructured })
      .eq("id", ing.id);

    if (updateError) {
      console.log(`✗ (${updateError.message})`);
      failed++;
    } else {
      const tags: string[] = [];
      if (benefitClear) tags.push("benefit_profiles cleared");
      if (concernChanged) tags.push(`concern → [${newConcern!.join(", ")}]`);
      console.log(`✓ ${tags.join(" + ")}`);
      updated++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${noop} no change needed, ${failed} failed.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
