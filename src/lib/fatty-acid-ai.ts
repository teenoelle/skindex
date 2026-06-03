import { callClaude } from "@/lib/claude-cli";
import type { FattyAcidProfile } from "@/types";

const SYSTEM_PROMPT = `You are a cosmetic chemistry expert with accurate knowledge of plant oil fatty acid composition.

Given an ingredient name, return a JSON object with the approximate fatty acid percentages for that oil.
Only include fields with a value greater than 1%. All values are percentages (0–100).

Fields to use (only include what applies):
  linoleic        — LA, omega-6
  oleic           — OA, omega-9
  alpha_linolenic — ALA, omega-3
  gamma_linolenic — GLA, omega-6 (borage, evening primrose, blackcurrant)
  palmitoleic     — omega-7 (sea buckthorn berry, macadamia)
  lauric          — saturated C12 (coconut, palm kernel, babassu)
  palmitic        — saturated C16
  stearic         — saturated C18
  ricinoleic      — hydroxy C18:1 (castor oil only)
  punicic         — omega-5 (pomegranate seed only)

If the ingredient is NOT a plant-derived oil with a meaningful fatty acid profile
(e.g. mineral oil, petrolatum, squalane, paraffin, beeswax, silicone, synthetic ester,
carnauba wax, lanolin, or any non-oil ingredient), return null.

Return ONLY valid JSON — either the object or the literal null. No explanation text.`;

export async function getFattyAcidProfile(name: string): Promise<FattyAcidProfile | null> {
  const raw = (await callClaude(`${SYSTEM_PROMPT}\n\n${name}`)) ?? "";
  if (!raw || raw === "null") return null;

  const jsonMatch = raw.match(/\{[\s\S]*\}|null/);
  const cleaned = jsonMatch ? jsonMatch[0] : raw;
  if (!cleaned || cleaned === "null") return null;

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) return null;
    for (const v of Object.values(parsed)) {
      if (typeof v !== "number" || (v as number) < 0 || (v as number) > 100) return null;
    }
    return parsed as FattyAcidProfile;
  } catch {
    return null;
  }
}
