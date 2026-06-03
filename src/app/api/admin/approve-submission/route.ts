import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { queueIngredients } from "@/lib/queue-ingredients";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("products").select("name, ingredient_list").eq("id", productId).maybeSingle();

  const { error } = await supabaseAdmin
    .from("products")
    .update({ is_pending: false, reviewed_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(userId, "approve_submission", "submission", productId, {
    name: existing?.name ?? productId,
  });

  // Fire-and-forget: match, link, and queue ingredients now that the product is live
  if (existing?.ingredient_list) {
    Promise.resolve()
      .then(() => queueIngredients(productId, existing.name, existing.ingredient_list!))
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
