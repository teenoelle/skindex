/**
 * Shared server-safe utility for computing per-product concern counts.
 * One source of truth — mirrors getIngredientConcernLevel() in Scanner.tsx.
 * Used by: lists API, scan DYM enrichment, alternatives API.
 */
import { UNIVERSAL_CONCERN_SET } from "@/lib/concern-breakdown";
import { COMEDOGENIC_PATTERNS } from "@/lib/comedogenic";
import { SENSORY_PATTERNS, SENSORY_PROFILE_MAP } from "@/lib/sensory";
import { PHOTO_PATTERNS } from "@/lib/photo";

export type IngredientRow = {
  id: string;
  name: string;
  inci_name: string | null;
  status: string;
  flagged_category: string | null;
  structural_category: string | null;
};

export type ProductConcernCounts = {
  flaggedCount: number;
  sensoryCount: number;
  photoCount: number;
  universalConcernCount: number;
  profileMatchedCount: number | undefined;
};

// Rinse-off product types — suppress occlusive/pore-clogging concerns
const RINSE_OFF_TYPES = new Set([
  "Face Wash", "Cleanser", "Micellar Cleanser", "Micellar Water", "Cleansing Balm",
  "Makeup Remover", "Body Wash", "Hand Wash", "Shampoo", "Conditioner", "Hair Mask",
  "Face Mask", "Scalp Scrub", "Exfoliating Scrub", "Facial Scrub", "Body Scrub",
  "Exfoliant", "Clay Mask", "Rinse-Off Mask",
]);
const RINSE_OFF_SUPPRESS_CATS = new Set(["pore-clogger", "occlusive", "bacteria-trap"]);

function parseIngredientTokens(raw: string): string[] {
  return raw
    .split(/,(?![^(]*\))/)
    .map((s) =>
      s
        .replace(/\([^)]*\)/g, "")
        .replace(/[​‌‍﻿]/g, "")
        .trim()
        .replace(/\s+/g, " ")
    )
    .filter((s) => s.length > 1);
}

/**
 * Compute concern counts for a product ingredient list.
 *
 * @param ingredientList     Raw ingredient list string (comma-separated)
 * @param allIngredients     All ingredients from the DB (must include structural_category)
 * @param profileConcernsSet Set of flagged_category values matching the user's profile
 * @param skinTypes          User's selected skin types (for sensory profile matching)
 * @param climates           User's selected climates (for sensory profile matching)
 * @param productType        Product type string — used to suppress pore-clogger for rinse-offs
 */
