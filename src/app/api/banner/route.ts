import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("site_banners")
    .select("id, message, dismissible")
    .eq("status", "active")
    .or(`expiry_mode.eq.none,expiry_mode.eq.on_next,and(expiry_mode.eq.datetime,expires_at.gt.${now})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ banner: null });
  return NextResponse.json({ banner: data });
}
