"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Pipette, FlaskConical, Droplet, Droplets, Waves, Sun, Sparkles, Wind, Bandage, Brush, Search, X, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DbIngredient, ExplanationStructured, IngredientMatch, PhotosensitiveItem, RoutineProduct, SensoryTriggerItem, ScanResult, AlternativeProduct, CommunityVariant, SkinClimateNote } from "@/types";
import { SENSORY_PROFILE_MAP } from "@/lib/sensory";

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
type BrowseProduct = { id: string; name: string; brand: string | null; image_url: string | null; ingredient_list: string | null; flaggedCount: number; sensoryCount: number; photoCount: number; universalConcernCount?: number; profileFlaggedCount?: number; profileSensoryCount?: number };
type IngredientList = { id: string; name: string; type?: "avoid" | "want"; items: string[] };

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

type SkinType = "oily" | "dry" | "reactive" | "damaged_barrier" | "acne_prone" | "mature" | "hyperpigmentation_prone" | "fungal_acne" | "rosacea" | "seborrheic" | "eczema" | "psoriasis" | "lupus_rash" | "keratosis_pilaris" | "body_acne";
type ClimateType = "humid" | "dry_climate" | "cold" | "hot" | "high_uv" | "hard_water" | "chlorinated_water" | "iron_water" | "heavy_metal_water" | "red_nir" | "blue_light" | "amber_light" | "vibration_sonic" | "heat_steam" | "microcurrent" | "iodine_load" | "phytoestrogen_load" | "anti_androgenic" | "vasodilating_supps" | "immune_stimulating" | "insulin_sensitizing" | "anabolic_dht" | "high_dose_b12" | "collagen_support" | "high_glycemic" | "dairy_regular" | "gluten_sensitive" | "histamine_foods" | "alcohol_regular" | "spicy_foods" | "high_iodine_diet" | "sulfites_diet" | "benzoates_diet" | "nitrites_diet" | "bha_bht_diet" | "propionates_diet" | "carmine_diet";

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: "oily", label: "Oily" },
  { value: "dry", label: "Dry" },
  { value: "reactive", label: "Reactive" },
  { value: "damaged_barrier", label: "Damaged barrier" },
  { value: "acne_prone", label: "Acne" },
  { value: "mature", label: "Mature" },
  { value: "hyperpigmentation_prone", label: "Hyperpigmentation" },
  { value: "fungal_acne", label: "Fungal acne" },
  { value: "rosacea", label: "Rosacea" },
  { value: "seborrheic", label: "Seborrheic" },
  { value: "eczema", label: "Eczema" },
  { value: "psoriasis", label: "Psoriasis" },
  { value: "lupus_rash", label: "Lupus rash" },
  { value: "keratosis_pilaris", label: "Keratosis pilaris" },
  { value: "body_acne", label: "Body acne" },
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

const DEVICE_TYPES: { value: ClimateType; label: string }[] = [
  { value: "red_nir", label: "Red / NIR" },
  { value: "blue_light", label: "Blue light" },
  { value: "amber_light", label: "Amber / yellow" },
  { value: "vibration_sonic", label: "Vibration / sonic" },
  { value: "heat_steam", label: "Heat / steam" },
  { value: "microcurrent", label: "Microcurrent" },
];

const SUPPLEMENT_TYPES: { value: ClimateType; label: string }[] = [
  { value: "iodine_load", label: "Iodine load" },
  { value: "phytoestrogen_load", label: "Phytoestrogen" },
  { value: "anti_androgenic", label: "Anti-androgenic" },
  { value: "vasodilating_supps", label: "Vasodilating" },
  { value: "immune_stimulating", label: "Immune stimulating" },
  { value: "insulin_sensitizing", label: "Insulin sensitizing" },
  { value: "anabolic_dht", label: "Anabolic / DHT" },
  { value: "high_dose_b12", label: "High-dose B12" },
  { value: "collagen_support", label: "Collagen support" },
];

const DIET_TYPES: { value: ClimateType; label: string }[] = [
  { value: "high_glycemic", label: "High glycemic" },
  { value: "dairy_regular", label: "Dairy" },
  { value: "gluten_sensitive", label: "Gluten" },
  { value: "histamine_foods", label: "Histamine foods" },
  { value: "alcohol_regular", label: "Alcohol" },
  { value: "spicy_foods", label: "Spicy foods" },
  { value: "high_iodine_diet", label: "High-iodine diet" },
  { value: "sulfites_diet", label: "Sulfites" },
  { value: "benzoates_diet", label: "Benzoates" },
  { value: "nitrites_diet", label: "Nitrites / nitrates" },
  { value: "bha_bht_diet", label: "BHT / BHA (food)" },
  { value: "propionates_diet", label: "Propionates" },
  { value: "carmine_diet", label: "Carmine / red dye" },
];

const ALL_MODIFIER_TYPES = [...CLIMATE_TYPES, ...WATER_TYPES, ...DEVICE_TYPES, ...SUPPLEMENT_TYPES, ...DIET_TYPES];

