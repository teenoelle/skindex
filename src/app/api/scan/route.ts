import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { matchIngredients } from "@/lib/scanner";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import type { CommunityVariant, ObfVariant, PhotosensitiveItem, SensoryTriggerItem } from "@/types";
import { COMEDOGENIC_PATTERNS } from "@/lib/comedogenic";
import { extractIngredientsFromUrl } from "@/lib/extract-ingredients";

function obfFullImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\.\d+\.jpg$/, ".full.jpg");
}

import type { PhotoCategory } from "@/types";

const PHOTO_PATTERNS: { pattern: RegExp; level: PhotosensitiveItem["sunLevel"]; photoCategory: PhotoCategory; note: string }[] = [
  {
    pattern: /retinol|retinyl palmitate|retinyl acetate|retinaldehyde|tretinoin/i,
    level: "avoid",
    photoCategory: "photo-retinoid",
    note: "Retinoids accelerate skin cell turnover, which progressively thins the stratum corneum — the skin's protective outer layer. This barrier thinning leaves newly formed cells more vulnerable to UV radiation. Use SPF daily and avoid prolonged sun exposure.",
  },
  {
    pattern: /glycolic acid|lactic acid|mandelic acid|tartaric acid/i,
    level: "avoid",
    photoCategory: "photo-AHA",
    note: "AHA exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF daily when using.",
  },
  {
    pattern: /\barbutin\b|alpha.arbutin/i,
    level: "avoid",
    photoCategory: "photo-brightening",
    note: "Can break down into hydroquinone on UV exposure, which is photosensitizing and may cause hyperpigmentation on sun-exposed skin. Use SPF daily.",
  },
  {
    pattern: /salicylic acid/i,
    level: "avoid",
    photoCategory: "photo-BHA",
    note: "BHA exfoliant that increases skin cell turnover, leaving skin more vulnerable to UV damage. Apply SPF daily when using.",
  },
  {
    pattern: /limonene|citral|bergapten|bergamot|citrus aurantium|citrus limon|citrus sinensis|citrus grandis|citrus paradisi|grapefruit/i,
    level: "avoid",
    photoCategory: "photo-botanical",
    note: "Contains furanocoumarins — light-reactive compounds that combine with UV to trigger phototoxic burns and lasting dark patches on exposed skin. Apply only in evening routines and keep treated areas covered from direct sun.",
  },
];


