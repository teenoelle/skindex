const JUNK_PATTERNS = [
  /<[a-z]/i,                    // HTML tag remnant
  /\bflavor\b|\bflavour\b/i,    // food term
  /\bfragrance note\b/i,        // perfumery descriptor
  /^https?:\/\//i,              // URL
  /incidecoder\.com/i,
  /:/,                           // colon → directions or header fragment
];

const JUNK_SINGLE_WORDS = new Set([
  "organic", "natural", "pure", "vegan", "silicon", "retinoid",
  "purifying", "hydrating", "moisturizing", "nourishing", "soothing",
  // common list fillers / section headers that appear as single scraped tokens
  "active", "and", "or", "see", "above", "below", "plus", "with", "contains",
]);

// 2-word entries that are clearly descriptor fragments, not ingredient names.
const JUNK_TWO_WORD_PHRASES = new Set([
  "steam distilled",
]);

// Full phrases that are ingredient-list headers or directions, not ingredients.
const JUNK_EXACT_PHRASES = new Set([
  "other ingredients",
  "active ingredients",
  "inactive ingredients",
  "directions",
  "contains",
  "warning",
  "caution",
]);

// Presence of these keywords suggests a long entry might still be a valid botanical INCI name.
const BOTANICAL_KEYWORDS = /\b(extract|oil|water|root|leaf|flower|seed|bark|fruit|butter|powder|juice)\b/i;

export function isLikelyJunk(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 120) return true;
  if (t.length <= 2) return true;                         // single chars, lone symbols
  if (/^\d+$/.test(t)) return true;                       // pure number ("1", "33")
  if (/^[^a-zA-Z0-9]+$/.test(t)) return true;            // pure punctuation ("*", "†‡")
  if (JUNK_PATTERNS.some(p => p.test(t))) return true;
  if (JUNK_EXACT_PHRASES.has(t.toLowerCase())) return true;
  const words = t.split(/\s+/);
  if (/^\d+%/.test(t)) {
    // Short percentage fragments like "100% organic" or "5% niacinamide" are dosage notations,
    // not ingredient names. Longer entries (4+ words) may be valid single-ingredient descriptions.
    if (words.length <= 3) return true;
  } else {
    // Allow up to 14 words for long botanical INCI names; cap everything else at 12.
    const limit = BOTANICAL_KEYWORDS.test(t) ? 14 : 12;
    if (words.length > limit) return true;
  }
  if (words.length === 1 && JUNK_SINGLE_WORDS.has(words[0].toLowerCase())) return true;
  if (words.length === 2 && JUNK_TWO_WORD_PHRASES.has(t.toLowerCase())) return true;
  return false;
}
