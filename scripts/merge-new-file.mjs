/**
 * Merges topical ingredients (3).xlsx into skindex-staging.xlsx:
 *   - Updates iHerb URLs for existing products
 *   - Appends genuinely new products
 *
 * Usage: node scripts/merge-new-file.mjs [--dry-run]
 */
import XLSX from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const NEW_FILE  = join(__dirname, '..', '_reference', 'topical ingredients (3).xlsx');
const STAGING   = join(__dirname, '..', '_reference', 'skindex-staging.xlsx');

const clean = v => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
const key   = (name, brand) => clean(name).toLowerCase() + '|' + clean(brand).toLowerCase();

const newWb  = XLSX.readFile(NEW_FILE);
const stagWb = XLSX.readFile(STAGING);

// ── products sheet ────────────────────────────────────────────────────────────
const newProdRows  = XLSX.utils.sheet_to_json(newWb.Sheets['products'],  { header: 1, defval: '' });
const stagProdRows = XLSX.utils.sheet_to_json(stagWb.Sheets['products'], { header: 1, defval: '' });

const newHeaders  = newProdRows[0];
const stagHeaders = stagProdRows[0];

// col indices in new file
const N_NAME   = 1, N_BRAND = 2, N_IHERB = 11;
// col indices in staging (same layout)
const S_NAME   = 1, S_BRAND = 2, S_IHERB = 11;

// Build staging lookup: key → row index (1-based offset from slice)
const stagIndex = new Map();
for (let i = 1; i < stagProdRows.length; i++) {
  const r = stagProdRows[i];
  stagIndex.set(key(r[S_NAME], r[S_BRAND]), i);
}

let updated = 0, added = 0;

for (let i = 1; i < newProdRows.length; i++) {
  const nr = newProdRows[i];
  const k  = key(nr[N_NAME], nr[N_BRAND]);
  const newHerb = clean(nr[N_IHERB]);

  if (stagIndex.has(k)) {
    // Existing product — update iHerb URL if new file has one and staging doesn't
    const si = stagIndex.get(k);
    const stagHerb = clean(stagProdRows[si][S_IHERB]);
    if (newHerb.startsWith('http') && !stagHerb.startsWith('http')) {
      if (!DRY_RUN) stagProdRows[si][S_IHERB] = newHerb;
      console.log(`  [update iHerb] ${clean(nr[N_NAME])}  →  ${newHerb}`);
      updated++;
    }
  } else {
    // New product — append using staging column layout (same as new file)
    const newRow = Array(stagHeaders.length).fill('');
    for (let c = 0; c < Math.min(nr.length, newRow.length); c++) {
      newRow[c] = clean(nr[c]);
    }
    if (!DRY_RUN) stagProdRows.push(newRow);
    console.log(`  [add] ${clean(nr[N_NAME])} — ${clean(nr[N_BRAND])}`);
    added++;
  }
}

console.log(`\niHerb URLs updated: ${updated}`);
console.log(`New products added: ${added}`);

if (DRY_RUN) {
  console.log('\n[DRY RUN] No files written.');
  process.exit(0);
}

// Write updated products sheet back
const updatedSheet = XLSX.utils.aoa_to_sheet(stagProdRows);
// Preserve column widths
updatedSheet['!cols'] = stagWb.Sheets['products']['!cols'];
stagWb.Sheets['products'] = updatedSheet;

XLSX.writeFile(stagWb, STAGING);
console.log('\nskindex-staging.xlsx updated.');
