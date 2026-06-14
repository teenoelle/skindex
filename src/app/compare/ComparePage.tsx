"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSkinProfile } from "@/context/SkinProfileContext";
import { splitIngredientList } from "@/lib/scanner";
import { UNIVERSAL_CONCERN_SET } from "@/lib/concern-breakdown";
import type { DbIngredient, ExplanationStructured, SkinClimateNote } from "@/types";
import { SKIN_TYPES, ALL_MODIFIER_TYPES, type SkinType, type ClimateType } from "@/lib/skin-profile";

const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Copied from Scanner.tsx — kept in sync manually
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

type SearchResult = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
};

type LinkedIngredient = { position: number; ingredient: DbIngredient | null };

type CompareProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  iherb_url: string | null;
  ingredient_list: string | null;
  linked: LinkedIngredient[];
};

function productSlug(p: { brand: string | null; name: string; id: string }) {
  const parts = [p.brand, p.name].filter(Boolean).join(" ");
  return `${parts.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${p.id}`;
}

function normalizeIngName(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
}

function noteLabel(n: SkinClimateNote): string {
  const skinLabels = n.dimensions.map(d => SKIN_TYPES.find(s => s.value === d)?.label ?? d);
  const climateLabels = n.climate.map(c => ALL_MODIFIER_TYPES.find(t => t.value === c)?.label ?? c);
  return [...skinLabels, ...climateLabels].join(", ");
}

