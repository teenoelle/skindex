import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();

  await Promise.all([
    supabaseAdmin
      .from("app_users")
      .upsert({ clerk_id: userId, notifications_last_seen_at: now }, { onConflict: "clerk_id" }),
    supabaseAdmin
      .from("product_notifications")
      .update({ seen_at: now })
      .eq("user_id", userId)
      .is("seen_at", null),
  ]);

  return NextResponse.json({ ok: true });
}
