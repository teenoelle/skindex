import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function ownedList(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_ingredient_lists")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  return data?.user_id === userId ? data : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!await ownedList(id, userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.items !== undefined) updates.items = body.items;

  const { data, error } = await supabaseAdmin
    .from("user_ingredient_lists")
    .update(updates)
    .eq("id", id)
    .select("id, name, items")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!await ownedList(id, userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabaseAdmin.from("user_ingredient_lists").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
