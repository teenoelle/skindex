# SKINdex

A skincare ingredient scanner built around a "canary in the coal mine" philosophy — hypersensitive reactive skin as the baseline. If a product passes, it's likely safe for anyone with reactive skin.

## Features

- **Ingredient scanner** — search the community database, paste an ingredient list, or extract from a product URL
- **Three-tab results** — flagged, photosensitive, safe, and unreviewed ingredients with collapsible explanations
- **Community product database** — 130+ products with ingredient analysis, activity tags (exercise-safe, photosensitive), and product images
- **Open Beauty Facts integration** — automatic lookup and import for products not in the community database
- **AI extraction** — Claude Haiku extracts ingredients from any product URL (rate-limited for free users)
- **Canary defaults** — flagged ingredients include parabens, chemical UV filters, EU fragrance allergens, essential oils, harsh sulfates, occlusives, AHAs, and retinoids

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 16 (TypeScript), deployed on Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Clerk v7 |
| AI | Claude Haiku (Anthropic) |
| External data | Open Beauty Facts |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Database

Run the SQL files in `_reference/migrations/` in order in the Supabase SQL editor:

1. `add-ingredient-queue.sql`
2. `add-fuzzy-search.sql`
3. `add-activity-tags.sql`
4. `add-product-image.sql`
5. `add-photo-note.sql`
6. `add-product-ingredients.sql`
7. `add-rls.sql` (before public launch)

Then seed the database with the reference spreadsheet data:

```bash
node scripts/seed.mjs
node scripts/sync-products.mjs
node scripts/populate-product-ingredients.mjs
node scripts/tag-photo-ingredients.mjs
```

### 4. Run locally

```bash
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `sync-queue.mjs` | Pull unrecognized ingredients from Supabase into the staging spreadsheet |
| `classify-queue.mjs` | Insert classified ingredients into the DB and mark queue items done |
| `promote.mjs [--dry-run] [--sync]` | Promote staging spreadsheet to production and sync to DB |
| `sync-products.mjs` | Sync products from the production spreadsheet to DB |
| `fetch-images.mjs [--force]` | Fetch product images from iHerb / INCI Decoder URLs |
| `populate-product-ingredients.mjs` | Populate the product-ingredient junction table |
| `tag-photo-ingredients.mjs` | Tag photosensitive ingredients in DB with explanations |
| `scan-all-products.mjs` | Scan all products to push unrecognized ingredients to the queue |

## Ingredient classification workflow

1. `node scripts/sync-queue.mjs` — pulls new unrecognized ingredients into `_reference/skindex-staging.xlsx`
2. Classify ingredients in the queue tab (safe / flagged, category, explanation)
3. `node scripts/classify-queue.mjs` — inserts new ingredients into DB, marks queue items done
4. `node scripts/promote.mjs --sync` — promotes staging to production and syncs to DB

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
