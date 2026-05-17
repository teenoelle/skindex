import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

async function run() {
  const { data, error } = await sb
    .from("ingredients")
    .select("name, structural_category, flagged_category")
    .eq("status", "flagged")
    .is("flagged_category", null)
    .order("structural_category", { ascending: true, nullsFirst: true });

  if (error) { console.error(error.message); return; }

  const byStructural: Record<string, string[]> = {};
  for (const r of data ?? []) {
    const key = r.structural_category ?? "(no structural category)";
    (byStructural[key] ??= []).push(r.name);
  }

  for (const [sc, names] of Object.entries(byStructural)) {
    console.log(`\n[${sc}]`);
    for (const n of names) console.log(`  ${n}`);
  }
  console.log(`\nTotal: ${data?.length}`);
}

run();
