/**
 * Shared concern-count chip row used by DYM, Alternatives, Browse, and Saved Lists.
 * No background colours — just coloured text labels.
 *
 * Colour key (matches the By-Concern section in Scanner):
 *   rose   — universal concerns (fragrance allergens, preservative allergens, etc.)
 *   amber  — your concerns     (profile-matched)
 *   yellow — other concerns    (flagged but not matching this profile)
 *   teal   — Neutral           (zero concerns)
 */
export default function ConcernChips({
  total,
  universalCount = 0,
  profileMatchedCount,
  hasProfile,
}: {
  total: number;
  universalCount?: number;
  profileMatchedCount?: number;
  hasProfile: boolean;
}) {
  if (total === 0) return <span className="text-xs text-teal-700">Neutral</span>;

  const pm = hasProfile && profileMatchedCount !== undefined ? profileMatchedCount : 0;
  const otherCount = Math.max(0, total - universalCount - pm);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {universalCount > 0 && (
        <span className="text-xs text-rose-700">{universalCount} universal concern{universalCount !== 1 ? "s" : ""}</span>
      )}
      {hasProfile && pm > 0 && (
        <span className="text-xs text-amber-700">{pm} your concern{pm !== 1 ? "s" : ""}</span>
      )}
      {otherCount > 0 && (
        <span className={`text-xs ${hasProfile ? "text-yellow-700" : "text-amber-700"}`}>
          {otherCount} {hasProfile ? "other concern" : "concern"}{otherCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
