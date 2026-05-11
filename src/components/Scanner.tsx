"use client";

import { Fragment, useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import { Pipette, FlaskConical, Droplet, Droplets, Waves, Sun, Sparkles, Wind, Bandage, Brush } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IngredientMatch, PhotosensitiveItem, ScanResult, AlternativeProduct } from "@/types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Ampoule: Pipette,
  Balm: Sparkles,
  Blush: Sparkles,
  "Body Wash": Waves,
  Chapstick: Pipette,
  Concealer: Brush,
  Cream: Droplets,
  Emulsion: Droplets,
  Extract: FlaskConical,
  "Face Mask": Sparkles,
  "Face Wash": Droplets,
  Foundation: Brush,
  Gel: Droplet,
  "Makeup Remover": Droplets,
  Mist: Wind,
  Oil: Droplet,
  Ointment: Droplets,
  Serum: Pipette,
  Shampoo: Waves,
  "Spot Patches": Bandage,
  "Sun Screen": Sun,
  Toner: Droplets,
};

function CategoryIcon({ type, size = 28 }: { type?: string | null; size?: number }) {
  const Icon = (type && CATEGORY_ICONS[type]) ? CATEGORY_ICONS[type] : Droplet;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Icon size={size} className="text-gray-300" />
      {type && <span className="text-[10px] text-gray-400 text-center leading-tight">{type}</span>}
    </div>
  );
}

type Tab = "search" | "paste" | "url";

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Preserve original casing unless the string is all-caps, then apply title case
function smartCase(str: string): string {
  const alpha = str.replace(/[^a-zA-Z]/g, "");
  if (!alpha || alpha !== alpha.toUpperCase()) return str;
  return toTitleCase(str);
}

