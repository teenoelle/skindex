"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Pipette, FlaskConical, Droplet, Droplets, Waves, Sun, Sparkles, Wind, Bandage, Brush, Search, X, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DbIngredient, ExplanationStructured, IngredientMatch, PhotosensitiveItem, RoutineProduct, SensoryTriggerItem, ScanResult, AlternativeProduct, CommunityVariant, SkinClimateNote } from "@/types";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Ampoule: Pipette,
  Balm: Sparkles,
  Blush: Sparkles,
  "Body Wash": Waves,
  Chapstick: Pipette,
  Concealer: Brush,
  Cream: Droplets,
  Emulsion: Droplets,
  Extract: FlaskConical,
  "Face Mask": Sparkles,
  "Face Wash": Droplets,
  Foundation: Brush,
  Gel: Droplet,
  "Makeup Remover": Droplets,
  Deodorant: Wind,
  Mist: Wind,
  Oil: Droplet,
  Ointment: Droplets,
  Serum: Pipette,
  Shampoo: Waves,
  "Spot Patches": Bandage,
  "Sun Screen": Sun,
  Toner: Droplets,
};

function CategoryIcon({ type, size = 28 }: { type?: string | null; size?: number }) {
  const Icon = (type && CATEGORY_ICONS[type]) ? CATEGORY_ICONS[type] : Droplet;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Icon size={size} className="text-gray-300" />
      {type && <span className="text-[10px] text-gray-400 text-center leading-tight">{type}</span>}
    </div>
  );
}

type Tab = "search" | "paste" | "add" | "browse";

type ImportResult = {
  url: string;
  status: "imported" | "skipped" | "failed";
  name?: string;
  brand?: string;
  reason?: string;
  httpStatus?: number;
  fetchError?: string;
};
type UserList = { id: string; name: string; is_public: boolean; itemCount: number };

type BrowseType = { name: string; count: number };
type BrowseProduct = { id: string; name: string; brand: string | null; image_url: string | null; flaggedCount: number; sensoryCount: number; photoCount: number };

const CATEGORY_LABELS: Record<string, string> = {
  // kebab-case (newer workflow)
  "sensitizer": "Sensitizer",
  "pore-clogger": "Pore-clogger",
  "occlusive": "Occlusive",
  "stripping": "Stripping",
  "bacteria-trap": "Bacteria trap",
  "cleansing": "Cleansing",
  "photosensitizer": "Photosensitizer",
  "photo-retinoid": "Photosensitizing",
  "photo-AHA": "AHA Exfoliant",
  "photo-BHA": "BHA Exfoliant",
  "photo-brightening": "Photosensitizing",
  "photo-botanical": "Phototoxic",
  "fragrance-allergen": "Fragrance allergen",
  "humectant": "Humectant",
  "barrier-repairing": "Barrier-repairing",
  "soothing": "Soothing",
  "brightening": "Brightening",
  "antioxidant": "Antioxidant",
  "firming": "Firming",
  "emollient": "Emollient",
  // Title-case aliases (original seed)
  "Sensitizer": "Sensitizer",
  "Occlusive": "Occlusive",
  "Soothing": "Soothing",
  "Soothing Agent": "Soothing",
  "Antioxidant": "Antioxidant",
  "Emollient": "Emollient",
  "Humectant": "Humectant",
  "Brightening": "Brightening",
  "Exfoliant": "Exfoliant",
  "AHA Exfoliant": "AHA Exfoliant",
  "BHA Exfoliant": "BHA Exfoliant",
  "PHA Exfoliant": "PHA Exfoliant",
  "Retinoid": "Retinoid",
  "Barrier-disrupting": "Barrier-disrupting",
  "Anti-inflammatory": "Anti-inflammatory",
  "Softening": "Softening",
  "Barrier support": "Barrier support",
  "Smoothing": "Smoothing",
  "Pore-cleansing": "Pore-cleansing",
  "Strengthening": "Strengthening",
  "Conditioning": "Conditioning",
  "Moisturizing": "Moisturizing",
  // Flagged categories
  "Fragrance Allergen": "Fragrance allergen",
  "Fragrance": "Fragrance",
  "Preservative Allergen": "Preservative allergen",
  "Preservative": "Preservative",
  "Irritant": "Irritant",
  "Essential Oil": "Essential oil",
  "Shea Butter": "Shea butter",
  "Cocoa Butter": "Cocoa butter",
  "Aloe": "Aloe",
  "Chemical Sunscreen": "Chemical sunscreen",
  "Drying Solvent": "Drying solvent",
  "Sulfate Surfactant": "Sulfate surfactant",
  "Hyaluronic Acid": "Hyaluronic acid",
  "Synthetic Musk": "Synthetic musk",
  // Beneficial/safe categories
  "Amino Acid": "Amino acid",
  "Ferment": "Ferment",
  "Plant Oil": "Plant oil",
  "Mineral Sunscreen": "Mineral sunscreen",
  "Peptides": "Peptide",
  "Abrasive": "Abrasive",
  "Antimicrobial": "Antimicrobial",
  "Anti-Inflammatory": "Anti-inflammatory",
  "Prebiotic": "Prebiotic",
  "Zinc": "Zinc",
  // Informative structural/functional categories
  "Silicone": "Silicone",
  "Fatty Acid": "Fatty acid",
  "Fatty Alcohol": "Fatty alcohol",
  "Wax": "Wax",
  "Pigment": "Pigment",
  "Colorant": "Colorant",
  "pH Adjuster": "pH adjuster",
  "Mineral": "Mineral",
  "Magnesium": "Magnesium",
  "Propolis": "Propolis",
  "Oatmeal": "Oatmeal",
  "Squalane": "Squalane",
  "Panthenol": "Panthenol",
  "Salicylic Acid": "Salicylic acid",
  "Sulfur": "Sulfur",
  "Azelaic Acid": "Azelaic acid",
  "Benzoyl Peroxide": "Benzoyl peroxide",
  "Copper": "Copper",
  "Hypochlorous Acid": "Hypochlorous acid",
  "Hydrocolloid": "Hydrocolloid",
  "Camellia Sinensis Leaf Extract": "Green tea",
  "Preservative Booster": "Preservative booster",
  "Botanical Water": "Botanical water",
  "Trace Mineral": "Trace mineral",
  "chelating": "Chelating",
};

const STRUCTURAL_DESCRIPTIONS: Record<string, string> = {
  "Emulsifier": "Emulsifiers help oil and water blend together to keep the formula stable.",
  "Thickener": "Thickeners increase viscosity so the product spreads and feels even on skin.",
  "Film Former": "Film formers create a thin protective film on the skin surface.",
  "Surfactant": "Surfactants reduce surface tension to cleanse skin and rinse away dirt and oil.",
  "Wax": "Waxes provide texture, structure, and a protective occlusive layer.",
  "Pigment": "Pigments provide color in makeup or tinted skincare products.",
  "Colorant": "Colorants add or enhance color in the formula.",
  "pH Adjuster": "pH adjusters keep the formula at its optimal pH for stability and skin compatibility.",
  "Conditioning Agent": "Conditioning agents coat and smooth hair and skin surfaces to reduce friction.",
  "Silicone": "Silicones provide a silky texture and slip; they form a breathable barrier on skin.",
  "Fatty Acid": "Fatty acids replenish the skin's lipid barrier and help lock in moisture.",
  "Fatty Alcohol": "Fatty alcohols act as emollients and co-emulsifiers to soften texture.",
  "Botanical Water": "Botanical waters provide a plant-derived aqueous base with mild skin benefits.",
  "Mineral": "Minerals supply trace elements that support skin function.",
  "Preservative Booster": "Preservative boosters enhance the effectiveness of preservatives to extend shelf life.",
  "Emollient": "Emollients soften and smooth skin by filling gaps in the lipid barrier.",
  "Humectant": "Humectants draw moisture from the air into the upper layers of skin.",
  "UV Filter": "UV filters absorb or reflect UV radiation to protect skin from sun damage.",
  "Plant Extract": "Plant extracts deliver concentrated plant-derived actives with targeted skin benefits.",
  "Solvent": "Solvents dissolve other ingredients and help the formula spread on skin.",
  "Chelating Agent": "Chelating agents bind trace metals in water to prevent formula degradation.",
  "Preservative": "Preservatives prevent microbial growth to extend product shelf life.",
  "Fragrance": "Fragrances add scent to the product; they may include synthetic or natural aromatic compounds.",
  "Peptide": "Peptides are short amino acid chains that signal skin cells to build collagen, support repair, or retain moisture.",
  "Ceramide": "Ceramides are lipids that fill gaps in the skin barrier to lock in moisture and protect against irritants.",
  "Retinoid": "Retinoids are vitamin A derivatives that speed up cell turnover to smooth texture and reduce discoloration.",
  "Exfoliant": "Exfoliants are acids or enzymes that dissolve the bonds between dead skin cells to reveal smoother skin.",
  "Protein": "Proteins and hydrolyzed proteins form a conditioning film on skin and hair to strengthen and smooth.",
  "Clay": "Clays absorb excess sebum and draw out impurities from pores.",
  "Amino Acid": "Amino acids are the building blocks of skin proteins; they support hydration and barrier function.",
  "Active": "Actives are targeted ingredients included for a specific skin benefit like brightening, barrier repair, or anti-aging.",
};

const PRODUCT_TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Face", types: ["Concentrate", "Exfoliant", "Eye Cream", "Eye Primer", "Face Mask", "Face Wash", "Makeup Remover", "Mist", "Moisturizer", "Oil", "Ointment", "Primer", "Serum", "Sleeping Mask", "Spot Patches", "Sun Screen", "Toner"].sort() },
  { label: "Makeup", types: ["BB Cream", "Blush", "Brow Gel", "CC Cream", "Concealer", "Eyeliner", "Eyeshadow", "Foundation", "Mascara", "Setting Spray"].sort() },
  { label: "Lips", types: ["Lip Balm", "Lip Treatment"] },
  { label: "Body", types: ["Body Lotion", "Body Wash", "Deodorant", "Foot Cream", "Hand Cream"].sort() },
  { label: "Hair", types: ["Conditioner", "Hair Styler", "Hair Treatment", "Scalp Treatment", "Shampoo"].sort() },
];

const RINSE_OFF_TYPES = new Set([
  "Face Wash", "Cleanser", "Micellar Cleanser", "Micellar Water",
  "Body Wash", "Hand Wash", "Makeup Remover",
  "Shampoo", "Conditioner", "Hair Mask",
  "Scalp Scrub", "Exfoliating Scrub", "Facial Scrub", "Body Scrub",
  "Clay Mask", "Rinse-Off Mask",
]);

type SkinType = "oily" | "dry" | "reactive" | "damaged_barrier" | "acne_prone" | "mature" | "hyperpigmentation_prone" | "fungal_acne" | "rosacea" | "seborrheic" | "eczema" | "psoriasis" | "lupus_rash";
type ClimateType = "humid" | "dry_climate" | "cold" | "hot" | "high_uv" | "hard_water" | "chlorinated_water" | "iron_water" | "heavy_metal_water";

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: "oily", label: "Oily" },
  { value: "dry", label: "Dry" },
  { value: "reactive", label: "Reactive" },
  { value: "damaged_barrier", label: "Damaged barrier" },
  { value: "acne_prone", label: "Acne-prone" },
  { value: "mature", label: "Mature" },
  { value: "hyperpigmentation_prone", label: "Hyperpigmentation" },
  { value: "fungal_acne", label: "Fungal acne" },
  { value: "rosacea", label: "Rosacea" },
  { value: "seborrheic", label: "Seborrheic" },
  { value: "eczema", label: "Eczema" },
  { value: "psoriasis", label: "Psoriasis" },
  { value: "lupus_rash", label: "Lupus rash" },
];

const CLIMATE_TYPES: { value: ClimateType; label: string }[] = [
  { value: "humid", label: "Humid" },
  { value: "dry_climate", label: "Dry" },
  { value: "cold", label: "Cold" },
  { value: "hot", label: "Hot" },
  { value: "high_uv", label: "High UV" },
];

const WATER_TYPES: { value: ClimateType; label: string }[] = [
  { value: "hard_water", label: "Hard / mineral" },
  { value: "chlorinated_water", label: "Chlorinated" },
  { value: "iron_water", label: "Iron / rust" },
  { value: "heavy_metal_water", label: "Lead / metals" },
];

