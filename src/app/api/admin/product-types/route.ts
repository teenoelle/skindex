import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  return data?.role === "admin";
}

export async function GET() {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("product_types")
    .select("id, name, body_area")
    .order("body_area")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ types: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, body_area } = await req.json();
  if (!name?.trim() || !body_area?.trim()) {
    return NextResponse.json({ error: "name and body_area are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("product_types")
    .insert({ name: name.trim(), body_area: body_area.trim() })
    .select("id, name, body_area")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ type: data });
}
