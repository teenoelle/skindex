# Generate Ingredient Explanations

Generate curated explanations for Skindex ingredients. Uses your Claude Pro session — no extra API cost.

## Arguments

`$ARGUMENTS` — optional flags and batch size (default 30).

- `/generate-explanations 20` — generate up to 20 new explanations for ingredients that have none yet
- `/generate-explanations --missing-labels` — add missing label fields (`benefit_category`, `benefit_profiles`, `concern_category`, `concern_profiles`) to ingredients that already have explanation text but were generated before the two-tier label system existed
- `/generate-explanations --missing-labels 20` — same, limited to 20 at a time

---

## Steps

### 1. Check how many need generating

**Default mode** (no explanation yet):
```bash
npx tsx scripts/fetch-need-explanation.ts 1
```

Count the total:
```bash
npx tsx scripts/fetch-need-explanation.ts 9999 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).length+' ingredients need curated explanations');"
```

**Missing-labels mode**:
```bash
npx tsx scripts/fetch-need-explanation.ts --missing-labels 1
```

Count the total:
```bash
npx tsx scripts/fetch-need-explanation.ts --missing-labels 9999 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).length+' ingredients need label fields');"
```

### 2. Fetch a batch

Pass through `$ARGUMENTS` (which may include `--missing-labels` and/or a number):

```bash
npx tsx scripts/fetch-need-explanation.ts $ARGUMENTS
```

This outputs a JSON array of ingredients with these fields:
- `id`, `name`, `status` ("safe" | "flagged")
- `structural_category`, `category`, `flagged_category`, `secondary_flagged_categories`

### 3. Generate explanation_structured for each ingredient

For **every** ingredient in the batch, produce an `explanation_structured` object.

Valid skin type labels for `benefit_profiles` and `concern_profiles`:
> Reactive, Dry, Oily, Acne-prone, Mature, Eczema, Rosacea, Hyperpigmentation-prone, Damaged Barrier, Seborrheic, Fungal Acne

---

**For safe ingredients** (`status === "safe"`):
```json
{
  "formula_role": "1 sentence: what [name] does technically in the formula. Start with '[name] is...'",
  "benefit": "1 sentence: its skin benefit and why it is well-tolerated. Start with '[name]...'",
  "benefit_category": "1–3 word label for the type of benefit (e.g. Humectant, Antioxidant, Barrier-repairing, Soothing). Set null if the ingredient's category field already provides this label.",
  "benefit_profiles": ["skin type", "skin type"] or null,
  "concern": null,
  "concern_category": null,
  "concern_profiles": null,
  "concern_items": null
}
```

---

**For flagged ingredients** (`status === "flagged"`) with a single concern category:
```json
{
  "formula_role": "1 sentence: what [name] does technically in the formula. Start with '[name] is...'",
  "benefit": "1 sentence: any meaningful benefit or why some use it despite the concern — or null if none. Start with '[name]...'",
  "benefit_category": "1–3 word label for the type of benefit (e.g. Humectant, Exfoliant, Antioxidant) — or null if benefit is null or if flagged_category already describes it.",
  "benefit_profiles": ["skin type", "skin type"] or null,
  "concern": "1 sentence: why [name] is a concern for reactive or sensitive skin. Start with '[name] is...' or '[name] can...'",
  "concern_category": "1–3 word label naming the mechanism of harm (e.g. Photosensitizer, Barrier Disruptor, Sensitizer, Irritant). Set null if it would just repeat the flagged_category badge label.",
  "concern_profiles": ["skin type", "skin type"] or null,
  "concern_items": null
}
```

---

**For flagged ingredients with multiple concern categories** (when `secondary_flagged_categories` is non-empty):
```json
{
  "formula_role": "...",
  "benefit": "... or null",
  "benefit_category": "... or null",
  "benefit_profiles": [...] or null,
  "concern": "1 sentence covering the primary concern",
  "concern_category": "... or null",
  "concern_profiles": [...] or null,
  "concern_items": [
    { "category": "<flagged_category>", "text": "1 sentence specific to this concern" },
    { "category": "<secondary category>", "text": "1 sentence specific to this concern" }
  ]
}
```

---

**Quality rules:**
- Be specific to the ingredient — no generic filler like "this ingredient may cause issues"
- `formula_role` should name the ingredient's technical function (emollient, preservative, humectant, surfactant, etc.)
- `benefit` must add information that `formula_role` did not already state — lead with the skin outcome, a comparison, or a profile-specific advantage
- `benefit_category` is set when the benefit sentence describes a specific functional role (Humectant, Antioxidant, etc.) that isn't already captured by the ingredient's `category` classification field
- `benefit_profiles` lists skin types that benefit most; omit skin types for which the ingredient is unremarkable
- `concern` should name the specific mechanism (e.g., "disrupts the skin barrier" not just "is harmful")
- `concern_category` is set when the mechanism label adds clarity beyond the `flagged_category` badge already shown in the UI — omit if redundant
- `concern_profiles` lists skin types most affected by this concern; omit skin types for which the concern is unremarkable
- Keep each sentence to one sentence — no run-ons

**Additional rule for `--missing-labels` mode:**
The fetched data includes the ingredient's existing `explanation_structured`. **Preserve the `formula_role`, `benefit`, and `concern` sentences verbatim** — do not rewrite them. Only generate the missing label fields (`benefit_category`, `benefit_profiles`, `concern_category`, `concern_profiles`). Copy all other fields through unchanged.

### 4. Assemble the output JSON

Build an array combining each ingredient's original classification fields with the generated `explanation_structured`:

```json
[
  {
    "id": "<original id>",
    "name": "<original name>",
    "status": "<original status>",
    "structural_category": "<original>",
    "category": "<original>",
    "flagged_category": "<original>",
    "explanation_structured": { ... }
  }
]
```

Write this to `scripts/tmp-explanations.json`.

### 5. Apply to the database

```bash
npx tsx scripts/write-curated-explanations.ts scripts/tmp-explanations.json
```

This writes `explanation`, `explanation_structured`, `explanation_source: "curated"`, and auto-computed `skin_climate_notes` for each ingredient.

### 6. Clean up and continue

```bash
rm scripts/tmp-explanations.json
```

Check how many remain:

```bash
npx tsx scripts/fetch-need-explanation.ts 1
```

If there are more ingredients to process, ask the user whether to continue with the next batch or stop here.

---

## Notes

- `skin_climate_notes` (the profile combination notes) are computed automatically by the write script from the ingredient's classification — you don't need to generate them.
- If a batch partially fails (some rows return DB errors), the successfully written rows still count. Re-run to retry failed ones.
- The write script is idempotent — running it twice for the same ingredient just overwrites with the same data.
