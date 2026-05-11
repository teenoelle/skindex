import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "cloudinary.images-iherb.com",
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
  "world.openfoodfacts.org",
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
      .replace("/image/upload/", "/image/upload/w_600,")
      .replace(/\/s\/(\d+\.\w+)$/, "/l/$1");
  }

  try {
    const upstream = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
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