function InlineSearch({ onSelect, onCancel }: {
  onSelect: (p: SearchResult) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const d = await res.json();
          setResults(d.products ?? []);
        }
      } catch {}
    }, 200);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        onKeyDown={e => e.key === "Escape" && onCancel()}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setTimeout(() => setResults([]), 150);
        }}
        placeholder="Search product…"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="w-full text-xs border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-gray-400 bg-white"
      />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={onCancel}
        aria-label="Cancel"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-base leading-none"
      >×</button>
      {results.length > 0 && (
        <ul className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[220px]">
          {results.slice(0, 6).map(p => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-7 h-7 rounded-md object-cover border border-gray-100 shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-gray-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-gray-800 truncate">{p.name}</p>
                  {p.brand && <p className="text-[10px] text-gray-400 truncate">{p.brand}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductSearchSlot({
  slotIndex,
  onSelect,
}: {
  slotIndex: number;
  onSelect: (p: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const d = await res.json();
          setResults(d.products ?? []);
        }
      } catch {}
    }, 200);
  }

  function handleSelect(p: SearchResult) {
    setSelected(p);
    setQuery("");
    setResults([]);
    onSelect(p);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Product {slotIndex + 1}</p>

      {selected ? (
        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50">
          {selected.image_url && (
            <img
              src={selected.image_url}
              alt={selected.name}
              className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 leading-snug">{selected.name}</p>
            {selected.brand && <p className="text-xs text-gray-400">{selected.brand}</p>}
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-gray-300 hover:text-gray-500 text-lg leading-none shrink-0"
            aria-label="Clear"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => search(e.target.value)}
            onBlur={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              setTimeout(() => setResults([]), 150);
            }}
            placeholder="Search product…"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={slotIndex === 0}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-400 bg-white"
          />
          {results.length > 0 && (
            <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {results.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSelect(p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{p.name}</p>
                      {p.brand && <p className="text-xs text-gray-400 truncate">{p.brand}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function IngredientExplanation({ ing, profileMatch, activeSkinTypes, activeClimates }: {
  ing: DbIngredient;
  profileMatch: boolean;
  activeSkinTypes: Set<SkinType>;
  activeClimates: Set<ClimateType>;
}) {
  const s = ing.explanation_structured as ExplanationStructured | null;
  const isFlagged = ing.status === "flagged";
  const isUniversal = UNIVERSAL_CONCERN_SET.has(ing.flagged_category ?? "");
  const concernBorder = isUniversal ? "border-rose-400" : profileMatch ? "border-amber-400" : "border-orange-300";

  const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;
  const allNotes: SkinClimateNote[] = Array.isArray(ing.skin_climate_notes) ? ing.skin_climate_notes : [];
  const matchesNote = (n: SkinClimateNote) =>
    n.dimensions.some(d => activeSkinTypes.has(d as SkinType)) ||
    n.climate.some(c => activeClimates.has(c as ClimateType));
  const profileBenefitNotes = hasProfile ? allNotes.filter(n => n.sentiment === "benefit" && matchesNote(n)) : [];
  const profileCautionNotes = hasProfile ? allNotes.filter(n => (n.sentiment === "caution" || n.sentiment === "strong_caution") && matchesNote(n)) : [];

  const benefitProfilesSuffix = s?.benefit_profiles?.length ? ` · ${s.benefit_profiles.join(", ")}` : "";
  const benefitHeader = !isFlagged
    ? (ing.category ? `${ing.category}${benefitProfilesSuffix}` : (s?.benefit_category ? `${s.benefit_category}${benefitProfilesSuffix}` : null))
    : null;

  const concernProfilesSuffix = s?.concern_profiles?.length ? ` · ${s.concern_profiles.join(", ")}` : "";

  return (
    <div className="space-y-1.5 mt-1.5">
      {s?.formula_role && (
        <div className="pl-2 border-l-2 border-gray-200">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {ing.structural_category && <span className="font-semibold text-gray-600">{ing.structural_category} — </span>}
            {s.formula_role}
          </p>
        </div>
      )}
      {(s?.benefit || profileBenefitNotes.length > 0) && (
        <div className="pl-2 border-l-2 border-teal-400 space-y-0.5">
          {s?.benefit && (
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {benefitHeader && <span className="font-semibold text-teal-700">{benefitHeader} — </span>}
              {s.benefit}
            </p>
          )}
          {profileBenefitNotes.map((note, i) => (
            <p key={i} className="text-[11px] text-gray-600 leading-relaxed">
              <span className="font-semibold text-teal-700">{noteLabel(note)} — </span>
              {note.text}
            </p>
          ))}
        </div>
      )}
      {isFlagged && (s?.concern_items?.length || s?.concern || (!s && ing.explanation) || profileCautionNotes.length > 0) && (
        <div className={`pl-2 border-l-2 ${concernBorder} space-y-1`}>
          {s?.concern_items ? s.concern_items.map((ci) => {
            const ciUniversal = UNIVERSAL_CONCERN_SET.has(ci.category);
            return (
              <p key={ci.category} className="text-[11px] text-gray-600 leading-relaxed">
                <span className={`font-semibold ${ciUniversal ? "text-rose-700" : "text-amber-700"}`}>{ci.category} — </span>
                {ci.text}
              </p>
            );
          }) : s?.concern ? (
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {ing.flagged_category && <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{ing.flagged_category}{concernProfilesSuffix} — </span>}
              {s.concern}
            </p>
          ) : (
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {ing.flagged_category && <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{ing.flagged_category}{concernProfilesSuffix} — </span>}
              {ing.explanation}
            </p>
          )}
          {profileCautionNotes.map((note, i) => (
            <p key={i} className="text-[11px] text-gray-600 leading-relaxed">
              <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{noteLabel(note)} — </span>
              {note.text}
            </p>
          ))}
        </div>
      )}
      {!isFlagged && !s && ing.explanation && (
        <div className="pl-2 border-l-2 border-gray-200">
          <p className="text-[11px] text-gray-600 leading-relaxed">
            {ing.structural_category && <span className="font-semibold text-gray-600">{ing.structural_category} — </span>}
            {ing.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ComparePageClient({ ids }: { ids: string }) {
  const { activeSkinTypes, activeClimates } = useSkinProfile();
  const router = useRouter();
  const [products, setProducts] = useState<CompareProduct[] | null>(null);
  const [loading, setLoading] = useState(!!ids);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [emptySlots, setEmptySlots] = useState<(SearchResult | null)[]>([null, null]);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!ids) { setLoading(false); return; }
    const rawIds = ids.split(",").map(seg => seg.match(UUID_RE)?.[1] ?? seg).filter(Boolean);
    if (rawIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/compare?ids=${encodeURIComponent(rawIds.join(","))}`)
      .then(r => r.json())
      .then(d => { setProducts(d.products ?? null); setLoading(false); })
      .catch(() => { setError("Failed to load products."); setLoading(false); });
  }, [ids]);

  const nameMaps = useMemo(() => {
    if (!products) return [];
    return products.map(p => {
      const m = new Map<string, DbIngredient>();
      for (const l of p.linked) {
        if (!l.ingredient) continue;
        const ing = l.ingredient as DbIngredient;
        m.set(ing.name.toLowerCase(), ing);
        if (ing.inci_name) m.set(ing.inci_name.toLowerCase(), ing);
        m.set(normalizeIngName(ing.name), ing);
      }
      return m;
    });
  }, [products]);

  const presenceCount = useMemo(() => {
    if (!products) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const p of products) {
      for (const l of p.linked) {
        if (l.ingredient?.id) {
          counts.set(l.ingredient.id, (counts.get(l.ingredient.id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [products]);

  function lookupIng(rawName: string, nameMap: Map<string, DbIngredient>): DbIngredient | null {
    const lower = rawName.toLowerCase();
    return nameMap.get(lower) ?? nameMap.get(normalizeIngName(rawName)) ?? null;
  }

  function toggleExpand(key: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }

  function handleSwap(fromIdx: number, toIdx: number) {
    if (!products) return;
    const reordered = [...products];
    [reordered[fromIdx], reordered[toIdx]] = [reordered[toIdx], reordered[fromIdx]];
    router.push(`/compare?ids=${reordered.map(p => productSlug(p)).join(",")}`);
  }

  function handleChangeProduct(slotIdx: number, result: SearchResult) {
    if (!products) return;
    setEditingSlot(null);
    const slugs = products.map(p => productSlug(p));
    slugs[slotIdx] = productSlug(result);
    router.push(`/compare?ids=${slugs.join(",")}`);
  }

  function handleAddProduct(result: SearchResult) {
    if (!products || products.length >= 4) return;
    setEditingSlot(null);
    const slugs = [...products.map(p => productSlug(p)), productSlug(result)];
    router.push(`/compare?ids=${slugs.join(",")}`);
  }

  function handleSlotSelect(slotIdx: number, product: SearchResult) {
    const newSlots = [...emptySlots];
    newSlots[slotIdx] = product;
    setEmptySlots(newSlots);
    const filled = newSlots.filter(Boolean) as SearchResult[];
    if (filled.length >= 2) {
      router.push(`/compare?ids=${filled.map(p => productSlug(p)).join(",")}`);
    }
  }

  const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

  if (!ids) {
    return (
      <div className="pt-14 bg-white">
        <div className="px-6 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-400">Choose two products to compare their ingredients side by side.</p>
        </div>
        <div className="grid grid-cols-2">
          {[0, 1].map(i => (
            <div key={i} className={`p-6${i === 1 ? " border-l border-gray-100" : ""}`}>
              <ProductSearchSlot slotIndex={i} onSelect={p => handleSlotSelect(i, p)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="pt-14 min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );

  if (error || !products || products.length === 0) return (
    <div className="pt-14 min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-400">{error ?? "No products found."}</p>
    </div>
  );

  const colCount = products.length;
  const colClass = `grid-cols-${colCount}`;
  const maxWClass = colCount === 2 ? "max-w-2xl" : colCount === 3 ? "max-w-4xl" : "max-w-6xl";

  return (
    <div className="pt-14 bg-white">
      {/* Shared sticky header — image, brand+controls, name */}
      <div className="sticky top-14 z-10 bg-white border-b border-gray-100 relative">
        <div className={`${maxWClass} mx-auto grid ${colClass}`}>
          {products.map((p, idx) => (
            <div key={p.id} className="border-r border-gray-200 last:border-r-0 px-3 py-2.5">
              {editingSlot === idx ? (
                <InlineSearch onSelect={r => handleChangeProduct(idx, r)} onCancel={() => setEditingSlot(null)} />
              ) : (
                <div className="flex gap-2 items-start min-w-0">
                  {p.image_url && (
                    <a
                      href={p.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg overflow-hidden border border-gray-100 hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-shadow"
                    >
                      <img src={p.image_url} alt={p.name} className="w-9 h-9 object-cover block" />
                    </a>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 mb-0.5">
                      {p.brand && <p className="text-[10px] text-gray-400 leading-tight truncate flex-1 min-w-0">{p.brand}</p>}
                      <button
                        type="button"
                        onClick={() => setEditingSlot(idx)}
                        className="shrink-0 text-[10px] text-gray-400 hover:text-gray-600"
                      >Change</button>
                      <button
                        type="button"
                        onClick={() => handleSwap(idx, idx - 1)}
                        disabled={idx === 0}
                        aria-label="Move left"
                        className="shrink-0 text-[11px] text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:pointer-events-none"
                      >←</button>
                      <button
                        type="button"
                        onClick={() => handleSwap(idx, idx + 1)}
                        disabled={idx === colCount - 1}
                        aria-label="Move right"
                        className="shrink-0 text-[11px] text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:pointer-events-none"
                      >→</button>
                      <a
                        href={`/product/${productSlug(p)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View product page"
                        className="shrink-0 text-[10px] text-gray-300 hover:text-gray-600"
                      >↗</a>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-3">{p.name}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {colCount < 4 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
            {editingSlot === colCount ? (
              <div className="w-52 bg-white rounded-lg shadow border border-gray-200 p-1.5">
                <InlineSearch onSelect={r => handleAddProduct(r)} onCancel={() => setEditingSlot(null)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingSlot(colCount)}
                className="text-[11px] text-gray-400 hover:text-gray-600 whitespace-nowrap bg-white"
              >
                + Add
              </button>
            )}
          </div>
        )}
      </div>

      {/* Column area — scrolls with the page */}
      <div className={`${maxWClass} mx-auto grid ${colClass}`}>
        {products.map((p, colIdx) => {
          const nameMap = nameMaps[colIdx] ?? new Map();
          const rawItems = splitIngredientList(p.ingredient_list ?? "");

          let universalCount = 0, profileOnlyCount = 0, otherFlaggedCount = 0;
          for (const l of p.linked) {
            const ing = l.ingredient as DbIngredient | null;
            if (!ing || ing.status !== "flagged") continue;
            const fc = ing.flagged_category ?? "";
            const isUniv = UNIVERSAL_CONCERN_SET.has(fc);
            const allCats = [fc, ...(ing.secondary_flagged_categories ?? [])].filter(Boolean);
            const isProf = hasProfile && allCats.some(c => isFcProfileMatch(c, activeSkinTypes, activeClimates));
            if (isUniv) universalCount++;
            else if (isProf) profileOnlyCount++;
            else otherFlaggedCount++;
          }
          const flaggedCount = universalCount + profileOnlyCount + otherFlaggedCount;
          const neutralCount = rawItems.length - flaggedCount;

          return (
            <div key={p.id} className="border-r border-gray-200 last:border-r-0">
              {/* Non-sticky intro — type, iHerb, stats (scrolls away) */}
              {(p.type || p.iherb_url || flaggedCount > 0 || rawItems.length > 0) && (
                <div className="px-3 py-2 space-y-1 border-b border-gray-100">
                  {(p.type || p.iherb_url) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {p.type && (
                        <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{p.type}</span>
                      )}
                      {p.iherb_url && (
                        <a
                          href={p.iherb_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:underline underline-offset-2"
                        >
                          iHerb ↗
                        </a>
                      )}
                    </div>
                  )}
                  {rawItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                      {universalCount > 0 && <span className="text-rose-700">{universalCount} universal</span>}
                      {universalCount > 0 && (profileOnlyCount > 0 || otherFlaggedCount > 0 || neutralCount > 0) && <span className="text-gray-300">·</span>}
                      {profileOnlyCount > 0 && <span className="text-amber-700">{profileOnlyCount} profile</span>}
                      {profileOnlyCount > 0 && (otherFlaggedCount > 0 || neutralCount > 0) && <span className="text-gray-300">·</span>}
                      {otherFlaggedCount > 0 && <span className="text-orange-700">{otherFlaggedCount} other</span>}
                      {otherFlaggedCount > 0 && neutralCount > 0 && <span className="text-gray-300">·</span>}
                      {neutralCount > 0 && <span className="text-gray-400">{neutralCount} neutral</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Ingredient list */}
              <div className="divide-y divide-gray-50">
                {rawItems.map((rawName, idx) => {
                  const ing = lookupIng(rawName, nameMap) as DbIngredient | null;
                  const isFlagged = ing?.status === "flagged";
                  const fc = ing?.flagged_category ?? "";
                  const isUniversal = UNIVERSAL_CONCERN_SET.has(fc);
                  const allCats = ing ? [fc, ...(ing.secondary_flagged_categories ?? [])].filter(Boolean) : [];
                  const profileMatch = hasProfile && allCats.some(c => isFcProfileMatch(c, activeSkinTypes, activeClimates));
                  const hasBenefit = !isFlagged && (ing?.category || ing?.explanation_structured?.benefit);
                  const expandKey = `${p.id}::${idx}`;
                  const isExpanded = expanded.has(expandKey);
                  const isExclusive = ing?.id ? presenceCount.get(ing.id) === 1 : false;
                  const isPartial = ing?.id ? (presenceCount.get(ing.id) ?? 0) > 1 && (presenceCount.get(ing.id) ?? 0) < products.length : false;

                  const nameColor = ing ? "text-gray-800" : "text-gray-400";

                  return (
                    <div key={expandKey} className={isExclusive ? "bg-amber-50/60" : ""}>
                      <button
                        type="button"
                        onClick={() => ing && toggleExpand(expandKey)}
                        className={`w-full text-left px-3 py-1.5 flex items-baseline gap-2 ${ing ? "hover:bg-gray-50" : ""} transition-colors`}
                      >
                        <span className="text-[10px] text-gray-300 shrink-0 w-5 text-right">{idx + 1}</span>
                        <span className={`text-xs leading-snug flex-1 ${nameColor}`}>{rawName}</span>
                        {isExclusive && (
                          <span className="text-[9px] text-amber-500 shrink-0" title="Only in this product">◆</span>
                        )}
                        {isPartial && !isExclusive && (
                          <span className="text-[9px] text-gray-300 shrink-0" title="Not in all products">◇</span>
                        )}
                        {isFlagged && fc && (
                          <span className={`text-[10px] shrink-0 ${isUniversal ? "text-rose-700" : profileMatch ? "text-amber-700" : "text-orange-700"}`}>
                            {fc.length > 18 ? fc.slice(0, 18) + "…" : fc}
                          </span>
                        )}
                        {hasBenefit && ing?.category && (
                          <span className="text-[10px] text-teal-700 shrink-0">
                            {ing.category.length > 18 ? ing.category.slice(0, 18) + "…" : ing.category}
                          </span>
                        )}
                      </button>
                      {isExpanded && ing && (
                        <div className="px-3 pb-2 bg-gray-50/80 border-t border-gray-100">
                          <IngredientExplanation ing={ing} profileMatch={profileMatch} activeSkinTypes={activeSkinTypes} activeClimates={activeClimates} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {rawItems.length === 0 && (
                  <p className="text-xs text-gray-400 italic px-4 py-3">No ingredient list available.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend strip */}
      <div className="border-t border-gray-100">
        <div className={`${maxWClass} mx-auto px-4 h-8 flex items-center`}>
          <p className="text-[11px] text-gray-400">◆ only in this product · ◇ not in all · click ingredient for details</p>
        </div>
      </div>
    </div>
  );
}
