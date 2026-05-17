import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

// Structural types that now have a meaningful safe benefit category
const STRUCTURAL_TO_CATEGORY: Record<string, string> = {
  "Fatty Alcohol":       "Softening",
  "Fatty Acid":          "Barrier support",
  "Silicone":            "Smoothing",
  "Clay":                "Pore-cleansing",
  "Protein":             "Strengthening",
  "Conditioning Agent":  "Conditioning",
  "Emollient":           "Moisturizing",
};

async function run() {
  for (const [structural, category] of Object.entries(STRUCTURAL_TO_CATEGORY)) {
    const { data, error } = await sb
      .from("ingredients")
      .update({ category })
      .eq("structural_category", structural)
      .eq("status", "safe")
      .is("category", null)
      .select("name");

    if (error) {
      console.error(`  FAIL ${structural}: ${error.message}`);
    } else {
      console.log(`  OK   ${structural} → "${category}" (${data?.length ?? 0} updated)`);
    }
  }
  console.log("\nDone.");
}

run();
