/**
 * Fetches product images from INNIDecoder URLs stored in the spreadsheet
 * and writes them to the products table.
 *
 * The spreadsheet "iHerb" column (index 11) contains INNIDecoder URLs.
 * Fetches each page, extracts the og:image meta tag, and stores the URL.
 *
 * Run with --dry-run to preview without writing to DB.
 * Run with --force to overwrite existing image_url values.
 */
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

function clean(val) {
  return String(val).replace(/[\r\n]+/g, ' ').trim();
}

function normalizeKey(name, brand) {
  return `${name.toLowerCase().replace(/\s+/g, ' ')}|${brand.toLowerCase().replace(/\s+/g, ' ')}`;
}

async function extractOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try og:image first
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]) return ogMatch[1];

    // Fallback: twitter:image
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch?.[1]) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const filePath = join(__dirname, '..', '_reference', 'skindex-production.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['products'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Build name|brand → [iHerbUrl, inciDecoderUrl] map from spreadsheet
  // col10 = INNIDecoder URL (ID column), col11 = iHerb URL
  const urlMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = clean(row[1]);
    const brand = clean(row[2]);
    const inciUrl = clean(row[10]);   // INNIDecoder (ID column)
    const iherbUrl = clean(row[11]);  // iHerb
    if (!name) continue;
    const key = normalizeKey(name, brand);
    const urls = [];
    if (iherbUrl.startsWith('http')) urls.push(iherbUrl);
    if (inciUrl.startsWith('http')) urls.push(inciUrl);
    if (urls.length) urlMap.set(key, urls);
  }

  console.log(`Spreadsheet: ${urlMap.size} products with URLs\n`);

  // Fetch all products from DB
  const { data: dbProducts, error } = await supabase
    .from('products')
    .select('id, name, brand, image_url')
    .order('name');

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  const toFetch = [];
  for (const p of dbProducts) {
    if (p.image_url && !FORCE) continue;
    const key = normalizeKey(p.name, p.brand || '');
    const urls = urlMap.get(key);
    if (urls?.length) toFetch.push({ ...p, urls });
  }

  console.log(`${toFetch.length} products to fetch images for.\n`);
  if (DRY_RUN) {
    toFetch.forEach(p => console.log(`  [dry] ${p.name} → ${p.urls[0]}`));
    console.log('\n[DRY RUN] No changes applied.');
    return;
  }

  let ok = 0, failed = 0, skipped = 0;

  for (const p of toFetch) {
    process.stdout.write(`  Fetching: ${p.name}… `);

    // Try each URL in order (iHerb first, then INNIDecoder)
    let imageUrl = null;
    for (const url of p.urls) {
      imageUrl = await extractOgImage(url);
      if (imageUrl) break;
    }

    if (!imageUrl) {
      console.log('no image found');
      skipped++;
      continue;
    }

    const { error: upErr } = await supabase
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', p.id);

    if (upErr) {
      console.log(`error: ${upErr.message}`);
      failed++;
    } else {
      console.log(`✓ ${imageUrl.slice(0, 60)}…`);
      ok++;
    }

    // Polite delay to avoid hammering INNIDecoder
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\nDone. ${ok} images saved, ${skipped} not found, ${failed} errors.`);
}

main().catch(console.error);
