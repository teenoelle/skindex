/**
 * Regenerates explanation_structured for ingredients that don't have it yet.
 * Enriches Claude Haiku prompts with skin_climate_notes from the DB when available.
 *
 * Usage:
 *   npx tsx scripts/regenerate-explanations.ts [--limit N] [--apply]
 *
 * Flags:
 *   --limit N   Process at most N ingredients (default: 20)
 *   --apply     Write results to DB (default: dry-run, prints only)
 */
import Anthropic from "@anthropic-ai/sdk";
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 20;

type SkinClimateNote = {
  dimensions: string[];
  climate: string[];
  sentiment: "strong_caution" | "caution" | "benefit" | "neutral";
  text: string;
};

type ExplanationStructured = {
  formula_role: string | null;
  benefit: string | null;
  concern: string | null;
};

type Ingredient = {
  id: string;
  name: string;
  status: "safe" | "flagged";
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  skin_climate_notes: SkinClimateNote[] | null;
};

function formatClimateNotes(notes: SkinClimateNote[]): string {
  return notes
    .map((n) => {
      const who = n.dimensions.length > 0 ? n.dimensions.join("/") : n.climate.join("/");
      const sentiment = n.sentiment === "strong_caution" ? "strong caution" : n.sentiment;
      return `• ${who} [${sentiment}]: ${n.text}`;
    })
    .join("\n");
}

function buildPrompt(ingredient: Ingredient): string {
  const { name, status, structural_category, category, flagged_category, skin_climate_notes } = ingredient;
  const structNote = structural_category ? ` Its structural role in the formula is: ${structural_category}.` : "";
  const notesBlock =
    skin_climate_notes && skin_climate_notes.length > 0
      ? `\n\nKnown skin profile notes for ${name}:\n${formatClimateNotes(skin_climate_notes)}`
      : "";

  if (status === "flagged") {
    const concern = flagged_category ?? category;
    return `You are a skincare ingredient expert writing for someone with reactive or sensitive skin.

Ingredient: "${name}"${structNote}${concern ? ` Concern category: ${concern}.` : ""}${notesBlock}

Return a JSON object with exactly these three fields — no other text:
{
  "formula_role": "1 sentence: what ${name} does technically in the formula. Start with '${name} is...'",
  "benefit": "1 sentence: any meaningful skin benefit or why some people use it despite the concern. Start with '${name}...' or null if there is no notable benefit.",
  "concern": "1 sentence: why ${name} is a concern for reactive or sensitive skin. Start with '${name} is...' or '${name} can...'"
}

Be specific. Avoid generic filler. Respond ONLY with valid JSON.`;
  }

  const benefit = category;
  return `You are a skincare ingredient expert.

Ingredient: "${name}"${structNote}${benefit ? ` Skin benefit category: ${benefit}.` : ""}${notesBlock}

Return a JSON object with exactly these three fields — no other text:
{
  "formula_role": "1 sentence: what ${name} does technically in the formula. Start with '${name} is...'",
  "benefit": "1 sentence: its skin benefit and why it is well-tolerated. Start with '${name}...'",
  "concern": null
}

Be specific. Avoid generic filler. Respond ONLY with valid JSON.`;
}

function flattenStructured(s: ExplanationStructured): string {
  return [s.formula_role, s.benefit, s.concern].filter(Boolean).join(" ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateStructured(ingredient: Ingredient): Promise<ExplanationStructured | null> {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: buildPrompt(ingredient) }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : null;
  if (!raw) return null;

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as ExplanationStructured;
  if (!parsed || typeof parsed !== "object") return null;

  return {
    formula_role: parsed.formula_role ?? null,
    benefit: parsed.benefit ?? null,
    concern: parsed.concern ?? null,
  };
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"} | Limit: ${limit}\n`);

  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, skin_climate_notes")
    .is("explanation_structured", null)
    .order("name")
    .limit(limit);

  if (error) { console.error(error.message); process.exit(1); }
  if (!data || data.length === 0) { console.log("No ingredients need regeneration."); return; }

  console.log(`Found ${data.length} ingredients to process.\n`);

  let ok = 0, failed = 0;

  for (let i = 0; i < data.length; i++) {
    const ingredient = data[i] as Ingredient;
    const hasNotes = !!(ingredient.skin_climate_notes && ingredient.skin_climate_notes.length > 0);
    const tag = hasNotes ? "[+notes]" : "[no notes]";

    try {
      const structured = await generateStructured(ingredient);

      if (!structured) {
        console.log(`✗ ${ingredient.name} ${tag} — no valid JSON returned`);
        failed++;
      } else {
        const explanation = flattenStructured(structured);

        if (apply) {
          const { error: writeErr } = await supabase
            .from("ingredients")
            .update({ explanation_structured: structured, explanation, explanation_source: "curated" })
            .eq("id", ingredient.id);

          if (writeErr) {
            console.log(`✗ ${ingredient.name} ${tag} — write error: ${writeErr.message}`);
            failed++;
          } else {
            console.log(`✓ ${ingredient.name} ${tag}`);
            ok++;
          }
        } else {
          console.log(`✓ ${ingredient.name} ${tag}`);
          console.log(`  formula_role: ${structured.formula_role ?? "(null)"}`);
          console.log(`  benefit:      ${structured.benefit ?? "(null)"}`);
          console.log(`  concern:      ${structured.concern ?? "(null)"}`);
          ok++;
        }
      }
    } catch (e) {
      console.log(`✗ ${ingredient.name} ${tag} — error: ${(e as Error).message}`);
      failed++;
    }

    // Rate limiting: short pause between every call, longer every 10
    if (i < data.length - 1) {
      await sleep((i + 1) % 10 === 0 ? 2000 : 200);
    }
  }

  console.log(`\nDone — ${ok} ${apply ? "written" : "generated (dry run)"}, ${failed} failed.`);
  if (!apply && ok > 0) console.log(`\nRun with --apply to write to DB.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
