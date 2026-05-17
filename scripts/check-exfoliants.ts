import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

async function run() {
  const { data, error } = await sb
    .from("ingredients")
    .select("name, status, category, flagged_category")
    .eq("structural_category", "Exfoliant")
    .order("status")
    .order("name");

  if (error) { console.error(error.message); return; }

  const byStat: Record<string, string[]> = {};
  for (const r of data ?? []) {
    (byStat[r.status] ??= []).push(r.name);
  }

  for (const [s, names] of Object.entries(byStat)) {
    console.log(`\n[${s}]`);
    for (const n of names) console.log(`  ${n}`);
  }
  console.log(`\nTotal: ${data?.length}`);
}

run();
