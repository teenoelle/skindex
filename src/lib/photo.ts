export const PHOTO_PATTERNS: { pattern: RegExp; level: "avoid" | "caution"; note: string; maxPosition?: number }[] = [
  {
    pattern: /retinol|retinyl palmitate|retinyl acetate|retinaldehyde|tretinoin/i,
    level: "avoid",
    note: "Retinoids accelerate skin cell turnover, which progressively thins the stratum corneum — the skin's protective outer layer. This barrier thinning leaves newly formed cells more vulnerable to UV radiation. Use SPF daily and avoid prolonged sun exposure.",
  },
  {
    pattern: /glycolic acid|lactic acid|mandelic acid|malic acid|tartaric acid/i,
    level: "avoid",
    note: "AHA exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF daily when using.",
  },
  {
    pattern: /citric acid/i,
    level: "avoid",
    note: "At high concentrations (indicated by appearing in the first 10 ingredients), citric acid acts as an AHA exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF daily when using products where it appears high in the ingredient list.",
    maxPosition: 10,
  },
  {
    pattern: /\barbutin\b|alpha.arbutin/i,
    level: "avoid",
    note: "Can break down into hydroquinone on UV exposure, which is photosensitizing and may cause hyperpigmentation on sun-exposed skin. Use SPF daily.",
  },
  {
    pattern: /salicylic acid/i,
    level: "avoid",
    note: "BHA exfoliant that increases skin cell turnover, leaving skin more vulnerable to UV damage. Apply SPF daily when using.",
  },
  {
    pattern: /limonene|citral|bergapten|bergamot|citrus aurantium|citrus limon|citrus sinensis|citrus grandis|citrus paradisi|grapefruit/i,
    level: "avoid",
    note: "Contains furanocoumarins — light-reactive compounds that combine with UV to trigger phototoxic burns and lasting dark patches on exposed skin. Apply only in evening routines and keep treated areas covered from direct sun.",
  },
];

export function countPhotoPatternMatches(ingredientList: string): number {
  const tokens = ingredientList
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\([^)]*\)/g, "").replace(/[​‌‍﻿]/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);

  let count = 0;
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const cleaned = tokens[i].replace(/\([^)]*\)/g, "").trim();
    for (const rule of PHOTO_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seen.has(key)) { seen.add(key); count++; }
        break;
      }
    }
  }
  return count;
}
