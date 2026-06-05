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
    .from("product_reports")
    .select("product_id, status, note, created_at")
    .in("status", ["open", "in_review"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const openIds = new Set<string>();
  const inReviewIds = new Set<string>();
  const byProduct = new Map<string, { note: string | null; created_at: string; status: string }[]>();

  for (const row of data ?? []) {
    if (row.status === "open") openIds.add(row.product_id);
    if (row.status === "in_review") inReviewIds.add(row.product_id);
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
    byProduct.get(row.product_id)!.push({ note: row.note, created_at: row.created_at, status: row.status });
  }

  return NextResponse.json({
    openProductIds: [...openIds],
    inReviewProductIds: [...inReviewIds],
    reports: Object.fromEntries(byProduct),
  });
}
