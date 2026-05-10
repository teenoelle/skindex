/**
 * Scans all products in the DB for unrecognized ingredients and pushes them
 * into ingredient_queue. Run this once to catch unreviewed ingredients across
 * all 110+ products, not just ones that users have actively scanned.
 *
 * Usage: node --env-file=.env.local scripts/scan-all-products.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseIngredientList(raw) {
  return raw
    .split(/,(?![^(]*\))/)
    .map(s => s.replace(/\([^)]*\)/g, '').replace(/[​‌‍﻿]/g, '').trim().replace(/\s+/g, ' '))
    .filter(s => s.length > 1);
}

async function main() {
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, name, ingredient_list')
    .not('ingredient_list', 'is', null);

  if (pErr) { console.error('Products error:', pErr.message); process.exit(1); }

  const { data: ingredients, error: iErr } = await supabase
    .from('ingredients')
    .select('id, name, inci_name');

  if (iErr) { console.error('Ingredients error:', iErr.message); process.exit(1); }

  console.log(`Scanning ${products.length} products against ${ingredients.length} DB ingredients...\n`);

  // Collect all unreviewed names and which products they appear in
  const unreviewedMap = new Map(); // name.toLowerCase() → { name, foundIn: Set<string> }

  for (const product of products) {
    const items = parseIngredientList(product.ingredient_list);
    for (const item of items) {
      const lower = item.toLowerCase();
      const matched = ingredients.some(ing => {
        const n = ing.name.toLowerCase();
        const i = ing.inci_name?.toLowerCase();
        const tokenLong = lower.length >= 6;
        return lower.includes(n) || (tokenLong && n.includes(lower)) ||
          (i && (lower.includes(i) || (tokenLong && i.includes(lower))));
      });
      if (!matched) {
        if (!unreviewedMap.has(lower)) {
          unreviewedMap.set(lower, { name: item, foundIn: new Set() });
        }
        unreviewedMap.get(lower).foundIn.add(product.name);
      }
    }
  }

  console.log(`Found ${unreviewedMap.size} unique unreviewed ingredients across all products.\n`);
  if (unreviewedMap.size === 0) { console.log('Queue is already complete.'); return; }

  // Fetch existing queue to avoid duplicates
  const { data: existingQueue } = await supabase
    .from('ingredient_queue')
    .select('id, name, times_seen');

  const existingByName = new Map(
    (existingQueue ?? []).map(q => [q.name.toLowerCase(), q])
  );

  let inserted = 0, updated = 0, skipped = 0;

  for (const [lower, { name, foundIn }] of unreviewedMap) {
    const existing = existingByName.get(lower);
    const productName = [...foundIn][0];

    if (existing) {
      const { error } = await supabase
        .from('ingredient_queue')
        .update({
          times_seen: existing.times_seen + foundIn.size,
          last_seen: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) { console.error(`  ✗ update "${name}":`, error.message); skipped++; }
      else { updated++; }
    } else {
      const { error } = await supabase
        .from('ingredient_queue')
        .insert({ name, found_in: productName, times_seen: foundIn.size });

      if (error) { console.error(`  ✗ insert "${name}":`, error.message); skipped++; }
      else { inserted++; }
    }
  }

  console.log(`Done. ${inserted} new, ${updated} updated, ${skipped} errors.`);
  console.log(`\nRun node scripts/sync-queue.mjs to pull the queue into the staging sheet.`);
}

main().catch(console.error);
