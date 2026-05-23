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

// GET /api/admin/admins — list all admins with Clerk email
export async function GET() {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const { data: admins } = await supabaseAdmin
    .from("app_users").select("clerk_id, role").eq("role", "admin");

  if (!admins?.length) return NextResponse.json({ admins: [] });

  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({ userId: admins.map((a) => a.clerk_id), limit: 100 });

  const result = admins.map((a) => {
    const cu = clerkUsers.data.find((u) => u.id === a.clerk_id);
    return {
      clerk_id: a.clerk_id,
      email: cu?.emailAddresses?.[0]?.emailAddress ?? null,
      name: [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || null,
    };
  });

  return NextResponse.json({ admins: result });
}

// POST /api/admin/admins — lookup, grant, revoke, or invite
export async function POST(req: NextRequest) {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const { action, email, clerk_id, expires_at } = await req.json();

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
    await supabaseAdmin.from("app_users").upsert({ clerk_id, role: "admin" }, { onConflict: "clerk_id" });
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
      .select("id, code, expires_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invite: data });
  }

  if (action === "list-invites") {
    const { data } = await supabaseAdmin
      .from("admin_invites")
      .select("id, code, expires_at, claimed_by, claimed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return NextResponse.json({ invites: data ?? [] });
  }

  if (action === "revoke-invite") {
    const { inviteId } = await req.json().catch(() => ({}));
    if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });
    await supabaseAdmin.from("admin_invites").delete().eq("id", inviteId).is("claimed_by", null);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
