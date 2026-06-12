import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

async function run() {
  // Find all Fragrance / Parfum flagged ingredients
  const { data, error: fetchErr } = await sb
    .from("ingredients")
    .select("id, name, flagged_category, secondary_flagged_categories, structural_category")
    .in("name", ["Fragrance", "Parfum"])
    .eq("status", "flagged");

  if (fetchErr) { console.error("Fetch error:", fetchErr.message); process.exit(1); }
  if (!data?.length) { console.log("No flagged Fragrance/Parfum rows found."); return; }

  console.log(`Found ${data.length} row(s):`);
  for (const row of data) {
    console.log(`  id=${row.id} name="${row.name}" fc="${row.flagged_category}" structural="${row.structural_category}" secondary=${JSON.stringify(row.secondary_flagged_categories)}`);

    const existing: string[] = row.secondary_flagged_categories ?? [];
    if (existing.includes("fragrance-allergen")) {
      console.log(`  → already has fragrance-allergen, skipping`);
      continue;
    }

    const updated = [...existing, "fragrance-allergen"];
    const { error: updateErr } = await sb
      .from("ingredients")
      .update({ secondary_flagged_categories: updated })
      .eq("id", row.id);

    if (updateErr) {
      console.error(`  FAIL id=${row.id}: ${updateErr.message}`);
    } else {
      console.log(`  OK   secondary_flagged_categories → ${JSON.stringify(updated)}`);
    }
  }

  console.log("\nDone.");
}

run();
