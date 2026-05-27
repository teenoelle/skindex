"use client";

import { useEffect, useState, useRef } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type UserList = {
  id: string;
  name: string;
  is_public: boolean;
  itemCount: number;
  created_at: string;
};

type IngredientList = {
  id: string;
  name: string;
  type?: "avoid" | "want";
  items: string[];
};

type Tab = "products" | "ingredients";

const SKIN_TYPE_LABELS: Record<string, string> = {
  oily: "Oily", dry: "Dry", reactive: "Reactive", damaged_barrier: "Damaged barrier",
  acne_prone: "Acne", mature: "Mature", hyperpigmentation_prone: "Hyperpigmentation",
  fungal_acne: "Fungal acne", rosacea: "Rosacea", seborrheic: "Seborrheic",
  eczema: "Eczema", psoriasis: "Psoriasis", lupus_rash: "Lupus rash",
  keratosis_pilaris: "Keratosis pilaris", body_acne: "Body acne",
};

const SKIN_TYPE_VALUES = Object.keys(SKIN_TYPE_LABELS);

const SMART_LISTS = [
  {
    id: "universal-concerns",
    name: "Avoid: Universal Concerns",
    description: "Contact allergens, biocides, sulfate surfactants, and drying solvents flagged for all skin types.",
    type: "avoid" as const,
  },
  {
    id: "my-sensitivities",
    name: "Avoid: My Sensitivities",
    description: "Ingredients flagged specifically for your skin profile. Update your profile on the home page to change this list.",
    type: "avoid" as const,
    requiresProfile: true,
  },
  {
    id: "neutral-beneficial",
    name: "Want: Neutral & Beneficial",
    description: "All reviewed-safe ingredients — both neutral (no category) and beneficial (positive category). Profile-filtered to hide anything that conflicts with your skin types.",
    type: "want" as const,
  },
];

