import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { countProfileSensoryMatches } from "@/lib/sensory";

const UNIVERSAL_CATS = [
  "fragrance-allergen", "preservative-allergen", "formaldehyde releaser",
  "sensitizing preservative", "biocide", "Sulfate Surfactant", "Drying Solvent",
];

const RINSE_OFF_SUPPRESS_CATS = new Set(["pore-clogger", "occlusive", "bacteria-trap"]);

export async function GET(req: NextRequest) {
  const skinTypesParam = req.nextUrl.searchParams.get("skinTypes");
  const climatesParam = req.nextUrl.searchParams.get("climates");
  const skinTypes = skinTypesParam ? skinTypesParam.split(",").filter(Boolean) : [];
  const climates = climatesParam ? climatesParam.split(",").filter(Boolean) : [];
  const isRinseOff = req.nextUrl.searchParams.get("rinseOff") === "true";
  const hasProfile = skinTypes.length > 0 || climates.length > 0;

  const [
    { count: universalCount },
    { count: safeCount },
    mySensitivitiesResult,
  ] = await Promise.all([
    supabase.from("ingredients").select("id", { count: "exact", head: true })
      .in("flagged_category", UNIVERSAL_CATS),
    supabase.from("ingredients").select("id", { count: "exact", head: true })
      .eq("status", "safe"),
    hasProfile
      ? supabase.from("ingredients").select("id, flagged_category, skin_climate_notes")
          .eq("status", "flagged")
      : Promise.resolve({ data: null }),
  ]);

  let sensitivityCount: number | null = null;
  if (hasProfile && mySensitivitiesResult.data) {
    const skinTypeSet = new Set(skinTypes);
    // Count ingredients whose flagged_category is matched by the user's profile
    // Profile categories are defined in profileMatchedCategories in Scanner.tsx;
    // here we use a simplified set based on the same logic
    const PROFILE_CAT_MAP: Record<string, string[]> = {
      "pore-clogger": ["oily", "acne_prone", "fungal_acne", "body_acne", "keratosis_pilaris"],
      "occlusive": ["oily", "acne_prone", "fungal_acne", "body_acne", "keratosis_pilaris"],
      "bacteria-trap": ["oily", "acne_prone", "fungal_acne", "body_acne"],
      "sensitizer": ["reactive", "damaged_barrier", "eczema", "rosacea", "psoriasis"],
      "fragrance-allergen": ["reactive", "damaged_barrier", "eczema", "rosacea", "psoriasis"],
      "preservative-allergen": ["reactive", "damaged_barrier", "eczema", "rosacea", "psoriasis"],
      "sensitizing preservative": ["reactive", "damaged_barrier", "eczema", "rosacea", "psoriasis"],
      "formaldehyde releaser": ["reactive", "damaged_barrier", "eczema", "rosacea", "psoriasis"],
      "biocide": ["reactive", "damaged_barrier", "eczema"],
      "contact-allergen": ["reactive", "damaged_barrier", "eczema"],
      "chemical-sunscreen": ["rosacea", "lupus_rash"],
      "Drying Solvent": ["dry", "damaged_barrier", "reactive", "rosacea"],
      "Sulfate Surfactant": ["dry", "damaged_barrier", "eczema", "psoriasis", "rosacea", "keratosis_pilaris"],
    };
    sensitivityCount = mySensitivitiesResult.data.filter((ing) => {
      const cat = ing.flagged_category;
      if (!cat) return false;
      if (isRinseOff && RINSE_OFF_SUPPRESS_CATS.has(cat)) return false;
      const profileTypes = PROFILE_CAT_MAP[cat] ?? [];
      return profileTypes.some((pt) => skinTypeSet.has(pt));
    }).length;

    // Add sensory-matched ingredients (approximate count using ingredient_list check)
    // Note: sensory matching requires ingredient_list text, so we use a rough estimate
    // The actual count shown in browse is more precise
  }

  // Neutral & beneficial breakdown
  const [{ count: neutralCount }, { count: beneficialCount }] = await Promise.all([
    supabase.from("ingredients").select("id", { count: "exact", head: true })
      .eq("status", "safe").is("category", null),
    supabase.from("ingredients").select("id", { count: "exact", head: true })
      .eq("status", "safe").not("category", "is", null),
  ]);

  return NextResponse.json({
    universalConcerns: { count: universalCount ?? 0 },
    mySensitivities: hasProfile ? { count: sensitivityCount ?? 0 } : null,
    neutralBeneficial: {
      count: safeCount ?? 0,
      neutral: neutralCount ?? 0,
      beneficial: beneficialCount ?? 0,
    },
  });
}