const SKIN_TYPE_NOTES: Record<SkinType, string> = {
  oily: "Oily skin still loses moisture in the minutes after washing. Apply your next product quickly — the itch in that window is what causes barrier damage, not the product itself.",
  dry: "Dry skin has a thinner lipid layer and loses water fastest in cold or dry air — drying solvents, sulfate surfactants, and clay are worth watching closely.",
  reactive: "Reactive skin has a lower tolerance threshold — sensitizers, fragrance allergens, and chemical sunscreens are worth watching closely, especially in warm weather.",
  damaged_barrier: "A compromised barrier lets ingredients penetrate faster and deeper — irritants and sensitizers hit harder and recovery takes longer than it would on intact skin.",
  acne_prone: "For acne-prone skin, pore-clogging ingredients and film-formers are the main risks — watch the Congestion section after scanning.",
  mature: "Mature skin benefits most from peptides, ceramides, and emollients, and is more sensitive to the retinoid adjustment period — start at the lowest available concentration.",
  hyperpigmentation_prone: "For hyperpigmentation-prone skin, UV exposure directly undoes progress — many brightening actives also increase UV sensitivity, making daily SPF essential.",
  fungal_acne: "Fungal acne (Malassezia folliculitis) is caused by yeast, not bacteria — it looks like regular acne but doesn't respond to antibiotics or most OTC acne treatments. Many 'safe' moisturizing oils and fatty acid esters feed Malassezia. Scanning every formula matters more here than for almost any other skin type.",
  rosacea: "Rosacea triggers vary but commonly include heat, vasodilation, and chemical absorption. Chemical UV filters, alcohol-based formulas, menthol, warming agents, and high fragrance load are the main ingredient triggers — mineral sunscreens (zinc oxide, titanium dioxide) are strongly preferred.",
  seborrheic: "Seborrheic dermatitis is Malassezia-driven and affects the T-zone: scalp margins, brows, sides of the nose, and eyelids. Certain plant oils can worsen it. Zinc compounds, sulfur, and anti-Malassezia actives (zinc pyrithione, piroctone olamine, selenium sulfide) are specifically beneficial.",
  eczema: "Atopic eczema has specific preservative sensitivities. MI/MCI (methylisothiazolinone/methylchloroisothiazolinone) and IPBC are notorious eczema triggers. Ceramides, colloidal oatmeal, and thick emollients are specifically therapeutic here — unlike for acne, heavy barrier creams help rather than harm.",
  psoriasis: "Psoriasis causes rapid cell turnover and thick scale. Keratolytics like salicylic acid can help remove scale. Fragrances and harsh surfactants trigger flares. Vitamin D analogues and antioxidants are specifically beneficial.",
  lupus_rash: "The malar (butterfly) rash of lupus is highly photosensitive — UV exposure triggers flares. Chemical UV filters can also cause reactions; mineral-only sunscreens (zinc oxide, titanium dioxide) are strongly preferred. Photosensitizing ingredients carry significantly higher risk here than for any other type.",
};

const CLIMATE_NOTES: Record<ClimateType, string> = {
  humid: "In humid climates, film-forming and occlusive ingredients are more likely to trap heat and sebum against the skin — lighter formulations are preferable.",
  dry_climate: "In dry climates, humectants need to be sealed in with an emollient or occlusive — without one, they can pull moisture from deeper skin layers instead of the air.",
  cold: "Cold air depletes skin lipids fastest — barrier-repairing ingredients (ceramides, fatty acids, emollients) are most effective and most needed in this climate.",
  hot: "In hot weather, skin permeability increases, making sensitizers and chemical UV filters absorb more readily and triggering stronger reactions.",
  high_uv: "In high-UV environments, daily broad-spectrum SPF is essential — AHAs, retinoids, and many brightening ingredients all increase UV sensitivity.",
  hard_water: "Hard (mineral-rich) water is alkaline (pH 7–9) and leaves a calcium/magnesium film on skin after rinsing. This disrupts the skin's natural acid mantle, impairs cleanser rinse-off, and is a documented eczema aggravator. Look for cleansers containing chelating agents (EDTA, phytic acid) and follow with a low-pH toner quickly after washing.",
  chlorinated_water: "Chlorinated and chloramine-treated tap water can oxidize skin barrier lipids on contact — particularly relevant for eczema and reactive skin. A vitamin C (ascorbic acid) toner applied immediately after washing neutralizes residual disinfectant before it can damage the barrier.",
  iron_water: "Iron-bearing water (indicated by rust stains on sinks or fixtures) introduces ferrous and ferric ions that generate free radicals on contact with skin, accelerating barrier lipid oxidation. Chelating agents and antioxidants (especially vitamins C and E) counteract this.",
  heavy_metal_water: "Lead or heavy metal contamination in tap water is a public health concern — filtering your water or using bottled/filtered water for face washing is the most effective intervention. Topical measures can reduce but not eliminate exposure: chelating cleansers (containing tetrasodium EDTA or phytic acid) bind surface metals, barrier-repair products reduce transdermal uptake, and penetration enhancers (drying alcohols) should be avoided as they increase absorption. If you suspect lead, test your water.",
};

function noteLabel(n: SkinClimateNote): string {
  const skinLabels = n.dimensions.map((d) => SKIN_TYPES.find((s) => s.value === d)?.label ?? d);
  const climateLabels = n.climate.map((c) => CLIMATE_TYPES.find((t) => t.value === c)?.label ?? c);
  const parts: string[] = [];
  if (skinLabels.length) parts.push(skinLabels.join(", "));
  if (climateLabels.length) parts.push(climateLabels.join(", "));
  return parts.join(" · ");
}

function profileWatchCategories(skinTypes: Set<SkinType>, climates: Set<ClimateType>): string[] {
  const cats: string[] = [];
  if (skinTypes.has("oily") || skinTypes.has("acne_prone")) cats.push("Occlusives", "Waxes", "Film-formers");
  if (skinTypes.has("reactive") || skinTypes.has("damaged_barrier")) cats.push("Sensitizers", "Fragrance allergens", "Barrier-disrupting");
  if (skinTypes.has("dry") || skinTypes.has("damaged_barrier") || climates.has("cold") || climates.has("dry_climate")) cats.push("Drying solvents", "Sulfate surfactants");
  if (climates.has("high_uv") || skinTypes.has("hyperpigmentation_prone")) cats.push("AHA exfoliants", "Retinoids");
  if (climates.has("hot") || climates.has("humid")) cats.push("Heavy occlusives", "Silicones");
  if (skinTypes.has("fungal_acne") || skinTypes.has("seborrheic")) cats.push("Plant oils", "Fatty acid esters", "Emulsifiers");
  if (skinTypes.has("rosacea")) cats.push("Chemical sunscreens", "Warming agents", "Drying solvents");
  if (skinTypes.has("eczema")) cats.push("Sensitizing preservatives", "Fragrance allergens", "Sulfate surfactants");
  if (skinTypes.has("psoriasis")) cats.push("Fragrances", "Sulfate surfactants");
  if (skinTypes.has("lupus_rash")) cats.push("Chemical sunscreens", "Photosensitizers", "AHA exfoliants");
  if (climates.has("hard_water")) cats.push("Chelating agents", "High-pH cleansers");
  if (climates.has("chlorinated_water")) cats.push("Vitamin C", "Antioxidants");
  if (climates.has("iron_water")) cats.push("Chelating agents", "Antioxidants");
  if (climates.has("heavy_metal_water")) cats.push("Chelating agents", "Penetration enhancers");
  return [...new Set(cats)];
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}


// Broader set used for the "By concern" grouped view — concerns that apply regardless of skin profile
const CONCERN_UNIVERSAL_CATEGORIES = new Set([
  "fragrance-allergen",
  "preservative-allergen",
  "formaldehyde releaser",
  "sensitizing preservative",
  "biocide",
  "Sulfate Surfactant",
  "Drying Solvent",
]);

type ConcernLevel = "universal" | "profile-matched" | "non-matching" | "neutral";

const SENSORY_CATEGORY_LABEL: Record<string, string> = {
  "chemical-itch": "Contact Allergen",
  "occlusive-itch": "Heat Trap",
  "comedogenic-itch": "Pore-blocking",
};

const SENSORY_PROFILE_MAP: Partial<Record<string, SkinType[]>> = {
  "Stinging": ["reactive", "damaged_barrier", "eczema", "rosacea"],
  "chemical-itch": ["reactive", "damaged_barrier", "eczema"],
  "Film-forming": ["oily", "acne_prone", "fungal_acne"],
  "Occlusive": ["oily", "acne_prone", "fungal_acne", "seborrheic"],
  "occlusive-itch": ["oily", "acne_prone", "fungal_acne"],
  "comedogenic-itch": ["oily", "acne_prone", "fungal_acne"],
  "Cooling": ["reactive", "rosacea"],
  "Warming": ["reactive", "rosacea"],
  "Iodine": ["acne_prone", "fungal_acne"],
};

