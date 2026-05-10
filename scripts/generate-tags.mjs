/**
 * Generates activity_tags and activity_note for all products in the DB.
 *
 * Tags are derived from:
 *   1. pre_run value (from spreadsheet, synced to DB) → exercise verdict tag
 *   2. Ingredient DB matches → category-based reason tags
 *   3. Pattern matching on raw ingredient list → catches photosensitizers not yet in DB
 *
 * Safe to re-run. Pass --force to regenerate tags for products that already have them.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const FORCE = process.argv.includes('--force');

// ── Tag vocabulary ──────────────────────────────────────────────────────────

// Exercise verdict — one per product
const EXERCISE_VERDICT = {
  yes:   'exercise-safe',
  no:    'exercise-avoid',
  maybe: 'exercise-caution',
};

// Reason tags → human-readable note fragments
const TAG_NOTES = {
  'heavy-formula':            'Heavy formula — may drip or clog pores during exercise.',
  'occlusive':                'Occlusive — traps heat and prevents skin from cooling through sweat.',
  'sweat-reactive':           'Contains ingredients that can sting, become sticky, or crust when activated by sweat.',
  'makeup-migrates':          'Makeup formula — may migrate into pores or run into eyes during exercise.',
  'photosensitive-retinol':   'Contains retinol — significantly increases UV sensitivity outdoors.',
  'photosensitive-aha':       'Contains AHA exfoliants — increases sun sensitivity for days after use.',
  'photosensitive-chemical-spf': 'Chemical UV filters may run into eyes with sweat and increase sun sensitivity.',
  'photosensitive-citrus':    'Contains phototoxic citrus compounds — can react with UV on skin.',
};

const EXERCISE_NOTES = {
  'exercise-safe':    'Light formula, sweat-stable, no photosensitizers.',
  'exercise-caution': 'Use with caution before exercise — check conditions.',
  'exercise-avoid':   'Not recommended before exercise.',
};

// ── Ingredient category → reason tags ──────────────────────────────────────
// Maps DB ingredient name patterns to reason tags.
// Checked against each matched ingredient's name (case-insensitive).
const CATEGORY_TAG_RULES = [
  { pattern: /shea butter|butyrospermum/i,          tags: ['heavy-formula', 'occlusive'] },
  { pattern: /cocoa butter|theobroma cacao/i,        tags: ['heavy-formula', 'occlusive'] },
  { pattern: /benzophenone|avobenzone|butyl methoxy|ethylhexyl methoxy|ethylhexyl salicylate|homosalate|octocrylene/i,
                                                      tags: ['photosensitive-chemical-spf'] },
  { pattern: /fragrance|parfum|citral|geraniol|limonene|linalool/i,
                                                      tags: ['sweat-reactive'] },
  { pattern: /alcohol denat|isopropyl alcohol/i,     tags: ['sweat-reactive'] },
  { pattern: /retinol/i,                             tags: ['photosensitive-retinol'] },
  { pattern: /salicylic acid|benzoyl peroxide/i,     tags: ['sweat-reactive'] },
  { pattern: /triethanolamine/i,                     tags: ['sweat-reactive'] },
  { pattern: /sodium hyaluronate|hyaluronic acid|hyaluronan/i,
                                                      tags: ['sweat-reactive'] },
  { pattern: /aloe barbadensis|aloe vera|aloe ferox/i,
                                                      tags: ['sweat-reactive'] },
  { pattern: /propolis/i,                            tags: ['sweat-reactive'] },
];

// ── Pattern matching on raw ingredient list ─────────────────────────────────
// Catches photosensitizers that may not be in the ingredient DB yet.
const RAW_PATTERN_RULES = [
  { pattern: /glycolic acid|lactic acid|mandelic acid|tartaric acid/i,
    tags: ['photosensitive-aha'] },
  { pattern: /gluconolactone|polyglutamic acid/i,
    tags: ['photosensitive-aha'] },
  { pattern: /\barbutin\b|alpha.arbutin/i,
    tags: ['photosensitive-aha'] },
  { pattern: /limonene|citral|bergapten|bergamot|citrus aurantium|citrus limon|citrus sinensis/i,
    tags: ['photosensitive-citrus'] },
  { pattern: /citrus grandis|citrus paradisi|grapefruit/i,
    tags: ['photosensitive-citrus'] },
  { pattern: /retinyl palmitate|retinyl acetate|retinaldehyde|tretinoin/i,
    tags: ['photosensitive-retinol'] },
  { pattern: /white willow bark|salix alba/i,
    tags: ['sweat-reactive'] },
  { pattern: /aloe barbadensis|aloe vera|aloe ferox/i,
    tags: ['sweat-reactive'] },
  { pattern: /sodium hyaluronate|hyaluronic acid/i,
    tags: ['sweat-reactive'] },
];

// ── Product type signals ────────────────────────────────────────────────────
// Only used when ingredient analysis is ambiguous. Not the primary signal.
const HEAVY_TYPES = new Set(['ointment', 'balm', 'oil']);
const MAKEUP_TYPES = new Set(['foundation', 'concealer', 'blush', 'powder']);
const LIGHT_TYPES  = new Set(['face wash', 'toner', 'mist', 'serum', 'ampoule', 'extract',
                               'spot patches', 'emulsion', 'shampoo']);

// ── Heavy ingredient patterns ───────────────────────────────────────────────
// Silicones and waxes not in the ingredient DB that indicate a heavy formula.
const HEAVY_INGREDIENT_PATTERNS = [
  /dimethicone|cyclopentasiloxane|cyclomethicone|phenyl trimethicone/i,
  /carnauba wax|beeswax|paraffin|ozokerite|ceresin/i,
  /petrolatum|mineral oil|lanolin/i,
  /butyrospermum parkii|shea butter/i,
  /\bsqualane\b|\bsqualene\b/i,
  /kaolin|bentonite/i,
  /isopropyl palmitate|isopropyl myristate/i,
  /hydrocolloid/i,
];

function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function buildTags(product, matchedIngredients) {
  const tags = new Set();
  const tagSources = new Map(); // tag → Set<string> of ingredient display names
  const ingList = product.ingredient_list || '';
  const typeLower = (product.type || '').toLowerCase();

  function addTag(tag, source) {
    tags.add(tag);
    if (source) {
      if (!tagSources.has(tag)) tagSources.set(tag, new Set());
      tagSources.get(tag).add(source);
    }
  }

  // Parse items once for per-item matching
  const items = ingList.split(/,(?![^(]*\))/).map(s => s.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);

  // ── Reason tags from matched DB ingredient names ──
  for (const ing of matchedIngredients) {
    for (const rule of CATEGORY_TAG_RULES) {
      if (rule.pattern.test(ing.name)) {
        rule.tags.forEach(t => addTag(t, ing.name));
      }
    }
  }

  // ── Reason tags from raw ingredient list — per item for precise attribution ──
  for (const item of items) {
    for (const rule of RAW_PATTERN_RULES) {
      if (rule.pattern.test(item)) {
        rule.tags.forEach(t => addTag(t, item));
      }
    }
  }

  // ── Heavy formula from ingredient patterns — per item ──
  for (const item of items) {
    for (const p of HEAVY_INGREDIENT_PATTERNS) {
      if (p.test(item)) {
        addTag('heavy-formula', item);
        addTag('occlusive', item);
        break; // matched one pattern for this item, move on
      }
    }
  }

  // ── Oil-based formula: first ingredient is a plant oil ──
  const OIL_FIRST = /olea europaea|olive fruit oil|glycine soja|soybean.*oil|helianthus annuus.*oil|sunflower.*oil|simmondsia chinensis|jojoba.*oil|prunus amygdalus|sweet almond.*oil|argania spinosa|argan.*oil/i;
  for (const item of items.slice(0, 3)) {
    if (OIL_FIRST.test(item)) {
      addTag('heavy-formula', item);
      addTag('occlusive', item);
    }
  }

  // ── Product type as tiebreaker (not primary) ──
  if (HEAVY_TYPES.has(typeLower)) {
    addTag('heavy-formula', null);
    addTag('occlusive', null);
  }
  if (MAKEUP_TYPES.has(typeLower) && (tags.has('heavy-formula') || tags.has('occlusive') || tags.has('sweat-reactive'))) {
    addTag('makeup-migrates', null);
  }

  // ── Exercise verdict ──
  let exerciseVerdict;
  if (product.pre_run) {
    exerciseVerdict = EXERCISE_VERDICT[product.pre_run];
  } else {
    const hasExerciseConcern = tags.has('heavy-formula') || tags.has('occlusive') ||
      tags.has('sweat-reactive') || tags.has('makeup-migrates');
    if (hasExerciseConcern) {
      exerciseVerdict = 'exercise-avoid';
    } else if (LIGHT_TYPES.has(typeLower)) {
      exerciseVerdict = 'exercise-safe';
    }
  }

  if (exerciseVerdict) tags.add(exerciseVerdict);

  // ── Photosensitive summary tag ──
  const hasPhotosensitive = [...tags].some(t => t.startsWith('photosensitive-'));
  if (hasPhotosensitive) tags.add('photosensitive');

  return { tags: [...tags], tagSources };
}

function buildNote(tags, tagSources) {
  const reasonTags = tags.filter(t =>
    t !== 'exercise-safe' && t !== 'exercise-avoid' &&
    t !== 'exercise-caution' && t !== 'photosensitive'
  );

  const parts = reasonTags.map(t => {
    const note = TAG_NOTES[t];
    if (!note) return null;
    const sources = tagSources?.get(t);
    if (sources?.size) {
      const names = [...sources]
        .slice(0, 3)
        .map(n => toTitleCase(n))
        .join(', ');
      const base = note.endsWith('.') ? note.slice(0, -1) : note;
      return `${base} (${names}).`;
    }
    return note;
  }).filter(Boolean);

  const exerciseTag = tags.find(t => t.startsWith('exercise-'));
  let exerciseNote = exerciseTag ? EXERCISE_NOTES[exerciseTag] : null;

  if (exerciseTag === 'exercise-avoid' && parts.length === 0) {
    exerciseNote = 'Not recommended before exercise — formula may interact with sweat or increase skin sensitivity during activity.';
  }

  return [exerciseNote, ...parts].filter(Boolean).join(' ') || null;
}

async function main() {
  // Fetch products
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, name, brand, type, ingredient_list, pre_run, activity_tags')
    .order('name');

  if (pErr) { console.error('Products error:', pErr.message); process.exit(1); }

  // Fetch all ingredients for matching
  const { data: ingredients, error: iErr } = await supabase
    .from('ingredients')
    .select('id, name, inci_name, status');

  if (iErr) { console.error('Ingredients error:', iErr.message); process.exit(1); }

  const toProcess = products.filter(p =>
    p.ingredient_list && (FORCE || !p.activity_tags?.length)
  );

  console.log(`${products.length} products total, ${toProcess.length} to tag.\n`);

  let ok = 0, failed = 0;

  for (const product of toProcess) {
    // Match ingredient list against DB
    const raw = product.ingredient_list || '';
    const items = raw.split(/,(?![^(]*\))/).map(s => s.replace(/\([^)]*\)/g, '').trim().toLowerCase());

    const matched = [];
    for (const item of items) {
      const found = ingredients.find(ing => {
        const n = ing.name.toLowerCase();
        const i = ing.inci_name?.toLowerCase();
        const tokenLong = item.length >= 6;
        return item.includes(n) || (tokenLong && n.includes(item)) ||
          (i && (item.includes(i) || (tokenLong && i.includes(item))));
      });
      if (found) matched.push(found);
    }

    const { tags, tagSources } = buildTags(product, matched);
    const note = buildNote(tags, tagSources);

    const { error } = await supabase
      .from('products')
      .update({ activity_tags: tags, activity_note: note })
      .eq('id', product.id);

    if (error) {
      console.error(`  ✗ ${product.name}: ${error.message}`);
      failed++;
    } else {
      const verdict = tags.find(t => t.startsWith('exercise-')) ?? 'no verdict';
      const photo = tags.includes('photosensitive') ? ' ☀️' : '';
      console.log(`  ✓ ${product.name} → ${verdict}${photo}`);
      ok++;
    }
  }

  console.log(`\nDone. ${ok} tagged, ${failed} failed.`);
}

main().catch(console.error);
