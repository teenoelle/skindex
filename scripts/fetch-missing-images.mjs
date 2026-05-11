/**
 * Fetches images for products that have no image_url in the DB.
 *
 * Strategy: search Open Beauty Facts by product name, verify the result
 * is a plausible match (brand + key words), and save the image URL.
 *
 * Uses the service role key to bypass RLS on the products table.
 *
 * Usage:
 *   node scripts/fetch-missing-images.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const serviceKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
if (!serviceKey) { console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local'); process.exit(1); }

const supabase = createClient('https://fqpqlllixjnzsdpqrovv.supabase.co', serviceKey);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Returns a 0–1 score: fraction of query words found in the candidate string.
function wordOverlap(query, candidate) {
  const qWords = normalize(query).split(' ').filter(w => w.length >= 3);
  if (!qWords.length) return 0;
  const cNorm = normalize(candidate);
  return qWords.filter(w => cNorm.includes(w)).length / qWords.length;
}

function isGoodMatch(dbProduct, obfProduct) {
  // Require a known brand — generic names without brands are too risky
  if (!dbProduct.brand) return false;

  const nameScore = wordOverlap(dbProduct.name, obfProduct.product_name ?? '');
  if (nameScore < 0.5) return false;

  // Brand must appear in OBF brand field or product name
  const brandNorm = normalize(dbProduct.brand);
  const obfBrandNorm = normalize(obfProduct.brands ?? '');
  const obfNameNorm = normalize(obfProduct.product_name ?? '');
  const brandMatch = obfBrandNorm.includes(brandNorm) || brandNorm.includes(obfBrandNorm)
    || obfNameNorm.includes(brandNorm);
  if (!brandMatch) return false;

  return true;
}

async function searchObf(name) {
  try {
    const url = `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, image_url')
    .is('image_url', null)
    .order('name');
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`${products.length} products missing images\n`);

  let found = 0, notFound = 0;

  for (const p of products) {
    process.stdout.write(`  ${p.name}… `);

    const obfResults = await searchObf(p.name);

    let imageUrl = null;
    for (const obfP of obfResults) {
      if (!isGoodMatch(p, obfP)) continue;
      const img = obfP.image_front_url || obfP.image_url;
      if (img) { imageUrl = img; break; }
    }

    if (!imageUrl) {
      console.log('not found');
      notFound++;
      await sleep(300);
      continue;
    }

    const matchedName = obfResults.find(r => isGoodMatch(p, r))?.product_name ?? '';
    console.log(`✓  [matched: "${matchedName.slice(0, 50)}"}`);
    found++;

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', p.id);
      if (upErr) console.error(`    DB error: ${upErr.message}`);
    }

    await sleep(400);
  }

  console.log(`\nDone. ${found} found, ${notFound} not found.`);
  if (DRY_RUN) console.log('[DRY RUN] No changes applied.');
}

main().catch(console.error);