function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function normalizeForMatch(s: string) {
  return s.replace(/[​‌‍﻿]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getItemMatch(
  item: string,
  safe: IngredientMatch[],
  flagged: IngredientMatch[]
): { status: "safe" | "flagged"; ingredient: IngredientMatch["ingredient"] } | null {
  const cleaned = normalizeForMatch(item.replace(/\([^)]*\)/g, ""));
  const f = flagged.find((m) => normalizeForMatch(m.displayName) === cleaned);
  if (f) return { status: "flagged", ingredient: f.ingredient };
  const s = safe.find((m) => normalizeForMatch(m.displayName) === cleaned);
  if (s) return { status: "safe", ingredient: s.ingredient };
  return null;
}

const paragraphColor = {
  "photo-sensitive": "text-yellow-700 font-medium",
  flagged: "text-rose-700 font-medium",
  safe: "text-teal-700 font-medium",
  unreviewed: "text-gray-400",
};

export default function Scanner() {
  const { isSignedIn } = useUser();

  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showUnreviewed, setShowUnreviewed] = useState(false);
  const [showObfVariants, setShowObfVariants] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, string | null>>({});
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [alternativesFallback, setAlternativesFallback] = useState(false);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [alternativesFetched, setAlternativesFetched] = useState(false);
  const [alternativesOpen, setAlternativesOpen] = useState(true);
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [imageUploadUrl, setImageUploadUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ reviewed: number } | null>(null);

  async function handleScan() {
    setLoading(true);
    setNotFound(false);
    setResult(null);
    setLimitReached(false);
    setShowUnreviewed(false);
    setShowObfVariants(false);
    setExpanded(new Set());
    setExplanations({});
    setAlternatives([]);
    setAlternativesFallback(false);
    setAlternativesLoading(false);
    setAlternativesFetched(false);
    setAlternativesOpen(true);
    setImageUploadOpen(false);
    setImageUploadUrl("");
    setImageUploading(false);
    setUploadError(null);
    setReviewLoading(false);
    setReviewResult(null);

    const body =
      tab === "search"
        ? { type: "search", query }
        : tab === "paste"
        ? { type: "paste", ingredients }
        : { type: "url", url };

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (data.limitReached) { setLimitReached(true); return; }
    if (data.notFound || data.needsAuth) { setNotFound(true); return; }
    setResult(data);
  }

  async function toggleExpand(id: string, existingExplanation: string | null) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      next.add(id);
      return next;
    });

    if (existingExplanation || id in explanations) return;

    setExplanations((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setExplanations((prev) => ({ ...prev, [id]: data.explanation ?? null }));
    } catch {
      // leave as null
    }
  }

  function handleParagraphClick(ingredientId: string, dbExplanation: string | null) {
    if (!expanded.has(ingredientId)) {
      toggleExpand(ingredientId, dbExplanation);
    }
    requestAnimationFrame(() => {
      document.getElementById(`ingredient-${ingredientId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function handlePhotoClick(rawName: string, safeMatch: { id: string; explanation: string | null } | null) {
    const photoKey = `photo-${rawName}`;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(photoKey);
      if (safeMatch) next.add(safeMatch.id);
      return next;
    });
    if (safeMatch && !safeMatch.explanation && !(safeMatch.id in explanations)) {
      setExplanations((prev) => ({ ...prev, [safeMatch.id]: null }));
      fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: safeMatch.id }),
      })
        .then((r) => r.json())
        .then((data) => setExplanations((prev) => ({ ...prev, [safeMatch.id]: data.explanation ?? null })))
        .catch(() => {});
    }
    requestAnimationFrame(() => {
      document.getElementById("section-photosensitive")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleUnreviewedClick(name: string) {
    setShowUnreviewed(true);
    requestAnimationFrame(() => {
      document.getElementById(`unreviewed-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function scanVariant(opts: { productId?: string; pasteIngredients?: string; productName?: string; productBrand?: string | null }) {
    setLoading(true);
    setResult(null);
    setShowUnreviewed(false);
    setShowObfVariants(false);
    setExpanded(new Set());
    setExplanations({});
    setAlternatives([]);
    setAlternativesFallback(false);
    setAlternativesLoading(false);
    setAlternativesFetched(false);
    setAlternativesOpen(true);
    setImageUploadOpen(false);
    setImageUploadUrl("");
    setImageUploading(false);
    setUploadError(null);
    setReviewLoading(false);
    setReviewResult(null);

    const body = opts.productId
      ? { type: "search", query, productId: opts.productId }
      : { type: "paste", ingredients: opts.pasteIngredients };

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!data.flagged) return;

    // For OBF variant paste, inject the product name/brand since paste type doesn't return product meta
    if (opts.pasteIngredients && opts.productName) {
      data.product = {
        name: opts.productName,
        brand: opts.productBrand ?? null,
        source: "openbeautyfacts",
      };
    }
    setResult(data);
  }

  async function fetchAlternatives() {
    if (!result?.flagged.length) return;
    const flaggedIds = result.flagged.map((m) => m.ingredient.id);
    setAlternativesLoading(true);
    const res = await fetch("/api/alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedIds, productType: result.product?.type ?? null }),
    });
    const data = await res.json();
    setAlternatives(data.results ?? []);
    setAlternativesFallback(data.sameTypeFallback ?? false);
    setAlternativesLoading(false);
    setAlternativesFetched(true);
  }

  async function handleImageUpload() {
    if (!result?.product?.id || !imageUploadUrl.trim()) return;
    setImageUploading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/set-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: result.product.id, url: imageUploadUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
      } else {
        setResult((prev) =>
          prev ? { ...prev, product: prev.product ? { ...prev.product, image_url: data.imageUrl } : prev.product } : prev
        );
        setImageUploadOpen(false);
        setImageUploadUrl("");
      }
    } catch {
      setUploadError("Upload failed");
    }
    setImageUploading(false);
  }

  async function handleReview() {
    setReviewLoading(true);
    setReviewResult(null);
    try {
      const res = await fetch("/api/review-ingredients", { method: "POST" });
      const data = await res.json();
      setReviewResult({ reviewed: data.reviewed ?? 0 });
    } catch {
      setReviewResult({ reviewed: 0 });
    }
    setReviewLoading(false);
  }

  function switchToPaste(prefill?: string) {
    setTab("paste");
    if (prefill) setIngredients(prefill);
    setResult(null);
    setNotFound(false);
    setLimitReached(false);
  }

  function resetTab(t: Tab) {
    setTab(t);
    setResult(null);
    setNotFound(false);
    setLimitReached(false);
  }

  const canScan =
    tab === "search" ? query.trim().length > 0
    : tab === "paste" ? ingredients.trim().length > 0
    : url.trim().length > 0;

  const urlTabGated = tab === "url" && !isSignedIn;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {(["search", "paste", "url"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => resetTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t === "search" ? "Search" : t === "paste" ? "Paste list" : "Paste URL"}
          </button>
        ))}
      </div>

      {/* Inputs */}
      {tab === "search" && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canScan && handleScan()}
          placeholder="e.g. CeraVe Moisturizing Cream"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-3"
        />
      )}
      {tab === "paste" && (
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Paste the full ingredients list here..."
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-3 resize-none font-mono leading-relaxed"
        />
      )}
      {tab === "url" && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://sephora.com/product/..."
          disabled={urlTabGated}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 mb-3 disabled:bg-gray-50 disabled:text-gray-400"
        />
      )}

      {urlTabGated ? (
        <SignInButton mode="modal">
          <button className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:border-gray-400 hover:text-gray-900 transition-colors">
            Sign in to use URL scanning
          </button>
        </SignInButton>
      ) : (
        <button
          onClick={handleScan}
          disabled={!canScan || loading}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      )}

      {/* Limit reached */}
      {limitReached && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 text-center">
          You&apos;ve used your 5 daily URL scans. Come back tomorrow, or{" "}
          <button className="underline font-medium" onClick={() => switchToPaste()}>
            paste the ingredients
          </button>{" "}
          instead.
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
          No ingredients found.{" "}
          <button className="underline text-gray-700" onClick={() => switchToPaste()}>
            Paste the ingredient list
          </button>{" "}
          instead.
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-8">

          {/* Product header */}
          {result.product && (
            <div className="flex flex-col sm:flex-row rounded-xl border border-gray-100 overflow-hidden">
              {/* Image panel */}
              <div className={`sm:w-64 shrink-0 bg-gray-50${result.product.image_url ? "" : " flex items-center justify-center min-h-[200px]"}`}>
                {result.product.image_url ? (
                  <Image
                    src={proxyImage(result.product.image_url)!}
                    width={256}
                    height={384}
                    alt=""
                    className="w-full object-contain p-3 sm:max-h-[60vh]"
                    style={{ height: "auto" }}
                    sizes="(max-width: 640px) 100vw, 256px"
                    unoptimized
                  />
                ) : (
                  <CategoryIcon type={result.product.type} size={32} />
                )}
              </div>

              {/* Details panel */}
              <div className="flex-1 p-2 sm:p-3 flex flex-col justify-center gap-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 leading-snug">
                  {result.product.source === "url-extract"
                    ? (() => { try { return new URL(result.product.name).hostname.replace("www.", ""); } catch { return result.product.name; } })()
                    : result.product.name}
                </h2>
                {result.product.brand && (
                  <p className="text-sm text-gray-400">{result.product.brand}</p>
                )}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                  {result.communityVariants && result.communityVariants.length > 0 && (
                    <span className="text-xs text-gray-400">
                      Also:{" "}
                      {result.communityVariants.map((v, i) => (
                        <span key={v.id}>
                          {i > 0 && <span className="mx-1">·</span>}
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-gray-700"
                            onClick={() => scanVariant({ productId: v.id })}
                          >
                            {v.name}{v.brand ? ` (${v.brand})` : ""}
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                {/* Image upload / change — signed-in users only */}
                {result.product.id && isSignedIn && (
                  <div className="mt-1">
                    {!imageUploadOpen ? (
                      <button
                        type="button"
                        onClick={() => setImageUploadOpen(true)}
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
                      >
                        {result.product.image_url ? "Change image" : "Add image"}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            value={imageUploadUrl}
                            onChange={(e) => setImageUploadUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !imageUploading && handleImageUpload()}
                            placeholder="Image or product page URL"
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-400 min-w-0"
                          />
                          <button
                            type="button"
                            onClick={handleImageUpload}
                            disabled={imageUploading || !imageUploadUrl.trim()}
                            className="text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-40 shrink-0"
                          >
                            {imageUploading ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setImageUploadOpen(false); setUploadError(null); }}
                            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                        {uploadError && (
                          <p className="text-xs text-rose-600">{uploadError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary line + safe alternatives group */}
          <div className="space-y-2">
          {(result.flagged.length + result.safe.length + result.unreviewed.length) > 0 && (
            <p className="text-xs -mt-2">
              <span className="text-gray-700">{result.flagged.length + result.safe.length + result.unreviewed.length} ingredients scanned</span>
              {" · "}
              <button
                type="button"
                className={`${result.flagged.length > 0 ? "text-rose-700" : "text-gray-400"} hover:underline underline-offset-2`}
                onClick={() => document.getElementById("section-flagged")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {result.flagged.length} flagged
              </button>
              {(result.photosensitive ?? []).length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-yellow-700 hover:underline underline-offset-2"
                    onClick={() => document.getElementById("section-photosensitive")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {result.photosensitive.length} photosensitive
                  </button>
                </>
              )}
              {" · "}
              <button
                type="button"
                className="text-teal-700 hover:underline underline-offset-2"
                onClick={() => document.getElementById("section-safe")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {result.safe.length} safe
              </button>
              {result.unreviewed.length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="hover:underline underline-offset-2"
                    onClick={() => {
                      setShowUnreviewed(true);
                      requestAnimationFrame(() => {
                        document.getElementById("section-unreviewed")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                  >
                    {result.unreviewed.length} unreviewed
                  </button>
                </>
              )}
            </p>
          )}

          {/* Safe alternatives */}
          {result.flagged.length > 0 && (
            <section>
              {!alternativesFetched && !alternativesLoading && (
                <button
                  type="button"
                  onClick={fetchAlternatives}
                  className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-800"
                >
                  Find safer alternatives →
                </button>
              )}
              {alternativesLoading && (
                <p className="text-sm text-gray-400">Finding alternatives…</p>
              )}
              {alternativesFetched && alternatives.length === 0 && (
                <p className="text-sm text-gray-400">No alternatives found in the database.</p>
              )}
              {alternatives.length > 0 && (
                <div className="mt-6">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3"
                    onClick={() => setAlternativesOpen((v) => !v)}
                  >
                    Safer alternatives — {alternatives.length}
                    <span className="text-gray-300">{alternativesOpen ? "▲" : "▼"}</span>
                  </button>
                  {alternativesOpen && <div className="divide-y divide-gray-100">
                    {alternatives.map((alt, i) => {
                      const showSeparator =
                        alternativesFallback &&
                        !alt.sameType &&
                        i > 0 &&
                        alternatives[i - 1].sameType;
                      return (
                        <Fragment key={alt.id}>
                          {showSeparator && (
                            <p className="text-xs text-gray-400 pt-3 pb-1">Also in other categories</p>
                          )}
                          <div className="flex items-center gap-3 py-2">
                            {alt.image_url ? (
                              <Image
                                src={proxyImage(alt.image_url)!}
                                width={48}
                                height={56}
                                alt=""
                                className="object-contain rounded-lg border border-gray-100 bg-gray-50 shrink-0"
                                unoptimized
                              />
                            ) : (
                              <div className="w-12 h-14 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0">
                                <CategoryIcon type={alt.type} size={18} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{alt.name}</p>
                              {alt.brand && <p className="text-xs text-gray-400">{alt.brand}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs px-1.5 py-0.5 rounded-md ${alt.flaggedCount === 0 ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"}`}>
                                {alt.flaggedCount === 0 ? "0 flagged" : `${alt.flaggedCount} flagged`}
                              </span>
                              <button
                                type="button"
                                className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                                onClick={() => scanVariant({ productId: alt.id })}
                              >
                                Scan
                              </button>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>}
                </div>
              )}
            </section>
          )}
          </div>{/* end summary + alternatives group */}

          {/* Incomplete warning */}
          {result.isIncomplete && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              This ingredient list may be incomplete.{" "}
              <button
                className="underline font-medium"
                onClick={() => switchToPaste(result.product?.name)}
              >
                Add the full list manually
              </button>
            </div>
          )}

          {/* Ingredients parent section */}
          <section className="space-y-8">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
            Ingredients
          </p>

          {/* Full ingredient list — paragraph view */}
          {result.originalItems.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Full ingredient list
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm leading-relaxed select-text">
                {result.originalItems.map((item, i) => {
                  const match = getItemMatch(item, result.safe, result.flagged);
                  const photoItem = (result.photosensitive ?? []).find(
                    (p) => normalizeForMatch(p.rawName) === normalizeForMatch(item)
                  );
                  const colorKey: keyof typeof paragraphColor =
                    match?.status === "flagged" ? "flagged"
                    : photoItem ? "photo-sensitive"
                    : match?.status === "safe" ? "safe"
                    : "unreviewed";
                  const colorClass =
                    colorKey === "unreviewed" ? paragraphColor.unreviewed
                    : colorKey === "safe" ? "text-gray-700 font-medium"
                    : paragraphColor[colorKey];
                  return (
                    <Fragment key={i}>
                      {photoItem ? (
                        <button
                          type="button"
                          className={`${colorClass} hover:underline underline-offset-2`}
                          onClick={() => handlePhotoClick(item, match ? { id: match.ingredient.id, explanation: match.ingredient.explanation } : null)}
                        >
                          {smartCase(item)}
                        </button>
                      ) : match ? (
                        <button
                          type="button"
                          className={`${colorClass} hover:underline underline-offset-2`}
                          onClick={() => handleParagraphClick(match.ingredient.id, match.ingredient.explanation)}
                        >
                          {smartCase(item)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${colorClass} hover:underline underline-offset-2`}
                          onClick={() => handleUnreviewedClick(item)}
                        >
                          {smartCase(item)}
                        </button>
                      )}
                      {i < result.originalItems.length - 1 && (
                        <span className="text-gray-400">, </span>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </section>
          )}

          {/* Flagged ingredients */}
          {result.flagged.length > 0 && (
            <section id="section-flagged">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-widest mb-2">
                Flagged ingredients — {result.flagged.length}
              </p>
              <div className="divide-y divide-gray-100">
                {result.flagged.map((item) => {
                  const { id, explanation: dbExplanation } = item.ingredient;
                  const isOpen = expanded.has(id);
                  const explanation = dbExplanation ?? explanations[id];
                  const isLoading = isOpen && !dbExplanation && !(id in explanations);

                  return (
                    <div
                      key={id}
                      id={`ingredient-${id}`}
                      className="border-l-4 border-l-gray-200 overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between px-3 py-1 text-left"
                        onClick={() => toggleExpand(id, dbExplanation)}
                      >
                        <span className={`text-sm font-medium ${isOpen ? "text-rose-700" : "text-gray-800"}`}>
                          {smartCase(item.displayName)}
                        </span>
                        <span className="text-gray-300 text-xs ml-4 shrink-0">
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-2 text-sm text-gray-600 leading-relaxed">
                          {isLoading ? (
                            <span className="italic text-gray-400">Generating explanation…</span>
                          ) : explanation ? (
                            explanation
                          ) : (
                            <span className="italic text-gray-400">No explanation yet.</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Photosensitive ingredients */}
          {(result.photosensitive ?? []).length > 0 && (
            <section id="section-photosensitive">
              <p className="text-xs font-semibold text-yellow-700 uppercase tracking-widest mb-2">
                Photosensitive — {result.photosensitive.length}
              </p>
              <div className="divide-y divide-gray-100">
                {result.photosensitive.map((item) => {
                  const key = `photo-${item.rawName}`;
                  const isOpen = expanded.has(key);
                  return (
                    <div
                      key={item.rawName}
                      className="border-l-4 border-l-gray-200 overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between px-3 py-1 text-left"
                        onClick={() => setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        })}
                      >
                        <span className={`text-sm font-medium ${isOpen ? "text-yellow-700" : "text-gray-800"}`}>
                          {smartCase(item.rawName)}
                        </span>
                        <span className="text-gray-300 text-xs ml-4 shrink-0">
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </button>
                      {isOpen && item.photo_note && (
                        <div className="px-3 pb-2 text-sm text-gray-600 leading-relaxed">
                          {item.photo_note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Safe ingredients */}
          {result.safe.length > 0 && (
            <section id="section-safe">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-2">
                Safe ingredients — {result.safe.length}
              </p>
              <div className="divide-y divide-gray-100">
                {result.safe.map((item) => {
                  const { id, explanation: dbExplanation } = item.ingredient;
                  const isOpen = expanded.has(id);
                  const explanation = dbExplanation ?? explanations[id];
                  const isLoading = isOpen && !dbExplanation && !(id in explanations);

                  return (
                    <div
                      key={id}
                      id={`ingredient-${id}`}
                      className="border-l-2 border-l-gray-200 overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between pl-3 pr-2 py-0.5 text-left"
                        onClick={() => toggleExpand(id, dbExplanation)}
                      >
                        <span className={`text-sm font-medium ${isOpen ? "text-teal-700" : "text-gray-700"}`}>
                          {smartCase(item.displayName)}
                        </span>
                        <span className="text-gray-300 text-xs ml-4 shrink-0">
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="pl-3 pr-2 pb-1.5 text-sm text-gray-500 leading-relaxed">
                          {isLoading ? (
                            <span className="italic text-gray-400">Generating explanation…</span>
                          ) : explanation ? (
                            explanation
                          ) : (
                            <span className="italic text-gray-400">No explanation yet.</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Unreviewed ingredients */}
          {result.unreviewed.length > 0 && (
            <section id="section-unreviewed">
              <div className="flex items-center justify-between gap-4">
                <button
                  className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-widest"
                  onClick={() => setShowUnreviewed((v) => !v)}
                >
                  Unreviewed — {result.unreviewed.length}
                  <span className="text-stone-300">{showUnreviewed ? "▲" : "▼"}</span>
                </button>
                {reviewResult ? (
                  <span className="text-xs text-gray-400">
                    {reviewResult.reviewed > 0
                      ? `${reviewResult.reviewed} reviewed — rescan to see results`
                      : "Nothing new to review"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleReview}
                    disabled={reviewLoading}
                    className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 disabled:opacity-40 shrink-0"
                  >
                    {reviewLoading ? "Reviewing…" : "Review now"}
                  </button>
                )}
              </div>
              {showUnreviewed && (
                <div className="mt-2 divide-y divide-stone-100">
                  {result.unreviewed.map((name) => (
                    <div
                      key={name}
                      id={`unreviewed-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                      className="border-l-2 border-stone-200 pl-3 py-0.5"
                    >
                      <span className="block text-sm text-stone-500">{smartCase(name)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {result.flagged.length === 0 && result.safe.length === 0 && result.unreviewed.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No ingredients found.</p>
          )}

          </section>{/* end Ingredients */}

          {/* OBF variants — collapsible "More variants from Open Beauty Facts" */}
          {result.obfVariants && result.obfVariants.length > 0 && (
            <section>
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest"
                onClick={() => setShowObfVariants((v) => !v)}
              >
                More variants from Open Beauty Facts
                <span className="text-gray-300">{showObfVariants ? "▲" : "▼"}</span>
              </button>
              {showObfVariants && (
                <div className="mt-2 divide-y divide-gray-100">
                  {result.obfVariants.map((v) => (
                    <div key={v.name} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="text-sm text-gray-700">{v.name}</p>
                        {v.brand && <p className="text-xs text-gray-400">{v.brand}</p>}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 shrink-0 ml-4"
                        onClick={() => scanVariant({
                          pasteIngredients: v.ingredients_text,
                          productName: v.name,
                          productBrand: v.brand,
                        })}
                      >
                        Scan this variant
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
