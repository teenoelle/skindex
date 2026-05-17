import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

const query = process.argv[2] ?? "";

async function run() {
  const { data } = await sb
    .from("ingredients")
    .select("name, status, structural_category, category, flagged_category, explanation")
    .ilike("name", `%${query}%`)
    .order("name");

  for (const r of data ?? []) {
    console.log(`\nname:              ${r.name}`);
    console.log(`status:            ${r.status}`);
    console.log(`structural:        ${r.structural_category}`);
    console.log(`category:          ${r.category}`);
    console.log(`flagged_category:  ${r.flagged_category}`);
    console.log(`explanation:       ${r.explanation?.slice(0, 120) ?? "(none)"}`);
  }
  console.log(`\nTotal: ${data?.length}`);
}

run();
