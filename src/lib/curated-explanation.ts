import { SENSORY_PATTERNS } from "./sensory";

export type Sentiment = "strong_caution" | "caution" | "benefit" | "neutral";

export type SkinClimateNotes = {
  sentiment: Sentiment;
  skin_types: string[];
  climates: string[];
  sensory_categories: string[];
};

export type IngredientContext = {
  name: string;
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
};

const STRONG_CAUTION_CATEGORIES = new Set([
  "fragrance allergen", "fragrance", "formaldehyde releaser", "sensitizing preservative",
  "biocide", "chemical uv filter", "cyclic silicone",
]);

function computeSentiment(ctx: IngredientContext): Sentiment {
  if (ctx.status === "flagged") {
    const fc = (ctx.flagged_category ?? ctx.category ?? "").toLowerCase();
    if (STRONG_CAUTION_CATEGORIES.has(fc) || fc.includes("allergen") || fc.includes("sensitiz")) {
      return "strong_caution";
    }
    return "caution";
  }
  const cat = (ctx.category ?? "").toLowerCase();
  if (cat && cat !== "unknown" && cat !== "") return "benefit";
  return "neutral";
}

function computeSkinTypes(ctx: IngredientContext, sensoryCategories: string[]): string[] {
  const types = new Set<string>();

  if (ctx.status === "flagged") {
    types.add("reactive");
    types.add("damaged_barrier");
  }
  if (sensoryCategories.includes("comedogenic-itch")) {
    types.add("oily");
    types.add("acne_prone");
  }
  if (sensoryCategories.includes("Occlusive") || sensoryCategories.includes("occlusive-itch")) {
    types.add("oily");
    types.add("acne_prone");
  }
  if (sensoryCategories.includes("chemical-itch")) {
    types.add("reactive");
  }
  if (sensoryCategories.includes("Stinging") || sensoryCategories.includes("Stripping")) {
    types.add("reactive");
    types.add("damaged_barrier");
  }
  if (sensoryCategories.includes("Stripping")) {
    types.add("dry");
  }
  if (sensoryCategories.includes("Cooling") || sensoryCategories.includes("Warming")) {
    types.add("reactive");
  }

  const structural = (ctx.structural_category ?? "").toLowerCase();
  if (structural.includes("humectant") || structural.includes("emollient")) {
    types.add("dry");
  }
  if (structural.includes("clay") || structural.includes("astringent")) {
    types.add("oily");
  }

  const cat = (ctx.category ?? "").toLowerCase();
  if (cat.includes("barrier") || cat.includes("repair")) {
    types.add("damaged_barrier");
  }
  if (cat.includes("soothing") || cat.includes("anti-inflammatory")) {
    types.add("reactive");
  }

  return Array.from(types);
}

function computeClimates(sensoryCategories: string[]): string[] {
  const climates = new Set<string>();
  if (sensoryCategories.includes("Occlusive") || sensoryCategories.includes("occlusive-itch")) {
    climates.add("humid");
    climates.add("hot");
  }
  if (sensoryCategories.includes("Cooling")) {
    climates.add("cold");
  }
  if (sensoryCategories.includes("Warming")) {
    climates.add("hot");
  }
  return Array.from(climates);
}

export function getSensoryCategories(name: string): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const rule of SENSORY_PATTERNS) {
    if (rule.pattern.test(name) && !seen.has(rule.sensory_category)) {
      seen.add(rule.sensory_category);
      categories.push(rule.sensory_category);
    }
  }
  return categories;
}

export function computeSkinClimateNotes(ctx: IngredientContext, sensoryCategories: string[]): SkinClimateNotes {
  return {
    sentiment: computeSentiment(ctx),
    skin_types: computeSkinTypes(ctx, sensoryCategories),
    climates: computeClimates(sensoryCategories),
    sensory_categories: sensoryCategories,
  };
}