const SENSORY_PATTERNS: { pattern: RegExp; note: string; sensory_category: string }[] = [
  {
    pattern: /(?!.*\bleaf water\b)(\baloe\b|aloe barbadensis|aloe vera)/i,
    sensory_category: "Film-forming",
    note: "Aloe's acemannan polysaccharides form a biopolymer film on skin that tightens and crusts as it dries, creating an itch-and-scratch cycle. This is most pronounced with raw or concentrated gel — in well-formulated products where aloe is diluted, the film-forming effect is usually minimal.",
  },
  {
    pattern: /\bkaolin\b|\bbentonite\b|montmorillonite/i,
    sensory_category: "Film-forming",
    note: "Forms a tightening film as it dries that creates discomfort and an urge to touch or rub the face — cumulative mechanical contact that can damage the skin barrier over time.",
  },
  {
    pattern: /\bmenthol\b|\bl-menthol\b/i,
    sensory_category: "Cooling",
    note: "Creates an intense cooling sensation that transitions to burning or itching, frequently triggering unconscious touching and scratching. The repeated mechanical contact can damage an already reactive skin barrier.",
  },
  {
    pattern: /peppermint/i,
    sensory_category: "Cooling",
    note: "Contains menthol, which produces a cooling-then-burning sensation that prompts touching and scratching. Not recommended for reactive or barrier-compromised skin.",
  },
  {
    pattern: /spearmint|mentha spicata/i,
    sensory_category: "Cooling",
    note: "Contains carvone and trace menthol, producing a cooling-then-burning sensation similar to peppermint. The sensation prompts touching or rubbing, which can mechanically disrupt an already reactive skin barrier.",
  },
  {
    pattern: /\bcamphor\b/i,
    sensory_category: "Cooling",
    note: "Creates a strong cooling-to-warming sensation that frequently triggers touching or scratching, which can mechanically damage an already reactive skin barrier.",
  },
  {
    pattern: /eucalyptus/i,
    sensory_category: "Cooling",
    note: "Contains eucalyptol, which creates a cooling-to-numbing sensation that transitions to itching on reactive skin. Frequently triggers unconscious touching and can worsen barrier damage.",
  },
  {
    pattern: /\bclove\b|eugenia caryophyllus/i,
    sensory_category: "Warming",
    note: "Eugenol creates a numbing-then-burning sensation on skin that frequently triggers unconscious touching. Can be acutely irritating to a compromised barrier.",
  },
  {
    pattern: /\bcinnamon\b|cinnamomum/i,
    sensory_category: "Warming",
    note: "Cinnamaldehyde creates a warming-to-burning sensation that prompts touching and rubbing. Even low concentrations can cause irritation on reactive skin.",
  },
  {
    pattern: /hamamelis|witch hazel/i,
    sensory_category: "Astringent",
    note: "Its astringent tannins cause a visible tightening sensation that prompts touching the face. With regular use, the cumulative drying effect progressively weakens the barrier.",
  },
  {
    pattern: /alcohol denat|denatured alcohol|sd alcohol/i,
    sensory_category: "Stripping",
    note: "Creates an immediate stinging or burning sensation on reactive or compromised skin, frequently triggering face-touching and rubbing reflexes.",
  },
  {
    pattern: /sodium lauryl sulfate|\bsls\b(?!es)/i,
    sensory_category: "Stripping",
    note: "Leaves skin with an immediate tight, stripped feeling after rinsing that prompts touching and rubbing — compounding barrier damage already caused by the detergent.",
  },
  {
    pattern: /salicylic acid/i,
    sensory_category: "Stinging",
    note: "Creates a mild tingling-to-burning sensation on sensitive or barrier-compromised skin, especially at concentrations above 1%.",
  },
  {
    pattern: /glycolic acid/i,
    sensory_category: "Stinging",
    note: "Causes a noticeable stinging or burning sensation on reactive or barrier-compromised skin. The sting intensifies at higher concentrations and on areas where the barrier is already damaged — prompting touching that slows recovery.",
  },
  {
    pattern: /lactic acid|mandelic acid|malic acid|tartaric acid/i,
    sensory_category: "Stinging",
    note: "AHA exfoliants that cause a tingling or stinging sensation on reactive skin. Gentler than glycolic acid but still capable of causing discomfort on a compromised barrier, especially in acidic formulas.",
  },
  {
    pattern: /benzoyl peroxide/i,
    sensory_category: "Stinging",
    note: "Causes a pronounced burning and stinging sensation on contact, especially on reactive or broken skin. The drying effect compounds over time, creating a raw, sensitized surface that is difficult not to touch or pick at.",
  },
  {
    pattern: /propylene glycol/i,
    sensory_category: "Stinging",
    note: "Can cause a stinging or burning sensation on sensitized skin and around areas where the barrier is broken or compromised.",
  },
  {
    pattern: /kojic acid/i,
    sensory_category: "Stinging",
    note: "Can produce a prickling or stinging sensation on reactive skin, particularly at higher concentrations or when applied to a weakened barrier.",
  },
  {
    pattern: /petrolatum|mineral oil|white petrolatum|\bparaffin\b/i,
    sensory_category: "Occlusive",
    note: "Creates a dense physical seal over the skin surface, trapping sweat, sebum, and heat underneath. The resulting warmth and humidity can cause a prickling or itching sensation — and the bacterial buildup over time leads to breakouts that prompt picking.",
  },
  {
    pattern: /\blanolin\b/i,
    sensory_category: "Occlusive",
    note: "A dense animal wax that seals the skin surface and restricts airflow. The occlusive warmth can cause a stuffy, itching feeling over time — especially around pores and in warmer weather.",
  },
  {
    pattern: /\bbeeswax\b|cera alba|cera flava/i,
    sensory_category: "Occlusive",
    note: "A heavy wax that seals the skin surface and limits breathability. Can cause a stuffy, warm feeling that leads to itching and touching, particularly on reactive or congestion-prone skin.",
  },
  {
    pattern: /butyrospermum parkii|shea butter|theobroma cacao seed butter|cocoa butter/i,
    sensory_category: "Occlusive",
    note: "A rich, heavy emollient that creates a semi-occlusive layer on the skin surface, trapping heat and sebum underneath. For reactive or congestion-prone skin, the warmth and humidity this creates can cause a prickling or itching sensation and encourage picking — similar to beeswax.",
  },
  {
    pattern: /carnauba|candelilla/i,
    sensory_category: "Occlusive",
    note: "A hard plant wax that creates a stiff, occlusive film on skin. Can trap sweat and sebum beneath the surface, causing warmth and itching that prompt touching.",
  },
  {
    pattern: /\bdimethicone\b|trimethylsiloxysilicate/i,
    sensory_category: "Pilling",
    note: "Can ball up into a gritty, visible residue when applied over water-based layers or in excess — especially if the previous layer hasn't fully absorbed. The physical sensation of pilled product on skin frequently triggers rubbing and picking.",
  },
  {
    pattern: /acrylates copolymer|acrylates\/c10|\bpvp\b|polyvinylpyrrolidone/i,
    sensory_category: "Pilling",
    note: "A film-forming polymer that can roll and ball up when layered with incompatible formulas or applied over skin that isn't fully dry. The lumpy residue it creates prompts rubbing and picking that disrupts the skin barrier.",
  },
  {
    pattern: /acryloyldimethyltaurate|\/vp copolymer|vp\/va copolymer|carbomer|carbopol|polyacrylate/i,
    sensory_category: "Film-forming",
    note: "A synthetic film-forming polymer used to create gel or serum textures. It lays a continuous surface film that can trap dead skin cells underneath, preventing normal shedding and contributing to milia — small, hard, keratin-filled bumps just under the skin surface that are distinct from comedones.",
  },
];

