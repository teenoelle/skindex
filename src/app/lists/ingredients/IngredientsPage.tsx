"use client";

import { useEffect, useState, useRef } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import IngredientListPicker from "@/components/IngredientListPicker";

type IngredientList = {
  id: string;
  name: string;
  items: string[];
};

type IngDetailItem = {
  id: string;
  name: string;
  status: string;
  category: string;
  structural_category: string | null;
  explanation: string | null;
  explanation_structured: {
    formula_role: string | null;
    benefit: string | null;
    concern: string | null;
    concern_items?: { category: string; text: string }[] | null;
  } | null;
  secondary_categories: string[];
};

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
const CLIMATE_WATER_VALUES = new Set([...CLIMATE_TYPES, ...WATER_TYPES].map(t => t.value));

const SMART_LISTS = [
  {
    id: "universal-concerns",
    name: "Universal Concerns",
    description: "Contact allergens, biocides, sulfate surfactants, and drying solvents flagged for all skin types.",
  },
  {
    id: "my-sensitivities",
    name: "My Sensitivities",
    description: "Ingredients flagged specifically for your skin profile.",
    requiresProfile: true,
  },
  {
    id: "neutral-beneficial",
    name: "Neutral & Beneficial",
    description: "All reviewed-safe ingredients — both neutral (no category) and beneficial (positive category).",
  },
];

const SMART_LIST_COLOR: Record<string, string> = {
  "universal-concerns": "text-rose-700",
  "my-sensitivities":   "text-amber-700",
  "neutral-beneficial": "text-teal-700",
};

