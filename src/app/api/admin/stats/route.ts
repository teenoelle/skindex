import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [
    { count: totalProducts },
    { count: archivedCount },
    { count: classifiedIngredients },
    { count: queueLength },
    { count: pendingSubmissions },
  ] = await Promise.all([
    supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("is_archived", false),
    supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("is_archived", true),
    supabaseAdmin.from("ingredients").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("ingredient_queue").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("products").select("*", { count: "exact", head: true })
      .not("submitted_at", "is", null).is("reviewed_at", null),
  ]);

  return NextResponse.json({
    totalProducts: totalProducts ?? 0,
    archivedCount: archivedCount ?? 0,
    classifiedIngredients: classifiedIngredients ?? 0,
    queueLength: queueLength ?? 0,
    pendingSubmissions: pendingSubmissions ?? 0,
  });
}
