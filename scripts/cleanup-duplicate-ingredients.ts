/**
 * Cleans up duplicate and junk ingredient rows.
 *
 * For each duplicate pair, picks the "winner" (cleaner name / more complete
 * data), re-points all product_ingredients FK rows from loser → winner (with
 * conflict handling), then deletes the loser row.
 *
 * For junk entries, removes their product_ingredients rows then deletes them.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-ingredients.ts           # dry run
 *   npx tsx scripts/cleanup-duplicate-ingredients.ts --execute # commit
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

const EXECUTE = process.argv.includes("--execute");

// ── types ────────────────────────────────────────────────────────────────────

type Ingredient = {
  id: string;
  name: string;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  secondary_flagged_categories: string[] | null;
  explanation_source: string | null;
};

// ── normalisation (same as find-duplicate-ingredients.ts) ────────────────────

const SOFT_HYPHEN = "­";

function normExact(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

function normFuzzy(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasSoftHyphen(name: string): boolean {
  return name.includes(SOFT_HYPHEN);
}

function hasTrailingPunct(name: string): boolean {
  return /[.,;:!?)]+$/.test(name.trim());
}

function hasAsterisk(name: string): boolean {
  return name.trim().endsWith("*");
}

function hasLeadingLowercase(name: string): boolean {
  const first = name.trim()[0];
  return !!first && first !== first.toUpperCase();
}

// ── junk detection ───────────────────────────────────────────────────────────

const JUNK_PATTERNS = [
  /^https?:\/\//i,
  /incidecoder\.com/i,
  /login\s+register/i,
  /uploaded by:/i,
  /ingredients overview/i,
  /formulated to/i,
  /replenisher for skin/i,
  /rejuvenate and restore/i,
  /\bfl\.?\s*oz\b/i,
  /<[a-z]/i,                            // HTML tag remnant (e.g. "Acid<span...")
  /\bflavor\b|\bflavour\b/i,            // food flavoring terms
  /\bfragrance note\b/i,                // perfumery descriptor, not an ingredient
];

const JUNK_SINGLE_WORDS = new Set([
  "silicon", "retinoid", "organic", "natural", "pure", "vegan",
  "purifying", "hydrating", "moisturizing", "nourishing", "soothing",
]);

const JUNK_TWO_WORD_PHRASES = new Set([
  "steam distilled",
]);

function isJunk(name: string): boolean {
  if (JUNK_PATTERNS.some((p) => p.test(name))) return true;
  const words = name.trim().split(/\s+/);
  if (words.length > 6) return true;
  if (name.length > 120) return true;
  if (words.length === 1 && JUNK_SINGLE_WORDS.has(words[0].toLowerCase())) return true;
  if (words.length === 2 && JUNK_TWO_WORD_PHRASES.has(name.trim().toLowerCase())) return true;
  return false;
}

// ── edit-distance duplicate detection ────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev.splice(0, n + 1, ...curr);
  }
  return prev[n];
}

/**
 * Returns true when two names that are 1 edit apart are almost certainly
 * different compounds rather than the same ingredient with a typo.
 */
function isFalseEditPositive(a: string, b: string): boolean {
  const aL = a.toLowerCase(), bL = b.toLowerCase();

  // Any numbers in both names differ → different grades/series members
  // Catches: PEG-10 vs PEG-12, Polysorbate 20 vs 60, CI 77491 vs 77492, Red 6 vs Red 7
  const numRe = /\d+/g;
  const aNums = [...aL.matchAll(numRe)].map(m => m[0]);
  const bNums = [...bL.matchAll(numRe)].map(m => m[0]);
  if (aNums.length > 0 && bNums.length > 0 && aNums.join(",") !== bNums.join(",")) return true;
  // One has numbers and the other doesn't
  if ((aNums.length > 0) !== (bNums.length > 0)) return true;

  // Very short names (≤5 chars) that differ → likely distinct compounds (BHA/BHT)
  if (a.length <= 5) return true;

  // Names ending with a short uppercase abbreviation that differs (Ceramide AP/NP, Cocamide DEA/MEA)
  const abbrevEnd = /\s+([A-Z]{2,4})$/;
  const aAbbrev = a.match(abbrevEnd)?.[1];
  const bAbbrev = b.match(abbrevEnd)?.[1];
  if (aAbbrev && bAbbrev && aAbbrev !== bAbbrev) return true;

  // Names ending with a single uppercase/lowercase letter after a space (Vitamin C/E)
  const singleLetterEnd = /\s+([A-Za-z])$/;
  const aLetter = a.match(singleLetterEnd)?.[1];
  const bLetter = b.match(singleLetterEnd)?.[1];
  if (aLetter && bLetter && aLetter.toLowerCase() !== bLetter.toLowerCase()) return true;

  // Different chemical-type prefix (methyl/ethyl/propyl → different homologues)
  const chemPrefix = /^(methyl|ethyl|propyl|butyl|hydroxy|dehydro|iso|neo|di|tri|mono)/;
  if (chemPrefix.exec(aL)?.[1] !== chemPrefix.exec(bL)?.[1]) return true;

  return false;
}

