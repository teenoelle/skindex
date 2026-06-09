"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import IngredientListPicker from "@/components/IngredientListPicker";
type ExplanationStructured = {
  formula_role: string | null;
  benefit: string | null;
  concern: string | null;
  concern_items?: { category: string; text: string }[] | null;
};

type Item = {
  id: string;
  name: string;
  category: string;
  structural_category: string | null;
  explanation: string | null;
  explanation_structured: ExplanationStructured | null;
  secondary_categories: string[];
};

type Group = {
  cat: string;
  label: string;
  description: string;
  items: Item[];
  whyFlagged?: string[];
};

// ── Profile constants ─────────────────────────────────────────────────────────

const SKIN_TYPE_LABELS: Record<string, string> = {
  oily: "Oily", dry: "Dry", reactive: "Reactive", damaged_barrier: "Damaged barrier",
  acne_prone: "Acne", mature: "Mature", hyperpigmentation_prone: "Hyperpigmentation",
  fungal_acne: "Fungal acne", rosacea: "Rosacea", seborrheic: "Seborrheic dermatitis",
  eczema: "Eczema", psoriasis: "Psoriasis", lupus_rash: "Lupus rash",
  keratosis_pilaris: "Keratosis pilaris", body_acne: "Body acne",
};

const SKIN_TYPE_NOTES: Record<string, string> = {
  oily: "Oily skin still loses moisture in the minutes after washing. Apply your next product quickly — the itch in that window is what causes barrier damage, not the product itself.",
  dry: "Dry skin has a thinner lipid layer and loses water fastest in cold or dry air — drying solvents, sulfate surfactants, and clay are worth watching closely.",
  reactive: "Reactive skin has a lower tolerance threshold — sensitizers, fragrance allergens, and chemical sunscreens are worth watching closely, especially in warm weather.",
  damaged_barrier: "A compromised barrier lets ingredients penetrate faster and deeper — irritants and sensitizers hit harder and recovery takes longer than it would on intact skin.",
  acne_prone: "For acne skin, pore-clogging ingredients and film-formers are the main risks — watch the Congestion section after scanning.",
  mature: "Mature skin benefits most from peptides, ceramides, and emollients, and is more sensitive to the retinoid adjustment period — start at the lowest available concentration.",
  hyperpigmentation_prone: "For hyperpigmentation-prone skin, UV exposure directly undoes progress — many brightening actives also increase UV sensitivity, making daily SPF essential.",
  fungal_acne: "Fungal acne (Malassezia folliculitis) is caused by yeast, not bacteria — it looks like regular acne but doesn't respond to antibiotics or most OTC acne treatments. Many 'safe' moisturizing oils and fatty acid esters feed Malassezia. Scanning every formula matters more here than for almost any other skin type.",
  rosacea: "Rosacea triggers vary but commonly include heat, vasodilation, and chemical absorption. Chemical UV filters, alcohol-based formulas, menthol, warming agents, and high fragrance load are the main ingredient triggers — mineral sunscreens (zinc oxide, titanium dioxide) are strongly preferred.",
  seborrheic: "Seborrheic dermatitis is driven by Malassezia — a yeast that naturally colonizes everyone's skin and feeds on the fatty acids in sebum. In seborrheic dermatitis, the immune system overreacts to Malassezia's metabolic byproducts, triggering inflammation wherever sebaceous glands are densest. On the scalp it presents as dandruff: flaky, itchy scale that sheds onto shoulders. On the face it clusters in the T-zone — the sides of the nose, brows, and glabella — as reddish, slightly greasy patches with fine yellowish or white scale that clings to skin rather than falling away. All sites respond to the same actives: zinc pyrithione, piroctone olamine, selenium sulfide, ketoconazole, and low-dose salicylic acid. Certain plant oils and fatty acid esters feed Malassezia and worsen all sites.",
  eczema: "Atopic eczema has specific preservative sensitivities. MI/MCI (methylisothiazolinone/methylchloroisothiazolinone) and IPBC are notorious eczema triggers. Ceramides, colloidal oatmeal, and thick emollients are specifically therapeutic here — unlike for acne, heavy barrier creams help rather than harm.",
  psoriasis: "Psoriasis causes rapid cell turnover and thick scale. Keratolytics like salicylic acid can help remove scale. Fragrances and harsh surfactants trigger flares. Vitamin D analogues and antioxidants are specifically beneficial.",
  lupus_rash: "The malar (butterfly) rash of lupus is highly photosensitive — UV exposure triggers flares. Chemical UV filters can also cause reactions; mineral-only sunscreens (zinc oxide, titanium dioxide) are strongly preferred. Photosensitizing ingredients carry significantly higher risk here than for any other type.",
  keratosis_pilaris: "Keratosis pilaris (the rough, bumpy texture on upper arms and thighs) is caused by keratin plugging follicles. Gentle chemical exfoliants — urea, lactic acid, salicylic acid — dissolve plugs; physical scrubs and harsh stripping cleansers worsen the inflammation that keeps follicles blocked.",
  body_acne: "Body acne is driven by the same pore-clogging and bacterial mechanisms as face acne, but friction and sweat occlusion under clothing are major amplifiers. The same pore-clogger flags that matter on face apply here.",
};

