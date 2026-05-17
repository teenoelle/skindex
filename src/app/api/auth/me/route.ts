import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ isAdmin: false });

  const { data } = await supabase
    .from("app_users")
    .select("role")
    .eq("clerk_id", userId)
    .maybeSingle();

  return NextResponse.json({ isAdmin: data?.role === "admin" });
}
