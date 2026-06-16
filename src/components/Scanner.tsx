"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Pipette, FlaskConical, Droplet, Droplets, Waves, Sun, Sparkles, Wind, Bandage, Brush, Smile, Palette, Heart, PersonStanding, Scissors, Hand, Fingerprint, Home, Eye, Shield, Layers, Moon, Pencil, Pen, Footprints, GlassWater, Cigarette, Camera, ScanBarcode } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DbIngredient, ExplanationStructured, IngredientMatch, PhotosensitiveItem, Routine, RoutineProduct, SensoryTriggerItem, ScanResult, AlternativeProduct, CommunityVariant, SkinClimateNote } from "@/types";
import { SENSORY_PROFILE_MAP, CONCERN_PROFILE_TYPES } from "@/lib/sensory";
import { PROFILE_BENEFIT_CATS } from "@/lib/profile-benefit-cats";
import { tokenFuzzyFilter } from "@/lib/search";
import { splitIngredientList } from "@/lib/scanner";
import ConcernChips from "@/components/ConcernChips";
import BarcodeScanner from "@/components/BarcodeScanner";
import IngredientOCR from "@/components/IngredientOCR";
import { openSidePanel } from "@/lib/open-side-panel";
import { useSkinProfile } from "@/context/SkinProfileContext";
import type { SkinType, ClimateType } from "@/lib/skin-profile";
import { SKIN_TYPES, ALL_MODIFIER_TYPES } from "@/lib/skin-profile";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const STEP_SEQUENCE: { key: string; label: string; order: number; tag: string; timeOfDay: "am" | "pm" | null; cautionProfiles?: string[]; avoidProfiles?: string[] }[] = [
  { key: "enhancer", label: "Toner",      order: 1, tag: "enhancer-caution", timeOfDay: null,
    cautionProfiles: ["reactive", "damaged_barrier"] },
  { key: "acid",     label: "Acid step",  order: 2, tag: "acid-step",        timeOfDay: null,
    avoidProfiles: ["damaged_barrier"], cautionProfiles: ["reactive", "rosacea", "eczema", "psoriasis"] },
  { key: "vitc",     label: "Vitamin C",  order: 3, tag: "low-ph-step",      timeOfDay: "am",
    cautionProfiles: ["reactive", "damaged_barrier"] },
  { key: "retinoid", label: "Retinoid",   order: 6, tag: "retinoid",         timeOfDay: "pm",
    cautionProfiles: ["reactive", "damaged_barrier", "rosacea"] },
  { key: "spf",      label: "SPF",        order: 7, tag: "spf-last",         timeOfDay: "am" },
  { key: "seal",     label: "Seal",       order: 8, tag: "seal-last",        timeOfDay: "pm" },
];

const PROFILE_RAIL_STEPS: {
  key: string; label: string; timeOfDay: "am" | "pm" | null;
  forProfiles: string[];
  isCovered: (products: RoutineProduct[]) => boolean;
}[] = [
  { key: "bha", label: "BHA", timeOfDay: null,
    forProfiles: ["acne_prone", "oily", "seborrheic", "fungal_acne"],
    isCovered: (prods) => prods.some(p => p.ingredients.some(i => /salicylic|willow bark|beta hydroxy/i.test(i))) },
  { key: "ceramide", label: "Ceramide", timeOfDay: null,
    forProfiles: ["damaged_barrier", "reactive", "eczema", "psoriasis", "rosacea"],
    isCovered: (prods) => prods.some(p => p.ingredients.some(i => /ceramide|panthenol|centella|madecassoside|beta-glucan/i.test(i))) },
  { key: "niacinamide", label: "Niacinamide", timeOfDay: null,
    forProfiles: ["oily", "acne_prone", "hyperpigmentation_prone", "rosacea"],
    isCovered: (prods) => prods.some(p => p.ingredients.some(i => /niacinamide/i.test(i))) },
  { key: "brightener", label: "Brightener", timeOfDay: "am",
    forProfiles: ["hyperpigmentation_prone"],
    isCovered: (prods) => prods.some(p => p.step_tags.includes("low-ph-step") || p.ingredients.some(i => /kojic|arbutin|tranexamic|azelaic|alpha arbutin/i.test(i))) },
];

function getStepOrder(stepTags: string[]): number {
  if (stepTags.includes("enhancer-caution")) return 1;
  if (stepTags.includes("acid-step")) return 2;
  if (stepTags.includes("low-ph-step")) return 3;
  if (stepTags.includes("retinoid")) return 6;
  if (stepTags.includes("spf-last")) return 7;
  if (stepTags.includes("seal-last")) return 8;
  return 4.5; // serum / moisturizer range
}

type SlotPriority = "essential" | "beneficial" | "optional" | "avoid";

const ROUTINE_SLOTS: {
  key: string; label: string; productTypes: string[]; browseType: string;
  coveringStepTags?: string[];
  timeOfDay: "am" | "pm" | null; defaultPriority: SlotPriority;
  profilePriority: Partial<Record<string, SlotPriority>>;
  defaultReason: string; profileReasons: Partial<Record<string, string>>;
}[] = [
  { key: "cleanser", label: "Cleanser", productTypes: ["Face Wash", "Micellar Water", "Makeup Remover"], browseType: "Face Wash", timeOfDay: null, defaultPriority: "beneficial",
    profilePriority: { oily: "essential", acne_prone: "essential", seborrheic: "essential", fungal_acne: "essential" },
    defaultReason: "Removes surface buildup and preps skin for actives",
    profileReasons: { oily: "Oily skin — excess sebum blocks actives and feeds bacteria; cleansing is essential", acne_prone: "Acne-prone skin — removes pore-clogging oils and debris that drive breakouts", damaged_barrier: "Use a gentle, non-stripping formula — harsh cleansers worsen barrier damage", reactive: "Use a fragrance-free, low-surfactant formula — reactive skin is easily over-cleansed" } },
  { key: "toner", label: "Toner / Essence", productTypes: ["Toner", "Mist", "Essence"], browseType: "Toner", coveringStepTags: ["enhancer-caution"], timeOfDay: null, defaultPriority: "optional",
    profilePriority: { oily: "beneficial", acne_prone: "beneficial", hyperpigmentation_prone: "beneficial", damaged_barrier: "optional", reactive: "optional" },
    defaultReason: "Preps skin after cleansing and delivers a first layer of actives or hydration",
    profileReasons: { oily: "Oily skin — a niacinamide or BHA toner can control sebum before serums", acne_prone: "Acne-prone skin — a BHA toner reaches pores that serums can't always penetrate after moisturizer", hyperpigmentation_prone: "Hyperpigmentation — a vitamin C or AHA toner adds an extra brightening layer before serum", reactive: "Use fragrance-free, alcohol-free only — many toners contain irritants at high concentrations" } },
  { key: "exfoliant", label: "Exfoliant", productTypes: [], browseType: "Serum", coveringStepTags: ["acid-step", "low-ph-step"], timeOfDay: null, defaultPriority: "optional",
    profilePriority: { acne_prone: "beneficial", hyperpigmentation_prone: "beneficial", oily: "beneficial", reactive: "optional", damaged_barrier: "avoid" },
    defaultReason: "Removes dead skin cells to improve texture, tone, and active absorption",
    profileReasons: { acne_prone: "Acne-prone skin — AHA/BHA exfoliants clear the pore opening and reduce comedone formation", hyperpigmentation_prone: "Hyperpigmentation — AHAs accelerate turnover of pigmented cells and amplify brightening actives", damaged_barrier: "Avoid exfoliants until the barrier is restored — AHAs increase TEWL and worsen barrier compromise", reactive: "Introduce gradually at low concentration (1–2×/week max) — reactive skin sensitizes quickly with AHAs" } },
  { key: "serum", label: "Serum", productTypes: ["Serum", "Ampoule", "Extract"], browseType: "Serum", timeOfDay: null, defaultPriority: "beneficial",
    profilePriority: { hyperpigmentation_prone: "essential", mature: "essential", acne_prone: "beneficial", damaged_barrier: "beneficial" },
    defaultReason: "Delivers concentrated actives to target specific concerns",
    profileReasons: { hyperpigmentation_prone: "Hyperpigmentation — targeted actives (niacinamide, vitamin C, AHA) are most potent in serum form", mature: "Mature skin — peptides and retinoids require high-concentration serum delivery to signal collagen", damaged_barrier: "Barrier-repair serums (ceramide, panthenol, centella) address the root cause rather than masking symptoms" } },
  { key: "eye", label: "Eye Cream", productTypes: ["Eye Cream"], browseType: "Eye Cream", timeOfDay: null, defaultPriority: "optional",
    profilePriority: { mature: "beneficial", hyperpigmentation_prone: "beneficial" },
    defaultReason: "Addresses the delicate periorbital skin",
    profileReasons: { mature: "Mature skin — periorbital skin is thinner and loses collagen faster; targeted peptides and emollients help", hyperpigmentation_prone: "Hyperpigmentation — dark circles often have a melanin component that targeted vitamin C or kojic acid can address" } },
  { key: "moisturizer", label: "Moisturizer", productTypes: ["Cream", "Emulsion", "Gel", "Lotion"], browseType: "Cream", timeOfDay: null, defaultPriority: "beneficial",
    profilePriority: { dry: "essential", reactive: "essential", damaged_barrier: "essential", eczema: "essential", psoriasis: "essential", rosacea: "essential", oily: "optional" },
    defaultReason: "Seals in hydration and prior layers",
    profileReasons: { dry: "Dry skin — seals in hydration and prevents TEWL; skipping causes progressive moisture loss", reactive: "Reactive skin — calms and reinforces the barrier after actives", damaged_barrier: "Damaged barrier — ceramide-rich formula fills lipid gaps and allows overnight repair", oily: "Optional for oily skin — a lightweight gel texture delivers hydration without adding occlusion" } },
  { key: "oil", label: "Face Oil", productTypes: ["Oil"], browseType: "Oil", timeOfDay: "pm", defaultPriority: "optional",
    profilePriority: { dry: "beneficial", damaged_barrier: "beneficial", fungal_acne: "avoid" },
    defaultReason: "Adds emollient lipids and supports moisture sealing",
    profileReasons: { dry: "Dry skin — adds emollient lipids that reinforce moisture retention overnight", fungal_acne: "Most oils feed Malassezia — avoid for fungal acne unless using squalane or caprylic/capric triglycerides" } },
  { key: "barrier", label: "Barrier Repair", productTypes: ["Ointment", "Balm"], browseType: "Ointment", coveringStepTags: ["seal-last"], timeOfDay: "pm", defaultPriority: "optional",
    profilePriority: { damaged_barrier: "essential", reactive: "beneficial", eczema: "essential", psoriasis: "essential", rosacea: "beneficial" },
    defaultReason: "Occlusive PM layer seals and repairs the skin barrier overnight",
    profileReasons: { damaged_barrier: "Damaged barrier — occlusive PM step prevents TEWL and allows full overnight barrier recovery", eczema: "Eczema — occlusives reduce the TEWL that drives itching and flares overnight" } },
  { key: "spf", label: "SPF", productTypes: ["Sunscreen Face", "Sunscreen"], browseType: "Sunscreen Face", coveringStepTags: ["spf-last"], timeOfDay: "am", defaultPriority: "beneficial",
    profilePriority: { high_uv: "essential", hyperpigmentation_prone: "essential", rosacea: "essential", lupus_rash: "essential", mature: "essential" },
    defaultReason: "Protects against UV damage",
    profileReasons: { high_uv: "High UV climate — unprotected UV exposure is the single largest driver of all skin damage", hyperpigmentation_prone: "Hyperpigmentation — UV is the primary trigger for melanin overproduction; SPF is non-negotiable", rosacea: "Rosacea — UV is a primary rosacea trigger and worsens the inflammatory response", lupus_rash: "Lupus — UV triggers flares directly; broad-spectrum SPF is essential daily" } },
];

const ACTIVE_LOAD_CATEGORIES: {
  key: string; label: string; stepTags: string[]; ingredientPatterns: RegExp[];
  defaultMax: number; profileThresholds: Partial<Record<string, { max: number; note: string }>>;
}[] = [
  { key: "aha", label: "AHA", stepTags: ["acid-step"], ingredientPatterns: [/glycolic/i, /lactic acid/i, /mandelic/i, /malic acid/i, /tartaric/i], defaultMax: 2,
    profileThresholds: { reactive: { max: 1, note: "High for reactive skin" }, damaged_barrier: { max: 1, note: "High for damaged barrier" }, rosacea: { max: 1, note: "High for rosacea" } } },
  { key: "bha", label: "BHA", stepTags: [], ingredientPatterns: [/salicylic/i, /willow bark/i, /beta hydroxy/i], defaultMax: 2,
    profileThresholds: { reactive: { max: 1, note: "High for reactive skin" }, damaged_barrier: { max: 1, note: "High for damaged barrier" } } },
  { key: "retinoid", label: "Retinoid", stepTags: ["retinoid"], ingredientPatterns: [/\bretinol\b/i, /\bretinal\b/i, /retinyl/i, /tretinoin/i, /adapalene/i], defaultMax: 1,
    profileThresholds: { reactive: { max: 1, note: "Start slow — reactive skin sensitizes easily" }, damaged_barrier: { max: 1, note: "Use cautiously — retinoids increase TEWL on compromised barrier" } } },
  { key: "vitc", label: "Vitamin C", stepTags: ["low-ph-step"], ingredientPatterns: [/ascorbic acid/i, /ascorbyl/i, /l-ascorbic/i], defaultMax: 2,
    profileThresholds: { reactive: { max: 1, note: "High for reactive skin — can cause stinging" } } },
  { key: "enhancer", label: "Penetration enhancer", stepTags: ["enhancer-caution"], ingredientPatterns: [], defaultMax: 2,
    profileThresholds: { reactive: { max: 1, note: "Drives irritants deeper on reactive skin" }, damaged_barrier: { max: 1, note: "Disrupts compromised barrier further" } } },
];

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

const BROWSE_AREA_ICON: Record<string, LucideIcon> = {
  Face:   Smile,
  Makeup: Palette,
  Lip:    Heart,
  Hands:  Hand,
  Nails:  Fingerprint,
  Hair:   Scissors,
  Body:   PersonStanding,
  Home:   Home,
};

const BROWSE_TYPE_ICON: Record<string, LucideIcon> = {
  // Face
  Concentrate:     FlaskConical,
  Exfoliant:       Sparkles,
  "Eye Cream":     Eye,
  "Eye Primer":    Eye,
  "Face Mask":     Shield,
  "Face Wash":     Droplets,
  "Makeup Remover":Droplets,
  Mist:            Wind,
  Moisturizer:     Droplet,
  Oil:             Droplet,
  Ointment:        Droplets,
  Primer:          Layers,
  Serum:           Pipette,
  "Sleeping Mask": Moon,
  "Spot Patches":  Bandage,
  "Sun Screen":    Sun,
  Toner:           GlassWater,
  // Makeup
  "BB Cream":      Layers,
  Blush:           Sparkles,
  "Brow Gel":      Pencil,
  "CC Cream":      Layers,
  Concealer:       Brush,
  Eyeliner:        Pen,
  Eyeshadow:       Eye,
  Foundation:      Layers,
  Mascara:         Eye,
  "Setting Spray": Wind,
  // Lip
  "Lip Balm":      Heart,
  "Lip Gloss":     Heart,
  "Lip Treatment": Heart,
  // Hands
  "Hand Cream":    Hand,
  "Dish Soap":     Droplets,
  // Nails
  "Nail Polish":   Sparkles,
  "Nail Treatment":Sparkles,
  // Hair
  Conditioner:     Droplets,
  "Hair Styler":   Wind,
  "Hair Treatment":Sparkles,
  "Scalp Treatment":Pipette,
  Shampoo:         Waves,
  // Body
  "Body Lotion":   Droplets,
  "Body Wash":     Waves,
  Deodorant:       Wind,
  "Foot Cream":    Footprints,
  // Home
  "Laundry Detergent": Waves,
  "Fabric Softener":   Wind,
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
  status: "imported" | "skipped" | "failed" | "pending" | "processing";
  name?: string;
  brand?: string;
  reason?: string;
  httpStatus?: number;
  fetchError?: string;
};
type UserList = { id: string; name: string; is_public: boolean; itemCount: number; containsProduct?: boolean };

type BrowseType = { name: string; count: number };
type BrowseProduct = { id: string; name: string; brand: string | null; image_url: string | null; ingredient_list: string | null; type?: string | null; flaggedCount: number; sensoryCount: number; photoCount: number; universalConcernCount?: number; profileFlaggedCount?: number; profileSensoryCount?: number };
type IngredientList = { id: string; name: string; items: string[] };

const CATEGORY_LABELS: Record<string, string> = {
  // kebab-case (newer workflow)
  "skin-replenishing":  "Skin-replenishing",
  "cell-communicating": "Cell-communicating",
  "wound-healing":      "Wound-healing",
  "keratolytic":        "Keratolytic",
  "antifungal":         "Antifungal",
  "de-puffing":         "De-puffing",
  "photostabilizer":    "Photostabilizer",
  "antimicrobial":      "Antimicrobial",
  "sebum-regulating":   "Sebum-regulating",
  "chelating":          "Chelating",
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
  "skin-repairing": "Skin-repairing",
  "prebiotic": "Prebiotic",
  "photo-protective": "Photo-protective",
  "water-protective": "Water-protective",
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
  // Environmental concern categories
  "reef harmful": "Reef harmful",
  "PFAS": "PFAS / Fluorinated",
  "endocrine disruptor": "Endocrine disruptor",
  "phytoestrogen": "Phytoestrogen",
  "teratogen": "Teratogen",
  "iodine-heavy": "Iodine-heavy",
  "environmental persistent": "Environmentally persistent",
  // Profile-specific concern categories
  "vasodilator": "Vasodilator",
  "fungal-feed": "Fungal feed",
};

const UNIVERSAL_FLAG_CATS = new Set([
  "fragrance-allergen", "preservative-allergen", "formaldehyde releaser",
  "sensitizing preservative", "biocide",
]);

// Sensory categories that are redundant when the AI explanation already covers the same flagged concern
const SENSORY_REDUNDANT_WITH: Record<string, string[]> = {
  "Film-forming":     ["pore-clogger", "occlusive"],
  "Occlusive":        ["occlusive", "pore-clogger"],
  "Pore-clogging":    ["pore-clogger"],
  "comedogenic-itch": ["pore-clogger"],
  "occlusive-itch":   ["occlusive"],
  "chemical-itch":    ["sensitizer", "contact-allergen", "fragrance-allergen"],
  "Stripping":        ["Drying Solvent", "Sulfate Surfactant", "sensitizer"],
  "Stinging":         ["sensitizer", "Drying Solvent"],
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
  "Mineral UV Filter": "Mineral UV filters (zinc oxide, titanium dioxide) sit on the skin surface and physically reflect and scatter UV radiation. Non-sensitizing and suitable for reactive and sensitive skin.",
  "Chemical UV Filter": "Chemical UV filters absorb UV radiation and convert it to heat within the skin. Modern chemical filters have low systemic absorption; older filters carry additional concerns about hormonal disruption and reef toxicity.",
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
  { label: "Hands", types: ["Dish Soap", "Hand Cream", "Hand Sanitizer"].sort() },
  { label: "Body", types: ["Body Lotion", "Body Wash", "Deodorant", "Foot Cream"].sort() },
  { label: "Hair", types: ["Conditioner", "Hair Styler", "Hair Treatment", "Scalp Treatment", "Shampoo"].sort() },
  { label: "Home", types: ["Fabric Softener", "Laundry Detergent"].sort() },
];

const RINSE_OFF_TYPES = new Set([
  "Face Wash", "Cleanser", "Micellar Cleanser", "Micellar Water",
  "Body Wash", "Hand Wash", "Dish Soap", "Makeup Remover",
  "Shampoo", "Conditioner", "Hair Mask",
  "Scalp Scrub", "Exfoliating Scrub", "Facial Scrub", "Body Scrub",
  "Clay Mask", "Rinse-Off Mask",
]);

// SkinType and ClimateType are imported from @/lib/skin-profile

// SKIN_TYPES, CLIMATE_TYPES, WATER_TYPES, DEVICE_TYPES, SUPPLEMENT_TYPES,
// DIET_TYPES, HORMONE_TYPES, LIFESTYLE_TYPES, ALL_MODIFIER_TYPES imported from @/lib/skin-profile

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
  seborrheic: "Seborrheic dermatitis is driven by Malassezia — a yeast that naturally colonizes everyone's skin and feeds on the fatty acids in sebum. In seborrheic dermatitis, the immune system overreacts to Malassezia's metabolic byproducts, triggering inflammation wherever sebaceous glands are densest. On the scalp it presents as dandruff: flaky, itchy scale that sheds onto shoulders. On the face it clusters in the T-zone — the sides of the nose, brows, and glabella — as reddish, slightly greasy patches with fine yellowish or white scale that clings to skin rather than falling away; itching and a mild stinging sensation after cleansing are common. Along the eyelid margins it causes blepharitis: crusty scale builds up at the lash line, leaving eyes feeling gritty and irritated, often worse on waking. On the chest and upper back it appears as oval, slightly pink or salmon-colored patches with fine scale — similar in appearance to tinea versicolor, which is caused by the same organism. The ear area is another classic site: the fold behind the ear accumulates reddish, flaky scale that can crack and feel raw, and the ear canal develops the same itchy, flaky buildup — commonly described as 'inner ear' symptoms, though what's affected is the outer ear canal (the true inner ear is anatomically internal and unrelated to skin). All sites share the same trigger and respond to the same actives: zinc pyrithione, piroctone olamine, selenium sulfide, ketoconazole, and low-dose salicylic acid. Certain plant oils and fatty acid esters feed Malassezia and worsen all sites.",
  eczema: "Atopic eczema has specific preservative sensitivities. MI/MCI (methylisothiazolinone/methylchloroisothiazolinone) and IPBC are notorious eczema triggers. Ceramides, colloidal oatmeal, and thick emollients are specifically therapeutic here — unlike for acne, heavy barrier creams help rather than harm. The retroauricular fold and ear canal are common eczema sites: the crease behind the ear develops deep, painful cracks, and the canal becomes dry, itchy, and prone to weeping or crusting.",
  psoriasis: "Psoriasis causes rapid cell turnover and thick scale. Keratolytics like salicylic acid can help remove scale. Fragrances and harsh surfactants trigger flares. Vitamin D analogues and antioxidants are specifically beneficial. The ear canal and retroauricular fold are common psoriasis sites — thick, silvery-white scale accumulates in the canal and can cause muffled hearing if buildup is significant; the fold behind the ear develops plaques that crack and bleed.",
  lupus_rash: "The malar (butterfly) rash of lupus is highly photosensitive — UV exposure triggers flares. Chemical UV filters can also cause reactions; mineral-only sunscreens (zinc oxide, titanium dioxide) are strongly preferred. Photosensitizing ingredients carry significantly higher risk here than for any other type.",
  keratosis_pilaris: "Keratosis pilaris (the rough, bumpy texture on upper arms and thighs) is caused by keratin plugging follicles. Gentle chemical exfoliants — urea, lactic acid, salicylic acid — dissolve plugs; physical scrubs and harsh stripping cleansers worsen the inflammation that keeps follicles blocked. Heavy occlusives can trap keratin and worsen congestion.",
  body_acne: "Body acne is driven by the same pore-clogging and bacterial mechanisms as face acne, but friction and sweat occlusion under clothing are major amplifiers. Fabric softener residue, heavy emollients in body wash, and thick lotions all contribute. The same pore-clogger flags that matter on face apply here — watch the Congestion and Occlusive sections.",
  fast_shedding: "Fast-shedding skin renews quickly — new cells reach the surface before they've fully cornified, leaving them more fragile and sensitive. Chemical exfoliants and retinoids are more likely to over-process this skin type since the barrier is already cycling fast. Film-forming polymers (carbomers, polyacrylates) and pilling-prone ingredients (dimethicone, film-forming PVP) adhere to loose surface cells and slow their natural shedding, causing them to clump and itch — and the scratch reflex worsens micro-tearing on immature cells. Thick emollients and barrier-supporting ingredients are more protective than usual.",
};

