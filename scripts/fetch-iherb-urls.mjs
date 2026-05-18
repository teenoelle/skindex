/**
 * Generates an iHerb link report for products with no iherb_url.
 *
 * iHerb blocks all automated scraping (403/captcha), so this script outputs
 * a clickable HTML report instead. Open it in a browser, search each product
 * on iHerb, copy the product page URL, and paste it into the admin panel.
 *
 * Alternatively, use the admin panel's "Search on iHerb" links directly.
 *
 * Flags:
 *   --source incidecoder   Only products from INCIDecoder (default: all)
 *   --out report.html      Output file (default: iherb-report.html)
 *
 * Examples:
 *   node scripts/fetch-iherb-urls.mjs
 *   node scripts/fetch-iherb-urls.mjs --source incidecoder --out report.html
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SOURCE = (() => {
  const i = process.argv.indexOf('--source');
  return i !== -1 ? process.argv[i + 1] : null;
})();
const OUT = (() => {
  const i = process.argv.indexOf('--out');
  return i !== -1 ? process.argv[i + 1] : 'iherb-report.html';
})();

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const RCODE = 'DYT4743';

function iherbSearchUrl(name, brand) {
  const q = [brand, name].filter(Boolean).join(' ');
  return `https://www.iherb.com/search?kw=${encodeURIComponent(q)}&rcode=${RCODE}`;
}

async function main() {
  let query = supabase
    .from('products')
    .select('id, name, brand, source, type, iherb_url')
    .is('iherb_url', null)
    .not('ingredient_list', 'is', null)
    .order('brand', { ascending: true, nullsFirst: false })
    .order('name');

  if (SOURCE) query = query.eq('source', SOURCE);

  const { data: products, error } = await query;
  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  console.log(`${products.length} products without iherb_url`);

  const rows = products.map((p) => {
    const searchUrl = iherbSearchUrl(p.name, p.brand);
    const adminUrl  = `http://localhost:3001/?scan=${p.id}`;
    return `
    <tr>
      <td>${p.brand ?? '<em>—</em>'}</td>
      <td>${p.name}</td>
      <td>${p.type ?? '<em>—</em>'}</td>
      <td>${p.source ?? ''}</td>
      <td>
        <a href="${searchUrl}" target="_blank">iHerb ↗</a>
      </td>
      <td>
        <a href="${adminUrl}" target="_blank">Admin scan ↗</a>
      </td>
    </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>iHerb Link Report — SKINdex</title>
<style>
  body { font-family: -apple-system, sans-serif; font-size: 13px; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p.sub { color: #666; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; padding: 6px 10px; font-size: 11px; text-transform: uppercase;
       letter-spacing: 0.05em; color: #888; border-bottom: 2px solid #eee; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  tr:hover td { background: #fafafa; }
  a { color: #4f46e5; text-decoration: none; }
  a:hover { text-decoration: underline; }
  em { color: #bbb; font-style: normal; }
</style>
</head>
<body>
<h1>iHerb Link Report</h1>
<p class="sub">${products.length} products without an iHerb URL · generated ${new Date().toLocaleString()}</p>
<p class="sub">
  For each product: click <strong>iHerb ↗</strong>, find the matching product,
  copy its URL, then paste it into the Admin panel's iHerb URL field and save.
</p>
<table>
  <thead>
    <tr>
      <th>Brand</th>
      <th>Name</th>
      <th>Type</th>
      <th>Source</th>
      <th>iHerb</th>
      <th>Admin</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
</body>
</html>`;

  writeFileSync(OUT, html, 'utf8');
  console.log(`Report written to ${OUT}`);
  console.log(`Open it in a browser and use the "Search on iHerb" links to find each product.`);
}

main().catch(console.error);
