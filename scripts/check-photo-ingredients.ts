import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

// All ingredients that could match PHOTO_PATTERNS
const names = [
  // photo-retinoid
  "Retinol","Retinyl Palmitate","Retinaldehyde","Tretinoin",
  // photo-AHA
  "Glycolic Acid","Lactic Acid","Mandelic Acid","Tartaric Acid","Alpha-Arbutin","Arbutin","Polyglutamic Acid",
  // photo-BHA
  "Salicylic Acid",
  // photo-botanical (spot check)
  "Limonene","Bergamot","Citral",
];

async function run() {
  const { data } = await sb
    .from("ingredients")
    .select("name, status, structural_category, category, flagged_category")
    .in("name", names)
    .order("name");

  console.log("\nIngredient | structural | flagged_cat | category");
  console.log("─".repeat(70));
  for (const r of data ?? []) {
    console.log(`${r.name.padEnd(28)} | ${(r.structural_category ?? "—").padEnd(16)} | ${(r.flagged_category ?? "—").padEnd(16)} | ${r.category ?? "—"}`);
  }
  console.log(`\nTotal in DB: ${data?.length}`);
}

run();