export function computeProductConcerns(
  ingredientList: string,
  allIngredients: IngredientRow[],
  profileConcernsSet: Set<string>,
  skinTypes: string[] = [],
  climates: string[] = [],
  productType?: string | null,
): ProductConcernCounts {
  const hasProfile = profileConcernsSet.size > 0 || skinTypes.length > 0 || climates.length > 0;
  const skinTypeSet = new Set(skinTypes);
  const climateSet = new Set(climates);
  const isRinseOff = !!productType && RINSE_OFF_TYPES.has(productType);

  const tokens = parseIngredientTokens(ingredientList);
  const dbFlaggedNames = new Set<string>(); // track matched names to dedup pattern matching

  let dbFlaggedCount = 0;
  let universalConcernCount = 0;
  let profileMatchedCount = 0;

  // ── DB ingredient matching ─────────────────────────────────────────────────
  // Same algorithm as matchIngredients() in @/lib/scanner.ts
  for (const token of tokens) {
    const lower = token.toLowerCase();
    const match = allIngredients.find((ing) => {
      const n = ing.name.toLowerCase();
      const i = ing.inci_name?.toLowerCase();
      const tokenLong = lower.length >= 6;
      return (
        lower.includes(n) ||
        (tokenLong && n.includes(lower)) ||
        (i && (lower.includes(i) || (tokenLong && i.includes(lower))))
      );
    });
    if (match && match.status === "flagged") {
      const cat = match.flagged_category as string | null;
      const struct = match.structural_category as string | null;

      // Always register name for comedogenic dedup, even if suppressed
      dbFlaggedNames.add(lower.trim());

      // Rinse-off suppression: skip pore-clogger/occlusive/bacteria-trap
      if (isRinseOff && cat && RINSE_OFF_SUPPRESS_CATS.has(cat)) continue;

      dbFlaggedCount++;

      // Universal rules — mirrors getIngredientConcernLevel() in Scanner.tsx
      if (cat && UNIVERSAL_CONCERN_SET.has(cat)) {
        universalConcernCount++;
      } else if (cat === "sensitizer" && struct === "Fragrance") {
        // Fragrance sensitizers are always a universal concern
        universalConcernCount++;
      } else if (hasProfile && cat && profileConcernsSet.has(cat)) {
        profileMatchedCount++;
      }
    }
  }

  // ── Comedogenic pattern matches not already in DB ─────────────────────────
  let comedoPatternCount = 0;
  if (!isRinseOff) {
    for (let i = 0; i < tokens.length; i++) {
      const cleaned = tokens[i].replace(/\([^)]*\)/g, "").trim();
      if (dbFlaggedNames.has(cleaned.toLowerCase())) continue;
      for (const rule of COMEDOGENIC_PATTERNS) {
        if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
        if (rule.pattern.test(cleaned)) {
          comedoPatternCount++;
          // pore-clogger: profile-matched if user has acne-prone/oily etc.
          if (hasProfile && profileConcernsSet.has("pore-clogger")) profileMatchedCount++;
          break;
        }
      }
    }
  }

  // ── Sensory pattern matches ───────────────────────────────────────────────
  let sensoryCount = 0;
  const seenSensory = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const cleaned = tokens[i].replace(/\([^)]*\)/g, "").trim();
    for (const rule of SENSORY_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seenSensory.has(key)) {
          seenSensory.add(key);
          sensoryCount++;
          // Profile matching — mirrors getIngredientConcernLevel() sensory block
          if (hasProfile) {
            const sc = rule.sensory_category;
            const profileTypes = SENSORY_PROFILE_MAP[sc] ?? [];
            let isMatch = profileTypes.some((st) => skinTypeSet.has(st));
            if (!isMatch && sc === "Stripping") {
              isMatch =
                skinTypeSet.has("dry") || skinTypeSet.has("damaged_barrier") ||
                skinTypeSet.has("fast_shedding") ||
                climateSet.has("dry_climate") || climateSet.has("cold");
            }
            if (!isMatch && sc === "Pilling") {
              isMatch = climateSet.has("hot") || climateSet.has("humid");
            }
            if (isMatch) profileMatchedCount++;
          }
        }
        break;
      }
    }
  }

  // ── Photo pattern matches ─────────────────────────────────────────────────
  // All current PHOTO_PATTERNS are level: "avoid" → all are universal concerns.
  // "caution" level (future) would go to profileMatchedCount for hyperpigmentation_prone/high_uv.
  let photoCount = 0;
  const seenPhoto = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const cleaned = tokens[i].replace(/\([^)]*\)/g, "").trim();
    for (const rule of PHOTO_PATTERNS) {
      if (rule.maxPosition !== undefined && i >= rule.maxPosition) continue;
      if (rule.pattern.test(cleaned)) {
        const key = cleaned.toLowerCase();
        if (!seenPhoto.has(key)) {
          seenPhoto.add(key);
          photoCount++;
          if (rule.level === "avoid") universalConcernCount++;
        }
        break;
      }
    }
  }

  return {
    flaggedCount: dbFlaggedCount + comedoPatternCount,
    sensoryCount,
    photoCount,
    universalConcernCount,
    profileMatchedCount: hasProfile ? profileMatchedCount : undefined,
  };
}
