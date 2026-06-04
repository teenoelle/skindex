"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { SkinType, ClimateType } from "@/lib/skin-profile";

type SkinProfileContextValue = {
  activeSkinTypes: Set<SkinType>;
  activeClimates: Set<ClimateType>;
  toggleSkinType: (t: SkinType) => void;
  toggleClimate: (c: ClimateType) => void;
  loaded: boolean;
};

const SkinProfileContext = createContext<SkinProfileContextValue>({
  activeSkinTypes: new Set(),
  activeClimates: new Set(),
  toggleSkinType: () => {},
  toggleClimate: () => {},
  loaded: false,
});

export function SkinProfileProvider({ children }: { children: ReactNode }) {
  const [activeSkinTypes, setActiveSkinTypes] = useState<Set<SkinType>>(new Set());
  const [activeClimates, setActiveClimates] = useState<Set<ClimateType>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount (works for both authed and unauthed users)
  useEffect(() => {
    try {
      const st = localStorage.getItem("skindex:skinTypes");
      const cl = localStorage.getItem("skindex:climates");
      if (st) setActiveSkinTypes(new Set(JSON.parse(st) as SkinType[]));
      if (cl) setActiveClimates(new Set(JSON.parse(cl) as ClimateType[]));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const toggleSkinType = useCallback((t: SkinType) => {
    setActiveSkinTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      try { localStorage.setItem("skindex:skinTypes", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleClimate = useCallback((c: ClimateType) => {
    setActiveClimates((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      try { localStorage.setItem("skindex:climates", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <SkinProfileContext.Provider value={{ activeSkinTypes, activeClimates, toggleSkinType, toggleClimate, loaded }}>
      {children}
    </SkinProfileContext.Provider>
  );
}

export function useSkinProfile() {
  return useContext(SkinProfileContext);
}
