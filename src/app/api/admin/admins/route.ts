import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";

async function guard(): Promise<{ userId: string } | { error: string; status: number }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return { userId };
}

// GET /api/admin/admins — unified: all admins + all invites, fully enriched
export async function GET() {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const [adminsRes, invitesRes, activityRes] = await Promise.all([
    supabaseAdmin.from("app_users").select("clerk_id, role, granted_by, granted_at, created_at").eq("role", "admin"),
    supabaseAdmin.from("admin_invites").select("id, code, expires_at, claimed_by, claimed_at, created_by, created_at").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("admin_audit_log").select("admin_clerk_id"),
  ]);

  const admins = adminsRes.data ?? [];
  const invites = invitesRes.data ?? [];

  // Collect all clerk_ids to batch-lookup
  const clerkIds = new Set<string>();
  admins.forEach((a) => { clerkIds.add(a.clerk_id); if (a.granted_by) clerkIds.add(a.granted_by); });
  invites.forEach((i) => { clerkIds.add(i.created_by); if (i.claimed_by) clerkIds.add(i.claimed_by); });

  const client = await clerkClient();
  const clerkUsers = clerkIds.size > 0
    ? (await client.users.getUserList({ userId: Array.from(clerkIds), limit: 200 })).data
    : [];

  function clerkEmail(id: string | null): string | null {
    if (!id) return null;
    return clerkUsers.find((u) => u.id === id)?.emailAddresses?.[0]?.emailAddress ?? null;
  }
  function clerkName(id: string | null): string | null {
    if (!id) return null;
    const u = clerkUsers.find((cu) => cu.id === id);
    return u ? ([u.firstName, u.lastName].filter(Boolean).join(" ") || null) : null;
  }

  // Count audit log actions per admin
  const activityCounts = new Map<string, number>();
  for (const row of activityRes.data ?? []) {
    activityCounts.set(row.admin_clerk_id, (activityCounts.get(row.admin_clerk_id) ?? 0) + 1);
  }

  const enrichedAdmins = admins.map((a) => ({
    clerk_id: a.clerk_id,
    email: clerkEmail(a.clerk_id),
    name: clerkName(a.clerk_id),
    granted_by: a.granted_by ?? null,
    granted_by_email: clerkEmail(a.granted_by),
    granted_at: a.granted_at ?? a.created_at ?? null,
    activity_count: activityCounts.get(a.clerk_id) ?? 0,
    is_self: a.clerk_id === g.userId,
  }));

  const enrichedInvites = invites.map((i) => ({
    id: i.id,
    code: i.code,
    expires_at: i.expires_at,
    is_expired: new Date(i.expires_at) < new Date(),
    claimed_by: i.claimed_by ?? null,
    claimed_by_email: clerkEmail(i.claimed_by),
    claimed_at: i.claimed_at ?? null,
    created_by: i.created_by,
    created_by_email: clerkEmail(i.created_by),
    created_at: i.created_at,
  }));

  return NextResponse.json({ admins: enrichedAdmins, invites: enrichedInvites, self_clerk_id: g.userId });
}

// POST /api/admin/admins — mutations: lookup, grant, revoke, create-invite, revoke-invite
export async function POST(req: NextRequest) {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json();
  const { action, email, clerk_id, expires_at, inviteId } = body;

  if (action === "lookup") {
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
    const client = await clerkClient();
    const users = await client.users.getUserList({ emailAddress: [email] });
    const cu = users.data[0];
    if (!cu) return NextResponse.json({ found: false });
    const { data: dbUser } = await supabaseAdmin.from("app_users").select("role").eq("clerk_id", cu.id).maybeSingle();
    return NextResponse.json({
      found: true,
      clerk_id: cu.id,
      email: cu.emailAddresses[0]?.emailAddress ?? email,
      name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
      role: dbUser?.role ?? null,
    });
  }

  if (action === "grant") {
    if (!clerk_id) return NextResponse.json({ error: "clerk_id required" }, { status: 400 });
    const now = new Date().toISOString();
    await supabaseAdmin.from("app_users").upsert(
      { clerk_id, role: "admin", granted_by: g.userId, granted_at: now },
      { onConflict: "clerk_id" }
    );
    await writeAuditLog(g.userId, "grant_admin", "user", clerk_id, {});
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    if (!clerk_id) return NextResponse.json({ error: "clerk_id required" }, { status: 400 });
    if (clerk_id === g.userId) return NextResponse.json({ error: "Cannot revoke your own admin access" }, { status: 400 });
    await supabaseAdmin.from("app_users").update({ role: "user" }).eq("clerk_id", clerk_id);
    await writeAuditLog(g.userId, "revoke_admin", "user", clerk_id, {});
    return NextResponse.json({ ok: true });
  }

  if (action === "create-invite") {
    if (!expires_at) return NextResponse.json({ error: "expires_at required" }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("admin_invites")
      .insert({ created_by: g.userId, expires_at })
      .select("id, code, expires_at, created_by, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invite: { ...data, is_expired: false, claimed_by: null, claimed_by_email: null, claimed_at: null, created_by_email: null } });
  }

  if (action === "revoke-invite") {
    if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });
    await supabaseAdmin.from("admin_invites").delete().eq("id", inviteId).is("claimed_by", null);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
