import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function obfFullImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\.\d+\.jpg$/, ".full.jpg");
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to search for images" }, { status: 401 });
  }

  const { productId } = await req.json();
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("name, brand")
    .eq("id", productId)
    .maybeSingle();

  if (!product?.name) {
    return NextResponse.json({ imageUrl: null });
  }

  const searchQuery = [product.name, product.brand].filter(Boolean).join(" ");

  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=5`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return NextResponse.json({ imageUrl: null });

    const data = await res.json();
    const found = (data?.products ?? []).find(
      (p: { image_front_url?: string; image_url?: string; product_name?: string }) =>
        p.image_front_url || p.image_url
    );

    const imageUrl = obfFullImage(found?.image_front_url ?? found?.image_url ?? null);
    if (!imageUrl) return NextResponse.json({ imageUrl: null });

    await supabaseAdmin
      .from("products")
      .update({ image_url: imageUrl, image_updated_by: userId, image_updated_at: new Date().toISOString() })
      .eq("id", productId);

    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