const SKIN_TYPE_NOTES: Record<SkinType, string> = {
  oily: "Oily skin still loses moisture in the minutes after washing. Apply your next product quickly — the itch in that window is what causes barrier damage, not the product itself.",
  dry: "Dry skin has a thinner lipid layer and loses water fastest in cold or dry air — drying solvents, sulfate surfactants, and clay are worth watching closely.",
  reactive: "Reactive skin has a lower tolerance threshold — sensitizers, fragrance allergens, and chemical sunscreens are worth watching closely, especially in warm weather.",
  damaged_barrier: "A compromised barrier lets ingredients penetrate faster and deeper — irritants and sensitizers hit harder and recovery takes longer than it would on intact skin.",
  acne_prone: "For acne skin, pore-clogging ingredients and film-formers are the main risks — watch the Congestion section after scanning.",
  mature: "Mature skin benefits most from peptides, ceramides, and emollients, and is more sensitive to the retinoid adjustment period — start at the lowest available concentration.",
  hyperpigmentation_prone: "For hyperpigmentation-prone skin, UV exposure directly undoes progress — many brightening actives also increase UV sensitivity, making daily SPF essential.",
  fungal_acne: "Fungal acne (Malassezia folliculitis) is caused by yeast, not bacteria — it looks like regular acne but doesn't respond to antibiotics or most OTC acne treatments. Many 'safe' moisturizing oils and fatty acid esters feed Malassezia. Scanning every formula matters more here than for almost any other skin type.",
  rosacea: "Rosacea triggers vary but commonly include heat, vasodilation, and chemical absorption. Chemical UV filters, alcohol-based formulas, menthol, warming agents, and high fragrance load are the main ingredient triggers — mineral sunscreens (zinc oxide, titanium dioxide) are strongly preferred.",
  seborrheic: "Seborrheic dermatitis is Malassezia-driven and affects the T-zone: scalp margins, brows, sides of the nose, and eyelids. Certain plant oils can worsen it. Zinc compounds, sulfur, and anti-Malassezia actives (zinc pyrithione, piroctone olamine, selenium sulfide) are specifically beneficial.",
  eczema: "Atopic eczema has specific preservative sensitivities. MI/MCI (methylisothiazolinone/methylchloroisothiazolinone) and IPBC are notorious eczema triggers. Ceramides, colloidal oatmeal, and thick emollients are specifically therapeutic here — unlike for acne, heavy barrier creams help rather than harm.",
  psoriasis: "Psoriasis causes rapid cell turnover and thick scale. Keratolytics like salicylic acid can help remove scale. Fragrances and harsh surfactants trigger flares. Vitamin D analogues and antioxidants are specifically beneficial.",
  lupus_rash: "The malar (butterfly) rash of lupus is highly photosensitive — UV exposure triggers flares. Chemical UV filters can also cause reactions; mineral-only sunscreens (zinc oxide, titanium dioxide) are strongly preferred. Photosensitizing ingredients carry significantly higher risk here than for any other type.",
  keratosis_pilaris: "Keratosis pilaris (the rough, bumpy texture on upper arms and thighs) is caused by keratin plugging follicles. Gentle chemical exfoliants — urea, lactic acid, salicylic acid — dissolve plugs; physical scrubs and harsh stripping cleansers worsen the inflammation that keeps follicles blocked. Heavy occlusives can trap keratin and worsen congestion.",
  body_acne: "Body acne is driven by the same pore-clogging and bacterial mechanisms as face acne, but friction and sweat occlusion under clothing are major amplifiers. Fabric softener residue, heavy emollients in body wash, and thick lotions all contribute. The same pore-clogger flags that matter on face apply here — watch the Congestion and Occlusive sections.",
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
  red_nir: "Red and near-infrared light amplifies collagen-synthesis pathways — vitamin C and peptides applied 5–10 min before sessions have additive effects. Do not apply retinoids, AHAs, benzoyl peroxide, or chemical sunscreens immediately before: photosensitized skin absorbs device energy more intensely. Wait 20+ min after a session before applying actives.",
  blue_light: "Blue light (415–450nm) targets acne bacteria via singlet oxygen. Do not combine with benzoyl peroxide in the same session. Avoid retinoids and AHAs before use. Not recommended over rosacea-affected skin — blue light at device intensity can worsen vascular inflammation.",
  amber_light: "Amber and yellow light reduces vascular reactivity and facial redness — particularly beneficial for rosacea. Same pre-session rules apply: no retinoids, AHAs, or chemical sunscreens immediately before use.",
  vibration_sonic: "Vibration and sonic tools improve lymphatic drainage and cleanser penetration. Use only during the cleansing step — not after applying actives. Avoid over active eczema or psoriasis lesions: friction worsens the Koebner response.",
  heat_steam: "Heat opens the skin barrier and concentrates product delivery. Never apply retinoids, AHAs, or benzoyl peroxide before facial steamers or heated tools — heat drives these in harder than intended. Strongly contraindicated for rosacea: heat is a primary flush trigger.",
  microcurrent: "Microcurrent requires a water-based conductive medium — silicones and heavy waxes block conductivity. Do not use over active breakouts or with photosensitizing topicals. Apply a water-based HA serum or gel as the conductive medium, not this product.",
  iodine_load: "Iodine-rich supplements (kelp, red marine algae, spirulina) can trigger iodine acne — uniform papular eruptions that don't respond to BP, salicylic acid, or antibiotics because the mechanism is iodine-driven. If acne persists despite treatment, this supplement stack is a primary suspect.",
  phytoestrogen_load: "Phytoestrogen-containing supplements (licorice root, apigenin, resveratrol, evening primrose, quercetin) amplify estrogen-sensitive skin responses. Combined with UV exposure, this significantly elevates melasma risk. Daily SPF and topical antioxidants are more important, not less.",
  anti_androgenic: "Anti-androgenic supplements (saw palmetto, spearmint, green tea, white peony) reduce DHT-driven sebum production — directly beneficial for acne-prone, oily, and seborrheic skin. Topical sebum-regulating actives work alongside this systemic reduction.",
  vasodilating_supps: "Vasodilating supplements (beet root, L-citrulline, ginkgo, ginger) increase blood flow and can trigger flushing. If rosacea is active, this supplement combination is a likely contributor. Combining vasodilating supplements with heat devices amplifies flushing risk further.",
  immune_stimulating: "Immune-stimulating supplements (echinacea, astragalus, mushroom complexes, guduchi, cat's claw) activate immune pathways. For autoimmune conditions like lupus or psoriasis, immune stimulants can trigger flares — discuss with your rheumatologist before continuing.",
  insulin_sensitizing: "Insulin-sensitizing supplements (berberine, inositol, chromium, gymnema) reduce IGF-1-driven sebum production — a meaningful systemic benefit for acne-prone and oily skin. Topical sebum-controlling actives are more effective when systemic sebum is already reduced.",
  anabolic_dht: "Creatine and similar androgen-supporting supplements have been shown in RCTs to raise the DHT:testosterone ratio by 40–56%, increasing sebum. If acne is an active concern, this is a modifiable factor worth testing by eliminating it for 6–8 weeks.",
  high_dose_b12: "High-dose vitamin B12 has a documented mechanism for triggering acne: it alters porphyrin metabolism in C. acnes, triggering inflammatory breakouts. If acne appeared or worsened after starting B12, this is the most likely cause — lower doses or methylcobalamin may be better tolerated.",
  collagen_support: "Taking collagen-support supplements (collagen peptides, lysine, glycine, silica, phytoceramides, sea buckthorn) provides systemic raw materials for the same repair pathways that topical retinoids, peptides, and vitamin C signal. The combination is additive.",
  high_glycemic: "A high glycemic index diet (refined carbs, processed sugars, white bread, pastries) raises insulin and IGF-1, directly increasing androgen-driven sebum production. This is a well-documented dietary driver of acne — reducing glycemic load works on the same axis as topical sebum-reducing actives.",
  dairy_regular: "Regular dairy intake — particularly skim milk and whey protein — raises serum IGF-1 and delivers bioactive hormones. This has a documented correlation with acne, especially cystic and jawline breakouts. Full-fat and fermented dairy (yogurt, kefir) have weaker associations.",
  gluten_sensitive: "Gluten sensitivity and celiac disease are associated with systemic inflammation that can manifest in the skin as eczema flares, psoriasis worsening, and dermatitis herpetiformis. Bread, wheat pasta, and flour-based products are the primary triggers — baker's yeast in bread is incidental; it's the wheat gluten that drives the reaction.",
  histamine_foods: "High-histamine foods (fermented foods, aged cheese, wine, vinegar, tomatoes, spinach, cured meats) trigger histamine-mediated flushing and skin reactivity. For rosacea and reactive skin, this mimics contact allergen responses — a histamine release causing redness, warmth, and itching.",
  alcohol_regular: "Alcohol is a direct vasodilator and one of the most reliable rosacea flush triggers. It also dehydrates systemically and impairs the skin barrier repair cycle — acutely relevant for dry and barrier-compromised skin. Even moderate regular intake can sustain a baseline of chronic low-grade vascular inflammation.",
  spicy_foods: "Capsaicin and piperine in spicy foods activate TRPV1 (the heat-sensing nerve receptor) in facial skin — the same receptor that responds to menthol and eucalyptol. On rosacea-affected skin this triggers the same flush cycle that topical warming agents do. Identifying and reducing primary spicy triggers has a measurable effect on baseline redness.",
  high_iodine_diet: "A high-iodine diet (seaweed, shellfish, generous iodized salt) can contribute to iodine acne through the same mechanism as iodine supplements — uniform papular eruptions that don't respond to standard acne treatments. Dietary sources are usually lower intensity than supplements but compound with any iodine load from kelp or marine algae capsules.",
  sulfites_diet: "Sulfites (wine, dried fruit, deli meats, pickles, shrimp) can trigger flushing and rosacea flares — sulfite sensitivity is an enzyme deficiency, not a true allergy. The reaction is vascular: rapid redness and warmth, usually within minutes. Also associated with eczema flares in atopic skin. Look for 'sulfites,' 'sulfur dioxide,' 'sodium/potassium bisulfite' on labels.",
  benzoates_diet: "Sodium benzoate (sodas, sauces, juices, salad dressings) can trigger urticaria (hives) and contact-type reactions, especially in people sensitive to aspirin — they share a COX-1 inhibition pathway. In reactive and eczema-prone skin, benzoates in food compound with topical preservative exposure. Also found in some fermented foods naturally.",
  nitrites_diet: "Nitrites and nitrates (processed meats, bacon, hot dogs, cured fish) are associated with rosacea flares and acne worsening, likely via systemic inflammatory pathways and conversion to vasoactive nitric oxide. Fermentation converts nitrates to nitrites, so heavily cured and aged meats have the highest load.",
  bha_bht_diet: "BHT and BHA (butylated hydroxytoluene / butylated hydroxyanisole) are antioxidant preservatives in packaged snacks, cereals, frying oils, and chewing gum. BHA is a recognized contact allergen — the same compound that appears in some cosmetics as a sensitizer. Regular oral exposure can worsen contact sensitization to BHA in topical products.",
  propionates_diet: "Calcium and sodium propionate (commercial bread, packaged baked goods, some cheese wraps) are associated with eczema flares and urticaria in propionate-sensitive individuals. Propionates are structurally related to propionic acid, which can activate mast cells in sensitive skin. Look for 'E280–E283' on EU labels.",
  carmine_diet: "Carmine (cochineal extract, E120, 'natural red 4') is a red dye in yogurt, candy, juice, some medications, and cosmetics. It is a potent allergen — carmine is a complete insect-derived antigen that can cause urticaria, angioedema, and rarely anaphylaxis. Cross-reacts with some botanical allergens. On skin products, the same sensitization from dietary carmine can trigger topical reactions.",
};

function noteLabel(n: SkinClimateNote): string {
  const skinLabels = n.dimensions.map((d) => SKIN_TYPES.find((s) => s.value === d)?.label ?? d);
  const climateLabels = n.climate.map((c) => ALL_MODIFIER_TYPES.find((t) => t.value === c)?.label ?? c);
  const parts: string[] = [];
  if (skinLabels.length) parts.push(skinLabels.join(", "));
  if (climateLabels.length) parts.push(climateLabels.join(", "));
  return parts.join(" · ");
}

