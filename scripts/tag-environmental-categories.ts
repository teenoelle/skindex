/**
 * Tags ingredients with environmental concern categories in secondary_flagged_categories.
 * Covers: reef harmful, PFAS, endocrine disruptor, environmental persistent.
 *
 * Safe to re-run: never removes existing categories, only adds missing ones.
 * Pass --dry-run to preview without writing.
 * Pass --force to re-evaluate already-tagged ingredients (still won't duplicate).
 *
 * Usage:
 *   npx tsx scripts/tag-environmental-categories.ts [--dry-run]
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

const DRY_RUN = process.argv.includes("--dry-run");

type EnvCategory = "reef harmful" | "PFAS" | "endocrine disruptor" | "environmental persistent";

const ENVIRONMENTAL_RULES: { pattern: RegExp; categories: EnvCategory[] }[] = [
  // Reef-harmful UV filters (banned in Hawaii, Palau, etc.)
  { pattern: /\boxybenzone\b|benzophenone-3\b/i,                                   categories: ["reef harmful", "endocrine disruptor"] },
  { pattern: /\boctinoxate\b|ethylhexyl methoxycinnamate|octyl methoxycinnamate/i, categories: ["reef harmful"] },
  { pattern: /\boctocrylene\b/i,                                                    categories: ["reef harmful"] },
  { pattern: /\bhomosalate\b/i,                                                     categories: ["reef harmful"] },

  // PFAS / fluorinated polymers
  { pattern: /\bptfe\b|polytetrafluoroethylene/i,   categories: ["PFAS"] },
  { pattern: /perfluorodecalin|perfluorocarbon/i,   categories: ["PFAS"] },
  { pattern: /fluorosilicone|fluorinated polymer/i,  categories: ["PFAS"] },

  // Endocrine disruptors — parabens
  { pattern: /\bmethylparaben\b/i,    categories: ["endocrine disruptor"] },
  { pattern: /\bethylparaben\b/i,     categories: ["endocrine disruptor"] },
  { pattern: /\bpropylparaben\b/i,    categories: ["endocrine disruptor"] },
  { pattern: /\bbutylparaben\b/i,     categories: ["endocrine disruptor"] },
  { pattern: /\bisobutylparaben\b/i,  categories: ["endocrine disruptor"] },
  { pattern: /\bbenzylparaben\b/i,    categories: ["endocrine disruptor"] },

  // Environmentally persistent cyclic silicones (EU restricted in rinse-off)
  { pattern: /\bcyclotetrasiloxane\b|\bD4\b/i,  categories: ["environmental persistent"] },
  { pattern: /\bcyclopentasiloxane\b|\bD5\b/i,  categories: ["environmental persistent"] },
  { pattern: /\bcyclohexasiloxane\b|\bD6\b/i,   categories: ["environmental persistent"] },
];

function getEnvCategories(name: string): EnvCategory[] {
  const matched = new Set<EnvCategory>();
  for (const rule of ENVIRONMENTAL_RULES) {
    if (rule.pattern.test(name)) {
      for (const cat of rule.categories) matched.add(cat);
    }
  }
  return [...matched];
}

async function main() {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, secondary_flagged_categories")
    .order("name");

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  type Update = { id: string; name: string; adding: EnvCategory[]; existing: string[]; next: string[] };
  const updates: Update[] = [];

  for (const ing of ingredients) {
    const envCats = getEnvCategories(ing.name as string);
    if (envCats.length === 0) continue;
    const existing = (ing.secondary_flagged_categories ?? []) as string[];
    const toAdd = envCats.filter(c => !existing.includes(c));
    if (toAdd.length === 0) continue;
    updates.push({
      id: ing.id as string,
      name: ing.name as string,
      adding: toAdd,
      existing,
      next: [...existing, ...toAdd],
    });
  }

  console.log(`${ingredients.length} total ingredients.`);
  console.log(`${updates.length} to update.\n`);
  if (DRY_RUN) console.log("-- DRY RUN — no writes --\n");

  for (const u of updates) {
    const adding = u.adding.join(", ");
    const existing = u.existing.length ? `[${u.existing.join(", ")}] → ` : "";
    console.log(`  ${u.name.padEnd(40)} ${existing}+${adding}`);
  }

  if (DRY_RUN || updates.length === 0) return;

  console.log("\nWriting...");
  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ secondary_flagged_categories: u.next })
      .eq("id", u.id);
    if (updateError) {
      console.error(`  FAIL ${u.name}: ${updateError.message}`);
      fail++;
    } else {
      ok++;
    }
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
}

main();
