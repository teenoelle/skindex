"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type Item = {
  id: string;
  name: string;
  category: string;
  structural_category: string | null;
  explanation: string | null;
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
  fungal_acne: "Fungal acne", rosacea: "Rosacea", seborrheic: "Seborrheic",
  eczema: "Eczema", psoriasis: "Psoriasis", lupus_rash: "Lupus rash",
  keratosis_pilaris: "Keratosis pilaris", body_acne: "Body acne",
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

const UNIVERSAL_GROUPS: { cat: string; label: string; description: string }[] = [
  { cat: "fragrance-allergen",      label: "Fragrance Allergens",       description: "Among the most common causes of contact dermatitis and sensitization, even at trace levels." },
  { cat: "preservative-allergen",   label: "Preservative Allergens",    description: "Preservatives with significant allergenic potential documented across all skin types." },
  { cat: "formaldehyde releaser",   label: "Formaldehyde Releasers",    description: "Slowly release formaldehyde — a known human carcinogen and strong contact sensitizer." },
  { cat: "sensitizing preservative",label: "Sensitizing Preservatives", description: "More likely to trigger sensitization than standard preservatives; avoid on compromised skin." },
  { cat: "biocide",                 label: "Biocides",                  description: "Broad-spectrum antimicrobials with elevated sensitization and systemic toxicity concerns." },
  { cat: "Sulfate Surfactant",      label: "Sulfate Surfactants",       description: "Strip the skin barrier and can cause irritation, dryness, and inflammation with regular use." },
  { cat: "Drying Solvent",          label: "Drying Solvents",           description: "Dehydrate the skin surface and can compromise the moisture barrier over time." },
];

