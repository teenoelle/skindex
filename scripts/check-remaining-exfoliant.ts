import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

async function run() {
  // Check for any remaining generic "Exfoliant" structural category
  const { data: remaining } = await sb
    .from("ingredients")
    .select("name, status, structural_category, flagged_category, category")
    .eq("structural_category", "Exfoliant")
    .order("name");

  console.log(`\nRemaining with structural_category='Exfoliant': ${remaining?.length ?? 0}`);
  for (const r of remaining ?? []) {
    console.log(`  ${r.name} | ${r.status} | flagged_cat: ${r.flagged_category} | cat: ${r.category}`);
  }

  // Check all exfoliant-type ingredients and whether they also have photosensitivity flagging
  const { data: allExfol } = await sb
    .from("ingredients")
    .select("name, status, structural_category, flagged_category, category")
    .in("structural_category", ["AHA Exfoliant", "BHA Exfoliant", "PHA Exfoliant", "Azelaic Acid", "Exfoliant"])
    .order("structural_category")
    .order("name");

  console.log(`\nAll exfoliant-type ingredients:`);
  for (const r of allExfol ?? []) {
    console.log(`  ${r.name} | ${r.structural_category} | status: ${r.status} | flagged_cat: ${r.flagged_category}`);
  }
}

run();
