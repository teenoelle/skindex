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
  const { data } = await supabase.from("ingredients").select("*");
  const db = (data || []) as DbIngredient[];

  const safe: IngredientMatch[] = [];
  const flagged: IngredientMatch[] = [];
  const unreviewed: string[] = [];

  for (const item of items) {
    const lower = item.toLowerCase();
    const match = db.find((ing) => {
      const n = ing.name.toLowerCase();
      const i = ing.inci_name?.toLowerCase();
      // lower.includes(n): "ceramide np" contains DB name "ceramide" ✓
      // n.includes(lower): only when the scanned token is substantial (>=6 chars)
      //   to prevent short words like "water" falsely matching "aloe barbadensis leaf water"
      const tokenLong = lower.length >= 6;
      return (
        lower.includes(n) ||
        (tokenLong && n.includes(lower)) ||
        (i && (lower.includes(i) || (tokenLong && i.includes(lower))))
      );
    });

    if (!match) unreviewed.push(item);
    else if (match.status === "safe") safe.push({ displayName: item, ingredient: match });
    else flagged.push({ displayName: item, ingredient: match });
  }

  return { safe, flagged, unreviewed };
}
