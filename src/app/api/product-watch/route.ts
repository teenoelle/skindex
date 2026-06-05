import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ watching: false });

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ watching: false });

  const { data } = await supabaseAdmin
    .from("product_watch")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  return NextResponse.json({ watching: !!data });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, unreviewedNames } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await supabaseAdmin
    .from("product_watch")
    .upsert(
      { user_id: userId, product_id: productId, unreviewed_names: unreviewedNames ?? [] },
      { onConflict: "user_id,product_id" },
    );

  return NextResponse.json({ watching: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await supabaseAdmin
    .from("product_watch")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  return NextResponse.json({ watching: false });
}
