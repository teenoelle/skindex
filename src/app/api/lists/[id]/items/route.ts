import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function ownedList(id: string, userId: string) {
  const { data } = await supabase
    .from("user_lists")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const list = await ownedList(id, userId);
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { productId, note } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: maxRow } = await supabase
    .from("user_list_items")
    .select("position")
    .eq("list_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("user_list_items")
    .upsert(
      { list_id: id, product_id: productId, note: note ?? null, position },
      { onConflict: "list_id,product_id" }
    )
    .select("id, product_id, note, position, added_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const list = await ownedList(id, userId);
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("user_list_items")
    .delete()
    .eq("list_id", id)
    .eq("product_id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const list = await ownedList(id, userId);
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { productId, note } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("user_list_items")
    .update({ note: note ?? null })
    .eq("list_id", id)
    .eq("product_id", productId)
    .select("id, note")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