const STEP_TAG_CONFIG: Record<string, { label: string; desc: string; className: string }> = {
  "acid-step":        { label: "Acid step",            desc: "Apply before serums; leave 15–20 min before higher-pH actives like niacinamide or peptides",                     className: "border-amber-200 bg-amber-50 text-amber-700" },
  "low-ph-step":      { label: "Low pH",               desc: "Ascorbic acid works best at pH 3–3.5. Apply before niacinamide, peptides, or moisturizers and wait 20 min",      className: "border-orange-200 bg-orange-50 text-orange-700" },
  "retinoid":         { label: "Retinoid",             desc: "Apply last in PM routine. Do not layer with AHAs or BHAs the same evening — alternate evenings instead",         className: "border-purple-200 bg-purple-50 text-purple-700" },
  "spf-last":         { label: "Apply last (AM)",      desc: "Sunscreen is always the final AM step — after all serums, moisturizers, and eye creams",                        className: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  "seal-last":        { label: "Seal last (PM)",       desc: "Occlusive ingredients lock in all prior layers — apply as the absolute final PM step",                          className: "border-gray-200 bg-gray-100 text-gray-600" },
  "enhancer-caution": { label: "Penetration enhancer", desc: "Contains drying alcohol that drives co-applied ingredients deeper — avoid applying immediately before fragrance-heavy or sensitizer-containing products", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

function getIngredientConcernLevel(
  match: { status: "safe" | "flagged"; ingredient: DbIngredient } | null,
  sensoryItem: SensoryTriggerItem | null,
  photoItem: PhotosensitiveItem | null,
  activeSkinTypes: Set<SkinType>,
  activeClimates: Set<ClimateType>
): ConcernLevel | "skip" {
  const hasConcern =
    match?.ingredient.status === "flagged" || sensoryItem !== null || photoItem !== null;

  if (!match && !hasConcern) return "skip"; // unreviewed, no annotation
  if (!hasConcern) return "neutral";

  const fc = match?.ingredient.flagged_category ?? "";

  if (CONCERN_UNIVERSAL_CATEGORIES.has(fc)) return "universal";
  if (photoItem?.sunLevel === "avoid") return "universal";

  const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;
  if (!hasProfile) return "non-matching";

  if (match?.ingredient.status === "flagged") {
    const isMatch =
      (["pore-clogger", "occlusive", "bacteria-trap"].includes(fc) &&
        (activeSkinTypes.has("acne_prone") || activeSkinTypes.has("oily") || activeSkinTypes.has("fungal_acne"))) ||
      (fc === "sensitizer" &&
        (activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") || activeSkinTypes.has("eczema") || activeSkinTypes.has("rosacea") || activeSkinTypes.has("psoriasis"))) ||
      (fc === "fragrance-allergen" &&
        (activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") || activeSkinTypes.has("eczema"))) ||
      (fc.toLowerCase() === "chemical sunscreen" &&
        (activeSkinTypes.has("rosacea") || activeSkinTypes.has("lupus_rash"))) ||
      (fc === "Drying Solvent" && (activeSkinTypes.has("rosacea") || activeClimates.has("heavy_metal_water"))) ||
      (["photo-retinoid", "photo-AHA", "photo-BHA", "photo-brightening", "photo-botanical"].includes(fc) &&
        (activeSkinTypes.has("hyperpigmentation_prone") || activeClimates.has("high_uv") || activeSkinTypes.has("lupus_rash")));
    return isMatch ? "profile-matched" : "non-matching";
  }

  if (sensoryItem) {
    const sc = sensoryItem.sensory_category ?? "";
    const profileTypes = SENSORY_PROFILE_MAP[sc] ?? [];
    if (profileTypes.some((st) => activeSkinTypes.has(st))) return "profile-matched";
    if (
      sc === "Stripping" &&
      (activeSkinTypes.has("dry") || activeSkinTypes.has("damaged_barrier") ||
        activeClimates.has("dry_climate") || activeClimates.has("cold"))
    ) return "profile-matched";
    return "non-matching";
  }

  if (photoItem?.sunLevel === "caution") {
    if (activeSkinTypes.has("hyperpigmentation_prone") || activeClimates.has("high_uv")) return "profile-matched";
    return "non-matching";
  }

  return "neutral";
}

function smartCase(str: string): string {
  const alpha = str.replace(/[^a-zA-Z]/g, "");
  if (!alpha || alpha !== alpha.toUpperCase()) return str;
  return toTitleCase(str);
}

function withRcode(url: string, code = "DYT4743"): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("rcode");
    u.searchParams.set("rcode", code);
    return u.toString();
  } catch {
    const clean = url.replace(/[?&]rcode=[^&]*/gi, "").replace(/\?$/, "").replace(/&&/g, "&");
    return clean + (clean.includes("?") ? "&" : "?") + "rcode=" + code;
  }
}

function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function groupByKey<T>(items: T[], getKey: (item: T) => string | null | undefined): [string | null, T[]][] {
  const map = new Map<string | null, T[]>();
  for (const item of items) {
    const k = getKey(item) ?? null;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });
}

function normalizeForMatch(s: string) {
  return s.replace(/[​‌‍﻿]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getItemMatch(
  item: string,
  safe: IngredientMatch[],
  flagged: IngredientMatch[]
): { status: "safe" | "flagged"; ingredient: IngredientMatch["ingredient"] } | null {
  const cleaned = normalizeForMatch(item.replace(/\([^)]*\)/g, ""));
  const f = flagged.find((m) => normalizeForMatch(m.displayName) === cleaned);
  if (f) return { status: "flagged", ingredient: f.ingredient };
  const s = safe.find((m) => normalizeForMatch(m.displayName) === cleaned);
  if (s) return { status: "safe", ingredient: s.ingredient };
  return null;
}

const paragraphColor = {
  "photo-sensitive": "text-yellow-700 font-medium",
  "sensory-trigger": "text-amber-700 font-medium",
  flagged: "text-rose-700 font-medium",
  safe: "text-teal-700 font-medium",
  unreviewed: "text-gray-400",
};

function detectRoutineWarnings(products: RoutineProduct[]): { type: "danger" | "synergy"; title: string; body: string }[] {
  if (products.length < 2) return [];
  const warnings: { type: "danger" | "synergy"; title: string; body: string }[] = [];
  const jp = (p: RoutineProduct) => p.ingredients.join(", ").toLowerCase();
  const who = (pattern: RegExp) => products.filter(p => pattern.test(jp(p))).map(p => p.name);
  const nameList = (names: string[]) => [...new Set(names)].join(" and ");

  const zincWho = who(/\bzinc\b/);
  const copperWho = who(/\bcopper\b/);
  const retinoidWho = who(/retinol|retinyl|retinaldehyde|tretinoin/);
  const exfoliantWho = who(/glycolic acid|lactic acid|mandelic acid|malic acid|salicylic acid/);
  const bpWho = who(/benzoyl peroxide/);
  const witchHazelWho = who(/hamamelis|witch hazel/);
  const niacinamideWho = who(/niacinamide|nicotinamide/);
  const acidStepProds = products.filter(p => p.step_tags.includes("acid-step") || p.step_tags.includes("low-ph-step"));

  if (zincWho.length && copperWho.length)
    warnings.push({ type: "danger", title: "Zinc + Copper conflict in routine", body: `${nameList([...zincWho, ...copperWho])} — zinc blocks copper peptide binding sites. Apply them in separate AM/PM routines.` });
  if (copperWho.length && witchHazelWho.length)
    warnings.push({ type: "danger", title: "Witch hazel + Copper: tannin inactivation", body: `${nameList([...copperWho, ...witchHazelWho])} — witch hazel tannins chelate and inactivate copper. Use in separate AM/PM routines.` });
  if (retinoidWho.length && exfoliantWho.length)
    warnings.push({ type: "danger", title: "Retinoid + Exfoliant: alternate evenings", body: `${nameList([...retinoidWho, ...exfoliantWho])} — do not use in the same PM session. Separate to different evenings to avoid compounded barrier disruption.` });
  if (bpWho.length && retinoidWho.length)
    warnings.push({ type: "danger", title: "Benzoyl peroxide + Retinoid: use separately", body: `${nameList([...bpWho, ...retinoidWho])} — benzoyl peroxide oxidizes retinol. Keep BP in AM, retinoid in PM.` });
  if (acidStepProds.length > 1)
    warnings.push({ type: "danger", title: "Multiple acid-step products", body: `${acidStepProds.map(p => p.name).join(" and ")} — using both in the same session doubles exfoliation stress. Alternate to different evenings.` });
  if (acidStepProds.length && niacinamideWho.length) {
    const names = nameList([...acidStepProds.map(p => p.name), ...niacinamideWho]);
    warnings.push({ type: "danger", title: "Low pH + Niacinamide: wait 20 min between steps", body: `${names} — niacinamide doesn't absorb effectively immediately after a low-pH formula. Wait at least 20 min.` });
  }
  return warnings;
}

export default function Scanner({ initialProductId }: { initialProductId?: string | null }) {
  const { isSignedIn, isLoaded } = useUser();

  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [iHerbBlocked, setIHerbBlocked] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showUnreviewed, setShowUnreviewed] = useState(false);
  const [showObfVariants, setShowObfVariants] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, string | null>>({});
  const [explanationsStructured, setExplanationsStructured] = useState<Record<string, ExplanationStructured | null>>({});
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [alternativesFetched, setAlternativesFetched] = useState(false);
  const [alternativesOpen, setAlternativesOpen] = useState(true);
  const [isRinseOff, setIsRinseOff] = useState(false);
  const [browseTypes, setBrowseTypes] = useState<BrowseType[]>([]);
  const [browseSelectedType, setBrowseSelectedType] = useState<string | null>(null);
  const [browseProducts, setBrowseProducts] = useState<BrowseProduct[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [imageUploadUrl, setImageUploadUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageRefetching, setImageRefetching] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [autoSearching, setAutoSearching] = useState(false);
  const [autoSearchResult, setAutoSearchResult] = useState<"found" | "not-found" | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ reviewed: number; total: number } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitName, setSubmitName] = useState("");
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitType, setSubmitType] = useState("");
  const [submitIngredients, setSubmitIngredients] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitMode, setSubmitMode] = useState<"paste" | "url">("paste");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [userListsLoaded, setUserListsLoaded] = useState(false);
  const [newListInputOpen, setNewListInputOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [saveListLoading, setSaveListLoading] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [saveListError, setSaveListError] = useState<string | null>(null);
  const [importUrls, setImportUrls] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editType, setEditType] = useState("");
  const [editIngredients, setEditIngredients] = useState("");
  const [editSourceUrl, setEditSourceUrl] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editDone, setEditDone] = useState(false);
  const [altImageOpen, setAltImageOpen] = useState<string | null>(null);
  const [altImageUrl, setAltImageUrl] = useState("");
  const [altImageSaving, setAltImageSaving] = useState(false);
  const [suggestLinkOpen, setSuggestLinkOpen] = useState(false);
  const [suggestLinkUrl, setSuggestLinkUrl] = useState("");
  const [suggestLinkLoading, setSuggestLinkLoading] = useState(false);
  const [suggestLinkError, setSuggestLinkError] = useState<string | null>(null);
  const [pinnedVariants, setPinnedVariants] = useState<CommunityVariant[] | null>(null);
  const [dymOpen, setDymOpen] = useState(true);
  const [pinnedTopProduct, setPinnedTopProduct] = useState<CommunityVariant | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [typeBodyAreaMap, setTypeBodyAreaMap] = useState<Map<string, string>>(new Map());
  const [activeSkinTypes, setActiveSkinTypes] = useState<Set<SkinType>>(new Set());
  const [activeClimates, setActiveClimates] = useState<Set<ClimateType>>(new Set());
  const [concernExpanded, setConcernExpanded] = useState<Set<string>>(new Set());
  const [neutralGroupOpen, setNeutralGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [showStickyProduct, setShowStickyProduct] = useState(false);
  const [stickySearchOpen, setStickySearchOpen] = useState(false);
  const [stickyQuery, setStickyQuery] = useState("");
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [routineProducts, setRoutineProducts] = useState<RoutineProduct[]>([]);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [addedToRoutine, setAddedToRoutine] = useState(false);
  const stickySearchRef = useRef<HTMLInputElement>(null);

  const initialProductIdRef = useRef(initialProductId);
  const scrollToProductRef = useRef(false);
  const scrollToDymRef = useRef(false);
  useEffect(() => {
    if (initialProductIdRef.current) {
      scanVariant({ productId: initialProductIdRef.current });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/product-types")
      .then((r) => r.json())
      .then((d: { types?: { name: string; body_area: string }[] }) => {
        if (d.types) setTypeBodyAreaMap(new Map(d.types.map((t) => [t.name, t.body_area])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      const cl = localStorage.getItem("skindex:climates");
      const rt = localStorage.getItem("skindex:routine");
      if (st) setActiveSkinTypes(new Set(JSON.parse(st) as SkinType[]));
      if (cl) setActiveClimates(new Set(JSON.parse(cl) as ClimateType[]));
      if (rt) setRoutineProducts(JSON.parse(rt) as RoutineProduct[]);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("skindex:routine", JSON.stringify(routineProducts)); } catch {}
  }, [routineProducts]);

  useEffect(() => {
    fetch("/api/browse")
      .then((r) => r.json())
      .then((d) => setBrowseTypes(d.types ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setShowStickyHeader(window.scrollY > 56);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = () => {
      setTab("search");
      setQuery("");
      setIngredients("");
      setUrl("");
      setResult(null);
      setNotFound(false);
      setIHerbBlocked(false);
      setLimitReached(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.replaceState(null, "", "/");
    };
    window.addEventListener("skindex:reset", handler);
    return () => window.removeEventListener("skindex:reset", handler);
  }, []);

  useEffect(() => {
    if (!result?.product?.id) { setShowStickyProduct(false); return; }
    const card = document.getElementById("product-card");
    if (!card) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyProduct(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-56px 0px 0px 0px" }
    );
    obs.observe(card);
    return () => obs.disconnect();
  }, [result?.product?.id]);

  useEffect(() => {
    if (result?.product?.id) {
      const parts = [result.product.brand, result.product.name].filter(Boolean).join(" ");
      const target = `/product/${slugify(parts)}-${result.product.id}`;
      if (window.location.pathname !== target) {
        window.history.replaceState(null, "", target);
      }
    } else if (result === null && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, [result]);

  // Fetch admin role once on sign-in
  useEffect(() => {
    if (isSignedIn) {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.isAdmin === true))
        .catch(() => {});
    }
  }, [isSignedIn]);

  // Reset edit form and rinse-off state when a new product is scanned
  useEffect(() => {
    if (result?.product?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditOpen(false);
      setEditDone(false);
      setEditError(null);
      setEditName(result.product.name ?? "");
      setEditBrand(result.product.brand ?? "");
      setEditType(result.product.type ?? "");
      setEditIngredients("");
      setIsRinseOff(RINSE_OFF_TYPES.has(result.product.type ?? ""));
    }
  }, [result?.product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollToProductRef.current && result) {
      scrollToProductRef.current = false;
      requestAnimationFrame(() => {
        document.getElementById("product-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (scrollToDymRef.current && result) {
      scrollToDymRef.current = false;
      requestAnimationFrame(() => {
        document.getElementById("did-you-mean")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [result]);

  // Auto-trigger review when scan finds unreviewed ingredients.
  useEffect(() => {
    if (!result?.unreviewed?.length || reviewLoading || reviewResult !== null) return;
    const t = setTimeout(() => handleReview(), 500);
    return () => clearTimeout(t);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleScan(override?: { tab?: Tab; query?: string }) {
    setLoading(true);
    setNotFound(false); setIHerbBlocked(false);
    setResult(null);
    setLimitReached(false);
    setShowUnreviewed(false);
    setShowObfVariants(false);
    setExpanded(new Set());
    setExplanations({});
    setExplanationsStructured({});
    setAlternatives([]);
    setAlternativesLoading(false);
    setAlternativesFetched(false);
    setAlternativesOpen(true);
    setImageUploadOpen(false);
    setImageUploadUrl("");
    setImageUploading(false);
    setUploadError(null);
    setAutoSearching(false);
    setAutoSearchResult(null);
    setReviewLoading(false);
    setReviewResult(null);
    setSubmitOpen(false);
    setSubmitName("");
    setSubmitBrand("");
    setSubmitType("");
    setSubmitIngredients("");
    setSubmitUrl("");
    setSubmitMode("paste");
    setSubmitLoading(false);
    setSubmitError(null);
    setReportOpen(false);
    setReportNote("");
    setReportLoading(false);
    setReportDone(false);
    setSaveListOpen(false);
    setNewListInputOpen(false);
    setNewListName("");
    setSaveListLoading(null);
    setSavedTo(null);
    setSuggestLinkOpen(false);
    setSuggestLinkUrl("");
    setSuggestLinkError(null);
    setPinnedVariants(null);
    setPinnedTopProduct(null);
    setDymOpen(true);
    setActiveVariantId(null);
    setShowStickyProduct(false);

    const activeTab = override?.tab ?? tab;
    const activeQuery = override?.query ?? query;
    const body =
      activeTab === "search"
        ? { type: "search", query: activeQuery }
        : activeTab === "paste"
        ? { type: "paste", ingredients }
        : { type: "url", url: importUrls.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = {};
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = await res.json();
    } catch {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(false);

    if (data.limitReached) { setLimitReached(true); return; }
    if (data.notFound || data.needsAuth) {
      if (data.iHerbBlocked) setIHerbBlocked(true);
      else setNotFound(true);
      return;
    }
    if (!Array.isArray(data.flagged)) { setNotFound(true); return; }
    setResult(data);
    if (data.communityVariants?.length && data.product?.id) {
      setPinnedVariants(data.communityVariants);
      setPinnedTopProduct({
        id: data.product.id,
        name: data.product.name,
        brand: data.product.brand ?? null,
        type: data.product.type ?? null,
        image_url: data.product.image_url ?? null,
        flaggedCount: data.flagged?.length ?? 0,
        sensoryCount: data.sensoryTrigger?.length ?? 0,
        photoCount: data.photosensitive?.length ?? 0,
      });
      scrollToDymRef.current = true;
    }
  }

  async function toggleExpand(id: string, existingExplanation: string | null) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      next.add(id);
      return next;
    });

    if (existingExplanation || id in explanations) return;

    setExplanations((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setExplanations((prev) => ({ ...prev, [id]: data.explanation ?? null }));
      if (data.explanation_structured) {
        setExplanationsStructured((prev) => ({ ...prev, [id]: data.explanation_structured }));
      }
    } catch {
      // leave as null
    }
  }

  function handleParagraphClick(ingredientId: string, dbExplanation: string | null) {
    if (!expanded.has(ingredientId)) {
      toggleExpand(ingredientId, dbExplanation);
    }
    requestAnimationFrame(() => {
      document.getElementById(`ingredient-${ingredientId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function handleIngredientClick(
    item: string,
    match: { status: string; ingredient: { id: string; explanation: string | null; explanation_structured: import("@/types").ExplanationStructured | null } } | null,
    _hasPhoto: boolean,
    _hasSensory: boolean,
  ) {
    const rowKey = `concern-${item}`;
    setConcernExpanded((prev) => { const next = new Set(prev); next.add(rowKey); return next; });
    if (match && !match.ingredient.explanation_structured && !match.ingredient.explanation && !(match.ingredient.id in explanations)) {
      setExplanations((prev) => ({ ...prev, [match.ingredient.id]: null }));
      fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: match.ingredient.id }),
      })
        .then((r) => r.json())
        .then((data) => {
          setExplanations((prev) => ({ ...prev, [match.ingredient.id]: data.explanation ?? null }));
          if (data.explanation_structured) {
            setExplanationsStructured((prev) => ({ ...prev, [match.ingredient.id]: data.explanation_structured }));
          }
        })
        .catch(() => {});
    }
    requestAnimationFrame(() => {
      document.getElementById(rowKey)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function handleUnreviewedClick(name: string) {
    setShowUnreviewed(true);
    requestAnimationFrame(() => {
      document.getElementById(`unreviewed-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function scanVariant(opts: { productId?: string; pasteIngredients?: string; productName?: string; productBrand?: string | null }, preservePinned = false) {
    setLoading(true);
    setNotFound(false); setIHerbBlocked(false);
    setResult(null);
    setShowUnreviewed(false);
    setShowObfVariants(false);
    setExpanded(new Set());
    setExplanations({});
    setExplanationsStructured({});
    setConcernExpanded(new Set());
    setNeutralGroupOpen(false);
    setAlternatives([]);
    setAlternativesLoading(false);
    setAlternativesFetched(false);
    setAlternativesOpen(true);
    setImageUploadOpen(false);
    setImageUploadUrl("");
    setImageUploading(false);
    setUploadError(null);
    setAutoSearching(false);
    setAutoSearchResult(null);
    setReviewLoading(false);
    setReviewResult(null);
    setSubmitOpen(false);
    setReportOpen(false);
    setReportDone(false);
    setSaveListOpen(false);
    setNewListInputOpen(false);
    setNewListName("");
    setSaveListLoading(null);
    setSavedTo(null);
    setSuggestLinkOpen(false);
    setSuggestLinkUrl("");
    setSuggestLinkError(null);

    const body = opts.productId
      ? { type: "search", query, productId: opts.productId }
      : { type: "paste", ingredients: opts.pasteIngredients };

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!data.flagged) return;

    // For OBF variant paste, inject the product name/brand since paste type doesn't return product meta
    if (opts.pasteIngredients && opts.productName) {
      data.product = {
        name: opts.productName,
        brand: opts.productBrand ?? null,
        source: "openbeautyfacts",
      };
    }
    setResult(data);
    if (!preservePinned && data.communityVariants?.length && data.product?.id) {
      setPinnedVariants(data.communityVariants);
      setPinnedTopProduct({
        id: data.product.id,
        name: data.product.name,
        brand: data.product.brand ?? null,
        type: data.product.type ?? null,
        image_url: data.product.image_url ?? null,
        flaggedCount: data.flagged?.length ?? 0,
        sensoryCount: data.sensoryTrigger?.length ?? 0,
        photoCount: data.photosensitive?.length ?? 0,
      });
      setActiveVariantId(data.product.id);
    }
  }

  async function handleDymVariantClick(variantId: string) {
    if (variantId === activeVariantId) {
      document.getElementById("product-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scrollToProductRef.current = true;
    setActiveVariantId(variantId);
    await scanVariant({ productId: variantId }, true);
  }

  async function fetchAlternatives() {
    if (!result?.flagged.length) return;
    const flaggedIds = result.flagged.map((m) => m.ingredient.id);
    setAlternativesLoading(true);
    const res = await fetch("/api/alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedIds, productType: result.product?.type ?? null }),
    });
    const data = await res.json();
    setAlternatives(data.results ?? []);
    setAlternativesLoading(false);
    setAlternativesFetched(true);
  }

  async function handleImageUpload() {
    if (!result?.product?.id || !imageUploadUrl.trim()) return;
    setImageUploading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/set-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: result.product.id, url: imageUploadUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
      } else {
        setResult((prev) =>
          prev ? { ...prev, product: prev.product ? { ...prev.product, image_url: data.imageUrl } : prev.product } : prev
        );
        setImageUploadOpen(false);
        setImageUploadUrl("");
      }
    } catch {
      setUploadError("Upload failed");
    }
    setImageUploading(false);
  }

  async function handleReview() {
    setReviewLoading(true);
    setReviewResult(null);
    let totalInserted = 0;
    let totalProcessed = 0;
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch("/api/review-ingredients", { method: "POST" });
        const data = await res.json();
        totalInserted += data.reviewed ?? 0;
        totalProcessed += data.total ?? 0;
        setReviewResult({ reviewed: totalInserted, total: totalProcessed });
        if ((data.remaining ?? data.total) === 0) break;
      }
    } catch { /* stop on error */ }
    setReviewLoading(false);
  }

  async function handleEditProduct() {
    if (!result?.product?.id) return;
    setEditLoading(true);
    setEditError(null);
    setEditDone(false);
    try {
      const res = await fetch("/api/admin/update-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: result.product.id,
          name: editName || undefined,
          brand: editBrand || undefined,
          type: editType || undefined,
          ingredient_list: editIngredients || undefined,
          source_url: editSourceUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setEditDone(true);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              product: prev.product
                ? {
                    ...prev.product,
                    name: editName || prev.product.name,
                    brand: editBrand || prev.product.brand,
                    type: editType || prev.product.type,
                  }
                : prev.product,
            }
          : prev
      );
    } catch (e) {
      setEditError((e as Error).message);
    }
    setEditLoading(false);
  }

  async function handleAltImageSave(altId: string) {
    if (!altImageUrl.trim()) return;
    setAltImageSaving(true);
    try {
      const res = await fetch("/api/set-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: altId, url: altImageUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlternatives((prev) =>
          prev.map((a) => a.id === altId ? { ...a, image_url: data.imageUrl } : a)
        );
        setAltImageOpen(null);
        setAltImageUrl("");
      }
    } catch {
      // ignore
    }
    setAltImageSaving(false);
  }

  async function handleSuggestLink() {
    if (!result?.product?.id || !suggestLinkUrl.trim()) return;
    setSuggestLinkLoading(true);
    setSuggestLinkError(null);
    try {
      const res = await fetch("/api/suggest-purchase-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: result.product.id, url: suggestLinkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setSuggestLinkError(data.error ?? "Failed to save"); }
      else {
        setResult((prev) =>
          prev ? { ...prev, product: prev.product ? { ...prev.product, iherb_url: data.iherb_url } : prev.product } : prev
        );
        setSuggestLinkOpen(false);
        setSuggestLinkUrl("");
      }
    } catch { setSuggestLinkError("Failed to save"); }
    setSuggestLinkLoading(false);
  }

  async function handleSubmitProduct() {
    setSubmitLoading(true);
    setSubmitError(null);
    const body: Record<string, string> = { name: submitName.trim() };
    if (submitBrand.trim()) body.brand = submitBrand.trim();
    if (submitType) body.type = submitType;
    if (submitMode === "paste") body.ingredient_list = submitIngredients.trim();
    else body.url = submitUrl.trim();

    let submitRes: Response | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let submitData: any = {};
    try {
      submitRes = await fetch("/api/submit-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      submitData = await submitRes.json();
    } catch {
      setSubmitLoading(false);
      setSubmitError("Could not reach the server. Please try again.");
      return;
    }
    setSubmitLoading(false);

    if (submitRes.status === 409 && submitData.productId) {
      setSubmitOpen(false);
      scanVariant({ productId: submitData.productId });
      return;
    }
    if (!submitRes.ok) {
      const err = submitData.error;
      const msg = typeof err === "string" ? err : err?.message ?? submitData.message ?? "Submission failed";
      setSubmitError(msg);
      return;
    }
    setSubmitOpen(false);
    scanVariant({ productId: submitData.productId });
  }

  async function handleReport() {
    if (!result?.product?.id) return;
    setReportLoading(true);
    try {
      await fetch("/api/report-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: result.product.id, note: reportNote.trim() || null }),
      });
      setReportDone(true);
      setReportOpen(false);
    } catch {
      // ignore
    }
    setReportLoading(false);
  }

  async function openSaveList() {
    setSaveListOpen(true);
    if (!userListsLoaded) {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setUserLists(data.lists ?? []);
      setUserListsLoaded(true);
    }
  }

  async function addToList(listId: string, listName: string) {
    if (!result?.product?.id) return;
    setSaveListLoading(listId);
    await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: result.product.id }),
    });
    setSaveListLoading(null);
    setUserLists((prev) => prev.map((l) => l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l));
    setSavedTo(listName);
    setTimeout(() => { setSaveListOpen(false); setSavedTo(null); }, 1800);
  }

  async function createListAndAdd(name: string) {
    if (!result?.product?.id || !name.trim()) return;
    setSaveListLoading("new");
    setSaveListError(null);
    const createRes = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      setSaveListLoading(null);
      setSaveListError(createData.error ?? "Could not create list");
      return;
    }

    const addRes = await fetch(`/api/lists/${createData.list.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: result.product.id }),
    });
    if (!addRes.ok) {
      setSaveListLoading(null);
      setSaveListError("List created but could not add product");
      return;
    }

    setUserLists((prev) => [{ ...createData.list, itemCount: 1 }, ...prev]);
    setSaveListLoading(null);
    setNewListInputOpen(false);
    setNewListName("");
    setSavedTo(name.trim());
    setTimeout(() => { setSaveListOpen(false); setSavedTo(null); }, 1800);
  }

  function addToRoutine() {
    if (!result?.product) return;
    const newEntry: RoutineProduct = {
      routineId: Date.now().toString(),
      name: result.product.name,
      brand: result.product.brand ?? null,
      step_tags: result.step_tags ?? [],
      ingredients: result.originalItems,
      flaggedCategories: result.flagged.map((f) => f.ingredient.flagged_category ?? "").filter(Boolean),
    };
    setRoutineProducts((prev) => [...prev, newEntry]);
    setAddedToRoutine(true);
    setTimeout(() => setAddedToRoutine(false), 2000);
  }

  function removeFromRoutine(routineId: string) {
    setRoutineProducts((prev) => prev.filter((p) => p.routineId !== routineId));
  }

  function toggleSkinType(t: SkinType) {
    setActiveSkinTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      try { localStorage.setItem("skindex:skinTypes", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function toggleClimate(c: ClimateType) {
    setActiveClimates((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      try { localStorage.setItem("skindex:climates", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function filterNotes(notes: SkinClimateNote[] | null | undefined): SkinClimateNote[] {
    if (!notes?.length) return [];
    return notes.filter((n) => {
      const skinMatch = n.dimensions.length === 0 || n.dimensions.some((d) => activeSkinTypes.has(d as SkinType));
      const climateMatch = n.climate.length === 0 || n.climate.some((c) => activeClimates.has(c as ClimateType));
      // Notes constrained on both axes: show if either matches
      if (n.dimensions.length > 0 && n.climate.length > 0) return skinMatch || climateMatch;
      return skinMatch && climateMatch;
    });
  }

  function switchToPaste(prefill?: string) {
    setTab("paste");
    if (prefill) setIngredients(prefill);
    setResult(null);
    setNotFound(false); setIHerbBlocked(false);
    setLimitReached(false);
  }

  function resetTab(t: Tab) {
    setTab(t);
    setResult(null);
    setNotFound(false); setIHerbBlocked(false);
    setLimitReached(false);
    if (t === "browse" && browseTypes.length === 0) {
      setBrowseLoading(true);
      fetch("/api/browse").then((r) => r.json()).then((d) => {
        setBrowseTypes(d.types ?? []);
        setBrowseLoading(false);
      });
    }
  }

  async function selectBrowseType(typeName: string) {
    setBrowseSelectedType(typeName);
    setBrowseProducts([]);
    setBrowseLoading(true);
    const res = await fetch(`/api/browse?type=${encodeURIComponent(typeName)}`);
    const data = await res.json();
    setBrowseProducts(data.products ?? []);
    setBrowseLoading(false);
  }

  const addTabUrls = importUrls.split("\n").map((l) => l.trim()).filter(Boolean);
  const addTabUrlCount = addTabUrls.length;

  const canScan =
    tab === "search" ? query.trim().length > 0
    : tab === "paste" ? ingredients.trim().length > 0
    : tab === "add" ? addTabUrlCount === 1
    : false;

  return (
    <div>
      {/* Hamburger backdrop */}
      {hamburgerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setHamburgerOpen(false)} aria-hidden />
      )}
      {/* Sticky header */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white transition-transform duration-200 ${showStickyHeader ? "translate-y-0 shadow-sm" : "-translate-y-full"}`}>
        {/* Row 1: logo + search + auth */}
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => resetTab("browse")}
            className="tracking-tight select-none shrink-0 text-left"
          >
            <span className="font-black">SKIN</span>
            <span className="font-light text-gray-500">dex</span>
          </button>
          <span className="hidden sm:block text-sm text-gray-400 shrink-0">Scan your skincare</span>
          <div className="flex-1" />
          {stickySearchOpen ? (
            <form
              className="flex items-center gap-2 flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const q = stickyQuery.trim();
                if (!q) return;
                setStickySearchOpen(false);
                setStickyQuery("");
                setTab("search");
                setQuery(q);
                handleScan({ tab: "search", query: q });
              }}
            >
              <input
                ref={stickySearchRef}
                value={stickyQuery}
                onChange={(e) => setStickyQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setStickySearchOpen(false); setStickyQuery(""); } }}
                placeholder="Search products…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400"
                autoFocus
              />
              <button type="button" onClick={() => { setStickySearchOpen(false); setStickyQuery(""); }} className="text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setStickySearchOpen(true)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
              <Search size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setHamburgerOpen((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Menu size={18} />
          </button>
        </div>
        {/* Row 2: product context */}
        {showStickyProduct && result?.product && (
          <div className="border-t border-gray-100 max-w-2xl mx-auto px-6 py-2 flex items-center gap-3">
            {result.product.image_url && (
              <img
                src={proxyImage(result.product.image_url)!}
                alt=""
                className="w-8 h-8 object-contain rounded bg-gray-50 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{result.product.name}</p>
              {result.product.brand && <p className="text-xs text-gray-400 truncate">{result.product.brand}</p>}
            </div>
          </div>
        )}
        {/* Drawer */}
        {hamburgerOpen && (
          <div className="border-t border-gray-100 bg-white">
            <div className="max-w-2xl mx-auto px-6 py-3 space-y-1">
              {isLoaded && isSignedIn && (
                <>
                  <Link href="/lists" onClick={() => setHamburgerOpen(false)} className="block text-sm text-gray-700 hover:text-gray-900 py-1.5">My Lists</Link>
                  {isAdmin && <Link href="/admin" onClick={() => setHamburgerOpen(false)} className="block text-sm text-gray-700 hover:text-gray-900 py-1.5">Admin</Link>}
                  <div className="py-1.5">
                    <UserButton />
                  </div>
                </>
              )}
              {isLoaded && !isSignedIn && (
                <Link href="/sign-in" onClick={() => setHamburgerOpen(false)} className="block text-sm text-gray-700 hover:text-gray-900 py-1.5">Sign in</Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mode segmented control */}
      <div className="flex mb-3 rounded-full border border-gray-200 overflow-hidden">
        {([
          ["search", "Search Product"],
          ["paste", "Scan Ingredients"],
          ["add", "Add Product(s)"],
        ] as [Tab, string][]).map(([t, label], i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors${i > 0 ? " border-l border-gray-200" : ""}${
              tab === t ? " bg-gray-900 text-white" : " bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      {tab === "search" && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canScan && handleScan()}
          placeholder="e.g. CeraVe Moisturizing Cream"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-3"
        />
      )}
      {tab === "paste" && (
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Paste the full ingredients list here..."
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-3 resize-none font-mono leading-relaxed"
        />
      )}
      {tab === "add" && (
        <textarea
          value={importUrls}
          onChange={(e) => setImportUrls(e.target.value)}
          placeholder={"Paste a product URL to scan it (INCIDecoder or iHerb)\nPaste multiple URLs (one per line) to bulk import"}
          rows={4}
          disabled={!isSignedIn}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-1 resize-none font-mono leading-relaxed disabled:bg-gray-50 disabled:text-gray-400"
        />
      )}
      {tab === "add" && isSignedIn && (
        addTabUrlCount > 1
          ? <p className="text-xs text-gray-400 mb-3">{addTabUrlCount} URLs{addTabUrlCount > 50 ? " — first 50 will be imported" : ""}</p>
          : <div className="mb-3" />
      )}

      {tab === "add" ? (
        !isSignedIn ? (
          <Link href="/sign-in" className="block w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:border-gray-400 hover:text-gray-900 transition-colors text-center">
            Sign in to add products
          </Link>
        ) : addTabUrlCount >= 2 ? (
          <div className="space-y-4">
            <button
              onClick={async () => {
                const urls = addTabUrls;
                if (!urls.length) return;
                setImportLoading(true);
                setImportResults(null);
                try {
                  const res = await fetch("/api/bulk-import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ urls }),
                  });
                  const data = await res.json();
                  setImportResults(data.results ?? []);
                } catch {
                  setImportResults([]);
                } finally {
                  setImportLoading(false);
                }
              }}
              disabled={importLoading || addTabUrlCount === 0}
              className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {importLoading ? "Importing…" : "Import all"}
            </button>
            {importResults && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex-1">Import results</p>
                  {(() => { const n = importResults.filter((r) => r.status === "imported").length; return <span className={`text-xs ${n > 0 ? "text-green-700" : "text-gray-400"}`}>{n} imported</span>; })()}
                  {importResults.some((r) => r.status === "skipped") && <span className="text-xs text-gray-400">{importResults.filter((r) => r.status === "skipped").length} skipped</span>}
                  {importResults.some((r) => r.status === "failed") && <span className="text-xs text-rose-600">{importResults.filter((r) => r.status === "failed").length} failed</span>}
                </div>
                <div className="divide-y divide-gray-50">
                  {importResults.map((r, i) => (
                    <div key={i} className="px-4 py-2 flex items-start gap-3">
                      <span className={`text-xs shrink-0 mt-0.5 ${r.status === "imported" ? "text-green-600" : r.status === "skipped" ? "text-gray-400" : "text-rose-500"}`}>
                        {r.status === "imported" ? "✓" : r.status === "skipped" ? "→" : "✗"}
                      </span>
                      <div className="min-w-0">
                        {r.name ? (
                          <p className="text-xs text-gray-700 font-medium truncate">{r.brand ? `${r.brand} ` : ""}{r.name}</p>
                        ) : (
                          <p className="text-xs text-gray-400 truncate">{r.url}</p>
                        )}
                        <p className="text-xs text-gray-400">{
                          r.status === "imported" ? "Added to database" :
                          r.status === "skipped" ? "Already in database" :
                          r.reason === "iherb-blocked" ? "iHerb blocks imports — paste ingredients instead" :
                          r.reason === "rate-limited" ? "Rate limited (429)" :
                          r.reason === "blocked" ? "Blocked (403)" :
                          r.reason === "parse-failed" ? "Loaded but ingredients not found (200)" :
                          r.fetchError ? r.fetchError :
                          r.httpStatus ? `Failed (HTTP ${r.httpStatus})` :
                          "Could not extract ingredients"
                        }</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => handleScan()}
            disabled={!canScan || loading}
            className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Scanning…" : "Scan"}
          </button>
        )
      ) : tab !== "browse" ? (
        <button
          onClick={() => handleScan()}
          disabled={!canScan || loading}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      ) : null}

      {/* Browse grid — shown as background when no result */}
      {!result && !loading && !notFound && !limitReached && (
        <div className="mt-4">
          <p className="text-sm text-gray-400 text-center mb-5">Know what&apos;s in your skincare before it touches your skin.</p>

          {/* Skin profile — idle state */}
          <section className="mb-6">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full"
            >
              Skin profile
              {(activeSkinTypes.size + activeClimates.size) > 0 && (
                <span className="text-teal-600 font-medium normal-case tracking-normal">
                  {activeSkinTypes.size + activeClimates.size} active
                </span>
              )}
              <span className="text-gray-300 ml-auto">{profileOpen ? "▲" : "▼"}</span>
            </button>
            {profileOpen && (
              <div className="mt-2 space-y-2 border border-gray-100 rounded-xl p-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Skin type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SKIN_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleSkinType(value)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          activeSkinTypes.has(value)
                            ? "bg-teal-700 text-white border-teal-700"
                            : "text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Climate</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLIMATE_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleClimate(value)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          activeClimates.has(value)
                            ? "bg-teal-700 text-white border-teal-700"
                            : "text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Water quality</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WATER_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleClimate(value)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          activeClimates.has(value)
                            ? "bg-teal-700 text-white border-teal-700"
                            : "text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(activeSkinTypes.size + activeClimates.size) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {[...activeSkinTypes].map((t) => (
                      <p key={t} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed border border-gray-100">{SKIN_TYPE_NOTES[t]}</p>
                    ))}
                    {[...activeClimates].map((c) => (
                      <p key={c} className={`text-xs rounded-lg px-2.5 py-1.5 leading-relaxed border ${c === "heavy_metal_water" ? "text-amber-800 bg-amber-50 border-amber-200" : "text-gray-600 bg-gray-50 border-gray-100"}`}>{CLIMATE_NOTES[c]}</p>
                    ))}
                    {(() => {
                      const watches = profileWatchCategories(activeSkinTypes, activeClimates);
                      return watches.length > 0 ? (
                        <p className="text-xs text-gray-400 pt-0.5">Flags: {watches.join(" · ")}.</p>
                      ) : null;
                    })()}
                    <p className="text-xs text-gray-400">Matching profile notes replace the generic explanation when you expand each ingredient.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Routine panel — idle state */}
          <section className="mb-6">
            <button
              type="button"
              onClick={() => setRoutineOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full"
            >
              Routine
              {routineProducts.length > 0 && (
                <span className="text-teal-600 font-medium normal-case tracking-normal">
                  {routineProducts.length} product{routineProducts.length !== 1 ? "s" : ""}
                </span>
              )}
              <span className="text-gray-300 ml-auto">{routineOpen ? "▲" : "▼"}</span>
            </button>
            {routineOpen && (
              <div className="mt-2 border border-gray-100 rounded-xl p-3 space-y-3">
                {routineProducts.length === 0 ? (
                  <p className="text-xs text-gray-400">No products yet. Scan a product and tap &quot;+ Add to routine&quot; to start building.</p>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      {routineProducts.map((p) => (
                        <div key={p.routineId} className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                            {p.brand && <p className="text-[10px] text-gray-400">{p.brand}</p>}
                            {p.step_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.step_tags.map((tag) => {
                                  const cfg = STEP_TAG_CONFIG[tag];
                                  if (!cfg) return null;
                                  return <span key={tag} title={cfg.desc} className={`text-[10px] px-1.5 py-0.5 rounded-full border cursor-default ${cfg.className}`}>{cfg.label}</span>;
                                })}
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => removeFromRoutine(p.routineId)} className="text-[10px] text-gray-300 hover:text-rose-400 shrink-0 mt-0.5">Remove</button>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const routineWarns = detectRoutineWarnings(routineProducts);
                      if (!routineWarns.length) return null;
                      return (
                        <div className="space-y-2 border-t border-gray-100 pt-2">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Interactions</p>
                          {routineWarns.map((w, i) => (
                            <div key={i} className={`rounded-lg border px-3 py-2 ${w.type === "danger" ? "border-amber-200 bg-amber-50" : "border-teal-100 bg-teal-50"}`}>
                              <p className={`text-[10px] font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-800" : "text-teal-800"}`}>{w.type === "danger" ? "⚠ " : "✦ "}{w.title}</p>
                              <p className={`text-[10px] leading-relaxed ${w.type === "danger" ? "text-amber-700" : "text-teal-700"}`}>{w.body}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <button type="button" onClick={() => setRoutineProducts([])} className="text-[10px] text-gray-300 hover:text-rose-400">Clear routine</button>
                  </>
                )}
              </div>
            )}
          </section>

          {browseLoading && !browseSelectedType && (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          )}
          {!browseLoading && !browseSelectedType && browseTypes.length > 0 && (
            <>
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-widest mb-3">Browse</p>
            <div className="space-y-5">
              {(() => {
                const AREA_ORDER = ["Face", "Body", "Hair", "Lip", "Makeup", "Sun"];
                const grouped = new Map<string, BrowseType[]>();
                const ungrouped: BrowseType[] = [];
                for (const t of browseTypes) {
                  const area = typeBodyAreaMap.get(t.name);
                  if (area) {
                    if (!grouped.has(area)) grouped.set(area, []);
                    grouped.get(area)!.push(t);
                  } else {
                    ungrouped.push(t);
                  }
                }
                const typeButton = (t: BrowseType) => (
                  <button
                    key={t.name}
                    onClick={() => selectBrowseType(t.name)}
                    className="text-sm text-gray-700 border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 hover:text-gray-900 transition-colors"
                  >
                    {t.name} <span className="text-gray-400 text-xs">{t.count}</span>
                  </button>
                );
                const areaSection = (label: string, types: BrowseType[]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">{types.map(typeButton)}</div>
                  </div>
                );
                const sections: React.ReactNode[] = [];
                for (const area of AREA_ORDER) {
                  const types = grouped.get(area);
                  if (types?.length) { sections.push(areaSection(area, types)); grouped.delete(area); }
                }
                for (const [area, types] of grouped) sections.push(areaSection(area, types));
                if (ungrouped.length > 0) sections.push(areaSection("Other", ungrouped));
                return sections;
              })()}
            </div>
            </>
          )}
          {browseSelectedType && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => { setBrowseSelectedType(null); setBrowseProducts([]); }}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  ← All types
                </button>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-sm font-medium text-gray-700">{browseSelectedType}</span>
              </div>
              {browseLoading && <p className="text-sm text-gray-400 text-center py-6">Loading…</p>}
              {!browseLoading && browseProducts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No products found.</p>
              )}
              <div className="space-y-2">
                {browseProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { resetTab("search"); setQuery(p.name); handleScan({ tab: "search", query: p.name }); }}
                    className="w-full flex items-center gap-3 border border-gray-300 rounded-xl p-3 text-left hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    {p.image_url && (
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(p.image_url)}`}
                        alt={p.name}
                        className="w-10 h-10 object-contain rounded-lg bg-gray-50 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate" title={p.name}>{p.name}</p>
                      {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.flaggedCount === 0 && p.sensoryCount === 0 && p.photoCount === 0 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-50 text-green-700">Safe</span>
                      ) : (
                        <>
                          {p.flaggedCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700">{p.flaggedCount} flagged</span>}
                          {p.sensoryCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{p.sensoryCount} sensory triggers</span>}
                          {p.photoCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700">{p.photoCount} photosensitive</span>}
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Limit reached */}
      {limitReached && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 text-center">
          You&apos;ve used your 5 daily URL scans. Come back tomorrow, or{" "}
          <button className="underline font-medium" onClick={() => switchToPaste()}>
            paste the ingredients
          </button>{" "}
          instead.
        </div>
      )}

      {/* iHerb blocked */}
      {iHerbBlocked && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
          iHerb blocks automated requests.{" "}
          Copy the ingredient list from the product page and{" "}
          <button className="underline text-gray-700" onClick={() => switchToPaste()}>
            paste it here
          </button>{" "}
          instead. You can also find most iHerb products on{" "}
          <a href="https://incidecoder.com" target="_blank" rel="noopener noreferrer" className="underline text-gray-700">INCIDecoder</a>{" "}
          and paste that URL.
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
          No ingredients found.{" "}
          <button className="underline text-gray-700" onClick={() => switchToPaste()}>
            Paste the ingredient list
          </button>
          {" "}instead.
          {isSignedIn && !submitOpen && (
            <>
              {" "}Or{" "}
              <button
                className="underline text-gray-700"
                onClick={() => { setSubmitOpen(true); setSubmitName(query); }}
              >
                add it to the database
              </button>.
            </>
          )}
        </div>
      )}

      {/* Community submission form */}
      {submitOpen && (
        <div className="mt-4 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Add this product</p>
          <input
            value={submitName}
            onChange={(e) => setSubmitName(e.target.value)}
            placeholder="Product name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={submitBrand}
              onChange={(e) => setSubmitBrand(e.target.value)}
              placeholder="Brand (optional)"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            <select
              value={submitType}
              onChange={(e) => setSubmitType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
            >
              <option value="">Type (optional)</option>
              {PRODUCT_TYPE_GROUPS.map(({ label, types }) => (
                <optgroup key={label} label={label}>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setSubmitMode("paste")}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${submitMode === "paste" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}
            >
              Paste list
            </button>
            <button
              type="button"
              onClick={() => setSubmitMode("url")}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${submitMode === "url" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}
            >
              From URL
            </button>
          </div>
          {submitMode === "paste" ? (
            <textarea
              value={submitIngredients}
              onChange={(e) => setSubmitIngredients(e.target.value)}
              placeholder="Paste the full ingredients list here…"
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none font-mono leading-relaxed"
            />
          ) : (
            <input
              type="url"
              value={submitUrl}
              onChange={(e) => setSubmitUrl(e.target.value)}
              placeholder="https://sephora.com/product/..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          )}
          {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmitProduct}
              disabled={submitLoading || !submitName.trim() || (submitMode === "paste" ? !submitIngredients.trim() : !submitUrl.trim())}
              className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitLoading ? "Submitting…" : "Submit product"}
            </button>
            <button
              type="button"
              onClick={() => setSubmitOpen(false)}
              className="text-sm text-gray-400 hover:text-gray-700 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Did you mean */}
      {pinnedTopProduct && pinnedVariants && pinnedVariants.length > 0 && (
        <div id="did-you-mean" className="mt-8">
          <button
            type="button"
            onClick={() => setDymOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5"
          >
            Did you mean
            <span className="text-gray-300">{dymOpen ? "▲" : "▼"}</span>
          </button>
          {dymOpen && <div className="flex flex-col space-y-2">
            {[pinnedTopProduct, ...pinnedVariants].map((v) => {
              const isActive = v.id === activeVariantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleDymVariantClick(v.id)}
                  className={`flex gap-3 p-3 text-left w-full transition-colors rounded-xl border${isActive ? " bg-gray-100 border-gray-400" : " border-gray-300 hover:border-gray-400 hover:bg-gray-50"}`}
                >
                  <div className="w-12 shrink-0">
                    {v.image_url ? (
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(v.image_url)}`}
                        alt={v.name}
                        className="w-12 h-14 object-contain rounded-lg bg-gray-50"
                      />
                    ) : (
                      <div className="w-12 h-14 rounded-lg bg-gray-50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div>
                      <p className={`text-sm leading-snug${isActive ? " font-semibold text-gray-900" : " font-medium text-gray-800"}`}>{v.name}</p>
                      {v.brand && <p className={`text-xs mt-0.5${isActive ? " text-gray-600" : " text-gray-400"}`}>{v.brand}</p>}
                      {v.type && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[typeBodyAreaMap.get(v.type), v.type].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {v.flaggedCount === 0 && v.sensoryCount === 0 && v.photoCount === 0 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-50 text-green-700">Safe</span>
                      ) : (
                        <>
                          {v.flaggedCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700">{v.flaggedCount} flagged</span>}
                          {v.sensoryCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{v.sensoryCount} sensory triggers</span>}
                          {v.photoCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700">{v.photoCount} photosensitive</span>}
                        </>
                      )}
                      {isActive && <span className="text-xs text-gray-500">↓ viewing</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-8">

          <div className="space-y-4">
          {/* Product header */}
          {result.product && (
            <div id="product-card" className="flex flex-col sm:flex-row rounded-xl border border-gray-100 overflow-hidden">
              {/* Image panel */}
              <div className={`sm:w-64 shrink-0 bg-gray-50${result.product.image_url ? "" : " flex items-center justify-center min-h-[200px]"}`}>
                {result.product.image_url ? (
                  <Image
                    src={proxyImage(result.product.image_url)!}
                    width={256}
                    height={384}
                    alt=""
                    className="w-full object-contain p-3 sm:max-h-[60vh]"
                    style={{ height: "auto" }}
                    sizes="(max-width: 640px) 100vw, 256px"
                    unoptimized
                  />
                ) : (
                  <CategoryIcon type={result.product.type} size={32} />
                )}
              </div>

              {/* Details panel */}
              <div className="flex-1 p-2 sm:p-3 flex flex-col justify-center gap-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 leading-snug">
                  {result.product.source === "url-extract"
                    ? (() => { try { return new URL(result.product.name).hostname.replace("www.", ""); } catch { return result.product.name; } })()
                    : result.product.name}
                </h2>
                {result.product.type && (
                  <p className="text-xs text-gray-400">
                    {[typeBodyAreaMap.get(result.product.type), result.product.type].filter(Boolean).join(" · ")}
                  </p>
                )}
                {(result.product.brand || result.product.iherb_url || (isSignedIn && result.product.id)) && (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                      {result.product.brand && (
                        <button
                          type="button"
                          onClick={() => { setTab("search"); setQuery(result.product!.brand!); handleScan({ tab: "search", query: result.product!.brand! }); }}
                          className="hover:underline underline-offset-2"
                        >
                          {result.product.brand}
                        </button>
                      )}
                      {result.product.iherb_url ? (
                        <>
                          {result.product.brand && <span className="text-gray-300">·</span>}
                          <a
                            href={withRcode(result.product.iherb_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline underline-offset-2"
                          >
                            iHerb ↗
                          </a>
                        </>
                      ) : (isSignedIn && result.product.id && !suggestLinkOpen) ? (
                        <>
                          {result.product.brand && <span className="text-gray-300">·</span>}
                          <button
                            type="button"
                            onClick={() => setSuggestLinkOpen(true)}
                            className="text-xs text-gray-300 hover:text-gray-500 underline underline-offset-2"
                          >
                            + iHerb link
                          </button>
                        </>
                      ) : null}
                    </p>
                    {suggestLinkOpen && result.product.id && (
                      <div className="flex gap-1.5 items-center flex-wrap">
                        <input
                          type="url"
                          value={suggestLinkUrl}
                          onChange={(e) => { setSuggestLinkUrl(e.target.value); setSuggestLinkError(null); }}
                          onKeyDown={(e) => e.key === "Enter" && !suggestLinkLoading && handleSuggestLink()}
                          placeholder="iHerb product URL"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 w-52"
                        />
                        <button
                          type="button"
                          onClick={handleSuggestLink}
                          disabled={suggestLinkLoading || !suggestLinkUrl.trim()}
                          className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40"
                        >
                          {suggestLinkLoading ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSuggestLinkOpen(false); setSuggestLinkUrl(""); setSuggestLinkError(null); }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                        {suggestLinkError && <span className="text-xs text-rose-600">{suggestLinkError}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Leave-on / Rinse-off toggle */}
                <div className="flex items-center gap-1 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsRinseOff(false)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${!isRinseOff ? "bg-gray-800 text-white border-gray-800" : "text-gray-400 border-gray-200 hover:border-gray-400"}`}
                  >
                    Leave-on
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRinseOff(true)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${isRinseOff ? "bg-gray-800 text-white border-gray-800" : "text-gray-400 border-gray-200 hover:border-gray-400"}`}
                  >
                    Rinse-off
                  </button>
                </div>

                {/* Step tags */}
                {(result.step_tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {result.step_tags!.map((tag) => {
                      const cfg = STEP_TAG_CONFIG[tag];
                      if (!cfg) return null;
                      return (
                        <span key={tag} title={cfg.desc} className={`text-xs px-2 py-0.5 rounded-full border cursor-default ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Add to routine */}
                <div className="flex items-center gap-2 mt-2">
                  {(() => {
                    const inRoutine = routineProducts.some((p) => p.name === result.product?.name);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (inRoutine) {
                            const id = routineProducts.find((p) => p.name === result.product?.name)?.routineId;
                            if (id) removeFromRoutine(id);
                          } else {
                            addToRoutine();
                          }
                        }}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          addedToRoutine
                            ? "border-teal-600 text-teal-600"
                            : inRoutine
                            ? "border-gray-300 text-gray-400 hover:border-rose-400 hover:text-rose-500"
                            : "border-gray-200 text-gray-500 hover:border-teal-600 hover:text-teal-600"
                        }`}
                      >
                        {addedToRoutine ? "Added to routine ✓" : inRoutine ? "In routine · Remove" : "+ Add to routine"}
                      </button>
                    );
                  })()}
                </div>

                {/* Image upload / change — signed-in users only */}
                {result.product.id && isSignedIn && (
                  <div className="mt-1 space-y-1">
                    {!imageUploadOpen ? (
                      <div className="flex gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => { setImageUploadOpen(true); setAutoSearchResult(null); }}
                          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
                        >
                          {result.product.image_url ? "Change image" : "Add image"}
                        </button>
                        <button
                          type="button"
                          disabled={autoSearching}
                          onClick={async () => {
                            setAutoSearching(true);
                            setAutoSearchResult(null);
                            const res = await fetch("/api/find-product-image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ productId: result.product!.id }),
                            });
                            const data = await res.json();
                            setAutoSearching(false);
                            if (data.imageUrl) {
                              setResult((prev) =>
                                prev ? { ...prev, product: prev.product ? { ...prev.product, image_url: data.imageUrl } : prev.product } : prev
                              );
                              setAutoSearchResult("found");
                            } else {
                              setAutoSearchResult("not-found");
                            }
                          }}
                          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 disabled:opacity-40"
                        >
                          {autoSearching ? "Searching…" : "Auto-search"}
                        </button>
                        {autoSearchResult === "not-found" && (
                          <span className="text-xs text-gray-400">No image found online</span>
                        )}
                        {autoSearchResult === "found" && (
                          <span className="text-xs text-gray-400">Image found</span>
                        )}
                        {result.product.image_url && (
                          <button
                            type="button"
                            disabled={imageRefetching}
                            onClick={async () => {
                              setImageRefetching(true);
                              const res = await fetch("/api/set-product-image", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ productId: result.product!.id, remove: true }),
                              });
                              const data = await res.json();
                              setResult((prev) =>
                                prev ? { ...prev, product: prev.product ? { ...prev.product, image_url: data.imageUrl ?? null } : prev.product } : prev
                              );
                              setImageRefetching(false);
                            }}
                            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 disabled:opacity-40"
                          >
                            {imageRefetching ? "Searching…" : "Remove image"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            value={imageUploadUrl}
                            onChange={(e) => setImageUploadUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !imageUploading && handleImageUpload()}
                            placeholder="Image or product page URL"
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-400 min-w-0"
                          />
                          <button
                            type="button"
                            onClick={handleImageUpload}
                            disabled={imageUploading || !imageUploadUrl.trim()}
                            className="text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0"
                          >
                            {imageUploading ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setImageUploadOpen(false); setUploadError(null); }}
                            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                        {uploadError && (
                          <p className="text-xs text-rose-600">{uploadError}</p>
                        )}
                      </div>
                    )}
                    {/* Inaccurate Info report */}
                    {reportDone ? (
                      <span className="text-xs text-gray-400">Thanks, we&apos;ll review it.</span>
                    ) : !reportOpen ? (
                      <button
                        type="button"
                        onClick={() => setReportOpen(true)}
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
                      >
                        Inaccurate info
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          value={reportNote}
                          onChange={(e) => setReportNote(e.target.value)}
                          placeholder="What's wrong? (optional)"
                          rows={2}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-400 resize-none"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={handleReport}
                            disabled={reportLoading}
                            className="text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-40"
                          >
                            {reportLoading ? "Sending…" : "Send report"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportOpen(false)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin edit form */}
                {result.product.id && isAdmin && (
                  <div className="mt-1">
                    {!editOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditSourceUrl(result.product?.source_url ?? "");
                          setEditOpen(true);
                        }}
                        className="text-xs text-indigo-500 underline underline-offset-2 hover:text-indigo-700"
                      >
                        Edit product
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <p className="text-xs font-medium text-indigo-600">Admin edit</p>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Product name"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                        />
                        <input
                          value={editBrand}
                          onChange={(e) => setEditBrand(e.target.value)}
                          placeholder="Brand"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                        />
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                        >
                          <option value="">Type (optional)</option>
                          {PRODUCT_TYPE_GROUPS.map(({ label, types }) => (
                            <optgroup key={label} label={label}>
                              {types.map((t) => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <textarea
                          value={editIngredients}
                          onChange={(e) => setEditIngredients(e.target.value)}
                          placeholder="Ingredient list (leave blank to keep current)"
                          rows={3}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 resize-none"
                        />
                        <input
                          type="url"
                          value={editSourceUrl}
                          onChange={(e) => setEditSourceUrl(e.target.value)}
                          placeholder="Source URL (INCIDecoder link)"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                        />
                        {editError && <p className="text-xs text-rose-600">{editError}</p>}
                        {editDone && <p className="text-xs text-teal-600">Saved.</p>}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={handleEditProduct}
                            disabled={editLoading}
                            className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40"
                          >
                            {editLoading ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditOpen(false); setEditError(null); setEditDone(false); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {result.product.id && isSignedIn && (
                  <div className="mt-2">
                    {savedTo ? (
                      <p className="text-xs text-teal-700">✓ Saved to {savedTo}</p>
                    ) : !saveListOpen ? (
                      <button
                        type="button"
                        onClick={openSaveList}
                        className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-800"
                      >
                        + Save to a list
                      </button>
                    ) : (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="divide-y divide-gray-100">
                          {!userListsLoaded && (
                            <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>
                          )}
                          {userListsLoaded && userLists.length === 0 && !newListInputOpen && (
                            <p className="px-4 py-3 text-xs text-gray-400">No lists yet — create one below.</p>
                          )}
                          {userLists.map((list) => (
                            <button
                              key={list.id}
                              type="button"
                              onClick={() => addToList(list.id, list.name)}
                              disabled={saveListLoading === list.id}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-gray-50 disabled:opacity-40"
                            >
                              <span className="text-gray-800">{list.name}</span>
                              <span className="text-xs text-gray-400">
                                {saveListLoading === list.id ? "Adding…" : `${list.itemCount} product${list.itemCount !== 1 ? "s" : ""}`}
                              </span>
                            </button>
                          ))}
                          {!newListInputOpen ? (
                            <button
                              type="button"
                              onClick={() => setNewListInputOpen(true)}
                              className="w-full px-4 py-2.5 text-sm text-gray-400 text-left hover:bg-gray-50"
                            >
                              + New list
                            </button>
                          ) : (
                            <div className="flex gap-2 px-4 py-2.5">
                              <input
                                autoFocus
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && newListName.trim() && createListAndAdd(newListName)}
                                placeholder="List name"
                                className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-gray-400 min-w-0"
                              />
                              <button
                                type="button"
                                onClick={() => createListAndAdd(newListName)}
                                disabled={!newListName.trim() || saveListLoading === "new"}
                                className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0"
                              >
                                {saveListLoading === "new" ? "Creating…" : "Create"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setNewListInputOpen(false); setNewListName(""); setSaveListError(null); }}
                                className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {saveListError && (
                            <p className="px-4 py-2 text-xs text-rose-600">{saveListError}</p>
                          )}
                        </div>
                        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => setSaveListOpen(false)}
                            className="text-xs text-gray-400 hover:text-gray-700"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          </div>

          {/* Summary line + safe alternatives group */}
          <div className="space-y-2">
          {(result.flagged.length + result.safe.length + result.unreviewed.length) > 0 && (
            <p className="text-xs -mt-2">
              <span className="text-gray-700">{result.flagged.length + result.safe.length + result.unreviewed.length} ingredient{(result.flagged.length + result.safe.length + result.unreviewed.length) !== 1 ? "s" : ""} scanned</span>
              {" · "}
              <button
                type="button"
                className={`${result.flagged.length > 0 ? "text-rose-700" : "text-gray-400"} hover:underline underline-offset-2`}
                onClick={() => document.getElementById("section-by-concern")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {result.flagged.length} flagged
              </button>
              {(result.sensoryTrigger ?? []).length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-amber-700 hover:underline underline-offset-2"
                    onClick={() => document.getElementById("section-by-concern")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {result.sensoryTrigger.length} sensory trigger{result.sensoryTrigger.length !== 1 ? "s" : ""}
                  </button>
                </>
              )}
              {(result.photosensitive ?? []).length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-yellow-700 hover:underline underline-offset-2"
                    onClick={() => document.getElementById("section-by-concern")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {result.photosensitive.length} photosensitive
                  </button>
                </>
              )}
              {" · "}
              <button
                type="button"
                className="text-teal-700 hover:underline underline-offset-2"
                onClick={() => document.getElementById("section-by-concern")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {result.safe.length} safe
              </button>
              {result.unreviewed.length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="hover:underline underline-offset-2"
                    onClick={() => {
                      setShowUnreviewed(true);
                      requestAnimationFrame(() => {
                        document.getElementById("section-unreviewed")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                  >
                    {result.unreviewed.length} unreviewed
                  </button>
                </>
              )}
            </p>
          )}

          {/* Safe alternatives */}
          {result.flagged.length > 0 && (
            <section>
              {!alternativesFetched && !alternativesLoading && (
                <button
                  type="button"
                  onClick={fetchAlternatives}
                  className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-800"
                >
                  Find safer alternatives →
                </button>
              )}
              {alternativesLoading && (
                <p className="text-sm text-gray-400">Finding alternatives…</p>
              )}
              {alternativesFetched && alternatives.length === 0 && (
                <p className="text-sm text-gray-400">No alternatives found in the database.</p>
              )}
              {alternatives.length > 0 && (
                <div className="mt-6">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3"
                    onClick={() => setAlternativesOpen((v) => !v)}
                  >
                    Safer alternatives — {alternatives.length}
                    <span className="text-gray-300">{alternativesOpen ? "▲" : "▼"}</span>
                  </button>
                  {alternativesOpen && <div className="space-y-2">
                    {alternatives.map((alt) => {
                      return (
                        <Fragment key={alt.id}>
                          <button
                            type="button"
                            onClick={() => scanVariant({ productId: alt.id })}
                            className="w-full text-left border border-gray-300 rounded-xl p-3 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex gap-3">
                              {alt.image_url ? (
                                <Image
                                  src={proxyImage(alt.image_url)!}
                                  width={48}
                                  height={56}
                                  alt=""
                                  className="object-contain rounded-lg border border-gray-100 bg-gray-50 shrink-0"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-12 h-14 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0">
                                  <CategoryIcon type={alt.type} size={18} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div>
                                  <p className="text-sm font-medium text-gray-800 leading-snug">{alt.name}</p>
                                  {alt.brand && <p className="text-xs text-gray-400">{alt.brand}</p>}
                                  {alt.type && (
                                    <p className="text-xs text-gray-400">
                                      {[typeBodyAreaMap.get(alt.type), alt.type].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {alt.flaggedCount === 0 && alt.sensoryCount === 0 && alt.photoCount === 0 ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-50 text-green-700">Safe</span>
                                  ) : (
                                    <>
                                      {alt.flaggedCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700">{alt.flaggedCount} flagged</span>}
                                      {alt.sensoryCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{alt.sensoryCount} sensory triggers</span>}
                                      {alt.photoCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700">{alt.photoCount} photosensitive</span>}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>}
                </div>
              )}
            </section>
          )}
          </div>{/* end summary + alternatives group */}

          {/* Skin profile toggles */}
          <section>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest"
            >
              Skin profile
              {(activeSkinTypes.size + activeClimates.size) > 0 && (
                <span className="text-teal-600 font-medium normal-case tracking-normal">
                  {activeSkinTypes.size + activeClimates.size} active
                </span>
              )}
              <span className="text-gray-300">{profileOpen ? "▲" : "▼"}</span>
            </button>
            {profileOpen && (
              <div className="mt-2 space-y-2 border border-gray-100 rounded-xl p-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Skin type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SKIN_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleSkinType(value)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          activeSkinTypes.has(value)
                            ? "bg-teal-700 text-white border-teal-700"
                            : "text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Climate</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLIMATE_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleClimate(value)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          activeClimates.has(value)
                            ? "bg-teal-700 text-white border-teal-700"
                            : "text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Water quality</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WATER_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleClimate(value)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          activeClimates.has(value)
                            ? "bg-teal-700 text-white border-teal-700"
                            : "text-gray-500 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(activeSkinTypes.size + activeClimates.size) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {[...activeSkinTypes].map((t) => (
                      <p key={t} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed border border-gray-100">{SKIN_TYPE_NOTES[t]}</p>
                    ))}
                    {[...activeClimates].map((c) => (
                      <p key={c} className={`text-xs rounded-lg px-2.5 py-1.5 leading-relaxed border ${c === "heavy_metal_water" ? "text-amber-800 bg-amber-50 border-amber-200" : "text-gray-600 bg-gray-50 border-gray-100"}`}>{CLIMATE_NOTES[c]}</p>
                    ))}
                    {(() => {
                      const watches = profileWatchCategories(activeSkinTypes, activeClimates);
                      return watches.length > 0 ? (
                        <p className="text-xs text-gray-400 pt-0.5">Flags: {watches.join(" · ")}.</p>
                      ) : null;
                    })()}
                    <p className="text-xs text-gray-400">Matching profile notes replace the generic explanation when you expand each ingredient.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Routine panel — results state */}
          <section className="mt-4">
            <button
              type="button"
              onClick={() => setRoutineOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full"
            >
              Routine
              {routineProducts.length > 0 && (
                <span className="text-teal-600 font-medium normal-case tracking-normal">
                  {routineProducts.length} product{routineProducts.length !== 1 ? "s" : ""}
                </span>
              )}
              <span className="text-gray-300 ml-auto">{routineOpen ? "▲" : "▼"}</span>
            </button>
            {routineOpen && (
              <div className="mt-2 border border-gray-100 rounded-xl p-3 space-y-3">
                {routineProducts.length === 0 ? (
                  <p className="text-xs text-gray-400">No products yet. Tap &quot;+ Add to routine&quot; on this product&apos;s card above to start building.</p>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      {routineProducts.map((p) => (
                        <div key={p.routineId} className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                            {p.brand && <p className="text-[10px] text-gray-400">{p.brand}</p>}
                            {p.step_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.step_tags.map((tag) => {
                                  const cfg = STEP_TAG_CONFIG[tag];
                                  if (!cfg) return null;
                                  return <span key={tag} title={cfg.desc} className={`text-[10px] px-1.5 py-0.5 rounded-full border cursor-default ${cfg.className}`}>{cfg.label}</span>;
                                })}
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => removeFromRoutine(p.routineId)} className="text-[10px] text-gray-300 hover:text-rose-400 shrink-0 mt-0.5">Remove</button>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const routineWarns = detectRoutineWarnings(routineProducts);
                      if (!routineWarns.length) return null;
                      return (
                        <div className="space-y-2 border-t border-gray-100 pt-2">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Interactions</p>
                          {routineWarns.map((w, i) => (
                            <div key={i} className={`rounded-lg border px-3 py-2 ${w.type === "danger" ? "border-amber-200 bg-amber-50" : "border-teal-100 bg-teal-50"}`}>
                              <p className={`text-[10px] font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-800" : "text-teal-800"}`}>{w.type === "danger" ? "⚠ " : "✦ "}{w.title}</p>
                              <p className={`text-[10px] leading-relaxed ${w.type === "danger" ? "text-amber-700" : "text-teal-700"}`}>{w.body}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <button type="button" onClick={() => setRoutineProducts([])} className="text-[10px] text-gray-300 hover:text-rose-400">Clear routine</button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Ingredients parent section */}
          <section className="space-y-8 mt-4">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
            Ingredients
          </p>

          {/* Full ingredient list — paragraph view */}
          {result.originalItems.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Full ingredient list
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm leading-relaxed select-text">
                {result.originalItems.map((item, i) => {
                  const match = getItemMatch(item, result.safe, result.flagged);
                  const photoItem = (result.photosensitive ?? []).find(
                    (p) => normalizeForMatch(p.rawName) === normalizeForMatch(item)
                  );
                  const sensoryItem = (result.sensoryTrigger ?? []).find(
                    (s) => normalizeForMatch(s.rawName) === normalizeForMatch(item)
                  );
                  const colorKey: keyof typeof paragraphColor =
                    match?.status === "flagged" ? "flagged"
                    : sensoryItem ? "sensory-trigger"
                    : photoItem ? "photo-sensitive"
                    : match?.status === "safe" ? "safe"
                    : "unreviewed";
                  const colorClass =
                    colorKey === "unreviewed" ? paragraphColor.unreviewed
                    : colorKey === "safe" ? "text-gray-700 font-medium"
                    : paragraphColor[colorKey];
                  return (
                    <Fragment key={i}>
                      <button
                        type="button"
                        className={`${colorClass} hover:underline underline-offset-2`}
                        onClick={() => {
                          if (match || photoItem || sensoryItem) {
                            handleIngredientClick(item, match, !!photoItem, !!sensoryItem);
                          } else {
                            handleUnreviewedClick(item);
                          }
                        }}
                      >
                        {smartCase(item)}
                      </button>
                      {i < result.originalItems.length - 1 && (
                        <span className="text-gray-400">, </span>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </section>
          )}

          {/* Formula combination warnings */}
          {(result.formula_warnings ?? []).length > 0 && (
            <section className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Formula interactions</p>
              <div className="space-y-2">
                {result.formula_warnings!.map((w, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border px-4 py-3 ${w.type === "danger" ? "border-amber-200 bg-amber-50" : "border-teal-100 bg-teal-50"}`}
                  >
                    <p className={`text-xs font-semibold mb-1 ${w.type === "danger" ? "text-amber-800" : "text-teal-800"}`}>
                      {w.type === "danger" ? "⚠ " : "✦ "}{w.title}
                    </p>
                    <p className={`text-xs leading-relaxed ${w.type === "danger" ? "text-amber-700" : "text-teal-700"}`}>{w.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* By concern — grouped ingredient view */}
          {result.originalItems.length > 0 && (() => {
            const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

            const RINSE_OFF_SUPPRESS_SENSORY_CATS = new Set(["Pilling", "Film-forming", "occlusive-itch", "comedogenic-itch"]);
            const RINSE_OFF_SUPPRESS_PHOTO_CATS = new Set(["photo-retinoid", "photo-BHA", "photo-brightening"]);

            type GroupItem = {
              item: string;
              match: ReturnType<typeof getItemMatch>;
              fullMatch: IngredientMatch | null;
              sensoryItem: SensoryTriggerItem | null;
              photoItem: PhotosensitiveItem | null;
            };
            const groups: Record<ConcernLevel, GroupItem[]> = {
              universal: [], "profile-matched": [], "non-matching": [], neutral: [],
            };

            for (const item of result.originalItems) {
              const match = getItemMatch(item, result.safe, result.flagged);
              const cleaned = normalizeForMatch(item.replace(/\([^)]*\)/g, ""));
              const fullMatch = result.flagged.find((m) => normalizeForMatch(m.displayName) === cleaned)
                ?? result.safe.find((m) => normalizeForMatch(m.displayName) === cleaned)
                ?? null;
              let sensoryItem = (result.sensoryTrigger ?? []).find(
                (s) => normalizeForMatch(s.rawName) === normalizeForMatch(item)
              ) ?? null;
              if (isRinseOff && sensoryItem && RINSE_OFF_SUPPRESS_SENSORY_CATS.has(sensoryItem.sensory_category ?? "")) {
                sensoryItem = null;
              }
              let photoItem = (result.photosensitive ?? []).find(
                (p) => normalizeForMatch(p.rawName) === normalizeForMatch(item)
              ) ?? null;
              if (isRinseOff && photoItem && RINSE_OFF_SUPPRESS_PHOTO_CATS.has(photoItem.photoCategory ?? "")) {
                photoItem = null;
              }
              const level = getIngredientConcernLevel(match, sensoryItem, photoItem, activeSkinTypes, activeClimates);
              if (level !== "skip") groups[level].push({ item, match, fullMatch, sensoryItem, photoItem });
            }

            const CONCERN_STRIPE: Record<ConcernLevel, string> = {
              universal:         "border-rose-500",
              "profile-matched": "border-amber-500",
              "non-matching":    "border-yellow-500",
              neutral:           "border-teal-500",
            };
            const CONCERN_PILL: Record<ConcernLevel, string> = {
              universal:         "bg-rose-50 text-rose-700",
              "profile-matched": "bg-amber-50 text-amber-700",
              "non-matching":    "bg-yellow-50 text-yellow-700",
              neutral:           "bg-teal-50 text-teal-700",
            };
            const GROUP_HEADER_COLOR: Record<ConcernLevel, string> = {
              universal:         "text-rose-700",
              "profile-matched": "text-amber-700",
              "non-matching":    "text-yellow-700",
              neutral:           "text-teal-700",
            };
            const GROUP_BORDER: Record<ConcernLevel, string> = {
              universal:         "border-rose-100 divide-rose-100",
              "profile-matched": "border-amber-100 divide-amber-100",
              "non-matching":    "border-yellow-100 divide-yellow-100",
              neutral:           "border-teal-100 divide-teal-100",
            };

            const renderConcernRow = ({ item, match, fullMatch, sensoryItem, photoItem }: GroupItem, level: ConcernLevel) => {
              const rowKey = `concern-${item}`;
              const isOpen = concernExpanded.has(rowKey);
              const ingId = match?.ingredient.id ?? null;
              const dbExplanation = match?.ingredient.explanation ?? null;
              const dbStructured = match?.ingredient.explanation_structured ?? null;
              const fetchedStructured = ingId ? (explanationsStructured[ingId] ?? null) : null;
              const structured = dbStructured ?? fetchedStructured;
              const explanation = dbExplanation ?? (ingId ? explanations[ingId] : null);
              const hasAnyExplanation = !!(structured || dbExplanation);
              const isLoading = isOpen && ingId !== null && !hasAnyExplanation && ingId in explanations && explanations[ingId] === null;

              const toggle = () => {
                setConcernExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(rowKey)) { next.delete(rowKey); return next; }
                  next.add(rowKey);
                  return next;
                });
                if (!isOpen && ingId && !hasAnyExplanation && !(ingId in explanations)) {
                  setExplanations((prev) => ({ ...prev, [ingId]: null }));
                  fetch("/api/explain", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: ingId }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      setExplanations((prev) => ({ ...prev, [ingId]: data.explanation ?? null }));
                      if (data.explanation_structured) {
                        setExplanationsStructured((prev) => ({ ...prev, [ingId]: data.explanation_structured }));
                      }
                    })
                    .catch(() => {});
                }
              };

              const structCat = match?.ingredient.structural_category ?? null;
              const fc = match?.ingredient.flagged_category ?? null;
              const safeCategory = match?.ingredient.category ?? null;
              const catLabel = fc ? (CATEGORY_LABELS[fc] ?? null) : null;
              const sensoryLabel = sensoryItem
                ? (SENSORY_CATEGORY_LABEL[sensoryItem.sensory_category ?? ""] ?? sensoryItem.sensory_category ?? null)
                : null;
              const photoLabel = photoItem
                ? (photoItem.sunLevel === "avoid" ? "Photosensitizer" : "Photo caution")
                : null;
              const concernLabel = catLabel ?? sensoryLabel ?? photoLabel;
              const benefitLabel = safeCategory ? (CATEGORY_LABELS[safeCategory] ?? safeCategory) : null;

              const rawClimateNotes = match?.ingredient.skin_climate_notes;
              const rawNotes: SkinClimateNote[] = Array.isArray(rawClimateNotes) ? rawClimateNotes : [];
              const allBenefitNotes = rawNotes.filter((n) => n.sentiment === "benefit");
              const profileBenefitNotes = filterNotes(rawNotes).filter((n) => n.sentiment === "benefit");
              const profileCautionNotes = filterNotes(rawNotes).filter(
                (n) => n.sentiment === "caution" || n.sentiment === "strong_caution"
              );

              return (
                <div key={rowKey} id={rowKey} className="overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                    onClick={toggle}
                  >
                    <span className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                      <span className={`text-sm font-medium truncate ${isOpen ? GROUP_HEADER_COLOR[level] : "text-gray-800"}`}>
                        {smartCase(item)}
                      </span>
                      {structCat && (
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 shrink-0">{structCat}</span>
                      )}
                      {concernLabel ? (
                        <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${CONCERN_PILL[level]}`}>{concernLabel}</span>
                      ) : benefitLabel ? (
                        <span className="text-xs bg-teal-50 text-teal-700 rounded-full px-2 py-0.5 shrink-0">{benefitLabel}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 ml-2 text-gray-300 text-xs">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {/* Formula role stripe — gray */}
                      {(() => {
                        const roleText = structured?.formula_role ?? (structCat ? STRUCTURAL_DESCRIPTIONS[structCat] : null);
                        if (!roleText && !fullMatch?.comedogenicRating) return null;
                        return (
                          <div className="pl-3 border-l-2 border-gray-300">
                            {roleText && <p className="text-xs text-gray-500 leading-relaxed">{roleText}</p>}
                            {fullMatch?.comedogenicRating && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                <span className="font-medium">{fullMatch.comedogenicRating}</span>
                                {fullMatch.comedogenicRating !== "oxid." ? " on the 0–5 scale" : " (oxidation-dependent)"}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      {/* Benefit stripe — teal */}
                      {(() => {
                        const benefitSentence = structured?.benefit ?? null;
                        const benefitNotes = match?.status === "flagged" ? allBenefitNotes : profileBenefitNotes;
                        const benefitNote = fullMatch?.benefit_note ?? null;
                        if (!benefitSentence && !benefitNotes.length && !benefitNote) return null;
                        return (
                          <div className="pl-3 border-l-2 border-teal-500 space-y-0.5">
                            {benefitSentence && (
                              <p className="text-xs text-teal-700 leading-relaxed">{benefitSentence}</p>
                            )}
                            {benefitNote && (
                              <p className="text-xs text-teal-700 leading-relaxed">{benefitNote}</p>
                            )}
                            {benefitNotes.map((note, i) => (
                              <p key={i} className="text-xs text-teal-700 leading-relaxed">
                                {noteLabel(note) && <span className="font-semibold">{noteLabel(note)} — </span>}
                                {note.text}
                              </p>
                            ))}
                          </div>
                        );
                      })()}
                      {/* Concern stripe — level-colored (non-neutral only) */}
                      {level !== "neutral" && (
                        <div className={`pl-3 border-l-2 ${CONCERN_STRIPE[level]} space-y-1`}>
                          {isLoading ? (
                            <p className="text-xs text-gray-400 italic">Generating explanation…</p>
                          ) : structured?.concern ? (
                            <p className="text-xs text-gray-600 leading-relaxed">{structured.concern}</p>
                          ) : explanation && !structured ? (
                            <p className="text-xs text-gray-600 leading-relaxed">{explanation}</p>
                          ) : null}
                          {sensoryItem?.sensory_note && (
                            <p className="text-xs text-gray-600 leading-relaxed">{sensoryItem.sensory_note}</p>
                          )}
                          {sensoryItem?.sensory_category === "Film-forming" && (
                            <p className="text-xs text-gray-400">Bump type: milia — small, hard, keratin-filled bumps just under the skin surface, not inside pores.</p>
                          )}
                          {sensoryItem?.sensory_category === "Occlusive" && (
                            <p className="text-xs text-gray-400">Bump type: worsens existing congestion by sealing the skin surface.</p>
                          )}
                          {photoItem?.photo_note && (
                            <p className="text-xs text-gray-600 leading-relaxed">{photoItem.photo_note}</p>
                          )}
                          {profileCautionNotes.length > 0 && (
                            <div className="space-y-0.5">
                              {profileCautionNotes.map((note, i) => (
                                <p key={i} className="text-xs text-gray-600 leading-relaxed">
                                  {noteLabel(note) && <span className="font-semibold">{noteLabel(note)} — </span>}
                                  {note.text}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Neutral: loading state if no structured data yet */}
                      {level === "neutral" && isLoading && (
                        <div className="pl-3 border-l-2 border-teal-500">
                          <p className="text-xs text-gray-400 italic">Generating explanation…</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            const renderGroup = (label: string, items: GroupItem[], level: ConcernLevel, isCollapsible = false) => {
              if (items.length === 0) return null;
              const borderColors = GROUP_BORDER[level];
              const headerColor = GROUP_HEADER_COLOR[level];
              const isGroupOpen = level === "neutral" ? neutralGroupOpen : true;
              return (
                <div className="mt-3">
                  <div
                    className={`flex items-center gap-2 ${headerColor} ${isCollapsible ? "cursor-pointer" : ""}`}
                    onClick={isCollapsible ? () => setNeutralGroupOpen((p) => !p) : undefined}
                    role={isCollapsible ? "button" : undefined}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider">{label} — {items.length}</span>
                    {isCollapsible && (
                      <span className="ml-auto text-xs opacity-50">{isGroupOpen ? "▲" : "▼"}</span>
                    )}
                  </div>
                  {(!isCollapsible || isGroupOpen) && (
                    <div className={`mt-1.5 border rounded-xl overflow-hidden divide-y ${borderColors}`}>
                      {items.map((g) => renderConcernRow(g, level))}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <section id="section-by-concern">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">By concern</p>
                {renderGroup("Universal concerns", groups.universal, "universal")}
                {hasProfile && renderGroup("Your profile", groups["profile-matched"], "profile-matched")}
                {groups["non-matching"].length > 0 && (
                  <>
                    {renderGroup(hasProfile ? "Other concerns" : "Flagged", groups["non-matching"], "non-matching")}
                    {!hasProfile && (
                      <p className="text-xs text-gray-400 mt-1 px-1">
                        Set your skin profile to see which of these are most relevant to you.
                      </p>
                    )}
                  </>
                )}
                {renderGroup("Neutral", groups.neutral, "neutral", true)}
              </section>
            );
          })()}

          {result.isIncomplete && (
            <p className="text-xs text-gray-400">
              This ingredient list may be incomplete.{" "}
              <button
                className="underline hover:text-gray-600"
                onClick={() => switchToPaste(result.product?.name)}
              >
                Add the full list manually
              </button>
            </p>
          )}


          {/* Unreviewed ingredients */}
          {result.unreviewed.length > 0 && (
            <section id="section-unreviewed">
              <div className="flex items-center justify-between gap-4">
                <button
                  className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-widest"
                  onClick={() => setShowUnreviewed((v) => !v)}
                >
                  Unreviewed — {result.unreviewed.length}
                  <span className="text-stone-300">{showUnreviewed ? "▲" : "▼"}</span>
                </button>
                {reviewLoading ? (
                  <span className="text-xs text-gray-400">
                    Reviewing{reviewResult && reviewResult.reviewed > 0 ? ` — ${reviewResult.reviewed} done` : "…"}
                  </span>
                ) : reviewResult ? (
                  <span className="text-xs text-gray-400">
                    {reviewResult.reviewed > 0
                      ? `${reviewResult.reviewed} classified — rescan to see results`
                      : reviewResult.total > 0
                      ? "Already in database — rescan to see results"
                      : "Queued for review — rescan later"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleReview}
                    className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 shrink-0"
                  >
                    Review now
                  </button>
                )}
              </div>
              {showUnreviewed && (
                <div className="mt-2 divide-y divide-stone-100">
                  {result.unreviewed.map((name) => (
                    <div
                      key={name}
                      id={`unreviewed-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                      className="border-l-2 border-stone-200 pl-3 py-0.5"
                    >
                      <span className="block text-sm text-stone-500">{smartCase(name)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {result.flagged.length === 0 && result.safe.length === 0 && result.unreviewed.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No ingredients found.</p>
          )}

          </section>{/* end Ingredients */}

          {/* OBF variants — collapsible "More variants from Open Beauty Facts" */}
          {result.obfVariants && result.obfVariants.length > 0 && (
            <section>
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest"
                onClick={() => setShowObfVariants((v) => !v)}
              >
                More variants from Open Beauty Facts
                <span className="text-gray-300">{showObfVariants ? "▲" : "▼"}</span>
              </button>
              {showObfVariants && (
                <div className="mt-2 divide-y divide-gray-100">
                  {result.obfVariants.map((v) => (
                    <div key={v.name} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="text-sm text-gray-700">{v.name}</p>
                        {v.brand && <p className="text-xs text-gray-400">{v.brand}</p>}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 shrink-0 ml-4"
                        onClick={() => scanVariant({
                          pasteIngredients: v.ingredients_text,
                          productName: v.name,
                          productBrand: v.brand,
                        })}
                      >
                        Scan this variant
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
