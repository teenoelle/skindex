/**
 * Pre-generates AI explanations for all ingredients that don't have one yet.
 * Safe to re-run — skips any ingredient that already has an explanation.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fqpqlllixjnzsdpqrovv.supabase.co',
  'sb_publishable_KsmOlC3vVPcMrFZV_sKpkA_8EBmhvcG'
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PROMPT = (name) =>
  `You are a skincare ingredient expert writing for someone with very reactive, sensitive skin. Explain the ingredient "${name}" in a conversational, accessible way — what it does in skincare products and why it might cause reactions or irritation. Keep it to 2-3 sentences. Write as if talking to a knowledgeable friend, not a patient.`;

async function generateExplanation(name) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: PROMPT(name) }],
  });
  return message.content[0].type === 'text' ? message.content[0].text.trim() : null;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. Run with: node --env-file=.env.local scripts/generate-explanations.mjs');
    process.exit(1);
  }

  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, name, explanation')
    .is('explanation', null)
    .order('name');

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`${ingredients.length} ingredients need explanations.\n`);
  let ok = 0, failed = 0;

  for (const ing of ingredients) {
    try {
      const explanation = await generateExplanation(ing.name);
      if (explanation) {
        await supabase
          .from('ingredients')
          .update({ explanation })
          .eq('id', ing.id);
        console.log(`✓ ${ing.name}`);
        ok++;
      } else {
        console.log(`- ${ing.name} (empty response, skipping)`);
        failed++;
      }
    } catch (err) {
      console.error(`✗ ${ing.name}: ${err.message}`);
      failed++;
      // Continue to next ingredient rather than aborting
    }

    // Small pause to stay well within rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. ${ok} generated, ${failed} failed/skipped.`);
  if (failed > 0) console.log('Re-run to retry failed ingredients.');
}

main().catch(console.error);
