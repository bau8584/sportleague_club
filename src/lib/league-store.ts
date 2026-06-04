import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { Student, Match, Gender, TierName } from "./league-types";
import { determineDiscipline } from "./league-types";
import { studentKey, getTier, getTierSubdivision, getFullTierLabel, TIER_ORDER } from "./league-types";
import { toast } from "sonner";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  tier: "Common" | "Rare" | "Epic" | "Legendary";
  currentValue: number;
  targetValue: number;
  isUnlocked: boolean;
};

export type ActiveBonuses = {
  firstWin: boolean;
  revenge: boolean;
  underdog: boolean;
  scoreDiff: boolean;
  rival: boolean;
};

const TIER_RANKING: Record<TierName, number> = {
  Unranked: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5
};

const STUDENTS_KEY = "bdm.students.v2";
const MATCHES_KEY = "bdm.matches.v1";
const TITLE_KEY = "bdm.title.v1";
const LOCKED_KEY = "bdm.locked.v1";
const SETTINGS_KEY = "bdm.settings.v1";
const BONUSES_KEY = "bdm.bonuses.v1";

// 세션 영속 저장을 위한 로컬스토리지 키
const SESSION_KEY = "bdm.session.v1";
const OP_MODE_KEY = "bdm.opMode.v1";

// 마스터 DB 구글 Apps Script Web App API 주소
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzcu1d1T8pHvzwvcPn2qPFIg8YtCQxsspvfQ6Koa-ie6wWE9UhEvtPzurK92SVeJEMvyQ/exec";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const normalizeSchool = (name: string) => name.replace(/(초등학교|중학교|고등학교|초등|중등|고등|학교|초|클럽|동호회|회)$/, "").trim().toLowerCase();

// 교사/학교 매핑 목록 로컬 캐싱 기능 (구글 시트 API 속도 개선)
async function getTeachersList(forceRefresh = false): Promise<any[]> {
  if (typeof window === "undefined") return [];
  const TEACHERS_CACHE_KEY = "bdm.teachers_list.cache";
  const TEACHERS_CACHE_TIME_KEY = "bdm.teachers_list.cache_time";
  const CACHE_DURATION = 60 * 60 * 1000; // 1시간 캐싱

  if (!forceRefresh) {
    try {
      const cachedListStr = localStorage.getItem(TEACHERS_CACHE_KEY);
      const cachedTimeStr = localStorage.getItem(TEACHERS_CACHE_TIME_KEY);
      if (cachedListStr && cachedTimeStr) {
        const cachedTime = parseInt(cachedTimeStr, 10);
        if (Date.now() - cachedTime < CACHE_DURATION) {
          return JSON.parse(cachedListStr);
        }
      }
    } catch (e) {
      console.warn("Error reading teachers list cache:", e);
    }
  }

  try {
    const teachersRes = await fetch(`${MASTER_API_URL}?action=GET_TEACHERS`);
    const teachersData = await teachersRes.json();
    if (teachersData.status === "success" && teachersData.teachers) {
      localStorage.setItem(TEACHERS_CACHE_KEY, JSON.stringify(teachersData.teachers));
      localStorage.setItem(TEACHERS_CACHE_TIME_KEY, Date.now().toString());
      return teachersData.teachers;
    }
  } catch (error) {
    console.error("Failed to fetch matching school list:", error);
  }
  return [];
}

const SEED_STUDENTS: Student[] = [
  { id: uid(), name: "강서준", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "1111", level: "A", placementGamesPlayed: 5, hiddenMMR: 1550, rp: 1550, recent: ["W","W","L","W","W"], wins: 8, losses: 3 },
  { id: uid(), name: "김민재", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "2222", level: "B", placementGamesPlayed: 5, hiddenMMR: 1250, rp: 1250, recent: ["L","W","W","L","W"], wins: 6, losses: 5 },
  { id: uid(), name: "이지우", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "3333", level: "A", placementGamesPlayed: 5, hiddenMMR: 1650, rp: 1650, recent: ["W","W","W","W","L"], wins: 12, losses: 2 },
  { id: uid(), name: "박지성", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "4444", level: "A", placementGamesPlayed: 5, hiddenMMR: 1480, rp: 1480, recent: ["W","L","W","W","W"], wins: 9, losses: 3 },
  { id: uid(), name: "최서아", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "5555", level: "C", placementGamesPlayed: 5, hiddenMMR: 980,  rp: 980,  recent: ["L","L","W","L","W"], wins: 3, losses: 6 },
  { id: uid(), name: "정인우", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "6666", level: "D", placementGamesPlayed: 5, hiddenMMR: 1050, rp: 1050, recent: ["W","L","L","W","L"], wins: 4, losses: 5 },
  { id: uid(), name: "강하윤", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "7777", level: "B", placementGamesPlayed: 5, hiddenMMR: 1510, rp: 1510, recent: ["W","W","L","W","W"], wins: 10, losses: 4 },
  { id: uid(), name: "윤도현", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "8888", level: "B", placementGamesPlayed: 5, hiddenMMR: 1210, rp: 1210, recent: ["W","L","W","L","W"], wins: 7, losses: 5 },
  { id: uid(), name: "이지민", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "9999", level: "C", placementGamesPlayed: 5, hiddenMMR: 1110, rp: 1110, recent: ["L","W","L","W","L"], wins: 5, losses: 7 },
  { id: uid(), name: "한주원", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "1010", level: "B", placementGamesPlayed: 5, hiddenMMR: 1390, rp: 1390, recent: ["W","W","W","L","L"], wins: 8, losses: 4 },
  { id: uid(), name: "김수아", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "2020", level: "A", placementGamesPlayed: 5, hiddenMMR: 1490, rp: 1490, recent: ["W","L","W","W","W"], wins: 10, losses: 2 },
  { id: uid(), name: "최예준", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "3030", level: "C", placementGamesPlayed: 5, hiddenMMR: 1020, rp: 1020, recent: ["L","W","W","L","L"], wins: 4, losses: 6 },
  { id: uid(), name: "박서윤", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "4040", level: "D", placementGamesPlayed: 5, hiddenMMR: 950,  rp: 950,  recent: ["L","L","L","W","W"], wins: 2, losses: 8 },
  { id: uid(), name: "송민우", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "5050", level: "C", placementGamesPlayed: 5, hiddenMMR: 1040, rp: 1040, recent: ["W","L","W","L","W"], wins: 5, losses: 5 },
  { id: uid(), name: "윤아린", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "6060", level: "초심", placementGamesPlayed: 5, hiddenMMR: 920,  rp: 920,  recent: ["L","L","W","L","L"], wins: 2, losses: 8 },
  { id: uid(), name: "정민서", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "7070", level: "B", placementGamesPlayed: 5, hiddenMMR: 1250, rp: 1250, recent: ["W","W","L","W","L"], wins: 7, losses: 5 },
  { id: uid(), name: "조현우", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "8080", level: "B", placementGamesPlayed: 5, hiddenMMR: 1300, rp: 1300, recent: ["W","W","W","L","W"], wins: 9, losses: 3 },
  { id: uid(), name: "신지아", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "9090", level: "A", placementGamesPlayed: 5, hiddenMMR: 1580, rp: 1580, recent: ["W","W","W","W","W"], wins: 13, losses: 1 },
  { id: uid(), name: "유재희", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "0101", level: "B", placementGamesPlayed: 5, hiddenMMR: 1410, rp: 1410, recent: ["L","W","W","W","L"], wins: 8, losses: 4 },
  { id: uid(), name: "김하은", gender: "F", clubName: "에이스 배드민턴 클럽", authCode: "0202", level: "C", placementGamesPlayed: 5, hiddenMMR: 1070, rp: 1070, recent: ["W","W","L","L","W"], wins: 6, losses: 4 },
  { id: uid(), name: "임지우", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "0303", level: "C", placementGamesPlayed: 3, hiddenMMR: 1150, rp: 1000, recent: ["W","L","W"], wins: 2, losses: 1 },
  { id: uid(), name: "서준우", gender: "M", clubName: "에이스 배드민턴 클럽", authCode: "0404", level: "초심", placementGamesPlayed: 2, hiddenMMR: 1010, rp: 1000, recent: ["L","W"], wins: 1, losses: 1 }
];

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

type UserSession = {
  loginId: string;
  role: "MASTER" | "TEACHER" | "STUDENT";
  schoolName: string;
  userName: string;
  scriptUrl: string;
  studentId?: string;
  leagueName?: string;
  settingsBonus?: string | Record<string, boolean>;
} | null;

