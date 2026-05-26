import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const { data } = await supabase
    .from("ingredients")
    .select("name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);

  return NextResponse.json({ suggestions: (data ?? []).map((r) => r.name) });
}
