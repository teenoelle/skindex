import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DIRECT_IMAGE_HOSTS = ["cloudinary", "images-iherb", "openfoodfacts", "openbeautyfacts", "cdn", "supabase"];
const DIRECT_IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i;

function isDirectImage(url: string): boolean {
  try {
    const p = new URL(url);
    if (DIRECT_IMAGE_EXT.test(p.pathname)) return true;
    if (DIRECT_IMAGE_HOSTS.some((h) => p.hostname.includes(h))) return true;
    return false;
  } catch {
    return false;
  }
}

async function extractOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { productId, url } = await req.json();
  if (!productId || !url) {
    return NextResponse.json({ error: "Missing productId or url" }, { status: 400 });
  }

  // Resolve to a direct image URL
  let imageUrl: string = url;
  if (!isDirectImage(url)) {
    const extracted = await extractOgImage(url);
    if (!extracted) {
      return NextResponse.json(
        { error: "Could not extract an image from that page. Try pasting a direct image URL (ending in .jpg, .png, .webp, etc.)" },
        { status: 400 }
      );
    }
    imageUrl = extracted;
  }

  // Fetch image bytes
  let imageBytes: ArrayBuffer;
  let contentType = "image/jpeg";
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    imageBytes = await res.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Could not fetch the image" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const filename = `${productId}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("product-images")
    .upload(filename, imageBytes, { contentType, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from("product-images").getPublicUrl(filename);

  const { error: updateError } = await supabaseAdmin
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", productId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrl });
}
