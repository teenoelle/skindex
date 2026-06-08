"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useSkinProfile } from "@/context/SkinProfileContext";
import {
  SKIN_TYPES, CLIMATE_TYPES, WATER_TYPES, DEVICE_TYPES,
  SUPPLEMENT_TYPES, DIET_TYPES, HORMONE_TYPES, LIFESTYLE_TYPES,
} from "@/lib/skin-profile";

const SMART_LISTS = [
  { id: "universal-concerns", name: "Universal Concerns", color: "text-rose-700" },
  { id: "my-sensitivities", name: "My Sensitivities", color: "text-amber-700" },
  { id: "neutral-beneficial", name: "Neutral & Beneficial", color: "text-teal-700" },
];

const MODIFIER_GROUPS = [
  { label: "Climate", items: CLIMATE_TYPES },
  { label: "Water", items: WATER_TYPES },
  { label: "Devices", items: DEVICE_TYPES },
  { label: "Supplements", items: SUPPLEMENT_TYPES },
  { label: "Diet", items: DIET_TYPES },
  { label: "Hormones", items: HORMONE_TYPES },
  { label: "Lifestyle", items: LIFESTYLE_TYPES },
];

type UserList = { id: string; name: string; itemCount: number };
type IngredientList = { id: string; name: string };

export default function SidePanel() {
  const { isSignedIn, isLoaded } = useUser();
  const { activeSkinTypes, activeClimates, toggleSkinType, toggleClimate } = useSkinProfile();

  const [open, setOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [modifiersExpanded, setModifiersExpanded] = useState(false);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [ingredientLists, setIngredientLists] = useState<IngredientList[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);

  // Persist open/closed state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("skindex:sidePanel");
      if (saved === "open") setOpen(true);
    } catch { /* ignore */ }
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem("skindex:sidePanel", next ? "open" : "closed"); } catch { /* ignore */ }
      if (next && !listsLoaded) loadLists();
      return next;
    });
  }, [listsLoaded]);

  async function loadLists() {
    setListsLoaded(true);
    try {
      const [listsRes, ingRes] = await Promise.all([
        fetch("/api/lists"),
        fetch("/api/user-ingredient-lists"),
      ]);
      if (listsRes.ok) {
        const d = await listsRes.json();
        setUserLists((d.lists ?? []).map((l: { id: string; name: string; itemCount?: number }) => ({
          id: l.id, name: l.name, itemCount: l.itemCount ?? 0,
        })));
      }
      if (ingRes.ok) {
        const d = await ingRes.json();
        setIngredientLists(d.lists ?? []);
      }
    } catch { /* ignore */ }
  }

  // Swipe-from-left gesture
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0));
      // Open: swipe right starting within 24px of left edge
      if (!open && touchStartX.current < 24 && dx > 48 && dy < 60) {
        toggleOpen();
      }
      // Close: swipe left while panel is open
      if (open && dx < -48 && dy < 60) {
        toggleOpen();
      }
      touchStartX.current = null;
      touchStartY.current = null;
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, toggleOpen]);

  const hasProfile = activeSkinTypes.size > 0 || activeClimates.size > 0;

  return (
    <>
      {/* Edge handle — always visible, fixed left strip */}
      <button
        type="button"
        aria-label={open ? "Close panel" : "Open panel"}
        onClick={toggleOpen}
        className={`fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-14 rounded-r-lg bg-white border border-l-0 border-gray-200 shadow-sm transition-all duration-300 hover:bg-gray-50 ${open ? "left-72" : "left-0"}`}
      >
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Overlay dim */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={toggleOpen}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 z-50 bg-white border-r border-gray-100 shadow-xl flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
          <span className="text-sm font-semibold tracking-tight text-gray-900">My Profile & Lists</span>
          <button type="button" onClick={toggleOpen} className="text-gray-400 hover:text-gray-700 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Skin types */}
          <div className="px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setProfileExpanded((v) => !v)}
              className="flex items-center justify-between w-full mb-2 group"
            >
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Skin type
                {activeSkinTypes.size > 0 && (
                  <span className="ml-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-1.5 py-0">{activeSkinTypes.size}</span>
                )}
              </span>
              <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform ${profileExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {profileExpanded && (
              <div className="flex flex-wrap gap-1.5">
                {SKIN_TYPES.map((t) => {
                  const active = activeSkinTypes.has(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleSkinType(t.value)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modifiers */}
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setModifiersExpanded((v) => !v)}
              className="flex items-center justify-between w-full mb-2 group"
            >
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Environment & lifestyle
                {activeClimates.size > 0 && (
                  <span className="ml-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-1.5 py-0">{activeClimates.size}</span>
                )}
              </span>
              <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform ${modifiersExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {modifiersExpanded && (
              <div className="space-y-3">
                {MODIFIER_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((item) => {
                        const active = activeClimates.has(item.value);
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => toggleClimate(item.value)}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${active ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {!hasProfile && (
            <p className="px-4 pb-3 text-xs text-gray-400">Set your skin type above to personalise ingredient scanning.</p>
          )}

          <div className="border-t border-gray-100 mx-4" />

          {/* Ingredient Lists — built-in + user's saved */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Ingredient Lists</p>
            <div className="space-y-1">
              {SMART_LISTS.map((sl) => (
                <Link
                  key={sl.id}
                  href={`/lists/built-in/${sl.id}`}
                  onClick={toggleOpen}
                  className={`flex items-center justify-between py-1.5 text-sm hover:underline underline-offset-2 ${sl.color}`}
                >
                  {sl.name}
                  <svg className="w-3.5 h-3.5 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
            {isLoaded && isSignedIn && ingredientLists.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                {ingredientLists.slice(0, 4).map((l) => (
                  <Link
                    key={l.id}
                    href={`/lists?tab=ingredients`}
                    onClick={toggleOpen}
                    className="block py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:underline underline-offset-2 truncate"
                  >
                    {l.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Saved product lists — only for signed-in users */}
          {isLoaded && isSignedIn && (
            <>
              <div className="border-t border-gray-100 mx-4" />
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Product lists</p>
                  <Link href="/lists" onClick={toggleOpen} className="text-xs text-gray-400 hover:text-gray-700">View all →</Link>
                </div>
                {userLists.length === 0 ? (
                  <p className="text-xs text-gray-400">No lists yet.</p>
                ) : (
                  <div className="space-y-1">
                    {userLists.slice(0, 6).map((l) => (
                      <Link
                        key={l.id}
                        href={`/lists/${l.id}`}
                        onClick={toggleOpen}
                        className="flex items-center justify-between py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:underline underline-offset-2"
                      >
                        <span className="truncate mr-2">{l.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{l.itemCount}</span>
                      </Link>
                    ))}
                    {userLists.length > 6 && (
                      <Link href="/lists" onClick={toggleOpen} className="text-xs text-gray-400 hover:text-gray-700">+{userLists.length - 6} more</Link>
                    )}
                  </div>
                )}
              </div>

            </>
          )}

          {isLoaded && !isSignedIn && (
            <>
              <div className="border-t border-gray-100 mx-4" />
              <div className="px-4 pt-3 pb-4">
                <p className="text-xs text-gray-400 mb-2">Sign in to save product and ingredient lists.</p>
                <Link href="/sign-in" onClick={toggleOpen} className="text-xs text-indigo-600 hover:underline">Sign in →</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
