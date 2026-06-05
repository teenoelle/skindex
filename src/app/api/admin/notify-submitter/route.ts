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

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("products")
    .update({ ingredients_ready: true })
    .eq("id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