const CLIMATE_NOTES: Record<ClimateType, string> = {
  humid: "In humid climates, film-forming and occlusive ingredients are more likely to trap heat and sebum against the skin — lighter formulations are preferable.",
  dry_climate: "In dry climates, humectants need to be sealed in with an emollient or occlusive — without one, they can pull moisture from deeper skin layers instead of the air.",
  cold: "Cold air depletes skin lipids fastest — barrier-repairing ingredients (ceramides, fatty acids, emollients) are most effective and most needed in this climate.",
  hot: "In hot weather, skin permeability increases, making sensitizers and chemical UV filters absorb more readily and triggering stronger reactions.",
  high_uv: "In high-UV environments (UV Index 6+ on the WHO scale — 6–7 is High, 8–10 Very High, 11+ Extreme), daily broad-spectrum SPF is essential — AHAs, retinoids, and many brightening ingredients all increase UV sensitivity.",
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
  pregnant: "During pregnancy, retinoids (retinol, retinyl esters, tretinoin) are the highest-risk topical ingredient and should be avoided entirely — prescription retinoids carry a Pregnancy Category X classification. Oxybenzone (benzophenone-3) crosses the placental barrier; mineral-only sunscreens (zinc oxide, titanium dioxide) are strongly preferred. High-dose salicylate, hydroquinone, and formaldehyde-releasing preservatives are also avoided in pregnancy. AHAs and BHA at low concentrations in rinse-off products are generally considered low risk.",
  breastfeeding: "During breastfeeding, retinoids applied to the chest or breast tissue should be avoided — systemic absorption to breast milk is a documented concern. Oxybenzone is excreted in breast milk; mineral sunscreens are preferred. High-dose salicylate in leave-on full-face applications is another caution. Most risks are concentrated on skin areas that contact the infant — chest, breast, and hands are the most important areas to watch.",
  hormone_sensitive: "For hormone-sensitive conditions (estrogen receptor-positive cancer, endometriosis, PCOS, fibroids), phytoestrogens and estrogen-mimicking topical ingredients are a relevant concern. Key ingredients: parabens (methylparaben, propylparaben, butylparaben) — weak estrogen mimics; lavender oil and tea tree oil — associated with hormonal effects in studies; soy isoflavones and fermented extracts — phytoestrogenic botanicals. Oxybenzone also has documented endocrine-disrupting activity.",
  thyroid_condition: "For thyroid conditions (hypothyroidism, Hashimoto's, Graves'), iodine-containing topical ingredients are worth noting — povidone-iodine, kelp extract, sea algae, and certain marine extracts deliver iodine that is partially absorbed through skin and may affect thyroid function or interact with thyroid medication. Most relevant for leave-on products applied to large surface areas over time.",
  on_hrt: "For those on hormone replacement therapy or hormonal medications (oral contraceptives, bioidentical hormones), phytoestrogens and estrogen-mimicking topical ingredients can theoretically interact with hormone levels. Parabens, soy isoflavones, lavender oil, and licorice root (glycyrrhizic acid is mildly estrogenic) are the main topical ingredients with documented estrogenic activity. Clinical significance of topical exposure is lower than oral, but is most relevant at high-absorption sites (inner arms, chest, neck).",
  perimenopausal: "During perimenopause, fluctuating estrogen creates an unpredictable hormonal environment — sebum spikes can cause adult acne while declining estrogen causes dryness and barrier thinning simultaneously. Phytoestrogens (soy isoflavones, fermented extracts) and estrogen-mimicking topicals (parabens, oxybenzone, lavender oil) are relevant considerations. Ingredients that address both oiliness and barrier support are particularly valuable in this phase.",
  menopausal: "Post-menopausal estrogen loss causes sustained skin thinning, reduced collagen synthesis, increased dryness, and slower cell turnover. Topical phytoestrogens (soy isoflavones, genistein, fermented extracts) are studied specifically for post-menopausal skin benefit — they are not flagged as a concern here, unlike in hormone-sensitive or perimenopausal profiles. Endocrine-disrupting ingredients (parabens, oxybenzone) remain a consideration. Retinoids, peptides, humectants, and ceramides are the highest-value categories.",
  pcos: "PCOS elevates androgens — testosterone and DHT — driving excess sebum, acne along the jawline and chin, and sometimes hirsutism. Topical phytoestrogens and endocrine-disrupting ingredients (parabens, oxybenzone, lavender oil, tea tree oil) are relevant because they interact with the hormonal environment already dysregulated by PCOS. Anti-inflammatory and oil-controlling actives are particularly beneficial.",
  on_testosterone: "Exogenous testosterone (prescribed TRT or gender-affirming HRT) significantly increases sebum production and acne risk through DHT conversion. Phytoestrogens and endocrine-disrupting topicals can theoretically interact with androgen levels. The skin response is similar to androgenic acne — oil-controlling, comedolytic, and anti-inflammatory actives are the most relevant categories.",
  smoking: "Tobacco smoke generates reactive oxygen species that deplete skin vitamins C and E, activate metalloproteinases that break down collagen and elastin, impair microcirculation, and increase transepidermal water loss by disrupting the lipid barrier. The clinical result is accelerated photoaging, impaired wound healing, dull complexion, and a lower threshold for contact sensitizer reactions. Key topical priorities: vitamin C and antioxidants (replenish what smoke depletes), peptides and retinoids (counter collagen breakdown), and ceramides with fatty acids (restore barrier function).",
};

function noteLabel(n: SkinClimateNote): string {
  const skinLabels = n.dimensions.map((d) => SKIN_TYPES.find((s) => s.value === d)?.label ?? d);
  const climateLabels = n.climate.map((c) => ALL_MODIFIER_TYPES.find((t) => t.value === c)?.label ?? c);
  return [...skinLabels, ...climateLabels].join(", ");
}

// climateNoteStyle imported from @/lib/skin-profile

function profileBenefitCategorySet(skinTypes: Set<SkinType>, climates: Set<ClimateType>): Set<string> {
  const result = new Set<string>();
  for (const key of [...skinTypes, ...climates] as string[]) {
    for (const cat of PROFILE_BENEFIT_CATS[key] ?? []) result.add(cat);
  }
  return result;
}

function profileWatchCategories(skinTypes: Set<SkinType>, climates: Set<ClimateType>): string[] {
  const cats: string[] = [];
  if (skinTypes.has("oily") || skinTypes.has("acne_prone")) cats.push("Occlusives", "Waxes", "Film-formers");
  if (skinTypes.has("reactive") || skinTypes.has("damaged_barrier")) cats.push("Sensitizers", "Fragrance allergens", "Barrier-disrupting");
  if (skinTypes.has("dry") || skinTypes.has("damaged_barrier") || climates.has("cold") || climates.has("dry_climate")) cats.push("Drying solvents", "Sulfate surfactants");
  if (climates.has("high_uv") || skinTypes.has("hyperpigmentation_prone")) cats.push("AHA exfoliants", "Retinoids");
  if (climates.has("hot") || climates.has("humid")) cats.push("Heavy occlusives", "Silicones");
  if (skinTypes.has("fungal_acne") || skinTypes.has("seborrheic")) cats.push("Plant oils", "Fatty acid esters", "Emulsifiers");
  if (skinTypes.has("rosacea")) cats.push("Chemical sunscreens", "Warming agents", "Drying solvents", "Vasodilators");
  if (skinTypes.has("fungal_acne") || skinTypes.has("seborrheic")) cats.push("Fungal feeds");
  if (skinTypes.has("eczema")) cats.push("Sensitizing preservatives", "Fragrance allergens", "Sulfate surfactants");
  if (skinTypes.has("psoriasis")) cats.push("Fragrances", "Sulfate surfactants");
  if (skinTypes.has("lupus_rash")) cats.push("Chemical sunscreens", "Photosensitizers", "AHA exfoliants");
  if (skinTypes.has("keratosis_pilaris")) cats.push("Heavy occlusives", "Physical exfoliants", "Sulfate surfactants");
  if (skinTypes.has("body_acne")) cats.push("Occlusives", "Waxes", "Film-formers", "Pore-cloggers");
  if (skinTypes.has("fast_shedding")) cats.push("AHA exfoliants", "BHA exfoliants", "Retinoids", "Drying solvents", "Physical exfoliants");
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
  if (climates.has("pregnant")) cats.push("Retinoids", "Chemical sunscreens", "Endocrine disruptors");
  if (climates.has("breastfeeding")) cats.push("Retinoids", "Chemical sunscreens");
  if (climates.has("hormone_sensitive")) cats.push("Phytoestrogens", "Endocrine disruptors", "Parabens");
  if (climates.has("thyroid_condition")) cats.push("Iodine-heavy ingredients");
  if (climates.has("on_hrt")) cats.push("Phytoestrogens", "Endocrine disruptors");
  if (climates.has("perimenopausal") || climates.has("pcos")) cats.push("Phytoestrogens", "Endocrine disruptors");
  if (climates.has("menopausal") || climates.has("on_testosterone")) cats.push("Endocrine disruptors");
  if (climates.has("smoking")) cats.push("Sensitizers", "Fragrance allergens");
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
]);

const ENVIRONMENTAL_CATEGORIES = new Set([
  "reef harmful",
  "PFAS",
  "endocrine disruptor",
  "environmental persistent",
]);

const ENVIRONMENTAL_CONCERN_NOTES: Record<string, string> = {
  "reef harmful": "Listed as reef-toxic — oxybenzone, octinoxate, and octocrylene are banned in Hawaii, Palau, and other reef-protected areas for their documented toxicity to coral. Consider reef-safe mineral sunscreens (zinc oxide, titanium dioxide) when swimming in ocean environments.",
  "PFAS": "PFAS (per- and polyfluoroalkyl substances) do not break down in the environment and accumulate in living organisms and waterways. PTFE ('Teflon') and fluorinated polymers in cosmetics contribute to PFAS environmental load. Alternatives exist for most applications.",
  "endocrine disruptor": "Interferes with hormone signaling in aquatic wildlife at environmentally relevant concentrations. Certain UV filters and cyclic silicones persist in water systems and accumulate in the food chain — their environmental endocrine effects are separate from their skin safety profile.",
  "environmental persistent": "Persists in the environment and accumulates in living organisms. Cyclic silicones (D4, D5, D6) are restricted in EU rinse-off products due to environmental persistence and aquatic bioaccumulation.",
};

type ConcernLevel = "universal" | "profile-matched" | "non-matching" | "neutral";

const SENSORY_CATEGORY_LABEL: Record<string, string> = {
  "chemical-itch": "Contact Allergen",
  "occlusive-itch": "Heat Trap",
  "comedogenic-itch": "Pore-blocking",
};


const STEP_TAG_CONFIG: Record<string, { label: string; desc: string; className: string; chemicalReason: string; neighborContext: string; movementImpact: string; synergy?: string }> = {
  "acid-step": {
    label: "Acid step", className: "border-amber-200 bg-amber-50 text-amber-700",
    desc: "Apply before serums; leave 15–20 min before higher-pH actives like niacinamide or peptides",
    chemicalReason: "AHAs require low pH (3.0–3.5) for optimal activity. Above pH 4, the ionized form dominates and cannot penetrate the stratum corneum — exfoliation efficiency drops by up to 80%.",
    neighborContext: "Apply after cleansing while the skin surface is uncoated. The acid step loosens corneocyte bonds so serums that follow absorb into freshly cleared skin.",
    movementImpact: "Applied after a serum or moisturizer, the formulation's pH is buffered upward and exfoliation is significantly reduced.",
    synergy: "If your routine includes a vitamin C serum, the low-pH environment also briefly stabilizes ascorbic acid and may improve its absorption.",
  },
  "low-ph-step": {
    label: "Low pH", className: "border-orange-200 bg-orange-50 text-orange-700",
    desc: "Ascorbic acid works best at pH 3–3.5. Apply before niacinamide, peptides, or moisturizers and wait 20 min",
    chemicalReason: "L-ascorbic acid is most stable and membrane-permeable at pH 3.0–3.5. Above pH 4, conversion to inactive dehydroascorbic acid accelerates and skin penetration drops sharply.",
    neighborContext: "Apply before niacinamide — at low pH, niacinamide and ascorbic acid can form a yellow complex that reduces both actives' efficacy. A 20-minute gap prevents this.",
    movementImpact: "Applied after a moisturizer, the buffering effect raises the pH and reduces vitamin C delivery by roughly 60%. Vitamin C must go on bare or lightly prepped skin.",
  },
  "retinoid": {
    label: "Retinoid", className: "border-purple-200 bg-purple-50 text-purple-700",
    desc: "Apply last in PM routine. Do not layer with AHAs or BHAs the same evening — alternate evenings instead",
    chemicalReason: "Retinoids bind nuclear receptors to regulate keratinocyte differentiation. Applied as the last active step, nothing dilutes the contact time or competes for receptor binding.",
    neighborContext: "For reactive or compromised skin, apply a light moisturizer before the retinoid (sandwich method) — this buffers absorption without blocking efficacy and significantly reduces peeling.",
    movementImpact: "Applied before serums or moisturizer, subsequent layers dilute and spread the retinoid away from the skin surface, reducing effective dose.",
  },
  "spf-last": {
    label: "Apply last (AM)", className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    desc: "Sunscreen is always the final AM step — after all serums, moisturizers, and eye creams",
    chemicalReason: "UV filter molecules form a protective matrix at the skin surface. Skincare applied on top physically disrupts this matrix, reducing the measured SPF factor.",
    neighborContext: "Everything goes under SPF. Antioxidants like vitamin C and niacinamide applied before enhance photoprotection by neutralizing free radicals that UV filters miss.",
    movementImpact: "Anything applied on top of SPF breaks the UV filter matrix. SPF must always be the final AM step before makeup.",
  },
  "seal-last": {
    label: "Seal last (PM)", className: "border-gray-200 bg-gray-100 text-gray-600",
    desc: "Occlusive ingredients lock in all prior layers — apply as the absolute final PM step",
    chemicalReason: "Petrolatum, silicones, and waxes form an occlusive film that physically blocks transepidermal water loss. Applied last, this film traps all humectants and actives applied before it.",
    neighborContext: "Applied last, the occlusive layer prevents overnight moisture evaporation and keeps all prior actives in sustained contact with the skin surface.",
    movementImpact: "Anything applied after an occlusive cannot penetrate — the film blocks absorption entirely. The sealing product must always go last.",
  },
  "enhancer-caution": {
    label: "Penetration enhancer", className: "border-rose-200 bg-rose-50 text-rose-700",
    desc: "Contains drying alcohol that drives co-applied ingredients deeper — avoid applying immediately before fragrance-heavy or sensitizer-containing products",
    chemicalReason: "Drying alcohols (SD alcohol, denatured alcohol) temporarily disrupt the stratum corneum lipid bilayer, increasing penetration of co-applied ingredients by up to 3×.",
    neighborContext: "Apply first before other toners or serums. The disruption window is short — anything applied immediately after benefits from enhanced penetration.",
    movementImpact: "Applied after actives, the penetration-enhancing window is wasted. Applied before known sensitizers, it drives them deeper than intended.",
  },
};

const RINSE_OFF_SUPPRESS_DB_CATS = new Set(["pore-clogger", "occlusive", "bacteria-trap"]);
const RINSE_OFF_SUPPRESS_SENSORY_CATS = new Set(["Pilling", "Film-forming", "Occlusive", "occlusive-itch", "comedogenic-itch"]);
const RINSE_OFF_SUPPRESS_PHOTO_CATS = new Set(["photo-retinoid", "photo-BHA", "photo-brightening"]);

