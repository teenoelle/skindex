// Extracts product name, brand, and ingredient list from skincare product pages.
// Site-specific parsers for INCIDecoder and iHerb; generic fallback for everything else.

export type ExtractedProduct = {
  ingredients: string;
  name?: string;
  brand?: string;
  type?: string;
};

const PRODUCT_TYPE_PATTERNS: [RegExp, string][] = [
  [/sleeping mask/i, "Sleeping Mask"],
  [/sunscreen|sun\s*screen|sun\s*care|\bspf\b/i, "Sun Screen"],
  [/spot patch|pimple patch|acne patch/i, "Spot Patches"],
  [/eye\s*(cream|gel|serum|treatment)/i, "Eye Cream"],
  [/eye\s*primer/i, "Eye Primer"],
  [/\bbb\s*cream\b/i, "BB Cream"],
  [/\bcc\s*cream\b/i, "CC Cream"],
  [/face\s*mask|sheet\s*mask|clay\s*mask|mud\s*mask/i, "Face Mask"],
  [/face\s*wash|facial\s*wash|foaming\s*cleanser|cleansing\s*foam|cleansing\s*gel|facial\s*cleanser/i, "Face Wash"],
  [/makeup\s*remover|cleansing\s*balm|micellar/i, "Makeup Remover"],
  [/exfoliant|exfoliator|peeling\s*(gel|solution)/i, "Exfoliant"],
  [/\bprimer\b/i, "Primer"],
  [/\bconcealer\b/i, "Concealer"],
  [/\bfoundation\b/i, "Foundation"],
  [/\bmascara\b/i, "Mascara"],
  [/\beyeliner\b/i, "Eyeliner"],
  [/\beyeshadow\b/i, "Eyeshadow"],
  [/\bblush\b/i, "Blush"],
  [/setting\s*spray/i, "Setting Spray"],
  [/\btoner\b|\bessence\b/i, "Toner"],
  [/\bserum\b|\bampoule\b|\bconcentrate\b/i, "Serum"],
  [/\bmist\b|facial\s*mist/i, "Mist"],
  [/body\s*lotion|body\s*cream|body\s*milk/i, "Body Lotion"],
  [/body\s*wash|shower\s*gel/i, "Body Wash"],
  [/hand\s*cream|hand\s*lotion/i, "Hand Cream"],
  [/foot\s*cream/i, "Foot Cream"],
  [/\bdeodorant\b/i, "Deodorant"],
  [/\bshampoo\b/i, "Shampoo"],
  [/\bconditioner\b/i, "Conditioner"],
  [/hair\s*(treatment|mask|serum|oil|therapy)/i, "Hair Treatment"],
  [/\bscalp\b/i, "Scalp Treatment"],
  [/lip\s*balm/i, "Lip Balm"],
  [/lip\s*(treatment|serum|mask|oil)/i, "Lip Treatment"],
  [/moisturiz|day\s*cream|night\s*cream/i, "Moisturizer"],
  [/\bcream\b/i, "Moisturizer"],
  [/\boil\b/i, "Oil"],
  [/\bointment\b|\bbalm\b/i, "Ointment"],
];

export function guessProductType(name: string): string | null {
  for (const [pattern, type] of PRODUCT_TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Referer": "https://www.google.com/",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:li|p|div|h[1-6]|td|tr|section|article|span)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractRawTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&[a-z#0-9]+;/gi, " ").trim() : null;
}

function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Parse JSON-LD structured data for product name and brand
function extractJsonLd(html: string): { name?: string; brand?: string } | null {
  const matches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      const candidates = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of candidates) {
        if (item["@type"] === "Product") {
          return {
            name: typeof item.name === "string" ? item.name.trim() : undefined,
            brand: typeof item.brand?.name === "string" ? item.brand.name.trim()
              : typeof item.brand === "string" ? item.brand.trim() : undefined,
          };
        }
      }
    } catch { continue; }
  }
  return null;
}

