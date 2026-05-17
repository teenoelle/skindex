// Heuristic extraction of ingredient lists from skincare product web pages.
// No AI required — looks for Ingredients/INCI labels and extracts the following text.

export async function extractIngredientsFromUrl(url: string): Promise<string | null> {
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
    const html = await res.text();
    return extractIngredientText(html);
  } catch {
    return null;
  }
}

export function extractIngredientText(html: string): string | null {
  // Strip scripts/styles; convert block-level elements to newlines to preserve structure
  const text = html
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

  // Find the "Ingredients" (or equivalent) label
  const labelPattern =
    /(?:(?:full|complete|all)\s+)?(?:ingredients?(?:\s+list)?|inci(?:\s+list)?|what'?s\s+inside|formula)[\s]*[:：\-]\s*/i;
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch) return null;

  const startPos = labelMatch.index + labelMatch[0].length;
  let candidate = text.slice(startPos, startPos + 4000).trim();

  // Trim at first section-break keyword (words that won't appear in ingredient names)
  const sectionBreak =
    /\n\s*(?:[*•·▸►\-]\s*)?(?:directions?|how to use|how to apply|usage|warnings?|cautions?|shelf.?life|storage|disclaimer|about this|certif|reviews?|questions?|customer|contact|return|faq|similar|you may also|related)\b/i;
  const breakMatch = sectionBreak.exec(candidate);
  if (breakMatch && breakMatch.index > 30) {
    candidate = candidate.slice(0, breakMatch.index);
  }

  // Also stop at double blank line (new section)
  const dblBreak = /\n\n/.exec(candidate);
  if (dblBreak && dblBreak.index > 50) {
    candidate = candidate.slice(0, dblBreak.index);
  }

  // Handle newline-per-ingredient format (one item per line, no commas)
  const lines = candidate.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  if (lines.length >= 5) {
    const commasInOriginal = (candidate.match(/,/g) ?? []).length;
    const avgLineLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
    if (commasInOriginal < 3 && avgLineLen < 70) {
      candidate = lines.join(", ");
    }
  }

  // Normalize whitespace
  candidate = candidate.replace(/\s+/g, " ").trim();

  // Remove trailing noise like "Read more" or "See full list"
  candidate = candidate.replace(/\s*(?:read more|show more|see (?:full|all|more)|expand|view all)[^,]*$/i, "").trim();

  // Validate: must look like an ingredient list
  const commaCount = (candidate.match(/,/g) ?? []).length;
  if (commaCount < 3 || candidate.length < 50) return null;

  return candidate;
}
