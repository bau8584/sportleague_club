import { getTier, TIER_STYLES, getFullTierLabel, type TierName } from "@/lib/league-types";
import { cn } from "@/lib/utils";

export function TierBadge({ rp, thresholds, placementGamesPlayed }: { rp: number; thresholds?: Record<string, number>; placementGamesPlayed?: number }) {
  const tier: TierName = getTier(rp, thresholds, placementGamesPlayed);
  const s = TIER_STYLES[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold ring-1",
        s.bg, s.text, s.ring,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {getFullTierLabel(rp, thresholds, placementGamesPlayed)}
    </span>
  );
}