function climateNoteStyle(c: ClimateType): string {
  const amberSet = new Set<ClimateType>(["heavy_metal_water", "heat_steam", "iodine_load", "immune_stimulating", "anabolic_dht", "high_dose_b12"]);
  if (amberSet.has(c)) return "text-amber-800 bg-amber-50 border-amber-200";
  if (DEVICE_TYPES.some(d => d.value === c)) return "text-blue-800 bg-blue-50 border-blue-200";
  if (DIET_TYPES.some(d => d.value === c)) return "text-emerald-800 bg-emerald-50 border-emerald-200";
  if (SUPPLEMENT_TYPES.some(s => s.value === c)) return "text-violet-800 bg-violet-50 border-violet-100";
  return "text-gray-600 bg-gray-50 border-gray-100";
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
  if (skinTypes.has("keratosis_pilaris")) cats.push("Heavy occlusives", "Physical exfoliants", "Sulfate surfactants");
  if (skinTypes.has("body_acne")) cats.push("Occlusives", "Waxes", "Film-formers", "Pore-cloggers");
  if (climates.has("hard_water")) cats.push("Chelating agents", "High-pH cleansers");
  if (climates.has("chlorinated_water")) cats.push("Vitamin C", "Antioxidants");
  if (climates.has("iron_water")) cats.push("Chelating agents", "Antioxidants");
  if (climates.has("heavy_metal_water")) cats.push("Chelating agents", "Penetration enhancers");
  if (["red_nir","blue_light","amber_light","heat_steam"].some(d => climates.has(d as ClimateType))) cats.push("Retinoids", "AHA exfoliants", "Chemical sunscreens");
  if (climates.has("microcurrent")) cats.push("Silicones", "Heavy waxes");
  if (climates.has("iodine_load")) cats.push("Iodine compounds");
  if (climates.has("vasodilating_supps") && skinTypes.has("rosacea")) cats.push("Heat triggers", "Warming agents");
  if (climates.has("phytoestrogen_load") && skinTypes.has("hyperpigmentation_prone")) cats.push("UV protection", "Brightening actives");
  if (climates.has("anabolic_dht") && skinTypes.has("acne_prone")) cats.push("Pore-cloggers", "Sebum triggers");
  if ((climates.has("high_glycemic") || climates.has("dairy_regular")) && skinTypes.has("acne_prone")) cats.push("Pore-cloggers", "Sebum-stimulating actives");
  if (climates.has("gluten_sensitive") && (skinTypes.has("eczema") || skinTypes.has("psoriasis"))) cats.push("Fragrance allergens", "Sulfate surfactants");
  if (climates.has("histamine_foods") && (skinTypes.has("rosacea") || skinTypes.has("reactive"))) cats.push("Warming agents", "Fragrance allergens");
  if (climates.has("alcohol_regular") && skinTypes.has("rosacea")) cats.push("Warming agents", "Vasodilating ingredients");
  if (climates.has("spicy_foods") && skinTypes.has("rosacea")) cats.push("Heat triggers", "TRPV1 activators");
  if (climates.has("high_iodine_diet") && skinTypes.has("acne_prone")) cats.push("Iodine compounds");
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
        (activeSkinTypes.has("acne_prone") || activeSkinTypes.has("oily") || activeSkinTypes.has("fungal_acne") || activeSkinTypes.has("body_acne") || activeSkinTypes.has("keratosis_pilaris"))) ||
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
    if (profileTypes.some((st) => activeSkinTypes.has(st as SkinType))) return "profile-matched";
    if (
      sc === "Stripping" &&
      (activeSkinTypes.has("dry") || activeSkinTypes.has("damaged_barrier") ||
        activeClimates.has("dry_climate") || activeClimates.has("cold"))
    ) return "profile-matched";
    if (sc === "Pilling" && (activeClimates.has("hot") || activeClimates.has("humid"))) return "profile-matched";
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

function detectDeviceWarnings(
  result: ScanResult,
  devices: Set<ClimateType>
): { type: "danger" | "synergy"; title: string; body: string }[] {
  if (devices.size === 0) return [];
  const warnings: { type: "danger" | "synergy"; title: string; body: string }[] = [];
  const lightDevices: ClimateType[] = ["red_nir", "blue_light", "amber_light"];
  const hasLightDevice = lightDevices.some(d => devices.has(d));
  const stepTags = result.step_tags ?? [];
  const flaggedCats = result.flagged.map(m => (m.ingredient.flagged_category ?? "").toLowerCase());

  if (hasLightDevice && stepTags.includes("retinoid"))
    warnings.push({ type: "danger", title: "Retinoid before light therapy", body: "Retinoids sensitize skin to energy absorption — applying before a light therapy session significantly increases irritation and burn risk. Use retinoids PM on days you do light therapy AM, or alternate evenings entirely." });
  if (hasLightDevice && stepTags.includes("acid-step"))
    warnings.push({ type: "danger", title: "Exfoliant before light therapy", body: "Freshly exfoliated skin is more sensitive to all wavelengths. Wait at least 24 hours after applying AHAs or BHAs before a light therapy session — or do the session first and apply acids 20+ min later." });
  if (hasLightDevice && flaggedCats.includes("chemical sunscreen"))
    warnings.push({ type: "danger", title: "Chemical filter before light therapy", body: "Chemical UV filters absorb light energy and convert it to heat within the skin layer. Using a chemical-filter product before a light device session creates concentrated heat at the skin surface. Rinse off before your session, or apply only after." });
  if (hasLightDevice && stepTags.includes("enhancer-caution"))
    warnings.push({ type: "danger", title: "Penetration enhancer before light therapy", body: "This product contains a penetration enhancer (drying alcohol) that temporarily opens the skin barrier. Combined with a light device, this amplifies delivery of all co-applied ingredients — including any irritants or sensitizers in the formula." });
  if (devices.has("heat_steam") && (stepTags.includes("retinoid") || stepTags.includes("acid-step")))
    warnings.push({ type: "danger", title: "Active ingredient before heat device", body: "Heat opens the barrier and concentrates ingredient delivery. Retinoids or exfoliants applied before a steamer or heated tool penetrate more aggressively than intended. Wash face before using any heat device if these are in your routine." });
  if (devices.has("microcurrent")) {
    const hasSilicone = result.safe.some(m => m.ingredient.structural_category === "Silicone");
    const hasWax = result.safe.some(m => m.ingredient.structural_category === "Wax");
    if (hasSilicone || hasWax)
      warnings.push({ type: "danger", title: "Silicone / wax blocks microcurrent", body: `This product contains ${[hasSilicone && "silicone", hasWax && "wax"].filter(Boolean).join(" and ")} that blocks electrical conductivity. Apply a water-based HA serum or gel as the conductive medium for microcurrent — not this product.` });
  }
  if (devices.has("red_nir")) {
    const hasAntioxidant = result.safe.some(m => ["antioxidant","brightening"].some(c => (m.ingredient.category ?? "").includes(c)) || (m.ingredient.name ?? "").toLowerCase().includes("ascorbic"));
    const hasPeptide = result.safe.some(m => m.ingredient.structural_category === "Peptide");
    if (hasAntioxidant || hasPeptide) {
      const active = [hasAntioxidant && "antioxidants / vitamin C", hasPeptide && "peptides"].filter(Boolean).join(" and ");
      warnings.push({ type: "synergy", title: `Red/NIR synergy — ${active}`, body: `${active.charAt(0).toUpperCase() + active.slice(1)} applied 5–10 min before your red or near-infrared session work on the same collagen-synthesis pathways the device stimulates — applying beforehand amplifies both effects.` });
    }
  }
  return warnings;
}

function detectSupplementWarnings(
  skinTypes: Set<SkinType>,
  climates: Set<ClimateType>
): { type: "danger" | "caution" | "synergy"; title: string; body: string }[] {
  const warnings: { type: "danger" | "caution" | "synergy"; title: string; body: string }[] = [];
  if (climates.has("iodine_load") && (skinTypes.has("acne_prone") || skinTypes.has("fungal_acne")))
    warnings.push({ type: "danger", title: "Iodine load + acne-prone skin", body: "Kelp, red marine algae, and spirulina create a significant iodine load. Iodine acne produces uniform papular eruptions that don't respond to BP, salicylic acid, or antibiotics — the mechanism is iodine-driven, not bacterial. Eliminating these supplements for 4–6 weeks is a key diagnostic test if acne persists despite treatment." });
  if (climates.has("phytoestrogen_load") && skinTypes.has("hyperpigmentation_prone") && climates.has("high_uv"))
    warnings.push({ type: "danger", title: "Phytoestrogen × UV — elevated melasma risk", body: "Phytoestrogens (licorice root, apigenin, resveratrol, evening primrose) stimulate melanocytes. Combined with UV exposure, this is the same mechanism as OCP-associated melasma. Daily broad-spectrum SPF and topical antioxidants are non-negotiable." });
  if (climates.has("vasodilating_supps") && skinTypes.has("rosacea"))
    warnings.push({ type: "caution", title: "Vasodilating supplements + rosacea", body: "Your supplement stack includes multiple vasodilators (beet root, L-citrulline, ginkgo, ginger). Together these can be a significant contributor to flushing. If flushing is active, test each supplement individually to identify the primary trigger." });
  if (climates.has("immune_stimulating") && skinTypes.has("lupus_rash"))
    warnings.push({ type: "danger", title: "Immune stimulants + lupus", body: "Immune-stimulating supplements (echinacea, astragalus, mushroom complexes, guduchi, cat's claw) activate the same immune pathways that attack healthy tissue in lupus. Discuss these with your rheumatologist before continuing — flare risk is real." });
  if (climates.has("anabolic_dht") && skinTypes.has("acne_prone"))
    warnings.push({ type: "caution", title: "DHT-raising supplements + acne", body: "Creatine has been shown in RCTs to raise the DHT:testosterone ratio by 40–56%, increasing androgen-driven sebum. Eliminating creatine for 6–8 weeks is worth testing if acne is active." });
  if (climates.has("high_dose_b12") && skinTypes.has("acne_prone"))
    warnings.push({ type: "caution", title: "High-dose B12 + acne-prone skin", body: "High-dose B12 alters porphyrin metabolism in C. acnes, triggering inflammatory breakouts. If acne worsened after starting B12, this is the most likely cause — lower doses or methylcobalamin may be better tolerated." });
  if (climates.has("collagen_support"))
    warnings.push({ type: "synergy", title: "Collagen support stack", body: "Your collagen supplement stack (collagen peptides, lysine, glycine, silica, phytoceramides) provides systemic raw materials for the same repair pathways that topical retinoids, peptides, and vitamin C signal. The combination is additive." });
  if (climates.has("insulin_sensitizing") && (skinTypes.has("acne_prone") || skinTypes.has("oily")))
    warnings.push({ type: "synergy", title: "Insulin sensitizers + sebum control", body: "Berberine, inositol, and chromium reduce IGF-1-driven sebum at the systemic level — topical sebum-controlling actives work alongside this, not in isolation. The combination is more effective than either alone." });
  return warnings;
}

