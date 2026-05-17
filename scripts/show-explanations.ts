import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

const names = process.argv.slice(2);

async function run() {
  const { data, error } = await sb
    .from("ingredients")
    .select("name, structural_category, flagged_category, explanation")
    .in("name", names.length ? names : ["Glycolic Acid", "Lactic Acid", "Salicylic Acid", "Gluconolactone", "Azelaic Acid"]);

  if (error) { console.error(error.message); return; }

  for (const r of data ?? []) {
    console.log(`\n=== ${r.name} (${r.structural_category}) ===`);
    console.log(r.explanation ?? "(no explanation)");
  }
}

run();
