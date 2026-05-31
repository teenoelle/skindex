import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const UNIVERSAL_CATS = [
  "fragrance-allergen", "preservative-allergen", "formaldehyde releaser",
  "sensitizing preservative", "biocide", "Sulfate Surfactant", "Drying Solvent",
];

const RINSE_OFF_SUPPRESS = new Set(["pore-clogger", "occlusive", "bacteria-trap"]);

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
  "photo-retinoid": ["hyperpigmentation_prone", "lupus_rash"],
  "photo-AHA": ["hyperpigmentation_prone", "lupus_rash"],
  "photo-BHA": ["hyperpigmentation_prone", "lupus_rash"],
  "photo-brightening": ["hyperpigmentation_prone", "lupus_rash"],
  "photo-botanical": ["hyperpigmentation_prone", "lupus_rash"],
};

export async function GET(req: NextRequest) {
  const list = req.nextUrl.searchParams.get("list");
  const skinTypesParam = req.nextUrl.searchParams.get("skinTypes");
  const skinTypes = skinTypesParam ? skinTypesParam.split(",").filter(Boolean) : [];
  const climatesParam = req.nextUrl.searchParams.get("climates");
  const climates = climatesParam ? climatesParam.split(",").filter(Boolean) : [];
  const isRinseOff = req.nextUrl.searchParams.get("rinseOff") === "true";
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (list === "universal-concerns") {
    const { data } = await supabase
      .from("ingredients")
      .select("name, flagged_category")
      .in("flagged_category", UNIVERSAL_CATS)
      .order("name");
    const items = (data ?? []).map(r => ({ name: r.name, category: r.flagged_category ?? "" }));
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
    return NextResponse.json({ items: filtered });
  }

  if (list === "my-sensitivities") {
    const skinTypeSet = new Set(skinTypes);
    const climateSet = new Set(climates);
    const { data } = await supabase
      .from("ingredients")
      .select("name, flagged_category")
      .eq("status", "flagged")
      .order("name");
    const items = (data ?? [])
      .filter(ing => {
        const cat = ing.flagged_category;
        if (!cat) return false;
        if (isRinseOff && RINSE_OFF_SUPPRESS.has(cat)) return false;
        const profileTypes = PROFILE_CAT_MAP[cat] ?? [];
        // Also check climate-based categories
        if (cat === "Drying Solvent" && (skinTypeSet.has("rosacea") || climateSet.has("heavy_metal_water"))) return true;
        if (["photo-retinoid","photo-AHA","photo-BHA","photo-brightening","photo-botanical"].includes(cat) && climateSet.has("high_uv")) return true;
        return profileTypes.some(pt => skinTypeSet.has(pt));
      })
      .map(r => ({ name: r.name, category: r.flagged_category ?? "" }));
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
    return NextResponse.json({ items: filtered });
  }

  if (list === "neutral-beneficial") {
    const { data } = await supabase
      .from("ingredients")
      .select("name, category")
      .eq("status", "safe")
      .order("name");
    const items = (data ?? []).map(r => ({ name: r.name, category: r.category ?? "" }));
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
    return NextResponse.json({ items: filtered });
  }

  return NextResponse.json({ error: "Unknown list" }, { status: 400 });
}
