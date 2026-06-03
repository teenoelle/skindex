/**
 * Inserts queue items into the ingredients table and removes them from ingredient_queue.
 *
 * Usage:
 *   npx tsx scripts/write-queue-explanations.ts <file.json>
 *
 * Input: JSON array where each entry is one of:
 *   { "queueId": "...", "skip": true }
 *     — delete from queue without inserting (junk, asterisk variants, already-exists names)
 *
 *   { "queueId": "...", "name": "...", "status": "safe"|"flagged",
 *     "structural_category": ..., "category": ..., "flagged_category": ...,
 *     "secondary_flagged_categories": [...],
 *     "explanation_structured": { ... } }
 *     — insert into ingredients, then delete from queue
 *
 * Notes:
 * - If the ingredient name already exists in the DB, the row is skipped and queue
 *   entry is deleted (avoids duplicates).
 * - Emollient and Plant Extract entries automatically get profile_status = "needs_profile"
 *   so they appear in Queues 2 and 3 on the same or next run.
 * - skin_climate_notes is computed automatically from classification fields.
 * - explanation (flat text) is derived from explanation_structured.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateNotes } from "../src/lib/curated-explanation.js";
import { profilesFromNotes, mergeProfileLabels } from "../src/lib/profile-labels.js";
import type { SkinClimateNote } from "../src/types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/write-queue-explanations.ts <file.json>");
  process.exit(1);
}

type ExplanationStructured = {
  formula_role: string | null;
  benefit: string | null;
  benefit_category?: string | null;
  benefit_profiles?: string[] | null;
  concern: string | null;
  concern_category?: string | null;
  concern_profiles?: string[] | null;
  concern_items?: { category: string; text: string }[] | null;
};

type Entry =
  | { queueId: string; skip: true }
  | {
      queueId: string;
      skip?: false;
      name: string;
      status: "safe" | "flagged";
      structural_category: string | null;
      category: string | null;
      flagged_category: string | null;
      secondary_flagged_categories?: string[] | null;
      explanation_structured: ExplanationStructured;
    };

function flatten(s: ExplanationStructured): string {
  return [s.formula_role, s.benefit, s.concern].filter(Boolean).join(" ");
}

// Normalize profile arrays: split any items joined with " · " into separate strings.
function normalizeProfiles(profiles: string[] | null | undefined): string[] | null {
  if (!profiles?.length) return null;
  const flat = profiles.flatMap(p => p.split(/\s*·\s*/)).filter(Boolean);
  return flat.length ? flat : null;
}

const entries: Entry[] = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));

async function main() {
  let inserted = 0, skipped = 0, failed = 0;

  for (const entry of entries) {
    if (entry.skip) {
      const { error } = await supabase.from("ingredient_queue").delete().eq("id", entry.queueId);
      if (error) {
        console.error(`✗ skip ${entry.queueId}: ${error.message}`);
        failed++;
      } else {
        console.log(`⊘ skipped (removed from queue)`);
        skipped++;
      }
      continue;
    }

    const { data: existing } = await supabase
      .from("ingredients")
      .select("id")
      .ilike("name", entry.name)
      .maybeSingle();

    if (existing) {
      await supabase.from("ingredient_queue").delete().eq("id", entry.queueId);
      console.log(`⊘ ${entry.name} — already exists, removed from queue`);
      skipped++;
      continue;
    }

    const notes = generateNotes({
      name: entry.name,
      status: entry.status,
      flagged_category: entry.flagged_category,
      category: entry.category,
      structural_category: entry.structural_category,
    });

    // Normalize manually-provided profiles, then union with auto-derived from notes.
    // Manually-provided values take precedence (they're preserved in the merge).
    const derived = profilesFromNotes(notes as SkinClimateNote[], entry.flagged_category ?? null);
    const normalizedBenefit = normalizeProfiles(entry.explanation_structured.benefit_profiles);
    const normalizedConcern = normalizeProfiles(entry.explanation_structured.concern_profiles);

    const needsProfile =
      entry.structural_category === "Emollient" ||
      entry.structural_category === "Plant Extract";

    const { error: insertError } = await supabase.from("ingredients").insert({
      name: entry.name,
      status: entry.status,
      structural_category: entry.structural_category,
      category: entry.category,
      flagged_category: entry.flagged_category,
      secondary_flagged_categories: entry.secondary_flagged_categories ?? [],
      explanation: flatten(entry.explanation_structured),
      explanation_structured: {
        ...entry.explanation_structured,
        benefit_profiles: mergeProfileLabels(normalizedBenefit, derived.benefit_profiles),
        concern_profiles: mergeProfileLabels(normalizedConcern, derived.concern_profiles),
      },
      explanation_source: "curated",
      skin_climate_notes: notes.length > 0 ? notes : null,
      profile_status: needsProfile ? "needs_profile" : null,
    });

    if (insertError) {
      console.error(`✗ ${entry.name}: ${insertError.message}`);
      failed++;
      continue;
    }

    await supabase.from("ingredient_queue").delete().eq("id", entry.queueId);
    console.log(`✓ ${entry.name}${needsProfile ? " [queued for profile]" : ""}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
