import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { id } = await req.json();

  const { data: ingredient } = await supabase
    .from("ingredients")
    .select("id, explanation")
    .eq("id", id)
    .single();

  if (!ingredient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ explanation: ingredient.explanation ?? null });
}
