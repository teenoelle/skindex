/**
 * Processes up to --batch N ingredients per run across four queues:
 *   0. ingredient_queue drain — new ingredients → classify + AI explanation
 *   1. Explanation upgrade    — explanation_source IN (null, template, template_unclassified)
 *   2. Fatty acid profile     — Emollient + profile_status = needs_profile
 *   3. Bioactive profile      — Plant Extract + profile_status = needs_profile
 *
 * benefit_profiles and concern_profiles are derived from skin_climate_notes and
 * merged into explanation_structured automatically at every write.
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
import { parseIngredientList } from "../src/lib/ingredient-matcher.js";
import { generateCuratedExplanation, generateWithReclassification } from "../src/lib/ai-explanation.js";
import { generateNotes } from "../src/lib/curated-explanation.js";
import { getFattyAcidProfile } from "../src/lib/fatty-acid-ai.js";
import { getOilCategories, generateFattyAcidNotes } from "../src/lib/fatty-acid-concerns.js";
import { getBioactiveProfile } from "../src/lib/bioactive-ai.js";
import { getBioactiveCategories, generateBioactiveNotes } from "../src/lib/bioactive-concerns.js";
import { profilesFromNotes, mergeProfileLabels } from "../src/lib/profile-labels.js";
import { generateProfileBenefitNote } from "../src/lib/profile-benefit-ai.js";
import { PROFILE_BENEFIT_CATS, PROFILE_NOTE_FIELD, getAllBenefitDbKeys, getCategoryDisplayLabel } from "../src/lib/profile-benefit-cats.js";
import type { ExplanationStructured, SkinClimateNote } from "../src/types/index.js";

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

async function getQueueCount(): Promise<number> {
  const { count } = await supabase
    .from("ingredient_queue")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

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

// ── name-starts-with validation ───────────────────────────────────────────────

function passesNameCheck(structured: ExplanationStructured | null | undefined, name: string): boolean {
  if (!structured) return true;
  const prefix = name.toLowerCase();
  for (const text of [structured.formula_role, structured.benefit, structured.concern]) {
    if (typeof text === "string" && !text.toLowerCase().startsWith(prefix)) return false;
  }
  return true;
}

async function withReclassificationChecked(name: string) {
  let result = await generateWithReclassification(name);
  if (result.source === "curated" && !passesNameCheck(result.explanation_structured, name)) {
    console.log(`(name check failed — retrying) `);
    result = await generateWithReclassification(name);
    if (!passesNameCheck(result.explanation_structured, name)) {
      console.log(`(name check failed after retry — saving anyway) `);
    }
  }
  return result;
}

async function withCuratedChecked(ingredient: Parameters<typeof generateCuratedExplanation>[0]) {
  let result = await generateCuratedExplanation(ingredient);
  if (result.source === "curated" && !passesNameCheck(result.explanation_structured, ingredient.name)) {
    console.log(`(name check failed — retrying) `);
    result = await generateCuratedExplanation(ingredient);
    if (!passesNameCheck(result.explanation_structured, ingredient.name)) {
      console.log(`(name check failed after retry — saving anyway) `);
    }
  }
  return result;
}

// ── queue drain (new ingredients → AI classify + explain directly) ────────────

async function drainQueuePass(passNum: number): Promise<{ inserted: number; remaining: number; newIngredients: { id: string; name: string }[] }> {
  const { data: queue, error } = await supabase
    .from("ingredient_queue")
    .select("id, name")
    .order("times_seen", { ascending: false })
    .limit(BATCH);

  if (error) throw new Error(`Queue fetch: ${error.message}`);
  if (!queue?.length) return { inserted: 0, remaining: 0, newIngredients: [] };

  if (DRY_RUN) {
    console.log(`\nQueue pass ${passNum} — ${queue.length} item(s) would be processed:\n`);
    for (const item of queue) {
      console.log(`  ${item.name} → classify + AI explanation`);
    }
    return { inserted: 0, remaining: await getQueueCount(), newIngredients: [] };
  }

  let inserted = 0;
  const doneIds: string[] = [];
  const newIngredients: { id: string; name: string }[] = [];

  for (const item of queue) {
    const label = item.name.length > 50 ? item.name.slice(0, 47) + "…" : item.name;
    process.stdout.write(`  [queue] ${label} … `);

    const { data: existing } = await supabase
      .from("ingredients")
      .select("id")
      .ilike("name", item.name)
      .maybeSingle();

    if (existing) {
      console.log("already exists");
      doneIds.push(item.id);
      newIngredients.push({ id: existing.id, name: item.name });
      continue;
    }

    const result = await withReclassificationChecked(item.name);
    if (result.source !== "curated") {
      console.log("✗ (AI unavailable — will retry)");
      continue;
    }

    const ingContext = {
      name: item.name,
      status: result.status ?? "safe" as const,
      structural_category: result.structural_category ?? null,
      category: result.category ?? null,
      flagged_category: result.flagged_category ?? null,
    };
    const notes = generateNotes(ingContext);
    const derived = profilesFromNotes(notes, ingContext.flagged_category);
    const needsProfile =
      ingContext.structural_category === "Emollient" ||
      ingContext.structural_category === "Plant Extract";

    const { data: insertedRow, error: insertError } = await supabase
      .from("ingredients")
      .insert({
        name: item.name,
        status: ingContext.status,
        structural_category: ingContext.structural_category,
        category: ingContext.category,
        flagged_category: ingContext.flagged_category,
        explanation: result.explanation,
        explanation_structured: {
          ...result.explanation_structured,
          ...(derived.benefit_profiles ? { benefit_profiles: derived.benefit_profiles } : {}),
          ...(derived.concern_profiles ? { concern_profiles: derived.concern_profiles } : {}),
        },
        explanation_source: "curated",
        skin_climate_notes: notes.length > 0 ? notes : null,
        profile_status: needsProfile ? "needs_profile" : null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.log(`✗ (${insertError.message})`);
    } else {
      console.log(`✓ classified + AI explanation${needsProfile ? " + queued for profile" : ""}`);
      inserted++;
      doneIds.push(item.id);
      newIngredients.push({ id: insertedRow.id, name: item.name });
    }
  }

  if (doneIds.length > 0) {
    await supabase.from("ingredient_queue").delete().in("id", doneIds);
  }

  return { inserted, remaining: await getQueueCount(), newIngredients };
}

// ── single pass ───────────────────────────────────────────────────────────────

async function runPass(passNum: number): Promise<{ upgraded: number; remaining: number }> {
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_source, profile_status, explanation_structured, skin_climate_notes")
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
        const result = await withReclassificationChecked(ing.name);
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
        const { explanation, explanation_structured, source } = await withCuratedChecked(ing);
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

    // ── Auto-derive and merge explanation profiles ────────────────────────────
    if (Object.keys(combinedUpdate).length > 0) {
      const finalNotes = (combinedUpdate.skin_climate_notes as SkinClimateNote[] | null)
        ?? (Array.isArray(ing.skin_climate_notes) ? ing.skin_climate_notes as SkinClimateNote[] : null);
      const currentStructured = (combinedUpdate.explanation_structured ?? ing.explanation_structured) as ExplanationStructured | null;
      if (finalNotes && currentStructured) {
        const finalFc = (
          (bioactiveUpdate.flagged_category as string | null | undefined) ??
          (explanationUpdate.flagged_category as string | null | undefined) ??
          ing.flagged_category
        ) ?? null;
        const derived = profilesFromNotes(finalNotes, finalFc);
        const mergedBenefit = mergeProfileLabels(currentStructured.benefit_profiles, derived.benefit_profiles);
        const mergedConcern = mergeProfileLabels(currentStructured.concern_profiles, derived.concern_profiles);
        if (mergedBenefit !== null || mergedConcern !== null) {
          combinedUpdate.explanation_structured = {
            ...currentStructured,
            ...(mergedBenefit ? { benefit_profiles: mergedBenefit } : {}),
            ...(mergedConcern ? { concern_profiles: mergedConcern } : {}),
          };
        }
      }
    }

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

// ── queue 5: profile benefit notes ───────────────────────────────────────────
// For each profile in PROFILE_BENEFIT_CATS, find ingredients whose category is
// in that profile's benefit list but are missing a benefit note for that profile.
// Generates and appends a profile-specific note via AI.

async function runProfileBenefitPass(passNum: number): Promise<{ written: number; found: number }> {
  const allDbKeys = getAllBenefitDbKeys();

  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, category, skin_climate_notes")
    .in("category", allDbKeys)
    .order("name")
    .limit(BATCH * 10);

  if (error) throw new Error(`Profile benefit fetch: ${error.message}`);
  if (!ingredients?.length) return { written: 0, found: 0 };

  type WorkItem = { id: string; name: string; profileKey: string; categoryLabel: string };
  const toProcess: WorkItem[] = [];

  for (const ing of ingredients) {
    const categoryLabel = getCategoryDisplayLabel(ing.category ?? "");
    const existingNotes = Array.isArray(ing.skin_climate_notes) ? ing.skin_climate_notes as SkinClimateNote[] : [];

    for (const [profileKey, benefitLabels] of Object.entries(PROFILE_BENEFIT_CATS)) {
      if (!benefitLabels?.includes(categoryLabel)) continue;
      const field = PROFILE_NOTE_FIELD[profileKey];
      if (!field) continue;
      const alreadyHas = existingNotes.some((n) =>
        n.sentiment === "benefit" &&
        (field === "climate"
          ? (n.climate ?? []).includes(profileKey)
          : (n.dimensions ?? []).includes(profileKey)),
      );
      if (!alreadyHas) toProcess.push({ id: ing.id, name: ing.name, profileKey, categoryLabel });
    }

    if (toProcess.length >= BATCH * 3) break;
  }

  if (!toProcess.length) return { written: 0, found: 0 };

  if (DRY_RUN) {
    console.log(`\nProfile benefit pass ${passNum} — ${toProcess.length} note(s) would be generated:\n`);
    for (const { name, profileKey, categoryLabel } of toProcess.slice(0, BATCH)) {
      console.log(`  ${name} [${categoryLabel}] → ${profileKey}`);
    }
    return { written: 0, found: toProcess.length };
  }

  let written = 0;
  for (const { id, name, profileKey, categoryLabel } of toProcess.slice(0, BATCH)) {
    const label = name.length > 45 ? name.slice(0, 42) + "…" : name;
    process.stdout.write(`  [benefit] ${label} → ${profileKey} … `);

    const note = await generateProfileBenefitNote(name, categoryLabel, profileKey);
    if (!note) {
      console.log("✗ (AI unavailable — will retry)");
      continue;
    }

    // Re-fetch to avoid clobbering concurrent writes
    const { data: fresh } = await supabase
      .from("ingredients")
      .select("skin_climate_notes")
      .eq("id", id)
      .single();

    const currentNotes = Array.isArray(fresh?.skin_climate_notes)
      ? fresh.skin_climate_notes as SkinClimateNote[]
      : [];

    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ skin_climate_notes: [...currentNotes, note] })
      .eq("id", id);

    if (updateError) {
      console.log(`✗ (${updateError.message})`);
    } else {
      console.log("✓");
      written++;
    }
  }

  return { written, found: toProcess.length };
}

// ── targeted relink for newly classified ingredients ─────────────────────────

async function relinkNewIngredients(newIngredients: { id: string; name: string }[]): Promise<number> {
  if (!newIngredients.length) return 0;
  let linked = 0;

  for (const ing of newIngredients) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, ingredient_list")
      .ilike("ingredient_list", `%${ing.name}%`)
      .eq("is_archived", false)
      .eq("is_pending", false);

    if (!products?.length) continue;

    const productIds = products.map((p) => p.id);
    const { data: existing } = await supabase
      .from("product_ingredients")
      .select("product_id")
      .eq("ingredient_id", ing.id)
      .in("product_id", productIds);
    const alreadyLinked = new Set((existing ?? []).map((r) => r.product_id));

    const toInsert: { product_id: string; ingredient_id: string; position: number }[] = [];

    for (const product of products) {
      if (alreadyLinked.has(product.id)) continue;
      const items = parseIngredientList(product.ingredient_list as string);
      const n = ing.name.toLowerCase();
      const pos = items.findIndex((item) => {
        const lower = item.toLowerCase();
        const tokenLong = lower.length >= 6;
        const nameLong = n.length >= 6;
        return lower === n || (nameLong && lower.includes(n)) || (tokenLong && n.includes(lower));
      });
      if (pos === -1) continue; // ILIKE false positive — name not in parsed list
      toInsert.push({ product_id: product.id, ingredient_id: ing.id, position: pos + 1 });
    }

    if (!toInsert.length) continue;

    const { error } = await supabase
      .from("product_ingredients")
      .upsert(toInsert, { onConflict: "product_id,ingredient_id" });
    if (error) {
      console.log(`  [relink] ✗ ${ing.name}: ${error.message}`);
    } else {
      linked += toInsert.length;
    }
  }

  return linked;
}

// ── product watch notifications ───────────────────────────────────────────────

async function notifyWatchers(): Promise<void> {
  const { data: watches } = await supabase
    .from("product_watch")
    .select("id, user_id, product_id, unreviewed_names");

  if (!watches?.length) return;

  for (const watch of watches) {
    const names: string[] = watch.unreviewed_names ?? [];
    if (!names.length) continue;

    // Check if any of the watched ingredient names are still pending in the queue
    let anyRemaining = false;
    for (const name of names) {
      const { count } = await supabase
        .from("ingredient_queue")
        .select("id", { count: "exact", head: true })
        .ilike("name", name);
      if ((count ?? 0) > 0) {
        anyRemaining = true;
        break;
      }
    }

    if (!anyRemaining) {
      if (!DRY_RUN) {
        await supabase.from("product_notifications").insert({
          user_id: watch.user_id,
          product_id: watch.product_id,
          type: "ingredients_ready",
        });
        await supabase.from("product_watch").delete().eq("id", watch.id);
      }
      console.log(`  [watch] Notified user ${watch.user_id} — all ingredients ready`);
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const initial = await getCounts();
  const initialQueue = await getQueueCount();
  console.log(`\nGenerate Explanations`);
  console.log(`  Queue (new)          : ${initialQueue}`);
  console.log(`  Weak explanations    : ${initial.weak}`);
  console.log(`  Needs profile        : ${initial.needsProfile}`);
  console.log(`  Profile benefit notes: (checked per pass)`);
  console.log(`  Batch size           : ${BATCH}`);
  if (DRY_RUN) console.log(`  Mode                 : DRY RUN`);
  if (LOOP) console.log(`  Mode                 : LOOP until empty`);
  console.log("");

  if (!LOOP && initialQueue + initial.weak + initial.needsProfile === 0) {
    // In loop mode, skip early exit — benefit notes are checked per pass and
    // the loop's own termination condition handles clean exit when all are done.
    console.log("All queues empty — nothing to do.\n");
    return;
  }

  let pass = 1;
  while (true) {
    let queueRemaining = 0;
    if (initialQueue > 0 || pass > 1) {
      const { inserted, remaining, newIngredients } = await drainQueuePass(pass);
      queueRemaining = remaining;
      if (!DRY_RUN) {
        console.log(`\n  Queue pass ${pass}: ${inserted} classified, ${remaining} remaining\n`);
        if (newIngredients.length > 0) {
          const linked = await relinkNewIngredients(newIngredients);
          if (linked > 0) console.log(`  Relinked ${linked} product_ingredient(s)\n`);
        }
        if (inserted > 0) await notifyWatchers();
      }
    }

    const { upgraded, remaining: explRemaining } = await runPass(pass);
    if (!DRY_RUN) {
      console.log(`\n  Pass ${pass}: ${upgraded} processed, ${explRemaining} remaining\n`);
    }

    const { written: benefitWritten, found: benefitFound } = await runProfileBenefitPass(pass);
    if (!DRY_RUN && benefitFound > 0) {
      console.log(`\n  Benefit pass ${pass}: ${benefitWritten} written, ${benefitFound - benefitWritten} remaining\n`);
    }

    if (!LOOP || (queueRemaining === 0 && explRemaining === 0 && benefitFound === 0) || DRY_RUN) break;
    pass++;
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!DRY_RUN && LOOP) {
    const final = await getCounts();
    const finalQueue = await getQueueCount();
    if (finalQueue + final.weak + final.needsProfile === 0) {
      console.log("All queues empty.\n");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
