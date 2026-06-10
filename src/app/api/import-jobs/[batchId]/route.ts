import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { batchId } = await params;

  const { data: jobs, error } = await supabaseAdmin
    .from("url_import_jobs")
    .select("url, status, name, brand, reason, http_status, fetch_error")
    .eq("batch_id", batchId)
    .eq("user_id", userId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ jobs });
}
