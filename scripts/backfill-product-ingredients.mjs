// Backfills product_ingredients for products whose ingredient lists haven't been indexed yet.
// Usage: node --env-file=.env.local scripts/backfill-product-ingredients.mjs

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local");
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function get(path) {
  const res = await fetch(SUPA + path, { headers: H });
  return res.json();
}

function parseIngredientList(raw) {
  return raw
    .split(/,(?![^(]*\))/)
    .map(s => s.replace(/\([^)]*\)/g, "").replace(/[​‌‍﻿]/g, "").trim().replace(/\s+/g, " "))
    .filter(s => s.length > 1);
}

function matchIngredients(items, db) {
  const rows = [];
  items.forEach((item, idx) => {
    const lower = item.toLowerCase();
    const match = db.find(ing => {
      const n = ing.name.toLowerCase();
      const i = ing.inci_name?.toLowerCase();
      const long = lower.length >= 6;
      return lower.includes(n) || (long && n.includes(lower)) ||
        (i && (lower.includes(i) || (long && i.includes(lower))));
    });
    if (match) rows.push({ ingredient_id: match.id, position: idx + 1 });
  });
  return rows;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Load all ingredients once
console.log("Loading ingredients...");
const ingredients = await get("/rest/v1/ingredients?select=id,name,inci_name&limit=2000");
console.log(`  ${ingredients.length} ingredients loaded`);

// Get all products with ingredient_list
const allProducts = await get("/rest/v1/products?select=id,name,ingredient_list&ingredient_list=not.is.null&limit=500");

// Get all product IDs already in product_ingredients
const piRows = await get("/rest/v1/product_ingredients?select=product_id&limit=2000");
const indexed = new Set(piRows.map(r => r.product_id));

const toIndex = allProducts.filter(p => !indexed.has(p.id));
console.log(`\n${allProducts.length} products with ingredient_list, ${indexed.size} already indexed, ${toIndex.length} to backfill\n`);

let done = 0, skipped = 0;

for (const product of toIndex) {
  const items = parseIngredientList(product.ingredient_list);
  const matched = matchIngredients(items, ingredients);

  if (matched.length === 0) {
    process.stdout.write(`  ${product.name}: no matches, skipping\n`);
    skipped++;
    continue;
  }

  // Deduplicate by ingredient_id — one DB ingredient can match multiple list items
  const seen = new Set();
  const rows = matched
    .filter(r => { if (seen.has(r.ingredient_id)) return false; seen.add(r.ingredient_id); return true; })
    .map(r => ({ product_id: product.id, ingredient_id: r.ingredient_id, position: r.position }));
  const res = await fetch(`${SUPA}/rest/v1/product_ingredients`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });

  if (res.ok) {
    console.log(`  ✓ ${product.name}: ${matched.length} ingredients indexed`);
    done++;
  } else {
    console.log(`  ✗ ${product.name}: ${await res.text()}`);
  }

  await sleep(100);
}

console.log(`\nDone. Indexed: ${done}  |  Skipped (no matches): ${skipped}  |  Total: ${toIndex.length}`);
