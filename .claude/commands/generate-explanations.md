# Generate Ingredient Explanations

Generate curated explanations and profiles for Skindex ingredients. Uses your Claude Pro session — no extra API cost.

Processes up to four queues per run:
0. **New ingredient queue** — unknown ingredients in `ingredient_queue` (classify + explain from scratch)
1. **Explanation queue** — ingredients already in the DB missing a curated explanation
2. **Fatty acid profile queue** — Emollient ingredients missing a fatty acid profile
3. **Bioactive profile queue** — Plant Extract ingredients missing a bioactive profile

## Arguments

`$ARGUMENTS` — optional flags and batch size (default 30).

- `/generate-explanations 20` — process up to 20 items per queue
- `/generate-explanations --missing-labels` — add missing label fields to already-explained ingredients (see Queue 1 notes)
- `/generate-explanations --missing-labels 20` — same, limited to 20 at a time

---

## Steps

### 0. Check queue counts

```bash
npx tsx scripts/fetch-queue.ts 1 > scripts/tmp-count.json; node -e "const fs=require('fs');const lines=fs.readFileSync('scripts/tmp-count.json','utf8').split('\n');const i=lines.findIndex(l=>l.trimStart().startsWith('['));const arr=JSON.parse(lines.slice(i).join('\n'));console.log(arr.length+' in ingredient_queue (showing first item if any)');" && rm scripts/tmp-count.json
```

```bash
npx tsx scripts/fetch-need-explanation.ts 9999 > scripts/tmp-count.json; node -e "const fs=require('fs');const lines=fs.readFileSync('scripts/tmp-count.json','utf8').split('\n');const i=lines.findIndex(l=>l.trimStart().startsWith('['));console.log(JSON.parse(lines.slice(i).join('\n')).length+' need explanation');" && rm scripts/tmp-count.json
```

```bash
npx tsx scripts/fetch-need-profile.ts --type emollient 9999 > scripts/tmp-count.json; node -e "const fs=require('fs');const lines=fs.readFileSync('scripts/tmp-count.json','utf8').split('\n');const i=lines.findIndex(l=>l.trimStart().startsWith('['));console.log(JSON.parse(lines.slice(i).join('\n')).length+' Emollients need fatty acid profile');" && rm scripts/tmp-count.json
```

```bash
npx tsx scripts/fetch-need-profile.ts --type plant-extract 9999 > scripts/tmp-count.json; node -e "const fs=require('fs');const lines=fs.readFileSync('scripts/tmp-count.json','utf8').split('\n');const i=lines.findIndex(l=>l.trimStart().startsWith('['));console.log(JSON.parse(lines.slice(i).join('\n')).length+' Plant Extracts need bioactive profile');" && rm scripts/tmp-count.json
```

Report all four counts to the user, then proceed with each non-empty queue below.

---

## Queue 0 — New Ingredients (ingredient_queue)

Skip this queue if the count from step 0 is 0.

### 0a. Fetch the queue

```bash
npx tsx scripts/fetch-queue.ts $ARGUMENTS
```

Output: JSON array of `{ id, name, times_seen, found_in }`.

### 0b. Review and classify each item

For **every** item in the queue, decide one of:

**Skip** (mark `skip: true`) when the name is:
- An asterisk-only variant of a common ingredient (e.g. `"Aloe Barbadensis Leaf Juice *"`, `"tea tree oil*"`) — the asterisk means "certified organic" on product labels; the base ingredient is already in the DB
- A fully informal or vague name with no useful INCI meaning (e.g. `"Purified water"`, `"red Korean seaweed extract"` when too vague)
- A formatting-corrupted name that already has a clean match in the DB (e.g. `"caprylic/ capric triglyceride"`)
- A duplicate of another item in the same batch (keep the better-cased one, skip the rest)

**Clean the name** before classifying when:
- The queue name has an asterisk suffix → strip it (e.g. `"spiraea ulmaria flower extract*"` → `"spiraea ulmaria flower extract"`)
- The queue name has formatting corruption → normalize (e.g. `"houttuynia cordata flower/leaf/ stem water"` → `"houttuynia cordata flower leaf stem water"`)
- The queue name has bracket suffixes → strip them (e.g. `"citrus paradisi seed extract [citricidal]"` → `"citrus paradisi seed extract"`)
- Use the cleaned name in the output JSON

