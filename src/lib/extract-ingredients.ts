// Extracts product name, brand, and ingredient list from skincare product pages.
// Site-specific parsers for INCIDecoder and iHerb; generic fallback for everything else.

export type ExtractedProduct = {
  ingredients: string;
  name?: string;
  brand?: string;
  type?: string;
  iherb_url?: string;
  image_url?: string;
};

// tier 1 = specific use-case (wins over tier 2 when both match, e.g. "Deodorant Serum" → Deodorant)
// tier 2 = texture / format descriptor (generic fallback)
const PRODUCT_TYPE_PATTERNS: [RegExp, string, number][] = [
  [/sleeping mask/i, "Sleeping Mask", 1],
  [/sunscreen|sun\s*screen|sun\s*care|\bspf\b/i, "Sun Screen", 1],
  [/spot patch|pimple patch|acne patch/i, "Spot Patches", 1],
  [/eye\s*(cream|gel|serum|treatment)/i, "Eye Cream", 1],
  [/eye\s*primer/i, "Eye Primer", 1],
  [/\bbb\s*cream\b/i, "BB Cream", 1],
  [/\bcc\s*cream\b/i, "CC Cream", 1],
  [/face\s*mask|sheet\s*mask|clay\s*mask|mud\s*mask/i, "Face Mask", 1],
  [/face\s*wash|facial\s*wash|foaming\s*cleanser|cleansing\s*foam|cleansing\s*gel|facial\s*cleanser/i, "Face Wash", 1],
  [/makeup\s*remover|cleansing\s*balm|micellar/i, "Makeup Remover", 1],
  [/exfoliant|exfoliator|peeling\s*(gel|solution)/i, "Exfoliant", 1],
  [/\bprimer\b/i, "Primer", 1],
  [/\bconcealer\b/i, "Concealer", 1],
  [/\bfoundation\b/i, "Foundation", 1],
  [/\bmascara\b/i, "Mascara", 1],
  [/\beyeliner\b/i, "Eyeliner", 1],
  [/\beyeshadow\b/i, "Eyeshadow", 1],
  [/\bblush\b/i, "Blush", 1],
  [/setting\s*spray/i, "Setting Spray", 1],
  [/body\s*lotion|body\s*cream|body\s*milk/i, "Body Lotion", 1],
  [/body\s*wash|shower\s*gel/i, "Body Wash", 1],
  [/hand\s*cream|hand\s*lotion/i, "Hand Cream", 1],
  [/foot\s*cream/i, "Foot Cream", 1],
  [/\bdeodorant\b/i, "Deodorant", 1],
  [/\bshampoo\b/i, "Shampoo", 1],
  [/\bconditioner\b/i, "Conditioner", 1],
  [/hair\s*(treatment|mask|serum|oil|therapy)/i, "Hair Treatment", 1],
  [/\bscalp\b/i, "Scalp Treatment", 1],
  [/lip\s*balm/i, "Lip Balm", 1],
  [/lip\s*(treatment|serum|mask|oil)/i, "Lip Treatment", 1],
  [/\btoner\b|\bessence\b/i, "Toner", 2],
  [/\bserum\b|\bampoule\b|\bconcentrate\b/i, "Serum", 2],
  [/\bmist\b|facial\s*mist/i, "Mist", 2],
  [/moisturiz|day\s*cream|night\s*cream/i, "Moisturizer", 2],
  [/\bcream\b/i, "Moisturizer", 2],
  [/\boil\b/i, "Oil", 2],
  [/\bointment\b|\bbalm\b/i, "Ointment", 2],
];

export function guessProductType(name: string): string | null {
  let best: string | null = null;
  let bestTier = Infinity;
  for (const [pattern, type, tier] of PRODUCT_TYPE_PATTERNS) {
    if (pattern.test(name) && tier < bestTier) { best = type; bestTier = tier; }
  }
  return best;
}

