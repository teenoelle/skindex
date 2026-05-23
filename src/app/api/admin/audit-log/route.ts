import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "7d";

  let query = supabaseAdmin
    .from("admin_audit_log")
    .select("id, action, entity_type, entity_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (range === "7d") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since);
  } else if (range === "30d") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