**Classify** each non-skipped item:
- `status`: `"safe"` or `"flagged"`
- `structural_category`: one of Humectant, Emollient, Fatty Acid, Fatty Alcohol, Ceramide, Peptide, Silicone, Surfactant, Emulsifier, Thickener, Preservative, UV Filter, Plant Extract, Chelating Agent, pH Adjuster, Solvent, Conditioning Agent, Protein, Amino Acid, Active, Colorant, Clay, Exfoliant, Fragrance — or null
- `category` (if safe): one of soothing, brightening, antioxidant, firming, barrier-repairing, moisturizing, smoothing, Softening, antimicrobial, anti-malassezia, wound-healing, cleansing, Pore-cleansing, Strengthening, Conditioning, chelating, PHA Exfoliant, Anti-inflammatory, prebiotic — or null
- `flagged_category` (if flagged): one of sensitizer, fragrance-allergen, Synthetic Musk, Chemical Sunscreen, AHA Exfoliant, BHA Exfoliant, Barrier-disrupting, pore-clogger, occlusive, Sulfate Surfactant, Drying Solvent, Irritant, vasodilator, phytoestrogen — or null
- `secondary_flagged_categories`: array of additional flagged categories, or `[]`

Then generate `explanation_structured` using the same format and quality rules as Queue 1b below.

### 0c. Assemble and write

Build an array where each entry is either:

```json
{ "queueId": "<original id>", "skip": true }
```

or:

```json
{
  "queueId": "<original id>",
  "name": "<cleaned name>",
  "status": "safe" | "flagged",
  "structural_category": "...",
  "category": "...",
  "flagged_category": "...",
  "secondary_flagged_categories": [...],
  "explanation_structured": { ... }
}
```

Write to `scripts/tmp-queue-explanations.json`, then apply:

```bash
npx tsx scripts/write-queue-explanations.ts scripts/tmp-queue-explanations.json
```

Clean up:
```bash
rm scripts/tmp-queue-explanations.json
```

> **Note:** Emollient and Plant Extract items inserted by this step automatically get `profile_status = "needs_profile"` — they will appear in Queues 2 and 3 on this same run. Re-check those queue counts after Queue 0 completes.

---

## Queue 1 — Explanations

Skip this queue if the count from step 0 is 0 (and Queue 0 added no items that need explanation upgrades).

### 1a. Fetch a batch

**Default mode** (no `--missing-labels`):
```bash
npx tsx scripts/fetch-need-explanation.ts $ARGUMENTS
```

**Missing-labels mode** (`--missing-labels` in `$ARGUMENTS`):
```bash
npx tsx scripts/fetch-need-explanation.ts $ARGUMENTS
```

This outputs a JSON array with: `id`, `name`, `status`, `structural_category`, `category`, `flagged_category`, `secondary_flagged_categories` (plus `explanation_structured` in `--missing-labels` mode).

### 1b. Generate explanation_structured for each ingredient

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

### 1c. Assemble and write

Build an array combining each ingredient's classification fields with the generated `explanation_structured`:

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

Write to `scripts/tmp-explanations.json`, then apply:

```bash
npx tsx scripts/write-curated-explanations.ts scripts/tmp-explanations.json
```

Clean up:
```bash
rm scripts/tmp-explanations.json
```

---

## Queue 2 — Fatty Acid Profiles (Emollients)

Skip this queue if the count from step 0 is 0 **and** Queue 0 added no Emollient items.

### 2a. Fetch a batch

```bash
npx tsx scripts/fetch-need-profile.ts --type emollient $ARGUMENTS
```

This outputs a JSON array with: `id`, `name`, `status`, `structural_category`, `category`, `flagged_category`, `secondary_flagged_categories`.

### 2b. Generate fatty_acid_profile for each ingredient

For **every** ingredient in the batch, produce a `fatty_acid_profile` object with approximate fatty acid percentages. Only include fields with a value greater than 1%. All values are percentages (0–100).

Allowed fields:
- `linoleic` — LA, omega-6
- `oleic` — OA, omega-9
- `alpha_linolenic` — ALA, omega-3
- `gamma_linolenic` — GLA, omega-6 (borage, evening primrose, blackcurrant)
- `palmitoleic` — omega-7 (sea buckthorn, macadamia)
- `lauric` — saturated C12 (coconut, palm kernel, babassu)
- `palmitic` — saturated C16
- `stearic` — saturated C18
- `ricinoleic` — hydroxy C18:1 (castor oil only)
- `punicic` — omega-5 (pomegranate seed only)

Set `fatty_acid_profile` to **null** if the ingredient is NOT a plant-derived oil with a meaningful fatty acid profile (e.g. mineral oil, petrolatum, squalane, paraffin, beeswax, silicone, synthetic ester, carnauba wax, lanolin, or any non-oil ingredient).

