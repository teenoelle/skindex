import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Images from these hosts are served by reliable CDNs — store the URL as-is, no upload needed
const RELIABLE_CDN_HOSTS = new Set([
  "cloudinary.images-iherb.com",
  "images.openbeautyfacts.org",
  "images.openfoodfacts.org",
  "static.openbeautyfacts.org",
  "world.openbeautyfacts.org",
  "fqpqlllixjnzsdpqrovv.supabase.co",
]);

const DIRECT_IMAGE_HOSTS = ["cloudinary", "images-iherb", "openfoodfacts", "openbeautyfacts", "cdn", "supabase"];
const DIRECT_IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i;

// Supabase image transform endpoint — resizes and converts to WebP on the fly
const STORAGE_TRANSFORM_BASE =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/product-images`;

function isReliableCdn(url: string): boolean {
  try {
    return RELIABLE_CDN_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to update product images" }, { status: 401 });
  }

  const { productId, url, remove } = await req.json();
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  if (remove) {
    const { error } = await supabaseAdmin
      .from("products")
      .update({ image_url: null, image_updated_by: userId, image_updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Try to find a replacement image from Open Beauty Facts
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("name, brand")
      .eq("id", productId)
      .maybeSingle();

    if (product?.name) {
      try {
        const query = [product.name, product.brand].filter(Boolean).join(" ");
        const obfRes = await fetch(
          `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=3`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (obfRes.ok) {
          const obfData = await obfRes.json();
          const found = obfData?.products?.[0];
          const raw = found?.image_front_url ?? found?.image_url ?? null;
          const refetchedUrl = raw ? raw.replace(/\.\d+\.jpg$/, ".full.jpg") : null;
          if (refetchedUrl) {
            await supabaseAdmin
              .from("products")
              .update({ image_url: refetchedUrl, image_updated_by: userId, image_updated_at: new Date().toISOString() })
              .eq("id", productId);
            return NextResponse.json({ imageUrl: refetchedUrl });
          }
        }
      } catch {
        // OBF search failed — return null, not an error
      }
    }

    return NextResponse.json({ imageUrl: null });
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Resolve to a direct image URL (extract og:image if given a product page)
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

  const now = new Date().toISOString();

  // Reliable CDN: store the URL directly, no upload needed
  if (isReliableCdn(imageUrl)) {
    const { error } = await supabaseAdmin
      .from("products")
      .update({ image_url: imageUrl, image_updated_by: userId, image_updated_at: now })
      .eq("id", productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ imageUrl });
  }

  // Unknown source: fetch and upload to Supabase Storage
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

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const filename = `${productId}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("product-images")
    .upload(filename, imageBytes, { contentType, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Use Supabase's transform endpoint: resizes to 600px and converts to WebP on the fly
  const transformUrl = `${STORAGE_TRANSFORM_BASE}/${filename}?width=600&quality=80&format=webp`;

  const { error: updateError } = await supabaseAdmin
    .from("products")
    .update({ image_url: transformUrl, image_updated_by: userId, image_updated_at: now })
    .eq("id", productId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: transformUrl });
}
