/**
 * Fetches product images for products with no image_url.
 * Sources tried in order:
 *   1. Open Beauty Facts search
 *   2. INCI Decoder search → product page
 *
 * Run with --dry-run to preview without writing to DB.
 */
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html',
};

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function similarity(a, b) {
  const ta = new Set(normalize(a).split(' ').filter(Boolean));
  const tb = new Set(normalize(b).split(' ').filter(Boolean));
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000), ...opts });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// ── Source 1: Open Beauty Facts ──────────────────────────────────────────────

async function queryOBF(query) {
  const url = `https://world.openbeautyfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&json=1&fields=product_name,brands,image_front_url,image_url&page_size=5`;
  const res = await safeFetch(url, { headers: { 'User-Agent': 'SKINdex/1.0' } });
  if (!res) return [];
  const data = await res.json().catch(() => ({}));
  return data?.products || [];
}

async function searchOBF(name, brand) {
  const nameNoBrand = normalize(name).startsWith(normalize(brand).split(' ')[0])
    ? name.replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim() || name
    : name;

  for (const query of [`${brand} ${nameNoBrand}`, name]) {
    const products = await queryOBF(query);
    const best = products
      .map(p => ({
        nameScore: similarity(name, p.product_name || ''),
        brandScore: similarity(brand, p.brands || ''),
        imageUrl: p.image_front_url || p.image_url || null,
        pName: p.product_name || '',
      }))
      .filter(p => p.imageUrl && p.nameScore >= 0.4)
      .sort((a, b) => (b.nameScore + b.brandScore) - (a.nameScore + a.brandScore))[0];
    if (best) return { imageUrl: best.imageUrl, source: 'OBF', label: `${Math.round(best.nameScore * 100)}% match: ${best.pName}` };
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

// ── Source 2: INCI Decoder ───────────────────────────────────────────────────

async function searchInciDecoder(name, brand) {
  const query = `${brand} ${name}`.replace(/\s+/g, ' ').trim();
  const searchRes = await safeFetch(`https://incidecoder.com/search?query=${encodeURIComponent(query)}`);
  if (!searchRes) return null;
  const html = await searchRes.text();

  const slugs = [...html.matchAll(/href="(\/products\/[^"]+)"/g)]
    .map(m => m[1])
    .filter(l => !l.includes('/create') && !l.includes('/recommend'));

  if (!slugs.length) return null;

  // Score slugs by name similarity before fetching
  const scored = slugs
    .map(slug => {
      const slugName = slug.replace('/products/', '').replace(/-/g, ' ');
      return { slug, score: similarity(name, slugName) };
    })
    .filter(s => s.score >= 0.3)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  await new Promise(r => setTimeout(r, 400));

  const pageRes = await safeFetch(`https://incidecoder.com${scored[0].slug}`);
  if (!pageRes) return null;
  const page = await pageRes.text();

  // Extract product image from <img> tag (served in HTML, not og:image)
  const imgMatch = page.match(/src="(https:\/\/incidecoder-content\.storage\.googleapis\.com[^"]+_front_photo_original[^"]*)"/);
  if (!imgMatch) return null;

  // Validate alt text matches our product name
  const altMatch = page.match(new RegExp(`src="${imgMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*alt="([^"]+)"`));
  const altText = altMatch?.[1] || '';
  const nameScore = similarity(name, altText);

  if (nameScore < 0.3) return null;

  return {
    imageUrl: imgMatch[1],
    source: 'INCI Decoder',
    label: `${Math.round(nameScore * 100)}% match: ${altText || scored[0].slug}`,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, image_url')
    .is('image_url', null)
    .order('name');

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  console.log(`${products.length} products without images — searching...\n`);

  let ok = 0, failed = 0;

  for (const p of products) {
    process.stdout.write(`  ${p.name}… `);

    const result = await searchOBF(p.name, p.brand || '')
      || await searchInciDecoder(p.name, p.brand || '');

    if (!result) {
      console.log('not found');
      failed++;
    } else {
      console.log(`✓ [${result.source}] ${result.label}`);
      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('products')
          .update({ image_url: result.imageUrl })
          .eq('id', p.id);
        if (upErr) console.log(`    ERROR: ${upErr.message}`);
      } else {
        console.log(`    → ${result.imageUrl.slice(0, 80)}`);
      }
      ok++;
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\nDone. ${ok} images ${DRY_RUN ? 'would be' : ''} saved, ${failed} not found.`);
  if (DRY_RUN) console.log('[DRY RUN] No changes applied.');
}

main().catch(console.error);
