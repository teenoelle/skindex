"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type Submission = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  submitted_at: string;
  ingredient_count: number;
};

type AllProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  iherb_url: string | null;
  source_url: string | null;
  source: string | null;
};

type AllEditState = {
  type: string;
  iherb_url: string;
  image_url: string;
};

const PRODUCT_TYPES = [
  "BB Cream", "Blush", "Body Lotion", "Body Wash",
  "Brow Gel", "CC Cream", "Concealer", "Concentrate", "Conditioner",
  "Deodorant", "Exfoliant", "Eye Cream", "Eye Primer",
  "Eyeliner", "Eyeshadow", "Face Mask", "Face Wash", "Foot Cream", "Foundation",
  "Hair Treatment", "Hand Cream", "Lip Balm", "Lip Treatment",
  "Makeup Remover", "Mascara", "Mist", "Moisturizer", "Oil", "Ointment", "Primer",
  "Scalp Treatment", "Serum", "Setting Spray", "Shampoo", "Sleeping Mask",
  "Spot Patches", "Sun Screen", "Toner",
].sort();

const PRODUCT_TYPES_SET = new Set(PRODUCT_TYPES);

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initEdit(p: AllProduct): AllEditState {
  return {
    type: PRODUCT_TYPES_SET.has(p.type ?? "") ? (p.type ?? "") : "",
    iherb_url: p.iherb_url ?? "",
    image_url: p.image_url ?? "",
  };
}

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const [allProducts, setAllProducts] = useState<AllProduct[]>([]);
  const [allProductsLoading, setAllProductsLoading] = useState(false);
  const [allSearch, setAllSearch] = useState("");
  const [filterMissingIherb, setFilterMissingIherb] = useState(false);
  const [filterMissingImage, setFilterMissingImage] = useState(false);
  const [filterMissingType, setFilterMissingType] = useState(false);
  const [allEdits, setAllEdits] = useState<Record<string, AllEditState>>({});
  const [allSaving, setAllSaving] = useState<string | null>(null);
  const [allSaved, setAllSaved] = useState<Set<string>>(new Set());
  const [allSaveError, setAllSaveError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    fetch("/api/admin/submissions")
      .then((r) => {
        if (r.status === 403) { setForbidden(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setSubmissions(d.submissions ?? []);
        setRecentCount(d.recentCount ?? 0);
        setLoading(false);
        loadAllProducts();
      })
      .catch(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  async function loadAllProducts() {
    setAllProductsLoading(true);
    try {
      const res = await fetch("/api/admin/all-products");
      const data = await res.json();
      const products: AllProduct[] = data.products ?? [];
      setAllProducts(products);
      const initEdits: Record<string, AllEditState> = {};
      for (const p of products) initEdits[p.id] = initEdit(p);
      setAllEdits(initEdits);
    } catch {
      // ignore
    }
    setAllProductsLoading(false);
  }

  function updateAllEdit(id: string, field: keyof AllEditState, value: string) {
    setAllEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setAllSaved((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setAllSaveError((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function productHasChanges(p: AllProduct): boolean {
    const edit = allEdits[p.id];
    if (!edit) return false;
    const base = initEdit(p);
    return edit.type !== base.type || edit.iherb_url !== base.iherb_url || edit.image_url !== base.image_url;
  }

  async function saveAllProduct(p: AllProduct) {
    const edit = allEdits[p.id];
    if (!edit) return;
    setAllSaving(p.id);
    setAllSaveError((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
    try {
      const res = await fetch("/api/admin/update-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: p.id,
          type: edit.type || undefined,
          iherb_url: edit.iherb_url || undefined,
          image_url: edit.image_url || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const updated: AllProduct = {
        ...p,
        type: edit.type || p.type,
        iherb_url: edit.iherb_url || p.iherb_url,
        image_url: edit.image_url || p.image_url,
      };
      setAllProducts((prev) => prev.map((q) => q.id === p.id ? updated : q));
      setAllEdits((prev) => ({ ...prev, [p.id]: initEdit(updated) }));
      setAllSaved((prev) => new Set([...prev, p.id]));
    } catch (e) {
      setAllSaveError((prev) => ({ ...prev, [p.id]: (e as Error).message }));
    }
    setAllSaving(null);
  }

  async function handleArchive(id: string) {
    setArchiving(id);
    const res = await fetch("/api/admin/mark-reviewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setArchiving(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    const res = await fetch("/api/admin/delete-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setDeleting(null);
  }

  const allStats = {
    total: allProducts.length,
    missingIherb: allProducts.filter((p) => !p.iherb_url).length,
    missingImage: allProducts.filter((p) => !p.image_url).length,
    missingType: allProducts.filter((p) => !p.type || !PRODUCT_TYPES_SET.has(p.type)).length,
  };

  const filteredAllProducts = allProducts
    .filter((p) =>
      !allSearch ||
      p.name.toLowerCase().includes(allSearch.toLowerCase()) ||
      (p.brand ?? "").toLowerCase().includes(allSearch.toLowerCase())
    )
    .filter((p) => !filterMissingIherb || !p.iherb_url)
    .filter((p) => !filterMissingImage || !p.image_url)
    .filter((p) => !filterMissingType || !p.type || !PRODUCT_TYPES_SET.has(p.type));

  const displayedAllProducts = filteredAllProducts.slice(0, 100);
  const isFiltered = !!(allSearch || filterMissingIherb || filterMissingImage || filterMissingType);

  const header = (
    <header className="border-b border-gray-100 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl tracking-tight select-none">
          <span className="font-black">SKIN</span>
          <span className="font-light text-gray-500">dex</span>
        </Link>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
          ← Scanner
        </Link>
      </div>
    </header>
  );

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        {header}
        <main className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isSignedIn || forbidden) {
    return (
      <div className="min-h-screen bg-white">
        {header}
        <main className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-sm text-gray-500">You don&apos;t have access to this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {header}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-16">

        {/* Submissions */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Submissions</h1>
            {recentCount > 0 && (
              <span className="text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5">
                {recentCount} this week
              </span>
            )}
          </div>

          {submissions.length === 0 ? (
            <p className="text-sm text-gray-400">No user-submitted products yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {submissions.map((s) => (
                <div key={s.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                      {s.brand && <span className="text-xs text-gray-400 shrink-0">{s.brand}</span>}
                      {s.type && (
                        <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 shrink-0">
                          {s.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {s.ingredient_count > 0 ? `${s.ingredient_count} ingredients` : "No ingredients"}
                      </span>
                      <span className="text-gray-200 text-xs">·</span>
                      <span className="text-xs text-gray-400">{relativeTime(s.submitted_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/?scan=${s.id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                    >
                      Scan
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleArchive(s.id)}
                      disabled={archiving === s.id}
                      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                    >
                      {archiving === s.id ? "Archiving…" : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deleting === s.id}
                      className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-40"
                    >
                      {deleting === s.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* All Products */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">All Products</h2>
            {!allProductsLoading && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                {allStats.total}
              </span>
            )}
          </div>

          {!allProductsLoading && allStats.total > 0 && (
            <p className="text-xs mb-5 flex flex-wrap gap-x-2 gap-y-1">
              <span className={allStats.missingIherb > 0 ? "text-amber-600" : "text-gray-400"}>
                {allStats.missingIherb} missing iHerb
              </span>
              <span className="text-gray-300">·</span>
              <span className={allStats.missingImage > 0 ? "text-amber-600" : "text-gray-400"}>
                {allStats.missingImage} missing image
              </span>
              <span className="text-gray-300">·</span>
              <span className={allStats.missingType > 0 ? "text-amber-600" : "text-gray-400"}>
                {allStats.missingType} no type
              </span>
            </p>
          )}

          {!allProductsLoading && (
            <div className="flex flex-wrap gap-2 mb-6">
              <input
                type="text"
                value={allSearch}
                onChange={(e) => setAllSearch(e.target.value)}
                placeholder="Search by name or brand…"
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 w-52"
              />
              <button
                type="button"
                onClick={() => setFilterMissingIherb((v) => !v)}
                className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
                  filterMissingIherb
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "border-gray-200 text-gray-500 hover:border-gray-400"
                }`}
              >
                Missing iHerb
              </button>
              <button
                type="button"
                onClick={() => setFilterMissingImage((v) => !v)}
                className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
                  filterMissingImage
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "border-gray-200 text-gray-500 hover:border-gray-400"
                }`}
              >
                Missing image
              </button>
              <button
                type="button"
                onClick={() => setFilterMissingType((v) => !v)}
                className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
                  filterMissingType
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "border-gray-200 text-gray-500 hover:border-gray-400"
                }`}
              >
                No type
              </button>
            </div>
          )}

          {allProductsLoading && <p className="text-sm text-gray-400">Loading…</p>}

          {!allProductsLoading && allStats.total === 0 && (
            <p className="text-sm text-gray-400">No products yet.</p>
          )}

          {!allProductsLoading && allStats.total > 0 && isFiltered && filteredAllProducts.length === 0 && (
            <p className="text-sm text-gray-400">No products match.</p>
          )}

          {!allProductsLoading && allStats.total > 0 && !isFiltered && (
            <p className="text-xs text-gray-400 mb-4">Use search or filters above to find products.</p>
          )}

          {!allProductsLoading && isFiltered && displayedAllProducts.length > 0 && (
            <div className="divide-y divide-gray-100">
              {displayedAllProducts.map((p) => {
                const edit = allEdits[p.id] ?? { type: "", iherb_url: "", image_url: "" };
                const isSaving = allSaving === p.id;
                const isSaved = allSaved.has(p.id);
                const error = allSaveError[p.id];
                const hasChanges = productHasChanges(p);
                const typeIsNonCanonical = p.type && !PRODUCT_TYPES_SET.has(p.type);
                const previewImage = edit.image_url || p.image_url;
                return (
                  <div key={p.id} className="py-5 space-y-3">
                    <div className="flex items-start gap-3">
                      {previewImage && (
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(previewImage)}`}
                          alt={p.name}
                          className="w-10 h-12 object-contain rounded border border-gray-100 bg-gray-50 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={p.name}>{p.name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {p.brand && <span className="text-xs text-gray-400">{p.brand}</span>}
                          {p.type && (
                            <span className={`text-xs border rounded-full px-2 py-0.5 shrink-0 ${
                              typeIsNonCanonical
                                ? "text-amber-700 bg-amber-50 border-amber-100"
                                : "text-gray-400 border-gray-200"
                            }`}>
                              {p.type}
                            </span>
                          )}
                          {!p.type && (
                            <span className="text-xs text-rose-500 border border-rose-100 bg-rose-50 rounded-full px-2 py-0.5 shrink-0">
                              no type
                            </span>
                          )}
                          {p.source && <span className="text-xs text-gray-300">{p.source}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <select
                        value={edit.type}
                        onChange={(e) => updateAllEdit(p.id, "type", e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                      >
                        <option value="">Type…</option>
                        {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="url"
                        value={edit.iherb_url}
                        onChange={(e) => updateAllEdit(p.id, "iherb_url", e.target.value)}
                        placeholder="iHerb URL"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="url"
                        value={edit.image_url}
                        onChange={(e) => updateAllEdit(p.id, "image_url", e.target.value)}
                        placeholder="Image URL"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => saveAllProduct(p)}
                        disabled={isSaving || !hasChanges}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      {isSaved && <span className="text-xs text-teal-600">Saved.</span>}
                      {error && <span className="text-xs text-rose-600">{error}</span>}
                      <Link
                        href={`/?scan=${p.id}`}
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                      >
                        Scan
                      </Link>
                      {p.source_url && (
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                        >
                          Source ↗
                        </a>
                      )}
                      <a
                        href={`https://www.iherb.com/search?kw=${encodeURIComponent([p.brand, p.name].filter(Boolean).join(" "))}&rcode=DYT4743`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                      >
                        iHerb ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!allProductsLoading && isFiltered && filteredAllProducts.length > 100 && (
            <p className="text-xs text-gray-400 mt-4">
              Showing 100 of {filteredAllProducts.length}. Narrow your search to see more.
            </p>
          )}
        </section>

      </main>
    </div>
  );
}