const LOOKUP_PROFILE_MAP: Record<string, string[]> = {
  "pore-clogger":            ["oily","acne_prone","fungal_acne","body_acne","keratosis_pilaris"],
  "occlusive":               ["oily","acne_prone","fungal_acne","body_acne","keratosis_pilaris"],
  "bacteria-trap":           ["oily","acne_prone","fungal_acne","body_acne"],
  "sensitizer":              ["reactive","damaged_barrier","eczema","rosacea","psoriasis"],
  "fragrance-allergen":      ["reactive","damaged_barrier","eczema"],
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

export default function IngredientsPage() {
  const { isSignedIn, isLoaded } = useUser();

  const [skinTypes, setSkinTypes] = useState<string[]>([]);
  const [climates, setClimates] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);

  const [builtInOpen, setBuiltInOpen] = useState(true);
  const [rinseOff, setRinseOff] = useState(false);
  const rinseOffMounted = useRef(false);

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [editingListLoading, setEditingListLoading] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [copyListId, setCopyListId] = useState<string | null>(null);
  const [copyFormat, setCopyFormat] = useState<"comma" | "line">("line");

  const [ingredientLists, setIngredientLists] = useState<IngredientList[]>([]);
  const [newIngListName, setNewIngListName] = useState("");
  const [newIngListOpen, setNewIngListOpen] = useState(false);
  const [smartCounts, setSmartCounts] = useState<{
    universalConcerns: { count: number };
    neutralBeneficial: { count: number; neutral: number; beneficial: number };
    mySensitivities: { count: number } | null;
  } | null>(null);
  const [addItemInputs, setAddItemInputs] = useState<Record<string, string>>({});
  const [ingSuggestions, setIngSuggestions] = useState<Record<string, string[]>>({});
  const [pasteListId, setPasteListId] = useState<string | null>(null);
  const [pasteTexts, setPasteTexts] = useState<Record<string, string>>({});
  const suggestDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [expandedIngredients, setExpandedIngredients] = useState<Set<string>>(new Set());
  const [ingredientCache, setIngredientCache] = useState<Map<string, IngDetailItem | null>>(new Map());
  const [ingredientFetching, setIngredientFetching] = useState<Set<string>>(new Set());

  const [lookupOpen, setLookupOpen] = useState(true);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupSuggestions, setLookupSuggestions] = useState<string[]>([]);
  const [lookupItems, setLookupItems] = useState<string[]>([]);
  const [lookupCache, setLookupCache] = useState<Map<string, IngDetailItem | null>>(new Map());
  const [lookupFetching, setLookupFetching] = useState<Set<string>>(new Set());
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comparePairs, setComparePairs] = useState<Map<string, string>>(new Map());
  const [compareActiveFor, setCompareActiveFor] = useState<string | null>(null);
  const [compareQuery, setCompareQuery] = useState<Record<string, string>>({});
  const [compareSuggestions, setCompareSuggestions] = useState<Record<string, string[]>>({});
  const compareDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function toggleIngredientExpand(name: string) {
    setExpandedIngredients(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
    if (!ingredientCache.has(name) && !ingredientFetching.has(name)) {
      setIngredientFetching(prev => new Set([...prev, name]));
      fetch(`/api/ingredient-lists/items?list=lookup&name=${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(d => {
          setIngredientCache(prev => new Map([...prev, [name, d.item ?? null]]));
          setIngredientFetching(prev => { const s = new Set(prev); s.delete(name); return s; });
        })
        .catch(() => {
          setIngredientCache(prev => new Map([...prev, [name, null]]));
          setIngredientFetching(prev => { const s = new Set(prev); s.delete(name); return s; });
        });
    }
  }

  function fetchLookupSuggestions(val: string) {
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    if (val.length < 2) { setLookupSuggestions([]); return; }
    lookupDebounce.current = setTimeout(async () => {
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const d = await res.json();
        setLookupSuggestions(((d.suggestions ?? []) as string[]).slice(0, 6));
      }
    }, 180);
  }

  function lookupIngredient(name: string) {
    setLookupQuery("");
    setLookupSuggestions([]);
    if (lookupItems.includes(name)) return;
    setLookupItems(prev => [name, ...prev]);
    if (!lookupCache.has(name) && !lookupFetching.has(name)) {
      setLookupFetching(prev => new Set([...prev, name]));
      fetch(`/api/ingredient-lists/items?list=lookup&name=${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(d => {
          setLookupCache(prev => new Map([...prev, [name, d.item ?? null]]));
          setLookupFetching(prev => { const s = new Set(prev); s.delete(name); return s; });
        })
        .catch(() => {
          setLookupCache(prev => new Map([...prev, [name, null]]));
          setLookupFetching(prev => { const s = new Set(prev); s.delete(name); return s; });
        });
    }
  }

  function addToIngList(listId: string, ingredientName: string) {
    const val = ingredientName.toLowerCase();
    setIngredientLists(ls => ls.map(l => {
      if (l.id !== listId || l.items.includes(val)) return l;
      const newItems = [...l.items, val];
      dbPatch(listId, { items: newItems });
      return { ...l, items: newItems };
    }));
  }

  function fetchCompareSuggestions(forIngredient: string, val: string) {
    clearTimeout(compareDebounce.current[forIngredient]);
    if (val.length < 2) { setCompareSuggestions(m => ({ ...m, [forIngredient]: [] })); return; }
    compareDebounce.current[forIngredient] = setTimeout(async () => {
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const d = await res.json();
        setCompareSuggestions(m => ({ ...m, [forIngredient]: ((d.suggestions ?? []) as string[]).slice(0, 6) }));
      }
    }, 180);
  }

  function selectComparePair(ingredientA: string, ingredientB: string) {
    if (!lookupItems.includes(ingredientB)) {
      setLookupItems(prev => [...prev, ingredientB]);
      if (!lookupCache.has(ingredientB) && !lookupFetching.has(ingredientB)) {
        setLookupFetching(prev => new Set([...prev, ingredientB]));
        fetch(`/api/ingredient-lists/items?list=lookup&name=${encodeURIComponent(ingredientB)}`)
          .then(r => r.json())
          .then(d => {
            setLookupCache(prev => new Map([...prev, [ingredientB, d.item ?? null]]));
            setLookupFetching(prev => { const s = new Set(prev); s.delete(ingredientB); return s; });
          })
          .catch(() => {
            setLookupCache(prev => new Map([...prev, [ingredientB, null]]));
            setLookupFetching(prev => { const s = new Set(prev); s.delete(ingredientB); return s; });
          });
      }
    }
    setComparePairs(prev => {
      const next = new Map(prev);
      next.set(ingredientA, ingredientB);
      next.set(ingredientB, ingredientA);
      return next;
    });
    setCompareActiveFor(null);
    setCompareQuery(m => ({ ...m, [ingredientA]: "" }));
    setCompareSuggestions(m => ({ ...m, [ingredientA]: [] }));
  }

  function breakComparePair(ingredient: string) {
    setComparePairs(prev => {
      const next = new Map(prev);
      const partner = prev.get(ingredient);
      next.delete(ingredient);
      if (partner) next.delete(partner);
      return next;
    });
  }

  function renderLookupDetail(item: string) {
    const detail = lookupCache.get(item);
    const isFetching = lookupFetching.has(item);
    const structured = detail?.explanation_structured ?? null;
    const isFlagged = detail?.status === "flagged";
    const isUniversal = ["fragrance-allergen","preservative-allergen","formaldehyde releaser","sensitizing preservative","biocide"].includes(detail?.category ?? "");
    const concernBorder = isUniversal ? "border-rose-500" : "border-amber-500";
    const allCats = detail ? [detail.category, ...detail.secondary_categories].filter(Boolean) : [];
    const profileMatchedCats = allCats.filter(cat => {
      const skinTypeSet = new Set(skinTypes);
      const climateSet = new Set(climates);
      if (cat === "Drying Solvent" && (skinTypeSet.has("rosacea") || climateSet.has("heavy_metal_water"))) return true;
      if (["photo-retinoid","photo-AHA","photo-BHA","photo-brightening","photo-botanical"].includes(cat) && climateSet.has("high_uv")) return true;
      return (LOOKUP_PROFILE_MAP[cat] ?? []).some(st => skinTypeSet.has(st));
    });
    if (isFetching) return <p className="text-xs text-gray-400 italic">Loading…</p>;
    if (detail === undefined) return null;
    if (!detail) return <p className="text-xs text-gray-400 italic">Not found in database.</p>;
    return (
      <div className="space-y-2">
        {structured?.formula_role && (
          <div className="pl-3 border-l-2 border-gray-300">
            <p className="text-xs text-gray-500 leading-relaxed">
              {detail.structural_category && <span className="font-semibold text-gray-700">{detail.structural_category} — </span>}
              {structured.formula_role}
            </p>
          </div>
        )}
        {structured?.benefit && (
          <div className="pl-3 border-l-2 border-teal-500">
            <p className="text-xs text-gray-600 leading-relaxed">
              {!isFlagged && detail.category && <span className="font-semibold text-teal-700">{detail.category} — </span>}
              {structured.benefit}
            </p>
          </div>
        )}
        {isFlagged && (structured?.concern_items?.length || structured?.concern || (!structured && detail.explanation)) && (
          <div className={`pl-3 border-l-2 ${concernBorder} space-y-1`}>
            {structured?.concern_items ? structured.concern_items.map(ci => {
              const ciUniversal = ["fragrance-allergen","preservative-allergen","formaldehyde releaser","sensitizing preservative","biocide"].includes(ci.category);
              return (
                <p key={ci.category} className="text-xs text-gray-600 leading-relaxed">
                  <span className={`font-semibold ${ciUniversal ? "text-rose-700" : "text-amber-700"}`}>{ci.category} — </span>
                  {ci.text}
                </p>
              );
            }) : structured?.concern ? (
              <p className="text-xs text-gray-600 leading-relaxed">
                {detail.category && <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{detail.category} — </span>}
                {structured.concern}
              </p>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed">
                {detail.category && <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{detail.category} — </span>}
                {detail.explanation}
              </p>
            )}
          </div>
        )}
        {!isFlagged && !structured && detail.explanation && (
          <div className="pl-3 border-l-2 border-gray-300">
            <p className="text-xs text-gray-600 leading-relaxed">
              {detail.structural_category && <span className="font-semibold text-gray-700">{detail.structural_category} — </span>}
              {detail.explanation}
            </p>
          </div>
        )}
        {!structured && !detail.explanation && (
          <p className="text-xs text-gray-400 italic">No explanation available yet.</p>
        )}
        {profileMatchedCats.length > 0 && (skinTypes.length > 0 || climates.length > 0) && (
          <p className="text-[10px] text-amber-600 leading-snug">
            Flagged for your profile — {profileMatchedCats.join(", ")}
          </p>
        )}
      </div>
    );
  }

  function fetchSmartCounts(skinTypeArr: string[], climateArr: string[], isRinseOff: boolean) {
    const skinTypeSet = new Set(skinTypeArr);
    const climateSet = new Set(climateArr);
    const cats = new Set<string>();
    if (skinTypeSet.has("acne_prone") || skinTypeSet.has("oily") || skinTypeSet.has("fungal_acne") || skinTypeSet.has("body_acne") || skinTypeSet.has("keratosis_pilaris"))
      ["pore-clogger", "occlusive", "bacteria-trap"].forEach(c => cats.add(c));
    if (skinTypeSet.has("reactive") || skinTypeSet.has("damaged_barrier") || skinTypeSet.has("eczema") || skinTypeSet.has("rosacea") || skinTypeSet.has("psoriasis"))
      cats.add("sensitizer");
    if (skinTypeSet.has("reactive") || skinTypeSet.has("damaged_barrier") || skinTypeSet.has("eczema"))
      cats.add("fragrance-allergen");
    if (skinTypeSet.has("rosacea") || skinTypeSet.has("lupus_rash"))
      cats.add("Chemical Sunscreen");
    if (skinTypeSet.has("hyperpigmentation_prone") || skinTypeSet.has("lupus_rash") || climateSet.has("high_uv"))
      ["photo-retinoid", "photo-AHA", "photo-BHA", "photo-brightening", "photo-botanical"].forEach(c => cats.add(c));
    if (skinTypeSet.has("rosacea") || climateSet.has("heavy_metal_water"))
      cats.add("Drying Solvent");
    const params = new URLSearchParams();
    if (skinTypeArr.length) params.set("skinTypes", skinTypeArr.join(","));
    if (climateArr.length) params.set("climates", climateArr.join(","));
    if (cats.size) params.set("concerns", [...cats].join(","));
    if (isRinseOff) params.set("rinseOff", "true");
    const qs = params.toString();
    fetch(`/api/ingredient-lists${qs ? `?${qs}` : ""}`)
      .then(r => r.json())
      .then(d => setSmartCounts(d))
      .catch(() => {});
  }

  useEffect(() => {
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      const cl = localStorage.getItem("skindex:climates");
      const parsedSkinTypes = st ? JSON.parse(st) as string[] : [];
      const parsedClimates = cl ? JSON.parse(cl) as string[] : [];
      if (parsedSkinTypes.length) setSkinTypes(parsedSkinTypes);
      if (parsedClimates.length) setClimates(parsedClimates);
      fetchSmartCounts(parsedSkinTypes, parsedClimates, false);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rinseOffMounted.current) { rinseOffMounted.current = true; return; }
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      const cl = localStorage.getItem("skindex:climates");
      const parsedSkinTypes = st ? JSON.parse(st) as string[] : [];
      const parsedClimates = cl ? JSON.parse(cl) as string[] : [];
      fetchSmartCounts(parsedSkinTypes, parsedClimates, rinseOff);
    } catch {}
  }, [rinseOff]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      try {
        const il = localStorage.getItem("skindex:ingredientLists");
        if (il) setIngredientLists(JSON.parse(il) as IngredientList[]);
      } catch {}
      return;
    }
    fetch("/api/user-ingredient-lists")
      .then(r => r.json())
      .then(async d => {
        const dbLists: IngredientList[] = d.lists ?? [];
        if (dbLists.length > 0) {
          setIngredientLists(dbLists);
        } else {
          try {
            const il = localStorage.getItem("skindex:ingredientLists");
            const local: IngredientList[] = il ? JSON.parse(il) : [];
            if (local.length > 0) {
              const created = await Promise.all(
                local.map(l =>
                  fetch("/api/user-ingredient-lists", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: l.name, items: l.items }),
                  }).then(r => r.json()).then(j => j.list as IngredientList)
                )
              );
              setIngredientLists(created.filter(Boolean));
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    try { localStorage.setItem("skindex:ingredientLists", JSON.stringify(ingredientLists)); } catch {}
  }, [ingredientLists]);

  function fetchIngSuggestions(listId: string, val: string) {
    clearTimeout(suggestDebounce.current[listId]);
    if (val.length < 2) { setIngSuggestions(m => ({ ...m, [listId]: [] })); return; }
    suggestDebounce.current[listId] = setTimeout(async () => {
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const d = await res.json();
        setIngSuggestions(m => ({ ...m, [listId]: ((d.suggestions ?? []) as string[]).slice(0, 6) }));
      }
    }, 180);
  }

  function dbPatch(id: string, body: Record<string, unknown>) {
    if (!isSignedIn) return;
    fetch(`/api/user-ingredient-lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function dbDelete(id: string) {
    if (!isSignedIn) return;
    fetch(`/api/user-ingredient-lists/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function saveEditListName(list: IngredientList) {
    if (!editingListName.trim() || editingListName.trim() === list.name) { setEditingListId(null); return; }
    setEditingListLoading(true);
    const newName = editingListName.trim();
    setIngredientLists(prev => prev.map(l => l.id === list.id ? { ...l, name: newName } : l));
    dbPatch(list.id, { name: newName });
    setEditingListLoading(false);
    setEditingListId(null);
  }

  function toggleClimate(value: string) {
    const next = climates.includes(value) ? climates.filter(c => c !== value) : [...climates, value];
    setClimates(next);
    try {
      const all: string[] = JSON.parse(localStorage.getItem("skindex:climates") ?? "[]");
      const preserved = all.filter(c => !CLIMATE_WATER_VALUES.has(c));
      localStorage.setItem("skindex:climates", JSON.stringify([...preserved, ...next.filter(c => CLIMATE_WATER_VALUES.has(c))]));
    } catch {}
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-2xl mx-auto px-6 py-16 pt-[4.5rem]">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-2xl mx-auto px-6 py-16 pt-[4.5rem] text-center">
          <p className="text-gray-500 mb-4">Sign in to create and view your ingredient lists.</p>
          <SignInButton mode="modal">
            <button className="text-sm text-gray-900 border border-gray-300 rounded-xl px-4 py-2 hover:border-gray-500 transition-colors">
              Sign in
            </button>
          </SignInButton>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-2xl mx-auto px-6 pt-[4.5rem] pb-10">
        {/* Page title + skin profile row */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Ingredient Lists</h1>
          </div>

          {editingProfile ? (
            <div className="border border-gray-200 rounded-xl p-3 space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-700">Skin type</p>
                <div className="flex flex-wrap gap-1.5">
                  {SKIN_TYPE_VALUES.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        const next = skinTypes.includes(st) ? skinTypes.filter(s => s !== st) : [...skinTypes, st];
                        setSkinTypes(next);
                        try { localStorage.setItem("skindex:skinTypes", JSON.stringify(next)); } catch {}
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${skinTypes.includes(st) ? "bg-amber-700 text-white border-amber-700" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}
                    >
                      {SKIN_TYPE_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-700">Climate</p>
                <div className="flex flex-wrap gap-1.5">
                  {CLIMATE_TYPES.map(({ value, label }) => (
                    <button key={value} type="button" onClick={() => toggleClimate(value)}
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
                    <button key={value} type="button" onClick={() => toggleClimate(value)}
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
          ) : skinTypes.length > 0 || climates.filter(c => CLIMATE_WATER_VALUES.has(c)).length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-0.5">Profile:</span>
              {skinTypes.map(st => (
                <span key={st} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SKIN_TYPE_LABELS[st] ?? st}</span>
              ))}
              {climates.filter(c => CLIMATE_WATER_VALUES.has(c)).map(c => (
                <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {[...CLIMATE_TYPES, ...WATER_TYPES].find(t => t.value === c)?.label ?? c}
                </span>
              ))}
              <button type="button" onClick={() => setEditingProfile(true)} className="text-[10px] text-gray-400 hover:text-gray-700 underline underline-offset-2 ml-1">Edit</button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              No skin profile set.{" "}
              <button type="button" onClick={() => setEditingProfile(true)} className="underline underline-offset-2 hover:text-gray-700">Set it here</button>{" "}
              to personalize your ingredient lists.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Smart lists */}
          <div>
            <button
              type="button"
              onClick={() => setBuiltInOpen(v => !v)}
              className="flex items-center gap-2 w-full mb-3"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Built-in Ingredient Lists</p>
              <span className="text-xs text-gray-300 ml-auto">{builtInOpen ? "▲" : "▼"}</span>
            </button>
            {builtInOpen && (
              <div className="space-y-2">
                {SMART_LISTS.map(sl => {
                  const count = sl.id === "universal-concerns" ? smartCounts?.universalConcerns.count
                    : sl.id === "my-sensitivities" ? smartCounts?.mySensitivities?.count
                    : sl.id === "neutral-beneficial" ? smartCounts?.neutralBeneficial.count
                    : undefined;
                  const hasProfile = skinTypes.length > 0 || climates.filter(c => CLIMATE_WATER_VALUES.has(c)).length > 0;
                  return (
                    <div key={sl.id} className="border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/lists/built-in/${sl.id}`} className={`text-sm font-medium leading-snug hover:underline underline-offset-2 ${SMART_LIST_COLOR[sl.id]}`}>{sl.name}</Link>
                        {count !== undefined && (
                          <span className="text-[10px] text-gray-400 ml-auto shrink-0">{count.toLocaleString()}</span>
                        )}
                        <Link href={`/lists/built-in/${sl.id}`} className="text-[10px] text-gray-300 hover:text-gray-500 shrink-0">View →</Link>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {sl.requiresProfile && !hasProfile
                          ? "Set your skin profile above to activate this list."
                          : sl.description}
                      </p>
                      {sl.id === "neutral-beneficial" && smartCounts && (
                        <p className="text-[10px] text-gray-400">
                          {smartCounts.neutralBeneficial.neutral.toLocaleString()} neutral · {smartCounts.neutralBeneficial.beneficial.toLocaleString()} beneficial
                        </p>
                      )}
                      {sl.id === "my-sensitivities" && hasProfile && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[11px] text-gray-400">Product type:</span>
                          {(["Leave-on", "Rinse-off"] as const).map(label => {
                            const isRO = label === "Rinse-off";
                            const active = rinseOff === isRO;
                            return (
                              <button key={label} type="button" onClick={() => setRinseOff(isRO)}
                                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${active ? "bg-gray-800 text-white border-gray-800" : "text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User-created lists */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">My Ingredient Lists</p>
              {!newIngListOpen && (
                <button onClick={() => setNewIngListOpen(true)} className="text-xs text-gray-500 hover:text-gray-800">
                  + New list
                </button>
              )}
            </div>

            {newIngListOpen && (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (!newIngListName.trim()) return;
                  if (isSignedIn) {
                    const res = await fetch("/api/user-ingredient-lists", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newIngListName.trim() }),
                    });
                    const data = await res.json();
                    if (res.ok) setIngredientLists(ls => [...ls, data.list]);
                  } else {
                    setIngredientLists(ls => [
                      ...ls,
                      { id: crypto.randomUUID(), name: newIngListName.trim(), items: [] },
                    ]);
                  }
                  setNewIngListName("");
                  setNewIngListOpen(false);
                }}
                className="border border-gray-200 rounded-xl p-3 space-y-2.5 mb-3"
              >
                <input
                  type="text"
                  value={newIngListName}
                  onChange={e => setNewIngListName(e.target.value)}
                  placeholder="List name…"
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                />
                <p className="text-[11px] text-gray-400">Choose include or exclude when browsing.</p>
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={!newIngListName.trim()}
                    className="ml-auto text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-40"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewIngListOpen(false); setNewIngListName(""); }}
                    className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {ingredientLists.length === 0 && !newIngListOpen ? (
              <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
                <p className="text-xs text-gray-400 mb-3">No custom ingredient lists yet.</p>
                <button onClick={() => setNewIngListOpen(true)} className="text-xs text-gray-700 underline underline-offset-2">
                  Create your first list
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ingredientLists.map(list => (
                  <div key={list.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {editingListId === list.id ? (
                        <form
                          onSubmit={e => { e.preventDefault(); saveEditListName(list); }}
                          className="flex-1 flex gap-1 min-w-0"
                        >
                          <input
                            autoFocus
                            type="text"
                            value={editingListName}
                            onChange={e => setEditingListName(e.target.value)}
                            onKeyDown={e => e.key === "Escape" && setEditingListId(null)}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-gray-400 min-w-0"
                          />
                          <button type="submit" disabled={editingListLoading || !editingListName.trim()} className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0">Save</button>
                          <button type="button" onClick={() => setEditingListId(null)} className="text-xs text-gray-400 hover:text-gray-700 shrink-0">Cancel</button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setEditingListId(list.id); setEditingListName(list.name); }}
                            className="text-sm font-medium text-gray-800 flex-1 leading-snug text-left hover:text-gray-500 transition-colors truncate"
                            title="Click to rename"
                          >
                            {list.name}
                          </button>
                          <span className="text-xs text-gray-400 shrink-0">{list.items.length}</span>
                          <button
                            type="button"
                            title="Copy ingredients"
                            onClick={() => setCopyListId(copyListId === list.id ? null : list.id)}
                            className={`text-[10px] shrink-0 transition-colors ${copyListId === list.id ? "text-gray-700" : "text-gray-300 hover:text-gray-500"}`}
                          >
                            Copy
                          </button>
                          {deletingListId === list.id ? (
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-gray-500">Delete?</span>
                              <button
                                type="button"
                                onClick={() => { setIngredientLists(ls => ls.filter(l => l.id !== list.id)); dbDelete(list.id); setDeletingListId(null); }}
                                className="text-[10px] text-rose-600 hover:text-rose-800"
                              >Yes</button>
                              <button type="button" onClick={() => setDeletingListId(null)} className="text-[10px] text-gray-400 hover:text-gray-700">No</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setDeletingListId(list.id)} className="text-[10px] text-gray-300 hover:text-rose-500 transition-colors shrink-0">Delete</button>
                          )}
                        </>
                      )}
                    </div>

                    {copyListId === list.id && (
                      <div className="border border-gray-100 rounded-xl p-2.5 space-y-2 bg-gray-50">
                        <div className="flex gap-1.5">
                          {(["line", "comma"] as const).map(fmt => (
                            <button key={fmt} type="button" onClick={() => setCopyFormat(fmt)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${copyFormat === fmt ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                              {fmt === "line" ? "One per line" : "Comma-separated"}
                            </button>
                          ))}
                        </div>
                        <textarea
                          readOnly
                          rows={3}
                          value={copyFormat === "comma" ? list.items.join(", ") : list.items.join("\n")}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none text-gray-600 bg-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(copyFormat === "comma" ? list.items.join(", ") : list.items.join("\n")); setCopyListId(null); }}
                          className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
                        >
                          Copy to clipboard
                        </button>
                      </div>
                    )}

                    {list.items.length > 0 && (
                      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                        {list.items.map(item => {
                          const isExpanded = expandedIngredients.has(item);
                          const detail = ingredientCache.get(item);
                          const isFetching = ingredientFetching.has(item);
                          const structured = detail?.explanation_structured ?? null;
                          const isFlagged = detail?.status === "flagged";
                          const isUniversal = ["fragrance-allergen","preservative-allergen","formaldehyde releaser","sensitizing preservative","biocide"].includes(detail?.category ?? "");
                          const concernBorder = isUniversal ? "border-rose-500" : "border-amber-500";
                          return (
                            <div key={item}>
                              <div className="flex items-center px-3 py-2 hover:bg-gray-50 transition-colors">
                                <button type="button" onClick={() => toggleIngredientExpand(item)} className="flex-1 text-left text-xs text-gray-800 leading-snug">{item}</button>
                                <button
                                  onClick={() => {
                                    const newItems = list.items.filter(i => i !== item);
                                    setIngredientLists(ls => ls.map(l => l.id === list.id ? { ...l, items: newItems } : l));
                                    dbPatch(list.id, { items: newItems });
                                  }}
                                  className="text-gray-300 hover:text-rose-400 leading-none px-1.5 text-sm shrink-0"
                                >×</button>
                                <span onClick={() => toggleIngredientExpand(item)} className="text-gray-300 text-[9px] cursor-pointer shrink-0">{isExpanded ? "▲" : "▼"}</span>
                              </div>
                              {isExpanded && (
                                <div className="px-3 pb-3 pt-2 bg-gray-50 border-t border-gray-100 space-y-2">
                                  {isFetching ? (
                                    <p className="text-xs text-gray-400 italic">Loading…</p>
                                  ) : !detail ? (
                                    <p className="text-xs text-gray-400 italic">Not found in database.</p>
                                  ) : (
                                    <>
                                      {structured?.formula_role && (
                                        <div className="pl-3 border-l-2 border-gray-300">
                                          <p className="text-xs text-gray-500 leading-relaxed">
                                            {detail.structural_category && <span className="font-semibold text-gray-700">{detail.structural_category} — </span>}
                                            {structured.formula_role}
                                          </p>
                                        </div>
                                      )}
                                      {structured?.benefit && (
                                        <div className="pl-3 border-l-2 border-teal-500">
                                          <p className="text-xs text-gray-600 leading-relaxed">
                                            {!isFlagged && detail.category && <span className="font-semibold text-teal-700">{detail.category} — </span>}
                                            {structured.benefit}
                                          </p>
                                        </div>
                                      )}
                                      {isFlagged && (structured?.concern_items?.length || structured?.concern || (!structured && detail.explanation)) && (
                                        <div className={`pl-3 border-l-2 ${concernBorder} space-y-1`}>
                                          {structured?.concern_items ? structured.concern_items.map(ci => {
                                            const ciUniversal = ["fragrance-allergen","preservative-allergen","formaldehyde releaser","sensitizing preservative","biocide"].includes(ci.category);
                                            return (
                                              <p key={ci.category} className="text-xs text-gray-600 leading-relaxed">
                                                <span className={`font-semibold ${ciUniversal ? "text-rose-700" : "text-amber-700"}`}>{ci.category} — </span>
                                                {ci.text}
                                              </p>
                                            );
                                          }) : structured?.concern ? (
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                              {detail.category && <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{detail.category} — </span>}
                                              {structured.concern}
                                            </p>
                                          ) : (
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                              {detail.category && <span className={`font-semibold ${isUniversal ? "text-rose-700" : "text-amber-700"}`}>{detail.category} — </span>}
                                              {detail.explanation}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      {!isFlagged && !structured && detail.explanation && (
                                        <div className="pl-3 border-l-2 border-gray-300">
                                          <p className="text-xs text-gray-600 leading-relaxed">
                                            {detail.structural_category && <span className="font-semibold text-gray-700">{detail.structural_category} — </span>}
                                            {detail.explanation}
                                          </p>
                                        </div>
                                      )}
                                      {!structured && !detail.explanation && (
                                        <p className="text-xs text-gray-400 italic">No explanation available yet.</p>
                                      )}
                                      {ingredientLists.filter(l => l.id !== list.id).length > 0 && (
                                        <div className="pt-1">
                                          <IngredientListPicker
                                            ingredientName={item}
                                            lists={ingredientLists.filter(l => l.id !== list.id)}
                                            onAdd={listId => addToIngList(listId, item)}
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {pasteListId === list.id ? (
                      <div className="space-y-1.5 pt-1 border-t border-gray-100">
                        <p className="text-[11px] text-gray-400">Paste names — one per line or comma-separated</p>
                        <textarea
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400 resize-none"
                          rows={3}
                          value={pasteTexts[list.id] ?? ""}
                          onChange={e => setPasteTexts(m => ({ ...m, [list.id]: e.target.value }))}
                          placeholder="niacinamide, fragrance, alcohol denat…"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <button
                            className="text-xs px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                            onClick={() => {
                              const raw = pasteTexts[list.id] ?? "";
                              const items = raw.split(/[,\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
                              if (items.length > 0) {
                                const newItems = [...new Set([...list.items, ...items])];
                                setIngredientLists(ls => ls.map(l => l.id === list.id ? { ...l, items: newItems } : l));
                                dbPatch(list.id, { items: newItems });
                              }
                              setPasteTexts(m => ({ ...m, [list.id]: "" }));
                              setPasteListId(null);
                            }}
                          >
                            Add {(pasteTexts[list.id] ?? "").split(/[,\n]+/).filter(s => s.trim()).length || ""}
                          </button>
                          <button
                            className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                            onClick={() => { setPasteListId(null); setPasteTexts(m => ({ ...m, [list.id]: "" })); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-gray-100 space-y-1.5">
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            const val = (addItemInputs[list.id] ?? "").trim().toLowerCase();
                            if (!val || list.items.includes(val)) return;
                            const newItems = [...list.items, val];
                            setIngredientLists(ls => ls.map(l => l.id === list.id ? { ...l, items: newItems } : l));
                            dbPatch(list.id, { items: newItems });
                            setAddItemInputs(m => ({ ...m, [list.id]: "" }));
                            setIngSuggestions(m => ({ ...m, [list.id]: [] }));
                          }}
                          className="flex gap-1.5 relative"
                        >
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={addItemInputs[list.id] ?? ""}
                              onChange={e => {
                                const v = e.target.value;
                                setAddItemInputs(m => ({ ...m, [list.id]: v }));
                                fetchIngSuggestions(list.id, v);
                              }}
                              onBlur={() => setTimeout(() => setIngSuggestions(m => ({ ...m, [list.id]: [] })), 150)}
                              placeholder="Add ingredient…"
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400"
                            />
                            {(ingSuggestions[list.id] ?? []).length > 0 && (
                              <ul className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden text-xs">
                                {(ingSuggestions[list.id] ?? []).map(s => (
                                  <li key={s}>
                                    <button
                                      type="button"
                                      onMouseDown={e => e.preventDefault()}
                                      onClick={() => {
                                        const val = s.toLowerCase();
                                        if (!list.items.includes(val)) {
                                          const newItems = [...list.items, val];
                                          setIngredientLists(ls => ls.map(l => l.id === list.id ? { ...l, items: newItems } : l));
                                          dbPatch(list.id, { items: newItems });
                                        }
                                        setAddItemInputs(m => ({ ...m, [list.id]: "" }));
                                        setIngSuggestions(m => ({ ...m, [list.id]: [] }));
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 truncate"
                                    >
                                      {s}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <button
                            type="submit"
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 shrink-0"
                          >
                            Add
                          </button>
                        </form>
                        <button
                          type="button"
                          className="text-[11px] text-gray-400 hover:text-gray-600"
                          onClick={() => setPasteListId(list.id)}
                        >
                          + Paste multiple
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ingredient Lookup */}
          <div>
            <button
              type="button"
              onClick={() => setLookupOpen(v => !v)}
              className="flex items-center gap-2 w-full mb-3"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Ingredient Lookup</p>
              <span className="text-xs text-gray-300 ml-auto">{lookupOpen ? "▲" : "▼"}</span>
            </button>
            {lookupOpen && (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={e => { setLookupQuery(e.target.value); fetchLookupSuggestions(e.target.value); }}
                    onBlur={() => setTimeout(() => setLookupSuggestions([]), 150)}
                    placeholder="Search any ingredient…"
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-400"
                  />
                  {lookupSuggestions.length > 0 && (
                    <ul className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-xs">
                      {lookupSuggestions.map(s => (
                        <li key={s}>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => lookupIngredient(s)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 truncate"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {lookupItems.length > 0 && (
                  <div>
                    <div className="flex justify-end mb-1">
                      <button
                        type="button"
                        onClick={() => { setLookupItems([]); setComparePairs(new Map()); setCompareActiveFor(null); }}
                        className="text-[10px] text-gray-400 hover:text-gray-700"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const rendered = new Set<string>();
                        return lookupItems.map(item => {
                          if (rendered.has(item)) return null;
                          const partner = comparePairs.get(item);
                          const showCompare = !!partner && lookupItems.includes(partner);
                          if (showCompare) {
                            rendered.add(item);
                            rendered.add(partner!);
                            return (
                              <div key={`cmp::${item}`} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Comparing</span>
                                  <button type="button" onClick={() => breakComparePair(item)} className="text-[10px] text-gray-400 hover:text-gray-700">Split ↗</button>
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                  {[item, partner!].map(col => (
                                    <div key={col} className="p-3 space-y-2 min-w-0">
                                      <div className="flex items-start gap-1.5 min-w-0">
                                        <span className="text-xs font-medium text-gray-800 flex-1 min-w-0 leading-snug break-words">{col}</span>
                                        <button
                                          type="button"
                                          onClick={() => { breakComparePair(col); setLookupItems(prev => prev.filter(i => i !== col)); }}
                                          className="text-gray-300 hover:text-rose-400 text-sm leading-none shrink-0"
                                        >×</button>
                                      </div>
                                      {renderLookupDetail(col)}
                                      <IngredientListPicker
                                        ingredientName={col}
                                        lists={ingredientLists}
                                        onAdd={listId => addToIngList(listId, col)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={item} className="border border-gray-200 rounded-xl px-3 py-3 space-y-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-medium text-gray-800 flex-1 min-w-0 truncate">{item}</span>
                                {compareActiveFor === item ? (
                                  <button type="button" onClick={() => setCompareActiveFor(null)} className="text-[10px] text-gray-400 hover:text-gray-700 whitespace-nowrap shrink-0">Cancel</button>
                                ) : (
                                  <button type="button" onClick={() => { setCompareActiveFor(item); setCompareQuery(m => ({ ...m, [item]: "" })); setCompareSuggestions(m => ({ ...m, [item]: [] })); }} className="text-[10px] text-gray-400 hover:text-gray-700 whitespace-nowrap shrink-0">Compare →</button>
                                )}
                                <IngredientListPicker ingredientName={item} lists={ingredientLists} onAdd={listId => addToIngList(listId, item)} />
                                <button type="button" onClick={() => { if (compareActiveFor === item) setCompareActiveFor(null); setLookupItems(prev => prev.filter(i => i !== item)); }} className="text-gray-300 hover:text-rose-400 text-sm leading-none shrink-0">×</button>
                              </div>
                              {compareActiveFor === item && (
                                <div className="relative">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={compareQuery[item] ?? ""}
                                    onChange={e => { setCompareQuery(m => ({ ...m, [item]: e.target.value })); fetchCompareSuggestions(item, e.target.value); }}
                                    onBlur={() => setTimeout(() => setCompareSuggestions(m => ({ ...m, [item]: [] })), 150)}
                                    placeholder="Search ingredient to compare…"
                                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                                  />
                                  {(compareSuggestions[item] ?? []).length > 0 && (
                                    <ul className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-xs">
                                      {(compareSuggestions[item] ?? []).map(s => (
                                        <li key={s}>
                                          <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => selectComparePair(item, s)}
                                            className="w-full text-left px-3 py-2 hover:bg-gray-50 truncate"
                                          >{s}</button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                              {renderLookupDetail(item)}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
