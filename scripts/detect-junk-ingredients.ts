/**
 * Queries all products and reports those with suspicious ingredient lists.
 * Outputs a JSON report to stdout and a human-readable summary to stderr.
 *
 * Usage:
 *   npx tsx scripts/detect-junk-ingredients.ts [--json]
 *
 * Pass --json to suppress the summary and emit only the JSON array.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const JSON_ONLY = process.argv.includes("--json");

const JUNK_KEYWORDS = /directions|how to use|apply|rinse|lather|warning|caution|keep out of reach|for external use|do not|avoid contact|discontinue|consult|storage|store in|shake well|expiry|best before|manufactured|distributed by|net weight|fl\.? oz|www\.|http/i;

function isJunkIngredient(item: string): boolean {
  const t = item.trim();
  if (t.length > 80) return true;
  if (JUNK_KEYWORDS.test(t)) return true;
  // Sentence structure: multiple spaces suggesting a sentence fragment
  if ((t.match(/\s+/g) ?? []).length >= 5) return true;
  // 5+ consecutive digits (barcode, lot number, etc.)
  if (/\d{5,}/.test(t)) return true;
  return false;
}

function hasSuspiciousIngredients(ingredientList: string | null): boolean {
  if (!ingredientList) return false;
  return ingredientList
    .split(",")
    .some((item) => isJunkIngredient(item));
}

type Product = {
  id: string;
  name: string;
  brand: string | null;
  ingredient_list: string | null;
};

async function main() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, brand, ingredient_list")
    .order("name");

  if (error) {
    process.stderr.write(`Supabase error: ${error.message}\n`);
    process.exit(1);
  }

  const suspicious: Array<{
    id: string;
    name: string;
    brand: string | null;
    junk_items: string[];
  }> = [];

  for (const p of products as Product[]) {
    if (!p.ingredient_list) continue;
    const junk = p.ingredient_list
      .split(",")
      .map((s) => s.trim())
      .filter((s) => isJunkIngredient(s));
    if (junk.length > 0) {
      suspicious.push({ id: p.id, name: p.name, brand: p.brand, junk_items: junk });
    }
  }

  if (!JSON_ONLY) {
    process.stderr.write(`\n${(products as Product[]).length} products scanned.\n`);
    process.stderr.write(`${suspicious.length} have suspicious ingredient items.\n\n`);
    for (const p of suspicious) {
      process.stderr.write(`${p.name}${p.brand ? ` (${p.brand})` : ""}\n`);
      for (const item of p.junk_items) {
        process.stderr.write(`  • ${item.slice(0, 100)}${item.length > 100 ? "…" : ""}\n`);
      }
      process.stderr.write("\n");
    }
  }

  process.stdout.write(JSON.stringify(suspicious, null, 2) + "\n");
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
