const JUNK_PATTERNS = [
  /<[a-z]/i,                   // HTML tag remnant
  /\bflavor\b|\bflavour\b/i,   // food term
  /\bfragrance note\b/i,       // perfumery descriptor
  /^https?:\/\//i,             // URL
  /incidecoder\.com/i,
];

const JUNK_SINGLE_WORDS = new Set([
  "organic", "natural", "pure", "vegan", "silicon", "retinoid",
  "purifying", "hydrating", "moisturizing", "nourishing", "soothing",
]);

// 2-word entries that are clearly descriptor fragments, not ingredient names.
// Keep this list small — processing descriptors ("cold pressed", "steam distilled")
// are excluded because they are meaningful context when combined with other words.
const JUNK_TWO_WORD_PHRASES = new Set([
  "steam distilled",  // standalone with no ingredient name attached
]);

export function isLikelyJunk(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 120) return true;
  if (JUNK_PATTERNS.some(p => p.test(t))) return true;
  // Percentage fragment from a product description (e.g. "100% pure water")
  if (/^\d+%/.test(t)) return true;
  const words = t.split(/\s+/);
  // More than 6 words → almost certainly a sentence fragment
  if (words.length > 6) return true;
  if (words.length === 1 && JUNK_SINGLE_WORDS.has(words[0].toLowerCase())) return true;
  if (words.length === 2 && JUNK_TWO_WORD_PHRASES.has(t.toLowerCase())) return true;
  return false;
}
