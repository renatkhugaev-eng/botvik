"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "./layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonQuizCard, SkeletonProfileHeader } from "@/components/Skeleton";

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM
   Base unit: 4px
   Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48
   Border radius: 8, 12, 16, 20
═══════════════════════════════════════════════════════════════════════════ */

type Tab = "participant" | "creator";

type LimitInfo = {
  usedAttempts: number;
  maxAttempts: number;
  remaining: number;
  rateLimitWaitSeconds: number | null;
  energyWaitMs: number | null;
  nextSlotAt: string | null;
  hasUnfinishedSession: boolean;
  hoursPerAttempt: number;
};

type QuizSummary = {
  id: number;
  title: string;
  description: string | null;
  prizeTitle: string;
  limitInfo?: LimitInfo;
};

type UserStats = {
  totalQuizzesPlayed: number;
  totalScore: number;
};

type LeaderboardPosition = {
  place: number;
  score: number;
  totalPlayers: number;
  topScore: number;
};

// Animations
const spring = { type: "spring", stiffness: 400, damping: 30 };

// Premium Dark Palette — Netflix/HBO Crime aesthetic
const palette = [
  { bg: "from-[#1a1a2e] to-[#16213e]", text: "text-indigo-400", icon: "🔍" },
  { bg: "from-[#2d132c] to-[#1a1a2e]", text: "text-rose-400", icon: "🎭" },
  { bg: "from-[#1f1f1f] to-[#121212]", text: "text-amber-400", icon: "⚡" },
  { bg: "from-[#1e3a5f] to-[#0d1b2a]", text: "text-cyan-400", icon: "🧊" },
  { bg: "from-[#2c1810] to-[#1a0f0a]", text: "text-orange-400", icon: "🔥" },
];

// Канал для подписки
const CHANNEL_USERNAME = "dark_bookshelf";
const CHANNEL_URL = "https://t.me/dark_bookshelf";

