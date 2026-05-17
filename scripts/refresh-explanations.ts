// Force-refreshes ALL ingredient explanations using the current template + curated dictionary.
// Overwrites existing explanations so improvements take effect immediately.
// Run with: npx tsx scripts/refresh-explanations.ts

import { createClient } from "@supabase/supabase-js";
import { generateExplanation } from "../src/lib/generate-explanation";

const SUPABASE_URL = "https://fqpqlllixjnzsdpqrovv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BATCH_SIZE = 200;

async function main() {
  let totalUpdated = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, status, structural_category, category, flagged_category")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data?.length) break;

    const results = await Promise.allSettled(
      data.map((ingredient) => {
        const explanation = generateExplanation(
          ingredient.name,
          ingredient.status as "safe" | "flagged",
          ingredient.structural_category,
          ingredient.category,
          ingredient.flagged_category,
        );
        return supabase.from("ingredients").update({ explanation }).eq("id", ingredient.id);
      })
    );

    const saved = results.filter((r) => r.status === "fulfilled").length;
    totalUpdated += saved;
    offset += data.length;
    console.log(`Updated ${totalUpdated} so far… (offset ${offset})`);
  }

  console.log(`\nDone. ${totalUpdated} explanations refreshed.`);
}

main();
