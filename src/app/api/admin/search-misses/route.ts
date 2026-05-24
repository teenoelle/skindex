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
    .from("search_misses")
    .select("id, query, kind, failure, times_seen, last_seen")
    .order("times_seen", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { action, id } = await req.json();

  if (action === "dismiss") {
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await supabaseAdmin.from("search_misses").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "dismiss-all") {
    await supabaseAdmin.from("search_misses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
