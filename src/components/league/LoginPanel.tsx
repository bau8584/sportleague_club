import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Swords, 
  Users, 
  Building2, 
  Key, 
  Gamepad2, 
  ShieldCheck, 
  UserPlus, 
  ArrowLeft, 
  Globe, 
  Lock,
  Sparkles
} from "lucide-react";

type Role = "TEACHER" | "STUDENT" | "MASTER";

export function LoginPanel({
  onLogin,
  onRegister,
  isSyncing
}: {
  onLogin: (
    schoolName: string, 
    accessCodeOrName: string, 
    role: Role, 
    authCode?: string
  ) => Promise<{ success: boolean; message?: string }>;
  onRegister: (details: {
    name: string;
    gender: "M" | "F";
    authCode: string;
    level: "A" | "B" | "C" | "D" | "초심";
    joinCode: string;
    clubName: string;
  }) => Promise<{ success: boolean; message?: string }>;
  isSyncing: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  
  // Local Cached Club Name for UI context
  const cachedClubName = localStorage.getItem("bdm.clubName.v1") || "";

  // Player Login Inputs
  const [studentName, setStudentName] = useState("");
  const [playerPin, setPlayerPin] = useState("");
  const [loginClubInput, setLoginClubInput] = useState(cachedClubName);

  // Player Sign Up Inputs
  const [signUpClubName, setSignUpClubName] = useState(cachedClubName);
  const [signUpName, setSignUpName] = useState("");
  const [signUpGender, setSignUpGender] = useState<"M" | "F">("M");
  const [signUpPin, setSignUpPin] = useState("");
  const [signUpLevel, setSignUpLevel] = useState<"A" | "B" | "C" | "D" | "초심">("초심");
  const [signUpJoinCode, setSignUpJoinCode] = useState("");

  // Admin Login Inputs
  const [adminClubName, setAdminClubName] = useState(cachedClubName);
  const [adminPasscode, setAdminPasscode] = useState("");

  // Master Login Inputs
  const [masterId, setMasterId] = useState("");
  const [masterPw, setMasterPw] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. MASTER LOGIN MODE
    if (isMasterMode) {
      if (!masterId.trim() || !masterPw.trim()) {
        return toast.error("마스터 계정 ID와 비밀번호를 모두 입력해 주세요.");
      }
      const res = await onLogin(masterId.trim(), masterPw.trim(), "MASTER");
      if (res.success) {
        toast.success("👑 최고 마스터 관리자 세션으로 접속했습니다!");
      } else {
        toast.error(res.message || "마스터 로그인 정보가 일치하지 않습니다.");
      }
      return;
    }

    // 2. MEMBER SIGN UP FLOW
    if (isSignUpMode && activeTab === "STUDENT") {
      const targetClub = signUpClubName.trim();
      if (!targetClub) return toast.error("가입할 동호회 이름을 입력해 주세요.");
      if (!signUpName.trim()) return toast.error("이름을 입력해 주세요.");
      if (signUpPin.length !== 4 || isNaN(Number(signUpPin))) {
        return toast.error("본인 확인용 핀코드는 숫자 4자리로 입력해 주세요.");
      }
      if (!signUpJoinCode.trim()) return toast.error("클럽 가입 인증 코드를 입력해 주세요.");

      toast.loading("동호회 회원가입 요청 중...", { id: "signup-loading" });
      const res = await onRegister({
        name: signUpName.trim(),
        gender: signUpGender,
        authCode: signUpPin.trim(),
        level: signUpLevel,
        joinCode: signUpJoinCode.trim(),
        clubName: targetClub
      });
      toast.dismiss("signup-loading");

      if (res.success) {
        toast.success("🎉 회원가입 성공! 설정한 이름과 핀코드로 로그인해 주세요.");
        setIsSignUpMode(false);
        setStudentName(signUpName.trim());
        setPlayerPin(signUpPin.trim());
        setLoginClubInput(targetClub);
        localStorage.setItem("bdm.clubName.v1", targetClub);
      } else {
        toast.error(res.message || "가입 처리에 실패했습니다. 입력 정보를 확인해 주세요.");
      }
      return;
    }

    // 3. ADMIN LOGIN FLOW
    if (activeTab === "TEACHER") {
      if (!adminClubName.trim()) {
        return toast.error("동호회 이름을 입력해 주세요.");
      }
      if (!adminPasscode.trim()) {
        return toast.error("관리자 인증코드를 입력해 주세요.");
      }
      
      toast.loading("운영진 인증 처리 중...", { id: "admin-loading" });
      const res = await onLogin(adminClubName.trim(), adminPasscode.trim(), "TEACHER");
      toast.dismiss("admin-loading");

      if (res.success) {
        toast.success(`🔐 ${adminClubName} 운영진 권한으로 접속했습니다!`);
      } else {
        toast.error(res.message || "인증코드가 일치하지 않습니다. ('0000' 입력 필요)");
      }
      return;
    }

    // 4. STUDENT LOGIN FLOW
    const activeClub = loginClubInput.trim() || cachedClubName;
    if (!activeClub) {
      return toast.error("동호회 이름을 입력해 주세요.");
    }
    if (!studentName.trim()) {
      return toast.error("선수 본인의 이름을 입력해 주세요.");
    }
    if (!playerPin.trim()) {
      return toast.error("본인 확인용 핀코드를 입력해 주세요.");
    }

    toast.loading("선수 로그인 인증 중...", { id: "player-loading" });
    const res = await onLogin(
      activeClub,
      studentName.trim(),
      "STUDENT",
      playerPin.trim()
    );
    toast.dismiss("player-loading");

    if (res.success) {
      toast.success(`${activeClub} ${studentName} 선수 로그인 성공!`);
    } else {
      toast.error(res.message || "명단에 존재하지 않거나 핀코드가 올바르지 않습니다.");
    }
  };

  const handleGuestDemoLogin = async () => {
    toast.loading("가상 데모 스포츠 리그에 입장하는 중...", { id: "guest-loading" });
    const res = await onLogin("꿈나무 초등학교", "1234", "TEACHER");
    toast.dismiss("guest-loading");
    if (res.success) {
      toast.success("🎮 게스트 운영진 권한으로 체험을 시작합니다. 모든 기능을 마음껏 테스트해보세요!");
    } else {
      toast.error("데모 로그인 실패");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background neon elements */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.25)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-30" />
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-neon-blue/10 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-tier-diamond/10 blur-[130px] pointer-events-none" />

      <Card className="w-full max-w-lg border-border/60 bg-card/65 backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-[0_0_50px_rgba(0,180,216,0.06)] relative overflow-hidden animate-in zoom-in-95 duration-400">
        
        {/* Brand / Logo */}
        <div className="flex flex-col items-center text-center mb-6 shrink-0 relative z-10">
          <div className={cn(
            "flex size-12 items-center justify-center rounded-xl shadow-[0_0_20px_oklch(0.78_0.18_230/0.45)] mb-3 animate-pulse",
            isMasterMode 
              ? "bg-gradient-to-br from-amber-500 to-yellow-400" 
              : "bg-gradient-to-br from-neon-blue to-tier-diamond"
          )}>
            {isMasterMode ? (
              <ShieldCheck className="size-6 text-primary-foreground" />
            ) : (
              <Swords className="size-6 text-primary-foreground" />
            )}
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neon-blue">Club Sports League</p>
          <h2 className="text-xl md:text-2xl font-black tracking-tight mt-1 text-foreground">
            {isMasterMode 
              ? "👑 최고 관리자 제어 포털" 
              : isSignUpMode 
                ? "🏸 동호회 자율 회원가입" 
                : "스포츠 리그전 인증 포털"
            }
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {isMasterMode 
              ? "시스템 총괄 마스터 관리자 인증 정보를 입력하세요." 
              : isSignUpMode 
                ? "동호회 정보를 정확히 기재하여 신규 회원으로 등록하세요." 
                : "소속 동호회 인증을 거쳐 실시간 리그전 시스템에 접속하세요."
            }
          </p>
        </div>

        {/* 1. 교사/선수 접속 탭 분리 (마스터 모드가 아닐 때만 렌더링) */}
        {!isMasterMode && !isSignUpMode && (
          <div className="grid grid-cols-2 gap-2 bg-background/50 border border-border/40 p-1.5 rounded-xl mb-6 relative z-10">
            <button
              type="button"
              onClick={() => setActiveTab("STUDENT")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-[0.97] cursor-pointer",
                activeTab === "STUDENT"
                  ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-[0_0_12px_rgba(0,180,216,0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              <Users className="size-3.5" /> 선수 접속
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("TEACHER")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-[0.97] cursor-pointer",
                activeTab === "TEACHER"
                  ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-[0_0_12px_rgba(0,180,216,0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              <Building2 className="size-3.5" /> 운영진 접속
            </button>
          </div>
        )}

        {/* 2. Dynamic Login/Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          {/* A. SUPREME ADMIN MASTER MODE */}
          {isMasterMode ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">마스터 관리자 ID</Label>
                <Input
                  required
                  value={masterId}
                  onChange={(e) => setMasterId(e.target.value)}
                  placeholder="Master Admin ID"
                  className="h-10 border-border/60 bg-background/40 hover:border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">보안 비밀번호</Label>
                <Input
                  required
                  type="password"
                  value={masterPw}
                  onChange={(e) => setMasterPw(e.target.value)}
                  placeholder="보안 패스워드"
                  className="h-10 border-border/60 bg-background/40 hover:border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>
          ) : isSignUpMode ? (
            
            /* B. MEMBER SIGN UP FORM */
            <div className="space-y-3.5 animate-in fade-in duration-300">
              {/* Sign Up Club Name (Prefilled or Empty) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Building2 className="size-3.5 text-neon-blue" /> 소속 동호회 이름
                </Label>
                <Input
                  required
                  value={signUpClubName}
                  onChange={(e) => setSignUpClubName(e.target.value)}
                  placeholder="동호회 이름을 입력하세요 (예: 에이스 배드민턴 클럽)"
                  className="h-10 border-border/60 bg-background/40 focus:border-neon-blue transition-all"
                />
              </div>

              {/* Sign Up Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Users className="size-3.5 text-neon-blue" /> 이름 (본인 실명)
                </Label>
                <Input
                  required
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="선수 성함 입력 (예: 홍길동)"
                  className="h-10 border-border/60 bg-background/40 focus:border-neon-blue transition-all"
                />
              </div>

              {/* Sign Up Gender & Level */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">성별</Label>
                  <select
                    value={signUpGender}
                    onChange={(e) => setSignUpGender(e.target.value as "M" | "F")}
                    className="flex h-10 w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon-blue transition-all"
                  >
                    <option value="M">남성 (M)</option>
                    <option value="F">여성 (F)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">동호회 급수</Label>
                  <select
                    value={signUpLevel}
                    onChange={(e) => setSignUpLevel(e.target.value as any)}
                    className="flex h-10 w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon-blue transition-all"
                  >
                    <option value="A">A 급</option>
                    <option value="B">B 급</option>
                    <option value="C">C 급</option>
                    <option value="D">D 급</option>
                    <option value="초심">초심자</option>
                  </select>
                </div>
              </div>

              {/* Custom Pin Code & Join Auth Code */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Key className="size-3.5 text-neon-blue" /> 핀코드 (숫자 4자리)
                  </Label>
                  <Input
                    required
                    type="password"
                    maxLength={4}
                    value={signUpPin}
                    onChange={(e) => setSignUpPin(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="로그인용 비밀번호"
                    className="h-10 border-border/60 bg-background/40 focus:border-neon-blue transition-all tracking-widest text-center text-sm font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Sparkles className="size-3.5 text-neon-blue animate-pulse" /> 클럽 가입 인증 코드
                  </Label>
                  <Input
                    required
                    type="password"
                    value={signUpJoinCode}
                    onChange={(e) => setSignUpJoinCode(e.target.value)}
                    placeholder="운영진 공유 코드 입력"
                    className="h-10 border-border/60 bg-background/40 focus:border-neon-blue transition-all text-center text-xs"
                  />
                </div>
              </div>

              {/* Back to Login Toggle */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsSignUpMode(false)}
                  className="text-xs font-bold text-neon-blue hover:underline flex items-center gap-1 ml-auto cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" /> 이미 계정이 있나요? 로그인하기
                </button>
              </div>
            </div>
          ) : (
            
            /* C. STANDARD LOGIN FORM */
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Display Cached Club Name Badge if available, or ask for input */}
              {cachedClubName ? (
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-neon-blue bg-neon-blue/10 border border-neon-blue/20 px-3 py-1.5 rounded-lg w-fit mx-auto mb-4 animate-in zoom-in-95 duration-300">
                  <Globe className="size-3.5" /> 📍 {cachedClubName}
                </div>
              ) : (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <Label className="text-xs font-bold text-foreground">클럽 이름</Label>
                  <Input
                    required
                    value={activeTab === "TEACHER" ? adminClubName : loginClubInput}
                    onChange={(e) => {
                      if (activeTab === "TEACHER") {
                        setAdminClubName(e.target.value);
                      } else {
                        setLoginClubInput(e.target.value);
                      }
                    }}
                    placeholder="동호회 이름을 입력하세요"
                    className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                  />
                </div>
              )}

              {activeTab === "TEACHER" ? (
                /* TEACHER/ADMIN LOGIN FIELDS */
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  {cachedClubName && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">클럽 명칭 확인 (수정 가능)</Label>
                      <Input
                        required
                        value={adminClubName}
                        onChange={(e) => setAdminClubName(e.target.value)}
                        placeholder="동호회 이름"
                        className="h-10 border-border/60 bg-background/40 focus:border-neon-blue transition-all"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-bold text-foreground">운영진 인증코드</Label>
                    <Input
                      required
                      type="password"
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      placeholder="운영진 인증코드를 입력하세요 (예: 0000)"
                      className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                    />
                  </div>
                </div>
              ) : (
                /* STUDENT/PLAYER LOGIN FIELDS */
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  {cachedClubName && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">클럽 명칭 확인 (수정 가능)</Label>
                      <Input
                        required
                        value={loginClubInput}
                        onChange={(e) => setLoginClubInput(e.target.value)}
                        placeholder="동호회 이름"
                        className="h-10 border-border/60 bg-background/40 focus:border-neon-blue transition-all"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">선수 이름</Label>
                    <Input
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="등록된 본인 실명을 입력하세요"
                      className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">본인 확인용 핀코드 (PIN)</Label>
                    <Input
                      required
                      type="password"
                      maxLength={4}
                      value={playerPin}
                      onChange={(e) => setPlayerPin(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="핀코드 4자리를 입력하세요"
                      className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all tracking-widest text-center text-sm font-bold"
                    />
                  </div>
                  
                  {/* Signup toggle link */}
                  <div className="text-right pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSignUpMode(true)}
                      className="text-xs font-bold text-neon-blue hover:underline flex items-center gap-1 ml-auto cursor-pointer"
                    >
                      <UserPlus className="size-3.5" /> 처음이신가요? 클럽 회원가입
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Action Submit Button */}
          <Button
            type="submit"
            disabled={isSyncing}
            className={cn(
              "w-full h-11 text-primary-foreground font-black tracking-wider shadow-lg hover:opacity-95 active:scale-[0.99] transition-all mt-4 cursor-pointer",
              isMasterMode 
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 shadow-amber-500/10" 
                : "bg-gradient-to-r from-neon-blue to-tier-diamond hover:from-neon-blue hover:to-tier-diamond"
            )}
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                인증 확인 중...
              </span>
            ) : isMasterMode ? (
              <span className="flex items-center gap-1.5">
                <Lock className="size-4" /> 최고 권한 마스터 로그인
              </span>
            ) : isSignUpMode ? (
              <span className="flex items-center gap-1.5">
                <UserPlus className="size-4" /> 동호회 회원가입 완료
              </span>
            ) : activeTab === "TEACHER" ? (
              <span className="flex items-center gap-1.5">
                <Key className="size-4" /> 운영진 전용 리그 접속
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> 선수 전용 리그 접속
              </span>
            )}
          </Button>
        </form>

        {/* 3. 🎮 1-Click Guest Sandbox Demo Mode Button (일반 로그인 모드일 때만 노출) */}
        {!isMasterMode && !isSignUpMode && (
          <div className="mt-4 relative z-10 border-t border-border/30 pt-4">
            <Button
              type="button"
              onClick={handleGuestDemoLogin}
              className="w-full h-11 bg-background/80 hover:bg-neon-blue/10 text-neon-blue border border-neon-blue/50 font-black tracking-wide shadow-[0_0_15px_rgba(0,180,216,0.15)] active:scale-[0.98] transition-all gap-1.5 cursor-pointer"
            >
              <Gamepad2 className="size-4.5 animate-bounce" /> 🎮 로그인 없이 1초 만에 데모 구경하기
            </Button>
          </div>
        )}

        {/* 4. 👑 Supreme Admin Toggle Switcher */}
        <div className="mt-4 text-center relative z-10 border-t border-border/25 pt-4">
          <button
            type="button"
            onClick={() => {
              setIsMasterMode(!isMasterMode);
              setIsSignUpMode(false);
            }}
            className={cn(
              "text-xs font-bold hover:underline transition-colors cursor-pointer",
              isMasterMode 
                ? "text-muted-foreground hover:text-foreground" 
                : "text-amber-500 hover:text-amber-400"
            )}
          >
            {isMasterMode ? (
              <span className="flex items-center gap-1">
                🏫 일반 운영진/선수 로그인으로 돌아가기
              </span>
            ) : (
              <span className="flex items-center gap-1 justify-center">
                👑 최고 관리자(마스터) 로그인으로 전환
              </span>
            )}
          </button>
        </div>

      </Card>
    </div>
  );
}
