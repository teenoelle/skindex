import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  return data?.role === "admin";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { typeIds, targetName, targetBodyArea } = await req.json();

  if (!Array.isArray(typeIds) || typeIds.length < 2) {
    return NextResponse.json({ error: "At least 2 types required" }, { status: 400 });
  }
  if (!targetName?.trim() || !targetBodyArea?.trim()) {
    return NextResponse.json({ error: "targetName and targetBodyArea are required" }, { status: 400 });
  }

  const cleanName = targetName.trim();
  const cleanArea = targetBodyArea.trim();

  // Fetch all source types
  const { data: types } = await supabaseAdmin
    .from("product_types")
    .select("id, name")
    .in("id", typeIds);

  if (!types || types.length < 2) {
    return NextResponse.json({ error: "Could not find all specified types" }, { status: 404 });
  }

  // Check targetName isn't already taken by a type outside the merge set
  const { data: conflict } = await supabaseAdmin
    .from("product_types")
    .select("id")
    .eq("name", cleanName)
    .maybeSingle();

  if (conflict && !typeIds.includes(conflict.id)) {
    return NextResponse.json(
      { error: `"${cleanName}" already exists as a separate type — choose a different name or include it in the merge` },
      { status: 409 }
    );
  }

  // Bulk-update all products that have any of the source type names
  const sourceNames = types.map((t) => t.name);
  await supabaseAdmin.from("products").update({ type: cleanName }).in("type", sourceNames);

  // Keep the first type record, update it to the target; delete the rest
  const keepId = types[0].id;
  const deleteIds = types.slice(1).map((t) => t.id);

  const { data: updated, error } = await supabaseAdmin
    .from("product_types")
    .update({ name: cleanName, body_area: cleanArea })
    .eq("id", keepId)
    .select("id, name, body_area")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("product_types").delete().in("id", deleteIds);

  return NextResponse.json({ type: updated });
}
