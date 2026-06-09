import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateNotes } from "@/lib/curated-explanation";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { structural_category, category, flagged_category, empty_only, preview } = await req.json();

  // At least one filter required to avoid accidentally refreshing every ingredient
  if (!structural_category && !category && !flagged_category && !empty_only) {
    return NextResponse.json({ error: "At least one filter is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any): any {
    if (structural_category) q = q.eq("structural_category", structural_category);
    if (category) q = q.eq("category", category);
    if (flagged_category) q = q.eq("flagged_category", flagged_category);
    if (empty_only) q = q.is("skin_climate_notes", null);
    return q;
  }

  if (preview) {
    const { count, error } = await applyFilters(
      supabaseAdmin.from("ingredients").select("id", { count: "exact", head: true })
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: count ?? 0 });
  }

  const { data: ingredients, error } = await applyFilters(
    supabaseAdmin.from("ingredients").select("id, name, status, structural_category, category, flagged_category")
  ).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ingredients?.length) return NextResponse.json({ updated: 0 });

  let updated = 0;
  for (const ing of ingredients) {
    const notes = generateNotes({
      name: ing.name,
      status: ing.status,
      structural_category: ing.structural_category,
      category: ing.category,
      flagged_category: ing.flagged_category,
    });
    await supabaseAdmin
      .from("ingredients")
      .update({ skin_climate_notes: notes.length > 0 ? notes : null })
      .eq("id", ing.id);
    updated++;
  }

  return NextResponse.json({ updated });
}
