/**
 * Writes Claude Code-generated fatty acid profiles to the DB.
 *
 * Usage:
 *   npx tsx scripts/write-fatty-acid-profiles.ts profiles.json
 *
 * Input: JSON array from fetch-need-profile.ts (--type emollient) output, with
 * an added "fatty_acid_profile" field for each entry:
 *
 *   [{
 *     "id": "...",
 *     "name": "...",
 *     "status": "safe" | "flagged",
 *     "structural_category": "Emollient",
 *     "category": "..." | null,
 *     "flagged_category": "..." | null,
 *     "secondary_flagged_categories": [...],
 *     "fatty_acid_profile": { "linoleic": 65, "oleic": 20, ... } | null
 *   }]
 *
 * category, secondary_benefit_categories, and skin_climate_notes are computed
 * automatically from the profile — you don't need to include them in the input.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateNotes } from "../src/lib/curated-explanation.js";
import { getOilCategories, generateFattyAcidNotes } from "../src/lib/fatty-acid-concerns.js";
import type { FattyAcidProfile } from "../src/types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/write-fatty-acid-profiles.ts <file.json>");
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
  fatty_acid_profile: FattyAcidProfile | null;
};

const entries: Entry[] = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));

async function main() {
  let ok = 0, failed = 0, skipped = 0;

  for (const entry of entries) {
    if (!("fatty_acid_profile" in entry)) {
      console.warn(`⚠ ${entry.name ?? entry.id}: missing fatty_acid_profile field — skipped`);
      skipped++;
      continue;
    }

    const profile = entry.fatty_acid_profile;
    const { category, secondary_benefit_categories } = getOilCategories(entry.name, profile ?? {});
    const fattyNotes = generateFattyAcidNotes(entry.name, profile ?? {});
    const ruleNotes = generateNotes({
      name: entry.name,
      status: entry.status ?? "safe",
      structural_category: entry.structural_category ?? null,
      category,
      flagged_category: entry.flagged_category ?? null,
    });
    const allNotes = [...ruleNotes, ...fattyNotes];

    const updatePayload: Record<string, unknown> = {
      fatty_acid_profile: profile,
      profile_status: "ai_generated",
      category,
      secondary_benefit_categories,
      skin_climate_notes: allNotes.length > 0 ? allNotes : null,
    };

    const { error } = await supabase
      .from("ingredients")
      .update(updatePayload)
      .eq("id", entry.id);

    if (error) {
      console.error(`✗ ${entry.name ?? entry.id}: ${error.message}`);
      failed++;
    } else {
      const tag = profile ? `${category ?? "Moisturizing"}` : "no profile (cleared)";
      console.log(`✓ ${entry.name ?? entry.id} — ${tag}`);
      ok++;
    }
  }

  console.log(`\nDone — ${ok} written, ${skipped} skipped, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
