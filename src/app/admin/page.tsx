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

type UnrecognizedProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  iherb_url: string | null;
  source: string | null;
};

type EditState = {
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

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [unrecognized, setUnrecognized] = useState<UnrecognizedProduct[]>([]);
  const [unrecognizedLoading, setUnrecognizedLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<Record<string, string>>({});

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
        loadUnrecognized();
      })
      .catch(() => setLoading(false));
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadUnrecognized() {
    setUnrecognizedLoading(true);
    try {
      const res = await fetch("/api/admin/unrecognized-types");
      const data = await res.json();
      setUnrecognized(data.products ?? []);
      const initEdits: Record<string, EditState> = {};
      for (const p of data.products ?? []) {
        initEdits[p.id] = { type: "", iherb_url: p.iherb_url ?? "", image_url: p.image_url ?? "" };
      }
      setEdits(initEdits);
    } catch {
      // ignore
    }
    setUnrecognizedLoading(false);
  }

  function updateEdit(id: string, field: keyof EditState, value: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setSaved((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setSaveError((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function saveProduct(p: UnrecognizedProduct) {
    const edit = edits[p.id];
    if (!edit) return;
    setSaving(p.id);
    setSaveError((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
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
      setSaved((prev) => new Set([...prev, p.id]));
      if (edit.type && PRODUCT_TYPES.includes(edit.type)) {
        setUnrecognized((prev) => prev.filter((u) => u.id !== p.id));
      }
    } catch (e) {
      setSaveError((prev) => ({ ...prev, [p.id]: (e as Error).message }));
    }
    setSaving(null);
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
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Submissions
            </h1>
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
                      {s.brand && (
                        <span className="text-xs text-gray-400 shrink-0">{s.brand}</span>
                      )}
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

        {/* Unrecognized product types */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              Unrecognized Types
            </h2>
            {!unrecognizedLoading && unrecognized.length > 0 && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5">
                {unrecognized.length}
              </span>
            )}
          </div>

          {unrecognizedLoading && (
            <p className="text-sm text-gray-400">Loading…</p>
          )}

          {!unrecognizedLoading && unrecognized.length === 0 && (
            <p className="text-sm text-gray-400">All product types are recognized.</p>
          )}

          {!unrecognizedLoading && unrecognized.length > 0 && (
            <div className="divide-y divide-gray-100">
              {unrecognized.map((p) => {
                const edit = edits[p.id] ?? { type: "", iherb_url: "", image_url: "" };
                const isSaving = saving === p.id;
                const isSaved = saved.has(p.id);
                const error = saveError[p.id];
                return (
                  <div key={p.id} className="py-5 space-y-3">
                    {/* Product identity row */}
                    <div className="flex items-start gap-3">
                      {p.image_url && (
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(p.image_url)}`}
                          alt={p.name}
                          className="w-10 h-12 object-contain rounded border border-gray-100 bg-gray-50 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {p.brand && <span className="text-xs text-gray-400">{p.brand}</span>}
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 shrink-0">
                            {p.type}
                          </span>
                          {p.source && <span className="text-xs text-gray-300">{p.source}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Edit fields */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <select
                        value={edit.type}
                        onChange={(e) => updateEdit(p.id, "type", e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                      >
                        <option value="">Map to type…</option>
                        {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="url"
                        value={edit.iherb_url}
                        onChange={(e) => updateEdit(p.id, "iherb_url", e.target.value)}
                        placeholder="iHerb URL"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="url"
                        value={edit.image_url}
                        onChange={(e) => updateEdit(p.id, "image_url", e.target.value)}
                        placeholder="Image URL"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    {/* Save row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => saveProduct(p)}
                        disabled={isSaving || (!edit.type && !edit.iherb_url && !edit.image_url)}
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
                      <a
                        href={`https://www.iherb.com/search?kw=${encodeURIComponent([p.brand, p.name].filter(Boolean).join(' '))}&rcode=DYT4743`}
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
        </section>

      </main>
    </div>
  );
}
