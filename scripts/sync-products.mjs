/**
 * Syncs products from skindex-production.xlsx into the Supabase DB.
 * - Adds products that are in the spreadsheet but not in the DB
 * - Removes products that are in the DB but not in the spreadsheet
 * - Updates ingredient_list, brand, type, pre_run for existing products if they changed
 *
 * Run with --dry-run to preview changes without applying them.
 */
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

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

function parsePreRun(val) {
  const v = clean(val).toLowerCase();
  if (v === 'yes') return 'yes';
  if (v === 'no') return 'no';
  if (v === 'maybe') return 'maybe';
  return null;
}

async function main() {
  // ── Read spreadsheet ────────────────────────────────────────────────────
  const filePath = join(__dirname, '..', '_reference', 'skindex-production.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['products'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Headers: Type, Product, Brand, Item Variant, Ingredients List,
  //          Safe Ingredients, Irritant Ingredients, Status, Reason, Pre-Run, ID, iHerb
  const sheetProducts = new Map();
  for (let i = 1; i < rows.length; i++) {
    const [type, product, brand, , ingredientsList, , , , , preRun] = rows[i];
    const name = clean(product);
    const ingList = clean(ingredientsList);
    if (!name || !ingList) continue;
    const key = normalizeKey(name, clean(brand));
    sheetProducts.set(key, {
      name,
      brand: clean(brand) || null,
      type: clean(type) || null,
      ingredient_list: ingList,
      pre_run: parsePreRun(preRun),
      source: 'community',
    });
  }

  console.log(`Spreadsheet: ${sheetProducts.size} products with ingredient lists`);

  // ── Read DB ─────────────────────────────────────────────────────────────
  const { data: dbProducts, error } = await supabase
    .from('products')
    .select('id, name, brand, type, ingredient_list, pre_run, source')
    .order('name');

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`Database: ${dbProducts.length} products\n`);

  const dbMap = new Map();
  for (const p of dbProducts) {
    const key = normalizeKey(p.name, p.brand || '');
    dbMap.set(key, p);
  }

  // ── Diff ─────────────────────────────────────────────────────────────────
  const toAdd = [];
  const toUpdate = [];
  for (const [key, sp] of sheetProducts) {
    const dbP = dbMap.get(key);
    if (!dbP) {
      toAdd.push(sp);
    } else {
      const ingChanged   = sp.ingredient_list !== dbP.ingredient_list;
      const typeChanged  = (sp.type || null) !== (dbP.type || null);
      const preRunChanged = sp.pre_run !== (dbP.pre_run || null);
      if (ingChanged || typeChanged || preRunChanged) {
        toUpdate.push({ id: dbP.id, ...sp });
      }
    }
  }

  const toRemove = [];
  for (const [key, dbP] of dbMap) {
    if (!sheetProducts.has(key)) {
      if (dbP.source !== 'auto-imported') {
        toRemove.push(dbP);
      }
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────
  console.log(`TO ADD (${toAdd.length}):`);
  toAdd.forEach(p => console.log(`  + [${p.type}] ${p.brand} — ${p.name}`));

  console.log(`\nTO REMOVE (${toRemove.length}):`);
  toRemove.forEach(p => console.log(`  - [${p.type}] ${p.brand} — ${p.name}`));

  console.log(`\nTO UPDATE (${toUpdate.length}):`);
  toUpdate.forEach(p => console.log(`  ~ [${p.type}] ${p.brand} — ${p.name} (pre_run: ${p.pre_run})`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes applied.');
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  let ok = 0, failed = 0;

  for (const p of toAdd) {
    const { error } = await supabase.from('products').insert(p);
    if (error) { console.error(`  ✗ Add "${p.name}": ${error.message}`); failed++; }
    else { console.log(`  ✓ Added: ${p.name}`); ok++; }
  }

  for (const p of toRemove) {
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { console.error(`  ✗ Remove "${p.name}": ${error.message}`); failed++; }
    else { console.log(`  ✓ Removed: ${p.name}`); ok++; }
  }

  for (const p of toUpdate) {
    const { error } = await supabase
      .from('products')
      .update({
        ingredient_list: p.ingredient_list,
        type: p.type,
        brand: p.brand,
        pre_run: p.pre_run,
      })
      .eq('id', p.id);
    if (error) { console.error(`  ✗ Update "${p.name}": ${error.message}`); failed++; }
    else { console.log(`  ✓ Updated: ${p.name}`); ok++; }
  }

  console.log(`\nDone. ${ok} changes applied, ${failed} failed.`);
}

main().catch(console.error);
