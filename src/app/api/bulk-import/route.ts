import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractIngredientsFromUrlWithStatus } from "@/lib/extract-ingredients";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MAX_URLS = 50;

export type ImportResult = {
  url: string;
  status: "imported" | "skipped" | "failed";
  name?: string;
  brand?: string;
  reason?: string;
  httpStatus?: number;
  fetchError?: string;
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const urls: string[] = Array.isArray(body.urls)
    ? body.urls.map((u: unknown) => String(u).trim()).filter(Boolean).slice(0, MAX_URLS)
    : [];

  if (urls.length === 0) return NextResponse.json({ error: "No URLs provided" }, { status: 400 });

  const results: ImportResult[] = [];

  for (let idx = 0; idx < urls.length; idx++) {
    const url = urls[idx];
    if (idx > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const isIHerb = url.toLowerCase().includes("iherb.com");
      const { product: extracted, httpStatus, fetchError } = await extractIngredientsFromUrlWithStatus(url);
      if (!extracted) {
        let reason = "extraction-failed";
        if (isIHerb) reason = "iherb-blocked";
        else if (httpStatus === 429) reason = "rate-limited";
        else if (httpStatus === 403) reason = "blocked";
        else if (httpStatus && httpStatus >= 400) reason = `http-${httpStatus}`;
        else if (httpStatus === 200) reason = "parse-failed";
        results.push({ url, status: "failed", reason, httpStatus: httpStatus ?? undefined, fetchError });
        continue;
      }

      const name = (extracted.name ?? "").trim() || url;
      const brand = extracted.brand ?? null;

      // Check for existing product with same name + ingredient list
      const { data: existing } = await supabaseAdmin
        .from("products")
        .select("id, name")
        .ilike("name", name)
        .not("ingredient_list", "is", null)
        .maybeSingle();

      if (existing) {
        results.push({ url, status: "skipped", name: existing.name, brand: brand ?? undefined });
        continue;
      }

      const { error: insertError } = await supabaseAdmin.from("products").insert({
        name,
        brand,
        ingredient_list: extracted.ingredients,
        type: extracted.type ?? null,
        source: "url-import",
        source_url: url,
        ...(extracted.iherb_url ? { iherb_url: extracted.iherb_url } : {}),
        ...(extracted.image_url ? { image_url: extracted.image_url } : {}),
      });

      if (insertError) throw insertError;

      results.push({ url, status: "imported", name, brand: brand ?? undefined });
    } catch {
      results.push({ url, status: "failed", reason: "error" });
    }
  }

  return NextResponse.json({ results });
}