function detectDietaryWarnings(
  skinTypes: Set<SkinType>,
  climates: Set<ClimateType>
): { type: "danger" | "caution" | "synergy"; title: string; body: string }[] {
  const warnings: { type: "danger" | "caution" | "synergy"; title: string; body: string }[] = [];
  if ((climates.has("high_glycemic") || climates.has("dairy_regular")) && (skinTypes.has("acne_prone") || skinTypes.has("oily"))) {
    const source = [climates.has("high_glycemic") && "high glycemic foods", climates.has("dairy_regular") && "dairy"].filter(Boolean).join(" and ");
    warnings.push({ type: "danger", title: `${source.charAt(0).toUpperCase() + source.slice(1)} + acne-prone skin`, body: `${source.charAt(0).toUpperCase() + source.slice(1)} raises insulin and IGF-1, directly increasing androgen-driven sebum. Reducing glycemic load and testing a 4-week dairy elimination are among the highest-impact modifiable factors for acne.` });
  }
  if (climates.has("high_glycemic") && skinTypes.has("mature"))
    warnings.push({ type: "caution", title: "High glycemic diet + mature skin", body: "Sugar and refined carbs drive glycation — glucose cross-linking collagen and elastin fibers, stiffening them and accelerating visible aging. Reducing dietary sugar has additive effects with topical antioxidants and peptides." });
  if (climates.has("gluten_sensitive") && (skinTypes.has("eczema") || skinTypes.has("psoriasis")))
    warnings.push({ type: "caution", title: "Gluten sensitivity + inflammatory skin condition", body: "Undiagnosed gluten sensitivity or celiac disease sustains systemic inflammation that can worsen eczema and psoriasis. A supervised gluten-free trial of 8–12 weeks is diagnostic — improvement within that window suggests the skin condition is gluten-driven." });
  if (climates.has("histamine_foods") && (skinTypes.has("rosacea") || skinTypes.has("reactive")))
    warnings.push({ type: "caution", title: "Histamine foods + reactive / rosacea skin", body: "High-histamine foods (fermented foods, aged cheese, wine, vinegar, tomatoes) trigger the same histamine-release mechanism as contact allergens. For rosacea and reactive skin, this sustains a baseline of inflammation that makes topical products less effective." });
  if (climates.has("alcohol_regular") && skinTypes.has("rosacea"))
    warnings.push({ type: "danger", title: "Alcohol + rosacea", body: "Alcohol is one of the most consistent rosacea flush triggers — it acts through vasodilation, histamine release, and systemic dehydration simultaneously. Any topical rosacea management is substantially undermined by regular alcohol intake." });
  if (climates.has("alcohol_regular") && (skinTypes.has("dry") || skinTypes.has("damaged_barrier")))
    warnings.push({ type: "caution", title: "Alcohol + dry / barrier-compromised skin", body: "Regular alcohol intake dehydrates systemically and impairs the skin barrier repair cycle. For already dry or compromised skin, this extends recovery time and reduces the effectiveness of barrier-repairing actives." });
  if (climates.has("spicy_foods") && skinTypes.has("rosacea"))
    warnings.push({ type: "caution", title: "Spicy foods + rosacea", body: "Capsaicin activates TRPV1 heat receptors in facial skin — the same pathway triggered by menthol and warming topicals. On rosacea skin this sustains baseline vascular reactivity that makes other triggers more intense." });
  if (climates.has("high_iodine_diet") && (skinTypes.has("acne_prone") || climates.has("iodine_load")))
    warnings.push({ type: "caution", title: "High-iodine diet" + (climates.has("iodine_load") ? " + iodine supplements" : " + acne-prone skin"), body: "Dietary iodine from seaweed, shellfish, and iodized salt compounds with any supplement iodine load. Combined, they can produce iodine acne — uniform papular eruptions that don't respond to BP or salicylic acid." });
  return warnings;
}