export default function ListsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("products");

  // Product lists
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Profile (from localStorage)
  const [skinTypes, setSkinTypes] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);

  // Ingredient lists (localStorage)
  const [ingredientLists, setIngredientLists] = useState<IngredientList[]>([]);
  const [newIngListName, setNewIngListName] = useState("");
  const [newIngListOpen, setNewIngListOpen] = useState(false);
  // type field is no longer set on new lists; browse-time include/exclude toggle replaces it
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

  useEffect(() => {
    if (!isLoaded || !isSignedIn) { setLoading(false); return; }
    fetch("/api/lists").then((r) => r.json()).then((d) => { setLists(d.lists ?? []); setLoading(false); });
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      if (st) setSkinTypes(JSON.parse(st) as string[]);
      const il = localStorage.getItem("skindex:ingredientLists");
      if (il) setIngredientLists(JSON.parse(il) as IngredientList[]);

      const parsed = st ? JSON.parse(st) as string[] : [];
      const stParam = parsed.length > 0 ? `?skinTypes=${parsed.join(",")}` : "";
      fetch(`/api/ingredient-lists${stParam}`)
        .then((r) => r.json())
        .then((d) => setSmartCounts(d))
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("skindex:ingredientLists", JSON.stringify(ingredientLists)); } catch {}
  }, [ingredientLists]);

  function fetchIngSuggestions(listId: string, val: string) {
    clearTimeout(suggestDebounce.current[listId]);
    if (val.length < 2) { setIngSuggestions((m) => ({ ...m, [listId]: [] })); return; }
    suggestDebounce.current[listId] = setTimeout(async () => {
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const d = await res.json();
        setIngSuggestions((m) => ({
          ...m,
          [listId]: ((d.results ?? []) as { name: string }[]).map((r) => r.name).slice(0, 6),
        }));
      }
    }, 180);
  }

  async function createList() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) { setLists((prev) => [data.list, ...prev]); setNewName(""); setCreateOpen(false); }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <main className="max-w-2xl mx-auto px-6 py-16 pt-[4.5rem]">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <main className="max-w-2xl mx-auto px-6 py-16 pt-[4.5rem] text-center">
          <p className="text-gray-500 mb-4">Sign in to create and view your lists.</p>
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
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-6 pt-[4.5rem] pb-10">
        {/* Page title + skin profile row */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Lists</h1>
          </div>

          {/* Mini skin profile chips */}
          {editingProfile ? (
            <div className="border border-gray-200 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-medium text-gray-700">Skin types</p>
              <div className="flex flex-wrap gap-1.5">
                {SKIN_TYPE_VALUES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      const next = skinTypes.includes(st) ? skinTypes.filter(s => s !== st) : [...skinTypes, st];
                      setSkinTypes(next);
                      try { localStorage.setItem("skindex:skinTypes", JSON.stringify(next)); } catch {}
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      skinTypes.includes(st)
                        ? "bg-amber-700 text-white border-amber-700"
                        : "text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {SKIN_TYPE_LABELS[st]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2"
              >
                Done
              </button>
            </div>
          ) : skinTypes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-0.5">Profile:</span>
              {skinTypes.map((st) => (
                <span key={st} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {SKIN_TYPE_LABELS[st] ?? st}
                </span>
              ))}
              <button type="button" onClick={() => setEditingProfile(true)} className="text-[10px] text-gray-400 hover:text-gray-700 underline underline-offset-2 ml-1">
                Edit
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              No skin profile set.{" "}
              <button type="button" onClick={() => setEditingProfile(true)} className="underline underline-offset-2 hover:text-gray-700">
                Set it here
              </button>{" "}
              to personalize your ingredient lists.
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setTab("products")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === "products"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Product Lists
          </button>
          <button
            onClick={() => setTab("ingredients")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === "ingredients"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Ingredient Lists
            {ingredientLists.length > 0 && (
              <span className="ml-1.5 text-[10px] text-gray-400">
                {ingredientLists.length}
              </span>
            )}
          </button>
        </div>

        {/* Product Lists tab */}
        {tab === "products" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs text-gray-400">Save products to lists as you scan.</p>
              {!createOpen && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:border-gray-400 hover:text-gray-900 transition-colors"
                >
                  + New list
                </button>
              )}
            </div>

            {createOpen && (
              <div className="mb-5 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createList()}
                  placeholder="List name"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                />
                <button
                  onClick={createList}
                  disabled={creating || !newName.trim()}
                  className="text-sm px-4 py-2.5 bg-gray-900 text-white rounded-xl disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => { setCreateOpen(false); setNewName(""); }}
                  className="text-sm text-gray-400 hover:text-gray-700 px-2"
                >
                  Cancel
                </button>
              </div>
            )}

            {lists.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 text-sm mb-4">No lists yet.</p>
                {!createOpen && (
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="text-sm text-gray-700 underline underline-offset-2"
                  >
                    Create your first list
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {lists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/lists/${list.id}`}
                    className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 leading-snug">{list.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {list.itemCount} product{list.itemCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {list.is_public && (
                        <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                          Public
                        </span>
                      )}
                      <span className="text-gray-300">›</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ingredient Lists tab */}
        {tab === "ingredients" && (
          <div className="space-y-6">
            {/* Smart lists */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Built-in</p>
              <div className="space-y-2">
                {SMART_LISTS.map((sl) => {
                const count = sl.id === "universal-concerns" ? smartCounts?.universalConcerns.count
                  : sl.id === "my-sensitivities" ? smartCounts?.mySensitivities?.count
                  : sl.id === "neutral-beneficial" ? smartCounts?.neutralBeneficial.count
                  : undefined;
                return (
                  <div key={sl.id} className="border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                            sl.type === "avoid" ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700"
                          }`}>
                            {sl.type === "avoid" ? "Avoid" : "Want"}
                          </span>
                          <p className="text-sm font-medium text-gray-900 leading-snug">{sl.name}</p>
                          {count !== undefined && (
                            <span className="text-[10px] text-gray-400 ml-auto shrink-0">{count.toLocaleString()} ingredients</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {sl.requiresProfile && skinTypes.length === 0
                            ? "Set your skin profile on the home page to activate this list."
                            : sl.description}
                        </p>
                        {sl.id === "neutral-beneficial" && smartCounts && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {smartCounts.neutralBeneficial.neutral.toLocaleString()} neutral · {smartCounts.neutralBeneficial.beneficial.toLocaleString()} beneficial
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* User-created lists */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Your Lists</p>
                {!newIngListOpen && (
                  <button
                    onClick={() => setNewIngListOpen(true)}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    + New list
                  </button>
                )}
              </div>

              {newIngListOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newIngListName.trim()) return;
                    setIngredientLists((ls) => [
                      ...ls,
                      { id: crypto.randomUUID(), name: newIngListName.trim(), items: [] },
                    ]);
                    setNewIngListName("");
                    setNewIngListOpen(false);
                  }}
                  className="border border-gray-200 rounded-xl p-3 space-y-2.5 mb-3"
                >
                  <input
                    type="text"
                    value={newIngListName}
                    onChange={(e) => setNewIngListName(e.target.value)}
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
                  <button
                    onClick={() => setNewIngListOpen(true)}
                    className="text-xs text-gray-700 underline underline-offset-2"
                  >
                    Create your first list
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {ingredientLists.map((list) => (
                    <div key={list.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      {/* List header */}
                      <div className="flex items-center gap-2">
                        {list.type && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                            list.type === "avoid" ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700"
                          }`}>
                            {list.type === "avoid" ? "Avoid" : "Want"}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-800 flex-1 leading-snug">{list.name}</span>
                        <span className="text-xs text-gray-400">{list.items.length}</span>
                        <button
                          onClick={() => setIngredientLists((ls) => ls.filter((l) => l.id !== list.id))}
                          className="text-[10px] text-gray-300 hover:text-rose-500 transition-colors"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Ingredient chips */}
                      {list.items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {list.items.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                            >
                              {item}
                              <button
                                onClick={() =>
                                  setIngredientLists((ls) =>
                                    ls.map((l) =>
                                      l.id === list.id ? { ...l, items: l.items.filter((i) => i !== item) } : l
                                    )
                                  )
                                }
                                className="text-gray-400 hover:text-rose-500 leading-none ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add ingredient input */}
                      {pasteListId === list.id ? (
                        <div className="space-y-1.5 pt-1 border-t border-gray-100">
                          <p className="text-[11px] text-gray-400">Paste names — one per line or comma-separated</p>
                          <textarea
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400 resize-none"
                            rows={3}
                            value={pasteTexts[list.id] ?? ""}
                            onChange={(e) => setPasteTexts((m) => ({ ...m, [list.id]: e.target.value }))}
                            placeholder="niacinamide, fragrance, alcohol denat…"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              className="text-xs px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                              onClick={() => {
                                const raw = pasteTexts[list.id] ?? "";
                                const items = raw.split(/[,\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
                                if (items.length > 0)
                                  setIngredientLists((ls) =>
                                    ls.map((l) =>
                                      l.id === list.id ? { ...l, items: [...new Set([...l.items, ...items])] } : l
                                    )
                                  );
                                setPasteTexts((m) => ({ ...m, [list.id]: "" }));
                                setPasteListId(null);
                              }}
                            >
                              Add {(pasteTexts[list.id] ?? "").split(/[,\n]+/).filter((s) => s.trim()).length || ""}
                            </button>
                            <button
                              className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                              onClick={() => { setPasteListId(null); setPasteTexts((m) => ({ ...m, [list.id]: "" })); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 border-t border-gray-100 space-y-1.5">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const val = (addItemInputs[list.id] ?? "").trim().toLowerCase();
                              if (!val || list.items.includes(val)) return;
                              setIngredientLists((ls) =>
                                ls.map((l) => l.id === list.id ? { ...l, items: [...l.items, val] } : l)
                              );
                              setAddItemInputs((m) => ({ ...m, [list.id]: "" }));
                              setIngSuggestions((m) => ({ ...m, [list.id]: [] }));
                            }}
                            className="flex gap-1.5 relative"
                          >
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={addItemInputs[list.id] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setAddItemInputs((m) => ({ ...m, [list.id]: v }));
                                  fetchIngSuggestions(list.id, v);
                                }}
                                onBlur={() =>
                                  setTimeout(() => setIngSuggestions((m) => ({ ...m, [list.id]: [] })), 150)
                                }
                                placeholder="Add ingredient…"
                                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400"
                              />
                              {(ingSuggestions[list.id] ?? []).length > 0 && (
                                <ul className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden text-xs">
                                  {(ingSuggestions[list.id] ?? []).map((s) => (
                                    <li key={s}>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          const val = s.toLowerCase();
                                          if (!list.items.includes(val))
                                            setIngredientLists((ls) =>
                                              ls.map((l) =>
                                                l.id === list.id ? { ...l, items: [...l.items, val] } : l
                                              )
                                            );
                                          setAddItemInputs((m) => ({ ...m, [list.id]: "" }));
                                          setIngSuggestions((m) => ({ ...m, [list.id]: [] }));
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
          </div>
        )}
      </main>
    </div>
  );
}

