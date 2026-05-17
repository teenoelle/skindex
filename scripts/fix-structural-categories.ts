// Finds all ingredients with null structural_category, runs them through the classifier,
// and optionally applies fixes to the DB.
// Run (dry-run):  npx tsx scripts/fix-structural-categories.ts
// Run (apply):    npx tsx scripts/fix-structural-categories.ts --apply

import { createClient } from "@supabase/supabase-js";
import { classifyIngredient } from "../src/lib/ingredient-classifier";

const SUPABASE_URL = "https://fqpqlllixjnzsdpqrovv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 200;

async function main() {
  const fixable: { id: string; name: string; structural_category: string; category: string | null }[] = [];
  const unfixable: { name: string; status: string }[] = [];

  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category")
      .is("structural_category", null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data?.length) break;

    for (const row of data) {
      const result = classifyIngredient(row.name);
      if (result.structural_category) {
        fixable.push({
          id: row.id,
          name: row.name,
          structural_category: result.structural_category,
          category: result.category,
        });
      } else {
        unfixable.push({ name: row.name, status: row.status });
      }
    }

    offset += data.length;
  }

  console.log(`\n── Fixable (${fixable.length}) ──────────────────────────`);
  for (const f of fixable) {
    console.log(`  ${f.structural_category.padEnd(20)} ${f.name}`);
  }

  console.log(`\n── Still no structural category (${unfixable.length}) ────`);
  const byStatus: Record<string, string[]> = {};
  for (const u of unfixable) {
    (byStatus[u.status] ??= []).push(u.name);
  }
  for (const [status, names] of Object.entries(byStatus)) {
    console.log(`\n  [${status}]`);
    for (const n of names) console.log(`    ${n}`);
  }

  if (APPLY && fixable.length > 0) {
    console.log(`\nApplying ${fixable.length} updates…`);
    let updated = 0;
    for (const f of fixable) {
      const patch: Record<string, string | null> = { structural_category: f.structural_category };
      if (f.category !== null) patch.category = f.category;
      const { error } = await supabase.from("ingredients").update(patch).eq("id", f.id);
      if (!error) updated++;
    }
    console.log(`Done. ${updated} ingredients updated.`);
  } else if (!APPLY && fixable.length > 0) {
    console.log(`\nRun with --apply to write these to the DB.`);
  }
}

main();
