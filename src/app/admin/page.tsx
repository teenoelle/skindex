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
      })
      .catch(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

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
      <main className="max-w-3xl mx-auto px-6 py-12">
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
      </main>
    </div>
  );
}
