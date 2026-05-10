import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "cloudinary.images-iherb.com",
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
  "world.openfoodfacts.org",
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

  try {
    const upstream = await fetch(parsed.toString(), {
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
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
