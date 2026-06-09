/**
 * Phase 2: Flag plant-derived oils with fungal-feed and, where warranted, pore-clogger.
 *
 * Rules:
 *   - fungal-feed: all plant oils (structural_category = Emollient, name contains "oil")
 *     except fungal-acne-safe exceptions (jojoba, mineral oil, squalane, MCT/caprylic)
 *   - pore-clogger: added for HIGH comedogenic oils not already flagged
 *     (coconut oil variants, avocado oil)
 *
 * Primary/secondary logic:
 *   - Currently unflagged oil  → flagged_category = "fungal-feed"
 *   - Already pore-clogger     → add "fungal-feed" to secondary_flagged_categories
 *   - High-comedogenic + clean → flagged_category = "pore-clogger", secondary = ["fungal-feed"]
 *
 * Any ingredient whose explanation_source is "curated" will be set to
 * "template_unclassified" so generate-explanations regenerates it.
 * Ingredients with no explanation will be left with explanation_source = null
 * so Queue 0 picks them up.
 *
 * Usage:
 *   npx tsx scripts/flag-plant-oils.ts --dry-run   # preview changes
 *   npx tsx scripts/flag-plant-oils.ts             # apply changes
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

// Oils that do NOT feed Malassezia — skip fungal-feed flag
const FUNGAL_SAFE_PATTERNS = [
  /simmondsia/i,           // jojoba (wax ester, not a triglyceride)
  /jojoba/i,               // jojoba by common name
  /mineral oil/i,          // not a fatty acid
  /squalane/i,             // isoprenoid
  /caprylic.capric/i,      // MCT C8-C10
  /caprylic\/capric/i,
  /coco.caprylate/i,
  /coco-caprylate/i,
  /hydrogenated castor/i,  // wax/emulsifier form, not a triglyceride fatty acid load
  /^peg-/i,                // PEG-modified oils are surfactant/emulsifier, not fatty acids
  /unsaponifiable/i,       // the non-fatty-acid fraction of a plant oil
  // Essential oils — volatile aromatics (terpenes), not long-chain fatty acids
  /lavend/i,
  /lemon oil/i,
  /sweet orange/i,
  /citrus.*oil/i,
  /bergamot/i,
  /peppermint oil/i,
  /eucalyptus oil/i,
  /tea tree oil/i,
];

// Phase 1 handles EPO specifically — skip it here to avoid collision
const SKIP_EXACT = new Set([
  "Oenothera Biennis Oil",
]);

// Oils comedogenic enough to warrant pore-clogger as primary flag
// (if not already flagged as pore-clogger)
const HIGH_COMEDOGENIC_PATTERNS = [
  /cocos nucifera/i,       // coconut oil (4–5/5)
  /organic coconut/i,
  /coconut oil/i,
  /persea gratissima/i,    // avocado oil (2–3/5)
  /avocado oil/i,
];

type Ingredient = {
  id: string;
  name: string;
  status: string;
  flagged_category: string | null;
  secondary_flagged_categories: string[];
  explanation_source: string | null;
  explanation: string | null;
};

function isFungalSafe(name: string): boolean {
  return FUNGAL_SAFE_PATTERNS.some(p => p.test(name)) || SKIP_EXACT.has(name);
}

function isHighComedogenic(name: string): boolean {
  return HIGH_COMEDOGENIC_PATTERNS.some(p => p.test(name));
}

function computeUpdates(ing: Ingredient): Record<string, unknown> | null {
  const name = ing.name;

  if (isFungalSafe(name)) return null;

  const currentFc = ing.flagged_category;
  const currentSecondary = ing.secondary_flagged_categories ?? [];
  const alreadyHasFungalFeed =
    currentFc === "fungal-feed" || currentSecondary.includes("fungal-feed");

  if (alreadyHasFungalFeed) return null; // nothing to do

  const highComedogenic = isHighComedogenic(name);
  const alreadyPoreClogger = currentFc === "pore-clogger";

  let newFc = currentFc;
  let newSecondary = [...currentSecondary];

  if (alreadyPoreClogger) {
    // Keep pore-clogger primary, add fungal-feed secondary
    newSecondary = [...new Set([...newSecondary, "fungal-feed"])];
  } else if (highComedogenic) {
    // Promote to pore-clogger primary, fungal-feed secondary
    newFc = "pore-clogger";
    newSecondary = [...new Set([...newSecondary, "fungal-feed"])];
  } else if (currentFc) {
    // Has another primary fc (e.g. phytoestrogen) — preserve it, add fungal-feed secondary
    newSecondary = [...new Set([...newSecondary, "fungal-feed"])];
  } else {
    // No existing concern — fungal-feed becomes primary
    newFc = "fungal-feed";
  }

  const updates: Record<string, unknown> = {
    status: "flagged",
    flagged_category: newFc,
    secondary_flagged_categories: newSecondary,
  };

  // Queue for explanation regeneration
  if (ing.explanation) {
    updates.explanation_source = "template_unclassified";
  }
  // If no explanation, leave explanation_source as-is (null → Queue 0 handles it)

  return updates;
}

async function run() {
  // Fetch all Emollient ingredients whose names contain "oil"
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, status, flagged_category, secondary_flagged_categories, explanation_source, explanation")
    .eq("structural_category", "Emollient")
    .ilike("name", "%oil%")
    .order("name");

  if (error) { console.error("Fetch error:", error); process.exit(1); }

  const ingredients = (data ?? []) as Ingredient[];
  console.log(`Found ${ingredients.length} Emollient oils to evaluate.\n`);

  const toUpdate: { ing: Ingredient; updates: Record<string, unknown> }[] = [];
  const skipped: string[] = [];

  for (const ing of ingredients) {
    const updates = computeUpdates(ing);
    if (updates) {
      toUpdate.push({ ing, updates });
    } else {
      skipped.push(ing.name);
    }
  }

  console.log(`Skipped (fungal-safe or already flagged): ${skipped.length}`);
  skipped.forEach(n => console.log(`  - ${n}`));
  console.log();

  console.log(`To update: ${toUpdate.length}`);
  toUpdate.forEach(({ ing, updates }) => {
    console.log(`  ${ing.name}`);
    console.log(`    fc: ${ing.flagged_category ?? "null"} → ${updates.flagged_category}`);
    if (updates.secondary_flagged_categories) {
      console.log(`    secondary: ${JSON.stringify(ing.secondary_flagged_categories)} → ${JSON.stringify(updates.secondary_flagged_categories)}`);
    }
    if (updates.explanation_source) {
      console.log(`    explanation_source: ${ing.explanation_source} → ${updates.explanation_source}`);
    }
  });

  if (DRY_RUN) {
    console.log("\n[dry-run] No changes written.");
    return;
  }

  console.log("\nApplying updates…");
  let successCount = 0;
  let failCount = 0;

  for (const { ing, updates } of toUpdate) {
    const { error: updateError } = await supabase
      .from("ingredients")
      .update(updates)
      .eq("id", ing.id);

    if (updateError) {
      console.error(`  FAILED: ${ing.name} —`, updateError.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\nDone. ${successCount} updated, ${failCount} failed.`);
  if (successCount > 0) {
    console.log("Run `npx tsx scripts/generate-explanations.ts --loop` to regenerate explanations.");
  }
}

run();
