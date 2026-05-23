import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { entryId } = await req.json();
  if (!entryId) return NextResponse.json({ error: "Missing entryId" }, { status: 400 });

  const { data: entry } = await supabaseAdmin
    .from("admin_audit_log")
    .select("id, action, entity_id, detail, created_at")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (entry.action !== "update_product") return NextResponse.json({ error: "Only product updates can be reverted" }, { status: 400 });

  // Verify entry has new-format before-state
  const changes = (entry.detail as { changes?: Record<string, { before: string | null; after: string | null }> })?.changes ?? {};
  const hasBeforeState = Object.values(changes).some((v) => typeof v === "object" && v !== null && "before" in v);
  if (!hasBeforeState) return NextResponse.json({ error: "No revert data — this entry predates before-state tracking" }, { status: 422 });

  // Build revert patch from before values
  const revert: Record<string, string | null> = {};
  for (const [field, v] of Object.entries(changes)) {
    if (typeof v === "object" && v !== null && "before" in v) {
      revert[field] = v.before;
    }
  }

  if (Object.keys(revert).length === 0) return NextResponse.json({ error: "Nothing to revert" }, { status: 400 });

  const { error } = await supabaseAdmin.from("products").update(revert).eq("id", entry.entity_id!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(userId, "revert_product", "product", entry.entity_id, {
    name: (entry.detail as { name?: string }).name ?? entry.entity_id,
    reverted_entry: entryId,
  });

  return NextResponse.json({ ok: true });
}
