/**
 * Syncs the ingredient_queue table from Supabase into the queue tab
 * of skindex-staging.xlsx.
 *
 * Run this at the start of a session to see what unrecognized ingredients
 * need to be classified.
 *
 * After classifying an ingredient in conversation:
 *   1. Add it to the ingredients sheet in skindex-staging.xlsx manually
 *   2. Run populate-explanations.mjs --force to update explanations
 *   3. Run promote.mjs --sync to push to production + DB
 *   4. Mark the queue entry as 'done' in Supabase (or re-run this script
 *      after the ingredient is in the DB — it will move it to the done section)
 */
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING = join(__dirname, '..', '_reference', 'skindex-staging.xlsx');

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

async function main() {
  const { data: queue, error } = await supabase
    .from('ingredient_queue')
    .select('name, found_in, times_seen, first_seen, notes, status')
    .in('status', ['pending', 'in-progress'])
    .order('times_seen', { ascending: false });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`${queue.length} items in queue (pending + in-progress)`);

  const wb = XLSX.readFile(STAGING);

  const rows = [
    ['Ingredient', 'Found In', 'Times Seen', 'First Seen', 'Notes', 'Status'],
    ...queue.map(q => [
      q.name,
      q.found_in || '',
      q.times_seen,
      q.first_seen ? new Date(q.first_seen).toLocaleDateString() : '',
      q.notes || '',
      q.status,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 40 },
    { wch: 50 },
    { wch: 12 },
    { wch: 14 },
    { wch: 40 },
    { wch: 12 },
  ];

  // Replace queue sheet
  const idx = wb.SheetNames.indexOf('queue');
  if (idx !== -1) {
    wb.SheetNames.splice(idx, 1);
    delete wb.Sheets['queue'];
    wb.SheetNames.splice(idx, 0, 'queue');
  } else {
    wb.SheetNames.push('queue');
  }
  wb.Sheets['queue'] = ws;

  XLSX.writeFile(wb, STAGING);
  console.log('Queue tab updated in skindex-staging.xlsx');

  if (queue.length > 0) {
    console.log('\nTop items by frequency:');
    queue.slice(0, 10).forEach(q =>
      console.log(`  ${String(q.times_seen).padStart(3)}x  ${q.name}  (${q.found_in || 'unknown'})`)
    );
  }
}

main().catch(console.error);
