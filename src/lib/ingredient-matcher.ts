export type DbIngredient = { id: string; name: string; inci_name: string | null; status: string };

// Mirrors the parsing logic in src/lib/scanner.ts — must stay in sync
export function parseIngredientList(raw: string): string[] {
  return raw
    .split(/,(?![^(]*\))(?!\s*\d[-\d])/)
    .map((s) => s.replace(/[​‌‍﻿]/g, "").trim())
    .map((s) => s.replace(/\([^)]*\)/g, "").trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 1);
}

export function findMatch(item: string, db: DbIngredient[]): DbIngredient | undefined {
  const lower = item.toLowerCase();
  return db.find((ing) => {
    const n = ing.name.toLowerCase();
    const i = ing.inci_name?.toLowerCase();
    const tokenLong = lower.length >= 6;
    const dbNameLong = n.length >= 6;
    return (
      lower === n ||
      (dbNameLong && lower.includes(n)) ||
      (tokenLong && n.includes(lower)) ||
      (i && (lower === i || (i.length >= 6 && lower.includes(i)) || (tokenLong && i.includes(lower))))
    );
  });
}