// Extract the innerHTML of the first element whose class matches a pattern
function extractHtmlByClass(html: string, classPattern: string): string | null {
  const re = new RegExp(`<[a-z][^>]*class="[^"]*${classPattern}[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractIngredientBlock(text: string): string | null {
  const labelPattern =
    /(?:(?:full|complete|all|other)\s+)?(?:ingredients?(?:\s+list)?|inci(?:\s+list)?|what'?s\s+inside|formula)[\s]*[:：\-]?\s*/i;
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch) return null;

  const startPos = labelMatch.index + labelMatch[0].length;
  let candidate = text.slice(startPos, startPos + 6000).trim();

  const sectionBreak =
    /\n\s*(?:[*•·▸►\-]\s*)?(?:directions?|how to use|how to apply|usage|warnings?|cautions?|shelf.?life|storage|disclaimer|about this|certif|reviews?|questions?|customer|contact|return|faq|similar|you may also|related|product details|overview|description)\b/i;
  const breakMatch = sectionBreak.exec(candidate);
  if (breakMatch && breakMatch.index > 30) candidate = candidate.slice(0, breakMatch.index);

  const dblBreak = /\n\n/.exec(candidate);
  if (dblBreak && dblBreak.index > 100) candidate = candidate.slice(0, dblBreak.index);

  const lines = candidate.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  if (lines.length >= 5) {
    const commasInOriginal = (candidate.match(/,/g) ?? []).length;
    const avgLineLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
    if (commasInOriginal < 3 && avgLineLen < 70) candidate = lines.join(", ");
  }

  candidate = candidate.replace(/\s+/g, " ").trim();
  candidate = candidate.replace(/\s*(?:read more|show more|see (?:full|all|more)|expand|view all)[^,]*$/i, "").trim();

  const commaCount = (candidate.match(/,/g) ?? []).length;
  if (commaCount < 3 || candidate.length < 50) return null;

  return candidate;
}

function parseINCIDecoder(html: string, url: string): ExtractedProduct | null {
  // URL: incidecoder.com/products/brand-slug/product-slug
  const urlMatch = url.match(/incidecoder\.com\/products\/([^/?#]+)(?:\/([^/?#]+))?/i);
  const brandSlug = urlMatch?.[1] ?? null;
  const productSlug = urlMatch?.[2] ?? null;
  const brandFromUrl = brandSlug ? slugToTitle(brandSlug) : undefined;

  // JSON-LD has the real brand name (not a slug); prefer it over URL-derived brand
  const jsonLd = extractJsonLd(html);
  let brand: string | undefined = jsonLd?.brand ?? brandFromUrl;

  // Name from title: "Product Name | INCIDecoder"
  const rawTitle = extractRawTitle(html);
  let name: string | undefined = jsonLd?.name;

  if (!name && rawTitle) {
    const stripped = rawTitle.replace(/\s*[|–\-]\s*inci\s*decoder.*/i, "").trim();
    if (stripped && stripped !== rawTitle) {
      // Keep the full title (brand + product) for better searchability;
      // brand is stored separately so display can de-duplicate if needed.
      name = stripped;
    }
  }
  if (!name && productSlug) name = slugToTitle(productSlug);

  // Strategy 1: INCIDecoder renders ingredients in a div with "ingred" in the class
  let ingredients: string | null = null;
  const ingredHtml = extractHtmlByClass(html, "ingred");
  if (ingredHtml) {
    const ingredText = htmlToText(ingredHtml).replace(/\s+/g, " ").trim();
    const commaCount = (ingredText.match(/,/g) ?? []).length;
    if (commaCount >= 3 && ingredText.length >= 50) ingredients = ingredText;
  }

  // Strategy 2: generic label search in full page text
  if (!ingredients) {
    const text = htmlToText(html);
    ingredients = extractIngredientBlock(text);
  }

  if (!ingredients) return null;
  const type = guessProductType(name ?? "") ?? undefined;
  return { ingredients, name, brand, type };
}

// iHerb embeds product data as JSON in script tags (Vue SSR / app state)
function extractIHerbEmbeddedJson(html: string): string | null {
  // Look for ingredient fields in any inline JSON blob
  const FIELD_PATTERN = /"(?:ingredients|ingredientList|ingredientsList|otherIngredients|other_ingredients|skinIngredients)"\s*:\s*"((?:[^"\\]|\\.)*)"/gi;
  let best: string | null = null;
  let bestCommas = 2;
  for (const m of html.matchAll(FIELD_PATTERN)) {
    const raw = m[1].replace(/\\n/g, " ").replace(/\\t/g, " ").replace(/\\"/g, '"').replace(/\\u[\da-f]{4}/gi, " ").trim();
    const commas = (raw.match(/,/g) ?? []).length;
    if (commas > bestCommas && raw.length >= 50) {
      best = raw;
      bestCommas = commas;
    }
  }
  return best;
}

function parseIHerb(html: string): ExtractedProduct | null {
  // Try JSON-LD first — iHerb includes Product schema
  const jsonLd = extractJsonLd(html);

  // Title: "Brand Product Name, Size - iHerb"
  const rawTitle = extractRawTitle(html);
  let name: string | undefined = jsonLd?.name;
  const brand: string | undefined = jsonLd?.brand;

  if (!name && rawTitle) {
    name = rawTitle
      .replace(/\s*[-–|]\s*iherb.*/i, "")
      .replace(/,\s*\d+\s*(?:fl\.?\s*oz|oz|ml|g|lb|ct|count|pack|pcs|piece).*$/i, "")
      .trim() || undefined;
  }

  // Strategy 1: look for ingredient data in embedded JSON (Vue SSR / app state)
  let ingredients: string | null = extractIHerbEmbeddedJson(html);

  // Strategy 2: iHerb's ingredient section by class (several possible class names)
  if (!ingredients) {
    for (const cls of ["supplement-ingredient", "ingredient", "product-ingredient", "cosmetic-ingredient"]) {
      const ingredHtml = extractHtmlByClass(html, cls);
      if (ingredHtml) {
        const ingredText = htmlToText(ingredHtml).replace(/\s+/g, " ").trim();
        const commaCount = (ingredText.match(/,/g) ?? []).length;
        if (commaCount >= 3 && ingredText.length >= 50) { ingredients = ingredText; break; }
      }
    }
  }

  // Strategy 3: generic label search
  if (!ingredients) {
    const text = htmlToText(html);
    ingredients = extractIngredientBlock(text);
  }

  if (!ingredients) return null;
  const type = guessProductType(name ?? "") ?? undefined;
  return { ingredients, name, brand, type };
}

function parseGeneric(html: string): ExtractedProduct | null {
  const jsonLd = extractJsonLd(html);
  const rawTitle = extractRawTitle(html);
  const name = jsonLd?.name ?? (rawTitle ? rawTitle.split(/[|–\-]/)[0].trim() || undefined : undefined);
  const brand = jsonLd?.brand;
  const text = htmlToText(html);
  const ingredients = extractIngredientBlock(text);
  if (!ingredients) return null;
  const type = guessProductType(name ?? "") ?? undefined;
  return { ingredients, name, brand, type };
}

export async function extractIngredientsFromUrl(rawUrl: string): Promise<ExtractedProduct | null> {
  // Normalize regional iHerb subdomains (il.iherb.com, de.iherb.com, etc.) to www.iherb.com
  const url = rawUrl.replace(/https?:\/\/(?!www\.)[a-z]{2,3}\.iherb\.com/i, "https://www.iherb.com");

  const html = await fetchHtml(url);
  if (!html) return null;

  try {
    const lower = url.toLowerCase();
    if (lower.includes("incidecoder.com")) return parseINCIDecoder(html, url);
    if (lower.includes("iherb.com")) return parseIHerb(html);
    return parseGeneric(html);
  } catch {
    return null;
  }
}

// Legacy text-only export (used by existing scripts)
export function extractIngredientText(html: string): string | null {
  const text = htmlToText(html);
  return extractIngredientBlock(text);
}