export function useLeagueStore() {
  const [hydrated, setHydrated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [title, setTitle] = useState<string>("2026 초등 리그전");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [seasonList, setSeasonList] = useState<string[]>([]);
  const [currentViewSeason, setCurrentViewSeason] = useState<string>("현재 시즌");
  const currentViewSeasonRef = useRef(currentViewSeason);
  useEffect(() => {
    currentViewSeasonRef.current = currentViewSeason;
  }, [currentViewSeason]);

  // 3대 역할 로그인 세션 상태
  const [session, setSession] = useState<UserSession>(null);
  const [opMode, setOpMode] = useState<"school" | "club">("school");

  // 이중 보안 모달을 위한 선생님 비밀번호(접근 코드) 전역 관리
  const [teacherAccessCode, setTeacherAccessCode] = useState<string>(() => {
    if (typeof window === "undefined") return "1234";
    return localStorage.getItem("bdm.teacherAccessCode.v1") || "1234";
  });

  // 리그전 커스텀 설정 상태 추가
  const [tierThresholdsState, setTierThresholds] = useState<Record<string, number>>({
    Bronze: 0,
    Silver: 1000,
    Gold: 1200,
    Platinum: 1400,
    Diamond: 1600
  });

  const computedThresholds = useMemo(() => {
    const placementFinished = students.filter(s => (s.placementGamesPlayed ?? 0) >= 5);
    const totalFinished = placementFinished.length;
    
    let diamondCutoff = tierThresholdsState.Diamond ?? 1600;
    let platinumCutoff = tierThresholdsState.Platinum ?? 1400;
    
    if (totalFinished > 0) {
      const sortedRps = placementFinished.map(s => s.rp).sort((a, b) => b - a);
      const dIndex = Math.max(0, Math.floor(totalFinished * 0.05));
      diamondCutoff = sortedRps[dIndex] ?? tierThresholdsState.Diamond ?? 1600;
      
      const pIndex = Math.max(0, Math.floor(totalFinished * 0.20));
      platinumCutoff = sortedRps[pIndex] ?? tierThresholdsState.Platinum ?? 1400;
      
      const goldThreshold = tierThresholdsState.Gold ?? 1200;
      if (platinumCutoff <= goldThreshold) {
        platinumCutoff = goldThreshold + 1;
      }
      if (diamondCutoff <= platinumCutoff) {
        diamondCutoff = platinumCutoff + 1;
      }
    }
    
    return {
      Unranked: 0,
      Bronze: tierThresholdsState.Bronze ?? 0,
      Silver: tierThresholdsState.Silver ?? 1000,
      Gold: tierThresholdsState.Gold ?? 1200,
      Platinum: platinumCutoff,
      Diamond: diamondCutoff
    };
  }, [students, tierThresholdsState]);

  const tierThresholds = computedThresholds;
  const [rpVariables, setRpVariables] = useState<{ winDelta: number; loseDelta: number }>({
    winDelta: 25,
    loseDelta: 20
  });

  const [activeBonuses, setActiveBonuses] = useState<ActiveBonuses>({
    firstWin: true,
    revenge: true,
    underdog: true,
    scoreDiff: true,
    rival: true
  });

  const [promotionQueue, setPromotionQueue] = useState<{ isPromoted: boolean; newTier: string; studentName?: string }[]>([]);
  const promotionEvent = promotionQueue[0] || null;
  const setPromotionEvent = useCallback((event: { isPromoted: boolean; newTier: string; studentName?: string } | null) => {
    if (event === null) {
      setPromotionQueue((prev) => prev.slice(1));
    } else {
      setPromotionQueue((prev) => [...prev, event]);
    }
  }, []);

  // 1. 단일 경기 기록 서버 원장 동기화 (RECORD_LEDGER)
  const recordMatchToGoogleSheets = useCallback(async (
    match: Match,
    rpChange: Record<string, number>,
    previousStudents?: Student[],
    previousMatches?: Match[]
  ) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return false;
    }
    // 세션에 개인 scriptUrl이 없으면 동기화 생략 (로컬 저장만 적용 - 게스트 모드 포함)
    if (!session || !session.scriptUrl) return;
    setIsSyncing(true);

    try {
      const res = await fetch(session.scriptUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "RECORD_LEDGER",
          match,
          rpChange
        })
      });

      if (res.status === 429 || res.status === 500 || res.status === 503) {
        throw new Error(`STATUS_${res.status}`);
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {}

      if (data && data.status === "error") {
        throw new Error(data.message || "SYNC_ERROR");
      }

      console.log("Successfully recorded match to Google Sheets ledger!");
    } catch (error) {
      console.error("Recording match to Google Sheets failed:", error);

      // 서버 혼잡 또는 네트워크 오류 발생 시 즉시 알림 및 롤백
      toast.error("서버 혼잡 또는 네트워크 오류로 기록이 취소되었습니다. 다시 시도해주세요.", {
        id: "sync-lock-error",
        duration: 5000
      });

      // 동기화 실패 시 입력을 취소하기 위해 이전 상태로 즉시 롤백
      if (previousStudents) {
        setStudents(previousStudents);
        saveJSON(STUDENTS_KEY, previousStudents);
      }
      if (previousMatches) {
        setMatches(previousMatches);
        saveJSON(MATCHES_KEY, previousMatches);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

    // 2. 로그인 수행 함수 (간편 로그인 시스템 도입 - 이메일/PW 제거, 동명이인 방지 추가)
  const loginUser = useCallback(
    async (
      schoolName: string, 
      accessCodeOrName: string, 
      role: "MASTER" | "TEACHER" | "STUDENT",
      authCode?: string
    ) => {
      const cleanedSchool = schoolName.trim();
      const cleanedCode = accessCodeOrName.trim();

      // A. 게스트 모드 예외 처리
      if (cleanedSchool.toLowerCase() === "guest" || cleanedSchool === "꿈나무 초등학교") {
        const guestSession = {
          loginId: "guest",
          role: "TEACHER" as const,
          schoolName: "꿈나무 스포츠 클럽 (체험용)",
          userName: "게스트 관리자",
          scriptUrl: ""
        };
        setSession(guestSession);
        saveJSON(SESSION_KEY, guestSession);
        
        const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
        if (!localStudents || localStudents.length < 10) {
          setStudents(SEED_STUDENTS);
          saveJSON(STUDENTS_KEY, SEED_STUDENTS);
        } else {
          setStudents(localStudents);
        }
        return { success: true };
      }

      setIsSyncing(true);
      try {
        if (role === "STUDENT") {
          // B-1. 학생/선수 자율 로그인 처리
          // 1. LocalStorage 또는 상태에서 구글 시트 URL을 먼저 가져옵니다.
          let activeScriptUrl = localStorage.getItem("bdm.scriptUrl.v1") || "";
          const activeClubName = localStorage.getItem("bdm.clubName.v1") || "";

          // 만약 schoolName이 입력되었다면, 구글 마스터 API에서 해당 동호회의 scriptUrl을 찾아냅니다.
          if (cleanedSchool && normalizeSchool(activeClubName) !== normalizeSchool(cleanedSchool)) {
            try {
              const url = await getScriptUrlForClub(cleanedSchool);
              if (url) {
                activeScriptUrl = url;
              }
            } catch (e) {
              console.warn("Failed lookup for club scriptUrl:", e);
            }
          }

          if (!activeScriptUrl) {
            return { success: false, message: "설정된 구글 시트 URL이 없습니다. 관리자 패널에서 설정 정보를 먼저 등록하거나 설정 링크로 접속해 주세요." };
          }

          // 2. 구글 시트 URL로 GET 요청을 보냅니다.
          const res = await fetch(activeScriptUrl);
          const remoteData = await res.json();

          if (remoteData.status === "success" && remoteData.students) {
            const mappedStudents = remoteData.students.map((s: any) => ({
              ...s,
              clubName: s.clubName || cleanedSchool || activeClubName || "동호회",
              authCode: s.authCode || "1234",
              gender: s.gender === "F" ? "F" : "M",
              level: s.level || "초심",
              placementGamesPlayed: s.placementGamesPlayed ? Number(s.placementGamesPlayed) : 0,
              hiddenMMR: s.hiddenMMR ? Number(s.hiddenMMR) : 1000,
              rp: s.rp ? Number(s.rp) : 1000,
            }));

            setStudents(mappedStudents);
            saveJSON(STUDENTS_KEY, mappedStudents);

            if (remoteData.matches) {
              setMatches(remoteData.matches);
              saveJSON(MATCHES_KEY, remoteData.matches);
            }
            if (remoteData.seasonList) {
              setSeasonList(remoteData.seasonList);
            }

            // 3. 일치하는 회원 정보가 있는지 검증
            const matchStudent = mappedStudents.find((s: any) => 
              s.name === cleanedCode && s.authCode === (authCode || "").trim()
            );

            if (matchStudent) {
              const studentSession = {
                loginId: "student_" + cleanedCode + "_" + matchStudent.id,
                role: "STUDENT" as const,
                schoolName: cleanedSchool || activeClubName || matchStudent.clubName || "동호회",
                userName: cleanedCode,
                studentId: matchStudent.id,
                scriptUrl: activeScriptUrl
              };
              setSession(studentSession);
              saveJSON(SESSION_KEY, studentSession);
              
              // LocalStorage에 동호회 이름 및 URL 업데이트
              localStorage.setItem("bdm.clubName.v1", cleanedSchool || activeClubName || matchStudent.clubName);
              localStorage.setItem("bdm.scriptUrl.v1", activeScriptUrl);

              return { success: true };
            } else {
              return { success: false, message: `동호회 명단에 '${cleanedCode}' 선수가 없거나 핀코드가 일치하지 않습니다.` };
            }
          } else {
            return { success: false, message: "구글 시트 연동 데이터를 가져오는 데 실패했습니다." };
          }
        }

        if (role === "TEACHER") {
          // B-2. 운영진 로그인 처리 (마스터 비밀번호 0000 검증)
          if (cleanedCode !== "0000") {
            return { success: false, message: "관리자 인증코드가 일치하지 않습니다. ('0000' 입력 필요)" };
          }

          // 1. Get the scriptUrl (either from local storage if clubName matches, or from master list)
          let schoolScriptUrl = localStorage.getItem("bdm.scriptUrl.v1") || "";
          const cachedClub = localStorage.getItem("bdm.clubName.v1") || "";
          
          if (normalizeSchool(cachedClub) !== normalizeSchool(cleanedSchool) || !schoolScriptUrl) {
            try {
              const list = await getTeachersList();
              const matched = list.find(
                (t: any) => 
                  normalizeSchool(t.schoolName) === normalizeSchool(cleanedSchool) || 
                  normalizeSchool(t.loginId) === normalizeSchool(cleanedSchool)
              );
              if (matched && matched.scriptUrl) {
                schoolScriptUrl = matched.scriptUrl;
              }
            } catch (e) {
              console.warn("Failed lookup for teacher login scriptUrl:", e);
            }
          }

          const teacherSession = {
            loginId: "teacher_" + cleanedSchool,
            role: "TEACHER" as const,
            schoolName: cleanedSchool,
            userName: "운영진",
            scriptUrl: schoolScriptUrl
          };
          
          setSession(teacherSession);
          saveJSON(SESSION_KEY, teacherSession);
          setTeacherAccessCode("0000");
          localStorage.setItem("bdm.teacherAccessCode.v1", "0000");
          
          // Save the configured club and script url to local storage for persistence
          localStorage.setItem("bdm.clubName.v1", cleanedSchool);
          if (schoolScriptUrl) {
            localStorage.setItem("bdm.scriptUrl.v1", schoolScriptUrl);
          }

          // Fetch students and matches if scriptUrl exists
          if (schoolScriptUrl) {
            try {
              const remoteRes = await fetch(schoolScriptUrl);
              const remoteData = await remoteRes.json();
              if (remoteData.status === "success") {
                const fetchedStudents = (remoteData.students || []).map((s: any) => ({
                  ...s,
                  clubName: s.clubName || cleanedSchool,
                  authCode: s.authCode || "1234",
                  gender: s.gender === "F" ? "F" : "M",
                  level: s.level || "초심",
                  placementGamesPlayed: s.placementGamesPlayed ? Number(s.placementGamesPlayed) : 0,
                  hiddenMMR: s.hiddenMMR ? Number(s.hiddenMMR) : 1000,
                  rp: s.rp ? Number(s.rp) : 1000
                }));
                setStudents(fetchedStudents);
                saveJSON(STUDENTS_KEY, fetchedStudents);
                
                const fetchedMatches = remoteData.matches || [];
                setMatches(fetchedMatches);
                saveJSON(MATCHES_KEY, fetchedMatches);
              }
            } catch (err) {
              console.warn("Failed fetching students on bypass login:", err);
            }
          }
          return { success: true };
        }

        if (role === "MASTER") {
          // B-3. 최고 마스터 관리자 로그인 처리 (마스터 비밀번호로 검증)
          const response = await fetch(MASTER_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({
              action: "LOGIN",
              loginId: cleanedSchool,
              password: cleanedCode,
              role: "MASTER"
            })
          });
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {}

          if (data && data.status === "success" && data.user) {
            setSession(data.user);
            saveJSON(SESSION_KEY, data.user);
            return { success: true };
          }
          return { success: false, message: (data && data.message) || "마스터 인증 정보가 올바르지 않습니다." };
        }

        return { success: false, message: "올바르지 않은 접근 역할입니다." };
      } catch (error: any) {
        console.error("Login process failed:", error);
        return { success: false, message: error.message || "서버 통신 오류가 발생했습니다." };
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  // 3. 신규 회원가입 수행 함수 (학생/회원 자율 가입)
  const registerUser = useCallback(async (details: {
    name: string;
    gender: "M" | "F";
    authCode: string; // 핀코드
    level: "A" | "B" | "C" | "D" | "초심";
    joinCode: string; // 클럽 가입 인증 코드
    clubName: string;
  }) => {
    setIsSyncing(true);
    try {
      // 1. Get scriptUrl for the club
      const schoolScriptUrl = await getScriptUrlForClub(details.clubName);
      if (!schoolScriptUrl) {
        return { success: false, message: `'${details.clubName}' 클럽의 구글 시트 연동 URL이 설정되어 있지 않습니다. 관리자 패널에서 연동 정보를 먼저 설정하세요.` };
      }

      // 2. POST to the scriptUrl with action "REGISTER_STUDENT"
      const response = await fetch(schoolScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "REGISTER_STUDENT",
          name: details.name,
          gender: details.gender,
          authCode: details.authCode,
          level: details.level,
          joinCode: details.joinCode,
          clubName: details.clubName
        })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {}

      if (data && data.status === "error") {
        return { success: false, message: data.message || "가입 처리에 실패했습니다. 가입 인증코드를 확인해 주세요." };
      }

      if (data && data.status === "success") {
        return { success: true, message: data.message || "회원가입이 완료되었습니다!" };
      }
      return { success: false, message: "구글 시트 연동 서버로부터 올바르지 않은 응답이 수신되었습니다." };
    } catch (error) {
      console.error("Student registration failed:", error);
      return { success: false, message: "구글 시트 API 서버에 연결할 수 없습니다. 인터넷 상태 또는 설정을 확인하세요." };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 클럽명으로 구글 시트 URL 조회 헬퍼
  const getScriptUrlForClub = useCallback(async (targetClubName: string): Promise<string> => {
    const cleanedTarget = targetClubName.trim();
    if (!cleanedTarget) return "";
    
    // 1. 로컬 캐시 조회
    const cachedClub = localStorage.getItem("bdm.clubName.v1") || "";
    const cachedUrl = localStorage.getItem("bdm.scriptUrl.v1") || "";
    
    if (normalizeSchool(cachedClub) === normalizeSchool(cleanedTarget) && cachedUrl) {
      return cachedUrl;
    }
    
    // 2. 마스터 API 조회
    try {
      const list = await getTeachersList();
      if (list && list.length > 0) {
        const matched = list.find(
          (t: any) => 
            normalizeSchool(t.schoolName) === normalizeSchool(cleanedTarget) || 
            normalizeSchool(t.loginId) === normalizeSchool(cleanedTarget)
        );
        if (matched && matched.scriptUrl) {
          return matched.scriptUrl;
        }
      }
    } catch (e) {
      console.warn("Failed lookup for club scriptUrl:", e);
    }
    return "";
  }, []);

  // 구글 시트 URL 및 클럽명 세션 업데이트 설정 함수
  const updateSessionSettings = useCallback(async (newSchoolName: string, newScriptUrl: string) => {
    localStorage.setItem("bdm.scriptUrl.v1", newScriptUrl);
    localStorage.setItem("bdm.clubName.v1", newSchoolName);

    const updatedSession = session 
      ? {
          ...session,
          schoolName: newSchoolName,
          scriptUrl: newScriptUrl
        }
      : {
          loginId: "teacher_" + newSchoolName,
          role: "TEACHER" as const,
          schoolName: newSchoolName,
          userName: "운영진",
          scriptUrl: newScriptUrl
        };

    setSession(updatedSession);
    saveJSON(SESSION_KEY, updatedSession);

    // 새 구글 시트에서 명단/경기 결과 동기화 시도
    if (newScriptUrl) {
      setIsSyncing(true);
      try {
        const res = await fetch(newScriptUrl);
        const remoteData = await res.json();
        if (remoteData.status === "success") {
          if (remoteData.students) {
            const mappedStudents = remoteData.students.map((s: any) => ({
              ...s,
              clubName: s.clubName || newSchoolName,
              authCode: s.authCode || "1234",
              gender: s.gender === "F" ? "F" : "M",
              level: s.level || "초심",
              placementGamesPlayed: s.placementGamesPlayed ? Number(s.placementGamesPlayed) : 0,
              hiddenMMR: s.hiddenMMR ? Number(s.hiddenMMR) : 1000,
              rp: s.rp ? Number(s.rp) : 1000
            }));
            setStudents(mappedStudents);
            saveJSON(STUDENTS_KEY, mappedStudents);
          }
          if (remoteData.matches) {
            setMatches(remoteData.matches);
            saveJSON(MATCHES_KEY, remoteData.matches);
          }
          if (remoteData.leagueName) {
            setTitle(remoteData.leagueName);
            saveJSON(TITLE_KEY, remoteData.leagueName);
          }
          if (remoteData.seasonList) {
            setSeasonList(remoteData.seasonList);
          }
          toast.success("구글 시트 연동 및 데이터 동기화 완료!");
          return { success: true };
        } else {
          return { success: false, message: remoteData.message || "구글 시트 연동 실패: 잘못된 형식입니다." };
        }
      } catch (err: any) {
        console.warn("Failed syncing on updateSessionSettings:", err);
        return { success: false, message: "구글 시트 데이터 로드에 실패했습니다. 오프라인 모드로 연동 정보를 저장합니다." };
      } finally {
        setIsSyncing(false);
      }
    } else {
      toast.success("동호회 설정 정보가 로컬에 저장되었습니다.");
      return { success: true };
    }
  }, [session]);

// 이메일 기반 비밀번호 자가 복구 기능 (GAS 연동)
  const recoverPassword = useCallback(async (schoolName: string, email: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "RECOVER_PASSWORD",
          schoolName: schoolName.trim(),
          email: email.trim()
        })
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {}

      if (data && data.status === "error" && data.message && data.message.includes("혼잡")) {
        toast.error("다른 사용자가 요청 중입니다. 3초 후 다시 시도해주세요.", { id: "recover-lock-error" });
        return { success: false, message: "다른 사용자가 요청 중입니다. 3초 후 다시 시도해주세요." };
      }

      if (data && data.status === "success") {
        return { success: true, message: data.message || "비밀번호가 이메일로 자동 발송되었습니다." };
      } else {
        return { success: false, message: (data && data.message) || "해당 정보와 일치하는 계정을 찾을 수 없습니다." };
      }
    } catch (error) {
      console.error("Password recovery request failed:", error);
      return { success: false, message: "마스터 서버 통신 오류가 발생했습니다." };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 4. 로그아웃 수행 함수
  const logoutUser = useCallback(() => {
    setSession(null);
    saveJSON(SESSION_KEY, null);
    // 상태 초기화
    setStudents(SEED_STUDENTS);
    setMatches([]);
    saveJSON(STUDENTS_KEY, SEED_STUDENTS);
    saveJSON(MATCHES_KEY, []);
    setTeacherAccessCode("1234");
    localStorage.removeItem("bdm.teacherAccessCode.v1");
  }, []);

  // 5. 초기 기동 시 세션 및 로컬 데이터 Hydration
  useEffect(() => {
    const initData = async () => {
      // 0. URL 쿼리 파라미터 로딩 및 저장 (학생들 개별 폰 접속 편의성 지원)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlParam = params.get("scriptUrl") || params.get("url");
        const clubParam = params.get("clubName") || params.get("club");
        if (urlParam) {
          localStorage.setItem("bdm.scriptUrl.v1", urlParam);
        }
        if (clubParam) {
          localStorage.setItem("bdm.clubName.v1", clubParam);
        }
      }

      // A. 교사 세션 로딩
      const cachedSession = loadJSON<UserSession>(SESSION_KEY, null);
      setSession(cachedSession);

      // B. 로컬 스토리지 리그 전적 로드
      const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
      const localMatches = loadJSON<Match[]>(MATCHES_KEY, []);
      const localTitle = loadJSON<string>(TITLE_KEY, "2026 초등 리그전");
      const localLocked = loadJSON<boolean>(LOCKED_KEY, false);

      const isGuest = cachedSession?.loginId === "guest" || cachedSession?.schoolName?.includes("꿈나무");
      let activeStudents = localStudents !== null ? localStudents : SEED_STUDENTS;
      
      // If it is a real school session, but the local data is currently the SEED_STUDENTS (from a previous logout or guest state),
      // we must reset it to an empty list to avoid displaying the demo students in the new school.
      if (cachedSession && !isGuest) {
        const isLocalSeed = activeStudents.length > 0 && activeStudents[0].name === SEED_STUDENTS[0].name;
        if (isLocalSeed) {
          activeStudents = [];
          saveJSON(STUDENTS_KEY, []);
        }
      }

      setStudents(activeStudents);
      setMatches(localMatches);
      setTitle(localTitle);
      setIsLocked(localLocked);

      // 설정 로드
      const localSettings = loadJSON<{ thresholds: Record<TierName, number>; rpVars: { winDelta: number; loseDelta: number }; opMode?: "school" | "club" } | null>(SETTINGS_KEY, null);
      if (localSettings) {
        if (localSettings.thresholds) setTierThresholds(localSettings.thresholds);
        if (localSettings.rpVars) setRpVariables(localSettings.rpVars);
        if (localSettings.opMode) setOpMode(localSettings.opMode);
      }
      const cachedOpMode = localStorage.getItem(OP_MODE_KEY) as "school" | "club" | null;
      if (cachedOpMode) setOpMode(cachedOpMode);

      // 보너스 활성화 로드
      const localBonuses = loadJSON<ActiveBonuses | null>(BONUSES_KEY, null);
      if (localBonuses) {
        setActiveBonuses(localBonuses);
      }

      // 세션 기반 타이틀 및 설정 로드
      if (cachedSession) {
        if (cachedSession.leagueName) {
          setTitle(cachedSession.leagueName);
        }
        if (cachedSession.settingsBonus) {
          try {
            const parsed = typeof cachedSession.settingsBonus === "string" 
              ? JSON.parse(cachedSession.settingsBonus) 
              : cachedSession.settingsBonus;
            setActiveBonuses(parsed);
            if (parsed && parsed.opMode) {
              setOpMode(parsed.opMode);
              localStorage.setItem(OP_MODE_KEY, parsed.opMode);
            }
          } catch (e) {
            console.error("Failed to parse cached session bonuses:", e);
          }
        }
      }

      setHydrated(true);

      // C. 세션이 살아있는 경우 구글 시트 검증 및 연동 데이터 강제 최신화 (Source of Truth)
      if (cachedSession) {
        let currentSession = cachedSession;

        // 1. 교사/마스터 권한 세션의 경우 구글 시트 마스터 DB와 인증 정보(비밀번호) 재동기화
        const cachedCode = localStorage.getItem("bdm.teacherAccessCode.v1") || "";
        if ((cachedSession.role === "TEACHER" || cachedSession.role === "MASTER") && cachedCode) {
          try {
            let loginIdToVerify = cachedSession.loginId;

            if (!loginIdToVerify && cachedSession.role === "TEACHER") {
              try {
                const teachers = await getTeachersList();
                const targetSchool = normalizeSchool(cachedSession.schoolName);
                const matchedTeacher = teachers.find(
                  (t: any) => 
                    normalizeSchool(t.schoolName) === targetSchool || 
                    normalizeSchool(t.loginId) === targetSchool
                );
                if (matchedTeacher) {
                  loginIdToVerify = matchedTeacher.loginId;
                } else {
                  loginIdToVerify = cachedSession.schoolName;
                }
              } catch (e) {
                loginIdToVerify = cachedSession.schoolName;
              }
            }

            const verifyRes = await fetch(MASTER_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify({
                action: "LOGIN",
                loginId: loginIdToVerify,
                password: cachedCode,
                role: cachedSession.role
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.status !== "success" || !verifyData.user) {
              // 마스터 DB에서 비밀번호 불일치로 판정 -> 로컬 캐시 꼬임 방지를 위해 강제 로그아웃
              console.warn("Cached session validation failed (password changed in Google Sheets). Force logging out.");
              setSession(null);
              saveJSON(SESSION_KEY, null);
              setTeacherAccessCode("1234");
              localStorage.removeItem("bdm.teacherAccessCode.v1");
              return;
            } else {
              // 최신 세션 정보 동기화
              currentSession = verifyData.user;
              setSession(verifyData.user);
              saveJSON(SESSION_KEY, verifyData.user);
            }
          } catch (err) {
            console.warn("Failed online-verifying cached session. Falling back to local cache:", err);
          }
        }

        // 2. 최신 구글 시트 데이터를 가져와 로컬 상태 강제 최신화
        if (currentSession.scriptUrl) {
          setIsSyncing(true);
          try {
            const response = await fetch(currentSession.scriptUrl);
            const data = await response.json();
            if (data.status === "success") {
              if (data.students) {
                const mappedStudents = data.students.map((s: any) => ({
                  ...s,
                  clubName: s.clubName || "", authCode: s.authCode || "1234", gender: s.gender === "F" ? "F" : "M", level: s.level || "초심", placementGamesPlayed: s.placementGamesPlayed ? Number(s.placementGamesPlayed) : 0, hiddenMMR: s.hiddenMMR ? Number(s.hiddenMMR) : 1000, rp: s.rp ? Number(s.rp) : 1000
                }));
                setStudents(mappedStudents);
                saveJSON(STUDENTS_KEY, mappedStudents);
              }
              if (data.matches) {
                setMatches(data.matches);
                saveJSON(MATCHES_KEY, data.matches);
              }
              if (data.leagueName) {
                setTitle(data.leagueName);
                saveJSON(TITLE_KEY, data.leagueName);
              }
               if (data.settingsBonus) {
                 try {
                   const parsed = typeof data.settingsBonus === "string" 
                     ? JSON.parse(data.settingsBonus) 
                     : data.settingsBonus;
                   setActiveBonuses(parsed);
                   if (parsed && parsed.opMode) {
                     setOpMode(parsed.opMode);
                     localStorage.setItem(OP_MODE_KEY, parsed.opMode);
                   }
                   saveJSON(BONUSES_KEY, parsed);
                 } catch (e) {
                  console.error("Failed parsing settingsBonus from remote GET:", e);
                }
              }
              if (data.seasonList) {
                setSeasonList(data.seasonList);
              }
              console.log("Google Sheets database synchronized on session load!");
            }
          } catch (error) {
            console.warn("Could not sync with remote sheet on initialization. Local cache utilized:", error);
          } finally {
            setIsSyncing(false);
          }
        }
      }
    };

    initData();
  }, []);

  // 로컬 영속 캐싱 리스너
  useEffect(() => { if (hydrated) saveJSON(STUDENTS_KEY, students); }, [students, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(MATCHES_KEY, matches); }, [matches, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(TITLE_KEY, title); }, [title, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(LOCKED_KEY, isLocked); }, [isLocked, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(SETTINGS_KEY, { thresholds: tierThresholds, rpVars: rpVariables }); }, [tierThresholds, rpVariables, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(BONUSES_KEY, activeBonuses); }, [activeBonuses, hydrated]);

  // 경기 기록 및 동기화 (단식/복식 지원, 개별 보너스 연산 적용)
  const recordMatch = useCallback((
    playerAId: string, 
    playerBId: string, 
    scoreA: number, 
    scoreB: number,
    playerA2Id?: string,
    playerB2Id?: string,
    matchType: "single" | "double" = "single"
  ) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    if (playerAId === playerBId) return;
    const aWon = scoreA > scoreB;

    const playerA = students.find((s) => s.id === playerAId);
    const playerB = students.find((s) => s.id === playerBId);
    const playerA2 = playerA2Id ? students.find((s) => s.id === playerA2Id) : undefined;
    const playerB2 = playerB2Id ? students.find((s) => s.id === playerB2Id) : undefined;
    if (!playerA || !playerB) return;

    // Determine match discipline automatically
    const discipline = determineDiscipline(playerA, playerB, playerA2, playerB2);

    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    const todayYmd = localToday.toISOString().split("T")[0];

    const activePlayers = [
      { id: playerAId, role: "A" as const, isA: true },
      { id: playerA2Id, role: "A2" as const, isA: true },
      { id: playerBId, role: "B" as const, isA: false },
      { id: playerB2Id, role: "B2" as const, isA: false }
    ].filter((p) => p.id !== undefined && p.id !== "") as { id: string; role: "A" | "A2" | "B" | "B2"; isA: boolean }[];

    const playerStats = activePlayers.map((p) => {
      const student = students.find((s) => s.id === p.id);
      if (!student) return null;

      const won = p.isA ? aWon : !aWon;
      const oppIds = p.isA 
        ? [playerBId, playerB2Id].filter(Boolean) as string[] 
        : [playerAId, playerA2Id].filter(Boolean) as string[];
      const opponents = students.filter((s) => oppIds.includes(s.id));

      let underdogBonus = 0;
      let scoreDiffBonus = 0;
      let rivalBonus = 0;
      let firstWinBonus = 0;
      let revengeBonus = 0;

      if (won) {
        if (activeBonuses.underdog && opponents.length > 0) {
          const playerTier = getTier(student.rp, computedThresholds, student.placementGamesPlayed);
          const playerTierRank = TIER_RANKING[playerTier] ?? 1;
          const maxOppRp = Math.max(...opponents.map((o) => o.rp));
          const maxOppTier = getTier(maxOppRp, computedThresholds, opponents[0].placementGamesPlayed);
          const maxOppTierRank = TIER_RANKING[maxOppTier] ?? 1;
          if (playerTierRank < maxOppTierRank) {
            underdogBonus = Math.max(0, Math.floor((maxOppRp - student.rp) * 0.1));
          }
        }

        if (activeBonuses.scoreDiff) {
          scoreDiffBonus = Math.abs(scoreA - scoreB);
        }

        if (activeBonuses.rival) {
          rivalBonus = opponents.some((o) => Math.abs(student.rp - o.rp) <= 20) ? 5 : 0;
        }

        if (activeBonuses.firstWin) {
          firstWinBonus = student.lastWinDate !== todayYmd ? 15 : 0;
        }

        if (activeBonuses.revenge) {
          const hasPastLoss = matches.some((m) => {
            const mTeamA = [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
            const mTeamB = [m.playerBId, m.playerB2Id].filter(Boolean) as string[];
            const mAWon = m.scoreA > m.scoreB;
            
            const sIsOnA = mTeamA.includes(student.id);
            const sIsOnB = mTeamB.includes(student.id);
            
            if (sIsOnA) {
              const lost = !mAWon;
              const facedAnyOpp = mTeamB.some((oppId) => oppIds.includes(oppId));
              return lost && facedAnyOpp;
            }
            if (sIsOnB) {
              const lost = mAWon;
              const facedAnyOpp = mTeamA.some((oppId) => oppIds.includes(oppId));
              return lost && facedAnyOpp;
            }
            return false;
          });
          revengeBonus = hasPastLoss ? 10 : 0;
        }
      }

      const baseDelta = won ? rpVariables.winDelta : -rpVariables.loseDelta;

      // 1. Calculate MMR Change (3x during placement)
      const isPlacement = student.placementGamesPlayed < 5;
      const mmrMultiplier = isPlacement ? 3 : 1;
      const mmrDelta = baseDelta * mmrMultiplier;
      const nextMmr = Math.max(0, student.hiddenMMR + mmrDelta);

      // 2. Calculate RP Change
      let rpDelta = 0;
      let finalRp = student.rp;
      let nextPlacementGamesPlayed = student.placementGamesPlayed + 1;

      if (isPlacement) {
        if (nextPlacementGamesPlayed === 5) {
          finalRp = Math.min(nextMmr, 1399); // Cap at Gold ceiling
          rpDelta = finalRp - student.rp;
        } else {
          rpDelta = 0; // RP stays same during placement
        }
      } else {
        if (won) {
          rpDelta = rpVariables.winDelta + underdogBonus + scoreDiffBonus + rivalBonus + firstWinBonus + revengeBonus;
        } else {
          // Bronze ~ Silver 절대 평가 구간: 패배 시 RP 차감 0
          const currentTier = getTier(student.rp, computedThresholds, student.placementGamesPlayed);
          if (currentTier === "Bronze" || currentTier === "Silver" || student.rp < 1200) {
            rpDelta = 0;
          } else {
            rpDelta = -rpVariables.loseDelta;
          }
        }
        finalRp = Math.max(0, student.rp + rpDelta);
      }

      return {
        id: student.id,
        role: p.role,
        isA: p.isA,
        won,
        mmrDelta,
        nextMmr,
        rpDelta,
        finalRp,
        nextPlacementGamesPlayed,
        underdogBonus,
        scoreDiffBonus,
        rivalBonus,
        firstWinBonus,
        revengeBonus
      };
    }).filter(Boolean);

    const statA = playerStats.find((p) => p.role === "A");
    const statB = playerStats.find((p) => p.role === "B");
    const statA2 = playerStats.find((p) => p.role === "A2");
    const statB2 = playerStats.find((p) => p.role === "B2");

    const promotedPlayers = playerStats.filter((ps) => {
      if (!ps.won) return false;
      const s = students.find((st) => st.id === ps.id);
      if (!s) return false;
      const prevTier = getTier(s.rp, computedThresholds, s.placementGamesPlayed);
      const finalTier = getTier(ps.finalRp, computedThresholds, ps.nextPlacementGamesPlayed);
      const prevSub = getTierSubdivision(s.rp, computedThresholds, s.placementGamesPlayed);
      const finalSub = getTierSubdivision(ps.finalRp, computedThresholds, ps.nextPlacementGamesPlayed);
      
      const basePromoted = TIER_ORDER.indexOf(finalTier) < TIER_ORDER.indexOf(prevTier);
      const subPromoted = finalTier === prevTier && finalSub < prevSub;
      return basePromoted || subPromoted;
    });

    promotedPlayers.forEach((ps) => {
      const s = students.find((st) => st.id === ps.id);
      if (s) {
        const currentLabel = getFullTierLabel(ps.finalRp, computedThresholds, ps.nextPlacementGamesPlayed);
        setPromotionEvent({
          isPromoted: true,
          newTier: currentLabel,
          studentName: s.name
        });
      }
    });

    const match: Match = { 
      id: uid(), 
      playerAId, 
      playerBId, 
      playerA2Id,
      playerB2Id,
      scoreA, 
      scoreB, 
      date: new Date().toISOString(),
      matchType,
      discipline,
      rpDeltaA: statA?.rpDelta,
      rpDeltaB: statB?.rpDelta,
      rpDeltaA2: statA2?.rpDelta,
      rpDeltaB2: statB2?.rpDelta,
      underdogBonusA: statA?.underdogBonus,
      underdogBonusB: statB?.underdogBonus,
      underdogBonusA2: statA2?.underdogBonus,
      underdogBonusB2: statB2?.underdogBonus,
      scoreDiffBonusA: statA?.scoreDiffBonus,
      scoreDiffBonusB: statB?.scoreDiffBonus,
      scoreDiffBonusA2: statA2?.scoreDiffBonus,
      scoreDiffBonusB2: statB2?.scoreDiffBonus,
      rivalBonusA: statA?.rivalBonus,
      rivalBonusB: statB?.rivalBonus,
      rivalBonusA2: statA2?.rivalBonus,
      rivalBonusB2: statB2?.rivalBonus,
      firstWinBonusA: statA?.firstWinBonus,
      firstWinBonusB: statB?.firstWinBonus,
      firstWinBonusA2: statA2?.firstWinBonus,
      firstWinBonusB2: statB2?.firstWinBonus,
      revengeBonusA: statA?.revengeBonus,
      revengeBonusB: statB?.revengeBonus,
      revengeBonusA2: statA2?.revengeBonus,
      revengeBonusB2: statB2?.revengeBonus,
    };
    
    const nextMatches = [match, ...matches];

    const nextStudents = students.map((s) => {
      const pStat = playerStats.find((p) => p.id === s.id);
      if (!pStat) return s;

      const won = pStat.won;
      const finalRp = pStat.finalRp;
      const nextMmr = pStat.nextMmr;
      const nextPlacementGames = pStat.nextPlacementGamesPlayed;

      const preRp = s.rp;
      const preTier = getTier(preRp, computedThresholds, s.placementGamesPlayed);
      const preTierRank = TIER_RANKING[preTier] ?? 1;

      let nextShields = s.demotionShields ?? 0;

      if (won && nextPlacementGames >= 5) {
        const tentativeTier = getTier(finalRp, computedThresholds, nextPlacementGames);
        const tentativeTierRank = TIER_RANKING[tentativeTier] ?? 1;
        if (tentativeTierRank > preTierRank) {
          nextShields = 3;
        }
      } else if (!won && nextPlacementGames >= 5) {
        const minThreshold = computedThresholds[preTier] ?? 0;
        if (finalRp < minThreshold && preTier !== "Bronze" && preTier !== "Silver" && preTier !== "Unranked") {
          if (nextShields >= 1) {
            nextShields = nextShields - 1;
            pStat.finalRp = minThreshold; // Apply shield
          }
        }
      }

      return {
        ...s,
        rp: pStat.finalRp,
        hiddenMMR: nextMmr,
        placementGamesPlayed: nextPlacementGames,
        wins: s.wins + (won ? 1 : 0),
        losses: s.losses + (won ? 0 : 1),
        recent: [(won ? "W" : "L") as "W" | "L", ...s.recent].slice(0, 5),
        demotionShields: nextShields,
        lastMatchDate: new Date().toISOString(),
        lastWinDate: won ? todayYmd : s.lastWinDate,
      };
    });

    setMatches(nextMatches);
    setStudents(nextStudents);

    const rpChange: Record<string, number> = {};
    playerStats.forEach((p) => {
      rpChange[p.id] = p.rpDelta;
    });

    recordMatchToGoogleSheets(match, rpChange, students, matches);

    return match;
  }, [students, matches, recordMatchToGoogleSheets, rpVariables, computedThresholds]);

  // 경기 삭제(롤백) 및 동기화
  const deleteMatch = useCallback((matchId: string) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const nextMatches = matches.filter((m) => m.id !== matchId);

    const playerAId = match.playerAId;
    const playerBId = match.playerBId;
    const playerA2Id = match.playerA2Id;
    const playerB2Id = match.playerB2Id;
    const aWon = match.scoreA > match.scoreB;

    const activePlayerIds = [playerAId, playerBId, playerA2Id, playerB2Id].filter(Boolean) as string[];

    const nextStudents = students.map((s) => {
      if (!activePlayerIds.includes(s.id)) return s;

      const isTeamA = s.id === playerAId || s.id === playerA2Id;
      const won = isTeamA ? aWon : !aWon;
      
      let rpDelta = 0;
      if (s.id === playerAId) {
        rpDelta = match.rpDeltaA !== undefined ? -match.rpDeltaA : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
      } else if (s.id === playerBId) {
        rpDelta = match.rpDeltaB !== undefined ? -match.rpDeltaB : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
      } else if (s.id === playerA2Id) {
        rpDelta = match.rpDeltaA2 !== undefined ? -match.rpDeltaA2 : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
      } else if (s.id === playerB2Id) {
        rpDelta = match.rpDeltaB2 !== undefined ? -match.rpDeltaB2 : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
      }
      const newRp = Math.max(0, s.rp + rpDelta);
      const newWins = Math.max(0, s.wins - (won ? 1 : 0));
      const newLosses = Math.max(0, s.losses - (won ? 0 : 1));

      const sMatches = nextMatches
        .filter((m) => m.playerAId === s.id || m.playerBId === s.id || m.playerA2Id === s.id || m.playerB2Id === s.id)
        .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
        .slice(0, 5);

      const newRecent = sMatches.map((m) => {
        const mIsA = m.playerAId === s.id || m.playerA2Id === s.id;
        const mAWon = m.scoreA > m.scoreB;
        const mWon = mIsA ? mAWon : !mAWon;
        return mWon ? "W" : "L";
      });

      return {
        ...s,
        rp: newRp,
        wins: newWins,
        losses: newLosses,
        recent: newRecent,
      };
    });

    setMatches(nextMatches);
    setStudents(nextStudents);
  }, [students, matches, rpVariables]);

  // 개별 학생 전적 리셋 및 동기화
  const resetStudent = useCallback((studentId: string) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const nextMatches = matches.filter(
      (m) => m.playerAId !== studentId && m.playerBId !== studentId && m.playerA2Id !== studentId && m.playerB2Id !== studentId
    );

    const playedOpponents = new Set<string>();
    matches.forEach((m) => {
      if (m.playerAId === studentId || m.playerA2Id === studentId) {
        if (m.playerBId) playedOpponents.add(m.playerBId);
        if (m.playerB2Id) playedOpponents.add(m.playerB2Id);
        const partnerId = m.playerAId === studentId ? m.playerA2Id : m.playerAId;
        if (partnerId) playedOpponents.add(partnerId);
      }
      if (m.playerBId === studentId || m.playerB2Id === studentId) {
        if (m.playerAId) playedOpponents.add(m.playerAId);
        if (m.playerA2Id) playedOpponents.add(m.playerA2Id);
        const partnerId = m.playerBId === studentId ? m.playerB2Id : m.playerBId;
        if (partnerId) playedOpponents.add(partnerId);
      }
    });

    const nextStudents = students.map((s) => {
      if (s.id === studentId) {
        return {
          ...s,
          rp: 1000,
          wins: 0,
          losses: 0,
          recent: [],
        };
      }

      if (playedOpponents.has(s.id)) {
        const sMatches = nextMatches
          .filter((m) => m.playerAId === s.id || m.playerBId === s.id || m.playerA2Id === s.id || m.playerB2Id === s.id)
          .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
          .slice(0, 5);

        const newRecent = sMatches.map((m) => {
          const mIsA = m.playerAId === s.id || m.playerA2Id === s.id;
          const mAWon = m.scoreA > m.scoreB;
          const mWon = mIsA ? mAWon : !mAWon;
          return mWon ? "W" : "L";
        });

        return {
          ...s,
          recent: newRecent,
        };
      }

      return s;
    });

    setMatches(nextMatches);
    setStudents(nextStudents);
  }, [students, matches]);

  // 시즌 전체 초기화 및 동기화
  const resetAllData = useCallback(() => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const nextMatches: Match[] = [];
    const nextStudents = students.map((s) => ({
      ...s,
      rp: 1000,
      wins: 0,
      losses: 0,
      recent: [],
    }));

    setMatches(nextMatches);
    setStudents(nextStudents);
  }, [students, matches]);

  // 교사 관리자 수동 RP 수정 및 동기화
  const updateStudentRP = useCallback((studentId: string, nextRp: number) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const nextStudents = students.map((s) => {
      if (s.id !== studentId) return s;
      return {
        ...s,
        rp: Math.max(0, nextRp),
      };
    });

    setStudents(nextStudents);
  }, [students, matches]);

  // 새로운 명렬표 대량 업서트 및 동기화
  const upsertStudents = useCallback(
    (rows: { clubName: string; name: string; gender: Gender; level: "A" | "B" | "C" | "D" | "초심"; authCode: string }[]) => {
      if (currentViewSeasonRef.current !== "현재 시즌") {
        toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
        return { added: 0, kept: 0 };
      }
      let added = 0, kept = 0;
      const byKey = new Map(students.map((s) => [studentKey(s), s]));
      const next: Student[] = [];
      const seenKeys = new Set<string>();
      for (const r of rows) {
        const k = studentKey(r);
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
        const exists = byKey.get(k);
        if (exists) {
          kept++;
          next.push({ 
            ...exists, 
            gender: r.gender || exists.gender,
            level: r.level || exists.level,
            authCode: r.authCode || exists.authCode
          });
        } else {
          added++;
          next.push({
            id: uid(),
            clubName: r.clubName,
            name: r.name,
            gender: r.gender || "M",
            level: r.level || "초심",
            authCode: r.authCode || "1234",
            placementGamesPlayed: 0,
            hiddenMMR: 1000,
            rp: 1000,
            recent: [],
            wins: 0,
            losses: 0,
            demotionShields: 0,
          });
        }
      }
      for (const s of students) {
        const k = studentKey(s);
        if (!seenKeys.has(k)) next.push(s);
      }
      
      setStudents(next);

      return { added, kept };
    },
    [students, matches],
  );

  // 리그전 커스텀 설정 캘리브레이션 업데이트 함수
  const updateLeagueSettings = useCallback((thresholds: Record<TierName, number>, rpVars: { winDelta: number; loseDelta: number }) => {
    setTierThresholds(thresholds);
    setRpVariables(rpVars);
  }, []);

  // 특정 학생의 성별 변경 및 구글 시트 동기화
  const updateStudentGender = useCallback((studentId: string, gender: Gender) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const nextStudents = students.map((s) => {
      if (s.id !== studentId) return s;
      return { ...s, gender };
    });
    setStudents(nextStudents);
  }, [students, matches]);

  // 개별 학생 삭제 및 연쇄 삭제 & 전적 복구 롤백
  const deleteStudent = useCallback((studentId: string) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const matchesToRemove = matches.filter((m) => m.playerAId === studentId || m.playerBId === studentId || m.playerA2Id === studentId || m.playerB2Id === studentId);
    const nextMatches = matches.filter((m) => m.playerAId !== studentId && m.playerBId !== studentId && m.playerA2Id !== studentId && m.playerB2Id !== studentId);

    // 1. 삭제할 학생 제외
    let nextStudents = students.filter((s) => s.id !== studentId);

    // 2. 삭제되는 경기들의 상대방 & 아군 파트너 전적 복구
    matchesToRemove.forEach((m) => {
      const aWon = m.scoreA > m.scoreB;
      const isPlayerA = m.playerAId === studentId || m.playerA2Id === studentId;
      
      const partnerId = isPlayerA 
        ? (m.playerAId === studentId ? m.playerA2Id : m.playerAId) 
        : (m.playerBId === studentId ? m.playerB2Id : m.playerBId);
        
      const oppIds = isPlayerA 
        ? [m.playerBId, m.playerB2Id].filter(Boolean) as string[] 
        : [m.playerAId, m.playerA2Id].filter(Boolean) as string[];

      const affectedPlayers = [
        ...oppIds.map(id => ({ id, isOpponent: true })),
        partnerId ? { id: partnerId, isOpponent: false } : null
      ].filter(Boolean) as { id: string; isOpponent: boolean }[];

      nextStudents = nextStudents.map((s) => {
        const affected = affectedPlayers.find(ap => ap.id === s.id);
        if (!affected) return s;

        let rpDelta = 0;
        const won = affected.isOpponent ? !isPlayerA : isPlayerA;
        
        if (s.id === m.playerAId) {
          rpDelta = m.rpDeltaA !== undefined ? -m.rpDeltaA : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
        } else if (s.id === m.playerBId) {
          rpDelta = m.rpDeltaB !== undefined ? -m.rpDeltaB : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
        } else if (s.id === m.playerA2Id) {
          rpDelta = m.rpDeltaA2 !== undefined ? -m.rpDeltaA2 : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
        } else if (s.id === m.playerB2Id) {
          rpDelta = m.rpDeltaB2 !== undefined ? -m.rpDeltaB2 : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
        }

        const newRp = Math.max(0, s.rp + rpDelta);
        const newWins = Math.max(0, s.wins - (won ? 1 : 0));
        const newLosses = Math.max(0, s.losses - (won ? 0 : 1));

        return {
          ...s,
          rp: newRp,
          wins: newWins,
          losses: newLosses,
        };
      });
    });

    // 3. 상대방들의 recent 배열 재구성
    nextStudents = nextStudents.map((s) => {
      const sMatches = nextMatches
        .filter((m) => m.playerAId === s.id || m.playerBId === s.id || m.playerA2Id === s.id || m.playerB2Id === s.id)
        .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
        .slice(0, 5);

      const newRecent = sMatches.map((m) => {
        const mIsA = m.playerAId === s.id || m.playerA2Id === s.id;
        const mAWon = m.scoreA > m.scoreB;
        const mWon = mIsA ? mAWon : !mAWon;
        return mWon ? "W" : "L";
      });

      return {
        ...s,
        recent: newRecent,
      };
    });

    setMatches(nextMatches);
    setStudents(nextStudents);
  }, [students, matches, rpVariables]);

  // CSV 롤백 복원 액션
  const restoreFromCSV = useCallback((restoredStudents: Student[], restoredMatches: Match[]) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    setStudents(restoredStudents);
    setMatches(restoredMatches);
    saveJSON(STUDENTS_KEY, restoredStudents);
    saveJSON(MATCHES_KEY, restoredMatches);
  }, [students, matches]);

  // 교사 통제형 휴면 강등 일괄 RP 차감 액션
  const bulkDecayRP = useCallback((inactiveDays: number, decayAmount: number) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return 0;
    }
    let affectedCount = 0;
    const goldCutoff = tierThresholds.Gold ?? 1200;
    const now = new Date().getTime();
    const msThreshold = inactiveDays * 24 * 60 * 60 * 1000;

    const nextStudents = students.map((s) => {
      // Gold 등급 이상만 차감 대상
      if (s.rp < goldCutoff) return s;
      // 마지막 경기 전적이 존재하는 경우
      if (s.lastMatchDate) {
        const lastTime = new Date(s.lastMatchDate).getTime();
        const elapsed = now - lastTime;
        if (elapsed >= msThreshold) {
          affectedCount++;
          return {
            ...s,
            rp: Math.max(0, s.rp - decayAmount),
          };
        }
      }
      return s;
    });

    if (affectedCount > 0) {
      setStudents(nextStudents);
    }

    return affectedCount;
  }, [students, matches, tierThresholds]);

  // 경기 점수 수정 및 보너스/RP 완벽 재계산 액션
  const updateMatchScore = useCallback((matchId: string, nextScoreA: number, nextScoreB: number) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const playerAId = match.playerAId;
    const playerBId = match.playerBId;
    const playerA2Id = match.playerA2Id;
    const playerB2Id = match.playerB2Id;
    
    const oldAWon = match.scoreA > match.scoreB;
    const oldRpDeltaA = match.rpDeltaA ?? 0;
    const oldRpDeltaB = match.rpDeltaB ?? 0;
    const oldRpDeltaA2 = match.rpDeltaA2 ?? 0;
    const oldRpDeltaB2 = match.rpDeltaB2 ?? 0;

    const activePlayerIds = [playerAId, playerBId, playerA2Id, playerB2Id].filter(Boolean) as string[];

    // 1. Rollback old match stats for all active students to get their "pre-match" state
    const rolledBackStudents = students.map((s) => {
      if (!activePlayerIds.includes(s.id)) return s;

      const isTeamA = s.id === playerAId || s.id === playerA2Id;
      const oldWon = isTeamA ? oldAWon : !oldAWon;
      
      let oldDelta = 0;
      if (s.id === playerAId) oldDelta = oldRpDeltaA;
      else if (s.id === playerBId) oldDelta = oldRpDeltaB;
      else if (s.id === playerA2Id) oldDelta = oldRpDeltaA2;
      else if (s.id === playerB2Id) oldDelta = oldRpDeltaB2;

      // Rollback wins, losses, RP
      const newRp = Math.max(0, s.rp - oldDelta);
      const newWins = Math.max(0, s.wins - (oldWon ? 1 : 0));
      const newLosses = Math.max(0, s.losses - (oldWon ? 0 : 1));

      return {
        ...s,
        rp: newRp,
        wins: newWins,
        losses: newLosses,
      };
    });

    // 2. Perform recalculation using the rolled back students
    const aWon = nextScoreA > nextScoreB;
    
    const activePlayers = [
      { id: playerAId, role: "A" as const, isA: true },
      { id: playerA2Id, role: "A2" as const, isA: true },
      { id: playerBId, role: "B" as const, isA: false },
      { id: playerB2Id, role: "B2" as const, isA: false }
    ].filter((p) => p.id !== undefined && p.id !== "") as { id: string; role: "A" | "A2" | "B" | "B2"; isA: boolean }[];

    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    const todayYmd = localToday.toISOString().split("T")[0];

    const playerStats = activePlayers.map((p) => {
      const student = rolledBackStudents.find((s) => s.id === p.id);
      if (!student) return null;

      const won = p.isA ? aWon : !aWon;
      const oppIds = p.isA 
        ? [playerBId, playerB2Id].filter(Boolean) as string[] 
        : [playerAId, playerA2Id].filter(Boolean) as string[];
      const opponents = rolledBackStudents.filter((s) => oppIds.includes(s.id));

      let underdogBonus = 0;
      let scoreDiffBonus = 0;
      let rivalBonus = 0;
      let firstWinBonus = 0;
      let revengeBonus = 0;

      if (won) {
        if (activeBonuses.underdog && opponents.length > 0) {
          const playerTier = getTier(student.rp, tierThresholds);
          const playerTierRank = TIER_RANKING[playerTier] ?? 1;
          const maxOppRp = Math.max(...opponents.map((o) => o.rp));
          const maxOppTier = getTier(maxOppRp, tierThresholds);
          const maxOppTierRank = TIER_RANKING[maxOppTier] ?? 1;
          if (playerTierRank < maxOppTierRank) {
            underdogBonus = Math.max(0, Math.floor((maxOppRp - student.rp) * 0.1));
          }
        }

        if (activeBonuses.scoreDiff) {
          scoreDiffBonus = Math.abs(nextScoreA - nextScoreB);
        }

        if (activeBonuses.rival) {
          rivalBonus = opponents.some((o) => Math.abs(student.rp - o.rp) <= 20) ? 5 : 0;
        }

        if (activeBonuses.firstWin) {
          firstWinBonus = student.lastWinDate !== todayYmd ? 15 : 0;
        }

        if (activeBonuses.revenge) {
          const pastMatches = matches.filter((m) => m.id !== matchId);
          const hasPastLoss = pastMatches.some((m) => {
            const mTeamA = [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
            const mTeamB = [m.playerBId, m.playerB2Id].filter(Boolean) as string[];
            const mAWon = m.scoreA > m.scoreB;
            
            const sIsOnA = mTeamA.includes(student.id);
            const sIsOnB = mTeamB.includes(student.id);
            
            if (sIsOnA) {
              const lost = !mAWon;
              const facedAnyOpp = mTeamB.some((oppId) => oppIds.includes(oppId));
              return lost && facedAnyOpp;
            }
            if (sIsOnB) {
              const lost = mAWon;
              const facedAnyOpp = mTeamA.some((oppId) => oppIds.includes(oppId));
              return lost && facedAnyOpp;
            }
            return false;
          });
          revengeBonus = hasPastLoss ? 10 : 0;
        }
      }

      const delta = won 
        ? (rpVariables.winDelta + underdogBonus + scoreDiffBonus + rivalBonus + firstWinBonus + revengeBonus)
        : -rpVariables.loseDelta;

      return {
        id: student.id,
        role: p.role,
        isA: p.isA,
        won,
        delta,
        underdogBonus,
        scoreDiffBonus,
        rivalBonus,
        firstWinBonus,
        revengeBonus
      };
    }).filter(Boolean) as {
      id: string;
      role: "A" | "A2" | "B" | "B2";
      isA: boolean;
      won: boolean;
      delta: number;
      underdogBonus: number;
      scoreDiffBonus: number;
      rivalBonus: number;
      firstWinBonus: number;
      revengeBonus: number;
    }[];

    const statA = playerStats.find((p) => p.role === "A");
    const statB = playerStats.find((p) => p.role === "B");
    const statA2 = playerStats.find((p) => p.role === "A2");
    const statB2 = playerStats.find((p) => p.role === "B2");

    // 승리팀 중 실시간 승급 효과 감지 (복식 지원으로 여러 명 동시 승급 가능)
    const promotedPlayers = playerStats.filter((ps) => {
      if (!ps.won) return false;
      const s = rolledBackStudents.find((st) => st.id === ps.id);
      if (!s) return false;
      const finalRp = s.rp + ps.delta;
      const prevTier = getTier(s.rp, tierThresholds);
      const finalTier = getTier(finalRp, tierThresholds);
      const prevSub = getTierSubdivision(s.rp, tierThresholds);
      const finalSub = getTierSubdivision(finalRp, tierThresholds);
      
      const basePromoted = TIER_ORDER.indexOf(finalTier) < TIER_ORDER.indexOf(prevTier);
      const subPromoted = finalTier === prevTier && finalSub < prevSub;
      return basePromoted || subPromoted;
    });

    promotedPlayers.forEach((ps) => {
      const s = rolledBackStudents.find((st) => st.id === ps.id);
      if (s) {
        const finalRp = s.rp + ps.delta;
        const currentLabel = getFullTierLabel(finalRp, tierThresholds);
        setPromotionEvent({
          isPromoted: true,
          newTier: currentLabel,
          studentName: s.name
        });
      }
    });

    // 3. Construct the updated Match record
    const updatedMatch: Match = {
      ...match,
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      rpDeltaA: statA?.delta,
      rpDeltaB: statB?.delta,
      rpDeltaA2: statA2?.delta,
      rpDeltaB2: statB2?.delta,
      underdogBonusA: statA?.underdogBonus ?? 0,
      underdogBonusB: statB?.underdogBonus ?? 0,
      underdogBonusA2: statA2?.underdogBonus ?? 0,
      underdogBonusB2: statB2?.underdogBonus ?? 0,
      scoreDiffBonusA: statA?.scoreDiffBonus ?? 0,
      scoreDiffBonusB: statB?.scoreDiffBonus ?? 0,
      scoreDiffBonusA2: statA2?.scoreDiffBonus ?? 0,
      scoreDiffBonusB2: statB2?.scoreDiffBonus ?? 0,
      rivalBonusA: statA?.rivalBonus ?? 0,
      rivalBonusB: statB?.rivalBonus ?? 0,
      rivalBonusA2: statA2?.rivalBonus ?? 0,
      rivalBonusB2: statB2?.rivalBonus ?? 0,
      firstWinBonusA: statA?.firstWinBonus ?? 0,
      firstWinBonusB: statB?.firstWinBonus ?? 0,
      firstWinBonusA2: statA2?.firstWinBonus ?? 0,
      firstWinBonusB2: statB2?.firstWinBonus ?? 0,
      revengeBonusA: statA?.revengeBonus ?? 0,
      revengeBonusB: statB?.revengeBonus ?? 0,
      revengeBonusA2: statA2?.revengeBonus ?? 0,
      revengeBonusB2: statB2?.revengeBonus ?? 0,
    };

    // 4. Update both students' stats with the new deltas
    const nextStudentsList = rolledBackStudents.map((s) => {
      if (!activePlayerIds.includes(s.id)) return s;

      const pStat = playerStats.find((p) => p.id === s.id);
      if (!pStat) return s;

      const won = pStat.won;
      const delta = pStat.delta;

      const preRp = s.rp;
      const preTier = getTier(preRp, tierThresholds);
      const preTierRank = TIER_RANKING[preTier] ?? 1;

      let nextRp = preRp + delta;
      let nextShields = s.demotionShields ?? 0;

      if (won) {
        const tentativeTier = getTier(nextRp, tierThresholds);
        const tentativeTierRank = TIER_RANKING[tentativeTier] ?? 1;
        if (tentativeTierRank > preTierRank) {
          nextShields = 3; // 승급 시 3회 완충
        }
        nextRp = Math.max(0, nextRp);
      } else {
        const minThreshold = tierThresholds[preTier] ?? 0;
        if (nextRp < minThreshold && preTier !== "Bronze") {
          if (nextShields >= 1) {
            nextRp = minThreshold;
            nextShields = nextShields - 1;
          } else {
            nextRp = Math.max(0, nextRp);
          }
        } else {
          nextRp = Math.max(0, nextRp);
        }
      }

      // Build new recent array
      const tempMatches = matches.map((m) => m.id === matchId ? updatedMatch : m);
      const sMatches = tempMatches
        .filter((m) => m.playerAId === s.id || m.playerBId === s.id || m.playerA2Id === s.id || m.playerB2Id === s.id)
        .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
        .slice(0, 5);

      const newRecent = sMatches.map((m) => {
        const mIsA = m.playerAId === s.id || m.playerA2Id === s.id;
        const mAWon = m.scoreA > m.scoreB;
        const mWon = mIsA ? mAWon : !mAWon;
        return mWon ? "W" : "L";
      });

      return {
        ...s,
        rp: nextRp,
        wins: s.wins + (won ? 1 : 0),
        losses: s.losses + (won ? 0 : 1),
        recent: newRecent,
        demotionShields: nextShields,
        lastMatchDate: new Date().toISOString(),
        lastWinDate: won ? todayYmd : s.lastWinDate,
      };
    });

    const nextMatchesList = matches.map((m) => m.id === matchId ? updatedMatch : m);

    setStudents(nextStudentsList);
    setMatches(nextMatchesList);
  }, [matches, students, tierThresholds, rpVariables]);

  // 리그 커스텀 설정 통합 저장 (마스터 DB 동기화 포함)
  const saveLeagueSettings = useCallback(async (newTitle: string, newBonuses: ActiveBonuses, newOpMode?: "school" | "club") => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 설정은 수정할 수 없습니다 (읽기 전용).");
      return;
    }
    const targetOpMode = newOpMode !== undefined ? newOpMode : opMode;
    setTitle(newTitle);
    setActiveBonuses(newBonuses);
    setOpMode(targetOpMode);
    saveJSON(TITLE_KEY, newTitle);
    saveJSON(BONUSES_KEY, newBonuses);
    localStorage.setItem(OP_MODE_KEY, targetOpMode);

    if (session) {
      const settingsPayload = {
        ...newBonuses,
        opMode: targetOpMode
      };
      const updatedSession = {
        ...session,
        leagueName: newTitle,
        settingsBonus: settingsPayload
      };
      setSession(updatedSession);
      saveJSON(SESSION_KEY, updatedSession);

      setIsSyncing(true);
      try {
        const res = await fetch(MASTER_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "UPDATE_LEAGUE_SETTINGS",
            loginId: session.loginId,
            role: session.role,
            schoolName: session.schoolName,
            leagueName: newTitle,
            settingsBonus: JSON.stringify(settingsPayload)
          })
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {}

        if (data && data.status === "error" && data.message && data.message.includes("혼잡")) {
          toast.error("다른 사용자가 설정을 수정 중입니다. 3초 후 다시 시도해주세요.", { id: "settings-lock-error" });
          return;
        }
        console.log("Updated league settings on Google Sheets:", data);
      } catch (err) {
        console.warn("Failed to sync settings to Google Sheets MASTER row. Kept locally.", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [session, opMode]);

  // 학교/클럽의 운영 모드 조회 헬퍼
  const getSchoolMode = useCallback(async (school: string): Promise<"school" | "club"> => {
    try {
      const teachers = await getTeachersList();
      const normalize = (name: string) => name.replace(/(초등학교|중학교|고등학교|초등|중등|고등|학교|초|클럽|동호회|회)$/, "").trim().toLowerCase();
      const target = normalize(school);
      const matched = teachers.find(
        (t: any) => 
          normalize(t.schoolName) === target || 
          normalize(t.loginId) === target
      );
      if (matched && matched.settingsBonus) {
        const parsed = typeof matched.settingsBonus === "string" ? JSON.parse(matched.settingsBonus) : matched.settingsBonus;
        if (parsed && parsed.opMode) return parsed.opMode;
      }
    } catch (e) {
      console.warn("Failed checking school mode:", e);
    }
    return "school";
  }, []);

  // 학생용 '나의 업적' 자동 연산 함수 (Derived State)
  const calculateAchievements = useCallback((studentId: string): Achievement[] => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return [];

    // 해당 학생이 참여한 모든 경기 필터링 (단식 및 복식 파트너 참여분 포함)
    const studentMatches = matches.filter(
      (m) => m.playerAId === studentId || m.playerBId === studentId || m.playerA2Id === studentId || m.playerB2Id === studentId
    );

    // 경기 기록 시간순 정렬 (과거에서 최신순)
    const chronologicalMatches = [...studentMatches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalGames = studentMatches.length;
    const totalLosses = chronologicalMatches.filter((m) => {
      const isPlayerA = m.playerAId === studentId || m.playerA2Id === studentId;
      const aWon = m.scoreA > m.scoreB;
      const won = isPlayerA ? aWon : !aWon;
      return !won;
    }).length;

    // 연승, 연패, 스냅 연산
    let maxWinStreak = 0;
    let currentWinStreak = 0;
    let maxLossStreak = 0;
    let currentLossStreak = 0;
    let brokeLossStreakOf4Plus = false;

    chronologicalMatches.forEach((m) => {
      const isPlayerA = m.playerAId === studentId || m.playerA2Id === studentId;
      const aWon = m.scoreA > m.scoreB;
      const won = isPlayerA ? aWon : !aWon;

      if (won) {
        currentWinStreak++;
        if (currentLossStreak >= 4) {
          brokeLossStreakOf4Plus = true;
        }
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) {
          maxWinStreak = currentWinStreak;
        }
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) {
          maxLossStreak = currentLossStreak;
        }
      }
    });

    // 자신보다 높은 티어와 대결한 횟수 (승패 무관)
    let higherTierCount = 0;
    chronologicalMatches.forEach((m) => {
      const isOnTeamA = m.playerAId === studentId || m.playerA2Id === studentId;
      const oppIds = isOnTeamA 
        ? [m.playerBId, m.playerB2Id].filter(Boolean) as string[] 
        : [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
      
      const hasHigherTierOpponent = oppIds.some((id) => {
        const opponent = students.find((s) => s.id === id);
        if (opponent) {
          const playerTier = getTier(student.rp, tierThresholds);
          const oppTier = getTier(opponent.rp, tierThresholds);
          const playerTierRank = TIER_RANKING[playerTier] ?? 1;
          const oppTierRank = TIER_RANKING[oppTier] ?? 1;
          return oppTierRank > playerTierRank;
        }
        return false;
      });
      
      if (hasHigherTierOpponent) {
        higherTierCount++;
      }
    });

    // 동일 날짜에 5경기 이상 참여 확인
    const dateCounts: Record<string, number> = {};
    studentMatches.forEach((m) => {
      const d = new Date(m.date);
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });
    const maxMatchesOnSingleDay = Object.values(dateCounts).reduce((max, val) => Math.max(max, val), 0);

    // 복수전 성공 보너스 누적 횟수
    const revengeCount = studentMatches.filter((m) => {
      const isPlayerA = m.playerAId === studentId;
      return isPlayerA ? (m.revengeBonusA ?? 0) > 0 : (m.revengeBonusB ?? 0) > 0;
    }).length;

    // 라이벌 격퇴 보너스 누적 횟수
    const rivalCount = studentMatches.filter((m) => {
      const isPlayerA = m.playerAId === studentId;
      return isPlayerA ? (m.rivalBonusA ?? 0) > 0 : (m.rivalBonusB ?? 0) > 0;
    }).length;

    return [
      // Common (커먼)
      {
        id: "court_first_greeting",
        name: "코트의 첫인사",
        description: "리그 첫 경기 기록 완료",
        tier: "Common",
        currentValue: totalGames >= 1 ? 1 : 0,
        targetValue: 1,
        isUnlocked: totalGames >= 1
      },
      {
        id: "warmup_complete",
        name: "워밍업 완료",
        description: "누적 경기 수 10회 달성",
        tier: "Common",
        currentValue: totalGames,
        targetValue: 10,
        isUnlocked: totalGames >= 10
      },
      {
        id: "taste_of_victory",
        name: "승리의 맛",
        description: "3연승 달성",
        tier: "Common",
        currentValue: maxWinStreak,
        targetValue: 3,
        isUnlocked: maxWinStreak >= 3
      },
      {
        id: "unbroken_heart",
        name: "꺾이지 않는 마음",
        description: "3연패 기록 (실패를 부끄러워하지 않는 태도 칭찬)",
        tier: "Common",
        currentValue: maxLossStreak,
        targetValue: 3,
        isUnlocked: maxLossStreak >= 3
      },
      // Rare (레어)
      {
        id: "iron_stamina",
        name: "강철 체력",
        description: "누적 경기 수 30회 달성",
        tier: "Rare",
        currentValue: totalGames,
        targetValue: 30,
        isUnlocked: totalGames >= 30
      },
      {
        id: "courageous_challenger",
        name: "용기 있는 도전자",
        description: "자신보다 티어가 높은 상대와 10회 대결 진행 (승패 무관)",
        tier: "Rare",
        currentValue: higherTierCount,
        targetValue: 10,
        isUnlocked: higherTierCount >= 10
      },
      {
        id: "gym_spirit",
        name: "체육관 지박령",
        description: "동일한 날짜에 5경기 이상 참여",
        tier: "Rare",
        currentValue: maxMatchesOnSingleDay,
        targetValue: 5,
        isUnlocked: maxMatchesOnSingleDay >= 5
      },
      {
        id: "unyielding_will",
        name: "불굴의 의지",
        description: "4연패 이상 기록 후 승리하여 연패 사슬 끊어내기",
        tier: "Rare",
        currentValue: brokeLossStreakOf4Plus ? 1 : 0,
        targetValue: 1,
        isUnlocked: brokeLossStreakOf4Plus
      },
      {
        id: "avatar_of_revenge",
        name: "복수의 화신",
        description: "복수전 성공 보너스 3회 누적 획득",
        tier: "Rare",
        currentValue: revengeCount,
        targetValue: 3,
        isUnlocked: revengeCount >= 3
      },
      // Epic (에픽)
      {
        id: "court_ruler",
        name: "코트의 지배자",
        description: "누적 경기 수 70회 달성",
        tier: "Epic",
        currentValue: totalGames,
        targetValue: 70,
        isUnlocked: totalGames >= 70
      },
      {
        id: "honorable_sweat",
        name: "명예로운 땀방울",
        description: "누적 패배 수 30회 달성 (실패에 굴하지 않는 스포츠맨십 칭찬)",
        tier: "Epic",
        currentValue: totalLosses,
        targetValue: 30,
        isUnlocked: totalLosses >= 30
      },
      {
        id: "rival_destroyer",
        name: "라이벌 파괴자",
        description: "라이벌 격퇴 보너스 15회 누적 획득",
        tier: "Epic",
        currentValue: rivalCount,
        targetValue: 15,
        isUnlocked: rivalCount >= 15
      },
      // Legendary (레전더리)
      {
        id: "legendary_undefeated",
        name: "무패의 전설",
        description: "10연승 달성",
        tier: "Legendary",
        currentValue: maxWinStreak,
        targetValue: 10,
        isUnlocked: maxWinStreak >= 10
      },
      {
        id: "true_champion",
        name: "진정한 챔피언",
        description: "누적 경기 수 120회 달성 (한 학기 동안 가장 성실하게 참여한 학생)",
        tier: "Legendary",
        currentValue: totalGames,
        targetValue: 120,
        isUnlocked: totalGames >= 120
      }
    ];
  }, [students, matches, tierThresholds]);

  // 학생용 티어 승격 실시간 감지 감시자
  useEffect(() => {
    if (hydrated && session && session.role === "STUDENT" && session.studentId) {
      const student = students.find((s) => s.id === session.studentId);
      if (student) {
        const currentRp = student.rp;
        const currentTier = getTier(currentRp, tierThresholds);
        const currentSub = getTierSubdivision(currentRp, tierThresholds);
        const currentLabel = getFullTierLabel(currentRp, tierThresholds);

        const lastKnownRpStr = localStorage.getItem(`bdm.lastKnownRp.${session.studentId}`);
        if (lastKnownRpStr) {
          const lastRp = parseInt(lastKnownRpStr, 10);
          if (!isNaN(lastRp) && lastRp !== currentRp) {
            const lastTier = getTier(lastRp, tierThresholds);
            const lastSub = getTierSubdivision(lastRp, tierThresholds);
            
            const getRank = (t: TierName, s: number) => {
              const base = { Bronze: 10, Silver: 20, Gold: 30, Platinum: 40, Diamond: 50 }[t] ?? 10;
              return base + (5 - s);
            };

            // 이전 랭크보다 현재 랭크가 더 높으면 승급 이벤트 트리거
            if (getRank(currentTier, currentSub) > getRank(lastTier, lastSub)) {
              setPromotionEvent({ isPromoted: true, newTier: currentLabel });
            }
          }
        }
        // 최신 RP로 로컬 캐시 갱신
        localStorage.setItem(`bdm.lastKnownRp.${session.studentId}`, currentRp.toString());
      }
    }
  }, [students, hydrated, session, tierThresholds]);

  // 5. CHANGE_SEASON API 액션 메소드
  const changeSeason = useCallback(async (seasonName: string) => {
    if (currentViewSeasonRef.current !== "현재 시즌") {
      toast.error("과거 시즌 기록은 수정할 수 없습니다 (읽기 전용).");
      return { success: false, message: "Read-only mode" };
    }
    if (!session || !session.scriptUrl) {
      toast.error("로그인 세션이 없거나 연동된 시트 주소가 없습니다.");
      return { success: false, message: "No scriptUrl" };
    }
    setIsSyncing(true);
    try {
      const res = await fetch(session.scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "CHANGE_SEASON",
          seasonName
        })
      });

      if (res.status === 429 || res.status === 500 || res.status === 503) {
        throw new Error(`STATUS_${res.status}`);
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {}

      if (data && data.status === "success") {
        return { success: true };
      } else {
        return { success: false, message: (data && data.message) || "시즌 변경 실패" };
      }
    } catch (error: any) {
      console.error("CHANGE_SEASON request failed:", error);
      return { success: false, message: error.message || "Network Error" };
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

  // 6. 과거 시즌 데이터 Fetch 액션 메소드
  const changeViewSeason = useCallback(async (seasonName: string) => {
    setCurrentViewSeason(seasonName);
    if (!session || !session.scriptUrl) return;
    setIsSyncing(true);
    try {
      const url = seasonName === "현재 시즌"
        ? session.scriptUrl
        : `${session.scriptUrl}${session.scriptUrl.includes("?") ? "&" : "?"}seasonName=${encodeURIComponent(seasonName)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "success") {
        if (data.students) {
          const mappedStudents = data.students.map((s: any) => ({
            ...s,
            clubName: s.clubName || "", authCode: s.authCode || "1234", gender: s.gender === "F" ? "F" : "M", level: s.level || "초심", placementGamesPlayed: s.placementGamesPlayed ? Number(s.placementGamesPlayed) : 0, hiddenMMR: s.hiddenMMR ? Number(s.hiddenMMR) : 1000, rp: s.rp ? Number(s.rp) : 1000
          }));
          setStudents(mappedStudents);
          saveJSON(STUDENTS_KEY, mappedStudents);
        }
        if (data.matches) {
          setMatches(data.matches);
          saveJSON(MATCHES_KEY, data.matches);
        }
        if (data.leagueName) {
          setTitle(data.leagueName);
          saveJSON(TITLE_KEY, data.leagueName);
        }
        if (data.settingsBonus) {
          try {
            const parsed = typeof data.settingsBonus === "string" 
              ? JSON.parse(data.settingsBonus) 
              : data.settingsBonus;
            setActiveBonuses(parsed);
            if (parsed && parsed.opMode) {
              setOpMode(parsed.opMode);
              localStorage.setItem(OP_MODE_KEY, parsed.opMode);
            }
            saveJSON(BONUSES_KEY, parsed);
          } catch (e) {
            console.error("Failed parsing settingsBonus from remote GET:", e);
          }
        }
        if (data.seasonList) {
          setSeasonList(data.seasonList);
        }
        console.log(`Successfully loaded historical season data: ${seasonName}`);
      } else {
        toast.error("데이터 로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("Failed to load season data:", error);
      toast.error("시즌 데이터를 불러오는데 실패했습니다.");
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

  return { 
    hydrated, 
    students, 
    matches, 
    title, 
    setTitle, 
    recordMatch, 
    upsertStudents, 
    isLocked, 
    setIsLocked, 
    deleteMatch, 
    resetStudent, 
    resetAllData, 
    updateStudentRP,
    isSyncing,
    session,
    loginUser,
    registerUser,
    logoutUser,
    recoverPassword,
    MASTER_API_URL,
    tierThresholds,
    rpVariables,
    updateLeagueSettings,
    updateStudentGender,
    deleteStudent,
    restoreFromCSV,
    bulkDecayRP,
    teacherAccessCode,
    updateMatchScore,
    activeBonuses,
    saveLeagueSettings,
    calculateAchievements,
    promotionEvent,
    setPromotionEvent,
    opMode,
    setOpMode,
    getSchoolMode,
    seasonList,
    changeSeason,
    currentViewSeason,
    changeViewSeason
  };
}
