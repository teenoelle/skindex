import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";

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
    .select("id, name, body_area, is_rinse_off")
    .order("body_area")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ types: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, body_area, is_rinse_off } = await req.json();
  if (!name?.trim() || !body_area?.trim()) {
    return NextResponse.json({ error: "name and body_area are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("product_types")
    .insert({ name: name.trim(), body_area: body_area.trim(), is_rinse_off: Boolean(is_rinse_off ?? false) })
    .select("id, name, body_area, is_rinse_off")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(userId!, "add_type", "product_type", data.id, {
    name: data.name,
    body_area: data.body_area,
  });

  return NextResponse.json({ type: data });
}
