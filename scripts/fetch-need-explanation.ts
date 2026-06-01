/**
 * Fetches ingredients that need curated AI explanations and outputs them as JSON.
 * Claude Code reads this output and generates explanations inline.
 *
 * Usage:
 *   npx tsx scripts/fetch-need-explanation.ts [--limit N]
 *
 * Output: JSON array of { id, name, status, structural_category, category, flagged_category }
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const limit = parseInt(process.argv.find((a) => /^\d+$/.test(a)) ?? "30");

async function main() {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories")
    .or("explanation_source.is.null,explanation_source.eq.template")
    .order("name")
    .limit(limit);

  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data ?? [], null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
