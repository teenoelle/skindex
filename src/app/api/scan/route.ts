import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { matchIngredients } from "@/lib/scanner";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import type { CommunityVariant, ObfVariant, PhotosensitiveItem } from "@/types";

const PHOTO_PATTERNS: { pattern: RegExp; level: PhotosensitiveItem["sunLevel"]; note: string }[] = [
  {
    pattern: /retinol|retinyl palmitate|retinyl acetate|retinaldehyde|tretinoin/i,
    level: "avoid",
    note: "Increases skin cell turnover, leaving new skin more vulnerable to UV damage. Use SPF daily and avoid prolonged sun exposure.",
  },
  {
    pattern: /glycolic acid|lactic acid|mandelic acid|tartaric acid|gluconolactone|polyglutamic acid|\barbutin\b|alpha.arbutin/i,
    level: "avoid",
    note: "Chemical exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF when using.",
  },
  {
    pattern: /limonene|citral|bergapten|bergamot|citrus aurantium|citrus limon|citrus sinensis|citrus grandis|citrus paradisi|grapefruit/i,
    level: "avoid",
    note: "Contains phototoxic compounds that can cause burns or lasting hyperpigmentation on sun-exposed skin.",
  },
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function getOrCreateUser(clerkId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("app_users")
    .select("*")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (existing) {
    if (existing.last_reset_date !== today) {
      const { data } = await supabase
        .from("app_users")
        .update({ ai_extractions_today: 0, last_reset_date: today })
        .eq("clerk_id", clerkId)
        .select()
        .single();
      return data;
    }
    return existing;
  }

  const { data } = await supabase
    .from("app_users")
    .insert({ clerk_id: clerkId, ai_extractions_today: 0, last_reset_date: today })
    .select()
    .single();
  return data;
}

async function extractFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const text = stripHtml(html);

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract the skincare product ingredients list from the following web page text. Return ONLY the ingredients as a comma-separated list (like "Water, Glycerin, Niacinamide"). Do not include any other text, labels, or commentary. If no ingredients list is found, return exactly: NONE\n\n${text}`,
        },
      ],
    });

    const result =
      message.content[0].type === "text" ? message.content[0].text.trim() : null;
    if (!result || result.toUpperCase() === "NONE") return null;
    return result;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { type, query, ingredients, url, productId } = await req.json();

  let rawIngredients = "";
  let communityVariants: CommunityVariant[] | undefined;
  let obfVariants: ObfVariant[] | undefined;
  let product: {
    name: string;
    brand?: string | null;
    source: string;
    type?: string | null;
    image_url?: string | null;
    activity_tags?: string[] | null;
    activity_note?: string | null;
  } | undefined;

  if (type === "paste") {
    rawIngredients = ingredients as string;
  } else if (type === "search") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbProduct: any = null;

    // Strategy 0: direct product ID lookup (variant picker selection)
    if (productId) {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      dbProduct = data;
    }

    // Strategy 1: exact substring match on name
    if (!dbProduct) {
      const { data } = await supabase
        .from("products")
        .select("*")
        .ilike("name", `%${query}%`)
        .not("ingredient_list", "is", null)
        .limit(5);
      if (data?.length) {
        // Check for close scores — if top match is exact, take it; otherwise collect ambiguous ones
        dbProduct = data[0];
        if (data.length > 1) {
          // All are substring matches, offer alternatives
          communityVariants = data.slice(1, 4).map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand ?? null,
          }));
        }
      }
    }

    // Strategy 2: token match — score candidates by how many query words appear in name/brand
    if (!dbProduct) {
      const tokens = query.trim().split(/\s+/).filter((w: string) => w.length >= 3);
      if (tokens.length > 1) {
        const orFilter = tokens.map((t: string) => `name.ilike.%${t}%`).join(",");
        const { data: candidates } = await supabase
          .from("products")
          .select("*")
          .or(orFilter)
          .not("ingredient_list", "is", null)
          .limit(20);
        if (candidates?.length) {
          const scored = candidates
            .map((p) => ({
              p,
              score:
                tokens.filter(
                  (t: string) =>
                    p.name.toLowerCase().includes(t.toLowerCase()) ||
                    (p.brand ?? "").toLowerCase().includes(t.toLowerCase())
                ).length / tokens.length,
            }))
            .sort((a, b) => b.score - a.score);
          if (scored[0].score >= 0.5) {
            dbProduct = scored[0].p;
            // Collect alternatives within 0.15 of top score
            const alts = scored.slice(1).filter((s) => s.score >= 0.5 && scored[0].score - s.score <= 0.15);
            if (alts.length) {
              communityVariants = alts.slice(0, 3).map((s) => ({
                id: s.p.id,
                name: s.p.name,
                brand: s.p.brand ?? null,
              }));
            }
          }
        }
      }
    }

    // Strategy 3: fuzzy trigram similarity (handles typos and reordered words)
    if (!dbProduct) {
      const { data: fuzzyResults } = await supabase.rpc("search_products_fuzzy", { q: query });
      if (fuzzyResults?.[0]?.ingredient_list) dbProduct = fuzzyResults[0];
    }

    // OBF: run in parallel with community search, always fetch when query is provided
    const obfFetch = query
      ? fetch(
          `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`
        ).then((r) => r.json()).catch(() => null)
      : Promise.resolve(null);

    if (dbProduct?.ingredient_list) {
      rawIngredients = dbProduct.ingredient_list;
      product = {
        name: dbProduct.name,
        brand: dbProduct.brand,
        source: "community",
        type: dbProduct.type ?? null,
        image_url: dbProduct.image_url ?? null,
        activity_tags: dbProduct.activity_tags ?? null,
        activity_note: dbProduct.activity_note ?? null,
      };

      // Collect OBF variants (shown as alternatives at bottom of results)
      const obfData = await obfFetch;
      const obfProducts = (obfData?.products ?? []).filter(
        (p: { ingredients_text?: string; product_name?: string }) => p.ingredients_text && p.product_name
      );
      if (obfProducts.length) {
        obfVariants = obfProducts.slice(0, 4).map((p: {
          product_name: string;
          brands?: string;
          image_front_url?: string;
          image_url?: string;
          ingredients_text: string;
        }) => ({
          name: p.product_name,
          brand: p.brands ?? null,
          image_url: p.image_front_url ?? p.image_url ?? null,
          ingredients_text: p.ingredients_text,
        }));
      }
    } else {
      const obfData = await obfFetch;
      const p = obfData?.products?.[0];

      if (p?.ingredients_text) {
        rawIngredients = p.ingredients_text;
        product = {
          name: p.product_name || query,
          brand: p.brands || null,
          source: "openbeautyfacts",
          type: null,
          image_url: p.image_front_url || p.image_url || null,
        };

        await supabase.from("products").insert({
          name: p.product_name || query,
          brand: p.brands || null,
          ingredient_list: p.ingredients_text,
          image_url: p.image_front_url || p.image_url || null,
          source: "auto-imported",
        });

        // Offer remaining OBF results as variants
        const obfProducts = (obfData?.products ?? []).slice(1).filter(
          (q: { ingredients_text?: string; product_name?: string }) => q.ingredients_text && q.product_name
        );
        if (obfProducts.length) {
          obfVariants = obfProducts.slice(0, 3).map((q: {
            product_name: string;
            brands?: string;
            image_front_url?: string;
            image_url?: string;
            ingredients_text: string;
          }) => ({
            name: q.product_name,
            brand: q.brands ?? null,
            image_url: q.image_front_url ?? q.image_url ?? null,
            ingredients_text: q.ingredients_text,
          }));
        }
      }
    }

    if (!rawIngredients) {
      return NextResponse.json({ notFound: true });
    }
  } else if (type === "url") {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ needsAuth: true }, { status: 401 });
    }

    const user = await getOrCreateUser(userId);
    if (!user) {
      return NextResponse.json({ error: "Could not load user" }, { status: 500 });
    }

    if (user.role !== "admin" && user.ai_extractions_today >= 5) {
      return NextResponse.json({ limitReached: true }, { status: 429 });
    }

    const extracted = await extractFromUrl(url);
    if (!extracted) {
      return NextResponse.json({ notFound: true });
    }

    rawIngredients = extracted;
    product = { name: url, source: "url-extract" };

    if (user.role !== "admin") {
      await supabase
        .from("app_users")
        .update({ ai_extractions_today: user.ai_extractions_today + 1 })
        .eq("clerk_id", userId);
    }
  } else {
    return NextResponse.json({ error: "Unknown scan type" }, { status: 400 });
  }

  const originalItems = rawIngredients
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/[​‌‍﻿]/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);

  const isIncomplete = originalItems.length > 0 && originalItems.length < 5;

  const { safe, flagged, unreviewed } = await matchIngredients(rawIngredients);

  // Build photosensitive list from originalItems using pattern matching
  const photosensitive: PhotosensitiveItem[] = [];
  const seenPhotoKeys = new Set<string>();
  for (const item of originalItems) {
    const cleaned = item.replace(/\([^)]*\)/g, "").trim();
    for (const rule of PHOTO_PATTERNS) {
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seenPhotoKeys.has(key)) {
          seenPhotoKeys.add(key);
          photosensitive.push({ rawName: item, sunLevel: rule.level, photo_note: rule.note });
        }
        break;
      }
    }
  }

  // Fire-and-forget: push unreviewed ingredients into the queue for future classification
  if (unreviewed.length > 0) {
    const productName = product?.name ?? null;
    Promise.all(
      unreviewed.map(async (name) => {
        // Upsert: increment times_seen if already queued, otherwise insert
        const { data: existing } = await supabase
          .from("ingredient_queue")
          .select("id, times_seen")
          .ilike("name", name)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("ingredient_queue")
            .update({ times_seen: existing.times_seen + 1, last_seen: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("ingredient_queue")
            .insert({ name, found_in: productName, times_seen: 1 });
        }
      })
    ).catch(() => { /* never block the scan response */ });
  }

  return NextResponse.json({ product, safe, flagged, unreviewed, photosensitive, communityVariants, obfVariants, originalItems, isIncomplete });
}
