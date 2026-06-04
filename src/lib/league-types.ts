export type Gender = "M" | "F"; // 남, 여

export type Student = {
  id: string;
  name: string;
  gender: Gender;
  clubName: string;
  authCode: string; // 본인 확인용 핀코드 (예: "1234")
  level: "A" | "B" | "C" | "D" | "초심"; // 동호회 실제 급수
  placementGamesPlayed: number; // 배치고사 진행 횟수 (0-5)
  hiddenMMR: number; // 내부 매칭 점수 (MMR)
  rp: number; // 리그 랭킹 포인트
  recent: ("W" | "L")[]; // 최근 5경기 결과 (가장 최근이 index 0)
  wins: number;
  losses: number;
  demotionShields?: number; // 강등 보호막 횟수
  lastMatchDate?: string;   // 마지막 경기 날짜 (ISO 8601)
  lastWinDate?: string;     // 마지막 승리 날짜 (YYYY-MM-DD)
};

export type Match = {
  id: string;
  playerAId: string;
  playerBId: string;
  playerA2Id?: string; // 복식 파트너 A2
  playerB2Id?: string; // 복식 파트너 B2
  scoreA: number;
  scoreB: number;
  date: string;
  matchType?: "single" | "double"; // 경기 방식 (단식/복식)
  discipline?: "남단" | "여단" | "남복" | "여복" | "혼복"; // 자동 판정 종목
  rpDeltaA?: number;
  rpDeltaB?: number;
  rpDeltaA2?: number;
  rpDeltaB2?: number;
  underdogBonusA?: number;
  underdogBonusB?: number;
  underdogBonusA2?: number;
  underdogBonusB2?: number;
  scoreDiffBonusA?: number;
  scoreDiffBonusB?: number;
  scoreDiffBonusA2?: number;
  scoreDiffBonusB2?: number;
  rivalBonusA?: number;
  rivalBonusB?: number;
  rivalBonusA2?: number;
  rivalBonusB2?: number;
  firstWinBonusA?: number;
  firstWinBonusB?: number;
  firstWinBonusA2?: number;
  firstWinBonusB2?: number;
  revengeBonusA?: number;
  revengeBonusB?: number;
  revengeBonusA2?: number;
  revengeBonusB2?: number;
};

export type TierName = "Unranked" | "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function getTier(rp: number, thresholds?: Record<string, number>, placementGamesPlayed?: number): TierName {
  if (placementGamesPlayed !== undefined && placementGamesPlayed < 5) {
    return "Unranked";
  }
  const t = thresholds || { Bronze: 0, Silver: 1000, Gold: 1200, Platinum: 1400, Diamond: 1600 };
  if (rp >= (t.Diamond ?? 1600)) return "Diamond";
  if (rp >= (t.Platinum ?? 1400)) return "Platinum";
  if (rp >= (t.Gold ?? 1200)) return "Gold";
  if (rp >= (t.Silver ?? 1000)) return "Silver";
  return "Bronze";
}

export function getTierSubdivision(rp: number, thresholds?: Record<string, number>, placementGamesPlayed?: number): number {
  if (placementGamesPlayed !== undefined && placementGamesPlayed < 5) {
    return 0;
  }
  const t = thresholds || { Bronze: 0, Silver: 1000, Gold: 1200, Platinum: 1400, Diamond: 1600 };
  const tier = getTier(rp, thresholds, placementGamesPlayed);
  
  if (tier === "Diamond") {
    const diff = rp - (t.Diamond ?? 1600);
    if (diff >= 300) return 1;
    if (diff >= 200) return 2;
    if (diff >= 100) return 3;
    return 4;
  }
  
  let currentCutoff = 0;
  let nextCutoff = 1000;
  
  if (tier === "Bronze") {
    currentCutoff = t.Bronze ?? 0;
    nextCutoff = t.Silver ?? 1000;
  } else if (tier === "Silver") {
    currentCutoff = t.Silver ?? 1000;
    nextCutoff = t.Gold ?? 1200;
  } else if (tier === "Gold") {
    currentCutoff = t.Gold ?? 1200;
    nextCutoff = t.Platinum ?? 1400;
  } else if (tier === "Platinum") {
    currentCutoff = t.Platinum ?? 1400;
    nextCutoff = t.Diamond ?? 1600;
  }
  
  const range = nextCutoff - currentCutoff;
  if (range <= 0) return 4;
  
  const step = range / 4;
  const relativeRp = rp - currentCutoff;
  
  if (relativeRp < step) return 4;
  if (relativeRp < 2 * step) return 3;
  if (relativeRp < 3 * step) return 2;
  return 1;
}

export function getFullTierLabel(rp: number, thresholds?: Record<string, number>, placementGamesPlayed?: number): string {
  const tier = getTier(rp, thresholds, placementGamesPlayed);
  if (tier === "Unranked") return "Unranked (배치 중)";
  const sub = getTierSubdivision(rp, thresholds, placementGamesPlayed);
  const style = TIER_STYLES[tier];
  return `${style.label} ${sub}`;
}

export const TIER_ORDER: TierName[] = ["Diamond", "Platinum", "Gold", "Silver", "Bronze", "Unranked"];

export const TIER_STYLES: Record<TierName, { bg: string; text: string; ring: string; label: string }> = {
  Unranked: { bg: "bg-muted/15",         text: "text-muted-foreground", ring: "ring-muted/40",         label: "Unranked" },
  Bronze:   { bg: "bg-tier-bronze/15",   text: "text-tier-bronze",   ring: "ring-tier-bronze/40",   label: "브론즈" },
  Silver:   { bg: "bg-tier-silver/15",   text: "text-tier-silver",   ring: "ring-tier-silver/40",   label: "실버" },
  Gold:     { bg: "bg-tier-gold/15",     text: "text-tier-gold",     ring: "ring-tier-gold/40",     label: "골드" },
  Platinum: { bg: "bg-tier-platinum/15", text: "text-tier-platinum", ring: "ring-tier-platinum/40", label: "플래티넘" },
  Diamond:  { bg: "bg-tier-diamond/15",  text: "text-tier-diamond",  ring: "ring-tier-diamond/40",  label: "다이아몬드" },
};

export function studentKey(s: { clubName: string; name: string }) {
  return `${s.clubName}-${s.name}`;
}

export function determineDiscipline(
  playerA: { gender: "M" | "F" },
  playerB: { gender: "M" | "F" },
  playerA2?: { gender: "M" | "F" } | null,
  playerB2?: { gender: "M" | "F" } | null
): "남단" | "여단" | "남복" | "여복" | "혼복" {
  const isDouble = !!(playerA2 && playerB2);
  if (!isDouble) {
    if (playerA.gender === "M" && playerB.gender === "M") return "남단";
    if (playerA.gender === "F" && playerB.gender === "F") return "여단";
    return playerA.gender === "M" ? "남단" : "여단"; // fallback
  } else {
    const genders = [
      playerA.gender,
      playerA2!.gender,
      playerB.gender,
      playerB2!.gender
    ];
    const maleCount = genders.filter((g) => g === "M").length;
    const femaleCount = genders.filter((g) => g === "F").length;
    
    if (maleCount === 4) return "남복";
    if (femaleCount === 4) return "여복";
    return "혼복";
  }
}
