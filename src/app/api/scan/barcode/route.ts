import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ notFound: true });

    const data = await res.json() as {
      status: number;
      product?: {
        product_name?: string;
        brands?: string;
        ingredients_text?: string;
        image_front_url?: string;
        image_url?: string;
      };
    };

    if (data.status !== 1 || !data.product) return NextResponse.json({ notFound: true });

    const p = data.product;
    return NextResponse.json({
      name: p.product_name ?? null,
      brand: p.brands ?? null,
      ingredients: p.ingredients_text ?? null,
      image_url: p.image_front_url ?? p.image_url ?? null,
    });
  } catch {
    return NextResponse.json({ notFound: true });
  }
}
