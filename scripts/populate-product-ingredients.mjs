/**
 * Populates the product_ingredients junction table.
 * Links each product to its recognized DB ingredients using the same
 * matching logic as src/lib/scanner.ts.
 *
 * Run after applying _reference/migrations/add-product-ingredients.sql.
 * Re-runnable — uses upsert so existing rows are never duplicated.
 *
 * Usage:
 *   node scripts/populate-product-ingredients.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

// Mirrors parseIngredientList in src/lib/scanner.ts
function parseIngredientList(raw) {
  return raw
    .split(/,(?![^(]*\))/)
    .map(s =>
      s
        .replace(/\([^)]*\)/g, '')
        .replace(/[​‌‍﻿]/g, '') // strip zero-width chars
        .trim()
        .replace(/\s+/g, ' ')
    )
    .filter(s => s.length > 1);
}

// Mirrors the matching logic in matchIngredients() in src/lib/scanner.ts
function findMatch(token, dbIngredients) {
  const lower = token.toLowerCase();
  const tokenLong = lower.length >= 6;
  return dbIngredients.find(ing => {
    const n = ing.name.toLowerCase();
    const i = ing.inci_name?.toLowerCase();
    return (
      lower.includes(n) ||
      (tokenLong && n.includes(lower)) ||
      (i && (lower.includes(i) || (tokenLong && i.includes(lower))))
    );
  });
}

async function main() {
  // Fetch all ingredients
  const { data: ingredients, error: ingErr } = await supabase
    .from('ingredients')
    .select('id, name, inci_name');
  if (ingErr) { console.error('Ingredients fetch error:', ingErr.message); process.exit(1); }

  // Fetch all products with ingredient lists
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, ingredient_list')
    .not('ingredient_list', 'is', null);
  if (prodErr) { console.error('Products fetch error:', prodErr.message); process.exit(1); }

  console.log(`${ingredients.length} ingredients in DB`);
  console.log(`${products.length} products with ingredient lists\n`);

  let totalLinks = 0;
  let totalUnreviewed = 0;
  const allRows = [];

  for (const product of products) {
    const tokens = parseIngredientList(product.ingredient_list);
    const rows = [];
    const seenIngredientIds = new Set();

    for (let i = 0; i < tokens.length; i++) {
      const match = findMatch(tokens[i], ingredients);
      if (match && !seenIngredientIds.has(match.id)) {
        seenIngredientIds.add(match.id);
        rows.push({
          product_id: product.id,
          ingredient_id: match.id,
          position: i + 1,
        });
      } else if (!match) {
        totalUnreviewed++;
      }
    }

    totalLinks += rows.length;
    allRows.push(...rows);

    if (DRY_RUN) {
      console.log(`  [dry] ${product.name}: ${rows.length} links, ${tokens.length - rows.length} unreviewed`);
    }
  }

  console.log(`Total links to insert: ${totalLinks}`);
  console.log(`Total unreviewed tokens (skipped): ${totalUnreviewed}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes applied.');
    return;
  }

  // Insert in batches of 200
  const BATCH = 200;
  let inserted = 0, failed = 0;

  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('product_ingredients')
      .upsert(batch, { onConflict: 'product_id,ingredient_id' });
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted} / ${allRows.length}…`);
    }
  }

  console.log(`\n\nDone. ${inserted} rows inserted (${failed} failed).`);
}

main().catch(console.error);
