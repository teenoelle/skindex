/**
 * Fetches ingredients that need AI-generated profiles and outputs them as JSON.
 * Used by /generate-explanations for the fatty acid and bioactive profile queues.
 *
 * Usage:
 *   npx tsx scripts/fetch-need-profile.ts [--type emollient|plant-extract] [N]
 *
 * --type emollient      Emollient ingredients only
 * --type plant-extract  Plant Extract ingredients only
 * (no --type)           Both types
 *
 * Output: JSON array of { id, name, status, structural_category, category,
 *   flagged_category, secondary_flagged_categories }
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

const args = process.argv.slice(2);
const typeIdx = args.indexOf("--type");
const typeArg = typeIdx !== -1 ? args[typeIdx + 1] : null;
const limit = parseInt(args.find((a) => /^\d+$/.test(a)) ?? "30");

async function main() {
  let query = supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories")
    .or("profile_status.is.null,profile_status.eq.needs_profile")
    .order("name")
    .limit(limit);

  if (typeArg === "emollient") {
    query = query.eq("structural_category", "Emollient");
  } else if (typeArg === "plant-extract") {
    query = query.eq("structural_category", "Plant Extract");
  } else {
    query = query.or("structural_category.eq.Emollient,structural_category.eq.Plant Extract");
  }

  const { data, error } = await query;
  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data ?? [], null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