const BENEFIT_PATTERNS: { pattern: RegExp; note: string }[] = [
  {
    pattern: /retinol|retinyl palmitate|retinyl acetate|retinaldehyde|\bretinal\b|tretinoin|retinoic acid/i,
    note: "Why it's in the formula: Retinoids are among the most evidence-backed skincare actives — they stimulate collagen production, accelerate cell turnover, and treat acne. Worth considering once your skin barrier is stable and they can be introduced gradually.",
  },
  {
    pattern: /glycolic acid/i,
    note: "Why it's in the formula: Removes dead skin cells, brightens uneven tone, and stimulates collagen. Widely used in anti-aging and resurfacing routines — the key is low concentrations and consistent SPF.",
  },
  {
    pattern: /lactic acid/i,
    note: "Why it's in the formula: Exfoliates while also drawing moisture into skin, making it gentler than glycolic acid. Used for brightening and texture improvement.",
  },
  {
    pattern: /salicylic acid/i,
    note: "Why it's in the formula: Oil-soluble — it penetrates into pores to clear blockages from the inside. One of the most effective OTC treatments for acne and blackheads.",
  },
  {
    pattern: /benzoyl peroxide/i,
    note: "Why it's in the formula: Kills acne-causing bacteria directly and is the most effective non-prescription acne treatment available. Often worth the irritation for active breakouts.",
  },
  {
    pattern: /tea tree|melaleuca/i,
    note: "Why it's in the formula: Has natural antimicrobial properties and is used as a gentler alternative to benzoyl peroxide for acne. Some skin tolerates it well at low concentrations.",
  },
  {
    pattern: /kojic acid/i,
    note: "Why it's in the formula: Inhibits melanin production — a common brightening treatment for dark spots and hyperpigmentation.",
  },
  {
    pattern: /oxybenzone|benzophenone-3|octinoxate|ethylhexyl methoxycinnamate|octisalate|ethylhexyl salicylate|avobenzone|butyl methoxydibenzoylmethane|octocrylene|homosalate/i,
    note: "Why it's in the formula: Chemical UV filters provide broad-spectrum sun protection. The concern is about potential systemic absorption — not about whether they protect against UV damage.",
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

export async function POST(req: NextRequest) {
  const { type, query, ingredients, url, productId } = await req.json();

  let rawIngredients = "";
  let autoImportedProductId: string | null = null;
  let communityVariants: CommunityVariant[] | undefined;
  let obfVariants: ObfVariant[] | undefined;
  let product: {
    id?: string | null;
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
        id: dbProduct.id ?? null,
        name: dbProduct.name,
        brand: dbProduct.brand,
        source: "community",
        type: dbProduct.type ?? null,
        image_url: dbProduct.image_url ?? null,
        activity_tags: dbProduct.activity_tags ?? null,
        activity_note: dbProduct.activity_note ?? null,
      };

      // Collect OBF variants (shown as alternatives at bottom of results)
      // Also use OBF image for this response if no community image exists — so it shows on first scan
      const obfData = await obfFetch;
      if (!dbProduct.image_url) {
        const obfImg = obfFullImage(
          obfData?.products?.[0]?.image_front_url ?? obfData?.products?.[0]?.image_url ?? null
        );
        if (obfImg) {
          product.image_url = obfImg;
          const pid = dbProduct.id;
          import("@/lib/supabase-admin").then(({ supabaseAdmin }) => {
            supabaseAdmin.from("products").update({ image_url: obfImg }).eq("id", pid).then(() => {});
          }).catch(() => {});
        } else {
          // Fallback: search by exact product name in background (saves for future scans)
          const pid = dbProduct.id;
          const productName = dbProduct.name;
          import("@/lib/supabase-admin").then(({ supabaseAdmin }) => {
            fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&action=process&json=1&page_size=3`)
              .then((r) => r.json())
              .then((data) => {
                const img = obfFullImage(data.products?.[0]?.image_front_url ?? data.products?.[0]?.image_url ?? null);
                if (img) supabaseAdmin.from("products").update({ image_url: img }).eq("id", pid).then(() => {});
              })
              .catch(() => {});
          }).catch(() => {});
        }
      }
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
          image_url: obfFullImage(p.image_front_url ?? p.image_url ?? null),
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
          image_url: obfFullImage(p.image_front_url || p.image_url || null),
        };

        const { data: inserted } = await supabase.from("products").insert({
          name: p.product_name || query,
          brand: p.brands || null,
          ingredient_list: p.ingredients_text,
          image_url: obfFullImage(p.image_front_url || p.image_url || null),
          source: "auto-imported",
        }).select("id").single();
        autoImportedProductId = inserted?.id ?? null;

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
            image_url: obfFullImage(q.image_front_url ?? q.image_url ?? null),
            ingredients_text: q.ingredients_text,
          }));
        }
      }
    }

    // Surface "Did you mean" alternatives when a product was found but no variants were collected yet
    if (dbProduct && !communityVariants?.length && !productId && query) {
      const { data: alts } = await supabase
        .from("products")
        .select("id, name, brand")
        .ilike("name", `%${query}%`)
        .not("ingredient_list", "is", null)
        .neq("id", dbProduct.id)
        .limit(3);
      if (alts?.length) {
        communityVariants = alts.map((p) => ({ id: p.id, name: p.name, brand: p.brand ?? null }));
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

    const extracted = await extractIngredientsFromUrl(url);
    if (!extracted) {
      return NextResponse.json({ notFound: true });
    }

    rawIngredients = extracted;
    product = { name: url, source: "url-extract" };
  } else {
    return NextResponse.json({ error: "Unknown scan type" }, { status: 400 });
  }

  const originalItems = rawIngredients
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/[​‌‍﻿]/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);

  const isIncomplete = originalItems.length > 0 && originalItems.length < 5;

  const { safe, flagged, unreviewed } = await matchIngredients(rawIngredients);

  // Build comedogenic list from originalItems and merge into flagged
  const dbFlaggedNames = new Set(flagged.map((f) => f.displayName.toLowerCase().trim()));
  const seenComedoKeys = new Set<string>();
  const comedoFlaggedKeys = new Set<string>();
  for (let i = 0; i < originalItems.length; i++) {
    const item = originalItems[i];
    const cleaned = item.replace(/\([^)]*\)/g, "").trim();
    if (dbFlaggedNames.has(cleaned.toLowerCase())) continue; // already flagged from DB
    for (const rule of COMEDOGENIC_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (!rule.pattern.test(cleaned)) continue;
      const key = cleaned.toLowerCase();
      if (!seenComedoKeys.has(key)) {
        seenComedoKeys.add(key);
        comedoFlaggedKeys.add(key);
        flagged.push({
          displayName: cleaned,
          ingredient: {
            id: `comedo-${key.replace(/[^a-z0-9]/g, "-")}`,
            name: cleaned,
            inci_name: null,
            status: "flagged",
            explanation: rule.note,
            category: "pore-clogger",
            flagged_category: "pore-clogger",
            structural_category: null,
          },
          comedogenicRating: rule.rating,
        });
      }
      break;
    }
  }
  // Remove pattern-flagged ingredients from safe to avoid dual-listing
  const safeFiltered = safe.filter(
    (s) => !comedoFlaggedKeys.has(s.displayName.toLowerCase().trim())
  );

  // Annotate flagged ingredients with benefit notes where applicable
  for (const item of flagged) {
    for (const rule of BENEFIT_PATTERNS) {
      if (rule.pattern.test(item.displayName)) {
        item.benefit_note = rule.note;
        break;
      }
    }
  }

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
          photosensitive.push({ rawName: item, sunLevel: rule.level, photo_note: rule.note, photoCategory: rule.photoCategory });
        }
        break;
      }
    }
  }

  // Build sensory trigger list from originalItems using pattern matching
  const sensoryTrigger: SensoryTriggerItem[] = [];
  const seenSensoryKeys = new Set<string>();
  for (const item of originalItems) {
    const cleaned = item.replace(/\([^)]*\)/g, "").trim();
    for (const rule of SENSORY_PATTERNS) {
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seenSensoryKeys.has(key)) {
          seenSensoryKeys.add(key);
          sensoryTrigger.push({ rawName: item, sensory_note: rule.note, sensory_category: rule.sensory_category });
        }
        break;
      }
    }
  }

  // Pore-clogging: comedogenic-flagged ingredients also appear as sensory triggers
  const COMEDO_SENSORY_NOTE = "Tends to block pores over time, forming blackheads and inflamed bumps. The urge to pick or squeeze these is difficult to resist — and the mechanical trauma from picking typically causes more lasting barrier damage than the clogging itself.";
  const seenSensoryFinal = new Set(sensoryTrigger.map((s) => s.rawName.toLowerCase()));
  for (const fi of flagged) {
    if (fi.ingredient.id.startsWith("comedo-") && !seenSensoryFinal.has(fi.displayName.toLowerCase())) {
      sensoryTrigger.push({ rawName: fi.displayName, sensory_note: COMEDO_SENSORY_NOTE, sensory_category: "Pore-clogging" });
    }
  }

  // Fire-and-forget: populate product_ingredients for newly auto-imported products
  if (autoImportedProductId) {
    const pid = autoImportedProductId;
    const rows = [...safeFiltered, ...flagged]
      .filter((m) => !m.ingredient.id.startsWith("comedo-"))
      .map((m, idx) => ({ product_id: pid, ingredient_id: m.ingredient.id, position: idx + 1 }));
    if (rows.length > 0) {
      import("@/lib/supabase-admin").then(({ supabaseAdmin }) => {
        supabaseAdmin.from("product_ingredients").upsert(rows, { onConflict: "product_id,ingredient_id" }).then(() => {});
      }).catch(() => {});
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

  return NextResponse.json({ product, safe: safeFiltered, flagged, unreviewed, photosensitive, sensoryTrigger, communityVariants, obfVariants, originalItems, isIncomplete });
}