async function fetchHtml(
  url: string,
  onStatus?: (status: number) => void,
  onError?: (err: string) => void
): Promise<string | null> {
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
    onStatus?.(res.status);
    if (!res.ok) return null;
    return res.text();
  } catch (e) {
    onError?.(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
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
  return m ? m[1]
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim() : null;
}

function slugToTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Maps raw category strings (breadcrumbs, JSON-LD, OBF tags) to canonical product types.
const CATEGORY_TO_TYPE: [RegExp, string][] = [
  [/deodor|antiperspirant|underarm/i, "Deodorant"],
  [/shampoo/i, "Shampoo"],
  [/conditioner/i, "Conditioner"],
  [/scalp/i, "Scalp Treatment"],
  [/body\s*wash|shower\s*gel/i, "Body Wash"],
  [/body\s*(lotion|cream|milk|butter)/i, "Body Lotion"],
  [/hand\s*(cream|lotion)/i, "Hand Cream"],
  [/foot\s*cream/i, "Foot Cream"],
  [/sleeping\s*mask/i, "Sleeping Mask"],
  [/sheet\s*mask|face\s*mask|clay\s*mask|mud\s*mask/i, "Face Mask"],
  [/sunscreen|sun\s*cream|sun\s*care|\bspf\b|sun\s*protect/i, "Sun Screen"],
  [/spot\s*patch|pimple\s*patch|acne\s*patch/i, "Spot Patches"],
  [/eye\s*(cream|gel|serum|treatment|care)/i, "Eye Cream"],
  [/lip\s*balm/i, "Lip Balm"],
  [/lip\s*(treatment|serum|mask|oil|care)/i, "Lip Treatment"],
  [/face\s*wash|facial\s*(wash|cleanser)|foaming\s*cleanser|cleansing\s*(foam|gel)/i, "Face Wash"],
  [/makeup\s*remover|cleansing\s*balm|micellar/i, "Makeup Remover"],
  [/exfoliant|exfoliator|peeling/i, "Exfoliant"],
  [/\bbb\s*cream\b/i, "BB Cream"],
  [/\bcc\s*cream\b/i, "CC Cream"],
  [/\bprimer\b/i, "Primer"],
  [/\bfoundation\b/i, "Foundation"],
  [/\bconcealer\b/i, "Concealer"],
  [/\bmascara\b/i, "Mascara"],
  [/\beyeliner\b/i, "Eyeliner"],
  [/\beyeshadow\b/i, "Eyeshadow"],
  [/\bblush\b/i, "Blush"],
  [/setting\s*spray/i, "Setting Spray"],
  [/hair\s*(treatment|mask|oil|therapy|care)/i, "Hair Treatment"],
  [/\btoner\b|\bessence\b/i, "Toner"],
  [/\bserum\b|\bampoule\b/i, "Serum"],
  [/\bmist\b/i, "Mist"],
  [/moisturiz|day\s*cream|night\s*cream/i, "Moisturizer"],
  [/\bcream\b/i, "Moisturizer"],
  [/\boil\b/i, "Oil"],
  [/\bointment\b|\bbalm\b/i, "Ointment"],
];

export function mapCategoryToType(raw: string): string | null {
  for (const [pattern, type] of CATEGORY_TO_TYPE) {
    if (pattern.test(raw)) return type;
  }
  return null;
}

// Scans HTML nav/ol/ul breadcrumb for the most specific recognisable category.
function extractBreadcrumbCategory(html: string): string | null {
  const containerMatch = html.match(
    /<(?:nav|ol|ul)[^>]*(?:breadcrumb|crumb)[^>]*>([\s\S]*?)<\/(?:nav|ol|ul)>/i
  );
  if (!containerMatch) return null;
  const items: string[] = [];
  for (const m of containerMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)) {
    const t = m[1]
      .replace(/&amp;/g, "&").replace(/&#39;|&apos;/gi, "'")
      .replace(/&[a-z#0-9]+;/gi, " ").trim();
    if (t && !/^home$/i.test(t)) items.push(t);
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const type = mapCategoryToType(items[i]);
    if (type) return type;
  }
  return null;
}

// Body-location / action phrases found in usage directions that imply a product category.
const USAGE_TYPE_PATTERNS: [RegExp, string][] = [
  [/underarm|armpit/i, "Deodorant"],
  [/\bscalp\b/i, "Scalp Treatment"],
  [/lather.*hair|wet.*hair|work.*(?:into|through).*hair/i, "Shampoo"],
  [/massage.*into.*hair|apply.*to.*(?:dry\s+)?hair.*leave/i, "Hair Treatment"],
  [/around\s+(?:the\s+)?eye|eye\s+(?:area|contour|zone)|orbital|lash\s*line/i, "Eye Cream"],
  [/leave\s+on\s+overnight|last\s+step.*night|sleeping\s+pack/i, "Sleeping Mask"],
  [/\blips?\b|lip\s+area/i, "Lip Treatment"],
  [/before\s+sun\s+exposure|reapply\s+(?:every|after)|protect.*(?:uva|uvb)/i, "Sun Screen"],
  [/apply\s+to\s+(?:clean\s+)?(?:dry\s+)?body|after\s+(?:shower|bath).*(?:body|skin)/i, "Body Lotion"],
  [/under\s+(?:your\s+)?makeup|before\s+(?:applying\s+)?foundation|as\s+(?:a\s+)?primer/i, "Primer"],
  [/spot\s+treat|directly\s+on\s+(?:blemish|pimple|spot)/i, "Spot Patches"],
  [/lather.*rinse|use\s+as\s+(?:a\s+)?(?:facial\s+)?cleanser/i, "Face Wash"],
];

// Finds the usage/directions section in page text and returns the implied product type.
function extractUsageType(text: string): string | null {
  const labelMatch = /(?:how\s+to\s+use|directions?|application|how\s+to\s+apply|usage\s*:)/i.exec(text);
  if (!labelMatch) return null;
  const start = labelMatch.index + labelMatch[0].length;
  const block = text.slice(start, start + 800);
  for (const [pattern, type] of USAGE_TYPE_PATTERNS) {
    if (pattern.test(block)) return type;
  }
  return null;
}

// INCIDecoder pages include a product-type label in page metadata — extract it from the HTML.
function extractINCIDecoderType(html: string): string | null {
  const preview = html.slice(0, 12000);
  const m = preview.match(
    /product[\s\-_]*type[^:]*:\s*(?:<[^>]*>)?([^<\n,]{2,40})(?:<|,|\n)/i
  );
  if (m) return mapCategoryToType(m[1].trim());
  return null;
}

// Parse JSON-LD structured data for product name, brand, and category.
function extractJsonLd(html: string): { name?: string; brand?: string; category?: string } | null {
  const matches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const out: { name?: string; brand?: string; category?: string } = {};
  let found = false;
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      const candidates = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of candidates) {
        if (item["@type"] === "Product") {
          found = true;
          if (!out.name && typeof item.name === "string") out.name = item.name.trim();
          if (!out.brand) {
            const b = typeof item.brand?.name === "string" ? item.brand.name.trim()
              : typeof item.brand === "string" ? item.brand.trim() : undefined;
            if (b) out.brand = b;
          }
          if (!out.category && typeof item.category === "string") out.category = item.category.trim();
        }
        // BreadcrumbList — scan from most-specific to least for a recognisable type
        if (!out.category && item["@type"] === "BreadcrumbList" && Array.isArray(item.itemListElement)) {
          const sorted = [...item.itemListElement].sort(
            (a: { position?: number }, b: { position?: number }) => (b.position ?? 0) - (a.position ?? 0)
          );
          for (const li of sorted) {
            const n = typeof li.name === "string" ? li.name
              : typeof li.item?.name === "string" ? li.item.name : null;
            if (n && mapCategoryToType(n)) { out.category = n.trim(); found = true; break; }
          }
        }
      }
    } catch { continue; }
  }
  return found ? out : null;
}

