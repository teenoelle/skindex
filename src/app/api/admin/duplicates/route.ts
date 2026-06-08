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

  const { data, error } = await supabaseAdmin
    .from("suspected_duplicates")
    .select("product_a_id, product_b_id, similarity")
    .eq("status", "pending")
    .order("similarity", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pairs: data ?? [] });
}

export async function POST(req: Request) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();
  const { action, product_a_id, product_b_id } = body as {
    action: string;
    product_a_id: string;
    product_b_id: string;
  };

  if (action !== "dismiss") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("suspected_duplicates")
    .update({ status: "dismissed" })
    .eq("product_a_id", product_a_id)
    .eq("product_b_id", product_b_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
