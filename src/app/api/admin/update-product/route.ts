import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users")
    .select("role")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { productId, name, brand, type, ingredient_list, iherb_url, image_url } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const patch: Record<string, string | null> = {};
  if (name !== undefined) patch.name = name?.trim() || null;
  if (brand !== undefined) patch.brand = brand?.trim() || null;
  if (type !== undefined) patch.type = type?.trim() || null;
  if (ingredient_list !== undefined) patch.ingredient_list = ingredient_list?.trim() || null;
  if (iherb_url !== undefined) patch.iherb_url = iherb_url?.trim() || null;
  if (image_url !== undefined) patch.image_url = image_url?.trim() || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
