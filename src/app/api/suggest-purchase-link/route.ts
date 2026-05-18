import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const RCODE = "DYT4743";

function normaliseIHerbUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    // Accept iherb.com product pages only
    if (!u.hostname.endsWith("iherb.com")) return null;
    if (!u.pathname.startsWith("/pr/")) return null;
    // Normalise regional subdomain → www
    u.hostname = "www.iherb.com";
    // Strip any existing rcode, then apply ours
    u.searchParams.delete("rcode");
    u.searchParams.set("rcode", RCODE);
    return u.toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to suggest a link" }, { status: 401 });

  const { productId, url } = await req.json();
  if (!productId || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const iherb_url = normaliseIHerbUrl(url);
  if (!iherb_url) {
    return NextResponse.json({ error: "Must be an iherb.com/pr/ product URL" }, { status: 422 });
  }

  const { error } = await supabaseAdmin
    .from("products")
    .update({ iherb_url })
    .eq("id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ iherb_url });
}
