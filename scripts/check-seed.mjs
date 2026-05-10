import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const { count: ing } = await supabase.from('ingredients').select('*', { count: 'exact', head: true });
const { count: prod } = await supabase.from('products').select('*', { count: 'exact', head: true });

const { data: safe } = await supabase.from('ingredients').select('name').eq('status', 'safe').limit(5);
const { data: flagged } = await supabase.from('ingredients').select('name').eq('status', 'flagged').limit(5);
const { data: products } = await supabase.from('products').select('name, brand').limit(3);

console.log(`Ingredients: ${ing} total`);
console.log('  Safe examples:', safe?.map(r => r.name).join(', '));
console.log('  Flagged examples:', flagged?.map(r => r.name).join(', '));
console.log(`\nProducts: ${prod} total`);
products?.forEach(p => console.log(`  ${p.brand} — ${p.name}`));