/**
 * Finds pairs that differ by at most 1 edit (insert/delete/substitute) after
 * lowercasing. Only compares names within 2 chars of each other to avoid O(n²)
 * cost and false positives across very different-length names.
 */
function findEditDistanceDupes(
  all: Ingredient[],
  exclude: Set<string>,
): Array<Ingredient[]> {
  const candidates = all.filter(i => !exclude.has(i.id) && !isJunk(i.name));
  // bucket by length so we only compare names within ±2 chars
  const byLen = new Map<number, Ingredient[]>();
  for (const ing of candidates) {
    const len = ing.name.length;
    for (const l of [len - 2, len - 1, len, len + 1, len + 2]) {
      if (!byLen.has(l)) byLen.set(l, []);
    }
    byLen.get(len)!.push(ing);
  }

  const seen = new Set<string>();
  const groups: Array<Ingredient[]> = [];

  for (const ing of candidates) {
    if (seen.has(ing.id)) continue;
    const aLow = ing.name.toLowerCase();
    const group: Ingredient[] = [ing];

    for (const l of [ing.name.length - 2, ing.name.length - 1, ing.name.length, ing.name.length + 1, ing.name.length + 2]) {
      for (const other of byLen.get(l) ?? []) {
        if (other.id === ing.id || seen.has(other.id)) continue;
        const bLow = other.name.toLowerCase();
        if (levenshtein(aLow, bLow) <= 1 && !isFalseEditPositive(ing.name, other.name)) {
          group.push(other);
          seen.add(other.id);
        }
      }
    }

    if (group.length > 1) {
      seen.add(ing.id);
      groups.push(group);
    }
  }

  return groups;
}

// ── winner selection ─────────────────────────────────────────────────────────

/**
 * Score an ingredient for "how good is this as the canonical row".
 * Higher = better to keep.
 */
function score(ing: Ingredient): number {
  let s = 0;
  if (!hasSoftHyphen(ing.name))    s += 100; // soft hyphen is the #1 bad signal
  if (!hasTrailingPunct(ing.name)) s +=  50;
  if (!hasAsterisk(ing.name))      s +=  20;
  if (!hasLeadingLowercase(ing.name)) s += 10;
  // More classification data = better
  if (ing.structural_category)     s +=   5;
  if (ing.category)                s +=   3;
  if (ing.flagged_category)        s +=   2;
  // Better explanation source
  if (ing.explanation_source === "curated")  s += 4;
  if (ing.explanation_source === "template") s += 1;
  return s;
}

function pickWinner(
  a: Ingredient,
  b: Ingredient,
): { keep: Ingredient; drop: Ingredient } {
  return score(a) >= score(b) ? { keep: a, drop: b } : { keep: b, drop: a };
}

// ── DB operations ─────────────────────────────────────────────────────────────

/** Returns how many product_ingredients rows reference ingredient_id */
async function countRefs(ingredientId: string): Promise<number> {
  const { count, error } = await supabase
    .from("product_ingredients")
    .select("*", { count: "exact", head: true })
    .eq("ingredient_id", ingredientId);
  if (error) throw new Error(`countRefs: ${error.message}`);
  return count ?? 0;
}

/**
 * Re-points product_ingredients rows from dropId → keepId.
 * Rows that would conflict (product already has keepId) are deleted instead.
 * Returns { repointed, conflictsDropped }.
 */
async function repointRefs(
  dropId: string,
  keepId: string,
): Promise<{ repointed: number; conflictsDropped: number }> {
  // Fetch all product_ids that reference the drop ingredient
  const { data: dropRows, error: fetchErr } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .eq("ingredient_id", dropId);
  if (fetchErr) throw new Error(`repointRefs fetch: ${fetchErr.message}`);
  if (!dropRows || dropRows.length === 0) return { repointed: 0, conflictsDropped: 0 };

  const dropProductIds = dropRows.map((r) => r.product_id as string);

  // Find which of those products already reference the keep ingredient
  const { data: keepRows, error: keepErr } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .eq("ingredient_id", keepId)
    .in("product_id", dropProductIds);
  if (keepErr) throw new Error(`repointRefs keep check: ${keepErr.message}`);

  const alreadyHaveKeep = new Set((keepRows ?? []).map((r) => r.product_id as string));

  // Products with conflicts: just delete the drop row
  const conflictIds = dropProductIds.filter((id) => alreadyHaveKeep.has(id));
  if (conflictIds.length > 0) {
    const { error: delErr } = await supabase
      .from("product_ingredients")
      .delete()
      .eq("ingredient_id", dropId)
      .in("product_id", conflictIds);
    if (delErr) throw new Error(`repointRefs delete conflicts: ${delErr.message}`);
  }

  // Products without conflicts: update ingredient_id
  const updateIds = dropProductIds.filter((id) => !alreadyHaveKeep.has(id));
  if (updateIds.length > 0) {
    const { error: updErr } = await supabase
      .from("product_ingredients")
      .update({ ingredient_id: keepId })
      .eq("ingredient_id", dropId)
      .in("product_id", updateIds);
    if (updErr) throw new Error(`repointRefs update: ${updErr.message}`);
  }

  return { repointed: updateIds.length, conflictsDropped: conflictIds.length };
}

