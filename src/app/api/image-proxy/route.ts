import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "cloudinary.images-iherb.com",
  "incidecoder-content.storage.googleapis.com",
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
  "world.openfoodfacts.org",
  "images.openbeautyfacts.org",
  "static.openbeautyfacts.org",
  "fqpqlllixjnzsdpqrovv.supabase.co",
]);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Disallowed host", { status: 403 });
  }

  // Upgrade iHerb Cloudinary: use large (/l/) variant, best quality, cap to 600px
  let fetchUrl = parsed.toString();
  if (parsed.hostname === "cloudinary.images-iherb.com") {
    fetchUrl = fetchUrl
      .replace("q_auto:eco", "q_auto:best")
      .replace("/image/upload/", "/image/upload/w_900,")
      .replace(/\/s\/(\d+\.\w+)$/, "/l/$1");
  }

  // For INCIDecoder GCS URLs that were converted to _original.jpeg, build fallback candidates
  // in case the original doesn't exist for that product.
  const gcsOriginalFallbacks: string[] =
    parsed.hostname === "incidecoder-content.storage.googleapis.com" &&
    fetchUrl.endsWith("_original.jpeg")
      ? [
          fetchUrl.replace(/_original\.jpeg$/, "_600x600@2x.webp"),
          fetchUrl.replace(/_original\.jpeg$/, "_300x300@1x.webp"),
        ]
      : [];

  const urlsToTry = [fetchUrl, ...gcsOriginalFallbacks];

  try {
    let upstream: Response | null = null;
    for (const candidate of urlsToTry) {
      const res = await fetch(candidate, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) { upstream = res; break; }
    }

    if (!upstream) {
      return new NextResponse("Upstream error", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
