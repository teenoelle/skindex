/**
 * Writes Claude Code-generated curated explanations to the DB.
 *
 * Usage:
 *   npx tsx scripts/write-curated-explanations.ts explanations.json
 *
 * Input file: JSON array from fetch-need-explanation.ts output, with an added
 * "explanation_structured" field for each entry:
 *
 *   [{
 *     "id": "...",
 *     "name": "...",
 *     "status": "safe" | "flagged",
 *     "structural_category": "..." | null,
 *     "category": "..." | null,
 *     "flagged_category": "..." | null,
 *     "explanation_structured": {
 *       "formula_role": "...",
 *       "benefit": "..." | null,
 *       "concern": "..." | null,
 *       "concern_items": [{"category": "...", "text": "..."}] | null
 *     }
 *   }]
 *
 * skin_climate_notes is computed automatically from classification fields.
 * explanation (flat text) is derived from explanation_structured.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateNotes } from "../src/lib/curated-explanation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/write-curated-explanations.ts <file.json>");
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

type Entry = {
  id: string;
  name?: string;
  status?: string;
  structural_category?: string | null;
  category?: string | null;
  flagged_category?: string | null;
  explanation_structured: ExplanationStructured;
};

function flatten(s: ExplanationStructured): string {
  return [s.formula_role, s.benefit, s.concern].filter(Boolean).join(" ");
}

const entries: Entry[] = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));

async function main() {
  let ok = 0, failed = 0, skipped = 0;

  for (const entry of entries) {
    if (!entry.explanation_structured) {
      console.warn(`⚠ ${entry.id}: missing explanation_structured — skipped`);
      skipped++;
      continue;
    }

    const explanation = flatten(entry.explanation_structured);
    const notes = generateNotes({
      name: entry.name,
      status: entry.status ?? "safe",
      flagged_category: entry.flagged_category ?? null,
      category: entry.category ?? null,
      structural_category: entry.structural_category ?? null,
    });

    const { error } = await supabase
      .from("ingredients")
      .update({
        explanation,
        explanation_structured: entry.explanation_structured,
        explanation_source: "curated",
        skin_climate_notes: notes.length > 0 ? notes : null,
      })
      .eq("id", entry.id);

    if (error) {
      console.error(`✗ ${entry.name ?? entry.id}: ${error.message}`);
      failed++;
    } else {
      console.log(`✓ ${entry.name ?? entry.id}`);
      ok++;
    }
  }

  console.log(`\nDone — ${ok} written, ${skipped} skipped, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
