import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, brand, type, image_url, iherb_url, source_url, source")
    .order("name")
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ products: data ?? [] });
}
