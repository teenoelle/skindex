# Generate Ingredient Explanations

Runs the automated ingredient pipeline for Skindex. All four queues are handled by a single script — no manual classify/write steps required.

**Queues processed per run:**
- **Queue 0** — `ingredient_queue` drain: new ingredients classified + explained by AI, then removed from queue
- **Queue 1** — Explanation upgrades: ingredients with null/template/template_unclassified explanation_source get a curated AI explanation
- **Queue 2** — Fatty acid profiles: Emollient ingredients with `profile_status = needs_profile`
- **Queue 3** — Bioactive profiles: Plant Extract ingredients with `profile_status = needs_profile`

After each queue pass, `benefit_profiles` / `concern_profiles` are auto-derived from skin_climate_notes and merged into `explanation_structured`.

## Arguments

`$ARGUMENTS` — optional batch size and flags.

- `/generate-explanations` — process up to 20 items per queue (default)
- `/generate-explanations 50` — process up to 50 items per queue
- `/generate-explanations --loop` — keep running passes until all queues are empty
- `/generate-explanations --dry-run` — preview what would be processed without writing anything

---

## Steps

### 1. Check queue counts

First, sweep all products for ingredients that may have been silently dropped by the API (e.g. due to the anon-client bug fixed 2026-06-16). This is fast and safe to re-run.

```bash
npx tsx scripts/queue-unreviewed.ts 2>&1
```

Then check the queue counts:

```bash
npx tsx scripts/generate-explanations.ts --dry-run 2>&1 | head -10
```

Report the four counts to the user (Queue, Weak explanations, Needs profile), then proceed.

---

### 2. Run the pipeline

Parse `$ARGUMENTS` into flags:

- If `$ARGUMENTS` contains a number N, pass `--batch N`
- If `$ARGUMENTS` contains `--loop`, pass `--loop`
- If `$ARGUMENTS` is empty or unrecognised, run with defaults (batch 20)

```bash
npx tsx scripts/generate-explanations.ts [--batch N] [--loop]
```

The script prints progress for every ingredient processed. Watch for any `✗` failures and note them.

---

### 3. Re-link product ingredients

Always run this after any queue was non-empty. Fixes `product_ingredients` gaps for products whose ingredients were unreviewed at add time but have since been classified.

```bash
npx tsx scripts/relink-product-ingredients.ts
```

---

### 4. Report remaining counts

```bash
npx tsx scripts/generate-explanations.ts --dry-run 2>&1 | head -10
```

Report the remaining counts. If items remain and `--loop` was not used, ask whether to run another batch.

---

## Notes

- `skin_climate_notes`, `concern_profiles`, `category`, and `secondary_benefit_categories` are all computed automatically — the script handles them.
- `benefit_profiles` is **manual-only** — the script does not set it. It is preserved if already present on an ingredient.
- Ingredients reclassified as flagged/sensitizer during Queue 3 (high sensitization risk) are updated automatically.
- Queue 0 items that are Emollient or Plant Extract get `profile_status = needs_profile` on insert and appear in Queues 2/3 on the same run.
- The script is safe to re-run — no data is duplicated; it only processes ingredients that still need work.
