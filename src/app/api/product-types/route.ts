import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("product_types")
    .select("name, body_area, is_rinse_off")
    .order("name");

  return NextResponse.json({ types: data ?? [] });
}
