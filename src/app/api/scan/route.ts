import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { matchIngredients } from "@/lib/scanner";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import type { CommunityVariant, ObfVariant, PhotosensitiveItem, SensoryTriggerItem } from "@/types";
import { COMEDOGENIC_PATTERNS, countComedogenicPatternMatches } from "@/lib/comedogenic";
import { SENSORY_PATTERNS, countSensoryPatternMatches } from "@/lib/sensory";
import { countPhotoPatternMatches } from "@/lib/photo";
import { computeProductConcerns } from "@/lib/compute-concerns";
import { extractIngredientsFromUrl, mapCategoryToType, guessProductType } from "@/lib/extract-ingredients";

function obfFullImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\.\d+\.jpg$/, ".full.jpg");
}

import type { FormulaWarning, PhotoCategory } from "@/types";

function detectCombinationWarnings(items: string[], flaggedItems: { flagged_category: string | null }[]): FormulaWarning[] {
  const warnings: FormulaWarning[] = [];
  const joined = items.join(", ").toLowerCase();

  const hasZinc = /\bzinc\b/.test(joined) && !/zinc oxide/.test(joined) === false || /\bzinc\b/.test(joined);
  const hasCopper = /\bcopper\b/.test(joined);
  const hasVitC = /ascorbic acid|ascorbyl/.test(joined);
  const hasRetinoid = /retinol|retinyl|retinaldehyde|tretinoin/.test(joined);
  const hasAHA = /glycolic acid|lactic acid|mandelic acid|malic acid/.test(joined);
  const hasBHA = /salicylic acid/.test(joined);
  const hasBP = /benzoyl peroxide/.test(joined);
  const hasWitchHazel = /hamamelis|witch hazel/.test(joined);
  const hasNiacinamide = /niacinamide|nicotinamide/.test(joined);
  const hasZincPCA = /zinc pca/.test(joined);
  const hasFerulicAcid = /ferulic acid/.test(joined);
  const hasVitE = /tocopherol/.test(joined);
  const hasSelenium = /\bselenium\b/.test(joined);

  const sensitizerCount = flaggedItems.filter(
    (f) => f.flagged_category === "sensitizer" || f.flagged_category === "fragrance-allergen"
  ).length;

  // Danger combinations
  if (hasZinc && hasCopper) {
    warnings.push({
      type: "danger",
      title: "Zinc + Copper: effectiveness conflict",
      body: "Zinc and copper compete for the same metal transporter binding sites in skin cells. High zinc concentration blocks copper peptide activity — if copper peptides are included for wound-healing or firming benefit, zinc compounds in the same formula or applied back-to-back can significantly reduce their effectiveness.",
    });
  }
  if (hasCopper && hasWitchHazel) {
    warnings.push({
      type: "danger",
      title: "Witch hazel + Copper: chelation inactivation",
      body: "The tannins in witch hazel chelate (bind and neutralize) copper ions. Copper peptides formulated alongside witch hazel or applied directly after can be significantly inactivated before reaching skin.",
    });
  }
  if (hasCopper && hasVitC) {
    warnings.push({
      type: "danger",
      title: "Copper + Vitamin C: potential pro-oxidant",
      body: "Vitamin C reduces Cu²⁺ to Cu⁺ through a redox reaction, which can react with oxygen to generate free radicals — the opposite of the antioxidant effect both are intended to provide. More of a concern at higher vitamin C concentrations (above 10%).",
    });
  }
  if (hasBP && hasRetinoid) {
    warnings.push({
      type: "danger",
      title: "Benzoyl peroxide + Retinoid: oxidizes the retinol",
      body: "Benzoyl peroxide degrades retinol and retinyl esters on contact, rendering them ineffective even when applied in different products in the same routine. Separate them to morning and evening, or use a more BP-stable retinoid form (retinaldehyde, tretinoin).",
    });
  }
  if (hasRetinoid && (hasAHA || hasBHA)) {
    warnings.push({
      type: "danger",
      title: "Retinoid + Exfoliant: compounded irritation",
      body: "Both retinoids and AHA/BHA exfoliants disrupt cell turnover and thin the stratum corneum — using them together significantly increases the risk of barrier disruption, redness, and peeling. Best separated to different nights or different routines.",
    });
  }
  if (sensitizerCount >= 3) {
    warnings.push({
      type: "danger",
      title: `High sensitizer load (${sensitizerCount} sensitizers detected)`,
      body: "Individual sensitizers in a formula can each be within acceptable limits, but the combined contact sensitization burden accumulates. Formulas with 3 or more sensitizers significantly increase the likelihood of developing a contact allergy over time, especially for reactive or eczema-prone skin.",
    });
  }

  // Synergy combinations
  if (hasVitC && hasFerulicAcid) {
    warnings.push({
      type: "synergy",
      title: "Vitamin C + Ferulic acid: stability synergy",
      body: "Ferulic acid is one of the few ingredients that genuinely stabilizes vitamin C (ascorbic acid) in aqueous formulas, slowing oxidation and extending both shelf life and skin efficacy. This pairing is backed by published research.",
    });
  }
  if (hasVitE && hasSelenium) {
    warnings.push({
      type: "synergy",
      title: "Vitamin E + Selenium: antioxidant synergy",
      body: "Selenium is a cofactor for glutathione peroxidase, which regenerates vitamin E after it neutralizes free radicals. Together they form a self-reinforcing antioxidant cycle — more effective than either alone.",
    });
  }
  if (hasNiacinamide && hasZincPCA) {
    warnings.push({
      type: "synergy",
      title: "Niacinamide + Zinc PCA: sebum control synergy",
      body: "Niacinamide reduces sebaceous gland activity at the cellular level; zinc PCA inhibits 5-alpha-reductase, the enzyme that triggers excess sebum production. Together they target oily and acne-prone skin through complementary mechanisms.",
    });
  }
  if (hasZinc && hasVitC && !hasCopper) {
    warnings.push({
      type: "synergy",
      title: "Zinc + Vitamin C: antioxidant stabilization",
      body: "Zinc helps stabilize vitamin C against oxidation, extending the active life of ascorbic acid in the formula. A mild but genuine pairing for antioxidant benefit.",
    });
  }

  return warnings;
}

