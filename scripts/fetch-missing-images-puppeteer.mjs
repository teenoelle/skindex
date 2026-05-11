/**
 * Fetches images for products still missing image_url using a headless browser
 * (Puppeteer) to bypass Cloudflare bot protection on iHerb and INCI Decoder.
 *
 * Uses the service role key to bypass RLS on the products table.
 *
 * Usage:
 *   node scripts/fetch-missing-images-puppeteer.mjs [--dry-run]
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
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

async function getOgImage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    const imageUrl = await page.evaluate(() => {
      const og = document.querySelector('meta[property="og:image"]');
      if (og) return og.getAttribute('content');
      const tw = document.querySelector('meta[name="twitter:image"]');
      if (tw) return tw.getAttribute('content');
      return null;
    });
    return imageUrl || null;
  } catch {
    return null;
  }
}

async function main() {
  // Load spreadsheet URL map
  const wb = XLSX.readFile(join(__dirname, '..', '_reference', 'skindex-production.xlsx'));
  const ws = wb.Sheets['products'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const urlMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][1]).toLowerCase().trim();
    const iherbUrl = String(rows[i][11]);
    const inciUrl = String(rows[i][10]);
    const url = iherbUrl.startsWith('http') ? iherbUrl : inciUrl.startsWith('http') ? inciUrl : null;
    urlMap.set(name, url);
  }

  // Get products still missing images
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, image_url')
    .is('image_url', null)
    .order('name');
  if (error) { console.error(error.message); process.exit(1); }

  // Only try product-specific iHerb URLs — category pages have no product og:image
  const toFetch = products.filter(p => {
    const url = urlMap.get(p.name.toLowerCase().trim()) ?? '';
    return url.includes('/pr/');
  });
  console.log(`${products.length} missing images, ${toFetch.length} have product-specific iHerb URLs\n`);

  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  // Hide webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  let found = 0, notFound = 0;

  for (const p of toFetch) {
    const spreadsheetUrl = urlMap.get(p.name.toLowerCase().trim());
    process.stdout.write(`  ${p.name}… `);

    // For il.iherb.com, try www.iherb.com first
    const urls = [];
    if (spreadsheetUrl.includes('il.iherb.com')) {
      urls.push(spreadsheetUrl.replace('il.iherb.com', 'www.iherb.com'));
    }
    urls.push(spreadsheetUrl);

    let imageUrl = null;
    for (const url of urls) {
      imageUrl = await getOgImage(page, url);
      if (imageUrl) break;
      await sleep(500);
    }

    if (!imageUrl) {
      console.log('not found');
      notFound++;
      await sleep(800);
      continue;
    }

    console.log(`✓ ${imageUrl.slice(0, 70)}`);
    found++;

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', p.id);
      if (upErr) console.error(`    DB error: ${upErr.message}`);
    }

    // Random delay 2–4s to avoid rate limiting
    await sleep(2000 + Math.floor(Math.random() * 2000));
  }

  await browser.close();

  console.log(`\nDone. ${found} found, ${notFound} not found.`);
  if (DRY_RUN) console.log('[DRY RUN] No changes applied.');
}

main().catch(console.error);
