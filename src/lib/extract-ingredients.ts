// Extracts product name, brand, and ingredient list from skincare product pages.
// Site-specific parsers for INCIDecoder and iHerb; generic fallback for everything else.

export type ExtractedProduct = {
  ingredients: string;
  name?: string;
  brand?: string;
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(9000),
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

function extractIngredientBlock(text: string): string | null {
  const labelPattern =
    /(?:(?:full|complete|all|other)\s+)?(?:ingredients?(?:\s+list)?|inci(?:\s+list)?|what'?s\s+inside|formula)[\s]*[:：\-]\s*/i;
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch) return null;

  const startPos = labelMatch.index + labelMatch[0].length;
  let candidate = text.slice(startPos, startPos + 4000).trim();

  const sectionBreak =
    /\n\s*(?:[*•·▸►\-]\s*)?(?:directions?|how to use|how to apply|usage|warnings?|cautions?|shelf.?life|storage|disclaimer|about this|certif|reviews?|questions?|customer|contact|return|faq|similar|you may also|related)\b/i;
  const breakMatch = sectionBreak.exec(candidate);
  if (breakMatch && breakMatch.index > 30) candidate = candidate.slice(0, breakMatch.index);

  const dblBreak = /\n\n/.exec(candidate);
  if (dblBreak && dblBreak.index > 50) candidate = candidate.slice(0, dblBreak.index);

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

  // Title format: "Product Name | INCIDecoder" or "Brand Product Name - INCIDecoder"
  const rawTitle = extractRawTitle(html);
  let name: string | undefined;
  let brand: string | undefined = brandFromUrl;

  if (rawTitle) {
    const stripped = rawTitle.replace(/\s*[|–\-]\s*inci\s*decoder.*/i, "").trim();
    if (stripped && stripped !== rawTitle) {
      // If title starts with brand, split it off
      if (brand && stripped.toLowerCase().startsWith(brand.toLowerCase())) {
        name = stripped.slice(brand.length).trim().replace(/^[^a-z0-9]+/i, "") || stripped;
      } else {
        name = stripped;
      }
    }
  }
  if (!name && productSlug) name = slugToTitle(productSlug);

  const text = htmlToText(html);
  const ingredients = extractIngredientBlock(text);
  if (!ingredients) return null;

  return { ingredients, name, brand };
}

function parseIHerb(html: string): ExtractedProduct | null {
  // Title format: "Brand Product Name, Size - iHerb" or "Brand Product Name | iHerb"
  const rawTitle = extractRawTitle(html);
  let name: string | undefined;

  if (rawTitle) {
    const stripped = rawTitle
      .replace(/\s*[-–|]\s*iherb.*/i, "")
      .replace(/,\s*\d+\s*(?:fl\.?\s*oz|oz|ml|g|lb|ct|count|pack|pcs|piece).*$/i, "")
      .trim();
    if (stripped) name = stripped;
  }

  const text = htmlToText(html);
  const ingredients = extractIngredientBlock(text);
  if (!ingredients) return null;

  return { ingredients, name };
}

function parseGeneric(html: string): ExtractedProduct | null {
  const rawTitle = extractRawTitle(html);
  const name = rawTitle ? rawTitle.split(/[|–\-]/)[0].trim() || undefined : undefined;
  const text = htmlToText(html);
  const ingredients = extractIngredientBlock(text);
  if (!ingredients) return null;
  return { ingredients, name };
}

export async function extractIngredientsFromUrl(url: string): Promise<ExtractedProduct | null> {
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
