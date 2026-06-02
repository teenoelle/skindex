/**
 * Fetches ingredients that need curated AI explanations and outputs them as JSON.
 * Claude Code reads this output and generates explanations inline.
 *
 * Usage:
 *   npx tsx scripts/fetch-need-explanation.ts [N] [--missing-labels]
 *
 * Modes:
 *   (default)        Fetch ingredients with no curated explanation yet
 *                    (explanation_source IS NULL or 'template')
 *   --missing-labels Fetch curated ingredients that are missing the new label
 *                    fields: concern_category (flagged) or benefit_category
 *                    (any with a benefit sentence but no category or label set).
 *                    Includes existing explanation_structured so sentences can
 *                    be preserved and only labels need to be generated.
 *
 * Output: JSON array of { id, name, status, structural_category, category,
 *   flagged_category, secondary_flagged_categories, explanation_structured? }
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

const args = process.argv.slice(2);
const missingLabels = args.includes("--missing-labels");
const limit = parseInt(args.find((a) => /^\d+$/.test(a)) ?? "30");

type ExplanationStructured = {
  formula_role: string | null;
  benefit: string | null;
  benefit_category?: string | null;
  benefit_profiles?: string[] | null;
  concern: string | null;
  concern_category?: string | null;
  concern_profiles?: string[] | null;
  concern_items?: { category: string; text: string }[] | null;
};

type Row = {
  id: string;
  name: string;
  status: string;
  structural_category: string | null;
  category: string | null;
  flagged_category: string | null;
  secondary_flagged_categories: string[];
  explanation_structured: ExplanationStructured | null;
};

async function main() {
  if (missingLabels) {
    // Fetch all curated ingredients, then filter client-side for missing labels.
    // Page through in chunks to avoid row limits.
    const all: Row[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories, explanation_structured")
        .eq("explanation_source", "curated")
        .order("name")
        .range(from, from + PAGE - 1);
      if (error) { console.error(error.message); process.exit(1); }
      if (!data || data.length === 0) break;
      all.push(...(data as Row[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const needing = all.filter((row) => {
      const s = row.explanation_structured as Record<string, unknown>;
      if (!s) return false;
      // Flagged: has concern text but concern_category key has never been written
      const needsConcernLabel = row.status === "flagged" && !!s["concern"] && !s["concern_items"] && !("concern_category" in s);
      // Any: has benefit text, no ingredient-level category, and benefit_category key has never been written
      const needsBenefitLabel = !!s["benefit"] && !row.category && !("benefit_category" in s);
      return needsConcernLabel || needsBenefitLabel;
    }).slice(0, limit);

    console.log(JSON.stringify(needing, null, 2));
    return;
  }

  // Default: ingredients with no curated explanation yet
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, status, structural_category, category, flagged_category, secondary_flagged_categories")
    .or("explanation_source.is.null,explanation_source.eq.template")
    .order("name")
    .limit(limit);

  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data ?? [], null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
