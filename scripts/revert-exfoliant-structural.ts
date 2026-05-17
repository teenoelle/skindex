import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

// structural_category → "Exfoliant" for all
// flagged_category / category keep the specific acid-class labels
const updates = [
  { name: "Glycolic Acid",  structural_category: "Exfoliant" },
  { name: "Lactic Acid",    structural_category: "Exfoliant" },
  { name: "Salicylic Acid", structural_category: "Exfoliant" },
  { name: "Gluconolactone", structural_category: "Exfoliant" },
  { name: "Azelaic Acid",   structural_category: "Exfoliant" },
];

async function run() {
  for (const u of updates) {
    const { error } = await sb
      .from("ingredients")
      .update({ structural_category: u.structural_category })
      .eq("name", u.name);
    console.log(error ? `  FAIL ${u.name}: ${error.message}` : `  OK   ${u.name}`);
  }
  console.log("\nDone.");
}

run();