const CLIMATE_NOTES: Record<string, string> = {
  humid: "In humid climates, film-forming and occlusive ingredients are more likely to trap heat and sebum against the skin — lighter formulations are preferable.",
  dry_climate: "In dry climates, humectants need to be sealed in with an emollient or occlusive — without one, they can pull moisture from deeper skin layers instead of the air.",
  cold: "Cold air depletes skin lipids fastest — barrier-repairing ingredients (ceramides, fatty acids, emollients) are most effective and most needed in this climate.",
  hot: "In hot weather, skin permeability increases, making sensitizers and chemical UV filters absorb more readily and triggering stronger reactions.",
  high_uv: "In high-UV environments (UV Index 6+ on the WHO scale — 6–7 is High, 8–10 Very High, 11+ Extreme), daily broad-spectrum SPF is essential — AHAs, retinoids, and many brightening ingredients all increase UV sensitivity.",
  hard_water: "Hard (mineral-rich) water is alkaline (pH 7–9) and leaves a calcium/magnesium film on skin after rinsing. This disrupts the skin's natural acid mantle, impairs cleanser rinse-off, and is a documented eczema aggravator. Look for cleansers containing chelating agents (EDTA, phytic acid) and follow with a low-pH toner quickly after washing.",
  chlorinated_water: "Chlorinated and chloramine-treated tap water can oxidize skin barrier lipids on contact — particularly relevant for eczema and reactive skin. A vitamin C (ascorbic acid) toner applied immediately after washing neutralizes residual disinfectant before it can damage the barrier.",
  iron_water: "Iron-bearing water introduces ferrous and ferric ions that generate free radicals on contact with skin, accelerating barrier lipid oxidation. Chelating agents and antioxidants (especially vitamins C and E) counteract this.",
  heavy_metal_water: "Lead or heavy metal contamination in tap water is a public health concern — filtering your water or using bottled/filtered water for face washing is the most effective intervention. Chelating cleansers bind surface metals, and penetration enhancers (drying alcohols) should be avoided as they increase absorption.",
};
const SKIN_TYPE_VALUES = Object.keys(SKIN_TYPE_LABELS);
const CLIMATE_TYPES = [
  { value: "humid", label: "Humid" },
  { value: "dry_climate", label: "Dry" },
  { value: "cold", label: "Cold" },
  { value: "hot", label: "Hot" },
  { value: "high_uv", label: "High UV" },
];
const WATER_TYPES = [
  { value: "hard_water", label: "Hard / mineral" },
  { value: "chlorinated_water", label: "Chlorinated" },
  { value: "iron_water", label: "Iron / rust" },
  { value: "heavy_metal_water", label: "Lead / metals" },
];
const ALL_CLIMATE = [...CLIMATE_TYPES, ...WATER_TYPES];

// ── Group definitions ─────────────────────────────────────────────────────────

const UNIVERSAL_CATS_SET = new Set([
  "fragrance-allergen", "preservative-allergen", "formaldehyde releaser",
  "sensitizing preservative", "biocide", "Sulfate Surfactant", "Drying Solvent",
]);

const ENVIRONMENTAL_GROUPS: { cat: string; label: string; description: string }[] = [
  { cat: "reef harmful",             label: "Reef-Harmful UV Filters",    description: "Oxybenzone, octinoxate, and octocrylene are banned in reef-protected areas for documented coral toxicity. Mineral sunscreens (zinc oxide, titanium dioxide) are reef-safe alternatives." },
  { cat: "PFAS",                     label: "PFAS / Fluorinated",          description: "Per- and polyfluoroalkyl substances (PTFE, fluorinated polymers) that do not break down in the environment and accumulate in living organisms and waterways." },
  { cat: "endocrine disruptor",      label: "Endocrine Disruptors",        description: "Interfere with hormone signaling in aquatic wildlife and accumulate in water systems. Includes certain UV filters, parabens at high aquatic concentrations, and cyclic silicones." },
  { cat: "environmental persistent", label: "Environmentally Persistent",  description: "Persist in the environment and accumulate in living organisms. Cyclic silicones (D4, D5, D6) are restricted in EU rinse-off products for this reason." },
];

