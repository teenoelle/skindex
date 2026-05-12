import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function ownedList(id: string, userId: string) {
  const { data } = await supabase
    .from("user_lists")
    .select("id, user_id, name, is_public")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await params;

  const { data: list } = await supabase
    .from("user_lists")
    .select("id, user_id, name, is_public, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!list.is_public && list.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("user_list_items")
    .select("id, product_id, note, position, added_at, products(id, name, brand, image_url, type)")
    .eq("list_id", id)
    .order("position", { ascending: true })
    .order("added_at", { ascending: true });

  return NextResponse.json({ list, items: items ?? [], isOwner: list.user_id === userId });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await ownedList(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.is_public !== undefined) updates.is_public = body.is_public;

  const { data, error } = await supabaseAdmin
    .from("user_lists")
    .update(updates)
    .eq("id", id)
    .select("id, name, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await ownedList(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("user_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
