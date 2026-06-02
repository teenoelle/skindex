/**
 * Writes Claude Code-generated bioactive profiles to the DB.
 *
 * Usage:
 *   npx tsx scripts/write-bioactive-profiles.ts profiles.json
 *
 * Input: JSON array from fetch-need-profile.ts (--type plant-extract) output, with
 * an added "bioactive_profile" field for each entry:
 *
 *   [{
 *     "id": "...",
 *     "name": "...",
 *     "status": "safe" | "flagged",
 *     "structural_category": "Plant Extract",
 *     "category": "..." | null,
 *     "flagged_category": "..." | null,
 *     "secondary_flagged_categories": [...],
 *     "bioactive_profile": {
 *       "primary_action": "soothing",
 *       "secondary_actions": ["antioxidant"],
 *       "key_compounds": ["bisabolol"],
 *       "sensitization_risk": "low"
 *     } | null
 *   }]
 *
 * category, secondary_benefit_categories, and skin_climate_notes are computed
 * automatically from the profile. High sensitization_risk reclassifies the
 * ingredient to flagged/sensitizer.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateNotes } from "../src/lib/curated-explanation.js";
import { getBioactiveCategories, generateBioactiveNotes } from "../src/lib/bioactive-concerns.js";
import type { BioactiveProfile } from "../src/types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/write-bioactive-profiles.ts <file.json>");
  process.exit(1);
}

type Entry = {
  id: string;
  name: string;
  status?: string;
  structural_category?: string | null;
  category?: string | null;
  flagged_category?: string | null;
  secondary_flagged_categories?: string[];
  bioactive_profile: BioactiveProfile | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entries: any[] = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));

async function main() {
  let ok = 0, failed = 0, skipped = 0;

  for (const entry of entries) {
    if (!("bioactive_profile" in entry)) {
      console.warn(`⚠ ${entry.name ?? entry.id}: missing bioactive_profile field — skipped`);
      skipped++;
      continue;
    }

    const profile = entry.bioactive_profile;
    const classification = getBioactiveCategories(profile);
    const bioNotes = generateBioactiveNotes(profile);

    // Use the post-classification category for rule-based note generation
    const updatedContext = {
      name: entry.name,
      status: classification.status ?? entry.status ?? "safe",
      structural_category: entry.structural_category ?? "Plant Extract",
      category: classification.category,
      flagged_category: classification.flagged_category ?? entry.flagged_category ?? null,
    };
    const ruleNotes = generateNotes(updatedContext);
    const allNotes = [...ruleNotes, ...bioNotes];

    const updatePayload: Record<string, unknown> = {
      bioactive_profile: profile,
      profile_status: "ai_generated",
      category: classification.category,
      secondary_benefit_categories: classification.secondary_benefit_categories,
      skin_climate_notes: allNotes.length > 0 ? allNotes : null,
    };

    // High sensitization risk → reclassify as flagged/sensitizer
    if (classification.status === "flagged") {
      updatePayload.status = "flagged";
      updatePayload.flagged_category = "sensitizer";
      updatePayload.category = null;
      updatePayload.secondary_benefit_categories = [];
    }

    const { error } = await supabase
      .from("ingredients")
      .update(updatePayload)
      .eq("id", entry.id);

    if (error) {
      console.error(`✗ ${entry.name ?? entry.id}: ${error.message}`);
      failed++;
    } else {
      const tag = !profile
        ? "no profile (cleared)"
        : classification.status === "flagged"
        ? "FLAGGED (sensitizer)"
        : `${classification.category ?? "uncategorized"} — ${profile.sensitization_risk} risk`;
      console.log(`✓ ${entry.name ?? entry.id} — ${tag}`);
      ok++;
    }
  }

  console.log(`\nDone — ${ok} written, ${skipped} skipped, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
