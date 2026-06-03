// Universal concern categories — flagged for everyone regardless of skin profile.
// Kept in a shared lib so all APIs (scan, alternatives, browse, lists) stay in sync.
export const UNIVERSAL_CONCERN_CATS = [
  "fragrance-allergen",
  "preservative-allergen",
  "formaldehyde releaser",
  "sensitizing preservative",
  "biocide",
];

export const UNIVERSAL_CONCERN_SET = new Set(UNIVERSAL_CONCERN_CATS);
