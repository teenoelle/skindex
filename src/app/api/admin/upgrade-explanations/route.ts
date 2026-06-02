import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateCuratedExplanation, generateWithReclassification } from "@/lib/ai-explanation";
import { generateNotes } from "@/lib/curated-explanation";
import { getFattyAcidProfile } from "@/lib/fatty-acid-ai";
import { getOilCategories, generateFattyAcidNotes } from "@/lib/fatty-acid-concerns";

async function guard() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 };
  const { data: user } = await supabase.from("app_users").select("role").eq("clerk_id", userId).maybeSingle();
  if (user?.role !== "admin") return { error: "Forbidden", status: 403 };
  return null;
}

export async function GET(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const [{ count: weak }, { count: needsProfile }, { count: total }] = await Promise.all([
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified"),
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .eq("profile_status", "needs_profile"),
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({ weak: weak ?? 0, needsProfile: needsProfile ?? 0, total: total ?? 0 });
}

// Upgrades a batch of template/null explanations to AI-curated, and enriches fatty acid
// profiles for Emollient ingredients with profile_status = 'needs_profile'.
// Call repeatedly until both weak and needsProfile counts reach 0.
export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { batchSize = 20 } = await req.json().catch(() => ({}));

  const { data: ingredients } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_source, profile_status")
    .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified,profile_status.eq.needs_profile")
    .order("name")
    .limit(Math.min(batchSize, 50));

  if (!ingredients?.length) return NextResponse.json({ upgraded: 0, remaining: 0 });

  let upgraded = 0;
  for (const ing of ingredients) {
    const needsExplanation = ing.explanation_source == null ||
      ing.explanation_source === "template" ||
      ing.explanation_source === "template_unclassified";

    // Track the final structural category in case reclassification changes it
    let finalStructuralCategory = ing.structural_category;
    let explanationUpdate: Record<string, unknown> = {};

    // ── Explanation upgrade ────────────────────────────────────────────────
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

    // ── Fatty acid profile enrichment (Emollient only) ─────────────────────
    // Runs when profile_status = 'needs_profile', or when reclassification just
    // produced structural_category = 'Emollient' (profile_status still null).
    const shouldProfile =
      finalStructuralCategory === "Emollient" &&
      (ing.profile_status === "needs_profile" || ing.profile_status === null);

    let profileUpdate: Record<string, unknown> = {};
    if (shouldProfile) {
      const profile = await getFattyAcidProfile(ing.name);
      const { category, secondary_benefit_categories } = getOilCategories(ing.name, profile ?? {});
      const fattyNotes = generateFattyAcidNotes(ing.name, profile ?? {});

      // Merge rule-based notes (from explanation pass) with fatty acid notes
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

    const combinedUpdate = { ...explanationUpdate, ...profileUpdate };
    if (Object.keys(combinedUpdate).length > 0) {
      await supabaseAdmin.from("ingredients").update(combinedUpdate).eq("id", ing.id);
      upgraded++;
    }
  }

  const [{ count: weakRemaining }, { count: profileRemaining }] = await Promise.all([
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .or("explanation_source.is.null,explanation_source.eq.template,explanation_source.eq.template_unclassified"),
    supabaseAdmin
      .from("ingredients")
      .select("id", { count: "exact", head: true })
      .eq("profile_status", "needs_profile"),
  ]);

  return NextResponse.json({
    upgraded,
    remaining: (weakRemaining ?? 0) + (profileRemaining ?? 0),
  });
}
