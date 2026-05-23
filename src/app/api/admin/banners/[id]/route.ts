import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { id } = await params;
  const body = await req.json();
  const { message, status, dismissible, expiry_mode, expires_at, scheduled_at } = body;

  // If activating, expire existing active banners with on_next expiry first
  if (status === "active") {
    await supabaseAdmin
      .from("site_banners")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("status", "active")
      .neq("id", id);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (message !== undefined) patch.message = message?.trim();
  if (status !== undefined) patch.status = status;
  if (dismissible !== undefined) patch.dismissible = dismissible;
  if (expiry_mode !== undefined) {
    patch.expiry_mode = expiry_mode;
    patch.expires_at = expiry_mode === "datetime" ? expires_at : null;
  }
  if (scheduled_at !== undefined) patch.scheduled_at = scheduled_at;

  const { data, error } = await supabaseAdmin
    .from("site_banners")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banner: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("site_banners").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
