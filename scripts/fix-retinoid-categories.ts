import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://fqpqlllixjnzsdpqrovv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcHFsbGxpeGpuenNkcHFyb3Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3MzYzMSwiZXhwIjoyMDkzMTQ5NjMxfQ.HwIluVsPU7QySadRgBaZDiYNX0ZYdL2581YDO5L9MHs"
);

const RETINOL_EXPLANATION = `Retinol is a vitamin A derivative that accelerates skin cell turnover to smooth texture, reduce fine lines, and fade discoloration. It is flagged for reactive skin because the accelerated turnover progressively thins the stratum corneum — the protective outer barrier — leaving skin more vulnerable to irritants, environmental triggers, and UV damage. Dryness, peeling, and stinging are common during the adjustment period, and sun sensitivity increases substantially with regular use.`;

const RETINYL_EXPLANATION = `Retinyl palmitate is a mild ester form of vitamin A that converts to retinol in the skin. Like all retinoids, it accelerates cell turnover — which progressively thins the stratum corneum and weakens the skin barrier over time. The barrier-thinning effect increases photosensitivity and can worsen irritation on reactive or sensitized skin, particularly at higher concentrations or with frequent use.`;

async function run() {
  // Update flagged_category for all retinoids: "Retinoid" → "Barrier-disrupting"
  const { error: e1 } = await sb
    .from("ingredients")
    .update({ flagged_category: "Barrier-disrupting" })
    .eq("flagged_category", "Retinoid");
  console.log(e1 ? `  FAIL flagged_category: ${e1.message}` : "  OK   flagged_category → Barrier-disrupting");

  // Update Retinol explanation
  const { error: e2 } = await sb
    .from("ingredients")
    .update({ explanation: RETINOL_EXPLANATION })
    .eq("name", "Retinol");
  console.log(e2 ? `  FAIL Retinol explanation: ${e2.message}` : "  OK   Retinol explanation updated");

  // Update Retinyl Palmitate explanation
  const { error: e3 } = await sb
    .from("ingredients")
    .update({ explanation: RETINYL_EXPLANATION })
    .eq("name", "Retinyl Palmitate");
  console.log(e3 ? `  FAIL Retinyl Palmitate explanation: ${e3.message}` : "  OK   Retinyl Palmitate explanation updated");

  console.log("\nDone.");
}

run();
