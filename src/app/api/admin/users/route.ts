import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function guard(): Promise<{ userId: string } | { error: string; status: number }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return { userId };
}

// GET /api/admin/users — all users (Option A: loop Clerk pages) merged with Supabase role + activity data
export async function GET() {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const client = await clerkClient();

  // Loop all Clerk pages — 500 per call until exhausted (Option A)
  const allClerkUsers: Awaited<ReturnType<typeof client.users.getUserList>>["data"] = [];
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const page = await client.users.getUserList({ limit: pageSize, offset, orderBy: "-created_at" });
    allClerkUsers.push(...page.data);
    if (page.data.length < pageSize) break;
    offset += pageSize;
  }

  // Roles + admin history from app_users
  const { data: appUsers } = await supabaseAdmin
    .from("app_users")
    .select("clerk_id, role, granted_by, granted_at");

  // Enrich granted_by with email
  const grantedByIds = [...new Set(
    (appUsers ?? []).map((u) => u.granted_by).filter(Boolean) as string[]
  )];
  const grantedByClerkUsers = grantedByIds.length > 0
    ? (await client.users.getUserList({ userId: grantedByIds, limit: 200 })).data
    : [];
  function grantedByEmail(id: string | null): string | null {
    if (!id) return null;
    return grantedByClerkUsers.find((u) => u.id === id)?.emailAddresses?.[0]?.emailAddress ?? null;
  }

  const roleMap = new Map<string, { role: string; granted_at: string | null; granted_by: string | null }>();
  for (const u of appUsers ?? []) {
    roleMap.set(u.clerk_id, { role: u.role, granted_at: u.granted_at ?? null, granted_by: u.granted_by ?? null });
  }

  // Activity counts — fetch column only, aggregate in JS
  const [submissionsRes, flagsRes, watchesRes, auditRes] = await Promise.all([
    supabaseAdmin.from("products").select("submitted_by").not("submitted_by", "is", null),
    supabaseAdmin.from("ingredient_flags").select("flagged_by_user_id").not("flagged_by_user_id", "is", null),
    supabaseAdmin.from("product_watch").select("user_id"),
    supabaseAdmin.from("admin_audit_log").select("admin_clerk_id"),
  ]);

  function countMap(rows: { [key: string]: string | null }[], key: string): Map<string, number> {
    const m = new Map<string, number>();
    for (const row of rows) {
      const v = row[key];
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  }

  const submissionCount = countMap(submissionsRes.data ?? [], "submitted_by");
  const flagCount = countMap(flagsRes.data ?? [], "flagged_by_user_id");
  const watchCount = countMap(watchesRes.data ?? [], "user_id");
  const adminActionCount = countMap(auditRes.data ?? [], "admin_clerk_id");

  const users = allClerkUsers.map((cu) => {
    const roleData = roleMap.get(cu.id);
    return {
      clerk_id: cu.id,
      email: cu.emailAddresses?.[0]?.emailAddress ?? null,
      name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
      image_url: cu.imageUrl ?? null,
      role: (roleData?.role ?? null) as "admin" | "user" | null,
      granted_at: roleData?.granted_at ?? null,
      granted_by_email: grantedByEmail(roleData?.granted_by ?? null),
      is_self: cu.id === g.userId,
      joined_at: cu.createdAt ? new Date(cu.createdAt).toISOString() : null,
      last_active: cu.lastSignInAt ? new Date(cu.lastSignInAt).toISOString() : null,
      submission_count: submissionCount.get(cu.id) ?? 0,
      flag_count: flagCount.get(cu.id) ?? 0,
      watch_count: watchCount.get(cu.id) ?? 0,
      admin_action_count: adminActionCount.get(cu.id) ?? 0,
    };
  });

  return NextResponse.json({ users, self_clerk_id: g.userId });
}
