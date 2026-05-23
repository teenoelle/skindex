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

export async function GET() {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { data, error } = await supabaseAdmin
    .from("site_banners")
    .select("id, message, status, dismissible, expiry_mode, expires_at, scheduled_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();
  const { message, status, dismissible, expiry_mode, expires_at, scheduled_at } = body;

  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // If activating, expire any currently active banners with on_next expiry
  if (status === "active") {
    await supabaseAdmin
      .from("site_banners")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("status", "active")
      .eq("expiry_mode", "on_next");
    // Also expire active banners to make way for new one
    await supabaseAdmin
      .from("site_banners")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("status", "active");
  }

  const { data, error } = await supabaseAdmin
    .from("site_banners")
    .insert({
      message: message.trim(),
      status: status ?? "draft",
      dismissible: dismissible ?? true,
      expiry_mode: expiry_mode ?? "none",
      expires_at: expiry_mode === "datetime" ? expires_at : null,
      scheduled_at: status === "scheduled" ? scheduled_at : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banner: data });
}
