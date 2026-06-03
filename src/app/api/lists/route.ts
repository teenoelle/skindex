import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productId = req.nextUrl.searchParams.get("productId") ?? null;

  const { data: lists } = await supabaseAdmin
    .from("user_lists")
    .select("id, name, is_public, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const listIds = (lists ?? []).map((l) => l.id);
  const { data: countRows } = listIds.length
    ? await supabaseAdmin.from("user_list_items").select("list_id").in("list_id", listIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of countRows ?? []) {
    countMap[row.list_id] = (countMap[row.list_id] ?? 0) + 1;
  }

  const productListSet = new Set<string>();
  if (productId && listIds.length) {
    const { data: productRows } = await supabaseAdmin
      .from("user_list_items")
      .select("list_id")
      .in("list_id", listIds)
      .eq("product_id", productId);
    for (const row of productRows ?? []) productListSet.add(row.list_id);
  }

  return NextResponse.json({
    lists: (lists ?? []).map((l) => ({
      ...l,
      itemCount: countMap[l.id] ?? 0,
      ...(productId !== null ? { containsProduct: productListSet.has(l.id) } : {}),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("user_lists")
    .insert({ user_id: userId, name: name.trim() })
    .select("id, name, is_public, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: { ...data, itemCount: 0 } });
}
