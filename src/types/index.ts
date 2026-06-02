export type SkinClimateNote = {
  dimensions: string[];
  climate: string[];
  sentiment: "strong_caution" | "caution" | "benefit" | "neutral";
  text: string;
  concern?: string | null;
};

export type ConcernItem = {
  category: string;
  text: string;
};

export type ExplanationStructured = {
  formula_role: string | null;
  benefit: string | null;
  benefit_category?: string | null;
  benefit_profiles?: string[] | null;
  concern: string | null;
  concern_category?: string | null;
  concern_profiles?: string[] | null;
  concern_items?: ConcernItem[] | null;
};

export type DbIngredient = {
  id: string;
  name: string;
  inci_name: string | null;
  status: "safe" | "flagged";
  explanation: string | null;
  explanation_structured: ExplanationStructured | null;
  skin_climate_notes: SkinClimateNote[] | null;
  category: string | null;
  secondary_benefit_categories: string[];
  flagged_category: string | null;
  secondary_flagged_categories: string[];
  structural_category: string | null;
};

export type IngredientMatch = {
  displayName: string;
  ingredient: DbIngredient;
  benefit_note?: string;
  comedogenicRating?: string;
};

export type CommunityVariant = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  flaggedCount: number;
  sensoryCount: number;
  photoCount: number;
  universalConcernCount?: number;
  profileMatchedCount?: number;
};

export type ObfVariant = {
  name: string;
  brand: string | null;
  image_url: string | null;
  ingredients_text: string;
};

export type PhotoCategory = "photo-retinoid" | "photo-AHA" | "photo-BHA" | "photo-brightening" | "photo-botanical";

export type PhotosensitiveItem = {
  rawName: string;
  sunLevel: "avoid" | "caution";
  photo_note?: string | null;
  photoCategory?: PhotoCategory;
  isPositionBased?: boolean;
};

export type SensoryTriggerItem = {
  rawName: string;
  sensory_note: string;
  sensory_category?: string;
  isPositionBased?: boolean;
};

export type AlternativeProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  flaggedCount: number;
  sensoryCount: number;
  photoCount: number;
  sameType: boolean;
  universalConcernCount?: number;
  profileMatchedCount?: number;
};

export type FormulaWarning = {
  type: "danger" | "synergy";
  title: string;
  body: string;
};

export type RoutineProduct = {
  routineId: string;
  name: string;
  brand: string | null;
  step_tags: string[];
  ingredients: string[];
  flaggedCategories: string[];
  timeOfDay?: "am" | "pm" | null;
  productType?: string | null;
  image_url?: string | null;
};

export type Routine = {
  id: string;
  name: string;
  products: RoutineProduct[];
};

export type ScanResult = {
  product?: {
    id?: string | null;
    name: string;
    brand?: string | null;
    source: string;
    type?: string | null;
    image_url?: string | null;
    iherb_url?: string | null;
    source_url?: string | null;
    activity_tags?: string[] | null;
    activity_note?: string | null;
  };
  flagged: IngredientMatch[];
  safe: IngredientMatch[];
  unreviewed: string[];
  photosensitive: PhotosensitiveItem[];
  sensoryTrigger: SensoryTriggerItem[];
  communityVariants?: CommunityVariant[];
  obfVariants?: ObfVariant[];
  originalItems: string[];
  isIncomplete?: boolean;
  formula_warnings?: FormulaWarning[];
  step_tags?: string[];
};
