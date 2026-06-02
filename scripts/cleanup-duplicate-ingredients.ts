/**
 * Cleans up duplicate and junk ingredient rows.
 *
 * For each duplicate pair, picks the "winner" (cleaner name / more complete
 * data), re-points all product_ingredients FK rows from loser → winner (with
 * conflict handling), then deletes the loser row.
 *
 * For junk entries, removes their product_ingredients rows then deletes them.
 *
 * Duplicate detection strategies (applied in order, each excludes already-found):
 *   1. Exact         — case/whitespace/trailing-punct normalisation
 *   2. Fuzzy         — strip all non-alphanumeric, exact match
 *   3. INCI          — two entries share the same non-null inci_name
 *   4. Stripped      — strip parenthetical INCI notation, certification marks,
 *                      and marketing prefixes, then exact match
 *   5. Sorted tokens — tokenise, drop stop words, sort; match on ≥3 tokens
 *                      (catches word-order variants like "Rosa Canina Seed Oil"
 *                      vs "Seed Oil, Rosa Canina")
 *   6. Edit-distance — Levenshtein ≤ 1 (letter-swap typos)
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
  inci_name: string | null;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  secondary_flagged_categories: string[] | null;
  explanation_source: string | null;
};

// ── normalisation ─────────────────────────────────────────────────────────────

const SOFT_HYPHEN = "­";

/** Case + whitespace + trailing-punct normalisation */
function normExact(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

/** Strip all non-alphanumeric characters (catches hyphen/slash/space variants) */
function normFuzzy(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Strip parenthetical INCI notation, bracketed content, certification marks,
 * and marketing prefixes — then apply exact normalisation.
 *
 * Catches: "Aloe Vera (Aloe Barbadensis Leaf Juice)" → "aloe vera"
 *          "Retinol (Vitamin A)*" → "retinol"
 *          "Organic Jojoba Oil" → "jojoba oil"
 */
function normStripped(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\*/g, " ")
    .replace(/^(organic|natural|pure|vegan|certified|wildcrafted|raw)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "");
}

/**
 * Tokenise, drop stop words, sort, join.
 * Returns "" for names with fewer than 3 meaningful tokens (too short to
 * word-order match safely).
 *
 * Catches: "Rosa Canina Seed Oil" ↔ "Seed Oil, Rosa Canina"
 *          "Centella Asiatica Extract" ↔ "Extract of Centella Asiatica"
 */
const STOP_WORDS = new Set(["of", "the", "and", "from", "with", "in", "an", "a"]);

function normSorted(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
    .sort();
  if (tokens.length < 3) return "";
  return tokens.join(" ");
}

// ── helper predicates ────────────────────────────────────────────────────────

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
  /<[a-z]/i,
  /\bflavor\b|\bflavour\b/i,
  /\bfragrance note\b/i,
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

  const numRe = /\d+/g;
  const aNums = [...aL.matchAll(numRe)].map(m => m[0]);
  const bNums = [...bL.matchAll(numRe)].map(m => m[0]);
  if (aNums.length > 0 && bNums.length > 0 && aNums.join(",") !== bNums.join(",")) return true;
  if ((aNums.length > 0) !== (bNums.length > 0)) return true;

  if (a.length <= 5) return true;

  const abbrevEnd = /\s+([A-Z]{2,4})$/;
  const aAbbrev = a.match(abbrevEnd)?.[1];
  const bAbbrev = b.match(abbrevEnd)?.[1];
  if (aAbbrev && bAbbrev && aAbbrev !== bAbbrev) return true;

  const singleLetterEnd = /\s+([A-Za-z])$/;
  const aLetter = a.match(singleLetterEnd)?.[1];
  const bLetter = b.match(singleLetterEnd)?.[1];
  if (aLetter && bLetter && aLetter.toLowerCase() !== bLetter.toLowerCase()) return true;

  const chemPrefix = /^(methyl|ethyl|propyl|butyl|hydroxy|dehydro|iso|neo|di|tri|mono)/;
  if (chemPrefix.exec(aL)?.[1] !== chemPrefix.exec(bL)?.[1]) return true;

  return false;
}