function detectStepTags(items: string[], isRinseOff = false): string[] {
  const joined = items.join(", ").toLowerCase();
  const tags: string[] = [];
  // Acid/pH step tags only make sense for leave-on products — suppress for rinse-off
  if (!isRinseOff && /glycolic acid|lactic acid|mandelic acid|malic acid|salicylic acid/.test(joined)) tags.push("acid-step");
  if (!isRinseOff && /\bascorbic acid\b/.test(joined)) tags.push("low-ph-step");
  if (/retinol|retinyl|retinaldehyde|tretinoin/.test(joined)) tags.push("retinoid");
  if (/zinc oxide|titanium dioxide/.test(joined)) tags.push("spf-last");
  if (/petrolatum|beeswax|cera alba|cera flava|\bparaffin\b/.test(joined)) tags.push("seal-last");
  const hasPenetrationEnhancer = /alcohol denat|denatured alcohol|sd alcohol/.test(joined);
  const hasSensitizer = /\bfragrance\b|\bparfum\b|methylisothiazolinone|methylchloroisothiazolinone/.test(joined);
  if (hasPenetrationEnhancer && hasSensitizer) tags.push("enhancer-caution");
  return [...new Set(tags)];
}

const PHOTO_PATTERNS: { pattern: RegExp; level: PhotosensitiveItem["sunLevel"]; photoCategory: PhotoCategory; note: string; maxPosition?: number }[] = [
  {
    pattern: /retinol|retinyl palmitate|retinyl acetate|retinaldehyde|tretinoin/i,
    level: "avoid",
    photoCategory: "photo-retinoid",
    note: "Retinoids accelerate skin cell turnover, which progressively thins the stratum corneum — the skin's protective outer layer. This barrier thinning leaves newly formed cells more vulnerable to UV radiation. Use SPF daily and avoid prolonged sun exposure.",
  },
  {
    pattern: /glycolic acid|lactic acid|mandelic acid|malic acid|tartaric acid/i,
    level: "avoid",
    photoCategory: "photo-AHA",
    note: "AHA exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF daily when using.",
  },
  {
    pattern: /citric acid/i,
    level: "avoid",
    photoCategory: "photo-AHA",
    note: "At high concentrations (indicated by appearing in the first 10 ingredients), citric acid acts as an AHA exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF daily when using products where it appears high in the ingredient list.",
    maxPosition: 10,
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
  const { type, query, ingredients, url, productId, profileConcerns = [], skinTypes = [], climates = [] } = await req.json();
  const profileConcernsSet = new Set(profileConcerns as string[]);

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
    iherb_url?: string | null;
    source_url?: string | null;
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
        .eq("is_archived", false)
        .eq("is_pending", false)
        .limit(10);
      if (data?.length) {
        // Check for close scores — if top match is exact, take it; otherwise collect ambiguous ones
        dbProduct = data[0];
        if (data.length > 1) {
          // All are substring matches, offer alternatives
          communityVariants = data.slice(1).map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand ?? null,
            type: p.type ?? null,
            image_url: null,
            flaggedCount: 0,
            sensoryCount: 0,
            photoCount: 0,
          }));
        }
      }
    }

    // Strategy 2: token match — score candidates by how many query words appear in name/brand
    if (!dbProduct) {
      const tokens = query.trim().split(/\s+/).filter((w: string) => w.length >= 3);
      if (tokens.length > 1) {
        const orFilter = tokens.map((t: string) => `name.ilike.%${t}%,brand.ilike.%${t}%`).join(",");
        const { data: candidates } = await supabase
          .from("products")
          .select("*")
          .or(orFilter)
          .not("ingredient_list", "is", null)
          .eq("is_archived", false)
          .eq("is_pending", false)
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
              communityVariants = alts.map((s) => ({
                id: s.p.id,
                name: s.p.name,
                brand: s.p.brand ?? null,
                type: s.p.type ?? null,
                image_url: null,
                flaggedCount: 0,
                sensoryCount: 0,
                photoCount: 0,
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
        iherb_url: dbProduct.iherb_url ?? null,
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

        // Derive type from OBF categories (tags like "en:deodorants") or product name fallback
        let obfProductType: string | null = null;
        if (Array.isArray(p.categories_tags)) {
          for (let i = p.categories_tags.length - 1; i >= 0; i--) {
            const tag = (p.categories_tags[i] as string).replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
            obfProductType = mapCategoryToType(tag);
            if (obfProductType) break;
          }
        }
        if (!obfProductType && typeof p.categories === "string") {
          const cats = (p.categories as string).split(",").map((c: string) => c.trim()).filter(Boolean);
          for (let i = cats.length - 1; i >= 0; i--) {
            obfProductType = mapCategoryToType(cats[i]);
            if (obfProductType) break;
          }
        }
        if (!obfProductType) obfProductType = guessProductType(p.product_name || query);

        product = {
          name: p.product_name || query,
          brand: p.brands || null,
          source: "openbeautyfacts",
          type: obfProductType,
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
        .select("id, name, brand, type")
        .ilike("name", `%${query}%`)
        .not("ingredient_list", "is", null)
        .eq("is_pending", false)
        .neq("id", dbProduct.id)
        .limit(10);
      if (alts?.length) {
        communityVariants = alts.map((p) => ({ id: p.id, name: p.name, brand: p.brand ?? null, type: p.type ?? null, image_url: null, flaggedCount: 0, sensoryCount: 0, photoCount: 0 }));
      }
    }

    // Enrich communityVariants with images and concern counts
    if (communityVariants?.length) {
      const variantIds = communityVariants.map((v) => v.id);
      const [{ data: variantData }, { data: allIngredientsDb }] = await Promise.all([
        supabase.from("products").select("id, image_url, ingredient_list").in("id", variantIds),
        supabase.from("ingredients").select("id, name, inci_name, status, flagged_category, secondary_flagged_categories, structural_category"),
      ]);
      const allIngredients = (allIngredientsDb ?? []) as import("@/lib/compute-concerns").IngredientRow[];
      const listMap = new Map((variantData ?? []).map((p) => [p.id, { list: p.ingredient_list as string | null, image_url: p.image_url as string | null }]));
      communityVariants = communityVariants.map((v) => {
        const entry = listMap.get(v.id);
        const list = entry?.list ?? null;
        if (!list) return { ...v, image_url: entry?.image_url ?? null };
        const counts = computeProductConcerns(list, allIngredients, profileConcernsSet, skinTypes as string[], climates as string[], v.type);
        return { ...v, image_url: entry?.image_url ?? null, ...counts };
      });
    }

    if (!rawIngredients) {
      // Fire-and-forget: log the missed search query for admin review
      if (query) {
        import("@/lib/supabase-admin").then(({ supabaseAdmin: sa }) => {
          sa.rpc("upsert_search_miss", { p_query: query, p_kind: "search", p_failure: "no_match" }).then(() => {});
        }).catch(() => {});
      }
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

    // Check community DB by source_url before running AI extraction
    {
      const { data: cached } = await supabase
        .from("products")
        .select("id, name, brand, type, ingredient_list, image_url, iherb_url, source_url")
        .eq("source_url", url)
        .not("ingredient_list", "is", null)
        .eq("is_archived", false)
        .eq("is_pending", false)
        .maybeSingle();

      if (cached?.ingredient_list) {
        rawIngredients = cached.ingredient_list;
        product = {
          id: cached.id,
          name: cached.name,
          brand: cached.brand ?? null,
          source: "community",
          type: cached.type ?? null,
          image_url: cached.image_url ?? null,
          iherb_url: cached.iherb_url ?? null,
          source_url: cached.source_url ?? url,
        };
        // Skip extraction — jump straight to ingredient matching below
        // (fall through by leaving the else block unentered)
      }
    }

    if (!rawIngredients) {
    const extracted = await extractIngredientsFromUrl(url);
    if (!extracted) {
      const isIHerb = url.toLowerCase().includes("iherb.com");
      // Fire-and-forget: log the failed URL import for admin review
      import("@/lib/supabase-admin").then(({ supabaseAdmin: sa }) => {
        sa.rpc("upsert_search_miss", {
          p_query: url,
          p_kind: "url",
          p_failure: isIHerb ? "iherb_blocked" : "extraction_failed",
        }).then(() => {});
      }).catch(() => {});
      return NextResponse.json({ notFound: true, iHerbBlocked: isIHerb });
    }

    rawIngredients = extracted.ingredients;
    const productName = extracted.name ?? url;
    product = {
      name: productName,
      brand: extracted.brand ?? null,
      source: "url-extract",
      type: extracted.type ?? null,
    };

    // Save to DB before responding so the product is searchable immediately.
    // Also update existing url-import records to fix stale data from older extractions.
    try {
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      // Look up by name+brand to avoid duplicates; use limit(1) to survive multiple matches
      let existingId: string | null = null;
      let existingSource: string | null = null;
      let existingIherbUrl: string | null = null;
      let existingImageUrl: string | null = null;
      const { data: existingRows } = await supabaseAdmin
        .from("products")
        .select("id, source, iherb_url, image_url")
        .ilike("name", productName)
        .not("ingredient_list", "is", null)
        .limit(1);
      if (existingRows?.length) {
        existingId = existingRows[0].id;
        existingSource = existingRows[0].source;
        existingIherbUrl = existingRows[0].iherb_url ?? null;
        existingImageUrl = existingRows[0].image_url ?? null;
      }

      const extractedIherbUrl = extracted.iherb_url ?? null;
      const extractedImageUrl = extracted.image_url ?? null;

      if (!existingId) {
        const { data: inserted } = await supabaseAdmin
          .from("products")
          .insert({
            name: productName,
            brand: extracted.brand ?? null,
            ingredient_list: extracted.ingredients,
            type: extracted.type ?? null,
            source: "url-import",
            source_url: url,
            ...(extractedIherbUrl ? { iherb_url: extractedIherbUrl } : {}),
            ...(extractedImageUrl ? { image_url: extractedImageUrl } : {}),
          })
          .select("id")
          .single();
        if (inserted?.id) product.id = inserted.id;
        if (extractedIherbUrl) product.iherb_url = extractedIherbUrl;
        if (extractedImageUrl) product.image_url = extractedImageUrl;
        product.source_url = url;
      } else {
        product.id = existingId;
        // Prefer freshly-extracted values; fall back to what's stored
        product.iherb_url = extractedIherbUrl ?? existingIherbUrl;
        product.image_url = extractedImageUrl ?? existingImageUrl;
        product.source_url = url;
        if (existingSource === "url-import") {
          await supabaseAdmin
            .from("products")
            .update({
              name: productName,
              brand: extracted.brand ?? null,
              ingredient_list: extracted.ingredients,
              type: extracted.type ?? null,
              source_url: url,
              ...(extractedIherbUrl ? { iherb_url: extractedIherbUrl } : {}),
              // Only overwrite image_url if the row doesn't already have one
              ...(extractedImageUrl && !existingImageUrl ? { image_url: extractedImageUrl } : {}),
            })
            .eq("id", existingId);
        }
      }
    } catch { /* don't fail the scan if DB save fails */ }
    } // end if (!rawIngredients)
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
            explanation_structured: null,
            category: "pore-clogger",
            flagged_category: "pore-clogger",
            secondary_flagged_categories: [],
            secondary_benefit_categories: [],
            structural_category: null,
            skin_climate_notes: null,
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
  for (let i = 0; i < originalItems.length; i++) {
    const item = originalItems[i];
    const cleaned = item.replace(/\([^)]*\)/g, "").trim();
    for (const rule of PHOTO_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seenPhotoKeys.has(key)) {
          seenPhotoKeys.add(key);
          photosensitive.push({ rawName: item, sunLevel: rule.level, photo_note: rule.note, photoCategory: rule.photoCategory, isPositionBased: rule.maxPosition !== undefined });
        }
        break;
      }
    }
  }

  // Build sensory trigger list from originalItems using pattern matching
  const sensoryTrigger: SensoryTriggerItem[] = [];
  const seenSensoryKeys = new Set<string>();
  for (let i = 0; i < originalItems.length; i++) {
    const item = originalItems[i];
    const cleaned = item.replace(/\([^)]*\)/g, "").trim();
    for (const rule of SENSORY_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seenSensoryKeys.has(key)) {
          seenSensoryKeys.add(key);
          sensoryTrigger.push({ rawName: item, sensory_note: rule.note, sensory_category: rule.sensory_category, isPositionBased: rule.maxPosition !== undefined });
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

  // Fire-and-forget: keep product_ingredients in sync for any DB-backed product.
  // This is how alternatives and browse get accurate flagged counts — they read the
  // junction table rather than re-running text matching on every request.
  const linkProductId = autoImportedProductId ?? product?.id ?? null;
  if (linkProductId) {
    const pid = linkProductId;
    const seenIds = new Set<string>();
    const rows = [...safeFiltered, ...flagged]
      .filter((m) => !m.ingredient.id.startsWith("comedo-"))
      .filter((m) => { if (seenIds.has(m.ingredient.id)) return false; seenIds.add(m.ingredient.id); return true; })
      .map((m, idx) => ({ product_id: pid, ingredient_id: m.ingredient.id, position: idx + 1 }));
    if (rows.length > 0) {
      import("@/lib/supabase-admin").then(({ supabaseAdmin }) => {
        supabaseAdmin.from("product_ingredients").upsert(rows, { onConflict: "product_id,ingredient_id" }).then(() => {});
      }).catch(() => {});
    }
  }

  // Push unreviewed ingredients into the queue — awaited so the client-side auto-review
  // fires after items are actually in the queue (avoids the "nothing new" race condition).
  if (unreviewed.length > 0) {
    const productName = product?.name ?? null;
    await Promise.all(
      unreviewed.map(async (name) => {
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
    ).catch(() => {});
  }

  const formula_warnings = detectCombinationWarnings(originalItems, flagged.map((f) => ({ flagged_category: f.ingredient.flagged_category })));
  let productIsRinseOff = false;
  if (product?.type) {
    const { data: ptData } = await supabase.from("product_types").select("is_rinse_off").eq("name", product.type).maybeSingle();
    productIsRinseOff = ptData?.is_rinse_off ?? false;
  }
  const step_tags = detectStepTags(originalItems, productIsRinseOff);
  return NextResponse.json({ product, safe: safeFiltered, flagged, unreviewed, photosensitive, sensoryTrigger, communityVariants, obfVariants, originalItems, isIncomplete, formula_warnings, step_tags });
}
