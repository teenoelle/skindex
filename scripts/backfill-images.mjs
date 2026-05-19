// Backfills image_url for products that have none, using OpenBeautyFacts + INCIDecoder.
// Usage: node --env-file=.env.local scripts/backfill-images.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local");
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

function obfFullImage(url) {
  if (!url) return null;
  return url.replace(/\.\d+\.jpg$/, ".full.jpg");
}

async function fetchNoImageProducts() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,name,brand&image_url=is.null&limit=200`,
    { headers: HEADERS }
  );
  return res.json();
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Referer": "https://www.google.com/",
};

async function searchOBF(name) {
  const url = `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=3`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data?.products ?? [];
    for (const p of products) {
      const img = obfFullImage(p.image_front_url ?? p.image_url ?? null);
      if (img) return img;
    }
  } catch { /* timeout or parse error */ }
  return null;
}

function extractINCIDecoderImage(html) {
  // Prefer srcset (current INCIDecoder format — og:image is absent in SSR HTML)
  const m1 = html.match(/srcset="(https:\/\/incidecoder-content\.storage\.googleapis\.com\/[^"]+)"/i);
  if (m1?.[1]) {
    const raw = m1[1].replace(/&amp;/g, "&").split(" ")[0];
    return raw.replace(/_([\d]+x[\d]+@[\dx]+|[\d]+x[\d]+)\.[a-z]+$/i, "_original.jpeg");
  }
  const m2 = html.match(/src="(https:\/\/incidecoder-content\.storage\.googleapis\.com\/[^"]+)"/i);
  if (m2) return m2[1].replace(/&amp;/g, "&");
  return null;
}

async function searchINCIDecoder(name, brand) {
  const query = brand ? `${brand} ${name}` : name;
  const searchUrl = `https://incidecoder.com/search?query=${encodeURIComponent(query)}`;
  try {
    const searchRes = await fetch(searchUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!searchRes.ok) return null;
    const html = await searchRes.text();

    // Find the first product link in search results
    const match = html.match(/href="(\/products\/[^"]+)"/i);
    if (!match) return null;
    const productPath = match[1];

    await sleep(800);
    const productRes = await fetch(`https://incidecoder.com${productPath}`, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!productRes.ok) return null;
    const productHtml = await productRes.text();
    return extractINCIDecoderImage(productHtml);
  } catch { /* blocked or timeout */ }
  return null;
}

async function updateImage(id, imageUrl) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${id}`,
    {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  return res.ok;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const products = await fetchNoImageProducts();
console.log(`Found ${products.length} products without images\n`);

let updated = 0;
let notFound = 0;

for (const p of products) {
  process.stdout.write(`  ${p.name} (${p.brand ?? "?"})... `);

  let img = await searchOBF(p.name);
  let source = "OBF";

  if (!img) {
    await sleep(600);
    img = await searchINCIDecoder(p.name, p.brand);
    source = "INCIDecoder";
  }

  if (img) {
    const ok = await updateImage(p.id, img);
    if (ok) {
      console.log(`✓ [${source}] ${img.split("/").pop()}`);
      updated++;
    } else {
      console.log("✗ DB update failed");
    }
  } else {
    console.log("— not found");
    notFound++;
  }
  await sleep(500);
}

console.log(`\nDone. Updated: ${updated} / ${products.length}  |  Not found: ${notFound}`);
