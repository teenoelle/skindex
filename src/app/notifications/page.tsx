"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";


type Submission = {
  type: "submission";
  id: string;
  productName: string;
  productBrand: string | null;
  status: "pending" | "processing" | "approved";
  submittedAt: string | null;
  productPath: string | null;
};

type Flag = {
  type: "flag";
  id: string;
  ingredientName: string;
  reasons: string[];
  status: "pending" | "addressed" | "dismissed";
  reviewAction: string | null;
  flaggedAt: string;
  reviewedAt: string | null;
  productPath: string | null;
  productName: string | null;
};

type ProductUpdate = {
  type: string;
  id: string;
  productId: string;
  productName: string | null;
  productBrand: string | null;
  productPath: string | null;
  createdAt: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [productUpdates, setProductUpdates] = useState<ProductUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setSubmissions(d.submissions ?? []);
        setFlags(d.flags ?? []);
        setProductUpdates(d.productUpdates ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  if (isLoaded && !isSignedIn) {
    return (
      <main className="max-w-lg mx-auto px-6 pt-24 pb-16">
        <p className="text-sm text-gray-500">
          <Link href="/sign-in" className="underline">Sign in</Link> to see your notifications.
        </p>
      </main>
    );
  }

  const isEmpty = !loading && submissions.length === 0 && flags.length === 0 && productUpdates.length === 0;

  return (
    <main className="max-w-lg mx-auto px-6 pt-24 pb-16">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-8">Activity</h1>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {isEmpty && (
        <p className="text-sm text-gray-400">No activity yet — submit a product or flag an ingredient explanation to see updates here.</p>
      )}

      {/* Ingredients ready notifications */}
      {productUpdates.filter((n) => n.type === "ingredients_ready").length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Ingredients analyzed</h2>
          <div className="space-y-2">
            {productUpdates.filter((n) => n.type === "ingredients_ready").map((n) => (
              <div key={n.id} className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.productName ?? "Product"}</p>
                    {n.productBrand && <p className="text-xs text-gray-400">{n.productBrand}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{relativeTime(n.createdAt)}</p>
                  </div>
                  <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1 shrink-0">
                    Ready
                  </span>
                </div>
                {n.productPath && (
                  <div className="mt-2">
                    <Link href={n.productPath} className="text-xs text-indigo-600 hover:underline">
                      See full ingredient analysis ↗
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product updates (flagged products reviewed by admin) */}
      {productUpdates.filter((n) => n.type !== "ingredients_ready").length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Products you flagged</h2>
          <div className="space-y-2">
            {productUpdates.filter((n) => n.type !== "ingredients_ready").map((n) => (
              <div key={n.id} className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.productName ?? "Product"}</p>
                    {n.productBrand && <p className="text-xs text-gray-400">{n.productBrand}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{relativeTime(n.createdAt)}</p>
                  </div>
                  <span className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1 shrink-0">
                    Updated
                  </span>
                </div>
                {n.productPath && (
                  <div className="mt-2">
                    <Link
                      href={n.productPath}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      See updated ingredient information ↗
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Submissions */}
      {submissions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Your submissions</h2>
          <div className="space-y-2">
            {submissions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.productName}</p>
                  {s.productBrand && <p className="text-xs text-gray-400">{s.productBrand}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{s.submittedAt ? relativeTime(s.submittedAt) : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  {s.status === "pending" && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1">
                      Pending review
                    </span>
                  )}
                  {s.status === "processing" && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                      Processing ingredients
                    </span>
                  )}
                  {s.status === "approved" && s.productPath && (
                    <Link
                      href={s.productPath}
                      className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1 hover:bg-teal-100 transition-colors"
                    >
                      Approved — view product ↗
                    </Link>
                  )}
                  {s.status === "approved" && !s.productPath && (
                    <span className="text-xs text-teal-600">Approved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Your flagged explanations</h2>
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.id} className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.ingredientName}</p>
                    {f.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.reasons.map((r, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{r}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{relativeTime(f.flaggedAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {f.status === "pending" && (
                      <span className="text-xs text-gray-400">Pending review</span>
                    )}
                    {f.status === "addressed" && (
                      <span className="text-xs text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1">
                        Updated
                      </span>
                    )}
                    {f.status === "dismissed" && (
                      <span className="text-xs text-gray-400">Reviewed</span>
                    )}
                  </div>
                </div>
                {f.status === "addressed" && f.productPath && (
                  <div className="mt-2">
                    <Link
                      href={f.productPath}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      {f.productName ? `See updated explanation on ${f.productName} ↗` : "See updated explanation ↗"}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
