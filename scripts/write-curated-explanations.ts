/**
 * Writes Claude Code-generated curated explanations to the DB.
 *
 * Usage:
 *   npx tsx scripts/write-curated-explanations.ts explanations.json
 *
 * Input file format:
 *   [{ "id": "...", "explanation": "...", "skin_climate_notes": { ... } }]
 *
 * skin_climate_notes is optional — computed automatically if omitted.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const filePath = process.argv[2];
if (!filePath) { console.error("Usage: npx tsx scripts/write-curated-explanations.ts <file.json>"); process.exit(1); }

const entries: { id: string; explanation: string; skin_climate_notes?: unknown }[] =
  JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));

async function main() {
  let ok = 0, failed = 0;
  for (const entry of entries) {
    const update: Record<string, unknown> = {
      explanation: entry.explanation,
      explanation_source: "ai",
    };
    if (entry.skin_climate_notes) update.skin_climate_notes = entry.skin_climate_notes;

    const { error } = await supabase.from("ingredients").update(update).eq("id", entry.id);
    if (error) {
      console.error(`✗ ${entry.id}: ${error.message}`);
      failed++;
    } else {
      console.log(`✓ ${entry.id}`);
      ok++;
    }
  }
  console.log(`\nDone — ${ok} written, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
