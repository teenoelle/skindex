// Applies current classifier output to the DB for all ingredients.
// Dry-run by default; pass --apply to write changes.
// Run: npx tsx scripts/apply-classifier.ts
// Run: npx tsx scripts/apply-classifier.ts --apply

import { createClient } from "@supabase/supabase-js";
import { classifyIngredient } from "../src/lib/ingredient-classifier";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

const APPLY = process.argv.includes("--apply");

type Row = {
  id: string;
  name: string;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

type Patch = {
  status?: string;
  structural_category?: string | null;
  category?: string | null;
  flagged_category?: string | null;
};

type Change = {
  id: string;
  name: string;
  patch: Patch;
  old: Partial<Row>;
};

async function main() {
  // Fetch all ingredients
  const all: Row[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category")
      .range(offset, offset + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Fetched ${all.length} ingredients\n`);

  const changes: Change[] = [];

  for (const row of all) {
    const c = classifyIngredient(row.name);
    const patch: Patch = {};
    const old: Partial<Row> = {};

    // Status
    if (c.status !== row.status) {
      patch.status = c.status;
      old.status = row.status;
    }

    // Structural category — always sync to classifier if classifier has one
    if (c.structural_category && c.structural_category !== row.structural_category) {
      patch.structural_category = c.structural_category;
      old.structural_category = row.structural_category;
    }

    // Determine whether the classifier has a confident structural opinion on this ingredient.
    // If the classifier can't identify a structural_category but the DB already has one,
    // the DB value is likely correct — skip category updates to avoid overwriting valid data.
    const classifierHasStructural = !!c.structural_category;
    const dbHasStructural = !!row.structural_category;
    const statusChanged = patch.status !== undefined;

    // Safe category — sync when status matches safe
    if (c.status === "safe") {
      // Only update category when classifier has a structural opinion, or when status just changed
      if (classifierHasStructural || statusChanged || !dbHasStructural) {
        if ((c.category ?? null) !== row.category) {
          patch.category = c.category ?? null;
          old.category = row.category;
        }
      }
      // Clear any lingering flagged_category on safe ingredients
      if (row.flagged_category !== null) {
        patch.flagged_category = null;
        old.flagged_category = row.flagged_category;
      }
    }

    // Flagged category — sync when status matches flagged
    if (c.status === "flagged") {
      // Only update flagged_category when classifier has a structural opinion, or when status just changed
      if (classifierHasStructural || statusChanged || !dbHasStructural) {
        if ((c.flagged_category ?? null) !== row.flagged_category) {
          patch.flagged_category = c.flagged_category ?? null;
          old.flagged_category = row.flagged_category;
        }
      }
      // Clear any lingering safe category on flagged ingredients
      if (row.category !== null) {
        patch.category = null;
        old.category = row.category;
      }
    }

    if (Object.keys(patch).length > 0) {
      changes.push({ id: row.id, name: row.name, patch, old });
    }
  }

  // Group changes for display
  const byField: Record<string, Change[]> = {};
  for (const ch of changes) {
    const fields = Object.keys(ch.patch).join("+");
    (byField[fields] ??= []).push(ch);
  }

  for (const [fields, items] of Object.entries(byField).sort()) {
    console.log(`\n═══ ${fields} (${items.length}) ════════════════════`);
    for (const ch of items) {
      const oldStr = Object.entries(ch.old).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
      const newStr = Object.entries(ch.patch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
      console.log(`  "${ch.name}"`);
      console.log(`    WAS: ${oldStr}`);
      console.log(`    NOW: ${newStr}`);
    }
  }

  console.log(`\nTotal changes: ${changes.length}`);

  if (!APPLY) {
    console.log("\nDry run — pass --apply to write changes to DB.");
    return;
  }

  console.log("\nApplying changes…");
  let updated = 0;
  let failed = 0;
  for (const ch of changes) {
    const { error } = await sb.from("ingredients").update(ch.patch).eq("id", ch.id);
    if (error) {
      console.error(`  FAILED "${ch.name}": ${error.message}`);
      failed++;
    } else {
      updated++;
    }
  }
  console.log(`\nDone. ${updated} updated, ${failed} failed.`);
}

main();
