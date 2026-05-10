/**
 * Tags photosensitive ingredients in the DB with a photo_note.
 * Run after applying _reference/migrations/add-photo-note.sql.
 *
 * Usage: node scripts/tag-photo-ingredients.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const PHOTO_PATTERNS = [
  {
    pattern: /retinol|retinyl palmitate|retinyl acetate|retinaldehyde|tretinoin/i,
    level: 'avoid',
    note: 'Increases skin cell turnover, leaving new skin more vulnerable to UV damage. Use SPF daily and avoid prolonged sun exposure.',
  },
  {
    pattern: /glycolic acid|lactic acid|mandelic acid|tartaric acid|gluconolactone|polyglutamic acid|\barbutin\b|alpha.arbutin/i,
    level: 'avoid',
    note: 'Chemical exfoliant that removes the outer protective skin layer, increasing UV vulnerability. Apply SPF when using.',
  },
  {
    pattern: /limonene|citral|bergapten|bergamot|citrus aurantium|citrus limon|citrus sinensis|citrus grandis|citrus paradisi|grapefruit/i,
    level: 'avoid',
    note: 'Contains phototoxic compounds that can cause burns or lasting hyperpigmentation on sun-exposed skin.',
  },
];

function norm(name) {
  return name.replace(/[​‌‍﻿]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, name');

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  console.log(`${ingredients.length} ingredients fetched`);

  const toTag = [];
  for (const ing of ingredients) {
    const cleaned = norm(ing.name).replace(/\([^)]*\)/g, '').trim();
    for (const rule of PHOTO_PATTERNS) {
      if (rule.pattern.test(cleaned)) {
        toTag.push({ id: ing.id, name: ing.name, note: rule.note, level: rule.level });
        break;
      }
    }
  }

  console.log(`${toTag.length} photosensitive ingredients found:`);
  toTag.forEach(i => console.log(`  [${i.level}] ${i.name}`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes applied.');
    return;
  }

  let ok = 0, fail = 0;
  for (const ing of toTag) {
    const { error } = await supabase
      .from('ingredients')
      .update({ photo_note: ing.note })
      .eq('id', ing.id);
    if (error) {
      console.error(`  ✗ ${ing.name}: ${error.message}`);
      fail++;
    } else {
      ok++;
    }
  }

  console.log(`\nDone. Tagged: ${ok} (${fail} failed)`);
}

main().catch(console.error);
