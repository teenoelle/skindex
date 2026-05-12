import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const BATCH_SIZE = 20;

const STRUCTURAL_CATEGORIES =
  "Emulsifier, Thickener, Film Former, Surfactant, Wax, Pigment, Colorant, pH Adjuster, Conditioning Agent, Silicone, Fatty Acid, Fatty Alcohol, Botanical Water, Mineral, Preservative Booster, Emollient, Humectant, UV Filter, Plant Extract, Solvent, Chelating Agent, Preservative, Fragrance, Peptide, Ceramide, Retinoid, Exfoliant, Protein, Clay, Amino Acid, Active";

const SAFE_CATEGORIES =
  "soothing, antioxidant, brightening, firming, antimicrobial, humectant, emollient, barrier-repairing, cleansing";

const FLAGGED_CATEGORIES =
  "sensitizer, pore-clogger, stripping, fragrance-allergen, occlusive, Fragrance, Preservative, Irritant, Drying Solvent, Sulfate Surfactant, Chemical Sunscreen, Synthetic Musk";

type Classified = {
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  explanation: string | null;
};

function buildPrompt(name: string): string {
  return `You are a skincare ingredient classifier for reactive/sensitive skin. Analyze: "${name}"

Return ONLY a JSON object (no markdown, no code block):
{"status":"safe or flagged","structural_category":"from list","category":"skin benefit or null","flagged_category":"concern or null","explanation":"1-2 sentences"}

Rules:
- status: "flagged" if commonly causes irritation, sensitization, or skin reactions; otherwise "safe"
- structural_category: one of — ${STRUCTURAL_CATEGORIES}
- category: skin benefit for safe ingredients (${SAFE_CATEGORIES}); null if purely structural with no skin benefit
- flagged_category: concern for flagged ingredients (${FLAGGED_CATEGORIES}); null if safe
- explanation: start with "${name} is..." covering its formula role and (if flagged) why it concerns reactive skin`;
}

async function classifyOne(name: string): Promise<Classified | null> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [{ role: "user", content: buildPrompt(name) }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
    if (!text) return null;
    const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    if (parsed.status !== "safe" && parsed.status !== "flagged") return null;
    return {
      status: parsed.status as "safe" | "flagged",
      structural_category: (parsed.structural_category as string) ?? null,
      category: (parsed.category as string) ?? null,
      flagged_category: (parsed.flagged_category as string) ?? null,
      explanation: (parsed.explanation as string) ?? null,
    };
  } catch {
    return null;
  }
}

async function processQueue(): Promise<NextResponse> {
  const { data: queue, error } = await supabaseAdmin
    .from("ingredient_queue")
    .select("id, name")
    .order("times_seen", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!queue?.length) return NextResponse.json({ reviewed: 0, total: 0, remaining: 0 });

  // Classify all in parallel
  const classifyResults = await Promise.allSettled(
    queue.map((item) => classifyOne(item.name).then((result) => ({ item, result })))
  );

  // Insert new ingredients in parallel, collect IDs to delete
  const insertOps = classifyResults
    .filter((r): r is PromiseFulfilledResult<{ item: { id: string; name: string }; result: Classified | null }> =>
      r.status === "fulfilled" && r.value.result !== null
    )
    .map(async ({ value: { item, result } }) => {
      const { data: existing } = await supabaseAdmin
        .from("ingredients")
        .select("id")
        .ilike("name", item.name)
        .maybeSingle();
      if (!existing && result) {
        await supabaseAdmin.from("ingredients").insert({
          name: item.name,
          status: result.status,
          structural_category: result.structural_category,
          category: result.category,
          flagged_category: result.flagged_category,
          explanation: result.explanation,
        });
      }
    });

  const insertSettled = await Promise.allSettled(insertOps);
  const reviewed = insertSettled.filter((r) => r.status === "fulfilled").length;

  // Batch-delete all processed items from queue (success or failure — keeps queue draining)
  const allIds = queue.map((item) => item.id);
  await supabaseAdmin.from("ingredient_queue").delete().in("id", allIds);

  // Return remaining count so frontend knows when to stop
  const { count: remaining } = await supabaseAdmin
    .from("ingredient_queue")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ reviewed, total: queue.length, remaining: remaining ?? 0 });
}

export async function GET() {
  return processQueue();
}

export async function POST() {
  return processQueue();
}
