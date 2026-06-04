import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TierBadge } from "./TierBadge";
import { GenderMark } from "./GenderMark";
import { cn } from "@/lib/utils";
import { Swords, Target, Sparkles, AlertCircle, X, Dices, Award, Building2, Flame } from "lucide-react";
import type { Student, Match } from "@/lib/league-types";
import { getTier } from "@/lib/league-types";
import { toast } from "sonner";

const LEVELS = ["A", "B", "C", "D", "초심"];

type Selection = { level: string | null; studentId: string | null };

export function MatchRecommend({
  students,
  matches,
  onSelectRecommendedMatch,
  sel,
  onSelChange,
  thresholds,
  onUpdateGender,
  isStudentView = false,
  isReadOnly = false,
}: {
  students: Student[];
  matches: Match[];
  onSelectRecommendedMatch: (playerAId: string, playerBId: string) => void;
  sel: Selection;
  onSelChange: (s: Selection) => void;
  mode?: string;
  onModeChange?: (m: any) => void;
  targetGrade?: any;
  onTargetGradeChange?: (g: any) => void;
  targetClass?: any;
  onTargetClassChange?: (c: any) => void;
  thresholds?: Record<string, number>;
  onUpdateGender?: (studentId: string, gender: "M" | "F") => void;
  isStudentView?: boolean;
  isReadOnly?: boolean;
}) {
  const player = students.find((s) => s.id === sel.studentId) ?? null;

  // 성별 정보 누락 자동 완성을 위한 상태
  const [genderModalOpen, setGenderModalOpen] = useState(false);
  const [genderTargetId, setGenderTargetId] = useState<string | null>(null);

  // A선수 선택 시 성별이 "U"이거나 없을 때 모달 팝업 트리거
  useEffect(() => {
    if (sel.studentId) {
      const selectedStudent = students.find((s) => s.id === sel.studentId);
      if (selectedStudent && (selectedStudent.gender === "U" || !selectedStudent.gender)) {
        setGenderTargetId(selectedStudent.id);
        setGenderModalOpen(true);
      }
    }
  }, [sel.studentId, students]);

  const handleUpdateGender = (gender: "M" | "F") => {
    if (genderTargetId) {
      onUpdateGender?.(genderTargetId, gender);
      setGenderModalOpen(false);
      setGenderTargetId(null);
      toast.success("선수의 성별이 정상 등록되었습니다!");
    }
  };

  const handleCancelGender = () => {
    if (genderTargetId) {
      if (sel.studentId === genderTargetId) {
        onSelChange({ ...sel, studentId: null });
      }
    }
    setGenderModalOpen(false);
    setGenderTargetId(null);
    toast.warning("성별을 입력하지 않아 선수 선택이 취소되었습니다.");
  };

  const [searchTerm, setSearchTerm] = useState("");

  const roster = useMemo(() => {
    let list = students;
    if (sel.level) {
      list = list.filter((s) => s.level === sel.level);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [students, sel.level, searchTerm]);

  // AI Matchmaking Heuristics
  const recommendations = useMemo(() => {
    if (!player) return [];

    // ① Exclude opponents from the player's last 3 matches to prevent repeated matching
    const playerMatches = matches
      .filter((m) => m.playerAId === player.id || m.playerBId === player.id || m.playerA2Id === player.id || m.playerB2Id === player.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    const excludedIds = new Set<string>();
    excludedIds.add(player.id); // Exclude self
    playerMatches.forEach((m) => {
      const isOnTeamA = m.playerAId === player.id || m.playerA2Id === player.id;
      const oppIds = isOnTeamA 
        ? [m.playerBId, m.playerB2Id].filter(Boolean) as string[] 
        : [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
      oppIds.forEach(id => excludedIds.add(id));
      
      const partnerId = isOnTeamA 
        ? (m.playerAId === player.id ? m.playerA2Id : m.playerAId)
        : (m.playerBId === player.id ? m.playerB2Id : m.playerBId);
      if (partnerId) excludedIds.add(partnerId);
    });

    // ② Primary filter by matching scope: player's level and adjacent levels
    let candidates = students.filter((s) => !excludedIds.has(s.id));
    const playerLvlIdx = LEVELS.indexOf(player.level);
    candidates = candidates.filter((c) => {
      const candLvlIdx = LEVELS.indexOf(c.level);
      return Math.abs(playerLvlIdx - candLvlIdx) <= 1; // allow same or adjacent level (1 level difference)
    });

    // ③ Weight score calculations
    const scored = candidates.map((candidate) => {
      let score = 100; // Baseline suitability score

      const rpDiff = Math.abs(candidate.rp - player.rp);

      // 1. Skill difference (±150 RP target zone)
      if (rpDiff <= 150) {
        score += (150 - rpDiff); // Proximity boost: closer means higher score, up to +150 points
      } else {
        score -= (rpDiff - 150) * 0.5; // Penalty decay for excessive gaps
      }

      // 2. Level similarity (Same level preference)
      const candLvlIdx = LEVELS.indexOf(candidate.level);
      const lvlDiff = Math.abs(playerLvlIdx - candLvlIdx);
      if (lvlDiff === 0) {
        score += 100; // Same level receives +100 bump
      } else if (lvlDiff === 1) {
        score += 30; // 1-level offset gets a mild +30 boost
      }

      // 3. Upward Challenge incentive: target competitors who are slightly better (+10 to +100 RP)
      const rpDelta = candidate.rp - player.rp;
      if (rpDelta >= 10 && rpDelta <= 100) {
        score += 50; // Earn +50 challenge points
      }

      // Dynamic Witty tip tags
      let tip = "비슷한 실력의 균형 잡힌 매칭입니다. 실력을 마음껏 발휘해 보세요!";
      let badgeLabel = "호적수";
      let badgeStyle = "bg-neon-blue/15 text-neon-blue border-neon-blue/30";

      if (rpDelta >= 10 && rpDelta <= 100) {
        tip = "나보다 조금 더 강한 상대를 꺾고 승급해 보세요! 실력 향상의 최고 지름길입니다. 🎯";
        badgeLabel = "상향 도전";
        badgeStyle = "bg-amber-500/15 text-amber-500 border-amber-500/30";
      } else if (Math.abs(rpDelta) <= 30) {
        tip = "나와 가장 실력이 비슷한 세기의 라이벌입니다! 진정한 한 끝 차이 명승부를 펼쳐보세요. ⚔️";
        badgeLabel = "세기의 라이벌";
        badgeStyle = "bg-rose-500/15 text-rose-500 border-rose-500/30";
      } else if (rpDelta < -50) {
        tip = "안정적인 경기 운영으로 1승을 확보하고, 좋은 분위기 및 연승 흐름을 이끌어갈 상대입니다. 📈";
        badgeLabel = "연승 빌더";
        badgeStyle = "bg-neon-green/15 text-neon-green border-neon-green/30";
      } else if (rpDelta > 100) {
        tip = "엄청난 실력을 가진 상급 라이벌입니다! 밑져야 본전, 도전해서 한계를 뛰어넘어 보세요! 🏆";
        badgeLabel = "자이언트 킬러";
        badgeStyle = "bg-purple-500/15 text-purple-500 border-purple-500/30";
      } else if (lvlDiff === 0 && Math.abs(rpDelta) <= 100) {
        tip = "같은 급수 최고의 명예 라이벌! 급수 자존심 대결에서 승리를 쟁취해 영광을 누리세요! 🔥";
        badgeLabel = "자존심 대결";
        badgeStyle = "bg-orange-500/15 text-orange-500 border-orange-500/30";
      }

      return {
        student: candidate,
        score: Math.max(0, Math.round(score)),
        tip,
        badgeLabel,
        badgeStyle,
      };
    });

    // ④ Sort descending and grab Top 3
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [player, students, matches]);

  const showPromptToSelect = !player;

  return (
    <div className="space-y-6">
      
      {/* 1. Selector Section */}
      <Card className="border-border/60 bg-card/60 p-5 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
          <Target className="size-48 text-neon-blue" />
        </div>
        
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-neon-blue">
            <Target className="size-5" />
            <h3 className="font-black text-lg">AI 매치메이킹 - {isStudentView ? "나의 정보" : "주요 분석 선수"}</h3>
          </div>
          {player && !isStudentView && (
            <button
              onClick={() => onSelChange({ level: sel.level, studentId: null })}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="size-3" /> 다른 선수 선택
            </button>
          )}
        </div>

        {player ? (
          <div className="rounded-xl border border-neon-blue/40 bg-neon-blue/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(0,180,216,0.05)]">
            <div>
              <div className="text-xs text-muted-foreground font-semibold">
                {player.clubName} · {player.level}급 · {player.gender === "M" ? "남성" : "여성"}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-2xl font-black">
                <GenderMark gender={player.gender} className="size-5 text-xs" />
                {player.name}
                {player.placementGamesPlayed < 5 && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-normal">
                    배치 중 ({player.placementGamesPlayed}/5)
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <TierBadge rp={player.rp} thresholds={thresholds} placementGamesPlayed={player.placementGamesPlayed} />
                <span className="font-mono text-xs text-neon-blue font-bold">
                  {player.placementGamesPlayed < 5 ? `MMR ${player.hiddenMMR}` : `${player.rp} RP`}
                </span>
                <span className="text-xs text-muted-foreground">({player.wins}승 {player.losses}패)</span>
              </div>
            </div>
            
            <div className="rounded-lg bg-background/50 border border-border/40 p-3 max-w-sm text-xs text-muted-foreground">
              <span className="font-bold text-foreground">💡 매치 추천 기준:</span> 실력 차이(±150 RP), 급수 일치/유사성, 상향 도전 기회 부여(+50 RP 가산점), 그리고 최근 3경기 이내의 상대는 완벽하게 필터링하여 제외됩니다.
            </div>
          </div>
        ) : isStudentView ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-background/30 rounded-xl border border-dashed border-border/80">
            <div className="size-8 rounded-full border-2 border-neon-blue border-t-transparent animate-spin mb-3" />
            <p className="text-xs text-muted-foreground font-bold font-sans">학생 매치 정보를 조회하는 중입니다...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">선수 이름을 선택해 주세요</div>
            
            <div className="space-y-4">
              {/* Step 0: Search bar */}
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="이름으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 px-2 border border-border/60 bg-background/40 hover:bg-background/60 focus:bg-background/80 transition-all rounded-md text-xs"
                />
              </div>

              {/* Step 1: Level Filter */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">1</span>
                  급수 필터 선택
                </div>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => onSelChange({ level: sel.level === lvl ? null : lvl, studentId: null })}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95",
                        sel.level === lvl 
                          ? "border-neon-blue bg-neon-blue/15 text-neon-blue shadow-[0_0_12px_rgba(0,180,216,0.2)]" 
                          : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {lvl}급
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Student Selection */}
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">2</span>
                  선수 선택
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 max-h-[220px] overflow-y-auto pr-1">
                  {roster.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelChange({ ...sel, studentId: s.id })}
                      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left transition-all hover:border-neon-blue/60 hover:bg-accent/40 active:scale-95"
                    >
                      <div className="text-[10px] text-muted-foreground">{s.level}급 · {s.gender === "M" ? "남" : "여"}</div>
                      <div className="flex items-center gap-1.5 text-sm font-bold mt-0.5">
                        <GenderMark gender={s.gender} />
                        {s.name}
                      </div>
                    </button>
                  ))}
                  {roster.length === 0 && (
                    <span className="text-xs text-muted-foreground py-4 col-span-full text-center">선택 조건에 맞는 등록된 선수가 없습니다.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. AI Recommendation List */}
      {player && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500 animate-pulse" />
              <h4 className="font-black text-base text-foreground">🤖 AI 분석 기반 맞춤형 라이벌 TOP 3</h4>
            </div>
            
            {/* Visual Active Filter Indicator */}
            <div className="rounded-full bg-background border border-border/60 px-3 py-1 text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5 shadow-sm">
              <span className="size-1.5 rounded-full bg-neon-blue animate-ping" />
              추천 타겟: <span className="font-bold text-foreground">클럽 수준 매칭</span>
            </div>
          </div>

          {showPromptToSelect ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/40">
              <AlertCircle className="size-10 text-muted-foreground mb-2" />
              <div className="text-sm font-bold text-foreground">도전 타겟 정보가 완전히 지정되지 않았습니다.</div>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                상단에서 대적할 선수를 선택해 주세요.
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {recommendations.length > 0 ? (
                recommendations.map((rival, index) => {
                  const s = rival.student;
                  return (
                    <Card 
                      key={s.id} 
                      className="relative overflow-hidden border-border/60 bg-card/40 p-5 backdrop-blur flex flex-col justify-between hover:border-neon-blue/50 hover:shadow-[0_0_20px_rgba(0,180,216,0.06)] hover:scale-[1.01] transition-all duration-300 group"
                    >
                      {/* Top Ranking Badge */}
                      <div className="absolute right-4 top-4 font-mono font-black text-3xl opacity-15 text-muted-foreground select-none group-hover:scale-110 transition-transform">
                        #{index + 1}
                      </div>

                      <div>
                        {/* Rival Tag Badge */}
                        <div className="flex gap-1.5 mb-3">
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm",
                            rival.badgeStyle
                          )}>
                            {rival.badgeLabel}
                          </span>
                          {rival.score >= 200 && (
                            <span className="inline-flex items-center rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/25 px-2 py-0.5 text-[10px] font-bold gap-0.5 animate-pulse">
                              <Flame className="size-3" /> 추천도 극대화
                            </span>
                          )}
                        </div>

                        {/* Opponent Profile */}
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {s.clubName || "에이스"} · {s.level}급
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xl font-extrabold">
                            <GenderMark gender={s.gender} className="size-4.5 text-[9px]" />
                            {s.name}
                          </div>
                        </div>

                        {/* Current Tier & RP */}
                        <div className="mt-3 flex items-center gap-2">
                          <TierBadge rp={s.rp} thresholds={thresholds} placementGamesPlayed={s.placementGamesPlayed} />
                          <span className="font-mono text-sm text-neon-blue font-bold">{s.placementGamesPlayed < 5 ? `MMR ${s.hiddenMMR} (배치중)` : `${s.rp} RP`}</span>
                          <span className="text-xs text-muted-foreground font-medium">({s.wins}승 {s.losses}패)</span>
                        </div>

                        {/* Suitability score bar */}
                        <div className="mt-3.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground font-black">
                            <span>매치 적합도 매칭지수</span>
                            <span className="text-neon-blue font-mono font-bold">{rival.score} pts</span>
                          </div>
                          <div className="w-full h-1.5 bg-background/60 rounded-full overflow-hidden border border-border/20">
                            <div 
                              className="h-full bg-gradient-to-r from-neon-blue via-tier-diamond to-neon-green transition-all duration-1000"
                              style={{ width: `${Math.min(100, (rival.score / 350) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* AI Witty Recommendation Tip */}
                        <div className="mt-4 rounded-lg bg-background/50 border border-border/30 p-3 text-xs leading-relaxed text-muted-foreground min-h-[56px] flex items-center group-hover:border-neon-blue/20 transition-all">
                          {rival.tip}
                        </div>
                      </div>

                      {/* Challenge Action Button */}
                      {isStudentView ? (
                        <div className="mt-5 w-full text-center py-2.5 rounded-lg border border-neon-blue/30 bg-neon-blue/5 text-neon-blue text-xs font-black tracking-wide flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,180,216,0.1)]">
                          <Swords className="size-4 animate-pulse" /> ⚔️ 추천 도전 라이벌
                        </div>
                      ) : isReadOnly ? (
                        <div className="mt-5 w-full text-center py-2.5 rounded-lg border border-muted/30 bg-muted/5 text-muted-foreground text-xs font-bold tracking-wide flex items-center justify-center gap-1.5">
                          <Swords className="size-4 opacity-50" /> ⚔️ 경기하기 (읽기 전용)
                        </div>
                      ) : (
                        <Button
                          onClick={() => onSelectRecommendedMatch(player.id, s.id)}
                          className="mt-5 w-full bg-gradient-to-r from-neon-blue/80 to-tier-diamond hover:from-neon-blue hover:to-tier-diamond text-primary-foreground font-bold tracking-wide active:scale-[0.98] transition-all gap-1.5"
                        >
                          <Swords className="size-4" /> ⚔️ 이 선수와 경기하기
                        </Button>
                      )}
                    </Card>
                  );
                })
              ) : (
                <Card className="col-span-3 flex flex-col items-center justify-center p-12 text-center border-dashed border-border/40">
                  <AlertCircle className="size-10 text-muted-foreground mb-2" />
                  <div className="text-sm font-bold text-foreground">해당 범위 내에 추천할 수 있는 대전 상대가 없습니다.</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    지정된 범위에 등록된 다른 선수가 한 명도 없거나, 최근 치른 3경기 외에 경기할 수 있는 플레이어가 중복 방지 필터에 의해 제외되었습니다.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
      {/* 성별 정보 보완 팝업창 (MatchRecommend) */}
      {genderModalOpen && genderTargetId && (() => {
        const targetStudent = students.find((s) => s.id === genderTargetId);
        if (!targetStudent) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md overflow-hidden border border-neon-blue/30 bg-background/95 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,180,216,0.2)] flex flex-col items-center animate-in zoom-in duration-300">
              {/* Grid Background Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
              
              {/* Close Button */}
              <button 
                onClick={handleCancelGender}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground hover:bg-muted/40 p-1.5 rounded-lg transition-all"
                title="취소 및 뒤로가기"
              >
                <X className="size-5" />
              </button>

              {/* Title & Info */}
              <div className="relative z-10 flex flex-col items-center text-center w-full">
                <div className="flex size-14 items-center justify-center rounded-full bg-neon-blue/15 border border-neon-blue/30 text-neon-blue shadow-[0_0_30px_rgba(0,180,216,0.3)] mb-4 animate-pulse">
                  <Sparkles className="size-6 text-neon-blue" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wider text-glow-blue text-neon-blue mb-1">
                  선수 성별 정보 보완
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                  <span className="font-bold text-foreground">[{targetStudent.name}]</span> 선수의 성별 정보(M/F)가 지정되지 않았습니다.<br />
                  매치를 정확하게 추천하기 위해 성별을 입력해주세요.
                </p>
              </div>

              {/* Gender Selection Grid */}
              <div className="relative z-10 grid grid-cols-2 gap-4 w-full">
                {/* Male Option */}
                <button
                  onClick={() => handleUpdateGender("M")}
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-neon-blue/30 bg-neon-blue/5 hover:bg-neon-blue/15 hover:border-neon-blue/60 transition-all active:scale-95 group shadow-[0_0_15px_rgba(0,180,216,0.05)]"
                >
                  <span className="text-4xl mb-2 group-hover:animate-bounce">♂</span>
                  <span className="text-sm font-black text-neon-blue tracking-wider">남성 (M)</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Male Athlete</span>
                </button>

                {/* Female Option */}
                <button
                  onClick={() => handleUpdateGender("F")}
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-loss/30 bg-loss/5 hover:bg-loss/15 hover:border-loss/60 transition-all active:scale-95 group shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                >
                  <span className="text-4xl mb-2 group-hover:animate-bounce text-loss">♀</span>
                  <span className="text-sm font-black text-loss tracking-wider">여성 (F)</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Female Athlete</span>
                </button>
              </div>

              {/* Notice Footer */}
              <p className="relative z-10 text-[10px] text-muted-foreground mt-6 text-center leading-relaxed">
                입력하신 성별 데이터는 로컬 브라우저 캐시는 물론,<br />
                교사 전용 구글 스프레드시트 클라우드 데이터베이스에 실시간 영속 동기화됩니다.
              </p>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
