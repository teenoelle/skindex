/**
 * Phase 1: Flag Oenothera Biennis Oil with pore-clogger (primary) and
 * fungal-feed (secondary), then queue it for explanation regeneration.
 *
 * The extract / flower extract forms are left as-is — they are
 * polyphenol/antioxidant extracts, not fatty acid loads.
 *
 * Usage:
 *   npx tsx scripts/flag-epo.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error("NEXT_PUBLIC_SUPABASE_URL not set"); })(),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY not set"); })(),
);

async function run() {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, status, flagged_category, secondary_flagged_categories, explanation_source")
    .ilike("name", "%biennis%")
    .order("name");

  if (error) { console.error("Fetch error:", error); process.exit(1); }

  const oil = data?.find(r => /oil/i.test(r.name) && !/flower/i.test(r.name));

  if (!oil) {
    console.log("Oenothera Biennis Oil not found in DB.");
    process.exit(0);
  }

  console.log(`Found: ${oil.name} (${oil.id})`);
  console.log(`  current status:     ${oil.status}`);
  console.log(`  current fc:         ${oil.flagged_category}`);
  console.log(`  current secondary:  ${JSON.stringify(oil.secondary_flagged_categories)}`);
  console.log(`  explanation_source: ${oil.explanation_source}`);
  console.log();

  const updates = {
    status: "flagged",
    flagged_category: "pore-clogger",
    secondary_flagged_categories: ["fungal-feed"],
    explanation_source: "template_unclassified",
  };

  console.log("Updates to apply:");
  console.log(JSON.stringify(updates, null, 2));

  if (DRY_RUN) {
    console.log("\n[dry-run] No changes written.");
    return;
  }

  const { error: updateError } = await supabase
    .from("ingredients")
    .update(updates)
    .eq("id", oil.id);

  if (updateError) {
    console.error("Update error:", updateError);
    process.exit(1);
  }

  console.log("\nDone. Oenothera Biennis Oil is queued for explanation regeneration.");
  console.log("Run `npx tsx scripts/generate-explanations.ts` to regenerate.");
}

run();
