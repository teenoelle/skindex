import { anthropic } from "@/lib/anthropic";
import type { BioactiveProfile } from "@/types";

const SYSTEM_PROMPT = `You are a cosmetic chemistry expert with accurate knowledge of plant extract properties.

Given a cosmetic ingredient name, return a JSON object describing its bioactive profile.
Return null if the ingredient is not a meaningful plant extract (e.g. it is a synthetic compound,
a processing descriptor, a solvent, or you have insufficient information).

Return this exact JSON structure:
{
  "primary_action": <one allowed value>,
  "secondary_actions": [<0–3 additional allowed values, different from primary>],
  "key_compounds": [<1–3 notable bioactive compounds as strings>],
  "sensitization_risk": <"low" | "moderate" | "high">
}

Allowed action values:
  "antioxidant"       – neutralises free radicals; protects against oxidative stress
  "soothing"          – calms redness, irritation, inflammation
  "brightening"       – addresses hyperpigmentation, evens skin tone
  "firming"           – supports collagen, improves elasticity
  "barrier-repairing" – strengthens lipid barrier, reduces TEWL
  "antimicrobial"     – broad antibacterial or antifungal activity
  "anti-malassezia"   – specifically targets Malassezia yeast
  "wound-healing"     – accelerates tissue repair and regeneration
  "anti-inflammatory" – reduces inflammatory mediators (prefer over "soothing" when mechanism is COX/LOX inhibition)

sensitization_risk guidance:
  "high"     – documented contact sensitizer or allergen
  "moderate" – known mild irritant or low-level sensitizer in some individuals
  "low"      – well-tolerated, no significant sensitization concern

Return ONLY valid JSON — the object or the literal null. No explanation text.`;

const VALID_ACTIONS = new Set([
  "antioxidant", "soothing", "brightening", "firming", "barrier-repairing",
  "antimicrobial", "anti-malassezia", "wound-healing", "anti-inflammatory",
]);

export async function getBioactiveProfile(name: string): Promise<BioactiveProfile | null> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: name }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  if (!raw || raw === "null") return null;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) return null;

    const { primary_action, secondary_actions, key_compounds, sensitization_risk } = parsed;

    if (!VALID_ACTIONS.has(primary_action)) return null;
    if (!["low", "moderate", "high"].includes(sensitization_risk)) return null;

    return {
      primary_action: primary_action as BioactiveProfile["primary_action"],
      secondary_actions: Array.isArray(secondary_actions)
        ? secondary_actions.filter((a: unknown) => typeof a === "string" && VALID_ACTIONS.has(a) && a !== primary_action).slice(0, 3)
        : [],
      key_compounds: Array.isArray(key_compounds)
        ? key_compounds.filter((c: unknown) => typeof c === "string").slice(0, 3)
        : [],
      sensitization_risk: sensitization_risk as BioactiveProfile["sensitization_risk"],
    };
  } catch {
    return null;
  }
}
