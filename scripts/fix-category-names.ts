import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

async function run() {
  // Fix 1: retinoid casing — "retinoid" → "Retinoid" for all retinoid ingredients
  const { error: e1 } = await sb
    .from("ingredients")
    .update({ flagged_category: "Retinoid", category: null })
    .eq("flagged_category", "retinoid");
  console.log(e1 ? `  FAIL retinoid flagged_category: ${e1.message}` : "  OK   retinoid flagged_category → Retinoid, category → null");

  // Fix 2: azelaic acid safe category — "Azelaic Acid" → "Anti-inflammatory"
  const { error: e2 } = await sb
    .from("ingredients")
    .update({ category: "Anti-inflammatory" })
    .eq("name", "Azelaic Acid");
  console.log(e2 ? `  FAIL Azelaic Acid category: ${e2.message}` : "  OK   Azelaic Acid category → Anti-inflammatory");

  console.log("\nDone.");
}

run();
