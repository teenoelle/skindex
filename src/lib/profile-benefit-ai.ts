import { callClaude } from "@/lib/claude-cli";
import type { SkinClimateNote } from "@/types";
import { PROFILE_BENEFIT_CONTEXT, PROFILE_NOTE_FIELD } from "@/lib/profile-benefit-cats";

export async function generateProfileBenefitNote(
  ingredientName: string,
  categoryLabel: string,
  profileKey: string,
): Promise<SkinClimateNote | null> {
  const context = PROFILE_BENEFIT_CONTEXT[profileKey];
  const field = PROFILE_NOTE_FIELD[profileKey];
  if (!context || !field) return null;

  const profileDisplay = profileKey.replace(/_/g, " ");
  const prompt = `You are a cosmetic dermatology expert. Write a single benefit note explaining why a specific cosmetic ingredient is particularly beneficial for a skin profile.

Requirements:
- 1–2 sentences, maximum 55 words
- Name the ingredient specifically — reference what this ingredient does, not just what the category does generically
- Reference the skin mechanism relevant to this profile
- Clinical and precise, no marketing language
- Return only the note text — no JSON, no quotes, no preamble, no label

Ingredient: ${ingredientName}
Category: ${categoryLabel}
Profile: ${profileDisplay}
Profile context: ${context}`;

  const raw = (await callClaude(prompt)) ?? "";
  const note = raw.trim().replace(/^["']|["']$/g, "");

  if (!note || note.length < 15 || note.length > 400 || note.startsWith("{")) return null;

  const noteObj: SkinClimateNote = {
    dimensions: field === "dimensions" ? [profileKey] : [],
    climate: field === "climate" ? [profileKey] : [],
    sentiment: "benefit",
    text: note,
  };

  return noteObj;
}