function isFcProfileMatch(fc: string, activeSkinTypes: Set<SkinType>, activeClimates: Set<ClimateType>): boolean {
  return (
    (["pore-clogger", "occlusive", "bacteria-trap"].includes(fc) &&
      (activeSkinTypes.has("acne_prone") || activeSkinTypes.has("oily") || activeSkinTypes.has("fungal_acne") || activeSkinTypes.has("body_acne") || activeSkinTypes.has("keratosis_pilaris"))) ||
    (fc === "sensitizer" &&
      (activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") || activeSkinTypes.has("eczema") || activeSkinTypes.has("rosacea") || activeSkinTypes.has("psoriasis"))) ||
    (fc === "fragrance-allergen" &&
      (activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") || activeSkinTypes.has("eczema"))) ||
    (fc.toLowerCase() === "chemical sunscreen" &&
      (activeSkinTypes.has("rosacea") || activeSkinTypes.has("lupus_rash"))) ||
    (fc.toLowerCase() === "drying solvent" && (
      activeSkinTypes.has("dry") || activeSkinTypes.has("damaged_barrier") ||
      activeSkinTypes.has("rosacea") || activeSkinTypes.has("fast_shedding") ||
      activeClimates.has("heavy_metal_water"))) ||
    (fc.toLowerCase() === "sulfate surfactant" && (
      activeSkinTypes.has("dry") || activeSkinTypes.has("damaged_barrier") ||
      activeSkinTypes.has("eczema") || activeSkinTypes.has("psoriasis"))) ||
    (["photo-retinoid", "photo-AHA", "photo-BHA", "photo-brightening", "photo-botanical"].includes(fc) &&
      (activeSkinTypes.has("hyperpigmentation_prone") || activeClimates.has("high_uv") || activeSkinTypes.has("lupus_rash"))) ||
    (["photo-retinoid", "photo-AHA", "photo-BHA"].includes(fc) && activeSkinTypes.has("fast_shedding")) ||
    (fc === "sensitizer" && activeSkinTypes.has("fast_shedding")) ||
    (fc === "fragrance-allergen" && activeSkinTypes.has("fast_shedding")) ||
    (fc.toLowerCase() === "chemical sunscreen" && (activeClimates.has("pregnant") || activeClimates.has("breastfeeding"))) ||
    (fc === "photo-retinoid" && activeClimates.has("pregnant")) ||
    (fc === "endocrine disruptor" && (activeClimates.has("pregnant") || activeClimates.has("breastfeeding") || activeClimates.has("hormone_sensitive") || activeClimates.has("on_hrt") || activeClimates.has("perimenopausal") || activeClimates.has("menopausal") || activeClimates.has("pcos") || activeClimates.has("on_testosterone"))) ||
    (fc === "phytoestrogen" && (activeClimates.has("hormone_sensitive") || activeClimates.has("on_hrt") || activeClimates.has("perimenopausal") || activeClimates.has("pcos"))) ||
    (fc === "teratogen" && activeClimates.has("pregnant")) ||
    (fc === "iodine-heavy" && activeClimates.has("thyroid_condition")) ||
    ((fc === "sensitizer" || fc === "fragrance-allergen") && activeClimates.has("smoking")) ||
    (fc === "vasodilator" && (activeSkinTypes.has("rosacea") || activeSkinTypes.has("lupus_rash"))) ||
    (fc === "fungal-feed" && (activeSkinTypes.has("fungal_acne") || activeSkinTypes.has("seborrheic"))) ||
    (fc === "Barrier-disrupting" && (
      activeSkinTypes.has("dry") || activeSkinTypes.has("damaged_barrier") ||
      activeSkinTypes.has("eczema") || activeSkinTypes.has("psoriasis") || activeSkinTypes.has("rosacea"))) ||
    (fc === "Irritant" && (
      activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") ||
      activeSkinTypes.has("eczema") || activeSkinTypes.has("rosacea"))) ||
    (fc === "Synthetic Musk" && (
      activeSkinTypes.has("reactive") || activeSkinTypes.has("eczema") ||
      activeSkinTypes.has("rosacea") || activeClimates.has("hormone_sensitive") || activeClimates.has("on_hrt"))) ||
    (["AHA Exfoliant", "BHA Exfoliant"].includes(fc) && (
      activeSkinTypes.has("hyperpigmentation_prone") || activeClimates.has("high_uv") ||
      activeSkinTypes.has("lupus_rash") || activeSkinTypes.has("fast_shedding") ||
      activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier"))) ||
    (fc === "Fragrance" && (
      activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") ||
      activeSkinTypes.has("eczema") || activeSkinTypes.has("fast_shedding") || activeClimates.has("smoking"))) ||
    (fc === "Preservative" && (
      activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier") || activeSkinTypes.has("eczema")))
  );
}

function getIngredientConcernLevel(
  match: { status: "safe" | "flagged"; ingredient: DbIngredient } | null,
  sensoryItem: SensoryTriggerItem | null,
  photoItem: PhotosensitiveItem | null,
  activeSkinTypes: Set<SkinType>,
  activeClimates: Set<ClimateType>,
  isRinseOff = false,
): ConcernLevel | "skip" {
  // Suppress categories that don't apply to rinse-off products
  if (isRinseOff) {
    if (match?.ingredient.status === "flagged") {
      const allCats = [match.ingredient.flagged_category, ...(match.ingredient.secondary_flagged_categories ?? [])].filter(Boolean);
      if (allCats.length > 0 && allCats.every(c => RINSE_OFF_SUPPRESS_DB_CATS.has(c!))) match = null;
    }
    if (sensoryItem && RINSE_OFF_SUPPRESS_SENSORY_CATS.has(sensoryItem.sensory_category ?? "")) sensoryItem = null;
    if (photoItem && RINSE_OFF_SUPPRESS_PHOTO_CATS.has(photoItem.photoCategory ?? "")) photoItem = null;
  }

  const hasConcern =
    match?.ingredient.status === "flagged" || sensoryItem !== null || photoItem !== null;

  if (!match && !hasConcern) return "skip"; // unreviewed, no annotation
  if (!hasConcern) return "neutral";

  const fc = match?.ingredient.flagged_category ?? "";
  const allFcs = [fc, ...(match?.ingredient.secondary_flagged_categories ?? [])].filter(Boolean);

  if (allFcs.some(c => CONCERN_UNIVERSAL_CATEGORIES.has(c))) return "universal";
  // Only truly phototoxic botanicals (bergapten, psoralen, etc.) are universal — they cause reactions in anyone.
  // AHA/BHA/retinoid/brightening photosensitivity is profile-matched below.
  if (photoItem?.sunLevel === "avoid" && !photoItem.isPositionBased && photoItem.photoCategory === "photo-botanical") return "universal";
  if (allFcs.includes("sensitizer") && match?.ingredient.structural_category === "Fragrance") return "universal";

  const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;
  if (!hasProfile) return "non-matching";

  if (match?.ingredient.status === "flagged") {
    const isMatch = allFcs.some(c => isFcProfileMatch(c, activeSkinTypes, activeClimates));
    if (isMatch) return "profile-matched";
    // Fallback for flagged photosensitizers (AHA, BHA, retinoid, brightening) whose fc isn't in isFcProfileMatch
    if (photoItem && photoItem.photoCategory !== "photo-botanical") {
      if (activeSkinTypes.has("hyperpigmentation_prone") || activeClimates.has("high_uv") ||
          activeSkinTypes.has("reactive") || activeSkinTypes.has("damaged_barrier")) return "profile-matched";
      return "non-matching";
    }
    return "non-matching";
  }

  if (sensoryItem) {
    const sc = sensoryItem.sensory_category ?? "";
    const profileTypes = SENSORY_PROFILE_MAP[sc] ?? [];
    if (profileTypes.some((st) => activeSkinTypes.has(st as SkinType))) return "profile-matched";
    if (
      sc === "Stripping" &&
      (activeSkinTypes.has("dry") || activeSkinTypes.has("damaged_barrier") ||
        activeSkinTypes.has("fast_shedding") ||
        activeClimates.has("dry_climate") || activeClimates.has("cold"))
    ) return "profile-matched";
    if (sc === "Pilling" && (activeClimates.has("hot") || activeClimates.has("humid"))) return "profile-matched";
    return "non-matching";
  }

  if (photoItem && photoItem.photoCategory !== "photo-botanical") {
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

  // Double-dose: same high-concern active across multiple products
  const activePat = /retinol|retinyl|retinaldehyde|tretinoin|glycolic acid|lactic acid|mandelic acid|malic acid|salicylic acid|benzoyl peroxide|azelaic acid/;
  const activeByIng = new Map<string, string[]>();
  for (const p of products) {
    for (const ing of p.ingredients) {
      const lc = ing.toLowerCase();
      if (activePat.test(lc)) {
        if (!activeByIng.has(lc)) activeByIng.set(lc, []);
        activeByIng.get(lc)!.push(p.name);
      }
    }
  }
  for (const [ing, prods] of activeByIng) {
    const uniqueProds = [...new Set(prods)];
    if (uniqueProds.length >= 2) {
      const displayName = ing.replace(/(^\w|\s\w)/g, c => c.toUpperCase());
      warnings.push({ type: "danger", title: `Double dose: ${displayName}`, body: `${uniqueProds.join(" and ")} both contain ${ing} — stacking the same active doubles the dose and compounds irritation risk. Use only one at a time or stagger them to separate sessions.` });
    }
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

function detectCrossSessionWarnings(
  amProducts: RoutineProduct[],
  pmProducts: RoutineProduct[],
  skinTypes: Set<SkinType>,
  climates: Set<ClimateType>
): { type: "danger" | "caution"; title: string; body: string }[] {
  const warnings: { type: "danger" | "caution"; title: string; body: string }[] = [];
  if (amProducts.length === 0 || pmProducts.length === 0) return warnings;

  const amTags = new Set(amProducts.flatMap(p => p.step_tags));
  const pmTags = new Set(pmProducts.flatMap(p => p.step_tags));
  const sensitive = skinTypes.has("reactive") || skinTypes.has("damaged_barrier") || skinTypes.has("rosacea") || skinTypes.has("eczema") || skinTypes.has("psoriasis");

  if (pmTags.has("retinoid") && amTags.has("low-ph-step"))
    warnings.push({ type: sensitive ? "danger" : "caution", title: "Retinoid PM → Vitamin C AM", body: "Retinoids increase skin permeability overnight. Applying vitamin C (pH 3.0–3.5) the morning after means it contacts a more permeable barrier" + (sensitive ? " — on reactive or compromised skin this can cause significant stinging and redness. Consider alternating retinoid evenings with vitamin C mornings." : ". Fine for tolerant skin, but monitor for irritation.") });

  if (pmTags.has("retinoid") && amTags.has("acid-step"))
    warnings.push({ type: sensitive ? "danger" : "caution", title: "Retinoid PM → AHA/BHA AM", body: "Using both a retinoid in PM and an acid exfoliant in AM compounds exfoliation stress across the full 24-hour cycle" + (sensitive ? " — this is too much for reactive or compromised skin. Alternate: retinoid evenings on non-exfoliant days." : ". Tolerable for resilient skin but watch for dryness and peeling.") });

  if (pmTags.has("acid-step") && amTags.has("low-ph-step") && sensitive)
    warnings.push({ type: "caution", title: "AHA PM → Vitamin C AM", body: "AHA exfoliation in PM leaves the barrier thinned overnight. Adding vitamin C (low pH) the next morning extends the sensitization window. For reactive or compromised skin, consider spacing these — vitamin C on non-exfoliant nights, or switch to a gentler vitamin C derivative." });

  if (pmTags.has("retinoid") && !amTags.has("spf-last")) {
    const hasNoSpf = !amProducts.some(p => p.step_tags.includes("spf-last"));
    if (hasNoSpf) warnings.push({ type: "caution", title: "Retinoid PM — SPF required next AM", body: "Retinoids accelerate cell turnover, removing the outermost UV-protective layer. The morning after retinoid use, broad-spectrum SPF is not optional — it is the most important step in your AM routine." });
  }

  const amActiveCount = ACTIVE_LOAD_CATEGORIES.filter(cat =>
    amProducts.some(p => cat.stepTags.some(t => p.step_tags.includes(t)) || cat.ingredientPatterns.some(re => p.ingredients.some(i => re.test(i))))
  ).length;
  const pmActiveCount = ACTIVE_LOAD_CATEGORIES.filter(cat =>
    pmProducts.some(p => cat.stepTags.some(t => p.step_tags.includes(t)) || cat.ingredientPatterns.some(re => p.ingredients.some(i => re.test(i))))
  ).length;
  if (sensitive && amActiveCount >= 2 && pmActiveCount >= 2)
    warnings.push({ type: "caution", title: "High active load across both sessions", body: `Your AM routine has ${amActiveCount} active categories and PM has ${pmActiveCount}. For reactive or compromised skin, the skin's repair window between sessions may not be sufficient. Consider moving some actives to alternate days rather than using all daily.` });

  return warnings;
}

function getOvernightState(pmProducts: RoutineProduct[]): { label: string; detail: string }[] {
  const tags = new Set(pmProducts.flatMap(p => p.step_tags));
  const states: { label: string; detail: string }[] = [];
  if (tags.has("retinoid")) states.push({ label: "Retinoid recovery", detail: "Cell turnover is accelerated, barrier is more permeable and UV-sensitive by morning" });
  if (tags.has("acid-step")) states.push({ label: "Post-exfoliation", detail: "Outer protective layer thinned; skin is more reactive to actives in the morning" });
  if (tags.has("seal-last")) states.push({ label: "Sealed overnight", detail: "Occlusive film supports barrier repair through the night" });
  if (tags.has("enhancer-caution") && !tags.has("retinoid") && !tags.has("acid-step"))
    states.push({ label: "Enhanced penetration", detail: "Penetration-enhancing toner drove actives deeper — barrier is in recovery" });
  return states;
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
  if (skinTypes.has("reactive") || skinTypes.has("damaged_barrier") || skinTypes.has("eczema") || skinTypes.has("rosacea") || skinTypes.has("psoriasis") || skinTypes.has("fast_shedding") || climates.has("smoking"))
    cats.push("sensitizer");
  if (skinTypes.has("reactive") || skinTypes.has("damaged_barrier") || skinTypes.has("eczema") || skinTypes.has("fast_shedding") || climates.has("smoking"))
    cats.push("fragrance-allergen");
  if (skinTypes.has("rosacea") || skinTypes.has("lupus_rash") || climates.has("pregnant") || climates.has("breastfeeding"))
    cats.push("Chemical Sunscreen");
  if (skinTypes.has("hyperpigmentation_prone") || climates.has("high_uv") || skinTypes.has("lupus_rash"))
    cats.push("photo-retinoid", "photo-AHA", "photo-BHA", "photo-brightening", "photo-botanical");
  if (skinTypes.has("fast_shedding") || climates.has("pregnant"))
    cats.push("photo-retinoid", "photo-AHA", "photo-BHA");
  if (skinTypes.has("dry") || skinTypes.has("damaged_barrier") || skinTypes.has("rosacea") || skinTypes.has("fast_shedding") || climates.has("heavy_metal_water"))
    cats.push("Drying Solvent");
  if (skinTypes.has("dry") || skinTypes.has("damaged_barrier") || skinTypes.has("eczema") || skinTypes.has("psoriasis"))
    cats.push("Sulfate Surfactant");
  if (skinTypes.has("rosacea") || skinTypes.has("lupus_rash"))
    cats.push("vasodilator");
  if (skinTypes.has("fungal_acne") || skinTypes.has("seborrheic"))
    cats.push("fungal-feed");
  if (climates.has("pregnant") || climates.has("breastfeeding") || climates.has("hormone_sensitive") || climates.has("on_hrt"))
    cats.push("endocrine disruptor");
  if (climates.has("hormone_sensitive") || climates.has("on_hrt"))
    cats.push("phytoestrogen");
  if (climates.has("pregnant"))
    cats.push("teratogen");
  if (climates.has("thyroid_condition"))
    cats.push("iodine-heavy");
  return [...new Set(cats)];
}

function getSlotPriority(slot: typeof ROUTINE_SLOTS[0], skinTypes: Set<string>, climates: Set<string>): SlotPriority {
  const all = [...skinTypes, ...climates];
  const order: SlotPriority[] = ["avoid", "essential", "beneficial", "optional"];
  let best = slot.defaultPriority;
  for (const p of all) {
    const ov = slot.profilePriority[p];
    if (ov === "avoid") return "avoid";
    if (ov && order.indexOf(ov) < order.indexOf(best)) best = ov;
  }
  return best;
}

function getSlotReasons(slot: typeof ROUTINE_SLOTS[0], skinTypes: Set<string>, climates: Set<string>): string[] {
  const all = [...skinTypes, ...climates];
  const reasons = all.flatMap(p => slot.profileReasons[p] ? [slot.profileReasons[p]!] : []);
  return reasons.length > 0 ? reasons : [slot.defaultReason];
}

function getActiveLoads(products: RoutineProduct[], skinTypes: Set<string>, climates: Set<string>) {
  const all = [...skinTypes, ...climates];
  return ACTIVE_LOAD_CATEGORIES.map(cat => {
    const contributors = products.filter(p =>
      cat.stepTags.some(t => p.step_tags.includes(t)) ||
      cat.ingredientPatterns.some(re => p.ingredients.some(ing => re.test(ing)))
    );
    if (contributors.length === 0) return null;
    const count = contributors.length;
    const tensions = all
      .map(p => cat.profileThresholds[p] ? { ...cat.profileThresholds[p]!, over: count > cat.profileThresholds[p]!.max } : null)
      .filter(Boolean) as { max: number; note: string; over: boolean }[];
    const unique = tensions.filter((t, i, a) => a.findIndex(x => x.note === t.note) === i);
    return { key: cat.key, label: cat.label, count, contributors, defaultMax: cat.defaultMax, tensions: unique };
  }).filter(Boolean) as { key: string; label: string; count: number; contributors: RoutineProduct[]; defaultMax: number; tensions: { max: number; note: string; over: boolean }[] }[];
}

function getOverlapBadge(product: RoutineProduct, all: RoutineProduct[], skinTypes: Set<string>, climates: Set<string>): { label: string; high: boolean } | null {
  const profiles = [...skinTypes, ...climates];
  for (const cat of ACTIVE_LOAD_CATEGORIES) {
    const covers = (p: RoutineProduct) =>
      cat.stepTags.some(t => p.step_tags.includes(t)) ||
      cat.ingredientPatterns.some(re => p.ingredients.some(ing => re.test(ing)));
    if (!covers(product)) continue;
    const others = all.filter(p => p.routineId !== product.routineId && covers(p));
    if (others.length === 0) continue;
    const total = others.length + 1;
    const isHigh = profiles.some(p => { const t = cat.profileThresholds[p]; return t && total > t.max; });
    const names = others.slice(0, 2).map(p => p.name).join(", ") + (others.length > 2 ? ` +${others.length - 2}` : "");
    return { label: `${cat.label} — also in ${names}`, high: isHigh };
  }
  return null;
}

function getWaitTimeAfter(p: RoutineProduct): string | null {
  if (p.step_tags.includes("acid-step")) return "15–20 min";
  if (p.step_tags.includes("low-ph-step")) return "20 min";
  if (p.step_tags.includes("enhancer-caution")) return "1 min";
  if (p.step_tags.includes("retinoid") || p.step_tags.includes("spf-last") || p.step_tags.includes("seal-last")) return null;
  return "30 sec";
}

export default function Scanner({ initialProductId, initialCamera }: { initialProductId?: string | null; initialCamera?: string | null }) {
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
  const [watchingProduct, setWatchingProduct] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
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
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [ingredientLists, setIngredientLists] = useState<IngredientList[]>([]);
  const [addToListMenu, setAddToListMenu] = useState<string | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddListId, setBulkAddListId] = useState<string | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseSelectedArea, setBrowseSelectedArea] = useState<string | null>(null);
  const [browseAreaTypeFilter, setBrowseAreaTypeFilter] = useState<string | null>(null);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [imageUploadUrl, setImageUploadUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageRefetching, setImageRefetching] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [autoSearching, setAutoSearching] = useState(false);
  const [autoSearchResult, setAutoSearchResult] = useState<"found" | "not-found" | null>(null);
  const [addSubTab, setAddSubTab] = useState<"url" | "submit">("url");
  const [submitName, setSubmitName] = useState("");
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitType, setSubmitType] = useState("");
  const [submitIngredients, setSubmitIngredients] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitImageUrl, setSubmitImageUrl] = useState("");
  const [submitIherbUrl, setSubmitIherbUrl] = useState("");
  const [submitSourceUrl, setSubmitSourceUrl] = useState("");
  const [submitMode, setSubmitMode] = useState<"paste" | "url">("paste");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);
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
  const [productInList, setProductInList] = useState<string | null>(null);
  const [saveListError, setSaveListError] = useState<string | null>(null);
  const [importUrls, setImportUrls] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [backgroundImport, setBackgroundImport] = useState(true);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [importPolling, setImportPolling] = useState(false);
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
  const { activeSkinTypes, activeClimates } = useSkinProfile();
  const [concernExpanded, setConcernExpanded] = useState<Set<string>>(new Set());
  const [neutralGroupOpen, setNeutralGroupOpen] = useState(true);
  const [formulaInteractionsOpen, setFormulaInteractionsOpen] = useState(false);
  const [profileInteractionsOpen, setProfileInteractionsOpen] = useState(false);
  const [showStickyProduct, setShowStickyProduct] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [routineRenaming, setRoutineRenaming] = useState(false);
  const [routineRenameValue, setRoutineRenameValue] = useState("");
  const [addedToRoutine, setAddedToRoutine] = useState(false);
  const [routinePanelOpen, setRoutinePanelOpen] = useState(false);
  const [quickListProductId, setQuickListProductId] = useState<string | null>(null);
  const [quickListSaving, setQuickListSaving] = useState<string | null>(null);
  const [quickListNewOpen, setQuickListNewOpen] = useState(false);
  const [quickListNewName, setQuickListNewName] = useState("");
  const [ingredientNewListOpen, setIngredientNewListOpen] = useState(false);
  const [ingredientNewListName, setIngredientNewListName] = useState("");
  const [flaggedIngredients, setFlaggedIngredients] = useState<Set<string>>(new Set());
  const [flagging, setFlagging] = useState<string | null>(null);
  const [flagPanelIngId, setFlagPanelIngId] = useState<string | null>(null);
  const [flagSelectedReasons, setFlagSelectedReasons] = useState<Set<string>>(new Set());
  const [flagNote, setFlagNote] = useState("");
  const [stepTagHint, setStepTagHint] = useState<string | null>(null);
  const [routineStepHint, setRoutineStepHint] = useState<string | null>(null);
  const [whatNextHint, setWhatNextHint] = useState<string | null>(null);
  const [routineView, setRoutineView] = useState<"timeline" | "detail">("detail");
  const [suggestions, setSuggestions] = useState<BrowseProduct[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchFiltersPanelOpen, setSearchFiltersPanelOpen] = useState(false);
  const [searchNoUniversal, setSearchNoUniversal] = useState(false);
  const [searchProfileLinked, setSearchProfileLinked] = useState(false);
  const [searchCleanOnly, setSearchCleanOnly] = useState(false);
  const [searchPhotosafe, setSearchPhotosafe] = useState(false);
  const [searchListModes, setSearchListModes] = useState<Record<string, "include" | "exclude" | "off">>({});
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);

  // Derived routine state — all reads of routineProducts work unchanged
  const activeRoutine = routines.find(r => r.id === activeRoutineId) ?? routines[0] ?? null;
  const routineProducts = activeRoutine?.products ?? [];

  const initialProductIdRef = useRef(initialProductId);
  const scrollToProductRef = useRef(false);
  const scrollToDymRef = useRef(false);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialProductIdRef.current) {
      scanVariant({ productId: initialProductIdRef.current });
    }
    if (initialCamera === "scan") {
      setTab("paste");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleCameraEvent() {
      setTab("paste");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener("skindex:camera", handleCameraEvent);
    return () => window.removeEventListener("skindex:camera", handleCameraEvent);
  }, []);

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
      const routinesRaw = localStorage.getItem("skindex:routines");
      const activeIdRaw = localStorage.getItem("skindex:activeRoutineId");
      const legacyRt = localStorage.getItem("skindex:routine");
      if (routinesRaw) {
        const loaded = JSON.parse(routinesRaw) as Routine[];
        setRoutines(loaded);
        setActiveRoutineId(activeIdRaw ?? loaded[0]?.id ?? null);
      } else if (legacyRt) {
        // Migrate from old single-routine format
        const products = JSON.parse(legacyRt) as RoutineProduct[];
        const migrated: Routine = { id: crypto.randomUUID(), name: "My Routine", products };
        setRoutines([migrated]);
        setActiveRoutineId(migrated.id);
      }
      // Ingredient lists: guests load from localStorage; signed-in users load from DB below
      if (!isSignedIn) {
        const il = localStorage.getItem("skindex:ingredientLists");
        if (il) setIngredientLists(JSON.parse(il) as IngredientList[]);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Eagerly load user's product lists and check if current product is saved in any
  useEffect(() => {
    setProductInList(null);
    setUserLists([]);
    setUserListsLoaded(false);
    if (!result?.product?.id || !isSignedIn) return;
    const pid = result.product.id;
    fetch(`/api/lists?productId=${encodeURIComponent(pid)}`)
      .then((r) => r.json())
      .then((data) => {
        const lists: UserList[] = data.lists ?? [];
        setUserLists(lists);
        setUserListsLoaded(true);
        const hit = lists.find((l) => l.containsProduct);
        setProductInList(hit?.name ?? null);
      })
      .catch(() => {});
  }, [result?.product?.id, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if user is watching this product for ingredient generation
  useEffect(() => {
    setWatchingProduct(false);
    if (!isSignedIn || !result?.product?.id || !result.unreviewed?.length) return;
    fetch(`/api/product-watch?productId=${result.product.id}`)
      .then((r) => r.json())
      .then((d) => setWatchingProduct(!!d.watching))
      .catch(() => {});
  }, [result?.product?.id, result?.unreviewed?.length, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load ingredient lists from DB when signed in; migrate from localStorage if DB is empty
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user-ingredient-lists")
      .then((r) => r.json())
      .then(async (d) => {
        const dbLists: IngredientList[] = d.lists ?? [];
        if (dbLists.length > 0) {
          setIngredientLists(dbLists);
        } else {
          try {
            const il = localStorage.getItem("skindex:ingredientLists");
            const local: IngredientList[] = il ? JSON.parse(il) : [];
            if (local.length > 0) {
              const created = await Promise.all(
                local.map((l) =>
                  fetch("/api/user-ingredient-lists", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: l.name, items: l.items }),
                  }).then((r) => r.json()).then((j) => j.list as IngredientList)
                )
              );
              setIngredientLists(created.filter(Boolean));
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    try {
      localStorage.setItem("skindex:routines", JSON.stringify(routines));
      if (activeRoutineId) localStorage.setItem("skindex:activeRoutineId", activeRoutineId);
    } catch {}
  }, [routines, activeRoutineId]);

  // Load routines from DB when signed in; migrate from localStorage if DB is empty
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/routines")
      .then(r => r.json())
      .then(async (d) => {
        const dbRoutines: Routine[] = (d.routines ?? []).map((r: { id: string; name: string; products: RoutineProduct[] }) => ({
          id: r.id, name: r.name, products: r.products ?? [],
        }));
        if (dbRoutines.length > 0) {
          setRoutines(dbRoutines);
          setActiveRoutineId(prev => dbRoutines.find(r => r.id === prev)?.id ?? dbRoutines[0].id);
        } else {
          // Migrate localStorage routines to DB
          const localRaw = localStorage.getItem("skindex:routines");
          const localRoutines: Routine[] = localRaw ? JSON.parse(localRaw) : [];
          if (localRoutines.length > 0) {
            const created = await Promise.all(
              localRoutines.map((r, i) =>
                fetch("/api/routines", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: r.name, products: r.products, display_order: i }),
                }).then(res => res.json()).then(j => j.routine as Routine)
              )
            );
            const valid = created.filter(Boolean);
            if (valid.length > 0) { setRoutines(valid); setActiveRoutineId(valid[0].id); }
          }
        }
      })
      .catch(() => {});
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep localStorage as a local cache (used when signed out on other devices)
  useEffect(() => {
    try { localStorage.setItem("skindex:ingredientLists", JSON.stringify(ingredientLists)); } catch {}
  }, [ingredientLists]);

  // Restore in-progress background import batch on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("skindex:importBatch");
      if (saved) { setImportBatchId(saved); setImportPolling(true); }
    } catch {}
  }, []);

  // Poll for background import progress
  useEffect(() => {
    if (!importBatchId || !importPolling) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/import-jobs/${importBatchId}`);
        if (!res.ok) { setImportPolling(false); return; }
        const { jobs } = await res.json();
        if (!jobs?.length) { setImportPolling(false); return; }
        const mapped: ImportResult[] = jobs.map((j: { url: string; status: string; name?: string; brand?: string; reason?: string; http_status?: number; fetch_error?: string }) => ({
          url: j.url,
          status: j.status as ImportResult["status"],
          name: j.name ?? undefined,
          brand: j.brand ?? undefined,
          reason: j.reason ?? undefined,
          httpStatus: j.http_status ?? undefined,
          fetchError: j.fetch_error ?? undefined,
        }));
        setImportResults(mapped);
        const done = jobs.every((j: { status: string }) => j.status === "imported" || j.status === "skipped" || j.status === "failed");
        if (done) {
          setImportPolling(false);
          try { localStorage.removeItem("skindex:importBatch"); } catch {}
        }
      } catch {}
      if (active && importPolling) setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 1000);
    return () => { active = false; clearTimeout(t); };
  }, [importBatchId, importPolling]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/browse")
      .then((r) => r.json())
      .then((d) => setBrowseTypes(d.types ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "search") { setSuggestionsOpen(false); return; }
    if (!query.trim() || query.trim().length < 2) { setSuggestions([]); setSuggestionsOpen(false); return; }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => {
      const profileConcerns = profileMatchedCategories(activeSkinTypes, activeClimates);
      const params = new URLSearchParams({ q: query.trim() });
      if (profileConcerns.length) params.set("concerns", profileConcerns.join(","));
      if (activeSkinTypes.size > 0) params.set("skinTypes", [...activeSkinTypes].join(","));
      if (activeClimates.size > 0) params.set("climates", [...activeClimates].join(","));
      setSuggestionsLoading(true);
      fetch(`/api/products/search?${params}`)
        .then((r) => r.json())
        .then((d) => { setSuggestions(d.products ?? []); setSuggestionsOpen(true); })
        .catch(() => {})
        .finally(() => setSuggestionsLoading(false));
    }, 250);
    return () => { if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current); };
  }, [query, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
        setSearchFiltersPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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


  async function handleScan(override?: { tab?: Tab; query?: string; productId?: string }) {
    setSuggestionsOpen(false);
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
    setAddSubTab("url");
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
    const activeProductId = override?.productId;
    const profileConcerns = profileMatchedCategories(activeSkinTypes, activeClimates);
    const skinTypes = [...activeSkinTypes];
    const climates = [...activeClimates];
    const body =
      activeTab === "search"
        ? { type: "search", query: activeQuery, ...(activeProductId ? { productId: activeProductId } : {}), profileConcerns, skinTypes, climates }
        : activeTab === "paste"
        ? { type: "paste", ingredients, profileConcerns, skinTypes, climates }
        : { type: "url", url: importUrls.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "", profileConcerns, skinTypes, climates };

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

  async function flagIngredient(ingId: string, reasons: string[], note: string, productId: string | null) {
    if (flagging || flaggedIngredients.has(ingId)) return;
    setFlagging(ingId);
    try {
      await fetch("/api/ingredient-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: ingId,
          reasons: reasons.length > 0 ? reasons : undefined,
          note: note.trim() || undefined,
          productId: productId ?? undefined,
          userProfileSnapshot: {
            skinTypes: [...activeSkinTypes],
            climates: [...activeClimates],
          },
        }),
      });
      setFlaggedIngredients((prev) => new Set([...prev, ingId]));
      setFlagPanelIngId(null);
      setFlagSelectedReasons(new Set());
      setFlagNote("");
    } catch { }
    setFlagging(null);
  }

  const FLAG_REASON_CHIPS = [
    "Wrong information",
    "Too harsh — I use this fine",
    "Too mild — I react to this",
    "Wrong ingredient name",
    "Other",
  ];

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
    setAddSubTab("url");
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

    const profileConcerns = profileMatchedCategories(activeSkinTypes, activeClimates);
    const skinTypes = [...activeSkinTypes];
    const climates = [...activeClimates];
    const body = opts.productId
      ? { type: "search", query, productId: opts.productId, profileConcerns, skinTypes, climates }
      : { type: "paste", ingredients: opts.pasteIngredients, profileConcerns, skinTypes, climates };

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

  async function handleBarcodeDetected(barcode: string) {
    setBarcodeOpen(false);
    setBarcodeLoading(true);
    try {
      const res = await fetch(`/api/scan/barcode?code=${encodeURIComponent(barcode)}`);
      const data = await res.json() as { notFound?: boolean; name?: string | null; brand?: string | null; ingredients?: string | null };
      setBarcodeLoading(false);
      if (data.notFound || !data.name) {
        // Nothing found in OBF — put the raw barcode in the search box
        setQuery(barcode);
        return;
      }
      if (data.ingredients) {
        await scanVariant({ pasteIngredients: data.ingredients, productName: data.name, productBrand: data.brand ?? null });
      } else {
        // Name found but no ingredients — fall back to a name search
        setQuery(data.name);
        handleScan({ tab: "search", query: data.name });
      }
    } catch {
      setBarcodeLoading(false);
    }
  }

  async function handleOCRExtracted(text: string) {
    setOcrOpen(false);
    setIngredients(text);
    await scanVariant({ pasteIngredients: text });
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
    const profileConcerns = profileMatchedCategories(activeSkinTypes, activeClimates);
    const res = await fetch("/api/alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedIds, productType: result.product?.type ?? null, profileConcerns, skinTypes: [...activeSkinTypes], climates: [...activeClimates] }),
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
    if (submitImageUrl.trim()) body.image_url = submitImageUrl.trim();
    if (submitIherbUrl.trim()) body.iherb_url = submitIherbUrl.trim();
    if (submitSourceUrl.trim()) body.source_url = submitSourceUrl.trim();

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
      setAddSubTab("url");
      setTab("search");
      scanVariant({ productId: submitData.productId });
      return;
    }
    if (!submitRes.ok) {
      const err = submitData.error;
      const msg = typeof err === "string" ? err : err?.message ?? submitData.message ?? "Submission failed";
      setSubmitError(msg);
      return;
    }
    setAddSubTab("url");
    setSubmitDone(true);
    setSubmitName("");
    setSubmitBrand("");
    setSubmitType("");
    setSubmitIngredients("");
    setSubmitUrl("");
    setSubmitImageUrl("");
    setSubmitIherbUrl("");
    setSubmitSourceUrl("");
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
    if (!isSignedIn || userListsLoaded) return;
    const res = await fetch("/api/lists");
    const data = await res.json();
    setUserLists(data.lists ?? []);
    setUserListsLoaded(true);
  }

  async function toggleProductWatch() {
    if (!result?.product?.id || !isSignedIn) return;
    setWatchLoading(true);
    try {
      if (watchingProduct) {
        await fetch(`/api/product-watch?productId=${result.product.id}`, { method: "DELETE" });
        setWatchingProduct(false);
      } else {
        await fetch("/api/product-watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: result.product.id, unreviewedNames: result.unreviewed }),
        });
        setWatchingProduct(true);
      }
    } catch {}
    setWatchLoading(false);
  }

  async function quickCreateListAndAdd(name: string, productId: string) {
    if (!name.trim()) return;
    setQuickListSaving("new");
    const createRes = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) { setQuickListSaving(null); return; }
    await fetch(`/api/lists/${createData.list.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    setUserLists((prev) => [{ ...createData.list, itemCount: 1 }, ...prev]);
    setQuickListSaving(null);
    setQuickListNewOpen(false);
    setQuickListNewName("");
    setQuickListProductId(null);
  }

  async function quickCreateIngredientList(name: string, itemKey: string) {
    if (!name.trim()) return;
    let newList: IngredientList;
    if (isSignedIn) {
      const res = await fetch("/api/user-ingredient-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), items: [itemKey] }),
      });
      const data = await res.json();
      if (!res.ok) return;
      newList = data.list as IngredientList;
    } else {
      newList = { id: crypto.randomUUID(), name: name.trim(), items: [itemKey] };
    }
    setIngredientLists((prev) => [...prev, newList]);
    setIngredientNewListOpen(false);
    setIngredientNewListName("");
    setAddToListMenu(null);
  }

  function syncIngredientListItems(listId: string, newItems: string[]) {
    if (!isSignedIn) return;
    fetch(`/api/user-ingredient-lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: newItems }),
    }).catch(() => {});
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
    setUserLists((prev) => prev.map((l) => l.id === listId ? { ...l, itemCount: l.itemCount + 1, containsProduct: true } : l));
    setSavedTo(listName);
    setProductInList(listName);
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

    setUserLists((prev) => [{ ...createData.list, itemCount: 1, containsProduct: true }, ...prev]);
    setSaveListLoading(null);
    setNewListInputOpen(false);
    setNewListName("");
    setSavedTo(name.trim());
    setProductInList(name.trim());
    setTimeout(() => { setSaveListOpen(false); setSavedTo(null); }, 1800);
  }

  function ensureActiveRoutine(prev: Routine[]): { routines: Routine[]; id: string } {
    if (prev.length > 0 && (activeRoutineId ?? prev[0]?.id)) {
      const id = activeRoutineId ?? prev[0].id;
      return { routines: prev, id };
    }
    const newR: Routine = { id: crypto.randomUUID(), name: "My Routine", products: [] };
    return { routines: [newR], id: newR.id };
  }

  function updateActiveProducts(updater: (p: RoutineProduct[]) => RoutineProduct[]) {
    setRoutines(prev => {
      const { routines: base, id } = ensureActiveRoutine(prev);
      const updated = base.map(r => r.id === id ? { ...r, products: updater(r.products) } : r);
      if (isSignedIn) {
        const target = updated.find(r => r.id === id);
        if (target) fetch(`/api/routines/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: target.products }) }).catch(() => {});
      }
      return updated;
    });
  }

  function createRoutine() {
    const newR: Routine = { id: crypto.randomUUID(), name: "New Routine", products: [] };
    setRoutines(prev => {
      const updated = [...prev, newR];
      if (isSignedIn) {
        fetch("/api/routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newR.name, products: [], display_order: prev.length }) })
          .then(r => r.json()).then(d => {
            if (d.routine?.id) {
              setRoutines(rr => rr.map(r => r.id === newR.id ? { ...r, id: d.routine.id } : r));
              setActiveRoutineId(d.routine.id);
            }
          }).catch(() => {});
      }
      return updated;
    });
    setActiveRoutineId(newR.id);
    setRoutineRenaming(true);
    setRoutineRenameValue("New Routine");
  }

  function renameRoutine(id: string, name: string) {
    setRoutines(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, name } : r);
      if (isSignedIn) fetch(`/api/routines/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => {});
      return updated;
    });
    setRoutineRenaming(false);
  }

  function deleteRoutine(id: string) {
    setRoutines(prev => {
      const updated = prev.filter(r => r.id !== id);
      if (isSignedIn) fetch(`/api/routines/${id}`, { method: "DELETE" }).catch(() => {});
      if (activeRoutineId === id) setActiveRoutineId(updated[0]?.id ?? null);
      return updated;
    });
  }

  function suggestTimeOfDay(stepTags: string[]): "am" | "pm" | null {
    if (stepTags.includes("spf-last")) return "am";
    if (stepTags.includes("retinoid") || stepTags.includes("seal-last")) return "pm";
    if (stepTags.includes("acid-step")) return "pm";
    if (stepTags.includes("low-ph-step")) return "am";
    return null;
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
      productType: result.product.type ?? null,
      image_url: result.product.image_url ?? null,
    };
    updateActiveProducts(prev => [...prev, newEntry]);
    setAddedToRoutine(true);
    setTimeout(() => setAddedToRoutine(false), 2000);
  }

  function removeFromRoutine(routineId: string) {
    updateActiveProducts(prev => prev.filter(p => p.routineId !== routineId));
  }

  function addBareToRoutine(name: string, brand: string | null, ingredients: string[]) {
    const newEntry: RoutineProduct = {
      routineId: Date.now().toString(),
      name,
      brand,
      step_tags: [],
      ingredients,
      flaggedCategories: [],
      timeOfDay: null,
      productType: null,
      image_url: null,
    };
    updateActiveProducts(prev => [...prev, newEntry]);
    setRoutinePanelOpen(true);
  }

  async function openQuickList(productId: string) {
    setQuickListNewOpen(false);
    setQuickListNewName("");
    setQuickListProductId((prev) => (prev === productId ? null : productId));
    if (!userListsLoaded) {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setUserLists(data.lists ?? []);
      setUserListsLoaded(true);
    }
  }

  async function quickAddToList(listId: string, listName: string, productId: string) {
    setQuickListSaving(listId);
    await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    setQuickListSaving(null);
    setUserLists((prev) => prev.map((l) => l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l));
    setQuickListProductId(null);
  }


  function isProfileNote(n: SkinClimateNote): boolean {
    const skinMatch = n.dimensions.length === 0 || n.dimensions.some((d) => activeSkinTypes.has(d as SkinType));
    const climateMatch = n.climate.length === 0 || n.climate.some((c) => activeClimates.has(c as ClimateType));
    return skinMatch && climateMatch;
  }

  function filterNotes(notes: SkinClimateNote[] | null | undefined): SkinClimateNote[] {
    if (!notes?.length) return [];
    return notes.filter((n) => isProfileNote(n));
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
    setBrowseSelectedArea(null);
    setBrowseAreaTypeFilter(null);
    setBrowseProducts([]);
    setBrowseLoading(true);
    const params = new URLSearchParams({ type: typeName });
    const concerns = profileMatchedCategories(activeSkinTypes, activeClimates);
    if (concerns.length) params.set("concerns", concerns.join(","));
    if (activeSkinTypes.size > 0) params.set("skinTypes", [...activeSkinTypes].join(","));
    if (activeClimates.size > 0) params.set("climates", [...activeClimates].join(","));
    if (rinseOffDefaults.has(typeName)) params.set("isRinseOff", "1");
    const res = await fetch(`/api/browse?${params.toString()}`);
    const data = await res.json();
    setBrowseProducts(data.products ?? []);
    setBrowseLoading(false);
  }

  async function selectBrowseArea(areaName: string) {
    setBrowseSelectedArea(areaName);
    setBrowseSelectedType(null);
    setBrowseAreaTypeFilter(null);
    setBrowseProducts([]);
    setBrowseLoading(true);
    const params = new URLSearchParams({ area: areaName });
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

  function getPostWashNote(
    skinTypes: Set<SkinType>,
    climates: Set<ClimateType>,
    ingredients?: { structural_category?: string | null; category?: string | null }[]
  ): { title: string; body: string } | null {
    const hardWater      = climates.has("hard_water");
    const chlorinated    = climates.has("chlorinated_water");
    const ironWater      = climates.has("iron_water");
    const waterTypes     = [hardWater && "hard water", chlorinated && "chlorinated water", ironWater && "iron water"].filter(Boolean) as string[];
    const acneOrOily     = skinTypes.has("acne_prone") || skinTypes.has("oily");
    const malassezia     = skinTypes.has("fungal_acne") || skinTypes.has("seborrheic");
    const barrier        = skinTypes.has("damaged_barrier") || skinTypes.has("reactive");
    if (!acneOrOily && !malassezia && !barrier) return null;

    const hasChelating   = !!ingredients?.some(i => i.structural_category === "Chelating Agent" || i.category === "water-protective");
    const hasExfoliant   = !!ingredients?.some(i => i.structural_category === "Exfoliant");
    const hasWater       = waterTypes.length > 0;

    const waterLabel     = waterTypes.length > 1 ? "water quality" : waterTypes[0];
    const title          = waterLabel
      ? `Post-wash conflict — ${waterLabel}`
      : "Post-wash timing conflict";

    const parts: string[] = [];
    if (hasWater && hasChelating && hasExfoliant) {
      parts.push("Your cleanser contains chelating agents (which bind hard water minerals during rinsing) and exfoliant acids (which leave the skin more acidified post-rinse) — together these significantly reduce the acid mantle disruption from hard water. The timing window is shorter than with a standard cleanser.");
    } else if (hasWater && hasChelating) {
      parts.push("Your cleanser contains chelating agents that bind hard water minerals during rinsing, preventing most of the mineral deposit that raises skin pH. The acid mantle recovers faster than with a standard cleanser — the 30-second window is less critical but still beneficial.");
    } else if (hasWater && hasExfoliant) {
      parts.push("Hard or chlorinated water temporarily raises skin pH — however, your cleanser's exfoliant acids leave the skin more acidified post-rinse, so the acid mantle recovers faster than after a standard cleanser.");
    } else if (hasWater) {
      parts.push("Hard or chlorinated water temporarily raises skin pH above 7 — the acid mantle (normally 4.5–5.5) takes 20–30 minutes to recover on its own.");
    } else if (hasExfoliant) {
      parts.push("Your cleanser contains exfoliant acids, so the acid mantle recovers faster than after a standard alkaline cleanser — though applying your first product quickly still helps.");
    } else {
      parts.push("After washing, the acid mantle takes up to 20–30 minutes to recover its normal pH of 4.5–5.5.");
    }

    if (acneOrOily) parts.push("During this window, C. acnes proliferates at elevated pH and fresh sebum replenishment begins immediately — applying a low-pH product within 30 seconds of patting dry closes this window fastest.");
    if (malassezia) parts.push("Malassezia recolonizes most rapidly in the first minutes after cleansing, when the skin surface is warm and freshly sebum-coated. A low-pH toner or essence applied immediately helps suppress this.");
    if (barrier) parts.push("With a damaged barrier, transepidermal water loss (TEWL) peaks in the first minutes post-wash — applying any film-forming or occlusive layer promptly traps moisture before evaporation sets in.");
    parts.push("The highest-impact habit for your profile: apply your first product within 30 seconds of patting dry, before the skin surface dries completely.");
    return { title, body: parts.join(" ") };
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

    const sortByStep = (products: RoutineProduct[]) =>
      [...products].sort((a, b) => getStepOrder(a.step_tags) - getStepOrder(b.step_tags));

    const amProducts = sortByStep(routineProducts.filter(p => p.timeOfDay === "am"));
    const pmProducts = sortByStep(routineProducts.filter(p => p.timeOfDay === "pm"));
    const bothProducts = routineProducts.filter(p => !p.timeOfDay);
    const totalConcerns = routineProducts.reduce((n, p) => n + p.flaggedCategories.length, 0);

    const amTimeline = sortByStep([...amProducts, ...bothProducts]);
    const pmTimeline = sortByStep([...pmProducts, ...bothProducts]);
    const crossSessionWarns = detectCrossSessionWarnings(amTimeline, pmTimeline, activeSkinTypes, activeClimates);
    const overnightState = getOvernightState(pmTimeline);

    const renderTimelineNode = (p: RoutineProduct, isLast: boolean) => {
      const TypeIcon = (p.productType && CATEGORY_ICONS[p.productType]) ? CATEGORY_ICONS[p.productType] : null;
      const brandInName = p.brand && p.name.toLowerCase().startsWith(p.brand.toLowerCase());
      const displayName = !p.brand ? p.name : brandInName ? p.brand + ", " + p.name.slice(p.brand.length).trim() : p.brand + ", " + p.name;
      const wait = isLast ? null : getWaitTimeAfter(p);
      return (
        <div key={p.routineId} className="relative ml-6 mb-1">
          <div className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-gray-300 z-10" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="w-5 h-5 rounded bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
              {p.image_url
                ? <img src={proxyImage(p.image_url)!} alt="" className="w-full h-full object-contain" />
                : TypeIcon ? <TypeIcon size={11} className="text-gray-300" /> : <Droplet size={11} className="text-gray-300" />}
            </div>
            <span className="text-[10px] text-gray-700 truncate max-w-[140px]">{displayName}</span>
            {!p.timeOfDay && <span className="text-[9px] text-gray-400 border border-gray-200 rounded-full px-1">AM+PM</span>}
            {p.step_tags.map(tag => {
              const cfg = STEP_TAG_CONFIG[tag];
              if (!cfg) return null;
              return <span key={tag} className={`text-[9px] px-1 py-0 rounded-full border ${cfg.className}`}>{cfg.label}</span>;
            })}
          </div>
          {wait && <p className="text-[9px] text-gray-300 ml-6 mt-0.5">{wait}</p>}
        </div>
      );
    };

    const renderTimeline = () => {
      const hasBoth = amTimeline.length > 0 && pmTimeline.length > 0;
      return (
        <div className="relative">
          <div className="absolute left-[3px] top-0 bottom-0 w-px bg-gray-100 z-0" />

          {/* AM */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center z-10 shrink-0">
                <Sun size={8} className="text-amber-600" />
              </div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">AM</span>
            </div>
            {amTimeline.length > 0
              ? amTimeline.map((p, i) => renderTimelineNode(p, i === amTimeline.length - 1))
              : <p className="text-[10px] text-gray-300 ml-6">No AM products</p>}
          </div>

          {/* Day */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3.5 h-3.5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center z-10 shrink-0">
              <Sun size={8} className="text-gray-400" />
            </div>
            <span className="text-[10px] text-gray-400">Day</span>
            {activeSkinTypes.has("hyperpigmentation_prone" as SkinType) || activeClimates.has("high_uv" as ClimateType)
              ? <span className="text-[9px] text-amber-700 border border-amber-200 rounded-full px-1.5">High UV risk — reapply SPF</span>
              : null}
          </div>

          {/* PM */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center z-10 shrink-0">
                <Moon size={8} className="text-indigo-600" />
              </div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">PM</span>
            </div>
            {pmTimeline.length > 0
              ? pmTimeline.map((p, i) => renderTimelineNode(p, i === pmTimeline.length - 1))
              : <p className="text-[10px] text-gray-300 ml-6">No PM products</p>}
          </div>

          {/* Overnight */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-gray-800 flex items-center justify-center z-10 shrink-0">
                <Moon size={8} className="text-gray-300" />
              </div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Overnight</span>
            </div>
            {overnightState.length > 0
              ? overnightState.map((s, i) => (
                <div key={i} className="ml-6 mb-1">
                  <span className="text-[10px] font-medium text-gray-600">{s.label} — </span>
                  <span className="text-[10px] text-gray-500">{s.detail}</span>
                </div>
              ))
              : pmTimeline.length > 0
              ? <p className="text-[10px] text-gray-400 ml-6">Standard overnight repair</p>
              : <p className="text-[10px] text-gray-300 ml-6">Add PM products to see overnight state</p>}
          </div>

          {/* AM next day — cross-session warnings */}
          {hasBoth && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center z-10 shrink-0">
                  <Sun size={8} className="text-amber-600" />
                </div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">AM — next day</span>
              </div>
              {crossSessionWarns.length > 0
                ? crossSessionWarns.map((w, i) => (
                  <div key={i} className={`ml-6 mb-1.5 rounded-lg border px-2.5 py-1.5 ${w.type === "danger" ? "border-amber-800 bg-amber-50" : "border-gray-300 bg-gray-50"}`}>
                    <p className={`text-[10px] font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-900" : "text-gray-700"}`}>{w.type === "danger" ? "⚠ " : "· "}{w.title}</p>
                    <p className={`text-[10px] leading-relaxed ${w.type === "danger" ? "text-amber-800" : "text-gray-600"}`}>{w.body}</p>
                  </div>
                ))
                : <p className="text-[10px] text-gray-400 ml-6">No cross-session conflicts detected</p>}
            </div>
          )}
        </div>
      );
    };

    const renderProduct = (p: RoutineProduct, sortedGroup: RoutineProduct[], waitTimeAfter?: string | null) => {
      const TypeIcon = (p.productType && CATEGORY_ICONS[p.productType]) ? CATEGORY_ICONS[p.productType] : null;
      const brandInName = p.brand && p.name.toLowerCase().startsWith(p.brand.toLowerCase());
      const displayName = !p.brand
        ? p.name
        : brandInName
        ? p.brand + ", " + p.name.slice(p.brand.length).trim()
        : p.brand + ", " + p.name;
      return (
        <div key={p.routineId}>
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-8 h-8 rounded bg-gray-50 overflow-hidden flex items-center justify-center mt-0.5 border border-gray-100">
              {p.image_url
                ? <img src={proxyImage(p.image_url)!} alt="" className="w-full h-full object-contain" />
                : TypeIcon ? <TypeIcon size={14} className="text-gray-300" /> : <Droplet size={14} className="text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-medium text-gray-800 truncate">{displayName}</p>
                    {(() => {
                      const dups = dupMap.get(p.routineId) ?? [];
                      const highConcernPat = /retinol|retinyl|retinaldehyde|tretinoin|glycolic|lactic|mandelic|salicylic|benzoyl/i;
                      const highConcern = dups.some(d => highConcernPat.test(d));
                      if (!highConcern || dups.length === 0) return null;
                      const label = dups.length === 1 ? dups[0] : `${dups.slice(0, 2).join(", ")}${dups.length > 2 ? ` +${dups.length - 2}` : ""}`;
                      return (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                          {label} × {dups.length > 1 ? `${dups.length} shared` : "shared"}
                        </span>
                      );
                    })()}
                  </div>
                  {p.productType && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {TypeIcon && <TypeIcon size={10} className="text-gray-300" />}
                      <span className="text-[10px] text-gray-400">{p.productType}</span>
                    </div>
                  )}
              {p.step_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.step_tags.map((tag) => {
                    const cfg = STEP_TAG_CONFIG[tag];
                    if (!cfg) return null;
                    const hintKey = `${p.routineId}-${tag}`;
                    return (
                      <span key={tag} className="inline-flex items-center gap-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.className}`}>{cfg.label}</span>
                        <button type="button" onClick={() => setRoutineStepHint(h => h === hintKey ? null : hintKey)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none">ⓘ</button>
                      </span>
                    );
                  })}
                  {p.step_tags.map(tag => {
                    const hintKey = `${p.routineId}-${tag}`;
                    if (routineStepHint !== hintKey) return null;
                    const cfg = STEP_TAG_CONFIG[tag];
                    if (!cfg) return null;
                    return (
                      <div key={`hint-${hintKey}`} className="w-full mt-1 text-[10px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 leading-relaxed border border-gray-100 space-y-1">
                        <p><span className="font-semibold text-gray-700">Why here: </span>{cfg.chemicalReason}</p>
                        <p><span className="font-semibold text-gray-700">For your routine: </span>{cfg.neighborContext}</p>
                        <p><span className="font-semibold text-gray-700">If moved: </span>{cfg.movementImpact}</p>
                        {cfg.synergy && <p><span className="font-semibold text-teal-700">Synergy: </span>{cfg.synergy}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button type="button" onClick={() => {
                const tod = p.timeOfDay === "am" ? "pm" : p.timeOfDay === "pm" ? null : "am";
                updateActiveProducts(prev => prev.map(q => q.routineId === p.routineId ? { ...q, timeOfDay: tod } : q));
              }} className="text-[10px] text-gray-400 hover:text-teal-600 border border-gray-200 rounded-full px-1.5 py-0.5 transition-colors">
                {p.timeOfDay === "am" ? "AM" : p.timeOfDay === "pm" ? "PM" : "Both"}
              </button>
              <button type="button" onClick={() => removeFromRoutine(p.routineId)} className="text-[10px] text-gray-300 hover:text-rose-400">Remove</button>
            </div>
          </div>
        </div>
      </div>
      {waitTimeAfter && (
        <div className="flex items-center gap-1.5 py-1 pl-10">
          <div className="w-px h-3 bg-gray-200" />
          <span className="text-[9px] text-gray-300">{waitTimeAfter}</span>
        </div>
      )}
    </div>
      );
    };

    const renderStepRail = (products: RoutineProduct[], tod: "am" | "pm") => {
      const relevantSteps = STEP_SEQUENCE.filter(s => s.timeOfDay === null || s.timeOfDay === tod);
      const coveredTags = new Set(products.flatMap(p => p.step_tags));
      const profiles = [...activeSkinTypes, ...activeClimates] as string[];

      const profileSteps = PROFILE_RAIL_STEPS.filter(s =>
        (s.timeOfDay === null || s.timeOfDay === tod) &&
        s.forProfiles.some(pr => profiles.includes(pr))
      );

      return (
        <div className="flex flex-wrap gap-1 mb-2">
          {relevantSteps.map(step => {
            const covered = coveredTags.has(step.tag);
            const isAvoid = (step.avoidProfiles ?? []).some(pr => profiles.includes(pr));
            const isCaution = !isAvoid && (step.cautionProfiles ?? []).some(pr => profiles.includes(pr));
            const cls = covered
              ? isAvoid ? "bg-rose-700 text-white line-through"
              : isCaution ? "bg-amber-700 text-white"
              : "bg-gray-700 text-white"
              : isAvoid ? "border border-rose-300 text-rose-400"
              : isCaution ? "border border-amber-300 text-amber-600"
              : "text-gray-300";
            return (
              <span key={step.key} className={`text-[9px] px-1.5 py-0.5 rounded-full ${cls}`} title={
                isAvoid ? "Avoid for your profile" : isCaution ? "Use with caution for your profile" : ""
              }>
                {step.label}
              </span>
            );
          })}
          {profileSteps.map(step => {
            const covered = step.isCovered(products);
            return (
              <span key={step.key} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${covered ? "bg-teal-700 text-white border-teal-700" : "border-teal-500 text-teal-600"}`}
                title="Recommended for your profile">
                {step.label}
              </span>
            );
          })}
        </div>
      );
    };

    const renderActiveLoadBar = (products: RoutineProduct[]) => {
      const loads = getActiveLoads(products, activeSkinTypes as Set<string>, activeClimates as Set<string>);
      if (loads.length === 0) return null;
      return (
        <div className="mb-2 space-y-1">
          {loads.map(load => {
            const overForAny = load.tensions.some(t => t.over);
            const atForAny = load.tensions.some(t => !t.over && load.count >= t.max);
            const dotColor = overForAny ? "bg-red-800" : atForAny ? "bg-amber-800" : "bg-green-800";
            const shortNames = load.contributors.map(p => {
              const comma = p.name.indexOf(", ");
              return comma > -1 ? p.name.slice(comma + 2) : p.name;
            });
            return (
              <div key={load.key}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className="text-[10px] text-gray-600">
                    {load.label} ×{load.count}
                    {load.count > 0 && <span className="text-gray-400"> — {shortNames.join(", ")}</span>}
                  </span>
                </div>
                {load.tensions.length > 0 && (
                  <div className="ml-3 mt-0.5 space-y-0.5">
                    {load.tensions.map((t, i) => (
                      <p key={i} className={`text-[9px] ${t.over ? "text-red-800" : "text-amber-800"}`}>
                        {t.over ? "↑ " : "→ "}{t.note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const renderGroup = (label: string, products: RoutineProduct[], tod?: "am" | "pm") => products.length === 0 ? null : (
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
        {tod && renderStepRail(products, tod)}
        {renderActiveLoadBar(products)}
        <div className="space-y-0">
          {products.map((p, i) => {
            const isLast = i === products.length - 1;
            return renderProduct(p, products, isLast ? null : getWaitTimeAfter(p));
          })}
        </div>
      </div>
    );

    // What's next strip
    const coveredTypes = new Set(routineProducts.map(p => p.productType).filter(Boolean) as string[]);
    const coveredStepTags = new Set(routineProducts.flatMap(p => p.step_tags));
    const uncoveredSlots = ROUTINE_SLOTS.map(slot => {
      const isCovered = slot.productTypes.some(t => coveredTypes.has(t)) ||
        (slot.coveringStepTags ?? []).some(t => coveredStepTags.has(t));
      if (isCovered) return null;
      const priority = getSlotPriority(slot, activeSkinTypes as Set<string>, activeClimates as Set<string>);
      const reasons = getSlotReasons(slot, activeSkinTypes as Set<string>, activeClimates as Set<string>);
      return { slot, priority, reasons };
    }).filter(Boolean) as { slot: typeof ROUTINE_SLOTS[0]; priority: SlotPriority; reasons: string[] }[];
    const sortedSlots = uncoveredSlots; // preserved in ROUTINE_SLOTS application order

    return (
      <div className="space-y-3">
        {/* Routine picker */}
        <div>
          <div className="flex flex-wrap gap-1 items-center">
            {routines.map(r => {
              const isActive = r.id === (activeRoutineId ?? routines[0]?.id);
              return (
                <button key={r.id} type="button"
                  onClick={() => { setActiveRoutineId(r.id); setRoutineRenaming(false); }}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${isActive ? "bg-gray-800 text-white border-gray-800" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                  {r.name}
                </button>
              );
            })}
            <button type="button" onClick={createRoutine}
              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors">
              + New
            </button>
          </div>
          {activeRoutine && (
            <div className="flex items-center gap-2 mt-1">
              {routineRenaming ? (
                <form onSubmit={e => { e.preventDefault(); renameRoutine(activeRoutine.id, routineRenameValue || activeRoutine.name); }} className="flex items-center gap-1">
                  <input autoFocus value={routineRenameValue} onChange={e => setRoutineRenameValue(e.target.value)}
                    onBlur={() => renameRoutine(activeRoutine.id, routineRenameValue || activeRoutine.name)}
                    className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 outline-none w-28" />
                  <button type="submit" className="text-[10px] text-gray-400 hover:text-gray-700">Save</button>
                </form>
              ) : (
                <button type="button" onClick={() => { setRoutineRenaming(true); setRoutineRenameValue(activeRoutine.name); }}
                  className="text-[10px] text-gray-300 hover:text-gray-600">Rename</button>
              )}
              {routines.length > 1 && (
                <button type="button" onClick={() => deleteRoutine(activeRoutine.id)}
                  className="text-[10px] text-gray-300 hover:text-rose-400">Delete</button>
              )}
            </div>
          )}
        </div>

        {routineProducts.length === 0 ? (
          <p className="text-xs text-gray-400">No products yet. Scan a product and tap &quot;+ Add to routine&quot; to start building.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              {totalConcerns > 0 && (
                <p className="text-[10px] text-gray-500">{totalConcerns} flagged ingredient{totalConcerns !== 1 ? "s" : ""} across routine</p>
              )}
              {(amProducts.length > 0 && pmProducts.length > 0) && (
                <div className="flex rounded-full border border-gray-200 overflow-hidden ml-auto">
                  <button type="button" onClick={() => setRoutineView("detail")}
                    className={`text-[9px] px-2 py-0.5 transition-colors ${routineView === "detail" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-600"}`}>
                    Detail
                  </button>
                  <button type="button" onClick={() => setRoutineView("timeline")}
                    className={`text-[9px] px-2 py-0.5 transition-colors ${routineView === "timeline" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-600"}`}>
                    24h
                  </button>
                </div>
              )}
            </div>
            {routineView === "timeline" && amProducts.length > 0 && pmProducts.length > 0
              ? renderTimeline()
              : (
              <div className="space-y-3">
                {amProducts.length > 0 || pmProducts.length > 0 ? (
                  <>
                    {renderGroup("AM", amProducts, "am")}
                    {renderGroup("Both", bothProducts)}
                    {renderGroup("PM", pmProducts, "pm")}
                  </>
                ) : (
                  <div className="space-y-2.5">{routineProducts.map(p => renderProduct(p, routineProducts))}</div>
                )}
              </div>
            )}
            {sortedSlots.length > 0 && (
              <div className="border-t border-gray-100 pt-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">What&apos;s next</p>
                <div className="flex flex-wrap gap-1.5">
                  {sortedSlots.map(({ slot, priority, reasons }) => {
                    const isAvoid = priority === "avoid";
                    const chipColor = isAvoid
                      ? "border-rose-100 text-rose-800 bg-rose-50"
                      : priority === "essential"
                      ? "border-gray-200 text-gray-900 bg-gray-50"
                      : priority === "beneficial"
                      ? "border-gray-200 text-gray-700 bg-white"
                      : "border-gray-100 text-gray-500 bg-white";
                    const tod = slot.timeOfDay ? ` (${slot.timeOfDay.toUpperCase()})` : "";
                    const hintOpen = whatNextHint === slot.key;
                    return (
                      <div key={slot.key} className="w-full">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isAvoid}
                            onClick={() => {
                              setBrowseProfileLinked(true);
                              selectBrowseType(slot.browseType);
                              setRoutinePanelOpen(false);
                              resetTab("browse");
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${chipColor} ${isAvoid ? "cursor-not-allowed opacity-60" : "hover:border-gray-400 hover:text-gray-800"}`}
                          >
                            {slot.label}{tod}
                          </button>
                          <button type="button" onClick={() => setWhatNextHint(h => h === slot.key ? null : slot.key)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none">ⓘ</button>
                        </div>
                        {hintOpen && (
                          <div className="mt-0.5 ml-1 text-[9px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 leading-relaxed border border-gray-100 space-y-0.5">
                            {reasons.map((r, i) => <p key={i}>{r}</p>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {sortedSlots.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-1.5 border-t border-gray-100">
                    <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-sm bg-gray-50 border border-gray-200" /> essential</span>
                    <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-sm bg-white border border-gray-200" /> beneficial</span>
                    <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-sm bg-white border border-gray-100" /> optional</span>
                    <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-sm bg-rose-50 border border-rose-100" /> avoid</span>
                  </div>
                )}
              </div>
            )}
            {routineWarns.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 pt-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Interactions</p>
                {routineWarns.map((w, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 ${w.type === "danger" ? "border-amber-800" : "border-teal-800"}`}>
                    <p className={`text-[10px] font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-900" : "text-teal-800"}`}>{w.type === "danger" ? "⚠ " : "✦ "}{w.title}</p>
                    <p className={`text-[10px] leading-relaxed ${w.type === "danger" ? "text-amber-800" : "text-teal-800"}`}>{w.body}</p>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => updateActiveProducts(() => [])} className="text-[10px] text-gray-300 hover:text-rose-400">Clear routine</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Product context strip — slides in below SiteHeader when product card scrolls off screen */}
      {showStickyProduct && tab === "search" && result?.product && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-6 py-2 flex items-center gap-3">
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
        </div>
      )}

      {/* Mode segmented control */}
      <div className="flex mb-3 rounded-full border border-gray-200 overflow-hidden">
        {([
          ["search", "Search Product"],
          ["paste", "Scan"],
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
      {tab === "search" && (() => {
        const ingText = (p: BrowseProduct) => (p.ingredient_list ?? "").toLowerCase();
        const excludeLists = ingredientLists.filter(l => searchListModes[l.id] === "exclude" && l.items.length > 0);
        const includeLists = ingredientLists.filter(l => searchListModes[l.id] === "include" && l.items.length > 0);
        const profileCats = profileMatchedCategories(activeSkinTypes, activeClimates);
        const filteredSuggestions = suggestions.filter(p => {
          if (searchNoUniversal && (p.universalConcernCount ?? 0) > 0) return false;
          if (searchProfileLinked && ((p.profileFlaggedCount ?? 0) + (p.profileSensoryCount ?? 0)) > 0) return false;
          if (searchCleanOnly && (p.flaggedCount > 0 || p.sensoryCount > 0)) return false;
          if (searchPhotosafe && p.photoCount > 0) return false;
          const txt = ingText(p);
          if (excludeLists.some(l => l.items.some(item => txt.includes(item.toLowerCase())))) return false;
          if (includeLists.length > 0 && !includeLists.every(l => l.items.some(item => txt.includes(item.toLowerCase())))) return false;
          return true;
        });
        const activeSearchFilterCount =
          (searchNoUniversal ? 1 : 0) + (searchProfileLinked ? 1 : 0) +
          (searchCleanOnly ? 1 : 0) + (searchPhotosafe ? 1 : 0) +
          ingredientLists.filter(l => searchListModes[l.id] && searchListModes[l.id] !== "off").length;
        return (
          <div className="relative mb-3" ref={searchWrapperRef}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canScan) { setSuggestionsOpen(false); handleScan(); }
                  if (e.key === "Escape") setSuggestionsOpen(false);
                }}
                onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
                placeholder="e.g. CeraVe Moisturizing Cream"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400"
              />
              <button
                type="button"
                onClick={() => setBarcodeOpen(true)}
                disabled={barcodeLoading}
                title="Scan barcode"
                className="shrink-0 flex items-center justify-center w-8 h-[46px] rounded-xl border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
              >
                {barcodeLoading
                  ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M4 12a8 8 0 018-8" className="opacity-75" /></svg>
                  : <Camera className="w-3.5 h-3.5" />
                }
              </button>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchFiltersPanelOpen(v => !v)}
                  title="Filters"
                  className={`relative flex items-center justify-center w-8 h-[46px] rounded-xl border transition-colors ${activeSearchFilterCount > 0 ? "bg-gray-900 text-white border-gray-900" : "text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600"}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/></svg>
                  {activeSearchFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 text-[9px] leading-none bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeSearchFilterCount}</span>
                  )}
                </button>
                {searchFiltersPanelOpen && (
                  <div className="absolute right-0 top-12 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64 space-y-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-1">Exclude from results</p>
                    <button type="button" onClick={() => setSearchNoUniversal(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${searchNoUniversal ? "bg-rose-50 text-rose-700" : "text-gray-600 hover:bg-gray-50"}`}>
                      <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${searchNoUniversal ? "bg-rose-600 border-rose-600 text-white" : "border-gray-300"}`}>{searchNoUniversal ? "✓" : ""}</span>
                      Universal Concerns
                    </button>
                    {profileCats.length > 0 && (
                      <button type="button" onClick={() => setSearchProfileLinked(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${searchProfileLinked ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50"}`}>
                        <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${searchProfileLinked ? "bg-amber-600 border-amber-600 text-white" : "border-gray-300"}`}>{searchProfileLinked ? "✓" : ""}</span>
                        My Sensitivities
                      </button>
                    )}
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-1 pt-2">Show only</p>
                    <button type="button" onClick={() => setSearchCleanOnly(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${searchCleanOnly ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"}`}>
                      <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${searchCleanOnly ? "bg-green-700 border-green-700 text-white" : "border-gray-300"}`}>{searchCleanOnly ? "✓" : ""}</span>
                      Neutral &amp; Beneficial
                    </button>
                    <button type="button" onClick={() => setSearchPhotosafe(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${searchPhotosafe ? "bg-yellow-50 text-yellow-700" : "text-gray-600 hover:bg-gray-50"}`}>
                      <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${searchPhotosafe ? "bg-yellow-500 border-yellow-500 text-white" : "border-gray-300"}`}>{searchPhotosafe ? "✓" : ""}</span>
                      Sun-safe only
                    </button>
                    {ingredientLists.length > 0 && (
                      <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-1">My Ingredient Lists</p>
                        {ingredientLists.map(l => {
                          const mode = searchListModes[l.id] ?? "off";
                          return (
                            <div key={l.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-700 flex-1 truncate min-w-0">{l.name}</span>
                              <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0 text-[10px]">
                                <button type="button" onClick={() => setSearchListModes(prev => ({ ...prev, [l.id]: "include" }))} className={`px-1.5 py-0.5 transition-colors ${mode === "include" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>✓ Incl</button>
                                <button type="button" onClick={() => setSearchListModes(prev => ({ ...prev, [l.id]: "exclude" }))} className={`px-1.5 py-0.5 border-x border-gray-200 transition-colors ${mode === "exclude" ? "bg-rose-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>✗ Excl</button>
                                <button type="button" onClick={() => setSearchListModes(prev => ({ ...prev, [l.id]: "off" }))} className={`px-1.5 py-0.5 transition-colors ${mode === "off" ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:bg-gray-50"}`}>Off</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {suggestionsOpen && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {activeSearchFilterCount > 0 && (
                  <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-gray-100">
                    {searchNoUniversal && <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-full border border-rose-200">No Universal Concerns</span>}
                    {searchProfileLinked && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">My Sensitivities</span>}
                    {searchCleanOnly && <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">Clean Only</span>}
                    {searchPhotosafe && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">Sun-safe</span>}
                    {ingredientLists.filter(l => searchListModes[l.id] === "exclude").map(l => (
                      <span key={l.id} className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-full border border-rose-200">✗ {l.name}</span>
                    ))}
                    {ingredientLists.filter(l => searchListModes[l.id] === "include").map(l => (
                      <span key={l.id} className="text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">✓ {l.name}</span>
                    ))}
                  </div>
                )}
                {suggestionsLoading && suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                ) : filteredSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">{suggestions.length > 0 ? "No products match your filters." : "No products found."}</div>
                ) : (
                  filteredSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery(p.name);
                        setSuggestionsOpen(false);
                        handleScan({ tab: "search", query: p.name, productId: p.id });
                      }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
                    >
                      {p.image_url && (
                        <img src={`/api/image-proxy?url=${encodeURIComponent(p.image_url)}`} alt={p.name} className="w-9 h-9 object-contain rounded-lg bg-gray-50 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div>
                          {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                          <p className="text-sm font-medium text-gray-800 leading-snug">{p.name}</p>
                        </div>
                        <ConcernChips
                          total={p.flaggedCount + p.sensoryCount + p.photoCount}
                          universalCount={p.universalConcernCount}
                          profileMatchedCount={(p.profileFlaggedCount ?? 0) + (p.profileSensoryCount ?? 0)}
                          hasProfile={activeSkinTypes.size > 0 || activeClimates.size > 0}
                        />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })()}
      {tab === "paste" && (
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Paste the full ingredients list here..."
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-2 resize-none font-mono leading-relaxed"
        />
      )}
      {tab === "paste" && (
        <div className="flex items-center justify-center gap-1 mb-3">
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
      )}
      {tab === "paste" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setBarcodeOpen(true)}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ScanBarcode className="w-5 h-5" />
            <span className="text-xs font-medium">Scan barcode</span>
          </button>
          <button
            type="button"
            onClick={() => setOcrOpen(true)}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Camera className="w-5 h-5" />
            <span className="text-xs font-medium">Photo ingredients</span>
          </button>
        </div>
      )}
      {tab === "add" && (
        <div className="flex mb-3 rounded-full border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setAddSubTab("url")}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${addSubTab === "url" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-700"}`}
          >
            From URL
          </button>
          <button
            type="button"
            onClick={() => setAddSubTab("submit")}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${addSubTab === "submit" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-700"}`}
          >
            Submit manually
          </button>
        </div>
      )}
      {tab === "add" && addSubTab === "url" && (
        <textarea
          value={importUrls}
          onChange={(e) => setImportUrls(e.target.value)}
          placeholder={"Paste a product URL to scan it (INCIDecoder or iHerb)\nPaste multiple URLs (one per line) to bulk import"}
          rows={4}
          disabled={!isSignedIn}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-1 resize-none font-mono leading-relaxed disabled:bg-gray-50 disabled:text-gray-400"
        />
      )}
      {tab === "add" && addSubTab === "url" && isSignedIn && (
        addTabUrlCount > 1
          ? (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">{addTabUrlCount} URLs{addTabUrlCount > 50 ? " — first 50 will be imported" : ""}</p>
              {addTabUrlCount >= 6 && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={backgroundImport}
                    onChange={(e) => setBackgroundImport(e.target.checked)}
                    className="rounded border-gray-300 text-gray-800 focus:ring-0"
                  />
                  <span className="text-xs text-gray-500">Background import</span>
                </label>
              )}
            </div>
          )
          : <div className="mb-3" />
      )}
      {tab === "add" && addSubTab === "submit" && (
        <div className="space-y-3">
          {submitDone && (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">✓</span>
              <div>
                <p className="font-medium">Product submitted for review</p>
                <p className="text-teal-700 mt-0.5">It will appear in search results once approved.</p>
              </div>
              <button type="button" onClick={() => setSubmitDone(false)} className="ml-auto text-teal-500 hover:text-teal-800 text-xs shrink-0">Dismiss</button>
            </div>
          )}
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
          <input
            value={submitName}
            onChange={(e) => setSubmitName(e.target.value)}
            placeholder="Product name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          />
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
              From URL (INCIDecoder)
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
              placeholder="https://incidecoder.com/products/..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          )}
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400">Optional links</p>
            <input
              type="url"
              value={submitIherbUrl}
              onChange={(e) => setSubmitIherbUrl(e.target.value)}
              placeholder="iHerb URL (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            <input
              type="url"
              value={submitSourceUrl}
              onChange={(e) => setSubmitSourceUrl(e.target.value)}
              placeholder="Product page URL — Sephora, brand site, etc. (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            <input
              type="url"
              value={submitImageUrl}
              onChange={(e) => setSubmitImageUrl(e.target.value)}
              placeholder="Product image URL (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
          <div className="flex gap-2">
            {isSignedIn ? (
              <button
                type="button"
                onClick={handleSubmitProduct}
                disabled={submitLoading || !submitName.trim() || (submitMode === "paste" ? !submitIngredients.trim() : !submitUrl.trim())}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitLoading ? "Submitting…" : "Submit for review"}
              </button>
            ) : (
              <Link
                href="/sign-in"
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium text-center"
              >
                Sign in to submit
              </Link>
            )}
            <button
              type="button"
              onClick={() => setAddSubTab("url")}
              className="text-sm text-gray-400 hover:text-gray-700 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tab === "add" && addSubTab === "submit" ? null : tab === "add" ? (
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
                setImportResults(null);
                const useBackground = addTabUrlCount >= 6 && backgroundImport;
                if (useBackground) {
                  try {
                    const res = await fetch("/api/import-jobs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ urls }),
                    });
                    const data = await res.json();
                    if (data.batchId) {
                      try { localStorage.setItem("skindex:importBatch", data.batchId); } catch {}
                      setImportBatchId(data.batchId);
                      setImportPolling(true);
                    }
                  } catch {}
                } else {
                  setImportLoading(true);
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
                }
              }}
              disabled={importLoading || importPolling || addTabUrlCount === 0}
              className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {importLoading ? "Importing…" : "Import all"}
            </button>
            {(importResults || importPolling) && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex-1">
                    {importPolling
                      ? `Importing… ${importResults ? importResults.filter((r) => r.status !== "pending" && r.status !== "processing").length : 0} / ${importResults?.length ?? "…"}`
                      : "Import results"}
                  </p>
                  {importResults && (() => { const n = importResults.filter((r) => r.status === "imported").length; return <span className={`text-xs ${n > 0 ? "text-green-700" : "text-gray-400"}`}>{n} imported</span>; })()}
                  {importResults?.some((r) => r.status === "skipped") && <span className="text-xs text-gray-400">{importResults.filter((r) => r.status === "skipped").length} skipped</span>}
                  {importResults?.some((r) => r.status === "failed") && <span className="text-xs text-rose-600">{importResults.filter((r) => r.status === "failed").length} failed</span>}
                </div>
                <div className="divide-y divide-gray-50">
                  {(importResults ?? []).map((r, i) => (
                    <div key={i} className="px-4 py-2 flex items-start gap-3">
                      <span className={`text-xs shrink-0 mt-0.5 ${r.status === "imported" ? "text-green-600" : r.status === "skipped" ? "text-gray-400" : r.status === "pending" || r.status === "processing" ? "text-gray-300" : "text-rose-500"}`}>
                        {r.status === "imported" ? "✓" : r.status === "skipped" ? "→" : r.status === "pending" || r.status === "processing" ? "·" : "✗"}
                      </span>
                      <div className="min-w-0">
                        {r.name ? (
                          <p className="text-xs text-gray-700 font-medium truncate">{r.brand ? `${r.brand} ` : ""}{r.name}</p>
                        ) : (
                          <p className="text-xs text-gray-400 truncate">{r.url}</p>
                        )}
                        <p className="text-xs text-gray-400">{
                          r.status === "pending" ? "Queued" :
                          r.status === "processing" ? "Fetching…" :
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
              onClick={openSidePanel}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-widest w-full"
            >
              Skin profile
              {(activeSkinTypes.size + activeClimates.size) > 0 && (
                <span className="text-amber-800 font-medium normal-case tracking-normal">
                  {activeSkinTypes.size + activeClimates.size} active
                </span>
              )}
              <span className="text-gray-300 ml-auto">→</span>
            </button>
          </section>

          {browseTypes.length > 0 && (
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-widest mb-3">Browse</p>
          )}
          {browseLoading && !browseSelectedType && !browseSelectedArea && (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          )}
          {!browseLoading && !browseSelectedType && !browseSelectedArea && browseTypes.length > 0 && (
            <>
            <div className="space-y-5">
              {(() => {
                const AREA_ORDER = ["Face", "Makeup", "Lip", "Hands", "Nails", "Hair", "Body", "Home"];
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
                const typeButton = (t: BrowseType) => {
                  const TypeIcon = BROWSE_TYPE_ICON[t.name] ?? null;
                  return t.count === 0 ? (
                    <span
                      key={t.name}
                      title="No products yet — be the first to add one"
                      className="text-sm text-gray-300 border border-gray-100 rounded-full px-3 py-1 cursor-default select-none flex items-center gap-1.5"
                    >
                      {TypeIcon && <TypeIcon size={12} />}
                      {t.name} <span className="text-xs">0</span>
                    </span>
                  ) : (
                    <button
                      key={t.name}
                      onClick={() => selectBrowseType(t.name)}
                      className="text-sm text-gray-700 border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5"
                    >
                      {TypeIcon && <TypeIcon size={12} />}
                      {t.name} <span className="text-gray-400 text-xs">{t.count}</span>
                    </button>
                  );
                };
                const areaSection = (label: string, types: BrowseType[]) => {
                  const AreaIcon = BROWSE_AREA_ICON[label] ?? null;
                  const hasProducts = types.some(t => t.count > 0);
                  return (
                    <div key={label}>
                      {hasProducts ? (
                        <button
                          type="button"
                          onClick={() => selectBrowseArea(label)}
                          className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 hover:text-gray-700 transition-colors group"
                        >
                          {AreaIcon && <AreaIcon size={12} />}
                          {label}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">→</span>
                        </button>
                      ) : (
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          {AreaIcon && <AreaIcon size={12} />}
                          {label}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">{types.map(typeButton)}</div>
                    </div>
                  );
                };
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
          {(browseSelectedType || browseSelectedArea) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => { setBrowseSelectedType(null); setBrowseSelectedArea(null); setBrowseAreaTypeFilter(null); setBrowseProducts([]); setBrowseSearch(""); }}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  ← All types
                </button>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  {browseSelectedType ? (
                    <>
                      {(() => { const I = BROWSE_TYPE_ICON[browseSelectedType]; return I ? <I size={13} className="text-gray-500" /> : null; })()}
                      {browseSelectedType}
                    </>
                  ) : (
                    <>
                      {(() => { const I = BROWSE_AREA_ICON[browseSelectedArea!]; return I ? <I size={13} className="text-gray-500" /> : null; })()}
                      {browseSelectedArea}
                    </>
                  )}
                </span>
              </div>
              {browseSelectedArea && !browseLoading && browseProducts.length > 0 && (() => {
                const areaTypes = [...new Set(browseProducts.map(p => p.type).filter(Boolean) as string[])].sort();
                if (areaTypes.length <= 1) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      type="button"
                      onClick={() => setBrowseAreaTypeFilter(null)}
                      className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${!browseAreaTypeFilter ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}
                    >
                      All
                    </button>
                    {areaTypes.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBrowseAreaTypeFilter(prev => prev === t ? null : t)}
                        className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${browseAreaTypeFilter === t ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {/* Browse search + filter chips */}
              {!browseLoading && browseProducts.length > 0 && (() => {
                const ingText = (p: BrowseProduct) => (p.ingredient_list ?? "").toLowerCase();
                const excludeLists = ingredientLists.filter(l => listModes[l.id] === "exclude" && l.items.length > 0);
                const includeLists = ingredientLists.filter(l => listModes[l.id] === "include" && l.items.length > 0);
                const profileCats = profileMatchedCategories(activeSkinTypes, activeClimates);
                const areaFiltered = browseAreaTypeFilter
                  ? browseProducts.filter(p => p.type === browseAreaTypeFilter)
                  : browseProducts;
                const searchCandidates = browseSearch.trim()
                  ? tokenFuzzyFilter(areaFiltered, browseSearch, ["name", "brand"])
                  : areaFiltered;
                const filtered = searchCandidates.filter(p => {
                  if (browsePhotosafe && p.photoCount > 0) return false;
                  if (browseProfileLinked && ((p.profileFlaggedCount ?? 0) + (p.profileSensoryCount ?? 0)) > 0) return false;
                  if (browseNoUniversal && (p.universalConcernCount ?? 0) > 0) return false;
                  if (browseCleanOnly && (p.flaggedCount > 0 || p.sensoryCount > 0)) return false;
                  const txt = ingText(p);
                  if (excludeLists.some(l => l.items.some(item => txt.includes(item.toLowerCase())))) return false;
                  if (includeLists.length > 0 && !includeLists.every(l => l.items.some(item => txt.includes(item.toLowerCase())))) return false;
                  return true;
                });
                const activeListCount = ingredientLists.filter(l => listModes[l.id] && listModes[l.id] !== "off").length;
                const activeFilterCount = (browseSearch.trim() ? 1 : 0) + (browsePhotosafe ? 1 : 0) + (browseProfileLinked ? 1 : 0) + (browseNoUniversal ? 1 : 0) + (browseCleanOnly ? 1 : 0) + activeListCount;
                return (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={browseSearch}
                        onChange={(e) => setBrowseSearch(e.target.value)}
                        placeholder={`Search ${browseAreaTypeFilter ?? browseSelectedType ?? browseSelectedArea ?? "products"}…`}
                        className="flex-1 min-w-0 text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-gray-400"
                      />
                      {(activeFilterCount > 0 || browseAreaTypeFilter) && filtered.length !== browseProducts.length && (
                        <span className="text-xs text-gray-400 shrink-0 tabular-nums">{filtered.length}/{browseProducts.length}</span>
                      )}
                      <div className="relative shrink-0">
                        {filtersPanelOpen && (
                          <div className="fixed inset-0 z-40" onClick={() => setFiltersPanelOpen(false)} />
                        )}
                        <button
                          type="button"
                          onClick={() => setFiltersPanelOpen(v => !v)}
                          title="Filters"
                          className={`relative flex items-center justify-center w-8 h-[30px] rounded-xl border transition-colors ${activeFilterCount > 0 ? "bg-gray-900 text-white border-gray-900" : "text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600"}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/></svg>
                          {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 text-[9px] leading-none bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeFilterCount}</span>
                          )}
                        </button>
                        {filtersPanelOpen && (
                          <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64 space-y-1">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-1">Exclude from results</p>
                            <button type="button" onClick={() => setBrowseNoUniversal(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${browseNoUniversal ? "bg-rose-50 text-rose-700" : "text-gray-600 hover:bg-gray-50"}`}>
                              <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${browseNoUniversal ? "bg-rose-600 border-rose-600 text-white" : "border-gray-300"}`}>{browseNoUniversal ? "✓" : ""}</span>
                              Universal Concerns
                            </button>
                            {profileCats.length > 0 && (
                              <button type="button" onClick={() => setBrowseProfileLinked(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${browseProfileLinked ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50"}`}>
                                <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${browseProfileLinked ? "bg-amber-600 border-amber-600 text-white" : "border-gray-300"}`}>{browseProfileLinked ? "✓" : ""}</span>
                                My Sensitivities
                              </button>
                            )}
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-1 pt-2">Show only</p>
                            <button type="button" onClick={() => setBrowseCleanOnly(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${browseCleanOnly ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"}`}>
                              <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${browseCleanOnly ? "bg-green-700 border-green-700 text-white" : "border-gray-300"}`}>{browseCleanOnly ? "✓" : ""}</span>
                              Neutral &amp; Beneficial
                            </button>
                            <button type="button" onClick={() => setBrowsePhotosafe(v => !v)} className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${browsePhotosafe ? "bg-yellow-50 text-yellow-700" : "text-gray-600 hover:bg-gray-50"}`}>
                              <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[10px] leading-none ${browsePhotosafe ? "bg-yellow-500 border-yellow-500 text-white" : "border-gray-300"}`}>{browsePhotosafe ? "✓" : ""}</span>
                              Sun-safe only
                            </button>
                            {ingredientLists.length > 0 && (
                              <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-1">My Ingredient Lists</p>
                                {ingredientLists.map(l => {
                                  const mode = listModes[l.id] ?? "off";
                                  return (
                                    <div key={l.id} className="flex items-center gap-2">
                                      <span className="text-xs text-gray-700 flex-1 truncate min-w-0">{l.name}</span>
                                      <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0 text-[10px]">
                                        <button type="button" onClick={() => setListModes(prev => ({ ...prev, [l.id]: "include" }))} className={`px-1.5 py-0.5 transition-colors ${mode === "include" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>✓ Incl</button>
                                        <button type="button" onClick={() => setListModes(prev => ({ ...prev, [l.id]: "exclude" }))} className={`px-1.5 py-0.5 border-x border-gray-200 transition-colors ${mode === "exclude" ? "bg-rose-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>✗ Excl</button>
                                        <button type="button" onClick={() => setListModes(prev => ({ ...prev, [l.id]: "off" }))} className={`px-1.5 py-0.5 transition-colors ${mode === "off" ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:bg-gray-50"}`}>Off</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {filtered.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">No products match your active filters.</p>
                    )}
                    <div className="space-y-2">
                      {filtered.map((p) => {
                        const browseInRoutine = routineProducts.some(rp => rp.name === p.name);
                        const browseQuickListOpen = quickListProductId === p.id;
                        const browseIngredients = splitIngredientList(p.ingredient_list ?? "");
                        return (
                        <div key={p.id} className="border border-gray-300 rounded-xl overflow-hidden hover:border-gray-400 transition-colors">
                          <button
                          type="button"
                          onClick={() => { resetTab("search"); setQuery(p.name); handleScan({ tab: "search", query: p.name }); }}
                          className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          {p.image_url && (
                            <img src={`/api/image-proxy?url=${encodeURIComponent(p.image_url)}`} alt={p.name} className="w-10 h-10 object-contain rounded-lg bg-gray-50 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div>
                              {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                              <p className="text-sm font-medium text-gray-800 leading-snug">{p.name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <ConcernChips
                                total={p.flaggedCount + p.sensoryCount + p.photoCount}
                                universalCount={p.universalConcernCount}
                                profileMatchedCount={(p.profileFlaggedCount ?? 0) + (p.profileSensoryCount ?? 0)}
                                hasProfile={activeSkinTypes.size > 0 || activeClimates.size > 0}
                              />
                            </div>
                          </div>
                        </button>
                          <div className="flex gap-2 px-3 pb-2 border-t border-gray-100">
                            <button type="button" onClick={() => { if (browseInRoutine) { const id = routineProducts.find(rp => rp.name === p.name)?.routineId; if (id) removeFromRoutine(id); } else addBareToRoutine(p.name, p.brand, browseIngredients); }} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${browseInRoutine ? "border-teal-200 text-teal-600" : "border-gray-200 text-gray-400 hover:border-teal-400 hover:text-teal-600"}`}>{browseInRoutine ? "In routine ✓" : "+ Routine"}</button>
                            {isSignedIn && <button type="button" onClick={() => openQuickList(p.id)} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">+ List</button>}
                          </div>
                          {browseQuickListOpen && (
                            <div className="px-3 pb-3 border-t border-gray-100">
                              {!userListsLoaded ? (
                                <p className="text-xs text-gray-400 py-2">Loading…</p>
                              ) : (
                                <div className="divide-y divide-gray-100">
                                  {userLists.map((l) => (
                                    <button key={l.id} type="button" onClick={() => quickAddToList(l.id, l.name, p.id)} disabled={quickListSaving === l.id} className="w-full flex justify-between items-center py-1.5 text-xs text-gray-700 hover:text-teal-700 disabled:opacity-40 text-left">
                                      <span>{l.name}</span>
                                      <span className="text-gray-400">{quickListSaving === l.id ? "Adding…" : l.itemCount}</span>
                                    </button>
                                  ))}
                                  {quickListNewOpen ? (
                                    <div className="pt-2 flex gap-1.5">
                                      <input autoFocus type="text" value={quickListNewName} onChange={(e) => setQuickListNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickCreateListAndAdd(quickListNewName, p.id)} placeholder="New list name…" className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 min-w-0" />
                                      <button type="button" disabled={!quickListNewName.trim() || quickListSaving === "new"} onClick={() => quickCreateListAndAdd(quickListNewName, p.id)} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0">{quickListSaving === "new" ? "…" : "Create"}</button>
                                      <button type="button" onClick={() => { setQuickListNewOpen(false); setQuickListNewName(""); }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">✕</button>
                                    </div>
                                  ) : (
                                    <button type="button" onClick={() => setQuickListNewOpen(true)} className="w-full text-left py-1.5 text-xs text-gray-400 hover:text-gray-600">+ New list</button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
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
          {addSubTab !== "submit" && (
            <>
              {" "}Or{" "}
              <button
                className="underline text-gray-700"
                onClick={() => { setTab("add"); setAddSubTab("submit"); setSubmitName(query); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              >
                add it to the database
              </button>.
            </>
          )}
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
              const dymInRoutine = routineProducts.some(rp => rp.name === v.name);
              const dymQuickListOpen = quickListProductId === v.id;
              return (
                <div
                  key={v.id}
                  className={`rounded-xl border transition-colors overflow-hidden${isActive ? " bg-gray-100 border-gray-400" : " border-gray-300 hover:border-gray-400"}`}
                >
                  <button
                    type="button"
                    onClick={() => handleDymVariantClick(v.id)}
                    className="flex gap-3 p-3 text-left w-full hover:bg-gray-50 transition-colors"
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
                      {v.brand && <p className={`text-xs${isActive ? " text-gray-600" : " text-gray-400"}`}>{v.brand}</p>}
                      <p className={`text-sm leading-snug${isActive ? " font-semibold text-gray-900" : " font-medium text-gray-800"}`}>{v.name}</p>
                      {v.type && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[typeBodyAreaMap.get(v.type), v.type].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ConcernChips
                        total={v.flaggedCount + v.sensoryCount + v.photoCount}
                        universalCount={v.universalConcernCount}
                        profileMatchedCount={v.profileMatchedCount}
                        hasProfile={activeSkinTypes.size > 0 || activeClimates.size > 0}
                      />
                      {isActive && <span className="text-xs text-gray-500">↓ viewing</span>}
                    </div>
                  </div>
                  </button>
                  <div className="flex gap-2 px-3 pb-2 border-t border-gray-100">
                    <button type="button" onClick={() => { if (dymInRoutine) { const id = routineProducts.find(rp => rp.name === v.name)?.routineId; if (id) removeFromRoutine(id); } else addBareToRoutine(v.name, v.brand ?? null, []); }} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dymInRoutine ? "border-teal-200 text-teal-600" : "border-gray-200 text-gray-400 hover:border-teal-400 hover:text-teal-600"}`}>{dymInRoutine ? "In routine ✓" : "+ Routine"}</button>
                    {isSignedIn && <button type="button" onClick={() => openQuickList(v.id)} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">+ List</button>}
                  </div>
                  {dymQuickListOpen && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      {!userListsLoaded ? (
                        <p className="text-xs text-gray-400 py-2">Loading…</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {userLists.map((l) => (
                            <button key={l.id} type="button" onClick={() => quickAddToList(l.id, l.name, v.id)} disabled={quickListSaving === l.id} className="w-full flex justify-between items-center py-1.5 text-xs text-gray-700 hover:text-teal-700 disabled:opacity-40 text-left">
                              <span>{l.name}</span>
                              <span className="text-gray-400">{quickListSaving === l.id ? "Adding…" : l.itemCount}</span>
                            </button>
                          ))}
                          {quickListNewOpen ? (
                            <div className="pt-2 flex gap-1.5">
                              <input autoFocus type="text" value={quickListNewName} onChange={(e) => setQuickListNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickCreateListAndAdd(quickListNewName, v.id)} placeholder="New list name…" className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 min-w-0" />
                              <button type="button" disabled={!quickListNewName.trim() || quickListSaving === "new"} onClick={() => quickCreateListAndAdd(quickListNewName, v.id)} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0">{quickListSaving === "new" ? "…" : "Create"}</button>
                              <button type="button" onClick={() => { setQuickListNewOpen(false); setQuickListNewName(""); }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">✕</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setQuickListNewOpen(true)} className="w-full text-left py-1.5 text-xs text-gray-400 hover:text-gray-600">+ New list</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                {result.product.brand && (
                  <button
                    type="button"
                    onClick={() => { setTab("search"); setQuery(result.product!.brand!); handleScan({ tab: "search", query: result.product!.brand! }); }}
                    className="text-xs text-gray-400 hover:underline underline-offset-2 text-left"
                  >
                    {result.product.brand}
                  </button>
                )}
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
                {(result.product.iherb_url || result.product.name) && (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                      {result.product.iherb_url ? (
                        <a
                          href={withRcode(result.product.iherb_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs hover:underline underline-offset-2"
                        >
                          iHerb ↗
                        </a>
                      ) : !suggestLinkOpen ? (
                        <>
                          <a
                            href={`https://www.iherb.com/search?kw=${encodeURIComponent([result.product.brand, result.product.name].filter(Boolean).join(" "))}&rcode=DYT4743`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline underline-offset-2 text-gray-400"
                          >
                            iHerb search ↗
                          </a>
                          {isAdmin && result.product.id && (
                            <button
                              type="button"
                              onClick={() => setSuggestLinkOpen(true)}
                              className="text-xs text-gray-300 hover:text-gray-500 underline underline-offset-2"
                            >
                              + link
                            </button>
                          )}
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

                {/* Step tags + Add to routine + Save to a list */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {(result.step_tags ?? []).map((tag) => {
                    const cfg = STEP_TAG_CONFIG[tag];
                    if (!cfg) return null;
                    return (
                      <span key={tag} className="inline-flex items-center gap-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.className}`}>{cfg.label}</span>
                        <button type="button" onClick={() => setStepTagHint(h => h === tag ? null : tag)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none">ⓘ</button>
                      </span>
                    );
                  })}
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
                          className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors"
                        >
                          In routine · Remove
                        </button>
                      );
                    }
                    if (addedToRoutine) {
                      return <span className="text-xs px-3 py-1 rounded-full border border-teal-600 text-teal-600">Added to routine ✓</span>;
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => addToRoutine(suggestTimeOfDay(result.step_tags ?? []))}
                        className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-teal-600 hover:text-teal-600 transition-colors"
                      >
                        + Add to routine
                      </button>
                    );
                  })()}
                  {result.product.id && (
                    savedTo ? (
                      <p className="text-xs text-teal-700">✓ Saved to {savedTo}</p>
                    ) : productInList && !saveListOpen ? (
                      <button
                        type="button"
                        onClick={openSaveList}
                        className="text-xs px-3 py-1 rounded-full border border-[#A984B2] text-[#A984B2] hover:border-[#8c6395] hover:text-[#8c6395] transition-colors"
                      >
                        ✓ In a list · Manage
                      </button>
                    ) : !saveListOpen ? (
                      <button
                        type="button"
                        onClick={openSaveList}
                        className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-[#A984B2] hover:text-[#A984B2] transition-colors"
                      >
                        + Save to a list
                      </button>
                    ) : !isSignedIn ? (
                      <p className="text-xs text-gray-500">
                        <SignInButton mode="modal">
                          <button type="button" className="underline underline-offset-2 hover:text-gray-800">Sign in</button>
                        </SignInButton>
                        {" "}to save products to lists.
                      </p>
                    ) : null
                  )}
                </div>
                {stepTagHint && STEP_TAG_CONFIG[stepTagHint] && (
                  <div className="mt-1 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                    <span className="font-medium text-gray-700">{STEP_TAG_CONFIG[stepTagHint].label} — </span>
                    {STEP_TAG_CONFIG[stepTagHint].desc}
                  </div>
                )}

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

                {result.product.id && saveListOpen && isSignedIn && (
                  <div className="mt-2">
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
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "search" && query && addSubTab !== "submit" && (
            <p className="text-xs text-gray-400 text-center">
              Not {query.replace(/\b\w/g, c => c.toUpperCase())}?{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-gray-700"
                onClick={() => { setTab("add"); setAddSubTab("submit"); setSubmitName(query); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              >
                Add it to the database
              </button>
            </p>
          )}

          </div>

          {/* Summary line + safe alternatives group */}
          <div className="space-y-2">
          {(result.flagged.length + result.safe.length + result.unreviewed.length) > 0 && (() => {
            const totalItems = result.flagged.length + result.safe.length + result.unreviewed.length;
            const scrollToConcern = () => document.getElementById("section-by-concern")?.scrollIntoView({ behavior: "smooth", block: "start" });
            const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

            if (hasProfile) {
              let universalCount = 0;
              let profileMatchedCount = 0;
              let nonMatchingCount = 0;
              for (const item of result.originalItems) {
                const m = getItemMatch(item, result.safe, result.flagged);
                const si = (result.sensoryTrigger ?? []).find(s => normalizeForMatch(s.rawName) === normalizeForMatch(item)) ?? null;
                const pi = (result.photosensitive ?? []).find(p => normalizeForMatch(p.rawName) === normalizeForMatch(item)) ?? null;
                const lv = getIngredientConcernLevel(m, si, pi, activeSkinTypes, activeClimates, isRinseOff);
                if (lv === "universal") universalCount++;
                else if (lv === "profile-matched") profileMatchedCount++;
                else if (lv === "non-matching") nonMatchingCount++;
              }
              return (
                <p className="text-xs -mt-2">
                  <span className="text-gray-700">{totalItems} ingredient{totalItems !== 1 ? "s" : ""} scanned</span>
                  {universalCount > 0 && <>{" · "}<button type="button" className="text-rose-700 font-medium hover:underline underline-offset-2" onClick={scrollToConcern}>{universalCount} universal concern{universalCount !== 1 ? "s" : ""}</button></>}
                  {profileMatchedCount > 0 && <>{" · "}<button type="button" className="text-amber-700 font-medium hover:underline underline-offset-2" onClick={scrollToConcern}>{profileMatchedCount} profile concern{profileMatchedCount !== 1 ? "s" : ""}</button></>}
                  {nonMatchingCount > 0 && <>{" · "}<button type="button" className="text-yellow-700 font-medium hover:underline underline-offset-2" onClick={scrollToConcern}>{nonMatchingCount} other concern{nonMatchingCount !== 1 ? "s" : ""}</button></>}
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
          {result.flagged.length > 0 && ingredientLists.length > 0 && (
            <div>
              {!bulkAddOpen ? (
                <button type="button" className="text-xs text-gray-400 hover:text-rose-700 hover:underline underline-offset-2"
                  onClick={() => setBulkAddOpen(true)}>
                  Save {result.flagged.length} flagged to a list →
                </button>
              ) : (
                <div className="text-xs border border-rose-100 rounded-xl p-2.5 bg-rose-50/50 space-y-2">
                  <p className="text-rose-700 font-medium">Save {result.flagged.length} flagged ingredients to:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ingredientLists.map(lst => (
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
                          const target = ingredientLists.find(l => l.id === bulkAddListId);
                          const newItems = [...new Set([...(target?.items ?? []), ...names])];
                          setIngredientLists(ls => ls.map(l => l.id === bulkAddListId ? { ...l, items: newItems } : l));
                          if (bulkAddListId) syncIngredientListItems(bulkAddListId, newItems);
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
                      const altInRoutine = routineProducts.some(rp => rp.name === alt.name);
                      const altQuickListOpen = quickListProductId === alt.id;
                      return (
                        <div key={alt.id} className="border border-gray-300 rounded-xl overflow-hidden hover:border-gray-400 transition-colors">
                          <button
                            type="button"
                            onClick={() => scanVariant({ productId: alt.id })}
                            className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
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
                                  {alt.brand && <p className="text-xs text-gray-400">{alt.brand}</p>}
                                  <p className="text-sm font-medium text-gray-800 leading-snug">{alt.name}</p>
                                  {alt.type && (
                                    <p className="text-xs text-gray-400">
                                      {[typeBodyAreaMap.get(alt.type), alt.type].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <ConcernChips
                                    total={alt.flaggedCount + alt.sensoryCount + alt.photoCount}
                                    universalCount={alt.universalConcernCount}
                                    profileMatchedCount={alt.profileMatchedCount}
                                    hasProfile={activeSkinTypes.size > 0 || activeClimates.size > 0}
                                  />
                                </div>
                              </div>
                            </div>
                          </button>
                          <div className="flex gap-2 px-3 pb-2 border-t border-gray-100">
                            <button type="button" onClick={() => { if (altInRoutine) { const id = routineProducts.find(rp => rp.name === alt.name)?.routineId; if (id) removeFromRoutine(id); } else addBareToRoutine(alt.name, alt.brand, []); }} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${altInRoutine ? "border-teal-200 text-teal-600" : "border-gray-200 text-gray-400 hover:border-teal-400 hover:text-teal-600"}`}>{altInRoutine ? "In routine ✓" : "+ Routine"}</button>
                            {isSignedIn && <button type="button" onClick={() => openQuickList(alt.id)} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">+ List</button>}
                          </div>
                          {altQuickListOpen && (
                            <div className="px-3 pb-3 border-t border-gray-100">
                              {!userListsLoaded ? (
                                <p className="text-xs text-gray-400 py-2">Loading…</p>
                              ) : (
                                <div className="divide-y divide-gray-100">
                                  {userLists.map((l) => (
                                    <button key={l.id} type="button" onClick={() => quickAddToList(l.id, l.name, alt.id)} disabled={quickListSaving === l.id} className="w-full flex justify-between items-center py-1.5 text-xs text-gray-700 hover:text-teal-700 disabled:opacity-40 text-left">
                                      <span>{l.name}</span>
                                      <span className="text-gray-400">{quickListSaving === l.id ? "Adding…" : l.itemCount}</span>
                                    </button>
                                  ))}
                                  {quickListNewOpen ? (
                                    <div className="pt-2 flex gap-1.5">
                                      <input autoFocus type="text" value={quickListNewName} onChange={(e) => setQuickListNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickCreateListAndAdd(quickListNewName, alt.id)} placeholder="New list name…" className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 min-w-0" />
                                      <button type="button" disabled={!quickListNewName.trim() || quickListSaving === "new"} onClick={() => quickCreateListAndAdd(quickListNewName, alt.id)} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0">{quickListSaving === "new" ? "…" : "Create"}</button>
                                      <button type="button" onClick={() => { setQuickListNewOpen(false); setQuickListNewName(""); }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">✕</button>
                                    </div>
                                  ) : (
                                    <button type="button" onClick={() => setQuickListNewOpen(true)} className="w-full text-left py-1.5 text-xs text-gray-400 hover:text-gray-600">+ New list</button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>}
                </div>
              )}
            </section>
          )}
          </div>{/* end summary + alternatives group */}

          {/* Skin profile */}
          <section>
            <button
              type="button"
              onClick={openSidePanel}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-widest"
            >
              Skin profile
              {(activeSkinTypes.size + activeClimates.size) > 0 && (
                <span className="text-amber-800 font-medium normal-case tracking-normal">
                  {activeSkinTypes.size + activeClimates.size} active
                </span>
              )}
              <span className="text-gray-300">→</span>
            </button>
          </section>

          {/* Formula interactions */}
          {(result.formula_warnings ?? []).length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setFormulaInteractionsOpen(o => !o)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-widest"
              >
                Formula interactions
                <span className="text-amber-800 font-medium normal-case tracking-normal">{result.formula_warnings!.length}</span>
                <span className="text-gray-300">{formulaInteractionsOpen ? "▲" : "▼"}</span>
              </button>
              {formulaInteractionsOpen && (
                <div className="space-y-2 mt-2">
                  {result.formula_warnings!.map((w, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border px-4 py-3 ${w.type === "danger" ? "border-amber-800" : "border-teal-800"}`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${w.type === "danger" ? "text-amber-900" : "text-teal-800"}`}>
                        {w.type === "danger" ? "⚠ " : "✦ "}{w.title}
                      </p>
                      <p className="text-xs leading-relaxed text-gray-600">{w.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Profile interactions */}
          {(activeSkinTypes.size + activeClimates.size) > 0 && (() => {
            const suppWarns = detectSupplementWarnings(activeSkinTypes, activeClimates);
            const dietWarns = detectDietaryWarnings(activeSkinTypes, activeClimates);
            const allWarns = [...suppWarns, ...dietWarns];
            const scanIngredients = result ? [
              ...result.safe.map(m => m.ingredient),
              ...result.flagged.map(m => m.ingredient),
            ] : [];
            const postWash = result ? getPostWashNote(activeSkinTypes, activeClimates, scanIngredients) : null;
            const devWarns = result ? detectDeviceWarnings(result, activeClimates) : [];
            const totalNotes = allWarns.length + (postWash ? 1 : 0) + devWarns.length;
            if (totalNotes === 0) return null;
            return (
              <section>
                <button
                  type="button"
                  onClick={() => setProfileInteractionsOpen(o => !o)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-widest"
                >
                  Profile interactions
                  <span className="text-amber-800 font-medium normal-case tracking-normal">{totalNotes}</span>
                  <span className="text-gray-300">{profileInteractionsOpen ? "▲" : "▼"}</span>
                </button>
                {profileInteractionsOpen && (
                  <div className="space-y-1.5 mt-2">
                    {allWarns.map((w, i) => (
                      <div key={i} className={`rounded-xl border px-3 py-2 ${w.type === "danger" || w.type === "caution" ? "border-amber-800" : "border-teal-800"}`}>
                        <p className={`text-xs font-semibold mb-0.5 ${w.type === "danger" || w.type === "caution" ? "text-amber-800" : "text-teal-800"}`}>
                          {w.type === "danger" ? "⚠ " : w.type === "caution" ? "◆ " : "✦ "}{w.title}
                        </p>
                        <p className="text-xs leading-relaxed text-gray-600">{w.body}</p>
                      </div>
                    ))}
                    {devWarns.map((w, i) => (
                      <div key={`dev-${i}`} className={`rounded-xl border px-3 py-2 ${w.type === "danger" ? "border-amber-800" : "border-teal-800"}`}>
                        <p className={`text-xs font-semibold mb-0.5 ${w.type === "danger" ? "text-amber-800" : "text-teal-800"}`}>
                          {w.type === "danger" ? "⚡ " : "✦ "}{w.title}
                        </p>
                        <p className="text-xs leading-relaxed text-gray-600">{w.body}</p>
                      </div>
                    ))}
                    {postWash && (
                      <div className="rounded-xl border border-amber-800 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800 mb-0.5">⚠ {postWash.title}</p>
                        <p className="text-xs leading-relaxed text-gray-600">{postWash.body}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })()}

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
                  ) ?? null;
                  const sensoryItem = (result.sensoryTrigger ?? []).find(
                    (s) => normalizeForMatch(s.rawName) === normalizeForMatch(item)
                  ) ?? null;
                  const itemNorm = normalizeForMatch(item);
                  const onAvoidList = ingredientLists.some(l => listModes[l.id] === "exclude" && l.items.some(av => itemNorm.includes(av)));
                  const concernLevel = getIngredientConcernLevel(match, sensoryItem, photoItem, activeSkinTypes, activeClimates, isRinseOff);
                  const colorClass =
                    concernLevel === "skip"            ? "text-gray-400"
                    : concernLevel === "neutral"       ? "text-gray-700 font-medium"
                    : concernLevel === "universal"     ? "text-rose-700 font-medium"
                    : concernLevel === "profile-matched" ? "text-amber-700 font-medium"
                    : concernLevel === "non-matching"  ? "text-yellow-700 font-medium"
                    : "text-gray-400";
                  return (
                    <Fragment key={i}>
                      <button
                        type="button"
                        className={`${colorClass} hover:underline underline-offset-2${onAvoidList ? " bg-rose-100 rounded px-0.5" : ""}`}
                        title={onAvoidList ? "On your avoid list" : undefined}
                        onClick={() => {
                          if (match || photoItem || sensoryItem) {
                            if (concernLevel === "neutral") setNeutralGroupOpen(true);
                            handleIngredientClick(item, match, !!photoItem, !!sensoryItem);
                            setTimeout(() => {
                              document.getElementById(`concern-${item}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }, 50);
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




          {/* By concern — grouped ingredient view */}
          {result.originalItems.length > 0 && (() => {
            const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

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
              const sensoryItem = (result.sensoryTrigger ?? []).find(
                (s) => normalizeForMatch(s.rawName) === normalizeForMatch(item)
              ) ?? null;
              const photoItem = (result.photosensitive ?? []).find(
                (p) => normalizeForMatch(p.rawName) === normalizeForMatch(item)
              ) ?? null;
              const level = getIngredientConcernLevel(match, sensoryItem, photoItem, activeSkinTypes, activeClimates, isRinseOff);
              // Suppress display-side fields for rinse-off so rows don't show suppressed labels
              const displayMatch = isRinseOff && match?.ingredient.status === "flagged" && RINSE_OFF_SUPPRESS_DB_CATS.has(match.ingredient.flagged_category ?? "") ? null : match;
              const displaySensory = isRinseOff && sensoryItem && RINSE_OFF_SUPPRESS_SENSORY_CATS.has(sensoryItem.sensory_category ?? "") ? null : sensoryItem;
              const displayPhoto = isRinseOff && photoItem && RINSE_OFF_SUPPRESS_PHOTO_CATS.has(photoItem.photoCategory ?? "") ? null : photoItem;
              if (level !== "skip") groups[level].push({ item, match: displayMatch, fullMatch, sensoryItem: displaySensory, photoItem: displayPhoto });
            }

            const CONCERN_STRIPE: Record<ConcernLevel, string> = {
              universal:         "border-rose-500",
              "profile-matched": "border-amber-500",
              "non-matching":    "border-yellow-500",
              neutral:           "border-teal-500",
            };
            const CONCERN_PILL: Record<ConcernLevel, string> = {
              universal:         "text-rose-700",
              "profile-matched": "text-amber-700",
              "non-matching":    "text-gray-400",
              neutral:           "text-teal-700",
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
              "non-matching":    "border-gray-100 divide-gray-100",
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
              const waterProtectiveActive = activeClimates.has("hard_water") || activeClimates.has("iron_water") || activeClimates.has("heavy_metal_water");
              const benefitLabel = safeCategory && (safeCategory !== "water-protective" || waterProtectiveActive)
                ? (CATEGORY_LABELS[safeCategory] ?? safeCategory)
                : null;
              const secondaryBenefitLabels = (match?.ingredient.secondary_benefit_categories ?? [])
                .map(c => CATEGORY_LABELS[c] ?? c)
                .filter((l, i, arr) => l !== benefitLabel && arr.indexOf(l) === i);
              const benefitProfileCats = activeSkinTypes.size > 0 || activeClimates.size > 0
                ? profileBenefitCategorySet(activeSkinTypes, activeClimates)
                : null;
              const isProfileBenefitCat = benefitLabel != null && (benefitProfileCats?.has(benefitLabel) ?? false);

              const rawClimateNotes = match?.ingredient.skin_climate_notes;
              const rawNotes: SkinClimateNote[] = Array.isArray(rawClimateNotes) ? rawClimateNotes : [];
              const allBenefitNotes = rawNotes.filter((n) => n.sentiment === "benefit");
              const isNonMatching = level === "non-matching";
              // Non-matching ingredients show all notes (unfiltered) so users see which profiles they apply to.
              // Profile-matched ingredients split notes: profile notes (AND match) in amber, others in gray.
              const cautiousNotes = rawNotes.filter((n) => n.sentiment === "caution" || n.sentiment === "strong_caution");
              const isFlagged = match?.status === "flagged";
              const profileBenefitNotes = isNonMatching ? [] : filterNotes(rawNotes).filter((n) => n.sentiment === "benefit");
              const profileCautionNotes = isNonMatching ? [] : filterNotes(rawNotes).filter((n) => n.sentiment === "caution" || n.sentiment === "strong_caution");
              const fcLower = fc?.toLowerCase() ?? "";
              const fcProfileCautionNote = fcLower
                ? (profileCautionNotes.find(n => n.concern != null && n.concern === fcLower && n.sentiment === "strong_caution")
                  ?? profileCautionNotes.find(n => n.concern != null && n.concern === fcLower && n.sentiment === "caution"))
                : null;
              const fcProfileLabel = (() => {
                if (fcProfileCautionNote?.dimensions.length) {
                  const matched = fcProfileCautionNote.dimensions.filter(d => activeSkinTypes.has(d as SkinType)).map(d => SKIN_TYPES.find(s => s.value === d)?.label ?? d);
                  if (matched.length) return ` · ${matched.join(", ")}`;
                }
                if (fcProfileCautionNote?.climate.length) {
                  const matched = fcProfileCautionNote.climate.filter(c => activeClimates.has(c as ClimateType)).map(c => ALL_MODIFIER_TYPES.find(t => t.value === c)?.label ?? c);
                  if (matched.length) return ` · ${matched.join(", ")}`;
                }
                if (!fcProfileCautionNote && fc) {
                  const types = CONCERN_PROFILE_TYPES[fc.toLowerCase()] ?? [];
                  const matched = types.filter(t => activeSkinTypes.has(t as SkinType)).map(t => SKIN_TYPES.find(s => s.value === t)?.label ?? t);
                  if (matched.length) return ` · ${matched.join(", ")}`;
                }
                return "";
              })();
              const filteredProfileCautionNotes = fcProfileCautionNote
                ? profileCautionNotes.filter(n => n !== fcProfileCautionNote)
                : profileCautionNotes;
              const otherCautionNotes = isNonMatching ? cautiousNotes : cautiousNotes.filter((n) => !isProfileNote(n));
              // Flagged ingredients already show all benefits in the teal stripe — don't duplicate in gray.
              const otherBenefitNotes = isFlagged ? [] : allBenefitNotes.filter((n) => !isProfileNote(n));

              const itemKey = item.toLowerCase();
              const inList = addToListMenu === itemKey;
              return (
                <div key={rowKey} id={rowKey} className="overflow-hidden">
                  <div className="flex items-center">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-between px-3 py-1.5 text-left"
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
                        <>
                          <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${CONCERN_PILL[level]}`}>{concernLabel}</span>
                          {(match?.ingredient.secondary_flagged_categories ?? []).map((sc) => {
                            const scLabel = CATEGORY_LABELS[sc] ?? null;
                            if (!scLabel || scLabel === concernLabel) return null;
                            const scLevel = UNIVERSAL_FLAG_CATS.has(sc) ? "universal"
                              : isFcProfileMatch(sc, activeSkinTypes, activeClimates) ? "profile-matched"
                              : "non-matching";
                            return (
                              <span key={sc} className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${CONCERN_PILL[scLevel]}`}>{scLabel}</span>
                            );
                          })}
                          {sensoryLabel && sensoryLabel !== concernLabel && (
                            <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${CONCERN_PILL["profile-matched"]}`}>{sensoryLabel}</span>
                          )}
                        </>
                      ) : (benefitLabel || secondaryBenefitLabels.length > 0) ? (
                        <>
                          {benefitLabel && (
                            <span className="text-xs rounded-full px-2 py-0.5 shrink-0 text-teal-700">
                              {benefitLabel}
                            </span>
                          )}
                          {secondaryBenefitLabels.map(sl => (
                            <span key={sl} className="text-xs rounded-full px-2 py-0.5 shrink-0 text-teal-700">
                              {sl}
                            </span>
                          ))}
                        </>
                      ) : null}
                      {[fc, ...(match?.ingredient.secondary_flagged_categories ?? [])].filter((c): c is string => !!c && ENVIRONMENTAL_CATEGORIES.has(c)).map(c => (
                        <span key={`env-${c}`} className="text-xs rounded-full px-2 py-0.5 shrink-0 text-emerald-700">{CATEGORY_LABELS[c] ?? c}</span>
                      ))}
                    </span>
                    <span className="shrink-0 ml-2 text-gray-300 text-xs">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  <div className="shrink-0">
                    <button
                      type="button"
                      title="Add to ingredient list"
                      className={`px-2 py-1.5 text-sm leading-none transition-colors ${inList ? "text-gray-700" : "text-gray-300 hover:text-gray-500"}`}
                      onClick={() => { setIngredientNewListOpen(false); setIngredientNewListName(""); setAddToListMenu(inList ? null : itemKey); }}
                    >
                      +
                    </button>
                  </div>
                  </div>
                  {inList && !isSignedIn && (
                    <div className="border-t border-gray-100 px-3 py-2">
                      <p className="text-xs text-gray-500">
                        <SignInButton mode="modal">
                          <button type="button" className="underline underline-offset-2 hover:text-gray-800">Sign in</button>
                        </SignInButton>
                        {" "}to use ingredient lists.
                      </p>
                    </div>
                  )}
                  {inList && isSignedIn && (
                    <div className="border-t border-gray-100 px-2 py-1.5 space-y-0.5">
                      {ingredientLists.map((lst) => {
                        const already = lst.items.includes(itemKey);
                        return (
                          <button
                            key={lst.id}
                            type="button"
                            className="w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 rounded-lg flex items-center gap-1.5"
                            onClick={() => {
                              if (!already) {
                                const newItems = [...lst.items, itemKey];
                                setIngredientLists(ls => ls.map(l => l.id === lst.id ? { ...l, items: newItems } : l));
                                syncIngredientListItems(lst.id, newItems);
                              }
                              setAddToListMenu(null);
                            }}
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                            <span className="flex-1 truncate">{lst.name}</span>
                            {already && <span className="text-teal-600 shrink-0">✓</span>}
                          </button>
                        );
                      })}
                      {ingredientNewListOpen ? (
                        <div className="pt-1 mt-1 border-t border-gray-100 flex gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={ingredientNewListName}
                            onChange={(e) => setIngredientNewListName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && quickCreateIngredientList(ingredientNewListName, itemKey)}
                            placeholder="New list…"
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 min-w-0"
                          />
                          <button type="button" disabled={!ingredientNewListName.trim()} onClick={() => quickCreateIngredientList(ingredientNewListName, itemKey)} className="text-xs px-1.5 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0">+</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setIngredientNewListOpen(true)} className="w-full text-left text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600 border-t border-gray-100 mt-1">
                          + New list
                        </button>
                      )}
                    </div>
                  )}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {/* Formula role stripe — gray */}
                      {(() => {
                        const roleText = structured?.formula_role ?? (structCat ? STRUCTURAL_DESCRIPTIONS[structCat] : null);
                        if (!roleText && !fullMatch?.comedogenicRating) return null;
                        return (
                          <div className="pl-3 border-l-2 border-gray-300">
                            {roleText && (
                              <p className="text-xs text-gray-500 leading-relaxed">
                                <span className="font-semibold text-gray-700">{structCat ?? "Function"} — </span>
                                {roleText}
                              </p>
                            )}
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
                            {(() => {
                              // Compute the benefit header label once so notes can detect redundancy.
                              const benefitProfilesSuffix = structured?.benefit_profiles?.length
                                ? ` · ${structured.benefit_profiles.flatMap(p => p.split(/\s*·\s*/)).join(", ")}`
                                : "";
                              const benefitHeaderLabel = (benefitLabel || secondaryBenefitLabels.length > 0)
                                ? `${[benefitLabel, ...secondaryBenefitLabels].filter(Boolean).join(", ")}${benefitProfilesSuffix}`
                                : (() => {
                                    const profs = (structured?.benefit_profiles ?? []).flatMap(p => p.split(/\s*·\s*/)).join(", ") || null;
                                    return [structured?.benefit_category, profs].filter(Boolean).join(" · ");
                                  })();
                              return (
                                <>
                                  {benefitSentence && (
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      {benefitHeaderLabel
                                        ? <span className="font-semibold text-teal-700">{benefitHeaderLabel} — </span>
                                        : null}
                                      {benefitSentence}
                                    </p>
                                  )}
                                  {benefitNote && (
                                    <p className="text-xs text-gray-600 leading-relaxed">{benefitNote}</p>
                                  )}
                                  {benefitNotes.map((note, i) => {
                                    const nl = noteLabel(note);
                                    const fullLabel = [benefitLabel ?? (structured?.benefit_category ?? null), nl].filter(Boolean).join(" · ");
                                    const isRedundant = !!benefitHeaderLabel && fullLabel === benefitHeaderLabel;
                                    return (
                                      <p key={i} className="text-xs text-gray-600 leading-relaxed">
                                        {fullLabel && !isRedundant && <span className="font-semibold text-teal-700">{fullLabel} — </span>}
                                        {note.text}
                                      </p>
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      {/* Concern stripe — level-colored (non-neutral only) */}
                      {level !== "neutral" && (() => {
                        const concernItems = structured?.concern_items ?? null;
                        const dbConcernText = isLoading ? null
                          : (concernItems ? null : (structured?.concern ?? (explanation && !structured ? explanation : null)));
                        const sensoryText = sensoryItem?.sensory_note ?? null;
                        const photoText = photoItem?.photo_note ?? null;
                        const isUniversalCat = (cat: string) => UNIVERSAL_FLAG_CATS.has(cat);
                        // Find which concern the sensory note should be merged into
                        const sensoryRelated = sensoryItem ? (SENSORY_REDUNDANT_WITH[sensoryItem.sensory_category ?? ""] ?? []) : [];
                        let sensoryMergedWith: string | null = null;
                        if (sensoryText && sensoryLabel && sensoryRelated.length) {
                          if (concernItems) {
                            const matched = concernItems.find(ci => sensoryRelated.includes(ci.category));
                            if (matched) sensoryMergedWith = matched.category;
                          } else if (fc && sensoryRelated.includes(fc)) {
                            sensoryMergedWith = fc;
                          }
                        }
                        const sensoryProfileLabel = (() => {
                          if (!sensoryItem) return "";
                          const sc = sensoryItem.sensory_category ?? "";
                          const profileTypes = SENSORY_PROFILE_MAP[sc] ?? [];
                          const matched = profileTypes
                            .filter(st => activeSkinTypes.has(st as SkinType))
                            .map(st => SKIN_TYPES.find(s => s.value === st)?.label ?? st);
                          if (matched.length === 0) return "";
                          return ` · ${matched.join(", ")}`;
                        })();
                        // True when sensory and concern labels describe the same concept (e.g. "Pore-clogging" ≈ "Pore-clogger").
                        const norm = (s: string) => s.toLowerCase().replace(/[-\s]+/g, "").replace(/ing$|er$/, "");
                        const sensoryLabelRedundant = !!(sensoryLabel && catLabel &&
                          (norm(sensoryLabel).startsWith(norm(catLabel)) || norm(catLabel).startsWith(norm(sensoryLabel))));
                        const photoProfileLabel = (() => {
                          if (!photoItem) return "";
                          const types = CONCERN_PROFILE_TYPES["photosensitizer"] ?? [];
                          const matched = types.filter(t => activeSkinTypes.has(t as SkinType)).map(t => SKIN_TYPES.find(s => s.value === t)?.label ?? t);
                          return matched.length ? ` · ${matched.join(", ")}` : "";
                        })();
                        return (
                          <>
                            <div className={`pl-3 border-l-2 ${CONCERN_STRIPE[level]} space-y-1`}>
                              {isLoading && (
                                <p className="text-xs text-gray-400 italic">Generating explanation…</p>
                              )}
                              {concernItems ? concernItems.map((ci) => {
                                const isUniversal = isUniversalCat(ci.category);
                                const ciLabel = CATEGORY_LABELS[ci.category] ?? ci.category;
                                const merged = sensoryMergedWith === ci.category;
                                const ciProfileTypes = CONCERN_PROFILE_TYPES[ci.category.toLowerCase()] ?? [];
                                const ciProfileLabel = !merged && ciProfileTypes.length
                                  ? (() => {
                                      const matched = ciProfileTypes.filter(t => activeSkinTypes.has(t as SkinType)).map(t => SKIN_TYPES.find(s => s.value === t)?.label ?? t);
                                      return matched.length ? ` · ${matched.join(", ")}` : "";
                                    })()
                                  : "";
                                return (
                                  <p key={ci.category} className="text-xs text-gray-600 leading-relaxed">
                                    <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>
                                      {merged && sensoryLabel
                                        ? (sensoryLabelRedundant ? `${ciLabel}${sensoryProfileLabel}` : `${ciLabel}, ${sensoryLabel}${sensoryProfileLabel}`)
                                        : `${ciLabel}${ciProfileLabel}`} —</span>
                                    {ci.text}{merged && sensoryText ? ` ${sensoryText}` : ""}
                                  </p>
                                );
                              }) : dbConcernText && (
                                <p className="text-xs text-gray-600 leading-relaxed">
                                  {(catLabel || structured?.concern_category || (structured?.concern_profiles?.length ?? 0) > 0) && (
                                    <span className={`font-semibold ${fc && isUniversalCat(fc) ? "text-rose-700" : "text-amber-700"}`}>
                                      {catLabel
                                        ? (sensoryMergedWith === fc && sensoryLabel
                                            ? (sensoryLabelRedundant ? `${catLabel}${sensoryProfileLabel}` : `${catLabel}, ${sensoryLabel}${sensoryProfileLabel}`)
                                            : `${catLabel}${fcProfileLabel}`)
                                        : [structured?.concern_category, (structured?.concern_profiles ?? []).flatMap(p => p.split(/\s*·\s*/)).join(", ") || null].filter(Boolean).join(" · ")
                                      } —</span>
                                  )}
                                  {(fcProfileCautionNote?.text ?? dbConcernText)}{sensoryMergedWith === fc && sensoryText ? ` ${sensoryText}` : ""}
                                </p>
                              )}
                              {/* Sensory shown separately only when it wasn't merged with a concern */}
                              {!sensoryMergedWith && sensoryText && (
                                <p className="text-xs text-gray-600 leading-relaxed">
                                  {sensoryLabel && <span className="font-semibold text-amber-700">{sensoryLabel}{sensoryProfileLabel} — </span>}
                                  {sensoryText}
                                </p>
                              )}
                              {sensoryItem?.sensory_category === "Film-forming" && (
                                <p className="text-xs text-gray-400">Bump type: milia — small, hard, keratin-filled bumps just under the skin surface, not inside pores.</p>
                              )}
                              {sensoryItem?.sensory_category === "Occlusive" && (
                                <p className="text-xs text-gray-400">Bump type: worsens existing congestion by sealing the skin surface.</p>
                              )}
                              {photoText && (
                                <p className="text-xs text-gray-600 leading-relaxed">
                                  {photoLabel && <span className="font-semibold text-amber-700">{photoLabel}{photoProfileLabel} — </span>}
                                  {photoText}
                                </p>
                              )}
                            </div>
                            {/* Profile caution notes — separate amber stripe */}
                            {filteredProfileCautionNotes.length > 0 && (
                              <div className="pl-3 border-l-2 border-amber-500 space-y-1">
                                {filteredProfileCautionNotes.map((note, i) => {
                                  const nl = noteLabel(note);
                                  const fullLabel = [catLabel, nl].filter(Boolean).join(" · ");
                                  return (
                                    <p key={i} className="text-xs text-gray-600 leading-relaxed">
                                      {fullLabel && <span className="font-semibold text-amber-700">{fullLabel} — </span>}
                                      {note.text}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                            {/* Other-profile caution notes — gray stripe */}
                            {otherCautionNotes.length > 0 && (
                              <div className="pl-3 border-l-2 border-gray-200 space-y-1">
                                {otherCautionNotes.map((note, i) => {
                                  const nl = noteLabel(note);
                                  const fullLabel = [catLabel, nl].filter(Boolean).join(" · ");
                                  return (
                                    <p key={i} className="text-xs text-gray-500 leading-relaxed">
                                      {fullLabel && <span className="font-semibold text-gray-500">{fullLabel} — </span>}
                                      {note.text}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                            {/* Other-profile benefit notes — gray stripe */}
                            {otherBenefitNotes.length > 0 && (
                              <div className="pl-3 border-l-2 border-gray-200 space-y-1">
                                {otherBenefitNotes.map((note, i) => {
                                  const nl = noteLabel(note);
                                  const fullLabel = [benefitLabel ?? (structured?.benefit_category ?? null), nl].filter(Boolean).join(" · ");
                                  return (
                                    <p key={i} className="text-xs text-gray-500 leading-relaxed">
                                      {fullLabel && <span className="font-semibold text-gray-500">{fullLabel} — </span>}
                                      {note.text}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {/* Neutral: loading state if no structured data yet */}
                      {level === "neutral" && isLoading && (
                        <div className="pl-3 border-l-2 border-teal-500">
                          <p className="text-xs text-gray-400 italic">Generating explanation…</p>
                        </div>
                      )}
                      {/* Environmental stripe — shows for any ingredient with an environmental flagged category */}
                      {(() => {
                        const envFcs = [fc, ...(match?.ingredient.secondary_flagged_categories ?? [])].filter((c): c is string => !!c && ENVIRONMENTAL_CATEGORIES.has(c));
                        if (envFcs.length === 0) return null;
                        return (
                          <div className="pl-3 border-l-2 border-emerald-500 space-y-1 mt-1">
                            {envFcs.map(c => (
                              <p key={c} className="text-xs text-gray-600 leading-relaxed">
                                <span className="font-semibold text-emerald-700">Environment — </span>
                                {ENVIRONMENTAL_CONCERN_NOTES[c] ?? c}
                              </p>
                            ))}
                          </div>
                        );
                      })()}
                      {/* Flag explanation — signed-in users only, only when ingredient is in DB */}
                      {ingId && isSignedIn && (
                        <div className="pt-0.5">
                          {flaggedIngredients.has(ingId) ? (
                            <p className="text-xs text-gray-400 text-right">Flagged for review</p>
                          ) : flagPanelIngId === ingId ? (
                            <div className="space-y-2 pt-1">
                              <p className="text-xs text-gray-500">What seems wrong? (optional — select all that apply)</p>
                              <div className="flex flex-wrap gap-1.5">
                                {FLAG_REASON_CHIPS.map((chip) => {
                                  const selected = flagSelectedReasons.has(chip);
                                  return (
                                    <button
                                      key={chip}
                                      type="button"
                                      onClick={() => setFlagSelectedReasons((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(chip)) next.delete(chip); else next.add(chip);
                                        return next;
                                      })}
                                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selected ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}
                                    >
                                      {chip}
                                    </button>
                                  );
                                })}
                              </div>
                              <textarea
                                value={flagNote}
                                onChange={(e) => setFlagNote(e.target.value)}
                                placeholder="Add details (optional)"
                                rows={2}
                                maxLength={500}
                                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:border-gray-400"
                              />
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  disabled={flagging === ingId}
                                  onClick={() => flagIngredient(ingId, [...flagSelectedReasons], flagNote, result?.product?.id ?? null)}
                                  className="text-xs px-3 py-1 bg-gray-800 text-white rounded-lg disabled:opacity-50 hover:bg-gray-700"
                                >
                                  {flagging === ingId ? "Sending…" : "Send flag"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setFlagPanelIngId(null); setFlagSelectedReasons(new Set()); setFlagNote(""); }}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => { setFlagPanelIngId(ingId); setFlagSelectedReasons(new Set()); }}
                                className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                Flag explanation
                              </button>
                            </div>
                          )}
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
                {hasProfile && renderGroup("My profile", groups["profile-matched"], "profile-matched")}
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
                {result.originalItems.some(i => i.includes("*")) && (
                  <p className="text-[11px] text-gray-400 mt-2">* From organically certified sources (COSMOS / Ecocert)</p>
                )}
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
                {isSignedIn && result.product?.id ? (
                  watchingProduct ? (
                    <button
                      onClick={toggleProductWatch}
                      disabled={watchLoading}
                      className="text-xs text-stone-500 hover:text-rose-400 transition-colors"
                    >
                      Notified when ready ✓
                    </button>
                  ) : (
                    <button
                      onClick={toggleProductWatch}
                      disabled={watchLoading}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Notify me when ready
                    </button>
                  )
                ) : (
                  <span className="text-xs text-gray-400">Queued for generation</span>
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
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-widest"
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

      {/* ── Routine bottom sheet (all breakpoints) ── */}
      {routinePanelOpen && (
        <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setRoutinePanelOpen(false)} aria-hidden />
      )}

      {/* Floating trigger button */}
      {routineProducts.length > 0 && (
        <button
          type="button"
          onClick={() => setRoutinePanelOpen(v => !v)}
          className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium border transition-colors ${detectRoutineWarnings(routineProducts).length > 0 ? "bg-white border-amber-800 text-amber-900" : "bg-white border-gray-200 text-gray-700"}`}
        >
          Routine {routinePanelOpen ? "▼" : "▲"} · {routineProducts.length}
        </button>
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 md:inset-x-auto md:right-4 md:bottom-16 md:w-80 z-40 bg-white border-t md:border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl transition-transform duration-300 ${routinePanelOpen ? "translate-y-0" : "translate-y-[110%]"}`}
        style={{ maxHeight: "65vh", display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Routine</span>
          <button type="button" onClick={() => setRoutinePanelOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {renderRoutinePanel()}
        </div>
      </div>

      {barcodeOpen && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setBarcodeOpen(false)}
        />
      )}
      {ocrOpen && (
        <IngredientOCR
          onExtracted={handleOCRExtracted}
          onClose={() => setOcrOpen(false)}
        />
      )}
    </div>
  );
}
