"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

type Item = { name: string; category: string };

const META: Record<string, { title: string; color: string; description: string }> = {
  "universal-concerns": {
    title: "Universal Concerns",
    color: "text-rose-700",
    description: "Flagged for all skin types — contact allergens, biocides, sulfate surfactants, formaldehyde releasers, and drying solvents.",
  },
  "my-sensitivities": {
    title: "My Sensitivities",
    color: "text-amber-700",
    description: "Ingredients flagged specifically for your skin profile.",
  },
  "neutral-beneficial": {
    title: "Neutral & Beneficial",
    color: "text-teal-700",
    description: "All reviewed-safe ingredients — neutral (no category) and beneficial (positive category).",
  },
};

export default function BuiltInListPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = META[slug];

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rinseOff, setRinseOff] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!meta) return;
    setLoading(true);
    const params = new URLSearchParams({ list: slug });
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      const cl = localStorage.getItem("skindex:climates");
      if (st) params.set("skinTypes", JSON.parse(st).join(","));
      if (cl) params.set("climates", JSON.parse(cl).join(","));
    } catch {}
    if (rinseOff) params.set("rinseOff", "true");
    fetch(`/api/ingredient-lists/items?${params}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug, rinseOff]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filtered = q.trim()
    ? items.filter(i => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    : items;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 pt-[4.5rem] pb-16">
        <Link href="/lists" className="text-xs text-gray-400 hover:text-gray-700 mb-6 block">← My Lists</Link>

        <div className="mb-6">
          <h1 className={`text-2xl font-semibold tracking-tight mb-1 ${meta.color}`}>{meta.title}</h1>
          <p className="text-xs text-gray-400 leading-relaxed">{meta.description}</p>

          {slug === "my-sensitivities" && (
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

        {/* Search */}
        <div className="relative mb-4">
          <input
            ref={searchRef}
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

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{q ? "No matches." : "No ingredients."}</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">{filtered.length} ingredient{filtered.length !== 1 ? "s" : ""}{q ? " matching" : ""}</p>
            <div className="flex flex-wrap gap-1.5">
              {filtered.map(item => (
                <span
                  key={item.name}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    slug === "universal-concerns" ? "border-rose-100 bg-rose-50 text-rose-700" :
                    slug === "my-sensitivities"   ? "border-amber-100 bg-amber-50 text-amber-700" :
                    item.category                 ? "border-teal-100 bg-teal-50 text-teal-700" :
                    "border-gray-100 bg-gray-50 text-gray-600"
                  }`}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
