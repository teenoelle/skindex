/**
 * Promotes skindex-staging.xlsx → skindex-production.xlsx.
 *
 * Copies the ingredients, products, and data sheets from staging into
 * production. The queue sheet stays in staging only — it never goes
 * to production.
 *
 * Run with --dry-run to see what would change without writing anything.
 * Run with --sync to also push the production file to the DB immediately
 * after promoting (runs sync-products.mjs).
 */
import XLSX from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const refDir = join(__dirname, '..', '_reference');

const STAGING    = join(refDir, 'skindex-staging.xlsx');
const PRODUCTION = join(refDir, 'skindex-production.xlsx');
const SHEETS_TO_PROMOTE = ['ingredients', 'products', 'data'];

const DRY_RUN = process.argv.includes('--dry-run');
const SYNC    = process.argv.includes('--sync');

function sheetSummary(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return '(missing)';
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return `${rows.length - 1} rows`;
}

async function main() {
  const staging = XLSX.readFile(STAGING);
  const production = XLSX.readFile(PRODUCTION);

  console.log('Staging sheets:');
  SHEETS_TO_PROMOTE.forEach(s => console.log(`  ${s.padEnd(14)} ${sheetSummary(staging, s)}`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No files written.');
    return;
  }

  // Replace each sheet in production with the version from staging
  for (const sheetName of SHEETS_TO_PROMOTE) {
    const ws = staging.Sheets[sheetName];
    if (!ws) {
      console.warn(`  Warning: sheet "${sheetName}" not found in staging, skipping.`);
      continue;
    }
    // Remove existing sheet from production if present
    const idx = production.SheetNames.indexOf(sheetName);
    if (idx !== -1) {
      production.SheetNames.splice(idx, 1);
      delete production.Sheets[sheetName];
    }
    // Insert at same position (or append)
    const insertAt = Math.min(idx === -1 ? production.SheetNames.length : idx, production.SheetNames.length);
    production.SheetNames.splice(insertAt, 0, sheetName);
    production.Sheets[sheetName] = ws;
    console.log(`  ✓ Promoted: ${sheetName} (${sheetSummary(staging, sheetName)})`);
  }

  XLSX.writeFile(production, PRODUCTION);
  console.log('\nskindex-production.xlsx updated.');

  if (SYNC) {
    console.log('\nRunning sync-products...');
    execSync('node scripts/sync-products.mjs', { stdio: 'inherit', cwd: join(__dirname, '..') });
  } else {
    console.log('Run with --sync to also push changes to the DB.');
  }
}

main().catch(console.error);