const PROFILE_CAT_MAP: Record<string, string[]> = {
  "pore-clogger":            ["oily","acne_prone","fungal_acne","body_acne","keratosis_pilaris"],
  "occlusive":               ["oily","acne_prone","fungal_acne","body_acne","keratosis_pilaris"],
  "bacteria-trap":           ["oily","acne_prone","fungal_acne","body_acne"],
  "sensitizer":              ["reactive","damaged_barrier","eczema","rosacea","psoriasis"],
  "fragrance-allergen":      ["reactive","damaged_barrier","eczema","rosacea","psoriasis"],
  "preservative-allergen":   ["reactive","damaged_barrier","eczema","rosacea","psoriasis"],
  "sensitizing preservative":["reactive","damaged_barrier","eczema","rosacea","psoriasis"],
  "formaldehyde releaser":   ["reactive","damaged_barrier","eczema","rosacea","psoriasis"],
  "biocide":                 ["reactive","damaged_barrier","eczema"],
  "contact-allergen":        ["reactive","damaged_barrier","eczema"],
  "Chemical Sunscreen":      ["rosacea","lupus_rash"],
  "Drying Solvent":          ["dry","damaged_barrier","reactive","rosacea"],
  "Sulfate Surfactant":      ["dry","damaged_barrier","eczema","psoriasis","rosacea","keratosis_pilaris"],
  "photo-retinoid":          ["hyperpigmentation_prone","lupus_rash"],
  "photo-AHA":               ["hyperpigmentation_prone","lupus_rash"],
  "photo-BHA":               ["hyperpigmentation_prone","lupus_rash"],
  "photo-brightening":       ["hyperpigmentation_prone","lupus_rash"],
  "photo-botanical":         ["hyperpigmentation_prone","lupus_rash"],
};

const UNIVERSAL_GROUPS: { cat: string; label: string; description: string }[] = [
  { cat: "fragrance-allergen",       label: "Fragrance Allergens",       description: "Among the most common causes of contact dermatitis and sensitization, even at trace levels." },
  { cat: "preservative-allergen",    label: "Preservative Allergens",    description: "Preservatives with significant allergenic potential documented across all skin types." },
  { cat: "formaldehyde releaser",    label: "Formaldehyde Releasers",    description: "Slowly release formaldehyde — a known human carcinogen and strong contact sensitizer." },
  { cat: "sensitizing preservative", label: "Sensitizing Preservatives", description: "More likely to trigger sensitization than standard preservatives; avoid on compromised skin." },
  { cat: "biocide",                  label: "Biocides",                  description: "Broad-spectrum antimicrobials with elevated sensitization and systemic toxicity concerns." },
  { cat: "Sulfate Surfactant",       label: "Sulfate Surfactants",       description: "Strip the skin barrier and can cause irritation, dryness, and inflammation with regular use." },
  { cat: "Drying Solvent",           label: "Drying Solvents",           description: "Dehydrate the skin surface and can compromise the moisture barrier over time." },
];

