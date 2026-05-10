import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://fqpqlllixjnzsdpqrovv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function clean(val) {
  if (!val) return '';
  return String(val).replace(/[\r\n]+/g, ' ').trim();
}

async function seedIngredients(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const ingredients = [];

  for (let i = 1; i < rows.length; i++) {
    const [ingredient, variant, status] = rows[i];
    const name = clean(variant);
    if (!name) continue;

    ingredients.push({
      name,
      inci_name: name,
      status: status === 'Yes' ? 'safe' : 'flagged',
      category: clean(ingredient) || name,
    });
  }

  console.log(`Found ${ingredients.length} ingredients to insert`);

  const CHUNK = 50;
  for (let i = 0; i < ingredients.length; i += CHUNK) {
    const chunk = ingredients.slice(i, i + CHUNK);
    const { error } = await supabase.from('ingredients').insert(chunk);
    if (error) {
      console.error(`  Error at chunk ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + CHUNK, ingredients.length)} / ${ingredients.length}`);
  }
}

async function seedProducts(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Columns: Type, Brand, Product, Item Variant, Ingredients List, ...
  const products = [];

  for (let i = 1; i < rows.length; i++) {
    const [type, brand, product, , ingredientsList] = rows[i];
    const name = clean(product);
    const ingList = clean(ingredientsList);
    if (!name || !ingList) continue;

    products.push({
      name,
      brand: clean(brand) || null,
      type: clean(type) || null,
      ingredient_list: ingList,
      source: 'community',
    });
  }

  console.log(`Found ${products.length} products to insert`);

  const CHUNK = 20;
  for (let i = 0; i < products.length; i += CHUNK) {
    const chunk = products.slice(i, i + CHUNK);
    const { error } = await supabase.from('products').insert(chunk);
    if (error) {
      console.error(`  Error at chunk ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + CHUNK, products.length)} / ${products.length}`);
  }
}

async function main() {
  const filePath = join(__dirname, '..', '_reference', 'topical ingredients.xlsx');
  const wb = XLSX.readFile(filePath);

  // Check for existing data
  const { count: ingCount } = await supabase
    .from('ingredients')
    .select('*', { count: 'exact', head: true });
  const { count: prodCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (ingCount > 0 || prodCount > 0) {
    console.log(`DB already has ${ingCount} ingredients and ${prodCount} products.`);
    console.log('Clear the tables first if you want to re-seed. Exiting.');
    process.exit(0);
  }

  console.log('=== Seeding Ingredients ===');
  await seedIngredients(wb.Sheets['ingredients']);

  console.log('\n=== Seeding Products ===');
  await seedProducts(wb.Sheets['products']);

  console.log('\nSeed complete.');
}

main().catch(console.error);
