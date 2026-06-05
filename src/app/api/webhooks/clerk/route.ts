import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ClerkUserPayload = {
  id: string;
  email_addresses: { email_address: string }[];
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: number;
  last_sign_in_at: number | null;
};

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, headers) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const u = data as unknown as ClerkUserPayload;
    await supabaseAdmin.from("users").upsert({
      clerk_id: u.id,
      email: u.email_addresses?.[0]?.email_address ?? null,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
      image_url: u.image_url ?? null,
      created_at: u.created_at ? new Date(u.created_at).toISOString() : null,
      last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "clerk_id" });
  }

  if (type === "user.deleted") {
    const u = data as { id: string };
    await supabaseAdmin.from("users").delete().eq("clerk_id", u.id);
  }

  return NextResponse.json({ ok: true });
}
