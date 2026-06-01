# Upgrade Ingredient Explanations

Generate curated AI explanations for Skindex ingredients that currently have only template (auto-generated) text. Uses your Claude Pro session — no extra API cost.

## Arguments

`$ARGUMENTS` — optional batch size (default 30). Pass a number, e.g. `/upgrade-explanations 20`.

---

## Steps

### 1. Check how many need upgrading

```bash
npx tsx scripts/fetch-need-explanation.ts 1
```

Count the total by running:

```bash
npx tsx scripts/fetch-need-explanation.ts 9999 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).length+' ingredients need curated explanations');"
```

### 2. Fetch a batch

Run the fetch script to get the next batch. Use the batch size from `$ARGUMENTS`, defaulting to 30:

```bash
npx tsx scripts/fetch-need-explanation.ts $ARGUMENTS
```

This outputs a JSON array of ingredients with these fields:
- `id`, `name`, `status` ("safe" | "flagged")
- `structural_category`, `category`, `flagged_category`, `secondary_flagged_categories`

### 3. Generate explanation_structured for each ingredient

For **every** ingredient in the batch, produce an `explanation_structured` object following these rules:

**For safe ingredients** (`status === "safe"`):
```json
{
  "formula_role": "1 sentence: what [name] does technically in the formula. Start with '[name] is...'",
  "benefit": "1 sentence: its skin benefit and why it is well-tolerated. Start with '[name]...'",
  "concern": null,
  "concern_items": null
}
```

**For flagged ingredients** (`status === "flagged"`) with a single concern category:
```json
{
  "formula_role": "1 sentence: what [name] does technically in the formula. Start with '[name] is...'",
  "benefit": "1 sentence: any meaningful benefit or why some use it despite the concern — or null if none. Start with '[name]...'",
  "concern": "1 sentence: why [name] is a concern for reactive or sensitive skin. Start with '[name] is...' or '[name] can...'",
  "concern_items": null
}
```

**For flagged ingredients with multiple concern categories** (when `secondary_flagged_categories` is non-empty):
```json
{
  "formula_role": "...",
  "benefit": "...",
  "concern": "1 sentence covering the primary concern",
  "concern_items": [
    { "category": "<flagged_category>", "text": "1 sentence specific to this concern" },
    { "category": "<secondary category>", "text": "1 sentence specific to this concern" }
  ]
}
```

**Quality rules:**
- Be specific to the ingredient — no generic filler like "this ingredient may cause issues"
- `formula_role` should name the ingredient's technical function (emollient, preservative, humectant, surfactant, etc.)
- `benefit` for safe ingredients should mention the actual skin benefit (hydration, barrier support, anti-inflammatory, etc.)
- `concern` should name the specific mechanism (e.g., "can disrupt the skin barrier" not just "is harmful")
- Keep each sentence to one sentence — no run-ons

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
