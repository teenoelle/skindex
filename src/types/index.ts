export type DbIngredient = {
  id: string;
  name: string;
  inci_name: string | null;
  status: "safe" | "flagged";
  explanation: string | null;
  category: string | null;
};

export type IngredientMatch = {
  displayName: string;
  ingredient: DbIngredient;
};

export type CommunityVariant = {
  id: string;
  name: string;
  brand: string | null;
};

export type ObfVariant = {
  name: string;
  brand: string | null;
  image_url: string | null;
  ingredients_text: string;
};

export type PhotosensitiveItem = {
  rawName: string;
  sunLevel: "avoid" | "caution";
  photo_note?: string | null;
};

export type AlternativeProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  flaggedCount: number;
  sameType: boolean;
};

export type ScanResult = {
  product?: {
    name: string;
    brand?: string | null;
    source: string;
    type?: string | null;
    image_url?: string | null;
    activity_tags?: string[] | null;
    activity_note?: string | null;
  };
  flagged: IngredientMatch[];
  safe: IngredientMatch[];
  unreviewed: string[];
  photosensitive: PhotosensitiveItem[];
  communityVariants?: CommunityVariant[];
  obfVariants?: ObfVariant[];
  originalItems: string[];
  isIncomplete?: boolean;
};