const SENSITIVITY_GROUP: Record<string, { label: string; description: string; triggeredBy: string[]; climateTriggeredBy?: string[] }> = {
  "pore-clogger":            { label: "Pore-Cloggers",                 description: "May block pores and contribute to comedones in susceptible skin.",                            triggeredBy: ["acne_prone","oily","fungal_acne","body_acne","keratosis_pilaris"] },
  "occlusive":               { label: "Heavy Occlusives",              description: "Forms an occlusive film that may trap sebum and impair pore drainage.",                       triggeredBy: ["acne_prone","oily","fungal_acne","body_acne","keratosis_pilaris"] },
  "bacteria-trap":           { label: "Bacteria Traps",                description: "Creates conditions that can favor the growth of acne-causing bacteria.",                     triggeredBy: ["acne_prone","oily","fungal_acne","body_acne"] },
  "sensitizer":              { label: "Sensitizers",                   description: "May trigger or worsen reactivity, redness, or chronic inflammation.",                        triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "fragrance-allergen":      { label: "Fragrance Allergens",           description: "Known fragrance allergens — a leading cause of contact sensitization.",                      triggeredBy: ["reactive","damaged_barrier","eczema"] },
  "preservative-allergen":   { label: "Preservative Allergens",        description: "Preservatives with documented potential to cause allergic contact reactions.",               triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "sensitizing preservative":{ label: "Sensitizing Preservatives",     description: "More irritating or sensitizing than standard preservatives.",                                triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "formaldehyde releaser":   { label: "Formaldehyde Releasers",        description: "Release formaldehyde slowly — a strong sensitizer and carcinogen.",                         triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "biocide":                 { label: "Biocides",                      description: "Broad-spectrum antimicrobials with higher sensitization risk for reactive skin.",            triggeredBy: ["reactive","damaged_barrier","eczema"] },
  "contact-allergen":        { label: "Contact Allergens",             description: "Known contact allergens with sensitization risk.",                                           triggeredBy: ["reactive","damaged_barrier","eczema"] },
  "Chemical Sunscreen":      { label: "Chemical Sunscreens",           description: "Chemical UV filters that may irritate rosacea-prone or lupus-affected skin.",                triggeredBy: ["rosacea","lupus_rash"] },
  "Drying Solvent":          { label: "Drying Solvents",               description: "Dehydrating solvents that can compromise barrier function.",                                triggeredBy: ["dry","damaged_barrier","reactive","rosacea"], climateTriggeredBy: ["heavy_metal_water"] },
  "Sulfate Surfactant":      { label: "Sulfate Surfactants",           description: "Sulfate surfactants that strip the skin barrier.",                                           triggeredBy: ["dry","damaged_barrier","eczema","psoriasis","rosacea","keratosis_pilaris"] },
  "photo-retinoid":          { label: "Photo-Sensitizing Retinoids",   description: "Retinoids that significantly increase sun sensitivity.",                                     triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-AHA":               { label: "Photo-Sensitizing AHAs",        description: "Alpha hydroxy acids that increase UV sensitivity.",                                          triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-BHA":               { label: "Photo-Sensitizing BHAs",        description: "Beta hydroxy acids that increase UV sensitivity.",                                           triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-brightening":       { label: "Photo-Sensitizing Brighteners", description: "Brightening actives that can increase sun sensitivity.",                                     triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-botanical":         { label: "Photo-Sensitizing Botanicals",  description: "Botanicals with documented photosensitizing potential.",                                     triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
};

const BENEFIT_GROUP: Record<string, { label: string; description: string }> = {
  "":                   { label: "Neutral",            description: "Reviewed-safe with no specific benefit category — not flagged for any skin type." },
  "humectant":          { label: "Humectants",          description: "Attract and bind water to the skin, improving hydration." },
  "emollient":          { label: "Emollients",          description: "Soften and smooth the skin surface by filling gaps between skin cells." },
  "antioxidant":        { label: "Antioxidants",        description: "Neutralize free radicals to protect against environmental and UV damage." },
  "peptide":            { label: "Peptides",            description: "Amino acid chains that support collagen, elastin, or cell signaling." },
  "brightening":        { label: "Brighteners",         description: "Help fade hyperpigmentation and even overall skin tone." },
  "barrier-support":    { label: "Barrier Support",     description: "Reinforce or restore the skin's natural lipid barrier." },
  "anti-inflammatory":  { label: "Anti-Inflammatory",   description: "Calm redness, irritation, or chronic inflammation." },
  "exfoliant":          { label: "Exfoliants",          description: "Promote cell turnover by dissolving or loosening dead skin cells." },
  "sunscreen":          { label: "Sunscreens",          description: "Provide UV protection — the most important anti-aging and protective ingredient class." },
  "prebiotic":          { label: "Prebiotics",          description: "Support the skin microbiome by feeding beneficial bacteria." },
  "probiotic":          { label: "Probiotics",          description: "Live or lysate microorganisms that help balance the skin's microbiome." },
  "retinoid":           { label: "Retinoids",           description: "Vitamin A derivatives that promote cell turnover and collagen production." },
  "soothing":           { label: "Soothing",            description: "Calm and comfort reactive or sensitized skin." },
  "vitamin":            { label: "Vitamins",            description: "Skin-essential vitamins with protective or reparative properties." },
  "sebum-regulating":   { label: "Sebum-Regulating",   description: "Regulates oil production and reduces excess sebum without stripping the skin." },
  "skin-replenishing":  { label: "Skin-Replenishing",  description: "Restores skin-identical components — ceramides, fatty acids, amino acids, cholesterol — depleted by aging, cleansing, or environmental stress." },
  "cell-communicating": { label: "Cell-Communicating", description: "Signals skin cells to behave in a more youthful way, supporting collagen synthesis, cell turnover, and repair." },
  "wound-healing":      { label: "Wound-Healing",      description: "Accelerates recovery from minor skin damage — cuts, post-procedure healing, and chronic barrier disruption." },
  "keratolytic":        { label: "Keratolytic",         description: "Softens and dissolves keratin bonds to smooth rough, thickened, or flaky skin without harsh scrubbing." },
  "antifungal":         { label: "Antifungal",          description: "Inhibits the growth of skin fungi including Malassezia — relevant for fungal acne, dandruff, and seborrheic dermatitis." },
  "de-puffing":         { label: "De-Puffing",          description: "Reduces fluid retention and puffiness, particularly around the eyes, through vasoconstriction or lymphatic stimulation." },
  "photostabilizer":    { label: "Photostabilizer",     description: "Extends and stabilizes the efficacy of UV filters and other light-sensitive actives, improving sun protection durability." },
  "chelating":          { label: "Chelating",           description: "Binds trace metal ions that degrade product quality and can cause skin reactions — particularly valuable in hard or iron-rich water." },
  "antimicrobial":      { label: "Antimicrobial",       description: "Reduces or prevents bacterial growth on skin — relevant for acne management, wound care, and odor control." },
};

const META: Record<string, { title: string; color: string; description: string }> = {
  "universal-concerns":    { title: "Universal Concerns",   color: "text-rose-700",    description: "Flagged for all skin types — contact allergens, biocides, sulfate surfactants, formaldehyde releasers, and drying solvents." },
  "my-sensitivities":      { title: "My Sensitivities",     color: "text-amber-700",   description: "Ingredients flagged specifically for your skin profile." },
  "neutral-beneficial":    { title: "Neutral & Beneficial", color: "text-teal-700",    description: "All reviewed-safe ingredients — neutral (no category) and beneficial (positive category)." },
  "environmental-concerns":{ title: "Environmental Impact", color: "text-emerald-700", description: "Ingredients with documented environmental concerns — reef toxicity, PFAS persistence, endocrine disruption in aquatic systems." },
};

// ── Badge color helper ────────────────────────────────────────────────────────

function isProfileMatched(cat: string, skinTypes: string[], climates: string[]): boolean {
  const skinTypeSet = new Set(skinTypes);
  const climateSet = new Set(climates);
  if (cat === "Drying Solvent" && (skinTypeSet.has("rosacea") || climateSet.has("heavy_metal_water"))) return true;
  if (["photo-retinoid","photo-AHA","photo-BHA","photo-brightening","photo-botanical"].includes(cat) && climateSet.has("high_uv")) return true;
  return (PROFILE_CAT_MAP[cat] ?? []).some(pt => skinTypeSet.has(pt));
}

function getCategoryLabel(cat: string): string {
  if (!cat) return "";
  if (SENSITIVITY_GROUP[cat]) return SENSITIVITY_GROUP[cat].label;
  const ug = UNIVERSAL_GROUPS.find(g => g.cat === cat);
  if (ug) return ug.label;
  if (BENEFIT_GROUP[cat]) return BENEFIT_GROUP[cat].label;
  return cat;
}

const ENVIRONMENTAL_CATS_SET = new Set(ENVIRONMENTAL_GROUPS.map(g => g.cat));

function catBadgeColor(cat: string, isSafePage: boolean): string {
  if (!cat) return "bg-gray-100 text-gray-500";
  if (UNIVERSAL_CATS_SET.has(cat)) return "text-rose-700";
  if (ENVIRONMENTAL_CATS_SET.has(cat)) return "text-emerald-700";
  if (isSafePage) return "text-teal-700";
  return "text-amber-700";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readProfile() {
  try {
    const st = localStorage.getItem("skindex:skinTypes");
    const cl = localStorage.getItem("skindex:climates");
    return { skinTypes: st ? JSON.parse(st) as string[] : [], climates: cl ? JSON.parse(cl) as string[] : [] };
  } catch { return { skinTypes: [], climates: [] }; }
}

function buildGroups(items: Item[], slug: string, skinTypes: string[], climates: string[]): Group[] {
  if (slug === "universal-concerns") {
    return UNIVERSAL_GROUPS
      .map(g => ({ ...g, items: items.filter(i => i.category === g.cat) }))
      .filter(g => g.items.length > 0);
  }
  if (slug === "environmental-concerns") {
    return ENVIRONMENTAL_GROUPS
      .map(g => ({ ...g, items: items.filter(i => i.category === g.cat) }))
      .filter(g => g.items.length > 0);
  }
  if (slug === "my-sensitivities") {
    const grouped = new Map<string, Item[]>();
    for (const item of items) {
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category)!.push(item);
    }
    const orderedKeys = Object.keys(SENSITIVITY_GROUP);
    const groups: Group[] = [];
    for (const cat of orderedKeys) {
      const groupItems = grouped.get(cat);
      if (!groupItems?.length) continue;
      const info = SENSITIVITY_GROUP[cat];
      const matchedSkin = skinTypes.filter(st => info.triggeredBy.includes(st)).map(st => SKIN_TYPE_LABELS[st] ?? st);
      const matchedClimate = (info.climateTriggeredBy ?? []).filter(c => climates.includes(c)).map(c => ALL_CLIMATE.find(t => t.value === c)?.label ?? c);
      groups.push({ cat, label: info.label, description: info.description, items: groupItems, whyFlagged: [...matchedSkin, ...matchedClimate] });
    }
    for (const [cat, groupItems] of grouped) {
      if (orderedKeys.includes(cat) || !groupItems.length) continue;
      groups.push({ cat, label: cat, description: "", items: groupItems });
    }
    return groups;
  }
  if (slug === "neutral-beneficial") {
    const grouped = new Map<string, Item[]>();
    for (const item of items) {
      const key = item.category ?? "";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    const cats = [...grouped.keys()].sort((a, b) => {
      if (a === "") return -1; if (b === "") return 1;
      return (BENEFIT_GROUP[a]?.label ?? a).localeCompare(BENEFIT_GROUP[b]?.label ?? b);
    });
    return cats.map(cat => {
      const info = BENEFIT_GROUP[cat] ?? { label: cat, description: "" };
      return { cat, label: info.label, description: info.description, items: grouped.get(cat) ?? [] };
    }).filter(g => g.items.length > 0);
  }
  return [];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BuiltInListPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = META[slug];
  const isSafePage = slug === "neutral-beneficial";

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rinseOff, setRinseOff] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Empty set = all collapsed; populated = those groups expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [skinTypes, setSkinTypes] = useState<string[]>([]);
  const [climates, setClimates] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [skinTypeHint, setSkinTypeHint] = useState<string | null>(null);
  const [climateHint, setClimateHint] = useState<string | null>(null);
  const [waterHint, setWaterHint] = useState<string | null>(null);
  const [userLists, setUserLists] = useState<{ id: string; name: string; items: string[] }[]>([]);

  const hasProfile = skinTypes.length > 0 || climates.length > 0;

  function saveSkinTypes(next: string[]) {
    setSkinTypes(next);
    try { localStorage.setItem("skindex:skinTypes", JSON.stringify(next)); } catch {}
  }
  function saveClimates(next: string[]) {
    setClimates(next);
    try { localStorage.setItem("skindex:climates", JSON.stringify(next)); } catch {}
  }
  function toggleGroup(cat: string) {
    setExpandedGroups(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });
  }

  useEffect(() => {
    const { skinTypes: st, climates: cl } = readProfile();
    setSkinTypes(st);
    setClimates(cl);
    setProfileReady(true);
    try {
      const il = localStorage.getItem("skindex:ingredientLists");
      if (il) setUserLists(JSON.parse(il));
    } catch {}
  }, []);

  function addToUserList(listId: string, ingredientName: string) {
    const val = ingredientName.toLowerCase();
    setUserLists(prev => {
      const updated = prev.map(l => {
        if (l.id !== listId || l.items.includes(val)) return l;
        return { ...l, items: [...l.items, val] };
      });
      try { localStorage.setItem("skindex:ingredientLists", JSON.stringify(updated)); } catch {}
      const target = updated.find(l => l.id === listId);
      if (target) {
        fetch(`/api/user-ingredient-lists/${listId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: target.items }),
        }).catch(() => {});
      }
      return updated;
    });
  }

  useEffect(() => {
    if (!meta || !profileReady || editingProfile) return;
    setLoading(true);
    const params = new URLSearchParams({ list: slug });
    if (skinTypes.length) params.set("skinTypes", skinTypes.join(","));
    if (climates.length) params.set("climates", climates.join(","));
    if (rinseOff) params.set("rinseOff", "true");
    fetch(`/api/ingredient-lists/items?${params}`)
      .then(r => r.json())
      .then(d => {
        const newItems: Item[] = d.items ?? [];
        setItems(newItems);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, skinTypes, climates, rinseOff, profileReady, editingProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) {
    return (
      <div className="min-h-screen bg-white">

        <main className="max-w-2xl mx-auto px-6 pt-[4.5rem] pb-16 text-center">
          <p className="text-gray-400 text-sm">List not found.</p>
          <Link href="/lists" className="text-sm text-gray-700 underline underline-offset-2 mt-4 block">← My Lists</Link>
        </main>
      </div>
    );
  }

  const filtered = q.trim() ? items.filter(i => i.name.toLowerCase().includes(q.trim().toLowerCase())) : items;
  const groups = buildGroups(filtered, slug, skinTypes, climates);
  const effectiveExpandedGroups = q.trim() ? new Set(groups.map(g => g.cat)) : expandedGroups;

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-2xl mx-auto px-6 pt-[4.5rem] pb-16">
        <Link href="/lists" className="text-xs text-gray-400 hover:text-gray-700 mb-6 block">← My Lists</Link>

        {/* Page header */}
        <div className="mb-6">
          <h1 className={`text-2xl font-semibold tracking-tight mb-1 ${meta.color}`}>{meta.title}</h1>
          <p className="text-xs text-gray-400 leading-relaxed">{meta.description}</p>

          {/* Profile widget — My Sensitivities only */}
          {slug === "my-sensitivities" && (
            <div className="mt-4">
              {editingProfile ? (
                <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700">Skin type</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SKIN_TYPE_VALUES.map(st => (
                        <span key={st} className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => saveSkinTypes(skinTypes.includes(st) ? skinTypes.filter(s => s !== st) : [...skinTypes, st])}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${skinTypes.includes(st) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                            {SKIN_TYPE_LABELS[st]}
                          </button>
                          {SKIN_TYPE_NOTES[st] && (
                            <button type="button" onClick={() => setSkinTypeHint(h => h === st ? null : st)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${SKIN_TYPE_LABELS[st]}`}>ⓘ</button>
                          )}
                        </span>
                      ))}
                    </div>
                    {skinTypeHint && SKIN_TYPE_NOTES[skinTypeHint] && (
                      <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                        <span className="font-medium text-gray-700">{SKIN_TYPE_LABELS[skinTypeHint]} — </span>
                        {SKIN_TYPE_NOTES[skinTypeHint]}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700">Climate</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CLIMATE_TYPES.map(({ value, label }) => (
                        <span key={value} className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => saveClimates(climates.includes(value) ? climates.filter(c => c !== value) : [...climates, value])}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${climates.includes(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                            {label}
                          </button>
                          <button type="button" onClick={() => setClimateHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                        </span>
                      ))}
                    </div>
                    {climateHint && CLIMATE_NOTES[climateHint] && (
                      <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                        <span className="font-medium text-gray-700">{CLIMATE_TYPES.find(t => t.value === climateHint)?.label} — </span>
                        {CLIMATE_NOTES[climateHint]}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700">Water quality</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WATER_TYPES.map(({ value, label }) => (
                        <span key={value} className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => saveClimates(climates.includes(value) ? climates.filter(c => c !== value) : [...climates, value])}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${climates.includes(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                            {label}
                          </button>
                          <button type="button" onClick={() => setWaterHint(h => h === value ? null : value)} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none" aria-label={`About ${label}`}>ⓘ</button>
                        </span>
                      ))}
                    </div>
                    {waterHint && CLIMATE_NOTES[waterHint] && (
                      <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed border border-gray-100">
                        <span className="font-medium text-gray-700">{WATER_TYPES.find(t => t.value === waterHint)?.label} — </span>
                        {CLIMATE_NOTES[waterHint]}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setEditingProfile(false)} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">Done</button>
                </div>
              ) : hasProfile ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-0.5">Profile:</span>
                  {skinTypes.map(st => (
                    <span key={st} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SKIN_TYPE_LABELS[st] ?? st}</span>
                  ))}
                  {climates.map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{ALL_CLIMATE.find(t => t.value === c)?.label ?? c}</span>
                  ))}
                  <button type="button" onClick={() => setEditingProfile(true)} className="text-[10px] text-gray-400 hover:text-gray-700 underline underline-offset-2 ml-1">Edit</button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  No skin profile set.{" "}
                  <button type="button" onClick={() => setEditingProfile(true)} className="underline underline-offset-2 hover:text-gray-700">Set it here</button>{" "}
                  to see your personal sensitivity list.
                </p>
              )}

              {hasProfile && !editingProfile && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-400">Product type:</span>
                  {(["Leave-on", "Rinse-off"] as const).map(label => {
                    const isRO = label === "Rinse-off";
                    return (
                      <button key={label} type="button" onClick={() => setRinseOff(isRO)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${rinseOff === isRO ? "bg-gray-800 text-white border-gray-800" : "text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search ingredients…"
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-400" />
          {q && <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>}
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
        ) : slug === "my-sensitivities" && !hasProfile ? (
          <p className="text-sm text-gray-400 text-center py-12">Set your skin profile above to see your sensitivities.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{q ? "No matches." : "No ingredients."}</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{filtered.length.toLocaleString()} ingredient{filtered.length !== 1 ? "s" : ""}{q ? " matching" : ""}</p>
            <div className="space-y-3">
              {groups.map(group => {
                const isGroupExpanded = effectiveExpandedGroups.has(group.cat);
                const groupColor = slug === "universal-concerns" ? "text-rose-700"
                  : slug === "my-sensitivities" ? "text-amber-700"
                  : slug === "environmental-concerns" ? "text-emerald-700"
                  : group.cat ? "text-teal-700" : "text-gray-600";
                return (
                  <div key={group.cat} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Group header */}
                    <button type="button" onClick={() => toggleGroup(group.cat)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-medium ${groupColor}`}>{group.label}</span>
                          <span className="text-[10px] text-gray-400">{group.items.length}</span>
                        </div>
                        {group.description && <p className="text-[11px] text-gray-400 leading-relaxed">{group.description}</p>}
                        {group.whyFlagged && group.whyFlagged.length > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">Flagged for: {group.whyFlagged.join(", ")}</p>
                        )}
                      </div>
                      <span className="text-gray-300 text-[10px] shrink-0 mt-0.5">{isGroupExpanded ? "▲" : "▼"}</span>
                    </button>

                    {/* Ingredient rows */}
                    {isGroupExpanded && (
                      <div className="divide-y divide-gray-100">
                        {group.items.map(item => {
                          const isExpanded = expandedId === item.id;
                          const structured = item.explanation_structured;
                          const isUniversal = UNIVERSAL_CATS_SET.has(item.category);
                          const isEnvironmental = ENVIRONMENTAL_CATS_SET.has(item.category);
                          const concernBorder = isUniversal ? "border-rose-500" : isEnvironmental ? "border-emerald-500" : "border-amber-500";
                          return (
                            <div key={item.id}>
                              {/* Collapsed row — name + all category pills */}
                            <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                className="w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors">
                                <span className="flex-1 text-sm text-gray-900 min-w-0 pt-0.5">{item.name}</span>
                                <span className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                                  {[item.category, ...item.secondary_categories].filter(Boolean).map(cat => (
                                    <span key={cat} className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${catBadgeColor(cat, isSafePage)}`}>
                                      {getCategoryLabel(cat)}
                                    </span>
                                  ))}
                                </span>
                                <span className="text-gray-300 text-[10px] shrink-0 pt-0.5">{isExpanded ? "▲" : "▼"}</span>
                              </button>

                              {/* Expanded detail — inline category label chips at start of each paragraph */}
                              {isExpanded && (
                                <div className="px-4 pb-3 pt-2 bg-gray-50 border-t border-gray-100 space-y-2">
                                  {/* Formula role — bold dark-gray label, gray text */}
                                  {structured?.formula_role && (
                                    <div className="pl-3 border-l-2 border-gray-300">
                                      <p className="text-xs text-gray-500 leading-relaxed">
                                        {item.structural_category && <span className="font-semibold text-gray-700">{item.structural_category} — </span>}
                                        {structured.formula_role}
                                      </p>
                                    </div>
                                  )}

                                  {/* Benefit — bold dark-teal label, gray text */}
                                  {structured?.benefit && (
                                    <div className="pl-3 border-l-2 border-teal-500">
                                      <p className="text-xs text-gray-600 leading-relaxed">
                                        {isSafePage && item.category && (
                                          <span className="font-semibold text-teal-700">{BENEFIT_GROUP[item.category]?.label ?? item.category} — </span>
                                        )}
                                        {structured.benefit}
                                      </p>
                                    </div>
                                  )}

                                  {/* Concern — bold dark-rose (universal) or dark-amber (profile) label, gray text */}
                                  {!isSafePage && (() => {
                                    const isUniversalPage = slug === "universal-concerns";
                                    const universalItems = isUniversalPage && structured?.concern_items
                                      ? structured.concern_items.filter(ci => UNIVERSAL_CATS_SET.has(ci.category))
                                      : structured?.concern_items ?? [];
                                    const profileItems = isUniversalPage && hasProfile && structured?.concern_items
                                      ? structured.concern_items.filter(ci => !UNIVERSAL_CATS_SET.has(ci.category) && isProfileMatched(ci.category, skinTypes, climates))
                                      : [];
                                    const showUniversal = universalItems.length > 0 || structured?.concern || (!structured && item.explanation);
                                    return (
                                      <>
                                        {showUniversal && (
                                          <div className={`pl-3 border-l-2 ${concernBorder} space-y-1`}>
                                            {structured?.concern_items ? universalItems.map(ci => (
                                              <p key={ci.category} className="text-xs text-gray-600 leading-relaxed">
                                                <span className={`font-semibold ${UNIVERSAL_CATS_SET.has(ci.category) ? "text-rose-700" : "text-amber-700"}`}>
                                                  {getCategoryLabel(ci.category)} — </span>
                                                {ci.text}
                                              </p>
                                            )) : (
                                              <p className="text-xs text-gray-600 leading-relaxed">
                                                {item.category && <span className="font-semibold text-rose-700">{getCategoryLabel(item.category)} — </span>}
                                                {structured?.concern ?? item.explanation}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                        {profileItems.length > 0 && (
                                          <div className="pl-3 border-l-2 border-amber-500 space-y-1">
                                            {profileItems.map(ci => (
                                              <p key={ci.category} className="text-xs text-gray-600 leading-relaxed">
                                                <span className="font-semibold text-amber-700">{getCategoryLabel(ci.category)} — </span>
                                                {ci.text}
                                              </p>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}

                                  {/* Safe plain explanation fallback */}
                                  {isSafePage && !structured && item.explanation && (
                                    <div className="pl-3 border-l-2 border-gray-300">
                                      <p className="text-xs text-gray-600 leading-relaxed">
                                        {item.structural_category && <span className="font-semibold text-gray-700">{item.structural_category} — </span>}
                                        {item.explanation}
                                      </p>
                                    </div>
                                  )}

                                  {!structured && !item.explanation && (
                                    <p className="text-xs text-gray-400 italic">No explanation available yet.</p>
                                  )}
                                  {userLists.length > 0 && (
                                    <div className="pt-1">
                                      <IngredientListPicker
                                        ingredientName={item.name}
                                        lists={userLists}
                                        onAdd={(listId) => addToUserList(listId, item.name)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