function findEditDistanceDupes(
  all: Ingredient[],
  exclude: Set<string>,
): Array<Ingredient[]> {
  const candidates = all.filter(i => !exclude.has(i.id) && !isJunk(i.name));
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

function score(ing: Ingredient): number {
  let s = 0;
  if (!hasSoftHyphen(ing.name))       s += 100;
  if (!hasTrailingPunct(ing.name))    s +=  50;
  if (!hasAsterisk(ing.name))         s +=  20;
  if (!hasLeadingLowercase(ing.name)) s +=  10;
  if (ing.structural_category)        s +=   5;
  if (ing.category)                   s +=   3;
  if (ing.flagged_category)           s +=   2;
  if (ing.explanation_source === "curated")  s += 4;
  if (ing.explanation_source === "template") s += 1;
  // Small length bonus — helps truncated entries lose to their complete counterparts.
  // Capped at 5 so it only breaks near-ties and never overrides quality signals.
  s += Math.min(Math.floor(ing.name.length / 5), 5);
  // Shade/variant prefix penalty: "Red 7 Ruby: Diisostearyl Malate" style names
  if (ing.name.includes(":")) s -= 20;
  // All-caps product-code penalty: "POLYGLYCERYL-3 DIISOSTEARATE 7743" style names
  if (ing.name.length > 10 && /^[A-Z0-9\s\-\/,.]+$/.test(ing.name)) s -= 10;
  return s;
}

function pickWinner(a: Ingredient, b: Ingredient): { keep: Ingredient; drop: Ingredient } {
  return score(a) >= score(b) ? { keep: a, drop: b } : { keep: b, drop: a };
}

// ── DB operations ─────────────────────────────────────────────────────────────

async function countRefs(ingredientId: string): Promise<number> {
  const { count, error } = await supabase
    .from("product_ingredients")
    .select("*", { count: "exact", head: true })
    .eq("ingredient_id", ingredientId);
  if (error) throw new Error(`countRefs: ${error.message}`);
  return count ?? 0;
}

async function repointRefs(
  dropId: string,
  keepId: string,
): Promise<{ repointed: number; conflictsDropped: number }> {
  const { data: dropRows, error: fetchErr } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .eq("ingredient_id", dropId);
  if (fetchErr) throw new Error(`repointRefs fetch: ${fetchErr.message}`);
  if (!dropRows || dropRows.length === 0) return { repointed: 0, conflictsDropped: 0 };

  const dropProductIds = dropRows.map((r) => r.product_id as string);

  const { data: keepRows, error: keepErr } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .eq("ingredient_id", keepId)
    .in("product_id", dropProductIds);
  if (keepErr) throw new Error(`repointRefs keep check: ${keepErr.message}`);

  const alreadyHaveKeep = new Set((keepRows ?? []).map((r) => r.product_id as string));

  const conflictIds = dropProductIds.filter((id) => alreadyHaveKeep.has(id));
  if (conflictIds.length > 0) {
    const { error: delErr } = await supabase
      .from("product_ingredients")
      .delete()
      .eq("ingredient_id", dropId)
      .in("product_id", conflictIds);
    if (delErr) throw new Error(`repointRefs delete conflicts: ${delErr.message}`);
  }

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
  const all: Ingredient[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, inci_name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_source")
      .order("name")
      .range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...(data as Ingredient[]));
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`\nLoaded ${all.length} ingredients.\n`);

  // ── strategy 1: exact ──────────────────────────────────────────────────────
  const junk = all.filter((i) => isJunk(i.name));
  const junkIds = new Set(junk.map((i) => i.id));

  const exactMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id)) continue;
    const key = normExact(ing.name);
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key)!.push(ing);
  }
  const exactGroups = [...exactMap.values()].filter((g) => g.length > 1);
  const inExact = new Set(exactGroups.flat().map((i) => i.id));

  // ── strategy 2: fuzzy (char-strip) ────────────────────────────────────────
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

  // ── strategy 3: INCI dedup ────────────────────────────────────────────────
  // Two DB rows sharing the same non-null inci_name are the same ingredient.
  const inciMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id) || inExact.has(ing.id) || inFuzzy.has(ing.id)) continue;
    if (!ing.inci_name) continue;
    const key = ing.inci_name.toLowerCase().trim();
    if (key.length < 3) continue;
    if (!inciMap.has(key)) inciMap.set(key, []);
    inciMap.get(key)!.push(ing);
  }
  const inciGroups = [...inciMap.values()].filter((g) => g.length > 1);
  const inInci = new Set(inciGroups.flat().map((i) => i.id));

  // ── strategy 4: stripped (parenthetical INCI / marketing prefix) ──────────
  const strippedMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id) || inExact.has(ing.id) || inFuzzy.has(ing.id) || inInci.has(ing.id)) continue;
    const key = normStripped(ing.name);
    if (key.length < 4) continue;
    if (!strippedMap.has(key)) strippedMap.set(key, []);
    strippedMap.get(key)!.push(ing);
  }
  const strippedGroups = [...strippedMap.values()].filter((g) => g.length > 1);
  const inStripped = new Set(strippedGroups.flat().map((i) => i.id));

  // ── strategy 5: sorted tokens (word-order variants) ───────────────────────
  const sortedMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id) || inExact.has(ing.id) || inFuzzy.has(ing.id) || inInci.has(ing.id) || inStripped.has(ing.id)) continue;
    const key = normSorted(ing.name);
    if (!key) continue; // empty = fewer than 3 tokens, skip
    if (!sortedMap.has(key)) sortedMap.set(key, []);
    sortedMap.get(key)!.push(ing);
  }
  const sortedGroups = [...sortedMap.values()].filter((g) => g.length > 1);
  const inSorted = new Set(sortedGroups.flat().map((i) => i.id));

  // ── strategy 6: edit-distance (letter-swap typos) ─────────────────────────
  const excludeFromEdit = new Set([...junkIds, ...inExact, ...inFuzzy, ...inInci, ...inStripped, ...inSorted]);
  const editGroups = findEditDistanceDupes(all, excludeFromEdit);

  // ── build pairs with strategy labels ──────────────────────────────────────
  const pairs: Array<{ keep: Ingredient; drop: Ingredient; strategy: string }> = [];

  function addPairs(groups: Array<Ingredient[]>, strategy: string) {
    for (const group of groups) {
      const sorted = [...group].sort((a, b) => score(b) - score(a));
      const keep = sorted[0];
      for (const drop of sorted.slice(1)) {
        pairs.push({ keep, drop, strategy });
      }
    }
  }

  addPairs(exactGroups, "exact");
  addPairs(fuzzyGroups, "fuzzy");
  addPairs(inciGroups, "inci");
  addPairs(strippedGroups, "stripped");
  addPairs(sortedGroups, "sorted");
  addPairs(editGroups, "edit-distance");

  // ── report ─────────────────────────────────────────────────────────────────
  console.log(`${"─".repeat(70)}`);
  console.log(`JUNK ENTRIES TO DELETE (${junk.length}):`);
  for (const ing of junk) {
    console.log(`  DELETE  ${ing.id}  "${ing.name.slice(0, 70)}"`);
  }

  // Group pairs by strategy for readability
  const byStrategy = new Map<string, typeof pairs>();
  for (const p of pairs) {
    if (!byStrategy.has(p.strategy)) byStrategy.set(p.strategy, []);
    byStrategy.get(p.strategy)!.push(p);
  }

  console.log(`\nDUPLICATE PAIRS TO MERGE (${pairs.length} total):`);
  for (const [strategy, stratPairs] of byStrategy) {
    console.log(`\n  ── ${strategy.toUpperCase()} (${stratPairs.length}) ──`);
    for (const { keep, drop } of stratPairs) {
      const warn = keep.status !== drop.status ? `  ⚠ status mismatch: keeping ${keep.status}` : "";
      console.log(`    KEEP  "${keep.name}"  [${keep.status}]  src=${keep.explanation_source ?? "none"}`);
      console.log(`    DROP  "${drop.name}"  [${drop.status}]  src=${drop.explanation_source ?? "none"}${warn}`);
      console.log();
    }
  }

  const totalDeletes = junk.length + pairs.length;
  console.log(`${"─".repeat(70)}`);
  console.log(`TOTAL: ${totalDeletes} rows to delete (${junk.length} junk + ${pairs.length} duplicates)`);
  const highRisk = pairs.filter(p => p.strategy === "sorted" || p.strategy === "inci");
  if (highRisk.length > 0) console.log(`  ⚠  ${highRisk.length} pair(s) via INCI/sorted — verify carefully before --execute`);

  if (!EXECUTE) {
    console.log(`\nDry run — no changes made. Re-run with --execute to commit.\n`);
    return;
  }

  // ── execute ────────────────────────────────────────────────────────────────
  console.log(`\nExecuting...\n`);
  let ok = 0;
  let failed = 0;

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

  for (const ing of junk) {
    try {
      await deleteIngredient(ing.id);
      console.log(`  ✓ deleted junk: "${ing.name.slice(0, 60)}"`);
      ok++;
    } catch (e) {
      console.error(`  ✗ junk "${ing.id}": ${e}`);
      failed++;
    }
  }

  console.log(`\nDone — ${ok} deleted, ${failed} failed.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
