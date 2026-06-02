/**
 * Standalone CLI equivalent of POST /api/admin/upgrade-explanations.
 *
 * Processes up to --batch N ingredients per run across three queues:
 *   1. Explanation upgrade   — explanation_source IN (null, template, template_unclassified)
 *   2. Fatty acid profile    — Emollient + profile_status = needs_profile
 *   3. Bioactive profile     — Plant Extract + profile_status = needs_profile
 *
 * --dry-run  Show what would be processed without making AI calls or DB writes.
 * --batch N  Ingredients per pass (default 20, max 50).
 * --loop     Keep running until all queues are empty (2 s between passes).
 *
 * Usage:
 *   npx tsx scripts/generate-explanations.ts [--dry-run] [--batch 20] [--loop]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateCuratedExplanation, generateWithReclassification } from "../src/lib/ai-explanation.js";
import { generateNotes } from "../src/lib/curated-explanation.js";
import { getFattyAcidProfile } from "../src/lib/fatty-acid-ai.js";
import { getOilCategories, generateFattyAcidNotes } from "../src/lib/fatty-acid-concerns.js";
import { getBioactiveProfile } from "../src/lib/bioactive-ai.js";
import { getBioactiveCategories, generateBioactiveNotes } from "../src/lib/bioactive-concerns.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env before any client is created — dotenv.config must run before
// createClient or Anthropic() are called, so clients are initialised lazily.
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Supabase client created after dotenv — module-level createClient would
// run before dotenv.config() resolves in the ES module initialisation graph.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error("NEXT_PUBLIC_SUPABASE_URL not set — did vercel env pull run?"); })(),
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error("SUPABASE_SERVICE_ROLE_KEY not set"); })(),
);

const DRY_RUN = process.argv.includes("--dry-run");
const LOOP = process.argv.includes("--loop");
const batchArg = process.argv.find((a) => a === "--batch");
const BATCH = batchArg
  ? Math.min(parseInt(process.argv[process.argv.indexOf("--batch") + 1] ?? "20", 10), 50)
  : 20;

// ── queue counts ──────────────────────────────────────────────────────────────

async function getCounts(): Promise<{ weak: number; needsProfile: number }> {
  const [{ count: weak }, { count: needsProfile }] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified"),
    supabase
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .eq("profile_status", "needs_profile"),
  ]);
  return { weak: weak ?? 0, needsProfile: needsProfile ?? 0 };
}

// ── single pass ───────────────────────────────────────────────────────────────

async function runPass(passNum: number): Promise<{ upgraded: number; remaining: number }> {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_source, profile_status")
    .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified,profile_status.eq.needs_profile")
    .order("name")
    .limit(BATCH);

  if (error) throw new Error(`Supabase fetch: ${error.message}`);
  if (!ingredients?.length) return { upgraded: 0, remaining: 0 };

  if (DRY_RUN) {
    console.log(`\nPass ${passNum} — ${ingredients.length} ingredient(s) would be processed:\n`);
    for (const ing of ingredients) {
      const tasks: string[] = [];
      if (ing.explanation_source == null || ing.explanation_source === "template" || ing.explanation_source === "template_unclassified") {
        tasks.push(`explanation (${ing.explanation_source === "template_unclassified" ? "reclassify" : "upgrade"})`);
      }
      if (ing.structural_category === "Emollient" && (ing.profile_status === "needs_profile" || ing.profile_status === null)) {
        tasks.push("fatty acid profile");
      }
      if (ing.structural_category === "Plant Extract" && (ing.profile_status === "needs_profile" || ing.profile_status === null)) {
        tasks.push("bioactive profile");
      }
      console.log(`  ${ing.name} [${ing.structural_category ?? "—"}] → ${tasks.join(", ")}`);
    }
    const counts = await getCounts();
    return { upgraded: 0, remaining: counts.weak + counts.needsProfile };
  }

  let upgraded = 0;

  for (const ing of ingredients) {
    const label = ing.name.length > 50 ? ing.name.slice(0, 47) + "…" : ing.name;
    process.stdout.write(`  ${label} … `);

    const needsExplanation = ing.explanation_source == null ||
      ing.explanation_source === "template" ||
      ing.explanation_source === "template_unclassified";

    let finalStructuralCategory = ing.structural_category;
    let explanationUpdate: Record<string, unknown> = {};

    // ── explanation upgrade ──────────────────────────────────────────────────
    if (needsExplanation) {
      if (ing.explanation_source === "template_unclassified") {
        const result = await generateWithReclassification(ing.name);
        if (result.source === "curated") {
          const updatedIng = {
            status: result.status ?? ing.status,
            structural_category: result.structural_category !== undefined ? result.structural_category : ing.structural_category,
            category: result.category !== undefined ? result.category : ing.category,
            flagged_category: result.flagged_category !== undefined ? result.flagged_category : ing.flagged_category,
          };
          finalStructuralCategory = updatedIng.structural_category;
          const notes = generateNotes(updatedIng as typeof ing);
          explanationUpdate = {
            ...updatedIng,
            explanation: result.explanation,
            explanation_structured: result.explanation_structured,
            explanation_source: "curated",
            skin_climate_notes: notes.length > 0 ? notes : null,
          };
        }
      } else {
        const { explanation, explanation_structured, source } = await generateCuratedExplanation(ing);
        if (source === "curated") {
          const notes = generateNotes(ing);
          explanationUpdate = {
            explanation,
            explanation_structured,
            explanation_source: "curated",
            skin_climate_notes: notes.length > 0 ? notes : null,
          };
        }
      }
    }

    // ── fatty acid profile (Emollient) ───────────────────────────────────────
    const shouldProfile =
      finalStructuralCategory === "Emollient" &&
      (ing.profile_status === "needs_profile" || ing.profile_status === null);

    let profileUpdate: Record<string, unknown> = {};
    if (shouldProfile) {
      const profile = await getFattyAcidProfile(ing.name);
      const { category, secondary_benefit_categories } = getOilCategories(ing.name, profile ?? {});
      const fattyNotes = generateFattyAcidNotes(ing.name, profile ?? {});
      const ruleNotes = (explanationUpdate.skin_climate_notes as unknown[] | null) ?? generateNotes(ing);
      const allNotes = [...(ruleNotes as object[]), ...fattyNotes];
      profileUpdate = {
        fatty_acid_profile: profile,
        profile_status: "ai_generated",
        category,
        secondary_benefit_categories,
        skin_climate_notes: allNotes.length > 0 ? allNotes : null,
      };
    }

    // ── bioactive profile (Plant Extract) ────────────────────────────────────
    const shouldBioactive =
      finalStructuralCategory === "Plant Extract" &&
      (ing.profile_status === "needs_profile" || ing.profile_status === null);

    let bioactiveUpdate: Record<string, unknown> = {};
    if (shouldBioactive) {
      const bioProfile = await getBioactiveProfile(ing.name);
      const classification = getBioactiveCategories(bioProfile);
      const bioNotes = generateBioactiveNotes(bioProfile);
      const updatedContext = {
        name: ing.name,
        status: classification.status ?? (explanationUpdate.status as string ?? ing.status),
        structural_category: finalStructuralCategory,
        category: classification.category,
        flagged_category: classification.flagged_category ?? (explanationUpdate.flagged_category as string | null ?? ing.flagged_category),
      };
      const ruleNotes = (explanationUpdate.skin_climate_notes as unknown[] | null) ?? generateNotes(updatedContext as typeof ing);
      const allNotes = [...(ruleNotes as object[]), ...bioNotes];
      bioactiveUpdate = {
        bioactive_profile: bioProfile,
        profile_status: "ai_generated",
        category: classification.category,
        secondary_benefit_categories: classification.secondary_benefit_categories,
        skin_climate_notes: allNotes.length > 0 ? allNotes : null,
        ...(classification.status === "flagged" && {
          status: "flagged",
          flagged_category: "sensitizer",
          category: null,
          secondary_benefit_categories: [],
        }),
      };
    }

    const combinedUpdate = { ...explanationUpdate, ...profileUpdate, ...bioactiveUpdate };
    if (Object.keys(combinedUpdate).length > 0) {
      const { error: updateError } = await supabase
        .from("ingredients")
        .update(combinedUpdate)
        .eq("id", ing.id);
      if (updateError) {
        console.log(`✗ (${updateError.message})`);
      } else {
        const tags: string[] = [];
        if (Object.keys(explanationUpdate).length) tags.push(ing.explanation_source === "template_unclassified" ? "reclassified" : "explanation");
        if (Object.keys(profileUpdate).length) tags.push("fatty acid");
        if (Object.keys(bioactiveUpdate).length) {
          tags.push(bioactiveUpdate.status === "flagged" ? "bioactive → FLAGGED" : "bioactive");
        }
        console.log(`✓ ${tags.join(" + ")}`);
        upgraded++;
      }
    } else {
      console.log("skipped (no update)");
    }
  }

  const counts = await getCounts();
  return { upgraded, remaining: counts.weak + counts.needsProfile };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const initial = await getCounts();
  console.log(`\nGenerate Explanations`);
  console.log(`  Weak explanations : ${initial.weak}`);
  console.log(`  Needs profile     : ${initial.needsProfile}`);
  console.log(`  Batch size        : ${BATCH}`);
  if (DRY_RUN) console.log(`  Mode              : DRY RUN`);
  if (LOOP) console.log(`  Mode              : LOOP until empty`);
  console.log("");

  if (initial.weak + initial.needsProfile === 0) {
    console.log("All queues empty — nothing to do.\n");
    return;
  }

  let pass = 1;
  while (true) {
    const { upgraded, remaining } = await runPass(pass);
    if (!DRY_RUN) {
      console.log(`\n  Pass ${pass}: ${upgraded} processed, ${remaining} remaining\n`);
    }
    if (!LOOP || remaining === 0 || DRY_RUN) break;
    pass++;
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!DRY_RUN && LOOP) {
    const final = await getCounts();
    if (final.weak + final.needsProfile === 0) {
      console.log("All queues empty.\n");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
