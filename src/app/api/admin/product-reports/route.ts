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
    .select("product_id, note, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return unique product_ids and full report details grouped by product
  const byProduct = new Map<string, { note: string | null; created_at: string }[]>();
  for (const row of data ?? []) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
    byProduct.get(row.product_id)!.push({ note: row.note, created_at: row.created_at });
  }

  return NextResponse.json({
    productIds: [...byProduct.keys()],
    reports: Object.fromEntries(byProduct),
  });
}
