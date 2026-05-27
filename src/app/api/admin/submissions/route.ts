import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users")
    .select("role")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, brand, type, submitted_at, ingredient_list")
    .not("submitted_at", "is", null)
    .is("reviewed_at", null)
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const submissions = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    type: p.type ?? null,
    submitted_at: p.submitted_at,
    ingredient_list: p.ingredient_list ?? null,
    ingredient_count: p.ingredient_list
      ? p.ingredient_list.split(",").filter((s: string) => s.trim().length > 0).length
      : 0,
  }));

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentCount = submissions.filter(
    (s) => s.submitted_at && s.submitted_at >= sevenDaysAgo
  ).length;

  return NextResponse.json({ submissions, recentCount });
}