// Extract content after the first element whose class matches a pattern.
// Takes a generous chunk so nested tags don't truncate the result.
function extractHtmlByClass(html: string, classPattern: string): string | null {
  const re = new RegExp(`<[a-z][^>]*class="[^"]*${classPattern}[^"]*"[^>]*>`, "i");
  const m = html.match(re);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  return html.slice(start, start + 30000);
}

function extractIngredientBlock(text: string): string | null {
  const labelPattern =
    /(?:(?:full|complete|all|other)\s+)?(?:ingredients?(?:\s+list)?|inci(?:\s+list)?|what'?s\s+inside|formula)[\s]*[:：\-]?\s*/i;
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch) return null;

  const startPos = labelMatch.index + labelMatch[0].length;
  let candidate = text.slice(startPos, startPos + 20000).trim();

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

  candidate = candidate.replace(/\[(?:more|less)\]/gi, " ").replace(/\s+/g, " ").trim();
  candidate = candidate
    .replace(/\s*Read more on how to read an ingredient list\s*>>.*/gi, "")
    .replace(/\s*(?:read more|show more|see (?:full|all|more)|expand|view all)[^,]*$/i, "")
    .trim();

  // Replace inline section-header labels with a comma separator so they don't corrupt the preceding token.
  // e.g. "Zinc Oxide (14.5%) Inactive Ingredients: Bentonite" → "Zinc Oxide (14.5%), Bentonite"
  candidate = candidate
    .replace(/\s*\b(?:active|inactive|other)\s+ingredients?\s*:\s*/gi, ", ")
    .replace(/^,\s*/, "");

  const commaCount = (candidate.match(/,/g) ?? []).length;
  if (commaCount < 2 || candidate.length < 50) return null;

  return candidate;
}

