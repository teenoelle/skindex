import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

const updates: Array<{ name: string; structural_category: string; category: string | null; flagged_category: string | null }> = [
  { name: "Glycolic Acid",    structural_category: "AHA Exfoliant", category: null,              flagged_category: "AHA Exfoliant" },
  { name: "Lactic Acid",      structural_category: "AHA Exfoliant", category: null,              flagged_category: "AHA Exfoliant" },
  { name: "Salicylic Acid",   structural_category: "BHA Exfoliant", category: null,              flagged_category: "BHA Exfoliant" },
  { name: "Gluconolactone",   structural_category: "PHA Exfoliant", category: "PHA Exfoliant",   flagged_category: null },
  { name: "Azelaic Acid",     structural_category: "Azelaic Acid",  category: "Azelaic Acid",    flagged_category: null },
];

async function run() {
  for (const u of updates) {
    const { error } = await sb
      .from("ingredients")
      .update({
        structural_category: u.structural_category,
        category: u.category,
        flagged_category: u.flagged_category,
      })
      .eq("name", u.name);

    if (error) {
      console.error(`  FAIL ${u.name}: ${error.message}`);
    } else {
      console.log(`  OK   ${u.name} → ${u.structural_category}`);
    }
  }
  console.log("\nDone.");
}

run();