const SENSITIVITY_GROUP: Record<string, { label: string; description: string; triggeredBy: string[]; climateTriggeredBy?: string[] }> = {
  "pore-clogger":            { label: "Pore-Cloggers",                description: "May block pores and contribute to comedones in susceptible skin.",                           triggeredBy: ["acne_prone","oily","fungal_acne","body_acne","keratosis_pilaris"] },
  "occlusive":               { label: "Heavy Occlusives",             description: "Forms an occlusive film that may trap sebum and impair pore drainage.",                      triggeredBy: ["acne_prone","oily","fungal_acne","body_acne","keratosis_pilaris"] },
  "bacteria-trap":           { label: "Bacteria Traps",               description: "Creates conditions that can favor the growth of acne-causing bacteria.",                    triggeredBy: ["acne_prone","oily","fungal_acne","body_acne"] },
  "sensitizer":              { label: "Sensitizers",                  description: "May trigger or worsen reactivity, redness, or chronic inflammation.",                       triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "fragrance-allergen":      { label: "Fragrance Allergens",          description: "Known fragrance allergens — a leading cause of contact sensitization.",                     triggeredBy: ["reactive","damaged_barrier","eczema"] },
  "preservative-allergen":   { label: "Preservative Allergens",       description: "Preservatives with documented potential to cause allergic contact reactions.",              triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "sensitizing preservative":{ label: "Sensitizing Preservatives",    description: "More irritating or sensitizing than standard preservatives.",                               triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "formaldehyde releaser":   { label: "Formaldehyde Releasers",       description: "Release formaldehyde slowly — a strong sensitizer and carcinogen.",                        triggeredBy: ["reactive","damaged_barrier","eczema","rosacea","psoriasis"] },
  "biocide":                 { label: "Biocides",                     description: "Broad-spectrum antimicrobials with higher sensitization risk for reactive skin.",           triggeredBy: ["reactive","damaged_barrier","eczema"] },
  "contact-allergen":        { label: "Contact Allergens",            description: "Known contact allergens with sensitization risk.",                                          triggeredBy: ["reactive","damaged_barrier","eczema"] },
  "Chemical Sunscreen":      { label: "Chemical Sunscreens",          description: "Chemical UV filters that may irritate rosacea-prone or lupus-affected skin.",               triggeredBy: ["rosacea","lupus_rash"] },
  "Drying Solvent":          { label: "Drying Solvents",              description: "Dehydrating solvents that can compromise barrier function.",                               triggeredBy: ["dry","damaged_barrier","reactive","rosacea"], climateTriggeredBy: ["heavy_metal_water"] },
  "Sulfate Surfactant":      { label: "Sulfate Surfactants",          description: "Sulfate surfactants that strip the skin barrier.",                                          triggeredBy: ["dry","damaged_barrier","eczema","psoriasis","rosacea","keratosis_pilaris"] },
  "photo-retinoid":          { label: "Photo-Sensitizing Retinoids",  description: "Retinoids that significantly increase sun sensitivity.",                                    triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-AHA":               { label: "Photo-Sensitizing AHAs",       description: "Alpha hydroxy acids that increase UV sensitivity.",                                         triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-BHA":               { label: "Photo-Sensitizing BHAs",       description: "Beta hydroxy acids that increase UV sensitivity.",                                          triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-brightening":       { label: "Photo-Sensitizing Brighteners",description: "Brightening actives that can increase sun sensitivity.",                                    triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
  "photo-botanical":         { label: "Photo-Sensitizing Botanicals", description: "Botanicals with documented photosensitizing potential.",                                    triggeredBy: ["hyperpigmentation_prone","lupus_rash"], climateTriggeredBy: ["high_uv"] },
};

const BENEFIT_GROUP: Record<string, { label: string; description: string }> = {
  "":                  { label: "Neutral",           description: "Reviewed-safe with no specific benefit category — not flagged for any skin type." },
  "humectant":         { label: "Humectants",         description: "Attract and bind water to the skin, improving hydration." },
  "emollient":         { label: "Emollients",         description: "Soften and smooth the skin surface by filling gaps between skin cells." },
  "antioxidant":       { label: "Antioxidants",       description: "Neutralize free radicals to protect against environmental and UV damage." },
  "peptide":           { label: "Peptides",            description: "Amino acid chains that support collagen, elastin, or cell signaling." },
  "brightening":       { label: "Brighteners",        description: "Help fade hyperpigmentation and even overall skin tone." },
  "barrier-support":   { label: "Barrier Support",    description: "Reinforce or restore the skin's natural lipid barrier." },
  "anti-inflammatory": { label: "Anti-Inflammatory",  description: "Calm redness, irritation, or chronic inflammation." },
  "exfoliant":         { label: "Exfoliants",         description: "Promote cell turnover by dissolving or loosening dead skin cells." },
  "sunscreen":         { label: "Sunscreens",         description: "Provide UV protection — the most important anti-aging and protective ingredient class." },
  "prebiotic":         { label: "Prebiotics",         description: "Support the skin microbiome by feeding beneficial bacteria." },
  "probiotic":         { label: "Probiotics",         description: "Live or lysate microorganisms that help balance the skin's microbiome." },
  "retinoid":          { label: "Retinoids",          description: "Vitamin A derivatives that promote cell turnover and collagen production." },
  "soothing":          { label: "Soothing",           description: "Calm and comfort reactive or sensitized skin." },
  "vitamin":           { label: "Vitamins",           description: "Skin-essential vitamins with protective or reparative properties." },
};

const META: Record<string, { title: string; color: string; description: string }> = {
  "universal-concerns": { title: "Universal Concerns",  color: "text-rose-700",  description: "Flagged for all skin types — contact allergens, biocides, sulfate surfactants, formaldehyde releasers, and drying solvents." },
  "my-sensitivities":   { title: "My Sensitivities",    color: "text-amber-700", description: "Ingredients flagged specifically for your skin profile." },
  "neutral-beneficial": { title: "Neutral & Beneficial", color: "text-teal-700",  description: "All reviewed-safe ingredients — neutral (no category) and beneficial (positive category)." },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readProfile() {
  try {
    const st = localStorage.getItem("skindex:skinTypes");
    const cl = localStorage.getItem("skindex:climates");
    return {
      skinTypes: st ? JSON.parse(st) as string[] : [],
      climates:  cl ? JSON.parse(cl) as string[] : [],
    };
  } catch { return { skinTypes: [], climates: [] }; }
}

function buildGroups(items: Item[], slug: string, skinTypes: string[], climates: string[]): Group[] {
  if (slug === "universal-concerns") {
    return UNIVERSAL_GROUPS
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

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rinseOff, setRinseOff] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [skinTypes, setSkinTypes] = useState<string[]>([]);
  const [climates, setClimates] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

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
    setCollapsedGroups(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });
  }

  useEffect(() => {
    const { skinTypes: st, climates: cl } = readProfile();
    setSkinTypes(st);
    setClimates(cl);
    setProfileReady(true);
  }, []);

  useEffect(() => {
    if (!meta || !profileReady || editingProfile) return;
    setLoading(true);
    const params = new URLSearchParams({ list: slug });
    if (skinTypes.length) params.set("skinTypes", skinTypes.join(","));
    if (climates.length) params.set("climates", climates.join(","));
    if (rinseOff) params.set("rinseOff", "true");
    fetch(`/api/ingredient-lists/items?${params}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug, skinTypes, climates, rinseOff, profileReady, editingProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <main className="max-w-2xl mx-auto px-6 pt-[4.5rem] pb-16 text-center">
          <p className="text-gray-400 text-sm">List not found.</p>
          <Link href="/lists" className="text-sm text-gray-700 underline underline-offset-2 mt-4 block">← My Lists</Link>
        </main>
      </div>
    );
  }

  const filtered = q.trim() ? items.filter(i => i.name.toLowerCase().includes(q.trim().toLowerCase())) : items;
  const groups = buildGroups(filtered, slug, skinTypes, climates);

  const groupHeaderColor = slug === "universal-concerns" ? "text-rose-700"
    : slug === "my-sensitivities" ? "text-amber-700"
    : "text-teal-700";

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
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
                        <button key={st} type="button" onClick={() => saveSkinTypes(skinTypes.includes(st) ? skinTypes.filter(s => s !== st) : [...skinTypes, st])}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${skinTypes.includes(st) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                          {SKIN_TYPE_LABELS[st]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700">Climate</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CLIMATE_TYPES.map(({ value, label }) => (
                        <button key={value} type="button" onClick={() => saveClimates(climates.includes(value) ? climates.filter(c => c !== value) : [...climates, value])}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${climates.includes(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700">Water quality</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WATER_TYPES.map(({ value, label }) => (
                        <button key={value} type="button" onClick={() => saveClimates(climates.includes(value) ? climates.filter(c => c !== value) : [...climates, value])}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${climates.includes(value) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => setEditingProfile(false)} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
                    Done
                  </button>
                </div>
              ) : hasProfile ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-0.5">Profile:</span>
                  {skinTypes.map(st => (
                    <span key={st} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SKIN_TYPE_LABELS[st] ?? st}</span>
                  ))}
                  {climates.map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{ALL_CLIMATE.find(t => t.value === c)?.label ?? c}</span>
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
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search ingredients…"
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-400"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
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
                const isCollapsed = collapsedGroups.has(group.cat);
                const benefitColor = group.cat ? "text-teal-700" : "text-gray-500";
                const headerColor = slug === "neutral-beneficial" ? benefitColor : groupHeaderColor;
                return (
                  <div key={group.cat} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.cat)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-medium ${headerColor}`}>{group.label}</span>
                          <span className="text-[10px] text-gray-400">{group.items.length}</span>
                        </div>
                        {group.description && (
                          <p className="text-[11px] text-gray-400 leading-relaxed">{group.description}</p>
                        )}
                        {group.whyFlagged && group.whyFlagged.length > 0 && (
                          <p className="text-[11px] text-amber-600 mt-0.5">Flagged for: {group.whyFlagged.join(", ")}</p>
                        )}
                      </div>
                      <span className="text-gray-300 text-[10px] shrink-0 mt-0.5">{isCollapsed ? "▼" : "▲"}</span>
                    </button>

                    {/* Ingredient rows */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100">
                        {group.items.map(item => {
                          const isExpanded = expandedId === item.id;
                          const secondaryBadge = slug === "universal-concerns" ? "bg-rose-50 text-rose-600"
                            : slug === "my-sensitivities" ? "bg-amber-50 text-amber-600"
                            : item.category ? "bg-teal-50 text-teal-600"
                            : "bg-gray-50 text-gray-500";
                          return (
                            <div key={item.id}>
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                              >
                                <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                                {item.secondary_categories.length > 0 && (
                                  <span className="text-[9px] text-gray-300 shrink-0">+{item.secondary_categories.length} more</span>
                                )}
                                <span className="text-gray-300 text-[10px] shrink-0">{isExpanded ? "▲" : "▼"}</span>
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-3 pt-2 space-y-2 bg-gray-50 border-t border-gray-100">
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.structural_category && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{item.structural_category}</span>
                                    )}
                                    {item.secondary_categories.map(sc => (
                                      <span key={sc} className={`text-[10px] px-2 py-0.5 rounded-full ${secondaryBadge}`}>{sc}</span>
                                    ))}
                                  </div>
                                  {item.explanation ? (
                                    <p className="text-xs text-gray-600 leading-relaxed">{item.explanation}</p>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">No explanation available yet.</p>
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
