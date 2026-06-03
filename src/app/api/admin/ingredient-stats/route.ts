import { NextResponse } from "next/server";
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

  const [{ count: weak }, { count: needsProfile }, { count: total }] = await Promise.all([
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified"),
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .eq("profile_status", "needs_profile"),
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({ weak: weak ?? 0, needsProfile: needsProfile ?? 0, total: total ?? 0 });
}
