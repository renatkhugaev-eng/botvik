"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonLeaderboardEntry, SkeletonPodium } from "@/components/Skeleton";
import { usePerformance } from "@/lib/usePerformance";

type LeaderboardEntry = {
  place: number;
  user: { id: number; username: string | null; firstName: string | null; photoUrl: string | null };
  score: number;
};

type QuizSummary = {
  id: number;
  title: string;
};

const spring = { type: "spring", stiffness: 400, damping: 30 };

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useMiniAppSession();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizId, setQuizId] = useState<number | null>(null); // null = global
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSelect, setShowSelect] = useState(false);

  // Current user ID
  const currentUserId = session.status === "ready" ? session.user.id : null;

  useEffect(() => {
    const initial = searchParams.get("quizId");
    if (initial) {
      setQuizId(Number(initial));
    }
    // If no quizId in URL, keep null for global leaderboard
  }, [searchParams]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const res = await fetch("/api/quiz");
        if (!res.ok) throw new Error("quiz_load_error");
        const data = (await res.json()) as QuizSummary[];
        setQuizzes(data);
      } catch (err) {
        console.error("Failed to load quizzes", err);
      }
    };

    fetchQuizzes();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        // If quizId is null, fetch global leaderboard
        const url = quizId ? `/api/leaderboard?quizId=${quizId}` : `/api/leaderboard`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("leaderboard_load_error");
        }
        const data = (await res.json()) as LeaderboardEntry[];
        setEntries(data);
      } catch (err) {
        console.error("Failed to load leaderboard", err);
        setError("Не удалось загрузить лидерборд");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [quizId]);

  const currentQuiz = useMemo(() => {
    if (quizId === null) return null; // Global
    return quizzes.find((q) => q.id === quizId);
  }, [quizId, quizzes]);

  // Find current user's position
  const myPosition = useMemo(() => {
    if (!currentUserId) return null;
    return entries.find((e) => e.user.id === currentUserId);
  }, [entries, currentUserId]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const leaderScore = entries[0]?.score ?? 0;

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = quizId ? `/api/leaderboard?quizId=${quizId}` : `/api/leaderboard`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as LeaderboardEntry[];
        setEntries(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  // Get gradient for position
  const getPositionGradient = (place: number) => {
    if (place <= 10) return "from-violet-600 to-indigo-600";
    if (place <= 20) return "from-indigo-500 to-blue-500";
    if (place <= 30) return "from-blue-500 to-cyan-500";
    return "from-slate-500 to-slate-600";
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 pb-10 w-full overflow-x-hidden">
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
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                #{myPosition.place}
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
          QUIZ SELECTOR
      ═══════════════════════════════════════════════════════════════════ */}
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
          <img src="/icons/22.PNG" alt="" className="h-20 w-20 object-contain mb-4" />
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
            >
              {/* Conic gradient border */}
              <div className="absolute -inset-[1px] rounded-[24px] bg-[conic-gradient(from_0deg,#8b5cf6,#d946ef,#06b6d4,#8b5cf6)] opacity-40 animate-spin-slow" />
              
              {/* Inner card */}
              <div className="relative m-[1px] rounded-[23px] bg-[#0a0a0f] overflow-hidden">
                {/* Gradient orbs - GPU optimized */}
                <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full glow-violet" />
                <div className="absolute -right-20 -bottom-20 h-48 w-48 rounded-full glow-violet opacity-60" />
                
                {/* Floating particles */}
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full bg-white/50 animate-float"
                    style={{
                      width: 2 + (i % 3),
                      height: 2 + (i % 3),
                      left: `${10 + i * 15}%`,
                      top: `${30 + (i % 3) * 20}%`,
                      animationDelay: `${i * 0.5}s`,
                      animationDuration: `${3 + i * 0.4}s`,
                    }}
                  />
                ))}
                
                <div className="relative p-5">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <img src="/icons/54.PNG" alt="" className="h-12 w-12 object-contain" />
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/50">
                      Топ игроки
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
                            <img src={top3[1].user.photoUrl} alt="" className="relative h-12 w-12 rounded-full object-cover ring-2 ring-white/10" />
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
                        <img src="/icons/medal.png" alt="2" className="h-10 w-10 object-contain mb-1" />
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
                            <img src={top3[0].user.photoUrl} alt="" className="relative h-16 w-16 rounded-full object-cover ring-2 ring-white/20" />
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
                        <img src="/icons/fire-medal.png" alt="1" className="h-12 w-12 object-contain mb-1" />
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
                            <img src={top3[2].user.photoUrl} alt="" className="relative h-10 w-10 rounded-full object-cover ring-2 ring-white/10" />
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
                        <img src="/icons/medal.png" alt="3" className="h-9 w-9 object-contain mb-1 opacity-80" />
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
                            <img src={entry.user.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
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
              { label: "Участников", value: entries.length, icon: null, img: "/icons/41.PNG" },
              { label: "Лучший счёт", value: leaderScore, icon: null, img: "/icons/7.PNG" },
              { label: "Средний счёт", value: entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : 0, icon: null, img: "/icons/22.PNG" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white p-3 shadow-lg shadow-black/5 text-center">
                {stat.img ? (
                  <img src={stat.img} alt="" className="h-10 w-10 object-contain mx-auto" />
                ) : (
                  <span className="text-lg">{stat.icon}</span>
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