Example for a linoleic-rich oil:
```json
{ "linoleic": 65, "oleic": 20, "palmitic": 7, "stearic": 5 }
```

### 2c. Assemble and write

Build an array preserving all fetched classification fields plus the generated profile:

```json
[
  {
    "id": "<original id>",
    "name": "<original name>",
    "status": "<original status>",
    "structural_category": "<original>",
    "category": "<original>",
    "flagged_category": "<original>",
    "secondary_flagged_categories": [...],
    "fatty_acid_profile": { ... } or null
  }
]
```

Write to `scripts/tmp-fatty-acid-profiles.json`, then apply:

```bash
npx tsx scripts/write-fatty-acid-profiles.ts scripts/tmp-fatty-acid-profiles.json
```

Clean up:
```bash
rm scripts/tmp-fatty-acid-profiles.json
```

---

## Queue 3 — Bioactive Profiles (Plant Extracts)

Skip this queue if the count from step 0 is 0 **and** Queue 0 added no Plant Extract items.

### 3a. Fetch a batch

```bash
npx tsx scripts/fetch-need-profile.ts --type plant-extract $ARGUMENTS
```

This outputs a JSON array with: `id`, `name`, `status`, `structural_category`, `category`, `flagged_category`, `secondary_flagged_categories`.

### 3b. Generate bioactive_profile for each ingredient

For **every** ingredient in the batch, produce a `bioactive_profile` object. Set `bioactive_profile` to **null** if the ingredient is not a meaningful plant extract (e.g. it is a synthetic compound, a processing descriptor, a solvent, or you have insufficient information).

Return this exact structure:
```json
{
  "primary_action": "<one allowed value>",
  "secondary_actions": ["<0–3 additional allowed values, different from primary>"],
  "key_compounds": ["<1–3 notable bioactive compounds as strings>"],
  "sensitization_risk": "<low | moderate | high>"
}
```

Allowed action values:
- `"antioxidant"` — neutralises free radicals; protects against oxidative stress
- `"soothing"` — calms redness, irritation, inflammation
- `"brightening"` — addresses hyperpigmentation, evens skin tone
- `"firming"` — supports collagen, improves elasticity
- `"barrier-repairing"` — strengthens lipid barrier, reduces TEWL
- `"antimicrobial"` — broad antibacterial or antifungal activity
- `"anti-malassezia"` — specifically targets Malassezia yeast
- `"wound-healing"` — accelerates tissue repair and regeneration
- `"anti-inflammatory"` — reduces inflammatory mediators (prefer over "soothing" when mechanism is COX/LOX inhibition)

`sensitization_risk` guidance:
- `"high"` — documented contact sensitizer or allergen (will be **reclassified as flagged/sensitizer**)
- `"moderate"` — known mild irritant or low-level sensitizer in some individuals
- `"low"` — well-tolerated, no significant sensitization concern

### 3c. Assemble and write

Build an array preserving all fetched classification fields plus the generated profile:

```json
[
  {
    "id": "<original id>",
    "name": "<original name>",
    "status": "<original status>",
    "structural_category": "<original>",
    "category": "<original>",
    "flagged_category": "<original>",
    "secondary_flagged_categories": [...],
    "bioactive_profile": { ... } or null
  }
]
```

Write to `scripts/tmp-bioactive-profiles.json`, then apply:

```bash
npx tsx scripts/write-bioactive-profiles.ts scripts/tmp-bioactive-profiles.json
```

Clean up:
```bash
rm scripts/tmp-bioactive-profiles.json
```

---

## Wrap-up

After all queues are processed, check remaining counts:

```bash
npx tsx scripts/fetch-queue.ts 1
```
```bash
npx tsx scripts/fetch-need-explanation.ts 1
```
```bash
npx tsx scripts/fetch-need-profile.ts --type emollient 1
```
```bash
npx tsx scripts/fetch-need-profile.ts --type plant-extract 1
```

If items remain in any queue, ask the user whether to continue with the next batch or stop here.

---

## Notes

- `skin_climate_notes`, `category`, and `secondary_benefit_categories` are all computed automatically by the write scripts — you don't need to generate them.
- Ingredients with `sensitization_risk: "high"` in Queue 3 are automatically reclassified as `flagged/sensitizer` by the write script.
- Queue 0 items that are Emollient or Plant Extract automatically get `profile_status = "needs_profile"` — they will appear in Queues 2/3 after insertion. Always re-check profile queue counts after Queue 0 runs.
- If a batch partially fails (some rows return DB errors), the successfully written rows still count. Re-run to retry failed ones.
- All write scripts are idempotent — running them twice for the same ingredient just overwrites with the same data.
