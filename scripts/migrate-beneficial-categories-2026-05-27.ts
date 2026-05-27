// Assigns new and audited beneficial categories to ingredients in the DB.
// Only updates ingredients where category IS NULL — never overwrites existing values.
//
// New categories added:
//   skin-repairing   — allantoin, panthenol, centella asiatica, madecassoside, etc.
//   sebum-regulating — zinc pca
//   prebiotic        — inulin, fructooligosaccharides, galactooligosaccharides
//   photo-protective — ferulic acid, ergothioneine, resveratrol
//   water-protective — all structural Chelating Agent ingredients
//
// DB audit (existing categories, unassigned ingredients):
//   emollient        — structural_category = Emollient
//   barrier-repairing— structural_category = Fatty Acid | Fatty Alcohol | Ceramide
//   soothing         — bisabolol, colloidal oatmeal, avena sativa, glycyrrhiza
//
// Run: npx tsx scripts/migrate-beneficial-categories-2026-05-27.ts

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Row = { id: string; name: string; structural_category: string | null; category: string | null };

// ── Name-pattern rules ────────────────────────────────────────────────────────
// First match wins. Only applied when category IS NULL.

const NAME_RULES: { pattern: RegExp; category: string }[] = [
  // skin-repairing
  { pattern: /\ballantoin\b/i,         category: "skin-repairing" },
  { pattern: /panthenol/i,             category: "skin-repairing" },
  { pattern: /dexpanthenol/i,          category: "skin-repairing" },
  { pattern: /centella asiatica/i,     category: "skin-repairing" },
  { pattern: /madecassoside/i,         category: "skin-repairing" },
  { pattern: /asiaticoside/i,          category: "skin-repairing" },
  { pattern: /\basiatic acid\b/i,      category: "skin-repairing" },
  { pattern: /madecassic acid/i,       category: "skin-repairing" },
  // sebum-regulating
  { pattern: /zinc pca/i,              category: "sebum-regulating" },
  // prebiotic
  { pattern: /inulin/i,                category: "prebiotic" },
  { pattern: /fructooligosaccharide/i, category: "prebiotic" },
  { pattern: /galactooligosaccharide/i,category: "prebiotic" },
  // photo-protective
  { pattern: /ferulic acid/i,          category: "photo-protective" },
  { pattern: /\bergothioneine\b/i,     category: "photo-protective" },
  { pattern: /\bresveratrol\b/i,       category: "photo-protective" },
  // DB audit — existing categories not yet assigned
  { pattern: /\bbisabolol\b/i,         category: "soothing" },
  { pattern: /colloidal oatmeal/i,     category: "soothing" },
  { pattern: /avena sativa/i,          category: "soothing" },
  { pattern: /glycyrrhiza/i,           category: "soothing" },
  { pattern: /licorice root/i,         category: "soothing" },
];

// ── Structural-category rules ─────────────────────────────────────────────────
// Applied after name rules; only when category IS NULL and no name rule matched.

const STRUCTURAL_RULES: { structural_category: string; category: string }[] = [
  { structural_category: "Chelating Agent", category: "water-protective"  },
  { structural_category: "Emollient",       category: "emollient"         },
  { structural_category: "Fatty Acid",      category: "barrier-repairing" },
  { structural_category: "Fatty Alcohol",   category: "barrier-repairing" },
  { structural_category: "Ceramide",        category: "barrier-repairing" },
];

async function run() {
  // Fetch all safe ingredients with no category set
  const all: Row[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, structural_category, category")
      .eq("status", "safe")
      .is("category", null)
      .range(offset, offset + 999);
    if (error) { console.error("Fetch error:", error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Fetched ${all.length} safe ingredients with no category\n`);

  // Resolve category for each ingredient
  const changes = new Map<string, { id: string; name: string; category: string }>();

  for (const row of all) {
    // Name rules first
    for (const rule of NAME_RULES) {
      if (rule.pattern.test(row.name)) {
        changes.set(row.id, { id: row.id, name: row.name, category: rule.category });
        break;
      }
    }
    if (changes.has(row.id)) continue;

    // Structural rules second
    for (const rule of STRUCTURAL_RULES) {
      if (row.structural_category === rule.structural_category) {
        changes.set(row.id, { id: row.id, name: row.name, category: rule.category });
        break;
      }
    }
  }

  if (changes.size === 0) {
    console.log("Nothing to update.");
    return;
  }

  // Group by category for logging
  const byCategory = new Map<string, string[]>();
  for (const { name, category } of changes.values()) {
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(name);
  }

  console.log("Planned assignments:");
  for (const [category, names] of [...byCategory].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n  [${category}] — ${names.length}`);
    for (const name of names.sort()) console.log(`    ${name}`);
  }

  // Apply — batch by category using .update().in("id", [...])
  console.log("\nApplying...");
  for (const [category, names] of byCategory) {
    const ids = [...changes.values()]
      .filter(c => c.category === category)
      .map(c => c.id);

    // Supabase limit: .in() handles up to 1000 values; chunk if needed
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase
        .from("ingredients")
        .update({ category })
        .in("id", chunk);
      if (error) console.error(`  ✗ ${category} (chunk ${i / 500 + 1}):`, error.message);
      else console.log(`  ✓ ${category}: ${chunk.length} updated`);
    }
  }

  console.log("\nDone.");
}

run().catch(console.error);
