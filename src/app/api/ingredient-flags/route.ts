import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to flag explanations" }, { status: 401 });

  const { ingredientId, reasons, note, productId, userProfileSnapshot } = await req.json().catch(() => ({}));
  if (!ingredientId) return NextResponse.json({ error: "Missing ingredientId" }, { status: 400 });

  const { data: ing } = await supabaseAdmin
    .from("ingredients")
    .select("id")
    .eq("id", ingredientId)
    .maybeSingle();
  if (!ing) return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });

  await supabaseAdmin.from("ingredient_flags").insert({
    ingredient_id: ingredientId,
    flagged_by_user_id: userId,
    reasons: Array.isArray(reasons) && reasons.length > 0 ? reasons : null,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    product_id: productId ?? null,
    user_profile_snapshot: userProfileSnapshot ?? null,
  });

  return NextResponse.json({ ok: true });
}
