import Fuse from "fuse.js";

/**
 * Splits query into tokens and fuzzy-matches each token against the given keys.
 * All tokens must match (AND logic). Order doesn't matter.
 * Uses Fuse.js for typo tolerance on each token.
 */
export function tokenFuzzyFilter<T>(items: T[], query: string, keys: string[]): T[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return items;

  let remaining = items;
  for (const token of tokens) {
    const fuse = new Fuse(remaining, {
      keys,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    remaining = fuse.search(token).map((r) => r.item);
  }
  return remaining;
}
