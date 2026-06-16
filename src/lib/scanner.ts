import { supabase } from "./supabase";
import type { DbIngredient, IngredientMatch } from "@/types";

// Split on commas that are not inside parentheses and not between digits
// with a following dash (e.g. "1,2-Hexanediol" must stay as one token).
export function splitIngredientList(raw: string): string[] {
  return raw
    .split(/,(?![^(]*\))(?!\s*\d[-\d])/)
    .map((s) => s.replace(/[​‌‍﻿]/g, "").trim())
    .filter(Boolean);
}

function parseIngredientList(raw: string): string[] {
  return splitIngredientList(raw)
    .map((s) =>
      s
        .replace(/\([^)]*\)/g, "")
        .trim()
        .replace(/\s+/g, " ")
    )
    .filter((s) => s.length > 1);
}

export async function matchIngredients(raw: string) {
  const items = parseIngredientList(raw);
  // Paginate — ingredients table exceeds PostgREST default 1000-row cap; .limit(N) is silently overridden
  const allData: DbIngredient[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase.from("ingredients").select("*").range(from, from + PAGE - 1);
    if (data) allData.push(...(data as DbIngredient[]));
    if (!data || data.length < PAGE) break;
  }
  const db = allData;

  const safe: IngredientMatch[] = [];
  const flagged: IngredientMatch[] = [];
  const unreviewed: string[] = [];

  for (const item of items) {
    const lower = item.toLowerCase();
    const match = db.find((ing) => {
      const n = ing.name.toLowerCase();
      const i = ing.inci_name?.toLowerCase();
      // Both direction guards prevent generic short words from false-matching complex botanical names.
      // "ceramide np" includes "ceramide" (8 chars) ✓; "rose flower water" must NOT match "water" (5 chars).
      // Short DB names (< 6 chars) are exact-match only; longer names allow substring in both directions.
      const tokenLong = lower.length >= 6;
      const dbNameLong = n.length >= 6;
      return (
        lower === n ||
        (dbNameLong && lower.includes(n)) ||
        (tokenLong && n.includes(lower)) ||
        (i && (lower === i || (i.length >= 6 && lower.includes(i)) || (tokenLong && i.includes(lower))))
      );
    });

    if (!match) unreviewed.push(item);
    else if (match.status === "safe") safe.push({ displayName: item, ingredient: match });
    else flagged.push({ displayName: item, ingredient: match });
  }

  return { safe, flagged, unreviewed };
}