export default function MiniAppPage() {
  const session = useMiniAppSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("participant");
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  
  // Rate limit countdown timers (per quiz)
  const [countdowns, setCountdowns] = useState<Record<number, number>>({});
  
  // Subscription check
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  
  // Leaderboard position
  const [myPosition, setMyPosition] = useState<LeaderboardPosition | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (session.status !== "ready") return;
    
    setLoading(true);
    setError(null);
    try {
      // Передаём userId для получения информации о лимитах
      const quizzesRes = await fetch(`/api/quiz?userId=${session.user.id}`);
      const quizzesData = await quizzesRes.json() as QuizSummary[];
      setQuizzes(quizzesData);
      
      // Инициализируем countdowns из серверных данных
      const newCountdowns: Record<number, number> = {};
      for (const quiz of quizzesData) {
        if (quiz.limitInfo) {
          if (quiz.limitInfo.rateLimitWaitSeconds && quiz.limitInfo.rateLimitWaitSeconds > 0) {
            // Rate limit — секунды
            newCountdowns[quiz.id] = quiz.limitInfo.rateLimitWaitSeconds;
          } else if (quiz.limitInfo.energyWaitMs && quiz.limitInfo.energyWaitMs > 0) {
            // Energy limit — миллисекунды в секунды
            newCountdowns[quiz.id] = Math.ceil(quiz.limitInfo.energyWaitMs / 1000);
          }
        }
      }
      setCountdowns(newCountdowns);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await fetchData();
    if (session.status === "ready") {
      // Also refresh user stats
      try {
        const statsRes = await fetch(`/api/me/summary?userId=${session.user.id}`);
        const data = await statsRes.json();
        setUserStats({
          totalQuizzesPlayed: data.stats?.totalQuizzesPlayed ?? 0,
          totalScore: data.stats?.totalScore ?? 0,
        });
      } catch {
        // Ignore
      }
    }
  }, [fetchData, session]);

  // Fetch user stats
  useEffect(() => {
    if (session.status !== "ready") return;
    fetch(`/api/me/summary?userId=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setUserStats({
          totalQuizzesPlayed: data.stats?.totalQuizzesPlayed ?? 0,
          totalScore: data.stats?.totalScore ?? 0,
        });
      })
      .catch(() => {
        setUserStats({ totalQuizzesPlayed: 0, totalScore: 0 });
      });
  }, [session]);

  // Fetch leaderboard position
  useEffect(() => {
    if (session.status !== "ready" || quizzes.length === 0) return;
    
    // Get first quiz leaderboard
    const firstQuizId = quizzes[0]?.id;
    if (!firstQuizId) return;
    
    fetch(`/api/leaderboard?quizId=${firstQuizId}`)
      .then((r) => r.json())
      .then((entries: { place: number; user: { id: number }; score: number }[]) => {
        const myEntry = entries.find((e) => e.user.id === session.user.id);
        if (myEntry) {
          setMyPosition({
            place: myEntry.place,
            score: myEntry.score,
            totalPlayers: entries.length,
            topScore: entries[0]?.score ?? 0,
          });
        } else if (entries.length > 0) {
          // User not in leaderboard yet
          setMyPosition({
            place: 0,
            score: 0,
            totalPlayers: entries.length,
            topScore: entries[0]?.score ?? 0,
          });
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, [session, quizzes]);

  // Check channel subscription
  const checkSubscription = useCallback(async () => {
    if (session.status !== "ready") return false;
    
    setCheckingSubscription(true);
    try {
      const res = await fetch("/api/check-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUserId: session.user.telegramId }),
      });
      const data = await res.json();
      setIsSubscribed(data.subscribed);
      return data.subscribed;
    } catch {
      console.error("Failed to check subscription");
      return false;
    } finally {
      setCheckingSubscription(false);
    }
  }, [session]);

  // Check subscription on load
  useEffect(() => {
    if (session.status === "ready") {
      checkSubscription();
    }
  }, [session, checkSubscription]);

  // Countdown timers for all quizzes
  useEffect(() => {
    const hasActiveCountdowns = Object.values(countdowns).some(v => v > 0);
    if (!hasActiveCountdowns) return;
    
    const timer = setInterval(() => {
      setCountdowns((prev) => {
        const updated: Record<number, number> = {};
        let hasChanges = false;
        
        for (const [quizId, seconds] of Object.entries(prev)) {
          const id = Number(quizId);
          if (seconds > 1) {
            updated[id] = seconds - 1;
            hasChanges = true;
          } else if (seconds === 1) {
            // Countdown finished, remove from map
            hasChanges = true;
          } else {
            updated[id] = seconds;
          }
        }
        
        return hasChanges ? updated : prev;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdowns]);

  const handleStart = useCallback(
    async (id: number) => {
      if (session.status !== "ready") return;
      
      // Check subscription before starting
      const subscribed = await checkSubscription();
      if (!subscribed) {
        setShowSubscribeModal(true);
        return;
      }
      
      setStartError(null);
      setStartingId(id);
      try {
        const res = await fetch(`/api/quiz/${id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        });
        
        // Обработка rate limiting
        if (res.status === 429) {
          const data = await res.json();
          if (data.error === "rate_limited" && data.waitSeconds) {
            // Rate limit — добавляем countdown для этого квиза
            setCountdowns(prev => ({ ...prev, [id]: data.waitSeconds }));
          } else if (data.error === "energy_depleted" && data.waitMs) {
            // Energy depleted — добавляем countdown для этого квиза
            setCountdowns(prev => ({ ...prev, [id]: Math.ceil(data.waitMs / 1000) }));
          }
          haptic.warning();
          return;
        }
        
        if (!res.ok) throw new Error();
        const { sessionId } = await res.json();
        router.push(`/miniapp/quiz/${id}?sessionId=${sessionId}`);
      } catch {
        setStartError("Не удалось начать");
      } finally {
        setStartingId(null);
      }
    },
    [router, session, checkSubscription],
  );

  // Loading state
  if (session.status === "loading") {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-indigo-600"
        />
      </div>
    );
  }

  // Error state
  if (session.status === "error") {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center text-center">
        <div className="text-5xl">😔</div>
        <p className="mt-4 text-[17px] font-semibold text-[#1a1a2e]">Ошибка</p>
        <p className="mt-1 text-[15px] text-[#64748b]">Откройте из Telegram</p>
      </div>
    );
  }

  const name = session.user.firstName ?? session.user.username ?? "друг";
  const photoUrl = session.user.photoUrl;
  const avatarLetter = name.slice(0, 1).toUpperCase();

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-6 w-full overflow-x-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Height: 48px
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="flex h-12 items-center justify-between">
        {/* Back — 40x40 */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            haptic.light();
            router.push("/");
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#64748b] shadow-sm"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>

        {/* Tabs — Height: 36px */}
        <div className="flex h-9 items-center rounded-xl bg-[#1a1a2e] p-1">
          {(["participant", "creator"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                haptic.selection();
                setTab(t);
              }}
              className={`relative h-7 rounded-lg px-4 text-[13px] font-semibold transition-colors ${
                tab === t ? "text-white" : "text-zinc-400"
              }`}
            >
              {tab === t && (
                <motion.div
                  layoutId="tab"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600"
                  transition={spring}
                />
              )}
              <span className="relative">{t === "participant" ? "Играть" : "Создать"}</span>
            </button>
          ))}
        </div>

        {/* Profile Button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            haptic.medium();
            router.push("/miniapp/profile");
          }}
          className="relative flex items-center gap-2 rounded-full bg-[#0a0a0f] pl-1 pr-3 py-1 shadow-lg"
        >
          {/* Avatar with glow ring */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 opacity-60 animate-spin-slow" />
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={name}
                className="relative h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600">
                <span className="text-[12px] font-bold text-white">{avatarLetter}</span>
              </div>
            )}
          </div>
          {/* Label */}
          <span className="text-[12px] font-semibold text-white/80">Профиль</span>
        </motion.button>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Minimal Aesthetic
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.section 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative py-2"
      >
        <div className="flex items-center gap-4">
          {/* Avatar with ring */}
          <div className="relative flex-shrink-0">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-rose-500 via-violet-500 to-indigo-500 opacity-75 animate-spin-slow" />
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={name}
                className="relative h-14 w-14 rounded-full object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d] ring-2 ring-white/10">
                <span className="text-lg font-semibold text-white">{avatarLetter}</span>
              </div>
            )}
          </div>
          
          {/* Text */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[24px] font-semibold tracking-tight text-[#1a1a2e]">
                {name}
              </h1>
              <div className="flex h-5 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">онлайн</span>
              </div>
            </div>
            <p className="text-[13px] text-slate-500">Раскрой тёмные тайны</p>
          </div>
          
          {/* Stats */}
          <div className="flex gap-3">
            <div className="text-center">
              <p className="font-display text-[18px] font-bold text-[#1a1a2e]">
                {userStats?.totalQuizzesPlayed ?? 0}
              </p>
              <p className="text-[10px] text-slate-400">игр</p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <img src="/icons/coin.png" alt="" className="h-10 w-10 object-contain" />
                <p className="font-display text-[18px] font-bold text-[#1a1a2e]">
                  {userStats?.totalScore ?? 0}
                </p>
              </div>
              <p className="text-[10px] text-slate-400">очков</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════
          CHANNEL PROMO — Premium 2025
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
      >
        <a
          href="https://t.me/dark_bookshelf"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex h-12 items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] px-3 shadow-lg shadow-black/10"
        >
          {/* Animated shine */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
          />
          
          {/* Telegram icon */}
          <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2AABEE] to-[#229ED9]">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </div>
          
          {/* Text */}
          <div className="relative flex-1 min-w-0">
            <p className="font-display text-[13px] font-semibold text-white">Чернила и Кровь</p>
            <p className="text-[11px] text-white/60">Подпишись для участия</p>
          </div>
          
          {/* Badge */}
          <div className="relative flex h-7 items-center gap-1 rounded-lg bg-white/15 px-2.5 backdrop-blur-sm transition-colors group-hover:bg-white/25">
            <span className="text-[11px] font-semibold text-white">Открыть</span>
            <motion.svg 
              animate={{ x: [0, 2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-3 w-3 text-white/70" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </motion.svg>
          </div>
        </a>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          YOUR LEADERBOARD POSITION
      ═══════════════════════════════════════════════════════════════════ */}
      {myPosition && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            haptic.medium();
            router.push("/miniapp/leaderboard");
          }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4 w-full"
        >
          {/* Glow effects */}
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-600/20 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-indigo-600/15 blur-xl" />
          
          {/* Content */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Position badge */}
              <div className="relative">
                {myPosition.place > 0 && myPosition.place <= 3 && (
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 opacity-60 blur-sm animate-pulse" />
                )}
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-full ${
                  myPosition.place === 0 
                    ? "bg-white/10 text-white/50" 
                    : myPosition.place <= 3 
                      ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white" 
                      : myPosition.place <= 10 
                        ? "bg-violet-500/20 text-violet-400"
                        : "bg-white/10 text-white/70"
                }`}>
                  {myPosition.place === 0 ? (
                    <span className="text-lg">—</span>
                  ) : myPosition.place === 1 ? (
                    <span className="text-xl">🥇</span>
                  ) : myPosition.place === 2 ? (
                    <span className="text-xl">🥈</span>
                  ) : myPosition.place === 3 ? (
                    <span className="text-xl">🥉</span>
                  ) : (
                    <span className="text-[16px] font-black">#{myPosition.place}</span>
                  )}
                </div>
              </div>
              
              {/* Text */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Твоя позиция</p>
                <p className="text-[16px] font-bold text-white">
                  {myPosition.place === 0 
                    ? "Ещё не в топе" 
                    : myPosition.place <= 3 
                      ? "В топ-3! 🔥" 
                      : myPosition.place <= 10 
                        ? "В топ-10!" 
                        : `${myPosition.place} из ${myPosition.totalPlayers}`
                  }
                </p>
              </div>
            </div>
            
            {/* Score & Arrow */}
            <div className="flex items-center gap-3">
              {myPosition.place > 0 && (
                <div className="text-right">
                  <p className="font-display text-[20px] font-bold text-white">{myPosition.score}</p>
                  {myPosition.place > 1 && (
                    <p className="text-[10px] text-white/40">-{myPosition.topScore - myPosition.score} до топ-1</p>
                  )}
                </div>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <svg className="h-4 w-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </div>
        </motion.button>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {tab === "creator" ? (
          <motion.div
            key="c"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={spring}
          >
            <CreatorView />
          </motion.div>
        ) : (
          <motion.div
            key="p"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={spring}
          >
            <QuizView
              quizzes={quizzes}
              loading={loading}
              error={error}
              startingId={startingId}
              startError={startError}
              countdowns={countdowns}
              onStart={handleStart}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER — Height: 56px
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          haptic.heavy();
          router.push("/miniapp/leaderboard");
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-[16px] font-semibold text-white shadow-xl shadow-black/20"
      >
        <img src="/icons/trophy.png" alt="" className="h-10 w-10 object-contain" />
        Таблица лидеров
      </motion.button>

      {/* ═══════════════════════════════════════════════════════════════════
          SUBSCRIPTION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSubscribeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowSubscribeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-[#1a1a2e] via-[#2d1f3d] to-[#1a1a2e] p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm"
                >
                  <span className="text-4xl">🔒</span>
                </motion.div>
                <h2 className="font-display text-[22px] font-bold text-white">
                  Подпишись на канал
                </h2>
                <p className="mt-2 text-[14px] text-white/60">
                  Чтобы играть в викторины, нужно подписаться на наш канал
                </p>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Channel card */}
                <div className="mb-6 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2AABEE] to-[#229ED9]">
                    <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-[16px] font-bold text-[#1a1a2e]">Чернила и Кровь</p>
                    <p className="text-[13px] text-slate-500">@{CHANNEL_USERNAME}</p>
                  </div>
                </div>

                {/* Subscribe button */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <a
                    href={CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ED9] text-[16px] font-bold text-white shadow-lg shadow-blue-500/30"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                    Подписаться
                  </a>
                </motion.div>

                {/* Check button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={checkingSubscription}
                  onClick={async () => {
                    haptic.medium();
                    const subscribed = await checkSubscription();
                    if (subscribed) {
                      haptic.success();
                      setShowSubscribeModal(false);
                    } else {
                      haptic.warning();
                    }
                  }}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] text-[16px] font-bold text-white disabled:opacity-50"
                >
                  {checkingSubscription ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                    />
                  ) : (
                    <>
                      <span>✓</span>
                      Я подписался
                    </>
                  )}
                </motion.button>

                {/* Close */}
                <button
                  onClick={() => setShowSubscribeModal(false)}
                  className="mt-4 w-full text-center text-[14px] text-slate-400 hover:text-slate-600"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PullToRefresh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CREATOR VIEW
═══════════════════════════════════════════════════════════════════════════ */
function CreatorView() {
  return (
    <div className="flex flex-col gap-4">
      {/* Create Button — Height: 56px */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => haptic.heavy()}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-[16px] font-semibold text-white shadow-lg shadow-indigo-500/25"
      >
        ✨ Создать викторину
      </motion.button>

      {/* Card: My Quizzes */}
      <Card title="Мои викторины" badge="0">
        <div className="flex h-24 flex-col items-center justify-center">
          <div className="text-3xl">📝</div>
          <p className="mt-2 text-[14px] text-[#64748b]">Создайте первую викторину</p>
        </div>
      </Card>

      {/* Card: Channels */}
      <Card title="Каналы" badge="1">
        <Row
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-[14px] font-bold text-white">T</div>}
          title="@truecrime_quiz"
          subtitle="1,234 подписчика"
          trailing={<div className="h-2 w-2 rounded-full bg-emerald-500" />}
        />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUIZ VIEW
═══════════════════════════════════════════════════════════════════════════ */
type QuizViewProps = {
  quizzes: QuizSummary[];
  loading: boolean;
  error: string | null;
  startingId: number | null;
  startError: string | null;
  countdowns: Record<number, number>;
  onStart: (id: number) => void;
};

function QuizView({ quizzes, loading, error, startingId, startError, countdowns, onStart }: QuizViewProps) {
  const router = useRouter();

  // Demo data
  const demos: QuizSummary[] = [
    { id: 1001, title: "Серийные убийцы США", description: "Тест про известных убийц Америки", prizeTitle: "500 ₽" },
    { id: 1002, title: "Загадочные исчезновения", description: "Нераскрытые дела о пропавших", prizeTitle: "750 ₽" },
    { id: 1003, title: "Культовые преступления", description: "Преступления потрясшие мир", prizeTitle: "1000 ₽" },
    { id: 1004, title: "Детективные загадки", description: "Проверь свою дедукцию", prizeTitle: "300 ₽" },
    { id: 1005, title: "Криминальная история", description: "Преступления прошлых веков", prizeTitle: "600 ₽" },
  ];
  const items = [...quizzes, ...demos.slice(0, Math.max(0, 5 - quizzes.length))];

  const tournaments = [
    { id: "t1", title: "Серийники 60-х", time: "20:00", emoji: "🎭", bg: "from-[#2d132c] to-[#1a1a2e]" },
    { id: "t2", title: "Ночь культов", time: "12ч", emoji: "🕯️", bg: "from-[#1e3a5f] to-[#0d1b2a]" },
  ];

  const events = [
    { id: "e1", title: "Неделя загадок", tag: "Марафон", emoji: "🔍" },
    { id: "e2", title: "Cold Cases", tag: "Нераскрытые", emoji: "🧊" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ─────────────────────────────────────────────────────────────────
          CAROUSEL SECTION
      ───────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        {/* Header — Height: 24px */}
        <div className="flex h-6 items-center justify-between">
          <h2 className="font-display text-[17px] font-bold text-[#1a1a2e]">Активные</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            </span>
            {loading ? "..." : items.length} активных
          </span>
        </div>

        {/* Carousel */}
        {loading ? (
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonQuizCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-[220px] items-center justify-center rounded-2xl bg-rose-50">
            <p className="text-[14px] text-rose-600">{error}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Fade */}
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-4 bg-gradient-to-l from-slate-100 to-transparent" />
            
            <div
              className="flex gap-3 overflow-x-auto pb-1 snap-x"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {items.map((q, i) => {
                const c = palette[i % palette.length];
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex h-[200px] w-[168px] flex-shrink-0 snap-start flex-col rounded-2xl bg-gradient-to-br ${c.bg} p-4`}
                  >
                    {/* Row 1: Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-[18px]">
                        {c.icon}
                      </div>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Активна
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-display mt-3 text-[14px] font-bold leading-tight text-white line-clamp-2">
                      {q.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-2 flex-1 text-[11px] leading-snug text-white/70 line-clamp-3">
                      {q.description}
                    </p>

                    {/* Button */}
                    {countdowns[q.id] && countdowns[q.id] > 0 ? (
                      // Countdown Timer — shows either rate limit (seconds) or daily limit (hours/mins)
                      <div className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="h-4 w-4"
                        >
                          <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        </motion.div>
                        <span className="text-[13px] font-bold text-amber-400 tabular-nums">
                          {(() => {
                            const seconds = countdowns[q.id];
                            const hours = Math.floor(seconds / 3600);
                            const mins = Math.floor((seconds % 3600) / 60);
                            const secs = seconds % 60;
                            if (hours > 0) {
                              return `${hours}ч ${mins}м`;
                            }
                            if (mins > 0) {
                              return `${mins}м ${secs}с`;
                            }
                            return `${secs}с`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        disabled={!!startingId && startingId !== q.id}
                        onClick={() => {
                          haptic.heavy();
                          onStart(q.id);
                        }}
                        className={`mt-3 flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-white text-[13px] font-bold ${c.text} disabled:opacity-50`}
                      >
                        {startingId === q.id ? "..." : "▶ Играть"}
                      </motion.button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
        {/* Error message */}
        {startError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2"
          >
            <span className="text-red-400">⚠️</span>
            <p className="text-[13px] font-medium text-red-400">{startError}</p>
          </motion.div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          PRIZES — Ultimate Premium Design
      ───────────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 30, rotateX: -10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ ...spring, duration: 0.8 }}
        style={{ perspective: 1000 }}
        className="relative"
      >
        {/* Animated spinning border */}
        <div className="absolute -inset-[2px] rounded-[22px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 opacity-60 blur-md" />
        <div className="absolute -inset-[2px] rounded-[22px] bg-[conic-gradient(from_0deg,#8b5cf6,#d946ef,#06b6d4,#8b5cf6)] opacity-70 animate-spin-medium" />
        
        {/* Main container */}
        <div className="relative overflow-hidden rounded-[20px] bg-[#0a0a0f]">
          {/* Animated mesh gradient background */}
          <div className="absolute inset-0">
            <motion.div
              animate={{ 
                background: [
                  "radial-gradient(600px circle at 0% 0%, rgba(139, 92, 246, 0.15), transparent 50%)",
                  "radial-gradient(600px circle at 100% 100%, rgba(139, 92, 246, 0.15), transparent 50%)",
                  "radial-gradient(600px circle at 0% 100%, rgba(139, 92, 246, 0.15), transparent 50%)",
                  "radial-gradient(600px circle at 0% 0%, rgba(139, 92, 246, 0.15), transparent 50%)",
                ]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
            />
            <motion.div
              animate={{ 
                background: [
                  "radial-gradient(400px circle at 100% 0%, rgba(6, 182, 212, 0.1), transparent 50%)",
                  "radial-gradient(400px circle at 0% 50%, rgba(6, 182, 212, 0.1), transparent 50%)",
                  "radial-gradient(400px circle at 100% 100%, rgba(6, 182, 212, 0.1), transparent 50%)",
                  "radial-gradient(400px circle at 100% 0%, rgba(6, 182, 212, 0.1), transparent 50%)",
                ]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
            />
          </div>

          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -30, 0],
                x: [0, i % 2 === 0 ? 10 : -10, 0],
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
              className="absolute rounded-full bg-white"
              style={{
                width: 2 + i,
                height: 2 + i,
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                filter: "blur(0.5px)",
              }}
            />
          ))}

          {/* Content */}
          <div className="relative px-4 py-5">
            {/* Header with animated badge */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-2.5 py-0.5"
                >
                  <motion.span
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-green-400"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">Еженедельно</span>
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="font-display text-[20px] font-bold tracking-tight text-white"
                >
                  Призовой фонд
                </motion.h2>
              </div>
              
              {/* Trophy */}
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
              >
                <img src="/icons/trophy.png" alt="" className="h-10 w-10 object-contain" />
              </motion.div>
            </div>

            {/* Prize Amount with counter effect */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, ...spring }}
              className="relative mb-4 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] px-4 py-4 backdrop-blur-sm"
            >
              {/* Shimmer effect */}
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
              />
              
              <div className="relative text-center">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-slate-500">Общий призовой фонд</p>
                <div className="flex items-baseline justify-center">
                  <motion.span
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, ...spring }}
                    className="font-display bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-[40px] font-black tabular-nums tracking-tight text-transparent"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    1 750
                  </motion.span>
                  <span className="ml-1 text-[18px] font-semibold text-white/50">₽</span>
                </div>
              </div>
            </motion.div>

            {/* Prize Tiers - Stacked cards with 3D effect */}
            <div className="mb-4 space-y-2">
              {[
                { place: 1, amount: "1 000", label: "Золото", gradient: "from-amber-500 to-yellow-400", bg: "from-amber-500/20 to-amber-500/5", ring: "ring-amber-500/30", shadow: "shadow-amber-500/20" },
                { place: 2, amount: "500", label: "Серебро", gradient: "from-slate-300 to-slate-400", bg: "from-slate-400/20 to-slate-400/5", ring: "ring-slate-400/30", shadow: "shadow-slate-400/20" },
                { place: 3, amount: "250", label: "Бронза", gradient: "from-orange-500 to-amber-600", bg: "from-orange-500/20 to-orange-500/5", ring: "ring-orange-500/30", shadow: "shadow-orange-500/20" },
              ].map((tier, i) => (
                <motion.div
                  key={tier.place}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1, ...spring }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`flex h-14 items-center gap-3 rounded-xl bg-gradient-to-r ${tier.bg} px-3 ring-1 ${tier.ring} backdrop-blur-sm`}
                >
                  {/* Place badge */}
                  <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tier.gradient} shadow-lg ${tier.shadow}`}>
                    {tier.place === 1 ? (
                      <img src="/icons/fire-medal.png" alt="1" className="h-10 w-10 object-contain" />
                    ) : (
                      <img src="/icons/medal.png" alt={String(tier.place)} className="h-9 w-9 object-contain" />
                    )}
                    {tier.place === 1 && (
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-lg bg-amber-400"
                      />
                    )}
                  </div>
                  
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">{tier.label}</p>
                  </div>
                  
                  {/* Amount */}
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[16px] font-bold tabular-nums text-white">{tier.amount}</span>
                    <span className="text-[12px] font-medium text-white/50">₽</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Steps indicator */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="mb-4 flex h-12 items-center justify-center gap-4 rounded-xl bg-white/[0.03]"
            >
              {[
                { icon: "🎮", label: "Играй" },
                { icon: "📈", label: "Набирай" },
                { icon: "🏆", label: "Побеждай" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{step.icon}</span>
                    <span className="text-[11px] font-medium text-slate-400">{step.label}</span>
                  </div>
                  {i < 2 && (
                    <span className="text-[11px] text-slate-600">→</span>
                  )}
                </div>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic.medium();
                router.push("/miniapp/leaderboard");
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[13px] font-semibold text-white"
            >
              <span>Открыть рейтинг</span>
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ─────────────────────────────────────────────────────────────────
          TOURNAMENTS
      ───────────────────────────────────────────────────────────────── */}
      <Card title="Турниры" badge="🎯">
        <div className="flex flex-col gap-2">
          {tournaments.map((t) => (
            <Row
              key={t.id}
              icon={
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.bg} text-[18px] shadow-lg`}>
                  {t.emoji}
                </div>
              }
              title={t.title}
              subtitle={`Через ${t.time}`}
              trailing={<Chevron />}
            />
          ))}
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────
          SPECIAL EVENTS — 2 columns
      ───────────────────────────────────────────────────────────────── */}
      <Card title="Спецпроекты" badge="✨">
        <div className="grid grid-cols-2 gap-3">
          {events.map((e) => (
            <motion.div
              key={e.id}
              whileTap={{ scale: 0.97 }}
              className="flex h-24 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] text-center shadow-lg"
            >
              <div className="text-2xl">{e.emoji}</div>
              <p className="mt-1 text-[13px] font-semibold text-white">{e.title}</p>
              <span className="mt-1 text-[10px] text-indigo-300">{e.tag}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      {/* Header — h-6 */}
      <div className="mb-3 flex h-6 items-center justify-between">
        <h3 className="font-display text-[15px] font-bold text-[#1a1a2e]">{title}</h3>
        {badge && <span className="text-[14px]">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        haptic.light();
        onClick?.();
      }}
      className="flex h-14 items-center gap-3 rounded-xl bg-slate-50 px-3 cursor-pointer"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#1a1a2e]">{title}</p>
        {subtitle && <p className="truncate text-[12px] text-[#64748b]">{subtitle}</p>}
      </div>
      {trailing}
    </motion.div>
  );
}

function Chevron() {
  return (
    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
