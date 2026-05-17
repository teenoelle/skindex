import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateExplanation } from "@/lib/generate-explanation";

const BATCH_SIZE = 50;

type Ingredient = {
  id: string;
  name: string;
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

async function processBatch(): Promise<NextResponse> {
  const { data: batch, error } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category")
    .is("explanation", null)
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!batch?.length) return NextResponse.json({ updated: 0, remaining: 0 });

  const updateOps = (batch as Ingredient[]).map((ingredient) => {
    const explanation = generateExplanation(
      ingredient.name,
      ingredient.status,
      ingredient.structural_category,
      ingredient.category,
      ingredient.flagged_category,
    );
    return supabaseAdmin.from("ingredients").update({ explanation }).eq("id", ingredient.id);
  });

  const results = await Promise.allSettled(updateOps);
  const updated = results.filter((r) => r.status === "fulfilled").length;

  const { count: remaining } = await supabaseAdmin
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .is("explanation", null);

  return NextResponse.json({ updated, total: batch.length, remaining: remaining ?? 0 });
}

export async function GET() {
  return processBatch();
}

export async function POST() {
  return processBatch();
}
