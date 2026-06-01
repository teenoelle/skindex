/**
 * Finds duplicate and near-duplicate ingredient entries.
 *
 * Reports three categories:
 *   1. Exact duplicates  — same name after lowercasing + trimming
 *   2. Fuzzy duplicates  — same name after removing all spaces/punctuation
 *                          (catches typos like "ade nosine" ↔ "adenosine")
 *   3. Junk entries      — names that are clearly not ingredients (URLs,
 *                          product descriptions, navigation text, etc.)
 *
 * Usage:
 *   npx tsx scripts/find-duplicate-ingredients.ts
 *   npx tsx scripts/find-duplicate-ingredients.ts --json   # machine-readable output
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

const JSON_ONLY = process.argv.includes("--json");

type Ingredient = {
  id: string;
  name: string;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  explanation_source: string | null;
};

// ── normalisation helpers ────────────────────────────────────────────────────

/** For exact-duplicate detection: lowercase + collapse whitespace + strip trailing punctuation */
function normExact(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

/** For fuzzy-duplicate detection: strip ALL non-alpha chars so
 *  "ade nosine" → "adenosine", "asorbic acid" → "asorbicacid" */
function normFuzzy(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── junk detection ───────────────────────────────────────────────────────────

const JUNK_PATTERNS = [
  /^https?:\/\//i,                    // starts with URL
  /incidecoder\.com/i,                // INCIDecoder domain
  /login\s+register/i,                // navigation text
  /uploaded by:/i,                    // upload metadata
  /ingredients overview/i,            // page heading
  /formulated to/i,                   // marketing copy
  /replenisher for skin/i,            // product description
  /rejuvenate and restore/i,          // product description
  /\bfl\.?\s*oz\b/i,                  // product label data
];

const JUNK_THRESHOLDS = {
  maxWords: 8,     // more than 8 words → almost certainly not an ingredient name
  maxLength: 100,  // more than 100 chars → same
};

function isJunk(name: string): boolean {
  if (JUNK_PATTERNS.some((p) => p.test(name))) return true;
  const wordCount = name.trim().split(/\s+/).length;
  if (wordCount > JUNK_THRESHOLDS.maxWords) return true;
  if (name.length > JUNK_THRESHOLDS.maxLength) return true;
  return false;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Paginate to get all ingredients (Supabase default limit is 1000)
  const all: Ingredient[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category, explanation_source")
      .order("name")
      .range(from, from + PAGE - 1);
    if (error) { process.stderr.write(`Error: ${error.message}\n`); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...(data as Ingredient[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (!JSON_ONLY) process.stderr.write(`\nLoaded ${all.length} ingredients.\n`);

  // ── 1. junk entries ────────────────────────────────────────────────────────
  const junk = all.filter((i) => isJunk(i.name));

  // ── 2. exact duplicates ────────────────────────────────────────────────────
  const exactMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (isJunk(ing.name)) continue; // junk already reported separately
    const key = normExact(ing.name);
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key)!.push(ing);
  }
  const exactDupes = [...exactMap.values()].filter((g) => g.length > 1);

  // ── 3. fuzzy duplicates (exclude exact-dupe groups already found) ──────────
  // Build a set of IDs already in exact-dupe groups so we don't double-report
  const inExactGroup = new Set(exactDupes.flat().map((i) => i.id));

  const fuzzyMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (isJunk(ing.name)) continue;
    if (inExactGroup.has(ing.id)) continue; // already in an exact group
    const key = normFuzzy(ing.name);
    if (key.length < 4) continue; // skip very short keys (numbers, single words)
    if (!fuzzyMap.has(key)) fuzzyMap.set(key, []);
    fuzzyMap.get(key)!.push(ing);
  }
  const fuzzyDupes = [...fuzzyMap.values()].filter((g) => g.length > 1);

  // ── output ─────────────────────────────────────────────────────────────────

  const report = {
    summary: {
      total: all.length,
      junk: junk.length,
      exact_duplicate_groups: exactDupes.length,
      fuzzy_duplicate_groups: fuzzyDupes.length,
    },
    junk,
    exact_duplicates: exactDupes,
    fuzzy_duplicates: fuzzyDupes,
  };

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  // Human-readable summary to stdout
  const src = (ing: Ingredient) => ing.explanation_source ?? "none";
  const row = (ing: Ingredient) =>
    `    ${ing.id}  "${ing.name}"  [${ing.status}]  src=${src(ing)}`;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`TOTAL INGREDIENTS: ${all.length}`);
  console.log(`${"─".repeat(60)}\n`);

  // Junk
  console.log(`JUNK ENTRIES (${junk.length}) — should probably be deleted:`);
  if (junk.length === 0) {
    console.log("  (none)");
  } else {
    for (const ing of junk) {
      console.log(`  ${ing.id}  "${ing.name.slice(0, 80)}${ing.name.length > 80 ? "…" : ""}"`);
    }
  }

  // Exact duplicates
  console.log(`\nEXACT DUPLICATES (${exactDupes.length} groups):`);
  if (exactDupes.length === 0) {
    console.log("  (none)");
  } else {
    for (const group of exactDupes) {
      console.log(`\n  "${group[0].name}" — ${group.length} entries:`);
      for (const ing of group) console.log(row(ing));
    }
  }

  // Fuzzy duplicates
  console.log(`\nFUZZY DUPLICATES (${fuzzyDupes.length} groups — possible typos/variants):`);
  if (fuzzyDupes.length === 0) {
    console.log("  (none)");
  } else {
    for (const group of fuzzyDupes) {
      console.log(`\n  Normalised key "${normFuzzy(group[0].name)}":`);
      for (const ing of group) console.log(row(ing));
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(
    `SUMMARY: ${junk.length} junk, ${exactDupes.length} exact-dupe groups, ${fuzzyDupes.length} fuzzy-dupe groups`
  );
  console.log(`${"─".repeat(60)}\n`);
}

main().catch((e) => { process.stderr.write(String(e) + "\n"); process.exit(1); });