/** Deletes all product_ingredients rows for an ingredient then deletes the ingredient. */
async function deleteIngredient(id: string): Promise<void> {
  const { error: piErr } = await supabase
    .from("product_ingredients")
    .delete()
    .eq("ingredient_id", id);
  if (piErr) throw new Error(`deleteIngredient pi: ${piErr.message}`);

  const { error: ingErr } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id);
  if (ingErr) throw new Error(`deleteIngredient ing: ${ingErr.message}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load all ingredients
  const all: Ingredient[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_source")
      .order("name")
      .range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...(data as Ingredient[]));
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`\nLoaded ${all.length} ingredients.\n`);

  // ── identify groups ────────────────────────────────────────────────────────
  const junk = all.filter((i) => isJunk(i.name));
  const junkIds = new Set(junk.map((i) => i.id));

  // Exact duplicates
  const exactMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id)) continue;
    const key = normExact(ing.name);
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key)!.push(ing);
  }
  const exactGroups = [...exactMap.values()].filter((g) => g.length > 1);
  const inExact = new Set(exactGroups.flat().map((i) => i.id));

  // Fuzzy duplicates (character-strip normalization)
  const fuzzyMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id) || inExact.has(ing.id)) continue;
    const key = normFuzzy(ing.name);
    if (key.length < 4) continue;
    if (!fuzzyMap.has(key)) fuzzyMap.set(key, []);
    fuzzyMap.get(key)!.push(ing);
  }
  const fuzzyGroups = [...fuzzyMap.values()].filter((g) => g.length > 1);
  const inFuzzy = new Set(fuzzyGroups.flat().map((i) => i.id));

  // Edit-distance duplicates (letter-swap typos like "salicyclic" ↔ "salicylic")
  const excludeFromEdit = new Set([...junkIds, ...inExact, ...inFuzzy]);
  const editGroups = findEditDistanceDupes(all, excludeFromEdit);

  // Build final list of (keep, drop) pairs from all dupe groups
  const pairs: Array<{ keep: Ingredient; drop: Ingredient }> = [];
  for (const group of [...exactGroups, ...fuzzyGroups, ...editGroups]) {
    // Sort by score descending; the first is the keeper
    const sorted = [...group].sort((a, b) => score(b) - score(a));
    const keep = sorted[0];
    for (const drop of sorted.slice(1)) {
      pairs.push({ keep, drop });
    }
  }

  // ── dry-run report ─────────────────────────────────────────────────────────
  console.log(`${"─".repeat(70)}`);
  console.log(`JUNK ENTRIES TO DELETE (${junk.length}):`);
  for (const ing of junk) {
    console.log(`  DELETE  ${ing.id}  "${ing.name.slice(0, 70)}…"`);
  }

  console.log(`\nDUPLICATE PAIRS TO MERGE (${pairs.length}):`);
  for (const { keep, drop } of pairs) {
    const statusWarning =
      keep.status !== drop.status ? `  ⚠ status mismatch: keeping ${keep.status}` : "";
    console.log(`  KEEP    ${keep.id}  "${keep.name}"  [${keep.status}]  src=${keep.explanation_source ?? "none"}`);
    console.log(`  DROP    ${drop.id}  "${drop.name}"  [${drop.status}]  src=${drop.explanation_source ?? "none"}${statusWarning}`);
    console.log();
  }

  const totalDeletes = junk.length + pairs.length;
  console.log(`${"─".repeat(70)}`);
  console.log(`TOTAL: ${totalDeletes} rows to delete (${junk.length} junk + ${pairs.length} duplicates)`);
  if (editGroups.length > 0) console.log(`  (${editGroups.length} of those duplicate groups found via edit-distance — verify carefully)`);

  if (!EXECUTE) {
    console.log(`\nDry run — no changes made. Re-run with --execute to commit.\n`);
    return;
  }

  // ── execute ────────────────────────────────────────────────────────────────
  console.log(`\nExecuting...\n`);
  let ok = 0;
  let failed = 0;

  // Merge duplicate pairs
  for (const { keep, drop } of pairs) {
    const refs = await countRefs(drop.id);
    try {
      if (refs > 0) {
        const { repointed, conflictsDropped } = await repointRefs(drop.id, keep.id);
        if (repointed > 0 || conflictsDropped > 0) {
          console.log(`  repointed ${repointed}, dropped ${conflictsDropped} conflicts for "${drop.name}"`);
        }
      }
      await deleteIngredient(drop.id);
      console.log(`  ✓ dropped "${drop.name}" → kept "${keep.name}"`);
      ok++;
    } catch (e) {
      console.error(`  ✗ "${drop.name}": ${e}`);
      failed++;
    }
  }

  // Delete junk
  for (const ing of junk) {
    try {
      await deleteIngredient(ing.id);
      console.log(`  ✓ deleted junk: "${ing.name.slice(0, 60)}…"`);
      ok++;
    } catch (e) {
      console.error(`  ✗ junk "${ing.id}": ${e}`);
      failed++;
    }
  }

  console.log(`\nDone — ${ok} deleted, ${failed} failed.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
