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
];

function isJunk(name: string): boolean {
  if (JUNK_PATTERNS.some((p) => p.test(name))) return true;
  if (name.trim().split(/\s+/).length > 8) return true;
  if (name.length > 100) return true;
  return false;
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

  // Fuzzy duplicates
  const fuzzyMap = new Map<string, Ingredient[]>();
  for (const ing of all) {
    if (junkIds.has(ing.id) || inExact.has(ing.id)) continue;
    const key = normFuzzy(ing.name);
    if (key.length < 4) continue;
    if (!fuzzyMap.has(key)) fuzzyMap.set(key, []);
    fuzzyMap.get(key)!.push(ing);
  }
  const fuzzyGroups = [...fuzzyMap.values()].filter((g) => g.length > 1);

  // Build final list of (keep, drop) pairs from all dupe groups
  const pairs: Array<{ keep: Ingredient; drop: Ingredient }> = [];
  for (const group of [...exactGroups, ...fuzzyGroups]) {
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
