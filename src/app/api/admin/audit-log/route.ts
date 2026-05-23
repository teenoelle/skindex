import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabase
    .from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "7d";

  let query = supabaseAdmin
    .from("admin_audit_log")
    .select("id, action, entity_type, entity_id, detail, created_at, admin_clerk_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (range === "7d") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since);
  } else if (range === "30d") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = data ?? [];
  const uniqueAdminIds = [...new Set(entries.map((e) => e.admin_clerk_id).filter(Boolean))];

  let adminMap: Record<string, { email: string | null; name: string | null }> = {};
  if (uniqueAdminIds.length > 0) {
    try {
      const client = await clerkClient();
      const clerkUsers = await client.users.getUserList({ userId: uniqueAdminIds, limit: 100 });
      for (const u of clerkUsers.data) {
        adminMap[u.id] = {
          email: u.emailAddresses?.[0]?.emailAddress ?? null,
          name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
        };
      }
    } catch { /* non-fatal */ }
  }

  const enriched = entries.map((e) => ({
    ...e,
    admin_email: adminMap[e.admin_clerk_id]?.email ?? null,
    admin_name: adminMap[e.admin_clerk_id]?.name ?? null,
  }));

  return NextResponse.json({ entries: enriched });
}
