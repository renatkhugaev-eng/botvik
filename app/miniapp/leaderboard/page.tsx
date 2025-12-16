"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonLeaderboardEntry, SkeletonPodium } from "@/components/Skeleton";
import { usePerformance } from "@/lib/usePerformance";
import { api } from "@/lib/api";
import { useScrollPerfMode } from "@/components/hooks/useScrollPerfMode";
import { useDeviceTier } from "@/components/hooks/useDeviceTier";
import { usePerfMode } from "@/components/context/PerfModeContext";

// Detect iOS - iOS handles blur effects well, no need to disable during scroll
function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isIOS;
}

type LeaderboardEntry = {
  place: number;
  user: { id: number; username: string | null; firstName: string | null; photoUrl: string | null };
  score: number;
};

type WeeklyLeaderboardResponse = {
  week: {
    label: string;
    start: string;
    end: string;
    timeRemaining: number;
    isEnding: boolean;
  };
  leaderboard: LeaderboardEntry[];
  myPosition: { place: number; score: number; quizzes: number } | null;
  totalParticipants: number;
};

type QuizSummary = {
  id: number;
  title: string;
};

type TabMode = "weekly" | "alltime";

const spring = { type: "spring", stiffness: 400, damping: 30 };

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useMiniAppSession();
  const isIOS = useIsIOS();
  const { config } = useDeviceTier();
  const { setPerfMode } = usePerfMode();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useScrollPerfMode({ 
    target: scrollRef, 
    debounceMs: config.scrollDebounceMs 
  });
  
  // Sync scroll state to global perf mode
  useEffect(() => {
    setPerfMode(isScrolling);
  }, [isScrolling, setPerfMode]);
  
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizId, setQuizId] = useState<number | null>(null); // null = global
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSelect, setShowSelect] = useState(false);
  
  // Tab mode: "weekly" or "alltime"
  const [tabMode, setTabMode] = useState<TabMode>("weekly");
  
  // Weekly specific data
  const [weeklyInfo, setWeeklyInfo] = useState<{ label: string; timeRemaining: number; isEnding: boolean } | null>(null);
  const [weeklyMyPosition, setWeeklyMyPosition] = useState<{ place: number; score: number } | null>(null);

  // Current user ID
  const currentUserId = session.status === "ready" ? session.user.id : null;

  useEffect(() => {
    const initial = searchParams.get("quizId");
    if (initial) {
      setQuizId(Number(initial));
      setTabMode("alltime"); // If specific quiz, use alltime
    } else {
      setQuizId(null);
    }
  }, [searchParams]);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMIZED DATA LOADING - All requests in parallel for faster LCP
  // ═══════════════════════════════════════════════════════════════════════════
  
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userId = session.status === "ready" ? session.user.id : null;
      
      // Determine leaderboard URL based on mode
      const leaderboardUrl = tabMode === "weekly" && quizId === null
        ? userId ? `/api/leaderboard/weekly?userId=${userId}` : `/api/leaderboard/weekly`
        : quizId ? `/api/leaderboard?quizId=${quizId}` : `/api/leaderboard`;
      
      // 🚀 PARALLEL REQUESTS - Quizzes and leaderboard load simultaneously
      const [quizzesRes, leaderboardData] = await Promise.all([
        // 1. Quizzes list (for dropdown)
        fetch("/api/quiz").then(r => r.ok ? r.json() : []).catch(() => []),
        // 2. Leaderboard data
        tabMode === "weekly" && quizId === null
          ? api.get<WeeklyLeaderboardResponse>(leaderboardUrl)
          : fetch(leaderboardUrl).then(r => {
              if (!r.ok) throw new Error("leaderboard_load_error");
              return r.json();
            }),
      ]);
      
      // Process quizzes
      setQuizzes(quizzesRes as QuizSummary[]);
      
      // Process leaderboard
      if (tabMode === "weekly" && quizId === null) {
        const weeklyData = leaderboardData as WeeklyLeaderboardResponse;
        setEntries(weeklyData.leaderboard);
        setWeeklyInfo({
          label: weeklyData.week.label,
          timeRemaining: weeklyData.week.timeRemaining,
          isEnding: weeklyData.week.isEnding,
        });
        if (weeklyData.myPosition) {
          setWeeklyMyPosition({ place: weeklyData.myPosition.place, score: weeklyData.myPosition.score });
        } else {
          setWeeklyMyPosition(null);
        }
      } else {
        setEntries(leaderboardData as LeaderboardEntry[]);
        setWeeklyInfo(null);
        setWeeklyMyPosition(null);
      }
    } catch (err) {
      console.error("Failed to load leaderboard", err);
      setError("Не удалось загрузить лидерборд");
    } finally {
      setLoading(false);
    }
  }, [quizId, tabMode, session.status, session.status === "ready" ? session.user.id : null]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const currentQuiz = useMemo(() => {
    if (quizId === null) return null;
    return quizzes.find((q) => q.id === quizId);
  }, [quizId, quizzes]);

  // Find current user's position (for alltime mode)
  const myPosition = useMemo(() => {
    if (tabMode === "weekly" && weeklyMyPosition) {
      return { place: weeklyMyPosition.place, score: weeklyMyPosition.score, user: { id: currentUserId } } as LeaderboardEntry;
    }
    if (!currentUserId) return null;
    return entries.find((e) => e.user.id === currentUserId);
  }, [entries, currentUserId, tabMode, weeklyMyPosition]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const leaderScore = entries[0]?.score ?? 0;

  // Pull to refresh handler - reuses optimized fetch
  const handleRefresh = useCallback(async () => {
    await fetchAllData();
  }, [fetchAllData]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return "Завершено";
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  // Get gradient for position
  const getPositionGradient = (place: number) => {
    if (place <= 10) return "from-violet-600 to-indigo-600";
    if (place <= 20) return "from-indigo-500 to-blue-500";
    if (place <= 30) return "from-blue-500 to-cyan-500";
    return "from-slate-500 to-slate-600";
  };

  return (
    <PullToRefresh 
      onRefresh={handleRefresh} 
      scrollRef={scrollRef}
    >
    <div className={`relative flex flex-col gap-5 pb-10 w-full overflow-x-hidden ${isScrolling && !isIOS ? "perf" : ""}`}>
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.header 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative z-20 flex items-center justify-between py-3"
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/5"
          aria-label="Назад"
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2 rounded-full bg-[#0a0a0f] px-4 py-2 shadow-lg"
        >
          <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-[14px] font-semibold text-white/90">Лидерборд</span>
        </motion.div>
        
        <div className="w-11" />
      </motion.header>

      {/* ═══════════════════════════════════════════════════════════════════
          TABS: WEEKLY / ALL TIME
      ═══════════════════════════════════════════════════════════════════ */}
      {quizId === null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 p-1 rounded-2xl bg-slate-100"
        >
          <button
            onClick={() => {
              haptic.selection();
              setTabMode("weekly");
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-[13px] font-bold transition-all ${
              tabMode === "weekly"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              🏆 Неделя
              {weeklyInfo?.isEnding && tabMode === "weekly" && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                  СКОРО
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => {
              haptic.selection();
              setTabMode("alltime");
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-[13px] font-bold transition-all ${
              tabMode === "alltime"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🌍 Всё время
          </button>
        </motion.div>
      )}

      {/* Weekly info banner */}
      {tabMode === "weekly" && weeklyInfo && quizId === null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-2xl p-3 ${
            weeklyInfo.isEnding 
              ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30" 
              : "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <div>
                <p className="text-[11px] font-medium text-slate-500">{weeklyInfo.label}</p>
                <p className={`text-[14px] font-bold ${weeklyInfo.isEnding ? "text-red-600" : "text-slate-700"}`}>
                  До сброса: {formatTimeRemaining(weeklyInfo.timeRemaining)}
                </p>
              </div>
            </div>
            {weeklyInfo.isEnding && (
              <span className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                🔥 ФИНИШ
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MY POSITION CARD (if user is in leaderboard)
      ═══════════════════════════════════════════════════════════════════ */}
      {myPosition && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-4"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-[18px] font-black text-white">
                {myPosition.place}
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white/60">Твоя позиция</p>
                <p className="text-[16px] font-bold text-white">
                  {myPosition.user.firstName ?? myPosition.user.username ?? "Ты"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[28px] font-black text-white tabular-nums">{myPosition.score}</p>
              {myPosition.place > 1 && (
                <p className="text-[11px] text-white/60">
                  -{leaderScore - myPosition.score} до лидера
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          QUIZ SELECTOR (only for alltime mode or when quiz is selected)
      ═══════════════════════════════════════════════════════════════════ */}
      {(tabMode === "alltime" || quizId !== null) && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            haptic.medium();
            setShowSelect(true);
          }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full glow-violet opacity-70" />
          <div className="relative flex items-center justify-between">
            <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">Рейтинг</p>
            <p className="text-[16px] font-bold text-white">
              {quizId === null ? "🌍 Общий рейтинг" : currentQuiz?.title ?? "Выбрать"}
            </p>
            </div>
            <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-white/40">{entries.length} игроков</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <svg className="h-5 w-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                </svg>
              </div>
            </div>
          </div>
        </motion.button>
      )}

      {/* Quiz selector modal */}
      <AnimatePresence>
        {showSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            onClick={() => setShowSelect(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-[#0a0a0f] p-6"
            >
              <div className="mb-1 flex justify-center">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <div className="mb-4 flex items-center justify-between mt-4">
                <h3 className="text-[17px] font-bold text-white">Выберите викторину</h3>
                <button
                  onClick={() => {
                    haptic.light();
                    setShowSelect(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                >
                  <svg className="h-4 w-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide">
                {/* Global leaderboard option */}
                <button
                  onClick={() => {
                    haptic.selection();
                    setQuizId(null);
                    setShowSelect(false);
                  }}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all ${
                    quizId === null 
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25" 
                      : "bg-white/5 text-white/80 active:bg-white/10"
                  }`}
                >
                  <span className="text-[14px] font-semibold">🌍 Общий рейтинг</span>
                  {quizId === null && (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
                
                {/* Per-quiz options */}
                {quizzes.map((quiz) => (
                  <button
                    key={quiz.id}
                    onClick={() => {
                      haptic.selection();
                      setQuizId(quiz.id);
                      setShowSelect(false);
                    }}
                    className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all ${
                      quizId === quiz.id 
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25" 
                        : "bg-white/5 text-white/80 active:bg-white/10"
                    }`}
                  >
                    <span className="text-[14px] font-semibold">{quiz.title}</span>
                    {quizId === quiz.id && (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      {error ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="text-6xl mb-4 animate-bounce">😔</div>
          <p className="text-[16px] font-bold text-slate-700">{error}</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              haptic.light();
              router.back();
            }}
            className="mt-6 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] px-6 py-3 text-[14px] font-semibold text-white shadow-lg"
          >
            ← Назад
          </motion.button>
        </motion.div>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          {/* Skeleton Podium */}
          <SkeletonPodium />
          {/* Skeleton List */}
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonLeaderboardEntry key={i} index={i} />
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <span className="text-6xl mb-4">📊</span>
          <p className="text-[16px] font-bold text-[#1a1a2e]">Пока нет результатов</p>
          <p className="text-[14px] text-slate-400 mt-1">Будь первым!</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              haptic.heavy();
              router.push("/miniapp");
            }}
            className="mt-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-violet-500/25"
          >
            Играть →
          </motion.button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* ═══════════════════════════════════════════════════════════════════
              TOP 3 PODIUM
          ═══════════════════════════════════════════════════════════════════ */}
          {top3.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-[24px] bg-[#0a0a0f]"
              style={{ contain: 'layout' }}
            >
              {/* Conic gradient border */}
              <div className="absolute -inset-[1px] rounded-[24px] bg-[conic-gradient(from_0deg,#8b5cf6,#d946ef,#06b6d4,#8b5cf6)] opacity-40 animate-spin-slow" />
              
              {/* Inner card */}
              <div className="relative m-[1px] rounded-[23px] bg-[#0a0a0f] overflow-hidden">
                {/* Gradient orbs - GPU optimized */}
                <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full glow-violet" />
                <div className="absolute -right-20 -bottom-20 h-48 w-48 rounded-full glow-violet opacity-60" />
                
                <div className="relative p-5">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-4xl">🏆</span>
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/50">
                      {tabMode === "weekly" && quizId === null ? "Топ недели" : "Топ игроки"}
                    </h3>
                  </div>
                  
                  {/* Podium */}
                  <div className="flex items-end justify-center gap-2 sm:gap-4">
                    {/* 2nd place */}
                    {top3[1] && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className={`flex flex-col items-center w-[80px] ${top3[1].user.id === currentUserId ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0a0a0f] rounded-2xl p-1" : ""}`}
                      >
                        <div className="relative mb-2">
                          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-slate-400 to-slate-300 opacity-30" />
                          {top3[1].user.photoUrl ? (
                            <img src={top3[1].user.photoUrl} alt="" width={48} height={48} className="relative h-12 w-12 rounded-full object-cover ring-2 ring-white/10" style={{ aspectRatio: '1/1' }} />
                          ) : (
                            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 ring-2 ring-white/10">
                              <span className="text-base font-black text-white">
                                {(top3[1].user.firstName ?? top3[1].user.username ?? "?")[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          {top3[1].user.id === currentUserId && (
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center">
                              <span className="text-[8px] text-white">ТЫ</span>
                            </div>
                          )}
                        </div>
                        <span className="text-3xl mb-1">🥈</span>
                        <p className="text-[11px] font-semibold text-white/70 truncate w-full text-center">
                          {top3[1].user.id === currentUserId ? "Ты" : (top3[1].user.username ?? top3[1].user.firstName ?? "Игрок")}
                        </p>
                        <p className="text-[15px] font-black text-white">{top3[1].score}</p>
                        <div className="mt-2 h-14 w-full rounded-t-lg bg-gradient-to-t from-slate-700 to-slate-600" />
                      </motion.div>
                    )}
                    
                    {/* 1st place */}
                    {top3[0] && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`flex flex-col items-center w-[90px] -mt-4 ${top3[0].user.id === currentUserId ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0a0a0f] rounded-2xl p-1" : ""}`}
                      >
                        <div className="relative mb-2">
                          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 opacity-40 animate-pulse gpu-accelerated" />
                          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 animate-spin-slow" />
                          {top3[0].user.photoUrl ? (
                            <img src={top3[0].user.photoUrl} alt="" width={64} height={64} className="relative h-16 w-16 rounded-full object-cover ring-2 ring-white/20" style={{ aspectRatio: '1/1' }} />
                          ) : (
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 ring-2 ring-white/20">
                              <span className="text-xl font-black text-white">
                                {(top3[0].user.firstName ?? top3[0].user.username ?? "?")[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          {top3[0].user.id === currentUserId && (
                            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center ring-2 ring-[#0a0a0f]">
                              <span className="text-[8px] font-bold text-white">ТЫ</span>
                            </div>
                          )}
                        </div>
                        <span className="text-4xl mb-1">🥇</span>
                        <p className="text-[12px] font-bold text-white truncate w-full text-center">
                          {top3[0].user.id === currentUserId ? "Ты" : (top3[0].user.username ?? top3[0].user.firstName ?? "Игрок")}
                        </p>
                        <p className="text-[18px] font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                          {top3[0].score}
                        </p>
                        <div className="mt-2 h-20 w-full rounded-t-lg bg-gradient-to-t from-violet-800 to-violet-700 shadow-lg shadow-violet-500/20" />
                      </motion.div>
                    )}
                    
                    {/* 3rd place */}
                    {top3[2] && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={`flex flex-col items-center w-[75px] ${top3[2].user.id === currentUserId ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0a0a0f] rounded-2xl p-1" : ""}`}
                      >
                        <div className="relative mb-2">
                          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 opacity-30" />
                          {top3[2].user.photoUrl ? (
                            <img src={top3[2].user.photoUrl} alt="" width={40} height={40} className="relative h-10 w-10 rounded-full object-cover ring-2 ring-white/10" style={{ aspectRatio: '1/1' }} />
                          ) : (
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-white/10">
                              <span className="text-sm font-black text-white">
                                {(top3[2].user.firstName ?? top3[2].user.username ?? "?")[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          {top3[2].user.id === currentUserId && (
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center">
                              <span className="text-[8px] text-white">ТЫ</span>
                            </div>
                          )}
                        </div>
                        <span className="text-2xl mb-1 opacity-80">🥉</span>
                        <p className="text-[10px] font-semibold text-white/60 truncate w-full text-center">
                          {top3[2].user.id === currentUserId ? "Ты" : (top3[2].user.username ?? top3[2].user.firstName ?? "Игрок")}
                        </p>
                        <p className="text-[14px] font-black text-white">{top3[2].score}</p>
                        <div className="mt-2 h-10 w-full rounded-t-lg bg-gradient-to-t from-amber-800 to-amber-700" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              REST OF LEADERBOARD (4-50)
          ═══════════════════════════════════════════════════════════════════ */}
          {rest.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-white shadow-xl shadow-black/5 overflow-hidden"
              style={{ contain: 'layout' }}
            >
              <div className="sticky top-0 z-10 bg-white/98 px-4 py-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-[#1a1a2e]">Все участники</h3>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    4-{entries.length} место
                  </span>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto scrollbar-hide divide-y divide-slate-50">
                {rest.map((entry, i) => {
                  const name = entry.user.username ?? entry.user.firstName ?? `Игрок`;
                  const isMe = entry.user.id === currentUserId;
                  const diffFromLeader = leaderScore - entry.score;
                  
                  return (
                    <motion.div
                      key={`${entry.place}-${entry.user.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(0.35 + i * 0.02, 0.8), ...spring }}
                      className={`flex items-center justify-between px-4 py-3 ${isMe ? "bg-violet-50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Position */}
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                          entry.place <= 10 ? "bg-violet-100 text-violet-600" :
                          entry.place <= 20 ? "bg-indigo-50 text-indigo-500" :
                          entry.place <= 30 ? "bg-blue-50 text-blue-500" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {entry.place}
                        </div>
                        
                        {/* Avatar */}
                        <div className="relative">
                          {entry.user.photoUrl ? (
                            <img src={entry.user.photoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" style={{ aspectRatio: '1/1' }} />
                          ) : (
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${getPositionGradient(entry.place)} text-[12px] font-bold text-white`}>
                              {name[0].toUpperCase()}
                            </div>
                          )}
                          {isMe && (
                            <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-violet-500 flex items-center justify-center ring-2 ring-white">
                              <span className="text-[6px] font-bold text-white">ТЫ</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Name */}
                        <div>
                          <span className={`text-[14px] font-semibold ${isMe ? "text-violet-700" : "text-[#1a1a2e]"}`}>
                            {isMe ? "Ты" : name}
                          </span>
                          {entry.place <= 10 && (
                            <span className="ml-2 text-[10px] font-semibold text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded-full">
                              TOP 10
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Score */}
                      <div className="text-right">
                        <span className={`text-[16px] font-bold tabular-nums ${isMe ? "text-violet-700" : "text-[#1a1a2e]"}`}>
                          {entry.score}
                        </span>
                        {diffFromLeader > 0 && (
                          <p className="text-[10px] text-slate-400">-{diffFromLeader}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Stats summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { label: "Участников", value: entries.length, icon: "👥", img: null },
              { label: "Лучший счёт", value: leaderScore, icon: "💎", img: null },
              { label: "Средний счёт", value: entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : 0, icon: "📊", img: null },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white p-3 shadow-lg shadow-black/5 text-center">
                {stat.img ? (
                  <img src={stat.img} alt="" width={40} height={40} className="h-10 w-10 object-contain mx-auto" style={{ aspectRatio: '1/1' }} />
                ) : (
                  <span className="text-3xl">{stat.icon}</span>
                )}
                <p className="text-[18px] font-bold text-[#1a1a2e] mt-1 tabular-nums">{stat.value}</p>
                <p className="text-[10px] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              haptic.heavy();
              router.push("/miniapp");
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[15px] font-bold text-white shadow-lg shadow-violet-500/25"
          >
            🎮 Играй и поднимайся в топ
          </motion.button>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
