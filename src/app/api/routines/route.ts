import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import type { RoutineProduct } from "@/types";

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ routines: [] });

  const { data, error } = await supabase
    .from("routines")
    .select("id, name, products, display_order")
    .eq("clerk_user_id", userId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routines: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name: string = body.name ?? "New Routine";
  const products: RoutineProduct[] = body.products ?? [];
  const display_order: number = body.display_order ?? 0;

  const { data, error } = await supabase
    .from("routines")
    .insert({ clerk_user_id: userId, name, products, display_order })
    .select("id, name, products, display_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routine: data });
}
