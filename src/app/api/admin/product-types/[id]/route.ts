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

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const { name, body_area } = await req.json();

  const { data: existing } = await supabaseAdmin
    .from("product_types")
    .select("name, body_area")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, string> = {};
  if (name?.trim()) patch.name = name.trim();
  if (body_area?.trim()) patch.body_area = body_area.trim();

  const { data, error } = await supabaseAdmin
    .from("product_types")
    .update(patch)
    .eq("id", id)
    .select("id, name, body_area")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (patch.name && patch.name !== existing.name) {
    await supabaseAdmin.from("products").update({ type: patch.name }).eq("type", existing.name);
  }

  await writeAuditLog(userId!, "edit_type", "product_type", id, {
    before: { name: existing.name, body_area: existing.body_area },
    after: { name: data.name, body_area: data.body_area },
  });

  return NextResponse.json({ type: data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const { data: existing } = await supabaseAdmin
    .from("product_types")
    .select("name, body_area")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count } = await supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("type", existing.name);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `${count} product${count === 1 ? "" : "s"} use this type — reassign them first` },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from("product_types").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(userId!, "delete_type", "product_type", id, {
    name: existing.name,
    body_area: existing.body_area,
  });

  return NextResponse.json({ ok: true });
}