function profileMatchedCategories(skinTypes: Set<SkinType>, climates: Set<ClimateType>): string[] {
  const cats: string[] = [];
  if (skinTypes.has("acne_prone") || skinTypes.has("oily") || skinTypes.has("fungal_acne") || skinTypes.has("body_acne") || skinTypes.has("keratosis_pilaris"))
    cats.push("pore-clogger", "occlusive", "bacteria-trap");
  if (skinTypes.has("reactive") || skinTypes.has("damaged_barrier") || skinTypes.has("eczema") || skinTypes.has("rosacea") || skinTypes.has("psoriasis"))
    cats.push("sensitizer");
  if (skinTypes.has("reactive") || skinTypes.has("damaged_barrier") || skinTypes.has("eczema"))
    cats.push("fragrance-allergen");
  if (skinTypes.has("rosacea") || skinTypes.has("lupus_rash"))
    cats.push("Chemical Sunscreen");
  if (skinTypes.has("hyperpigmentation_prone") || climates.has("high_uv") || skinTypes.has("lupus_rash"))
    cats.push("photo-retinoid", "photo-AHA", "photo-BHA", "photo-brightening", "photo-botanical");
  return [...new Set(cats)];
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
  const [rinseOffDefaults, setRinseOffDefaults] = useState<Set<string>>(RINSE_OFF_TYPES);
  const [browseTypes, setBrowseTypes] = useState<BrowseType[]>([]);
  const [browseSelectedType, setBrowseSelectedType] = useState<string | null>(null);
  const [browseProducts, setBrowseProducts] = useState<BrowseProduct[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browsePhotosafe, setBrowsePhotosafe] = useState(false);
  const [browseProfileLinked, setBrowseProfileLinked] = useState(false);
  const [browseNoUniversal, setBrowseNoUniversal] = useState(false);
  const [browseCleanOnly, setBrowseCleanOnly] = useState(false);
  const [listModes, setListModes] = useState<Record<string, "include" | "exclude" | "off">>({});
  const [ingredientLists, setIngredientLists] = useState<IngredientList[]>([]);
  const [addToListMenu, setAddToListMenu] = useState<string | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddListId, setBulkAddListId] = useState<string | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
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
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const [addRoutinePickerOpen, setAddRoutinePickerOpen] = useState(false);
  const [skinTypeHint, setSkinTypeHint] = useState<SkinType | null>(null);
  const [climateHint, setClimateHint] = useState<ClimateType | null>(null);
  const [waterHint, setWaterHint] = useState<ClimateType | null>(null);
  const [deviceHint, setDeviceHint] = useState<ClimateType | null>(null);
  const [supplementHint, setSupplementHint] = useState<ClimateType | null>(null);
  const [dietHint, setDietHint] = useState<ClimateType | null>(null);
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
      .then((d: { types?: { name: string; body_area: string; is_rinse_off?: boolean }[] }) => {
        if (d.types) {
          setTypeBodyAreaMap(new Map(d.types.map((t) => [t.name, t.body_area])));
          setRinseOffDefaults(new Set(d.types.filter((t) => t.is_rinse_off).map((t) => t.name)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      const cl = localStorage.getItem("skindex:climates");
      const rt = localStorage.getItem("skindex:routine");
      const il = localStorage.getItem("skindex:ingredientLists");
      if (st) setActiveSkinTypes(new Set(JSON.parse(st) as SkinType[]));
      if (cl) setActiveClimates(new Set(JSON.parse(cl) as ClimateType[]));
      if (rt) setRoutineProducts(JSON.parse(rt) as RoutineProduct[]);
      if (il) setIngredientLists(JSON.parse(il) as IngredientList[]);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("skindex:routine", JSON.stringify(routineProducts)); } catch {}
  }, [routineProducts]);

  useEffect(() => {
    try { localStorage.setItem("skindex:ingredientLists", JSON.stringify(ingredientLists)); } catch {}
  }, [ingredientLists]);

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
      setIsRinseOff(rinseOffDefaults.has(result.product.type ?? ""));
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

  function addToRoutine(timeOfDay?: "am" | "pm" | null) {
    if (!result?.product) return;
    const newEntry: RoutineProduct = {
      routineId: Date.now().toString(),
      name: result.product.name,
      brand: result.product.brand ?? null,
      step_tags: result.step_tags ?? [],
      ingredients: result.originalItems,
      flaggedCategories: result.flagged.map((f) => f.ingredient.flagged_category ?? "").filter(Boolean),
      timeOfDay: timeOfDay ?? null,
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
    const params = new URLSearchParams({ type: typeName });
    const concerns = profileMatchedCategories(activeSkinTypes, activeClimates);
    if (concerns.length) params.set("concerns", concerns.join(","));
    if (activeSkinTypes.size > 0) params.set("skinTypes", [...activeSkinTypes].join(","));
    if (activeClimates.size > 0) params.set("climates", [...activeClimates].join(","));
    const res = await fetch(`/api/browse?${params.toString()}`);
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

  function getPostWashNote(skinTypes: Set<SkinType>, climates: Set<ClimateType>): string | null {
    const hardOrChlorinated = climates.has("hard_water") || climates.has("chlorinated_water") || climates.has("iron_water");
    const acneOrOily = skinTypes.has("acne_prone") || skinTypes.has("oily");
    const malassezia = skinTypes.has("fungal_acne") || skinTypes.has("seborrheic");
    const barrier = skinTypes.has("damaged_barrier") || skinTypes.has("reactive");
    if (!acneOrOily && !malassezia && !barrier) return null;
    const parts: string[] = [];
    if (hardOrChlorinated) {
      parts.push("Hard or chlorinated water temporarily raises skin pH above 7 — the acid mantle (normally 4.5–5.5) takes 20–30 minutes to recover on its own.");
    } else {
      parts.push("After washing, the acid mantle takes up to 20–30 minutes to recover its normal pH of 4.5–5.5.");
    }
    if (acneOrOily) parts.push("During this window, C. acnes proliferates at elevated pH and fresh sebum replenishment begins immediately — applying a low-pH product within 30 seconds of patting dry closes this window fastest.");
    if (malassezia) parts.push("Malassezia recolonizes most rapidly in the first minutes after cleansing, when the skin surface is warm and freshly sebum-coated. A low-pH toner or essence applied immediately helps suppress this.");
    if (barrier) parts.push("With a damaged barrier, transepidermal water loss (TEWL) peaks in the first minutes post-wash — applying any film-forming or occlusive layer promptly traps moisture before evaporation sets in.");
    parts.push("The highest-impact habit for your profile: apply your first product within 30 seconds of patting dry, before the skin surface dries completely.");
    return parts.join(" ");
  }

  function renderRoutinePanel() {
    const routineWarns = detectRoutineWarnings(routineProducts);
    const dupMap = new Map<string, string[]>();
    for (const p of routineProducts) {
      for (const ing of p.ingredients) {
        const key = ing.toLowerCase();
        const others = routineProducts.filter(q => q.routineId !== p.routineId && q.ingredients.some(i => i.toLowerCase() === key));
        if (others.length > 0) {
          if (!dupMap.has(p.routineId)) dupMap.set(p.routineId, []);
          dupMap.get(p.routineId)!.push(ing);
        }
      }
    }
    const amProducts = routineProducts.filter(p => p.timeOfDay === "am");
    const pmProducts = routineProducts.filter(p => p.timeOfDay === "pm");
    const untaggedProducts = routineProducts.filter(p => !p.timeOfDay);
    const totalConcerns = routineProducts.reduce((n, p) => n + p.flaggedCategories.length, 0);

    const renderProduct = (p: RoutineProduct) => (
      <div key={p.routineId} className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
            {(dupMap.get(p.routineId) ?? []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700" title={`Shared: ${(dupMap.get(p.routineId) ?? []).join(", ")}`}>duplicate ingredient</span>
            )}
          </div>
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
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button type="button" onClick={() => {
            const tod = p.timeOfDay === "am" ? "pm" : p.timeOfDay === "pm" ? null : "am";
            setRoutineProducts(prev => prev.map(q => q.routineId === p.routineId ? { ...q, timeOfDay: tod } : q));
          }} className="text-[10px] text-gray-400 hover:text-teal-600 border border-gray-200 rounded-full px-1.5 py-0.5 transition-colors">
            {p.timeOfDay === "am" ? "AM" : p.timeOfDay === "pm" ? "PM" : "—"}
          </button>
          <button type="button" onClick={() => removeFromRoutine(p.routineId)} className="text-[10px] text-gray-300 hover:text-rose-400">Remove</button>
        </div>
      </div>
    );

    const renderGroup = (label: string, products: RoutineProduct[]) => products.length === 0 ? null : (
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
        <div className="space-y-2.5">{products.map(renderProduct)}</div>
      </div>
    );

    return (
      <div className="space-y-3">
        {routineProducts.length === 0 ? (
          <p className="text-xs text-gray-400">No products yet. Scan a product and tap &quot;+ Add to routine&quot; to start building.</p>
        ) : (
          <>
            {totalConcerns > 0 && (
              <p className="text-[10px] text-gray-500">{totalConcerns} flagged ingredient{totalConcerns !== 1 ? "s" : ""} across routine</p>
            )}
            <div className="space-y-3">
              {amProducts.length > 0 || pmProducts.length > 0 ? (
                <>
                  {renderGroup("AM", amProducts)}
                  {renderGroup("PM", pmProducts)}
                  {renderGroup("Untagged", untaggedProducts)}
                </>
              ) : (
                <div className="space-y-2.5">{routineProducts.map(renderProduct)}</div>
              )}
            </div>
            {routineWarns.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 pt-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Interactions</p>
                {routineWarns.map((w, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 ${w.type === "danger" ? "border-amber-200 bg-amber-50" : "border-teal-100 bg-teal-50"}`}>
                    <p className={`text-[10px] font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-800" : "text-teal-800"}`}>{w.type === "danger" ? "⚠ " : "✦ "}{w.title}</p>
                    <p className={`text-[10px] leading-relaxed ${w.type === "danger" ? "text-amber-700" : "text-teal-700"}`}>{w.body}</p>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setRoutineProducts([])} className="text-[10px] text-gray-300 hover:text-rose-400">Clear routine</button>
          </>
        )}
      </div>
    );
  }

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
                <span className="text-purple-800 font-medium normal-case tracking-normal">
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
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSkinType(value)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            activeSkinTypes.has(value)
                              ? "bg-amber-700 text-white border-amber-700"
                              : "text-gray-500 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {label}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkinTypeHint(h => h === value ? null : value)}
                          className="text-[10px] text-gray-300 hover:text-gray-500 leading-none"
                          aria-label={`About ${label}`}
                        >ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {skinTypeHint && SKIN_TYPE_NOTES[skinTypeHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{SKIN_TYPES.find(s => s.value === skinTypeHint)?.label} — </span>
                      {SKIN_TYPE_NOTES[skinTypeHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Climate</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLIMATE_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setClimateHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {climateHint && CLIMATE_NOTES[climateHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === climateHint)?.label} — </span>
                      {CLIMATE_NOTES[climateHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Water quality</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WATER_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setWaterHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {waterHint && CLIMATE_NOTES[waterHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === waterHint)?.label} — </span>
                      {CLIMATE_NOTES[waterHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Devices</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEVICE_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-gray-700 text-white border-gray-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setDeviceHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {deviceHint && CLIMATE_NOTES[deviceHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === deviceHint)?.label} — </span>
                      {CLIMATE_NOTES[deviceHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Internal factors</p>
                  <p className="text-[10px] text-gray-400 mb-1">Supplements</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {SUPPLEMENT_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-gray-700 text-white border-gray-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setSupplementHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {supplementHint && CLIMATE_NOTES[supplementHint] && (
                    <div className="mb-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === supplementHint)?.label} — </span>
                      {CLIMATE_NOTES[supplementHint]}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mb-1">Diet</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIET_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-emerald-700 text-white border-emerald-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setDietHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {dietHint && CLIMATE_NOTES[dietHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === dietHint)?.label} — </span>
                      {CLIMATE_NOTES[dietHint]}
                    </div>
                  )}
                </div>
                {(activeSkinTypes.size + activeClimates.size) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {[...activeSkinTypes].map((t) => (
                      <p key={t} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed border border-gray-100">{SKIN_TYPE_NOTES[t]}</p>
                    ))}
                    {[...activeClimates].map((c) => (
                      <p key={c} className={`text-xs rounded-lg px-2.5 py-1.5 leading-relaxed border ${climateNoteStyle(c)}`}>{CLIMATE_NOTES[c]}</p>
                    ))}
                    {(() => {
                      const suppWarns = detectSupplementWarnings(activeSkinTypes, activeClimates);
                      const dietWarns = detectDietaryWarnings(activeSkinTypes, activeClimates);
                      const allWarns = [...suppWarns, ...dietWarns];
                      return allWarns.length > 0 ? (
                        <div className="space-y-1.5 pt-0.5">
                          {allWarns.map((w, i) => (
                            <div key={i} className={`rounded-xl border px-3 py-2 ${w.type === "danger" ? "border-amber-200 bg-amber-50" : w.type === "caution" ? "border-orange-200 bg-orange-50" : "border-teal-100 bg-teal-50"}`}>
                              <p className={`text-xs font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-800" : w.type === "caution" ? "text-orange-800" : "text-teal-800"}`}>{w.type === "danger" ? "⚠ " : w.type === "caution" ? "◆ " : "✦ "}{w.title}</p>
                              <p className={`text-xs leading-relaxed ${w.type === "danger" ? "text-amber-700" : w.type === "caution" ? "text-orange-700" : "text-teal-700"}`}>{w.body}</p>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const watches = profileWatchCategories(activeSkinTypes, activeClimates);
                      return watches.length > 0 ? (
                        <p className="text-xs text-gray-400 pt-0.5">Flags: {watches.join(" · ")}.</p>
                      ) : null;
                    })()}
                    {(() => {
                      const note = getPostWashNote(activeSkinTypes, activeClimates);
                      return note ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                          <p className="text-xs font-semibold text-blue-800 mb-0.5">Post-wash window</p>
                          <p className="text-xs leading-relaxed text-blue-700">{note}</p>
                        </div>
                      ) : null;
                    })()}
                    <p className="text-xs text-gray-400">Matching profile notes replace the generic explanation when you expand each ingredient.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Ingredient lists — manage in My Lists */}
          <section className="mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full">
              Ingredient lists
              {ingredientLists.some(l => l.items.length > 0) && (
                <span className="text-gray-500 font-medium normal-case tracking-normal">
                  {ingredientLists.filter(l => l.items.length > 0).length} active
                </span>
              )}
              <a href="/lists" className="ml-auto text-[10px] font-normal normal-case tracking-normal text-gray-400 hover:text-gray-700 underline underline-offset-2">Manage in My Lists →</a>
            </div>
          </section>

          {/* Routine panel — idle state (inline collapsible, hidden on md+ where the side panel is used) */}
          <section className="mb-6 md:hidden">
            <button
              type="button"
              onClick={() => setRoutineOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full"
            >
              Routine
              {routineProducts.length > 0 && (
                <span className="text-purple-800 font-medium normal-case tracking-normal">
                  {routineProducts.length} product{routineProducts.length !== 1 ? "s" : ""}
                </span>
              )}
              <span className="text-gray-300 ml-auto">{routineOpen ? "▲" : "▼"}</span>
            </button>
            {routineOpen && (
              <div className="mt-2 border border-gray-100 rounded-xl p-3">
                {renderRoutinePanel()}
              </div>
            )}
          </section>

          {browseLoading && !browseSelectedType && (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          )}
          {!browseLoading && !browseSelectedType && browseTypes.length > 0 && (
            <>
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Quick filters</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setBrowseNoUniversal(v => !v)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${browseNoUniversal ? "bg-rose-600 text-white border-rose-600" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                  ✗ Universal Concerns
                </button>
                {(activeSkinTypes.size + activeClimates.size) > 0 && (
                  <button type="button" onClick={() => setBrowseProfileLinked(v => !v)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${browseProfileLinked ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                    ✗ My Sensitivities
                  </button>
                )}
                <button type="button" onClick={() => setBrowseCleanOnly(v => !v)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${browseCleanOnly ? "bg-green-700 text-white border-green-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                  ✓ Neutral &amp; Beneficial
                </button>
                <button type="button" onClick={() => setBrowsePhotosafe(v => !v)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${browsePhotosafe ? "bg-yellow-600 text-white border-yellow-600" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                  Photo-safe
                </button>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-widest mb-3">Browse</p>
            <div className="space-y-5">
              {(() => {
                const AREA_ORDER = ["Face", "Makeup", "Lip", "Hands", "Nails", "Hair", "Body"];
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
                const typeButton = (t: BrowseType) =>
                  t.count === 0 ? (
                    <span
                      key={t.name}
                      title="No products yet — be the first to add one"
                      className="text-sm text-gray-300 border border-gray-100 rounded-full px-3 py-1 cursor-default select-none"
                    >
                      {t.name} <span className="text-xs">0</span>
                    </span>
                  ) : (
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
                  if (types) { sections.push(areaSection(area, types)); grouped.delete(area); }
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
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => { setBrowseSelectedType(null); setBrowseProducts([]); setBrowseSearch(""); }}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  ← All types
                </button>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-sm font-medium text-gray-700">{browseSelectedType}</span>
              </div>
              {/* Browse search + filter chips */}
              {!browseLoading && browseProducts.length > 0 && (() => {
                const ingText = (p: BrowseProduct) => (p.ingredient_list ?? "").toLowerCase();
                const avoidLists = ingredientLists.filter(l => (l.type === "avoid" || listModes[l.id] === "exclude") && l.items.length > 0);
                const wantLists = ingredientLists.filter(l => (l.type === "want" || listModes[l.id] === "include") && l.items.length > 0);
                const newLists = ingredientLists.filter(l => !l.type && l.items.length > 0);
                const profileCats = profileMatchedCategories(activeSkinTypes, activeClimates);
                const searchLower = browseSearch.trim().toLowerCase();
                const filtered = browseProducts.filter(p => {
                  if (searchLower && !p.name.toLowerCase().includes(searchLower) && !(p.brand ?? "").toLowerCase().includes(searchLower)) return false;
                  if (browsePhotosafe && p.photoCount > 0) return false;
                  if (browseProfileLinked && ((p.profileFlaggedCount ?? 0) + (p.profileSensoryCount ?? 0)) > 0) return false;
                  if (browseNoUniversal && (p.universalConcernCount ?? 0) > 0) return false;
                  if (browseCleanOnly && (p.flaggedCount > 0 || p.sensoryCount > 0)) return false;
                  const txt = ingText(p);
                  if (avoidLists.some(l => l.items.some(item => txt.includes(item.toLowerCase())))) return false;
                  if (wantLists.length > 0 && !wantLists.every(l => l.items.some(item => txt.includes(item.toLowerCase())))) return false;
                  return true;
                });
                const activeModes = newLists.filter(l => listModes[l.id] && listModes[l.id] !== "off").length;
                const activeFilterCount = (searchLower ? 1 : 0) + (browsePhotosafe ? 1 : 0) + (browseProfileLinked ? 1 : 0) + (browseNoUniversal ? 1 : 0) + (browseCleanOnly ? 1 : 0) + avoidLists.filter(l => l.type === "avoid").length + wantLists.filter(l => l.type === "want").length + activeModes;
                return (
                  <>
                    <input
                      type="text"
                      value={browseSearch}
                      onChange={(e) => setBrowseSearch(e.target.value)}
                      placeholder={`Search ${browseSelectedType ?? "products"}…`}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 mb-3 focus:outline-none focus:border-gray-400"
                    />
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <button type="button" onClick={() => setBrowseNoUniversal(v => !v)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${browseNoUniversal ? "bg-rose-600 text-white border-rose-600" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>✗ Universal Concerns</button>
                      {profileCats.length > 0 && (
                        <button type="button" onClick={() => setBrowseProfileLinked(v => !v)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${browseProfileLinked ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>✗ My Sensitivities</button>
                      )}
                      <button type="button" onClick={() => setBrowseCleanOnly(v => !v)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${browseCleanOnly ? "bg-green-700 text-white border-green-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>✓ Neutral &amp; Beneficial</button>
                      <button type="button" onClick={() => setBrowsePhotosafe(v => !v)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${browsePhotosafe ? "bg-yellow-600 text-white border-yellow-600" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>Photo-safe</button>
                      {avoidLists.filter(l => l.type === "avoid").map(l => (
                        <span key={l.id} className="text-xs px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">✗ {l.name}</span>
                      ))}
                      {wantLists.filter(l => l.type === "want").map(l => (
                        <span key={l.id} className="text-xs px-2 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-100">✓ {l.name}</span>
                      ))}
                      {newLists.map(l => {
                        const mode = listModes[l.id] ?? "off";
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setListModes(prev => ({ ...prev, [l.id]: mode === "off" ? "include" : mode === "include" ? "exclude" : "off" }))}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              mode === "include" ? "bg-teal-50 text-teal-700 border-teal-100" :
                              mode === "exclude" ? "bg-rose-50 text-rose-700 border-rose-200" :
                              "text-gray-500 border-gray-200 hover:border-gray-400"
                            }`}
                            title={`Click to cycle: off → include → exclude`}
                          >
                            {mode === "include" ? "✓" : mode === "exclude" ? "✗" : "○"} {l.name}
                          </button>
                        );
                      })}
                      {activeFilterCount > 0 && filtered.length !== browseProducts.length && (
                        <span className="text-xs text-gray-400 self-center">{filtered.length} of {browseProducts.length}</span>
                      )}
                    </div>
                    {filtered.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">No products match your active filters.</p>
                    )}
                    <div className="space-y-2">
                      {filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { resetTab("search"); setQuery(p.name); handleScan({ tab: "search", query: p.name }); }}
                          className="w-full flex items-center gap-3 border border-gray-300 rounded-xl p-3 text-left hover:border-gray-400 hover:bg-gray-50 transition-colors"
                        >
                          {p.image_url && (
                            <img src={`/api/image-proxy?url=${encodeURIComponent(p.image_url)}`} alt={p.name} className="w-10 h-10 object-contain rounded-lg bg-gray-50 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{p.name}</p>
                            {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {p.flaggedCount === 0 && p.sensoryCount === 0 && p.photoCount === 0 ? (
                              <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-50 text-green-700">Safe</span>
                            ) : (() => {
                              const hasProf = activeSkinTypes.size > 0 || activeClimates.size > 0;
                              const pfc = p.profileFlaggedCount;
                              if (hasProf && pfc !== undefined) {
                                const totalForYou = pfc + (p.profileSensoryCount ?? 0);
                                if (totalForYou > 0) {
                                  return (
                                    <>
                                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{totalForYou} for you</span>
                                      {p.sensoryCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{p.sensoryCount} sensory</span>}
                                      {p.photoCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700">{p.photoCount} photo</span>}
                                      {p.flaggedCount > pfc && <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">{p.flaggedCount} total</span>}
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-50 text-green-700">Safe for your profile</span>
                                    {p.sensoryCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">{p.sensoryCount} sensory</span>}
                                    {p.photoCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">{p.photoCount} photo</span>}
                                    {p.flaggedCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">{p.flaggedCount} flagged</span>}
                                  </>
                                );
                              }
                              return (
                                <>
                                  {p.flaggedCount > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-md ${hasProf ? "bg-gray-100 text-gray-500" : "bg-rose-50 text-rose-700"}`}>{p.flaggedCount} flagged</span>}
                                  {p.sensoryCount > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-md ${hasProf ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>{p.sensoryCount} sensory</span>}
                                  {p.photoCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700">{p.photoCount} photo</span>}
                                </>
                              );
                            })()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
              {browseLoading && <p className="text-sm text-gray-400 text-center py-6">Loading…</p>}
              {!browseLoading && browseProducts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No products found.</p>
              )}
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
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {(() => {
                    const inRoutine = routineProducts.some((p) => p.name === result.product?.name);
                    if (inRoutine) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            const id = routineProducts.find((p) => p.name === result.product?.name)?.routineId;
                            if (id) removeFromRoutine(id);
                          }}
                          className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-400 hover:border-rose-400 hover:text-rose-500 transition-colors"
                        >
                          In routine · Remove
                        </button>
                      );
                    }
                    if (addedToRoutine) {
                      return <span className="text-xs px-3 py-1 rounded-full border border-teal-600 text-teal-600">Added to routine ✓</span>;
                    }
                    if (addRoutinePickerOpen) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-500">Add as:</span>
                          {(["am", "pm", null] as const).map((t) => (
                            <button key={String(t)} type="button"
                              onClick={() => { addToRoutine(t); setAddRoutinePickerOpen(false); }}
                              className="px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 hover:border-teal-600 hover:text-teal-600 transition-colors"
                            >{t === "am" ? "AM" : t === "pm" ? "PM" : "Untagged"}</button>
                          ))}
                          <button type="button" onClick={() => setAddRoutinePickerOpen(false)} className="text-gray-300 hover:text-gray-500 ml-0.5">✕</button>
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => setAddRoutinePickerOpen(true)}
                        className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-teal-600 hover:text-teal-600 transition-colors"
                      >
                        + Add to routine
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
          {(result.flagged.length + result.safe.length + result.unreviewed.length) > 0 && (() => {
            const totalItems = result.flagged.length + result.safe.length + result.unreviewed.length;
            const scrollToConcern = () => document.getElementById("section-by-concern")?.scrollIntoView({ behavior: "smooth", block: "start" });
            const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

            if (hasProfile) {
              let profileCount = 0;
              let totalConcernCount = 0;
              for (const item of result.originalItems) {
                const m = getItemMatch(item, result.safe, result.flagged);
                const si = (result.sensoryTrigger ?? []).find(s => normalizeForMatch(s.rawName) === normalizeForMatch(item)) ?? null;
                const pi = (result.photosensitive ?? []).find(p => normalizeForMatch(p.rawName) === normalizeForMatch(item)) ?? null;
                const lv = getIngredientConcernLevel(m, si, pi, activeSkinTypes, activeClimates);
                if (lv === "universal" || lv === "profile-matched") profileCount++;
                if (lv !== "neutral" && lv !== "skip") totalConcernCount++;
              }
              const qualLabel = profileCount === 0 ? "No concerns" : profileCount <= 2 ? "Low concern" : profileCount <= 5 ? "Some concerns" : "High concern";
              const qualColor = profileCount === 0 ? "text-green-700" : profileCount <= 2 ? "text-yellow-700" : profileCount <= 5 ? "text-amber-700" : "text-rose-700";
              return (
                <p className="text-xs -mt-2">
                  <span className="text-gray-700">{totalItems} ingredient{totalItems !== 1 ? "s" : ""} scanned</span>
                  {profileCount > 0 && <>{" · "}<button type="button" className={`${qualColor} font-medium hover:underline underline-offset-2`} onClick={scrollToConcern}>{profileCount} profile concern{profileCount !== 1 ? "s" : ""}</button></>}
                  {" · "}
                  <button type="button" className="text-teal-700 hover:underline underline-offset-2" onClick={scrollToConcern}>{result.safe.length} neutral</button>
                  {result.unreviewed.length > 0 && <>{" · "}<button type="button" className="text-gray-400 hover:underline underline-offset-2" onClick={() => { setShowUnreviewed(true); requestAnimationFrame(() => { document.getElementById("section-unreviewed")?.scrollIntoView({ behavior: "smooth", block: "start" }); }); }}>{result.unreviewed.length} unreviewed</button></>}
                </p>
              );
            }

            return (
            <p className="text-xs -mt-2">
              <span className="text-gray-700">{totalItems} ingredient{totalItems !== 1 ? "s" : ""} scanned</span>
              {" · "}
              <button
                type="button"
                className={`${result.flagged.length > 0 ? "text-rose-700" : "text-gray-400"} hover:underline underline-offset-2`}
                onClick={scrollToConcern}
              >
                {result.flagged.length} flagged
              </button>
              {(result.sensoryTrigger ?? []).length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-amber-700 hover:underline underline-offset-2"
                    onClick={scrollToConcern}
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
                    onClick={scrollToConcern}
                  >
                    {result.photosensitive.length} photosensitive
                  </button>
                </>
              )}
              {" · "}
              <button
                type="button"
                className="text-teal-700 hover:underline underline-offset-2"
                onClick={scrollToConcern}
              >
                {result.safe.length} neutral
              </button>
              {result.unreviewed.length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-gray-400 hover:underline underline-offset-2"
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
            );
          })()}

          {/* Bulk add flagged to list */}
          {result.flagged.length > 0 && ingredientLists.filter(l => l.type === "avoid").length > 0 && (
            <div>
              {!bulkAddOpen ? (
                <button type="button" className="text-xs text-gray-400 hover:text-rose-700 hover:underline underline-offset-2"
                  onClick={() => setBulkAddOpen(true)}>
                  Save {result.flagged.length} flagged to avoid list →
                </button>
              ) : (
                <div className="text-xs border border-rose-100 rounded-xl p-2.5 bg-rose-50/50 space-y-2">
                  <p className="text-rose-700 font-medium">Save {result.flagged.length} flagged ingredients to:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ingredientLists.filter(l => l.type === "avoid").map(lst => (
                      <button key={lst.id} type="button"
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${bulkAddListId === lst.id ? "bg-rose-600 text-white border-rose-600" : "bg-white border-rose-200 text-rose-700 hover:border-rose-400"}`}
                        onClick={() => setBulkAddListId(bulkAddListId === lst.id ? null : lst.id)}>
                        {lst.name}
                      </button>
                    ))}
                  </div>
                  {bulkAddListId && (
                    <div className="flex gap-1.5 pt-0.5">
                      <button type="button" className="text-xs px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => {
                          const names = result.flagged.map(f => f.displayName.toLowerCase());
                          setIngredientLists(ls => ls.map(l => l.id === bulkAddListId ? { ...l, items: [...new Set([...l.items, ...names])] } : l));
                          setBulkAddOpen(false);
                          setBulkAddListId(null);
                        }}>
                        Add all
                      </button>
                      <button type="button" className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                        onClick={() => { setBulkAddOpen(false); setBulkAddListId(null); }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                <span className="text-purple-800 font-medium normal-case tracking-normal">
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
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSkinType(value)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            activeSkinTypes.has(value)
                              ? "bg-amber-700 text-white border-amber-700"
                              : "text-gray-500 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {label}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkinTypeHint(h => h === value ? null : value)}
                          className="text-[10px] text-gray-300 hover:text-gray-500 leading-none"
                          aria-label={`About ${label}`}
                        >ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {skinTypeHint && SKIN_TYPE_NOTES[skinTypeHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{SKIN_TYPES.find(s => s.value === skinTypeHint)?.label} — </span>
                      {SKIN_TYPE_NOTES[skinTypeHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Climate</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLIMATE_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setClimateHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {climateHint && CLIMATE_NOTES[climateHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === climateHint)?.label} — </span>
                      {CLIMATE_NOTES[climateHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Water quality</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WATER_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setWaterHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {waterHint && CLIMATE_NOTES[waterHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === waterHint)?.label} — </span>
                      {CLIMATE_NOTES[waterHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Devices</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEVICE_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-gray-700 text-white border-gray-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setDeviceHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {deviceHint && CLIMATE_NOTES[deviceHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === deviceHint)?.label} — </span>
                      {CLIMATE_NOTES[deviceHint]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Internal factors</p>
                  <p className="text-[10px] text-gray-400 mb-1">Supplements</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {SUPPLEMENT_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-gray-700 text-white border-gray-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setSupplementHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {supplementHint && CLIMATE_NOTES[supplementHint] && (
                    <div className="mb-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === supplementHint)?.label} — </span>
                      {CLIMATE_NOTES[supplementHint]}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mb-1">Diet</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIET_TYPES.map(({ value, label }) => (
                      <span key={value} className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => toggleClimate(value)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${activeClimates.has(value) ? "bg-emerald-700 text-white border-emerald-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                        <button type="button" onClick={() => setDietHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                      </span>
                    ))}
                  </div>
                  {dietHint && CLIMATE_NOTES[dietHint] && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                      <span className="font-medium text-gray-700">{ALL_MODIFIER_TYPES.find(t => t.value === dietHint)?.label} — </span>
                      {CLIMATE_NOTES[dietHint]}
                    </div>
                  )}
                </div>
                {(activeSkinTypes.size + activeClimates.size) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {[...activeSkinTypes].map((t) => (
                      <p key={t} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed border border-gray-100">{SKIN_TYPE_NOTES[t]}</p>
                    ))}
                    {[...activeClimates].map((c) => (
                      <p key={c} className={`text-xs rounded-lg px-2.5 py-1.5 leading-relaxed border ${climateNoteStyle(c)}`}>{CLIMATE_NOTES[c]}</p>
                    ))}
                    {(() => {
                      const suppWarns = detectSupplementWarnings(activeSkinTypes, activeClimates);
                      const dietWarns = detectDietaryWarnings(activeSkinTypes, activeClimates);
                      const allWarns = [...suppWarns, ...dietWarns];
                      return allWarns.length > 0 ? (
                        <div className="space-y-1.5 pt-0.5">
                          {allWarns.map((w, i) => (
                            <div key={i} className={`rounded-xl border px-3 py-2 ${w.type === "danger" ? "border-amber-200 bg-amber-50" : w.type === "caution" ? "border-orange-200 bg-orange-50" : "border-teal-100 bg-teal-50"}`}>
                              <p className={`text-xs font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-800" : w.type === "caution" ? "text-orange-800" : "text-teal-800"}`}>{w.type === "danger" ? "⚠ " : w.type === "caution" ? "◆ " : "✦ "}{w.title}</p>
                              <p className={`text-xs leading-relaxed ${w.type === "danger" ? "text-amber-700" : w.type === "caution" ? "text-orange-700" : "text-teal-700"}`}>{w.body}</p>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const watches = profileWatchCategories(activeSkinTypes, activeClimates);
                      return watches.length > 0 ? (
                        <p className="text-xs text-gray-400 pt-0.5">Flags: {watches.join(" · ")}.</p>
                      ) : null;
                    })()}
                    {(() => {
                      const note = getPostWashNote(activeSkinTypes, activeClimates);
                      return note ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                          <p className="text-xs font-semibold text-blue-800 mb-0.5">Post-wash window</p>
                          <p className="text-xs leading-relaxed text-blue-700">{note}</p>
                        </div>
                      ) : null;
                    })()}
                    <p className="text-xs text-gray-400">Matching profile notes replace the generic explanation when you expand each ingredient.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Ingredient lists — manage in My Lists */}
          <section className="mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full">
              Ingredient lists
              {ingredientLists.some(l => l.items.length > 0) && (
                <span className="text-gray-500 font-medium normal-case tracking-normal">
                  {ingredientLists.filter(l => l.items.length > 0).length} active
                </span>
              )}
              <a href="/lists" className="ml-auto text-[10px] font-normal normal-case tracking-normal text-gray-400 hover:text-gray-700 underline underline-offset-2">Manage in My Lists →</a>
            </div>
          </section>

          {/* Routine panel — results state (inline collapsible, hidden on md+ where the side panel is used) */}
          <section className="mt-4 md:hidden">
            <button
              type="button"
              onClick={() => setRoutineOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest w-full"
            >
              Routine
              {routineProducts.length > 0 && (
                <span className="text-purple-800 font-medium normal-case tracking-normal">
                  {routineProducts.length} product{routineProducts.length !== 1 ? "s" : ""}
                </span>
              )}
              <span className="text-gray-300 ml-auto">{routineOpen ? "▲" : "▼"}</span>
            </button>
            {routineOpen && (
              <div className="mt-2 border border-gray-100 rounded-xl p-3">
                {renderRoutinePanel()}
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
                  const itemNorm = normalizeForMatch(item);
                  const onAvoidList = ingredientLists.some(l => l.type === "avoid" && l.items.some(av => itemNorm.includes(av)));
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
                        className={`${colorClass} hover:underline underline-offset-2${onAvoidList ? " bg-rose-100 rounded px-0.5" : ""}`}
                        title={onAvoidList ? "On your avoid list" : undefined}
                        onClick={() => {
                          if (match || photoItem || sensoryItem) {
                            handleIngredientClick(item, match, !!photoItem, !!sensoryItem);
                          } else {
                            handleUnreviewedClick(item);
                          }
                        }}
                      >
                        {onAvoidList && <span className="text-rose-500 mr-0.5">⊗</span>}{smartCase(item)}
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

          {/* Device interaction warnings */}
          {(() => {
            const devWarns = detectDeviceWarnings(result, activeClimates);
            return devWarns.length > 0 ? (
              <section className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Device interactions</p>
                <div className="space-y-2">
                  {devWarns.map((w, i) => (
                    <div key={i} className={`rounded-xl border px-4 py-3 ${w.type === "danger" ? "border-blue-200 bg-blue-50" : "border-amber-100 bg-amber-50"}`}>
                      <p className={`text-xs font-semibold mb-1 ${w.type === "danger" ? "text-blue-800" : "text-amber-800"}`}>{w.type === "danger" ? "⚡ " : "✦ "}{w.title}</p>
                      <p className={`text-xs leading-relaxed ${w.type === "danger" ? "text-blue-700" : "text-amber-700"}`}>{w.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null;
          })()}


          {/* By concern — grouped ingredient view */}
          {result.originalItems.length > 0 && (() => {
            const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

            const RINSE_OFF_SUPPRESS_SENSORY_CATS = new Set(["Pilling", "Film-forming", "Occlusive", "occlusive-itch", "comedogenic-itch"]);
            const RINSE_OFF_SUPPRESS_PHOTO_CATS = new Set(["photo-retinoid", "photo-BHA", "photo-brightening"]);
            const RINSE_OFF_SUPPRESS_DB_CATS = new Set(["pore-clogger", "occlusive", "bacteria-trap"]);

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
              const effectiveMatch = isRinseOff && match?.ingredient.status === "flagged" && RINSE_OFF_SUPPRESS_DB_CATS.has(match.ingredient.flagged_category ?? "") ? null : match;
              const level = getIngredientConcernLevel(effectiveMatch, sensoryItem, photoItem, activeSkinTypes, activeClimates);
              if (level !== "skip") groups[level].push({ item, match: effectiveMatch, fullMatch, sensoryItem, photoItem });
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

              const itemKey = item.toLowerCase();
              const inList = addToListMenu === itemKey;
              return (
                <div key={rowKey} id={rowKey} className="overflow-hidden">
                  <div className="flex items-center">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-between px-3 py-2 text-left"
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
                  {ingredientLists.length > 0 && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        title="Add to list"
                        className={`px-2 py-2 text-sm leading-none transition-colors ${inList ? "text-gray-700" : "text-gray-300 hover:text-gray-500"}`}
                        onClick={() => setAddToListMenu(inList ? null : itemKey)}
                      >
                        +
                      </button>
                      {inList && (
                        <div className="absolute right-0 top-full z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 min-w-[130px]">
                          {ingredientLists.map((lst) => {
                            const already = lst.items.includes(itemKey);
                            return (
                              <button
                                key={lst.id}
                                type="button"
                                className="w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 rounded-lg flex items-center gap-1.5"
                                onClick={() => {
                                  if (!already) setIngredientLists(ls => ls.map(l => l.id === lst.id ? { ...l, items: [...l.items, itemKey] } : l));
                                  setAddToListMenu(null);
                                }}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${lst.type === "avoid" ? "bg-rose-400" : "bg-teal-500"}`} />
                                <span className="flex-1 truncate">{lst.name}</span>
                                {already && <span className="text-teal-600 shrink-0">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  </div>
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

      {/* ── Routine side panel (desktop right drawer + mobile bottom sheet) ── */}
      {/* Backdrop */}
      {routinePanelOpen && (
        <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setRoutinePanelOpen(false)} aria-hidden />
      )}

      {/* Desktop: fixed right drawer (hidden on mobile) */}
      <div className={`hidden md:flex fixed top-0 right-0 h-full z-40 flex-col bg-white border-l border-gray-200 shadow-xl transition-transform duration-300 w-72 ${routinePanelOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Routine</span>
          <button type="button" onClick={() => setRoutinePanelOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {renderRoutinePanel()}
        </div>
      </div>

      {/* Desktop: collapsed tab strip on right edge */}
      {!routinePanelOpen && (
        <button
          type="button"
          onClick={() => setRoutinePanelOpen(true)}
          className={`hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-1 py-3 px-2 rounded-l-xl border border-r-0 border-gray-200 bg-white shadow-md text-xs font-medium transition-colors ${detectRoutineWarnings(routineProducts).length > 0 ? "text-amber-700 border-amber-200" : "text-gray-600 hover:text-gray-900"}`}
        >
          <span style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}>Routine</span>
          {routineProducts.length > 0 && (
            <span className={`text-[10px] font-bold rounded-full px-1 ${detectRoutineWarnings(routineProducts).length > 0 ? "text-amber-700" : "text-teal-600"}`}>{routineProducts.length}</span>
          )}
        </button>
      )}

      {/* Mobile: floating pill at bottom */}
      {routineProducts.length > 0 && (
        <button
          type="button"
          onClick={() => setRoutinePanelOpen(v => !v)}
          className={`md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium border transition-colors ${detectRoutineWarnings(routineProducts).length > 0 ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white border-gray-200 text-gray-700"}`}
        >
          Routine {routinePanelOpen ? "▼" : "▲"} · {routineProducts.length}
        </button>
      )}

      {/* Mobile: bottom sheet */}
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 rounded-t-2xl shadow-xl transition-transform duration-300 ${routinePanelOpen ? "translate-y-0" : "translate-y-full"}`}
        style={{ maxHeight: "65vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Routine</span>
          <button type="button" onClick={() => setRoutinePanelOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {renderRoutinePanel()}
        </div>
      </div>
    </div>
  );
}
