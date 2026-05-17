// Full ingredient audit: compares every DB record against current classifier output.
// Prints mismatches by field. Run: npx tsx scripts/full-audit.ts

import { createClient } from "@supabase/supabase-js";
import { classifyIngredient } from "../src/lib/ingredient-classifier";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

type Row = {
  id: string;
  name: string;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

type Mismatch = {
  row: Row;
  field: string;
  db: string | null;
  classifier: string | null;
};

async function main() {
  const all: Row[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category")
      .range(offset, offset + 999);
    if (error) { console.error(error.message); break; }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Total ingredients in DB: ${all.length}\n`);

  const mismatches: Mismatch[] = [];
  const noClassifier: Row[] = [];

  for (const row of all) {
    const c = classifyIngredient(row.name);

    // If classifier returns safe but DB says flagged (or vice versa), that's a status mismatch
    if (c.status !== row.status) {
      mismatches.push({ row, field: "status", db: row.status, classifier: c.status });
    }

    // Structural category mismatch — only flag when both have a value and they differ
    if (c.structural_category && row.structural_category && c.structural_category !== row.structural_category) {
      mismatches.push({ row, field: "structural_category", db: row.structural_category, classifier: c.structural_category });
    }
    // Classifier produces structural but DB has none
    if (c.structural_category && !row.structural_category) {
      mismatches.push({ row, field: "structural_category", db: "(null)", classifier: c.structural_category });
    }

    // Category mismatch (for safe ingredients)
    if (row.status === "safe" && c.status === "safe") {
      if (c.category && row.category && c.category !== row.category) {
        mismatches.push({ row, field: "category", db: row.category, classifier: c.category });
      }
    }

    // Flagged_category mismatch (for flagged ingredients)
    if (row.status === "flagged" && c.status === "flagged") {
      if (c.flagged_category && row.flagged_category && c.flagged_category !== row.flagged_category) {
        mismatches.push({ row, field: "flagged_category", db: row.flagged_category, classifier: c.flagged_category });
      }
    }

    if (!c.structural_category && !row.structural_category) {
      noClassifier.push(row);
    }
  }

  // Group by field
  const byField: Record<string, Mismatch[]> = {};
  for (const m of mismatches) {
    (byField[m.field] ??= []).push(m);
  }

  for (const [field, items] of Object.entries(byField)) {
    console.log(`\n═══ ${field.toUpperCase()} mismatches (${items.length}) ════════════════════`);
    for (const m of items) {
      console.log(`  "${m.row.name}"`);
      console.log(`    DB:         ${m.db}`);
      console.log(`    Classifier: ${m.classifier}`);
    }
  }

  console.log(`\n═══ No structural category in DB or classifier (${noClassifier.length}) ════`);
  for (const r of noClassifier) {
    console.log(`  [${r.status}] "${r.name}"  cat=${r.category ?? "null"}  flagged_cat=${r.flagged_category ?? "null"}`);
  }

  console.log(`\nTotal mismatches: ${mismatches.length}`);
}

main();
