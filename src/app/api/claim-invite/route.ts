import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from("admin_invites")
    .select("id, expires_at, claimed_by, created_by")
    .eq("code", code.trim())
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  if (invite.claimed_by) return NextResponse.json({ error: "Invite already claimed" }, { status: 409 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite has expired" }, { status: 410 });

  const now = new Date().toISOString();

  await supabaseAdmin.from("admin_invites")
    .update({ claimed_by: userId, claimed_at: now })
    .eq("id", invite.id);

  await supabaseAdmin.from("app_users")
    .upsert({ clerk_id: userId, role: "admin", granted_by: invite.created_by, granted_at: now }, { onConflict: "clerk_id" });

  await writeAuditLog(userId, "claim_invite", "user", userId, { invite_id: invite.id });

  return NextResponse.json({ ok: true });
}
