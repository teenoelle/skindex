import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401, userId: null };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403, userId: null };
  return { error: null, status: 200, userId };
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  // Fetch all in_review reports for this product to get the reporter user_ids
  const { data: reports } = await supabaseAdmin
    .from("product_reports")
    .select("user_id")
    .eq("product_id", productId)
    .eq("status", "in_review");

  if (!reports?.length) return NextResponse.json({ error: "No in-review reports found" }, { status: 404 });

  const now = new Date().toISOString();

  // Resolve all in_review reports
  await supabaseAdmin
    .from("product_reports")
    .update({ status: "resolved", resolved_at: now, resolved_by: g.userId })
    .eq("product_id", productId)
    .eq("status", "in_review");

  // Write a product_notification for each unique reporter
  const uniqueUserIds = [...new Set(reports.map((r) => r.user_id))];
  await supabaseAdmin.from("product_notifications").insert(
    uniqueUserIds.map((uid) => ({
      user_id: uid,
      product_id: productId,
      type: "product_updated",
    }))
  );

  return NextResponse.json({ ok: true, notified: uniqueUserIds.length });
}