function parseINCIDecoder(html: string, url: string): ExtractedProduct | null {
  // URL: incidecoder.com/products/brand-slug/product-slug  (two segments)
  //   or incidecoder.com/products/brand-product-slug       (one segment)
  const urlMatch = url.match(/incidecoder\.com\/products\/([^/?#]+)(?:\/([^/?#]+))?/i);
  const brandSlug = urlMatch?.[1] ?? null;
  const productSlug = urlMatch?.[2] ?? null;
  const brandFromUrl = brandSlug ? slugToTitle(brandSlug) : undefined;

  const jsonLd = extractJsonLd(html);

  // Strategy: HTML brand link (INCIDecoder shows the brand as a link to /brands/{slug})
  // This is the most reliable source — it's the display name shown above the product title.
  let brand: string | undefined;
  const brandLinkMatch = html.match(/<a[^>]+href="[^"]*\/brands\/[^"]*"[^>]*>([^<]+)<\/a>/i);
  if (brandLinkMatch) {
    brand = brandLinkMatch[1]
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .trim() || undefined;
  }
  // Fallback: JSON-LD brand if it's not the site name
  if (!brand) {
    const jsonLdBrand = jsonLd?.brand?.trim();
    if (jsonLdBrand && !/^incidecoder/i.test(jsonLdBrand)) brand = jsonLdBrand;
  }
  // Fallback: URL slug brand for two-segment URLs
  if (!brand && productSlug) brand = brandFromUrl;

  // Prefer title tag — it has proper casing ("TIA'M") that JSON-LD often lacks
  const rawTitle = extractRawTitle(html);
  let name: string | undefined;
  if (rawTitle) {
    const stripped = rawTitle
      .replace(/\s*[|–\-]\s*inci\s*decoder.*/i, "")
      .replace(/\s*[-–]\s*ingredients?\s+explained.*/i, "")
      .trim();
    if (stripped && stripped !== rawTitle) name = stripped;
  }
  if (!name) name = jsonLd?.name;
  if (!name && productSlug) name = slugToTitle(productSlug);
  // For one-segment URLs (e.g. "tiam-vita-b3-mist-toner"), strip the brand prefix
  // from the slug to derive the product name ("Vita B3 Mist Toner").
  if (!name && !productSlug && brandSlug && brand) {
    const brandNorm = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
    const parts = brandSlug.split("-");
    let consumed = 0;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      acc += parts[i].replace(/[^a-z0-9]/g, "");
      if (acc === brandNorm) { consumed = i + 1; break; }
      if (!brandNorm.startsWith(acc)) break;
    }
    if (consumed > 0 && consumed < parts.length) {
      name = parts.slice(consumed).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  // Strategy 1: INCIDecoder renders the ingredient list in an "ingred" div.
  // The list is split by [more]/[less] toggle markers, but the full text is present in the HTML.
  // Non-ingredient content (Warning, action buttons, Highlights, Key Ingredients) follows
  // the list inside the same div and must be cut.
  let ingredients: string | null = null;
  const ingredHtml = extractHtmlByClass(html, "ingred");
  if (ingredHtml) {
    let candidate = htmlToText(ingredHtml);
    // Remove [more]/[less] toggle markers (they are UI controls, not ingredient names)
    candidate = candidate.replace(/\[more\]/gi, "").replace(/\[less\]/gi, "");
    // Cut at the first non-ingredient section keyword
    const sectionIdx = candidate.search(
      /\b(?:Warning[s]?|Save\s+to\s+list|Compare\b|Report\s+Error|Embed\b|Highlights?[:\s#]|Key\s+Ingredients?[:\s#]|Read\s+more\s+on\s+how)\b/i
    );
    if (sectionIdx > 50) candidate = candidate.slice(0, sectionIdx);
    // Strip any heading ("Ingredients overview") that precedes the actual list
    candidate = candidate.replace(/^[\s\S]*?Ingredients\s+overview\s*/i, "");
    // Strip any usage directions preamble before the "Ingredients :" label
    // e.g. "Develops. Allow To Dry Before Dressing. Ingredients : Aqua, ..."
    const innerLabelIdx = candidate.search(/\bIngredients?\s*[:\-]\s*/i);
    if (innerLabelIdx > 0) {
      candidate = candidate.slice(innerLabelIdx).replace(/^\bIngredients?\s*[:\-]\s*/i, "");
    }
    candidate = candidate.replace(/\s+/g, " ").trim();
    const commaCount = (candidate.match(/,/g) ?? []).length;
    if (commaCount >= 2 && candidate.length >= 50) ingredients = candidate;
  }

  // Strategy 2: generic label search in full page text
  const pageText = htmlToText(html);
  if (!ingredients) ingredients = extractIngredientBlock(pageText);

  if (!ingredients) return null;

  // Type: priority chain — INCIDecoder field → JSON-LD category → breadcrumb → usage text → name
  const type = (
    extractINCIDecoderType(html) ??
    (jsonLd?.category ? mapCategoryToType(jsonLd.category) : null) ??
    extractBreadcrumbCategory(html) ??
    extractUsageType(pageText) ??
    guessProductType(name ?? "")
  ) ?? undefined;

  // iHerb URL: INCIDecoder shows a "Buy this product" section with retailer links
  const iherb_url = extractIHerbLinkFromHtml(html) ?? undefined;

  // Product image: prefer og:image meta tag; fall back to Google Cloud Storage img src
  const image_url = extractINCIDecoderImage(html) ?? undefined;

  return { ingredients, name, brand, type, iherb_url, image_url };
}

function extractOgImage(html: string): string | null {
  const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)
    ?? html.match(/<meta[^>]+name="twitter:image(?::src)?"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+name="twitter:image(?::src)?"/i);
  const u = m?.[1]?.replace(/&amp;/g, "&");
  return u?.startsWith("http") ? u : null;
}

function inciDecoderGcsToOriginal(url: string): string {
  // Covers: _300x300@1x.webp  _300x300.webp  .300x300.webp  _thumb.webp  _small.jpeg  etc.
  return url
    .replace(/[_.](\d+x\d+(?:@[\dx]+)?)\.[a-z]+$/i, "_original.jpeg")  // sized variants
    .replace(/[_.](thumb|small|medium|large|full)\.[a-z]+$/i, "_original.jpeg"); // named sizes
}

function bestSrcsetUrl(srcset: string): string {
  // Parse "url descriptor, url descriptor, ..." and return the URL with the highest descriptor.
  // Descriptors are either "Nw" (width) or "Nx" (density) — higher wins.
  let bestUrl = "";
  let bestValue = -1;
  for (const entry of srcset.split(",")) {
    const parts = entry.trim().split(/\s+/);
    const url = parts[0];
    if (!url) continue;
    const descriptor = parts[1] ?? "1x";
    const m = descriptor.match(/^(\d+(?:\.\d+)?)(w|x)$/);
    const value = m ? parseFloat(m[1]) : 1;
    if (value > bestValue) { bestValue = value; bestUrl = url; }
  }
  return bestUrl;
}

function extractINCIDecoderImage(html: string): string | null {
  // INCIDecoder renders images in a <picture><source srcset="..."> element on the GCS bucket.
  // og:image is absent in server-rendered HTML; the srcset URL is the reliable source.
  const m1 = html.match(/srcset="(https:\/\/incidecoder-content\.storage\.googleapis\.com\/[^"]+)"/i);
  if (m1?.[1]) {
    const url = bestSrcsetUrl(m1[1].replace(/&amp;/g, "&"));
    if (url) return inciDecoderGcsToOriginal(url);
  }
  // Fallback: plain src attribute (older page format)
  const m2 = html.match(/src="(https:\/\/incidecoder-content\.storage\.googleapis\.com\/[^"]+)"/i);
  if (m2) return inciDecoderGcsToOriginal(m2[1].replace(/&amp;/g, "&"));
  return null;
}

function extractIHerbLinkFromHtml(html: string): string | null {
  // Match any href that points to an iherb.com product page (/pr/ path)
  const pattern = /href="(https?:\/\/(?:[a-z]{2,3}\.)?iherb\.com\/pr\/[^"?#]+(?:\?[^"]*)?)"/gi;
  const match = pattern.exec(html);
  if (!match) return null;
  try {
    const u = new URL(match[1]);
    u.hostname = "www.iherb.com";   // normalise regional subdomain
    u.searchParams.delete("rcode"); // strip any existing rcode — ours is appended at display time
    return u.toString();
  } catch {
    return match[1].replace(/https?:\/\/(?!www\.)[a-z]{2,3}\.iherb\.com/i, "https://www.iherb.com");
  }
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
  const pageText = htmlToText(html);
  if (!ingredients) ingredients = extractIngredientBlock(pageText);

  if (!ingredients) return null;

  // Type: JSON-LD category → breadcrumb → usage text → name
  const type = (
    (jsonLd?.category ? mapCategoryToType(jsonLd.category) : null) ??
    extractBreadcrumbCategory(html) ??
    extractUsageType(pageText) ??
    guessProductType(name ?? "")
  ) ?? undefined;

  const image_url = extractOgImage(html) ?? undefined;

  return { ingredients, name, brand, type, image_url };
}

function parseGeneric(html: string): ExtractedProduct | null {
  const jsonLd = extractJsonLd(html);
  const rawTitle = extractRawTitle(html);
  const name = jsonLd?.name ?? (rawTitle ? rawTitle.split(/[|–\-]/)[0].trim() || undefined : undefined);
  const brand = jsonLd?.brand;
  const text = htmlToText(html);
  const ingredients = extractIngredientBlock(text);
  if (!ingredients) return null;

  // Type: JSON-LD category → breadcrumb → usage text → name
  const type = (
    (jsonLd?.category ? mapCategoryToType(jsonLd.category) : null) ??
    extractBreadcrumbCategory(html) ??
    extractUsageType(text) ??
    guessProductType(name ?? "")
  ) ?? undefined;

  const image_url = extractOgImage(html) ?? undefined;

  return { ingredients, name, brand, type, image_url };
}

export async function extractIngredientsFromUrl(rawUrl: string): Promise<ExtractedProduct | null> {
  const { product } = await extractIngredientsFromUrlWithStatus(rawUrl);
  return product;
}

export async function extractIngredientsFromUrlWithStatus(
  rawUrl: string
): Promise<{ product: ExtractedProduct | null; httpStatus: number | null; fetchError?: string }> {
  const url = rawUrl.replace(/https?:\/\/(?!www\.)[a-z]{2,3}\.iherb\.com/i, "https://www.iherb.com");

  let httpStatus: number | null = null;
  let fetchError: string | undefined;
  const html = await fetchHtml(url, (s) => { httpStatus = s; }, (e) => { fetchError = e; });
  if (!html) return { product: null, httpStatus, fetchError };

  try {
    const lower = url.toLowerCase();
    let product: ExtractedProduct | null = null;
    if (lower.includes("incidecoder.com")) product = parseINCIDecoder(html, url);
    else if (lower.includes("iherb.com")) product = parseIHerb(html);
    else product = parseGeneric(html);
    return { product, httpStatus };
  } catch (e) {
    return { product: null, httpStatus, fetchError: e instanceof Error ? e.message : String(e) };
  }
}

// Legacy text-only export (used by existing scripts)
export function extractIngredientText(html: string): string | null {
  const text = htmlToText(html);
  return extractIngredientBlock(text);
}
