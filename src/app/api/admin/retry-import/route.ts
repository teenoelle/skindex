import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extractIngredientsFromUrl } from "@/lib/extract-ingredients";
import { queueIngredients } from "@/lib/queue-ingredients";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, name, source_url, source")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!product.source_url) return NextResponse.json({ error: "No URL to retry" }, { status: 400 });

  const extracted = await extractIngredientsFromUrl(product.source_url);
  if (!extracted) {
    return NextResponse.json({ ok: false, reason: product.source_url.toLowerCase().includes("iherb.com") ? "iherb_blocked" : "extraction_failed" });
  }

  await supabaseAdmin.from("products").update({
    name: extracted.name ?? product.name,
    brand: extracted.brand ?? null,
    ingredient_list: extracted.ingredients,
    type: extracted.type ?? null,
    source: "url-import",
    ...(extracted.iherb_url ? { iherb_url: extracted.iherb_url } : {}),
    ...(extracted.image_url ? { image_url: extracted.image_url } : {}),
  }).eq("id", productId);

  // Queue any unrecognised ingredients for /generate-explanations
  Promise.resolve()
    .then(() => queueIngredients(productId, extracted.name ?? product.name, extracted.ingredients))
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
