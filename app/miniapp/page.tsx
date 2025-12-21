"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "./layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonQuizCard, SkeletonProfileHeader } from "@/components/Skeleton";
import { usePerformance } from "@/lib/usePerformance";
import { fetchWithAuth, api } from "@/lib/api";
import { useScrollPerfMode } from "@/components/hooks/useScrollPerfMode";
import { useDeviceTier } from "@/components/hooks/useDeviceTier";
import { usePerfMode } from "@/components/context/PerfModeContext";
import { HeroShell, HERO_HEIGHT } from "@/components/miniapp/HeroShell";
import { HeroRich } from "@/components/miniapp/HeroRich";
import { useDeferredRender } from "@/components/hooks/useDeferredRender";
import { DailyRewardModal, DailyRewardButton } from "@/components/DailyRewardModal";
import { AvatarWithFrame } from "@/components/AvatarWithFrame";
import type { DailyRewardStatus, DailyReward } from "@/lib/daily-rewards";

// Detect Android for blur fallbacks (Android WebView has poor blur performance)
function useIsAndroid() {
  const [isAndroid, setIsAndroid] = useState(false);
  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);
  return isAndroid;
}

// Detect iOS - iOS handles blur effects well, no need to disable during scroll
function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isIOS;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM
   Base unit: 4px
   Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48
   Border radius: 8, 12, 16, 20
═══════════════════════════════════════════════════════════════════════════ */

// Greeting icons as React elements
function SunriseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="url(#sunrise)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 16a4 4 0 100-8 4 4 0 000 8z" fill="url(#sunFill)"/>
      <defs>
        <linearGradient id="sunrise" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#F59E0B"/><stop offset="1" stopColor="#F97316"/>
        </linearGradient>
        <linearGradient id="sunFill" x1="8" y1="8" x2="16" y2="16">
          <stop stopColor="#FBBF24"/><stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="url(#sunGradient)"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="url(#rayGradient)" strokeWidth="2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="sunGradient" x1="7" y1="7" x2="17" y2="17">
          <stop stopColor="#FCD34D"/><stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="rayGradient" x1="1" y1="1" x2="23" y2="23">
          <stop stopColor="#FBBF24"/><stop offset="1" stopColor="#F97316"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function SunsetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M17 18a5 5 0 10-10 0" fill="url(#sunsetSun)"/>
      <path d="M12 2v2M4.22 5.64l1.42 1.42M18.36 5.64l-1.42 1.42M1 12h2M21 12h2" stroke="url(#sunsetRay)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M2 20h20" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="sunsetSun" x1="7" y1="13" x2="17" y2="18">
          <stop stopColor="#FB923C"/><stop offset="1" stopColor="#EC4899"/>
        </linearGradient>
        <linearGradient id="sunsetRay" x1="1" y1="2" x2="21" y2="12">
          <stop stopColor="#FBBF24"/><stop offset="1" stopColor="#F472B6"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="url(#moonGradient)"/>
      <circle cx="8" cy="8" r="1" fill="#A78BFA" opacity="0.6"/>
      <circle cx="11" cy="13" r="0.5" fill="#A78BFA" opacity="0.4"/>
      <circle cx="15" cy="9" r="0.7" fill="#A78BFA" opacity="0.5"/>
      <defs>
        <linearGradient id="moonGradient" x1="11" y1="3" x2="21" y2="21">
          <stop stopColor="#C4B5FD"/><stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Greeting based on time of day
function getGreeting(): { text: string; icon: React.ReactNode; atmosphere: string } {
  const hour = new Date().getHours();
  
  const atmospheres = [
    "Раскрой тёмные тайны...",
    "Найди улики...",
    "Разгадай загадку...",
    "Стань детективом...",
    "Докопайся до правды...",
  ];
  const randomAtmosphere = atmospheres[Math.floor(Math.random() * atmospheres.length)];
  
  if (hour >= 5 && hour < 12) {
    return { text: "Доброе утро", icon: <SunriseIcon className="inline h-5 w-5 -mt-0.5" />, atmosphere: randomAtmosphere };
  } else if (hour >= 12 && hour < 17) {
    return { text: "Добрый день", icon: <SunIcon className="inline h-5 w-5 -mt-0.5" />, atmosphere: randomAtmosphere };
  } else if (hour >= 17 && hour < 22) {
    return { text: "Добрый вечер", icon: <SunsetIcon className="inline h-5 w-5 -mt-0.5" />, atmosphere: randomAtmosphere };
  } else {
    return { text: "Доброй ночи", icon: <MoonIcon className="inline h-5 w-5 -mt-0.5" />, atmosphere: randomAtmosphere };
  }
}

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
  minEnergy?: number;      // Минимальная энергия среди всех квизов
  maxEnergy?: number;      // Максимум энергии
  bonusEnergy?: number;    // Бонусная энергия из Daily Rewards
  equippedFrameUrl?: string | null;  // URL рамки из магазина
};

type LeaderboardPosition = {
  place: number;
  score: number;
  totalPlayers: number;
  topScore: number;
};

type WeeklyLeaderboard = {
  week: {
    label: string;
    timeRemaining: number;
    isEnding: boolean;
  };
  myPosition: {
    place: number;
    score: number;
    quizzes: number;
  } | null;
  leaderboard: {
    place: number;
    user: { id: number; firstName: string | null; photoUrl: string | null };
    score: number;
  }[];
  totalParticipants: number;
  lastWeekWinners: {
    place: number;
    user: { id: number; firstName: string | null; photoUrl: string | null };
    score: number;
  }[];
};

// Tournament types for home page
type TournamentSummary = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  gradient: { from: string; to: string };
  status: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  timeRemaining: { ms: number; label: string } | null;
  participantsCount: number;
  myParticipation: {
    rank: number | null;
    totalScore: number;
  } | null;
  prizes: {
    place: number;
    title: string;
    icon: string | null;
    type: string;
    value: number;
  }[];
};

// Animations
const spring = { type: "spring", stiffness: 400, damping: 30 };

// Quiz card icon components
function SearchIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6" stroke="url(#searchGrad)" strokeWidth="2"/>
      <path d="M20 20l-3-3" stroke="url(#searchGrad)" strokeWidth="2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="searchGrad" x1="5" y1="5" x2="20" y2="20">
          <stop stopColor="#818CF8"/><stop offset="1" stopColor="#6366F1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function MaskIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 4C7 4 3 7 3 11c0 2.5 1.5 4.5 3 6 1.5 1.5 3 3 6 3s4.5-1.5 6-3c1.5-1.5 3-3.5 3-6 0-4-4-7-9-7z" fill="url(#maskGrad)"/>
      <circle cx="8.5" cy="10" r="1.5" fill="#1a1a2e"/>
      <circle cx="15.5" cy="10" r="1.5" fill="#1a1a2e"/>
      <path d="M9 14c1 1 2 1.5 3 1.5s2-.5 3-1.5" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="maskGrad" x1="3" y1="4" x2="21" y2="20">
          <stop stopColor="#FB7185"/><stop offset="1" stopColor="#E11D48"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="url(#boltGrad)"/>
      <defs>
        <linearGradient id="boltGrad" x1="4" y1="2" x2="20" y2="22">
          <stop stopColor="#FCD34D"/><stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function SnowflakeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v20M2 12h20M5.64 5.64l12.72 12.72M18.36 5.64L5.64 18.36" stroke="url(#snowGrad)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="2" fill="url(#snowGrad)"/>
      <defs>
        <linearGradient id="snowGrad" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#67E8F9"/><stop offset="1" stopColor="#06B6D4"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 22c4-2 6-5 6-8 0-4-3-6-4-8-1 2-2 3-2 5 0-3-2-6-4-8-1 3 0 6 0 8-3-2-4-5-4-8 0 5 2 11 8 19z" fill="url(#flameGrad)"/>
      <path d="M12 22c2-1 3-2.5 3-4 0-2-1.5-3-2-4-.5 1-1 1.5-1 2.5 0-1.5-1-3-2-4-.5 1.5 0 3 0 4-1.5-1-2-2.5-2-4 0 2.5 1 5.5 4 9.5z" fill="url(#flameInner)"/>
      <defs>
        <linearGradient id="flameGrad" x1="4" y1="22" x2="18" y2="2">
          <stop stopColor="#EF4444"/><stop offset="0.5" stopColor="#F97316"/><stop offset="1" stopColor="#FBBF24"/>
        </linearGradient>
        <linearGradient id="flameInner" x1="7" y1="22" x2="15" y2="10">
          <stop stopColor="#FCD34D"/><stop offset="1" stopColor="#FEF3C7"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Premium Dark Palette — Netflix/HBO Crime aesthetic
const palette = [
  { bg: "from-[#1a1a2e] to-[#16213e]", text: "text-indigo-400", icon: <SearchIcon /> },
  { bg: "from-[#2d132c] to-[#1a1a2e]", text: "text-rose-400", icon: <MaskIcon /> },
  { bg: "from-[#1f1f1f] to-[#121212]", text: "text-amber-400", icon: <BoltIcon /> },
  { bg: "from-[#1e3a5f] to-[#0d1b2a]", text: "text-cyan-400", icon: <SnowflakeIcon /> },
  { bg: "from-[#2c1810] to-[#1a0f0a]", text: "text-orange-400", icon: <FlameIcon /> },
];

// Канал для подписки
const CHANNEL_USERNAME = "dark_bookshelf";
const CHANNEL_URL = "https://t.me/dark_bookshelf";

export default function MiniAppPage() {
  const session = useMiniAppSession();
  const router = useRouter();
  const isAndroid = useIsAndroid();
  const isIOS = useIsIOS();
  const { config } = useDeviceTier();
  const { setPerfMode } = usePerfMode();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useScrollPerfMode({ 
    target: scrollRef, 
    debounceMs: config.scrollDebounceMs 
  });
  
  // Sync scroll state to global perf mode (for Rive overlay in layout)
  useEffect(() => {
    setPerfMode(isScrolling);
  }, [isScrolling, setPerfMode]);
  
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [greeting] = useState(() => getGreeting());
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
  
  // Weekly leaderboard
  const [weeklyData, setWeeklyData] = useState<WeeklyLeaderboard | null>(null);
  const [weeklyTimeLeft, setWeeklyTimeLeft] = useState<string>("");
  
  // Daily Rewards
  const [dailyRewardStatus, setDailyRewardStatus] = useState<DailyRewardStatus | null>(null);
  const [showDailyRewardModal, setShowDailyRewardModal] = useState(false);
  
  // Tournaments
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [lastFinishedTournament, setLastFinishedTournament] = useState<TournamentSummary | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMIZED DATA LOADING - All requests in parallel for faster LCP
  // ═══════════════════════════════════════════════════════════════════════════
  
  const fetchAllData = useCallback(async () => {
    if (session.status !== "ready") return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 🚀 PARALLEL REQUESTS - All API calls execute simultaneously
      const [quizzesRes, statsRes, weeklyRes, onlineRes, subscriptionRes, dailyRewardRes, tournamentsRes, finishedTournamentsRes] = await Promise.all([
        // 1. Quizzes with limits
        fetchWithAuth(`/api/quiz?userId=${session.user.id}`),
        // 2. User stats
        fetchWithAuth(`/api/me/summary?userId=${session.user.id}`),
        // 3. Weekly leaderboard
        api.get<WeeklyLeaderboard>(`/api/leaderboard/weekly?userId=${session.user.id}`).catch(() => null),
        // 4. Online count (non-critical, can fail silently)
        fetch('/api/online').then(r => r.json()).catch(() => ({ count: 5 })),
        // 5. Subscription check
        fetch("/api/check-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramUserId: session.user.telegramId }),
        }).then(r => r.json()).catch(() => ({ subscribed: null })),
        // 6. Daily reward status
        api.get<DailyRewardStatus>("/api/daily-reward").catch(() => null),
        // 7. Active/Upcoming tournaments
        api.get<{ tournaments: TournamentSummary[] }>("/api/tournaments").catch(() => ({ tournaments: [] })),
        // 8. Last finished tournament (for fallback display)
        api.get<{ tournaments: TournamentSummary[] }>("/api/tournaments?status=FINISHED").catch(() => ({ tournaments: [] })),
      ]);
      
      // Process quizzes
      const quizzesData = await quizzesRes.json() as QuizSummary[];
      setQuizzes(quizzesData);
      
      // Process countdowns from quiz data
      const newCountdowns: Record<number, number> = {};
      const firstQuiz = quizzesData[0];
      const globalEnergy = firstQuiz?.limitInfo?.remaining ?? 5;
      const maxEnergy = firstQuiz?.limitInfo?.maxAttempts ?? 5;
      
      for (const quiz of quizzesData) {
        if (quiz.limitInfo) {
          if (quiz.limitInfo.energyWaitMs && quiz.limitInfo.energyWaitMs > 0) {
            newCountdowns[quiz.id] = Math.ceil(quiz.limitInfo.energyWaitMs / 1000);
          } else if (quiz.limitInfo.rateLimitWaitSeconds && quiz.limitInfo.rateLimitWaitSeconds > 0) {
            newCountdowns[quiz.id] = quiz.limitInfo.rateLimitWaitSeconds;
          }
        }
      }
      setCountdowns(newCountdowns);
      
      // Process user stats
      const statsData = await statsRes.json();
      setUserStats({
        totalQuizzesPlayed: statsData.stats?.totalQuizzesPlayed ?? 0,
        totalScore: statsData.stats?.totalScore ?? 0,
        minEnergy: globalEnergy,
        maxEnergy,
        bonusEnergy: statsData.stats?.globalEnergy?.bonus ?? 0,
        equippedFrameUrl: statsData.user?.equippedFrame?.imageUrl ?? null,
      });
      
      // Process weekly leaderboard
      if (weeklyRes) {
        setWeeklyData(weeklyRes);
        if (weeklyRes.myPosition) {
          setMyPosition({
            place: weeklyRes.myPosition.place,
            score: weeklyRes.myPosition.score,
            totalPlayers: weeklyRes.totalParticipants,
            topScore: weeklyRes.leaderboard[0]?.score ?? 0,
          });
        } else {
          setMyPosition({
            place: 0,
            score: 0,
            totalPlayers: weeklyRes.totalParticipants,
            topScore: weeklyRes.leaderboard[0]?.score ?? 0,
          });
        }
      }
      
      // Process online count
      setOnlinePlayers(onlineRes.count ?? 5);
      
      // Process subscription
      setIsSubscribed(subscriptionRes.subscribed ?? null);
      
      // Process daily reward status
      if (dailyRewardRes) {
        setDailyRewardStatus(dailyRewardRes);
        // Автоматически показываем модалку если есть награда
        if (dailyRewardRes.canClaim && !dailyRewardRes.claimedToday) {
          // Небольшая задержка чтобы страница успела загрузиться
          setTimeout(() => setShowDailyRewardModal(true), 500);
        }
      }
      
      // Process tournaments
      if (tournamentsRes?.tournaments) {
        setTournaments(tournamentsRes.tournaments);
      }
      
      // Process last finished tournament (for fallback when no active tournaments)
      if (finishedTournamentsRes?.tournaments?.length > 0) {
        // Get the most recently finished tournament
        setLastFinishedTournament(finishedTournamentsRes.tournaments[0]);
      }
      
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initial data fetch - single effect for all data
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Pull to refresh handler - reuses the optimized fetch
  const handleRefresh = useCallback(async () => {
    await fetchAllData();
  }, [fetchAllData]);

  // Online players polling (non-blocking, runs after initial load)
  useEffect(() => {
    // Poll every 30 seconds (initial fetch already done in fetchAllData)
    const interval = setInterval(() => {
      fetch('/api/online')
        .then(res => res.json())
        .then(data => setOnlinePlayers(data.count))
        .catch(() => {}); // Silent fail
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Update weekly timer every second
  useEffect(() => {
    if (!weeklyData?.week?.timeRemaining) return;
    
    const formatTime = (ms: number): string => {
      if (ms <= 0) return "Завершено";
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) return `${days}д ${hours}ч ${minutes}м`;
      if (hours > 0) return `${hours}ч ${minutes}м`;
      return `${minutes}м`;
    };
    
    let remaining = weeklyData.week.timeRemaining;
    setWeeklyTimeLeft(formatTime(remaining));
    
    const timer = setInterval(() => {
      remaining -= 1000;
      setWeeklyTimeLeft(formatTime(remaining));
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [weeklyData?.week?.timeRemaining]);

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
        const res = await fetchWithAuth(`/api/quiz/${id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        });
        
        // Обработка rate limiting
        if (res.status === 429) {
          const data = await res.json();
          if (data.error === "energy_depleted" && data.waitMs) {
            // Energy depleted — показываем сколько ждать (в приоритете)
            setCountdowns(prev => ({ ...prev, [id]: Math.ceil(data.waitMs / 1000) }));
          } else if (data.error === "rate_limited" && data.waitSeconds) {
            // Rate limit — секунды между попытками
            setCountdowns(prev => ({ ...prev, [id]: data.waitSeconds }));
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

  // Loading state - show skeleton immediately for better LCP
  if (session.status === "loading") {
    return (
      <div className="relative flex flex-col gap-6 w-full overflow-x-hidden animate-pulse">
        {/* Header skeleton */}
        <header className="relative flex h-14 items-center justify-between">
          <div className="h-11 w-11 rounded-2xl bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-slate-200" />
            <div className="h-11 w-11 rounded-full bg-slate-200" />
          </div>
        </header>
        
        {/* Profile header skeleton */}
        <SkeletonProfileHeader />
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-2xl bg-slate-200" />
          <div className="h-20 rounded-2xl bg-slate-200" />
          <div className="h-20 rounded-2xl bg-slate-200" />
        </div>
        
        {/* Quiz cards skeleton */}
        <div className="flex gap-3 overflow-hidden">
          <SkeletonQuizCard />
          <SkeletonQuizCard />
        </div>
      </div>
    );
  }

  // Error state
  if (session.status === "error") {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#F43F5E" strokeWidth="2"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="mt-4 text-[17px] font-semibold text-[#1a1a2e]">Ошибка</p>
        <p className="mt-1 text-[15px] text-[#64748b]">Откройте из Telegram</p>
      </div>
    );
  }

  const name = session.user.firstName ?? session.user.username ?? "друг";
  const photoUrl = session.user.photoUrl;
  const avatarLetter = name.slice(0, 1).toUpperCase();
  
  // Daily Reward handlers
  const handleDailyRewardClaim = useCallback((reward: DailyReward, newXp: number, levelUp: boolean, bonusEnergy?: number) => {
    // Обновляем статистику пользователя с новым XP и бонусной энергией
    setUserStats(prev => prev ? { 
      ...prev, 
      totalScore: prev.totalScore,
      // Обновляем бонусную энергию если она была начислена
      ...(bonusEnergy !== undefined && { bonusEnergy }),
    } : prev);
    // Обновляем статус daily reward
    setDailyRewardStatus(prev => prev ? { ...prev, canClaim: false, claimedToday: true } : prev);
  }, []);

  return (
    <PullToRefresh 
      onRefresh={handleRefresh} 
      scrollRef={scrollRef}
    >
    <div className={`relative flex flex-col gap-6 w-full min-h-screen bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ec] px-4 pt-3 pb-24 overflow-x-hidden ${isScrolling && !isIOS ? "perf" : ""}`}>
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Height: 56px
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="relative flex h-14 items-center justify-between">
        {/* Back — 44x44 */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            haptic.light();
            router.push("/");
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm"
          aria-label="Назад"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>

        {/* Live Players Counter — centered */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[#1a1a2e] px-3 py-1.5"
        >
          <span className="text-lg">👥</span>
          <span className="text-xs font-medium text-white whitespace-nowrap">
            <span className="font-bold tabular-nums">{onlinePlayers}</span> <span className="text-white/50">играют сейчас</span>
          </span>
        </motion.div>

        {/* Daily Reward Button — right side */}
        <DailyRewardButton
          onClick={() => setShowDailyRewardModal(true)}
          hasReward={dailyRewardStatus?.canClaim ?? false}
          streak={dailyRewardStatus?.currentStreak ?? 0}
        />
      </header>



      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Centered Avatar + Stats (Duolingo/Headspace style)
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.section 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center py-4"
        style={{ contain: 'layout', minHeight: 220 }}
      >
        {/* Centered Avatar — clickable to profile */}
        {(() => {
          const hasFrame = !!userStats?.equippedFrameUrl;
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                haptic.medium();
                router.push("/miniapp/profile");
              }}
              className="relative mb-4"
            >
              {/* Декоративные кольца только когда НЕТ рамки */}
              {!hasFrame && (
                <>
                  {/* Large diffused glow behind avatar - cyan/violet */}
                  {isAndroid ? (
                    <div 
                      className="absolute inset-0 rounded-full gpu-accelerated animate-pulse"
                      style={{
                        boxShadow: `
                          0 0 20px 8px rgba(6, 182, 212, 0.5),
                          0 0 40px 16px rgba(139, 92, 246, 0.4),
                          0 0 60px 24px rgba(236, 72, 153, 0.3),
                          0 0 80px 32px rgba(139, 92, 246, 0.2)
                        `,
                      }}
                    />
                  ) : (
                    <>
                      <div 
                        className="absolute -inset-8 rounded-full gpu-accelerated animate-pulse"
                        style={{
                          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, rgba(139, 92, 246, 0.3) 50%, transparent 70%)',
                          filter: 'blur(20px)',
                        }}
                      />
                      <div 
                        className="absolute -inset-5 rounded-full gpu-accelerated"
                        style={{
                          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(236, 72, 153, 0.25) 50%, transparent 70%)',
                          filter: 'blur(15px)',
                        }}
                      />
                    </>
                  )}
                  {/* Animated gradient ring — outer glow */}
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 opacity-60 animate-spin-slow gpu-accelerated" />
                  {/* Animated gradient ring — sharp edge */}
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 opacity-80 animate-spin-slow gpu-accelerated" />
                </>
              )}
              
              {/* Аватар с рамкой из магазина */}
              <AvatarWithFrame
                photoUrl={photoUrl}
                frameUrl={userStats?.equippedFrameUrl}
                size={96}
                fallbackLetter={avatarLetter}
                className={hasFrame ? "" : "ring-[3px] ring-white shadow-xl rounded-full"}
              />
              
              {/* Online indicator — позиция зависит от наличия рамки */}
              <div 
                className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm"
                style={{
                  bottom: hasFrame ? 8 : 2,
                  right: hasFrame ? 8 : 2,
                }}
              >
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                </span>
              </div>
            </motion.button>
          );
        })()}
        
        {/* Greeting */}
        <p className="text-sm text-slate-500 text-center flex items-center justify-center gap-1.5">
          {greeting.icon} {greeting.text}, <span className="font-semibold text-slate-700">{name}</span>
        </p>
        <p className="text-xs text-slate-400/80 italic text-center mt-1 mb-4">
          {greeting.atmosphere}
        </p>
        
        {/* Stats — Minimal Oval Pills */}
        <div className="flex justify-center items-center gap-3">
          {/* Energy pill */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 pl-1.5 pr-3 py-1 shadow-lg shadow-amber-500/25"
          >
            <span className="text-2xl">⚡</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {userStats?.minEnergy ?? 5}
              {(userStats?.bonusEnergy ?? 0) > 0 && (
                <span className="text-amber-200">+{userStats?.bonusEnergy}</span>
              )}
            </span>
          </motion.div>
          
          {/* Score pill */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 pl-1.5 pr-3 py-1 shadow-lg shadow-violet-500/25"
          >
            <span className="text-2xl">💎</span>
            <span className="text-sm font-bold text-white tabular-nums">{(userStats?.totalScore ?? 0).toLocaleString()}</span>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK ACTIONS — Creative Glassmorphism Cards
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
        className="relative"
      >
        {/* Single unified glassmorphism card - with glow effect */}
        <div 
          className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
          style={{
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2), 0 0 60px rgba(139, 92, 246, 0.1)',
          }}
        >
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-violet-500/30 via-pink-500/25 to-amber-500/30 opacity-70 animate-pulse" />
          
          {/* Inner content */}
          <div className="relative flex">
            {/* Telegram Channel */}
            <a
              href="https://t.me/dark_bookshelf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center gap-3 p-3 rounded-l-[16px] hover:bg-white/5 transition-colors active:scale-[0.98]"
            >
              {/* Telegram icon with glow */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-[#2AABEE]/30" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2AABEE] to-[#1E96D1]">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate">Чернила и Кровь</p>
                <p className="text-[10px] text-white/40">Подпишись на канал →</p>
              </div>
            </a>

            {/* Divider */}
            <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent my-2" />

            {/* Weekly Leaderboard Position */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic.medium();
                router.push("/miniapp/leaderboard");
              }}
              className="flex-1 flex items-center gap-3 p-3 rounded-r-[16px] hover:bg-white/5 transition-colors"
            >
              {/* Position badge with glow */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-violet-500/25" />
                <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${
                  !myPosition || myPosition.place === 0
                    ? "bg-white/10"
                    : myPosition.place <= 3
                      ? "bg-gradient-to-br from-amber-400 to-orange-500"
                      : "bg-gradient-to-br from-violet-500 to-indigo-600"
                }`}>
                  {!myPosition || myPosition.place === 0 ? (
                    <span className="text-2xl">🏆</span>
                  ) : myPosition.place === 1 ? (
                    <span className="text-2xl">🥇</span>
                  ) : myPosition.place === 2 ? (
                    <span className="text-xl">🥈</span>
                  ) : myPosition.place === 3 ? (
                    <span className="text-xl">🥉</span>
                  ) : (
                    <span className="text-[14px] font-black text-white">{myPosition.place}</span>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-bold text-white">Лидерборд</p>
                <p className="text-[10px] text-white/40">
                  {myPosition && myPosition.place > 0 
                    ? `${myPosition.place} место • ${myPosition.score?.toLocaleString() || 0} очков`
                    : myPosition?.totalPlayers 
                      ? `— место • Сыграй чтобы попасть в топ`
                      : "Открыть топ →"
                  }
                </p>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        <motion.div
          key="quizzes"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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
            myPosition={myPosition}
            weeklyTimeLeft={weeklyTimeLeft}
            isAndroid={isAndroid}
            isPerfMode={isScrolling}
            tournaments={tournaments}
            lastFinishedTournament={lastFinishedTournament}
          />
        </motion.div>
      </AnimatePresence>


      {/* ═══════════════════════════════════════════════════════════════════
          SUBSCRIPTION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSubscribeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10"
                >
                  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" fill="url(#lockBody)"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="url(#lockShackle)" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1.5" fill="#1a1a2e"/>
                    <path d="M12 17.5v2" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round"/>
                    <defs>
                      <linearGradient id="lockBody" x1="3" y1="11" x2="21" y2="22">
                        <stop stopColor="#FCD34D"/><stop offset="1" stopColor="#F59E0B"/>
                      </linearGradient>
                      <linearGradient id="lockShackle" x1="7" y1="7" x2="17" y2="11">
                        <stop stopColor="#FBBF24"/><stop offset="1" stopColor="#D97706"/>
                      </linearGradient>
                    </defs>
                  </svg>
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

      {/* ═══════════════════════════════════════════════════════════════════
          DAILY REWARD MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <DailyRewardModal
        isOpen={showDailyRewardModal}
        onClose={() => setShowDailyRewardModal(false)}
        onClaim={handleDailyRewardClaim}
      />
    </div>
    </PullToRefresh>
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
  myPosition: LeaderboardPosition | null;
  weeklyTimeLeft: string;
  isAndroid: boolean;
  isPerfMode: boolean;
  tournaments: TournamentSummary[];
  lastFinishedTournament: TournamentSummary | null;
};

function QuizView({ quizzes, loading, error, startingId, startError, countdowns, onStart, myPosition, weeklyTimeLeft, isAndroid, isPerfMode, tournaments, lastFinishedTournament }: QuizViewProps) {
  const router = useRouter();
  
  // Defer heavy hero rendering for better LCP
  const showHeroRich = useDeferredRender({ 
    timeoutMs: 1500, 
    fallbackMs: 1200,
    disabled: isPerfMode // Don't defer when scrolling
  });

  // Demo data
  const demos: QuizSummary[] = [
    { id: 1001, title: "Серийные убийцы США", description: "Тест про известных убийц Америки", prizeTitle: "500 ₽" },
    { id: 1002, title: "Загадочные исчезновения", description: "Нераскрытые дела о пропавших", prizeTitle: "750 ₽" },
    { id: 1003, title: "Культовые преступления", description: "Преступления потрясшие мир", prizeTitle: "1000 ₽" },
    { id: 1004, title: "Детективные загадки", description: "Проверь свою дедукцию", prizeTitle: "300 ₽" },
    { id: 1005, title: "Криминальная история", description: "Преступления прошлых веков", prizeTitle: "600 ₽" },
  ];
  const items = [...quizzes, ...demos.slice(0, Math.max(0, 5 - quizzes.length))];

  // Определяем что показывать в блоке турниров
  const hasActiveTournaments = tournaments.length > 0;
  const displayTournaments = hasActiveTournaments ? tournaments.slice(0, 2) : [];
  const showFinishedFallback = !hasActiveTournaments && lastFinishedTournament;

  const events = [
    { id: "e1", title: "Неделя загадок", tag: "Марафон", icon: <span className="text-2xl">🔍</span> },
    { id: "e2", title: "Cold Cases", tag: "Нераскрытые", icon: <span className="text-2xl">❄️</span> },
  ];

  return (
    <div className="flex flex-col gap-6" style={{ contain: 'layout' }}>
      {/* ─────────────────────────────────────────────────────────────────
          CAROUSEL SECTION
      ───────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4" style={{ contain: 'layout' }}>
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

        {/* Carousel — Fixed height to prevent CLS */}
        <div className="relative" style={{ minHeight: 200, contain: 'layout' }}>
          {loading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <SkeletonQuizCard key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex h-[200px] items-center justify-center rounded-2xl bg-rose-50">
              <p className="text-[14px] text-rose-600">{error}</p>
            </div>
          ) : (
            <div className="relative">
            {/* Fade */}
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-4 bg-gradient-to-l from-slate-100 to-transparent" />
            
            <div
              className="flex gap-3 overflow-x-auto pb-1 snap-x gpu-accelerated"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", contain: 'layout' }}
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
                    style={{ contain: 'layout' }}
                  >
                    {/* Row 1: Icon + Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
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
                          style={{ willChange: 'transform' }}
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
                        style={{ willChange: 'transform' }}
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
        </div>
        {/* Error message */}
        {startError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2"
          >
            <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            <p className="text-[13px] font-medium text-red-400">{startError}</p>
          </motion.div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          🏆 WEEKLY COMPETITION — LCP Split: HeroShell + HeroRich
      ───────────────────────────────────────────────────────────────── */}
      
      {/* Hero Container with fixed height to prevent CLS */}
      <div className="relative" style={{ height: HERO_HEIGHT }}>
        {/* HeroShell — always visible immediately, becomes LCP candidate */}
        <HeroShell />
        
        {/* HeroRich — deferred, appears after idle/timer, overlays Shell */}
        {/* NOTE: Always visible after defer, but animations pause during scroll (isPerfMode) */}
        {showHeroRich && (
          <HeroRich
            weeklyTimeLeft={weeklyTimeLeft}
            myPosition={myPosition}
            isAndroid={isAndroid}
            isPerfMode={isPerfMode}
            onPlayClick={() => {
              haptic.heavy();
              // Scroll to quiz section
              document.querySelector('[data-quiz-section]')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}
      </div>
      
      
      {/* Extended content below hero - only show after data loaded */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: showHeroRich ? 1 : 0, y: showHeroRich ? 0 : 30 }}
        transition={{ ...spring, duration: 0.8 }}
        className="relative"
      >
        {/* Main container for extended content (GAME PATH etc.) */}
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-b from-[#0f0a1a] via-[#0a0a12] to-[#0a0812] mt-4">
          {/* Static border */}
          <div className="absolute -inset-[2px] rounded-[24px] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-amber-500/30" />
          
          {/* Content */}
          <div className="relative px-5 py-6">
            
            {/* NOTE: Timer, Prize Pool, Prize Tiers, Your Position moved to HeroShell/HeroRich above */}

            {/* ═══ GAME PATH — Road to Victory ═══ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mb-5 relative"
            >
              {/* Path container */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 via-violet-950/40 to-slate-900/80 border border-white/[0.08] overflow-hidden">
                
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }} />
                
                {/* Glowing orb in background - radial gradient on Android */}
                <div 
                  className={`absolute -top-20 -right-20 w-40 h-40 rounded-full fx-glow ${isAndroid ? '' : 'bg-violet-500/20 blur-3xl'}`}
                  style={isAndroid ? {
                    background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 60%)'
                  } : undefined}
                />
                <div 
                  className={`absolute -bottom-20 -left-20 w-40 h-40 rounded-full fx-glow ${isAndroid ? '' : 'bg-amber-500/15 blur-3xl'}`}
                  style={isAndroid ? {
                    background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 60%)'
                  } : undefined}
                />

                {/* Title */}
                <div className="relative flex items-center gap-2.5 mb-5">
                  <span className="text-2xl">🛤️</span>
                  <span className="text-[15px] font-bold text-white">Путь к победе</span>
                </div>

                {/* Horizontal Path */}
                <div className="relative flex items-center justify-between">
                  
                  {/* Connecting line - animated gradient */}
                  <div className="absolute top-7 left-8 right-8 h-1 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/30 to-amber-500/30" />
                    <motion.div
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    />
                  </div>

                  {/* Steps */}
                  {[
                    { step: 1, icon: "🎮", label: "Играй", desc: "квизы", color: "from-violet-500 to-violet-600", glow: "violet", isImg: false },
                    { step: 2, icon: "💎", label: "Набирай", desc: "очки", color: "from-fuchsia-500 to-pink-500", glow: "fuchsia", isImg: false },
                    { step: 3, icon: "🏆", label: "Расти", desc: "в топе", color: "from-cyan-500 to-blue-500", glow: "cyan", isImg: false },
                    { step: 4, icon: "/icons/17.webp", label: "Получай", desc: "призы", color: "from-amber-500 to-orange-500", glow: "amber", isImg: true },
                  ].map((item, i) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + i * 0.15, type: "spring", stiffness: 300 }}
                      className="relative flex flex-col items-center z-10"
                    >
                      {/* Glow behind circle - radial gradient on Android */}
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                        className={`absolute top-0 w-16 h-16 rounded-full fx-glow ${isAndroid ? '' : `bg-${item.glow}-500/40 blur-xl`}`}
                        style={isAndroid ? {
                          background: item.glow === 'violet' ? 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)' :
                                     item.glow === 'fuchsia' ? 'radial-gradient(circle, rgba(217,70,239,0.4) 0%, transparent 70%)' :
                                     item.glow === 'cyan' ? 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)' :
                                     'radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)'
                        } : undefined}
                      />
                      
                      {/* Step circle */}
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg shadow-${item.glow}-500/30 ring-2 ring-white/20`}
                      >
                        {item.isImg ? (
                          <img src={item.icon} alt="" width={36} height={36} className="w-9 h-9 object-contain" style={{ aspectRatio: '1/1' }} />
                        ) : (
                          <span className="text-3xl">{item.icon}</span>
                        )}
                        
                        {/* Step number badge */}
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-white/30 flex items-center justify-center">
                          <span className="text-[10px] font-black text-white">{item.step}</span>
                        </div>
                      </motion.div>
                      
                      {/* Label */}
                      <div className="mt-3 text-center">
                        <p className="text-[12px] font-bold text-white">{item.label}</p>
                        <p className="text-[10px] text-white/40">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Full Rules Section */}
                <div className="relative mt-6 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <span className="text-lg">📋</span>
                    <span className="text-[13px] font-bold text-white/80">Правила участия</span>
                  </div>
                  
                  <div className="space-y-2.5 mb-4">
                    {[
                      { icon: "📅", title: "Еженедельный турнир", desc: "Соревнование длится с понедельника по воскресенье" },
                      { icon: "🔄", title: "Сброс рейтинга", desc: "Каждое воскресенье в 00:00 МСК очки обнуляются" },
                      { icon: "🥇", title: "Топ-3 получают призы", desc: "1 место — 1000₽, 2 место — 500₽, 3 место — 250₽" },
                      { icon: "💰", title: "Быстрая выплата", desc: "Призы переводятся на карту в течение 24 часов" },
                      { icon: "👥", title: "Минимум участников", desc: "Для розыгрыша нужно минимум 3 игрока" },
                    ].map((rule, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1 + i * 0.08 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">{rule.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white/90">{rule.title}</p>
                          <p className="text-[10px] text-white/50 leading-relaxed">{rule.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Channel Subscription - Required */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5 }}
                    className="p-3 rounded-xl bg-gradient-to-r from-[#2AABEE]/20 to-[#1E96D1]/10 border border-[#2AABEE]/30"
                  >
                    <div className="flex items-center gap-3">
                      {/* Telegram icon */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2AABEE] to-[#1E96D1] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#2AABEE]/30">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[12px] font-bold text-white">Чернила и Кровь</p>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/20 text-red-400 uppercase">Обязательно</span>
                        </div>
                        <p className="text-[10px] text-white/50">Подпишись на канал для участия в розыгрыше</p>
                      </div>
                      
                      {/* Subscribe button */}
                      <a
                        href="https://t.me/dark_bookshelf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#2AABEE] hover:bg-[#1E96D1] text-white text-[10px] font-bold transition-colors flex-shrink-0"
                      >
                        Подписаться
                      </a>
                    </div>
                  </motion.div>

                  {/* Additional info */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.6 }}
                    className="text-center text-[9px] text-white/30 mt-3"
                  >
                    Победители объявляются в канале каждое воскресенье
                  </motion.p>
                </div>
              </div>
            </motion.div>

            {/* ═══ CTA BUTTON — Animated ═══ */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic.heavy();
                router.push("/miniapp/leaderboard");
              }}
              className="relative w-full h-14 rounded-xl overflow-hidden group"
            >
              {/* Button gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-[length:200%_100%] group-hover:animate-shimmer" />
              
              {/* Shine effect */}
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
              />
              
              {/* Button content */}
              <div className="relative flex items-center justify-center gap-3 h-full">
                <span className="text-xl">🏆</span>
                <span className="text-[15px] font-bold text-white">Смотреть рейтинг</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-white/80"
                >
                  →
                </motion.span>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ─────────────────────────────────────────────────────────────────
          TOURNAMENTS — кликабельный блок ведёт на /miniapp/tournaments
      ───────────────────────────────────────────────────────────────── */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          haptic.medium();
          router.push("/miniapp/tournaments");
        }}
        className="cursor-pointer"
      >
        <Card title="Турниры" badge={
          <span className="text-2xl">⚔️</span>
        }>
          {/* Активные/Предстоящие турниры */}
          {hasActiveTournaments ? (
            <div className="flex flex-col gap-2">
              {displayTournaments.map((t) => (
                <Row
                  key={t.id}
                  icon={
                    <div 
                      className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
                      style={{ 
                        background: `linear-gradient(to bottom right, ${t.gradient.from}, ${t.gradient.to})` 
                      }}
                    >
                      <span className="text-2xl">{t.icon || "🏆"}</span>
                    </div>
                  }
                  title={t.title}
                  subtitle={
                    t.status === "ACTIVE" ? (
                      <span className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-emerald-600 font-semibold">
                          {t.timeRemaining ? `Осталось ${t.timeRemaining.label}` : "Идёт сейчас"}
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <span className="text-xs">📅</span> 
                        {t.timeRemaining ? `Через ${t.timeRemaining.label}` : "Скоро начнётся"}
                      </span>
                    )
                  }
                  trailing={<Chevron />}
                />
              ))}
            </div>
          ) : showFinishedFallback ? (
            /* Показываем последний завершённый турнир */
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
                <div 
                  className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${lastFinishedTournament.gradient.from}, ${lastFinishedTournament.gradient.to})` 
                  }}
                >
                  <span className="text-2xl">{lastFinishedTournament.icon || "🏆"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-slate-700">{lastFinishedTournament.title}</p>
                  <p className="text-[12px] text-amber-600 font-medium">Завершён • {lastFinishedTournament.participantsCount} участников</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xl">🏅</span>
                  <span className="text-[10px] text-slate-500">Итоги</span>
                </div>
              </div>
              
              {/* Призовые места */}
              {lastFinishedTournament.prizes.length > 0 && (
                <div className="flex gap-2 justify-center">
                  {lastFinishedTournament.prizes.slice(0, 3).map((prize, idx) => (
                    <div key={prize.place} className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-50">
                      <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {prize.type === "XP" ? `${prize.value} XP` : prize.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Нет турниров вообще */
            <div className="flex flex-col items-center py-6 text-center">
              <span className="text-4xl mb-2">🎮</span>
              <p className="text-[14px] font-semibold text-slate-600">Турниры скоро появятся</p>
              <p className="text-[12px] text-slate-400 mt-1">Следите за обновлениями!</p>
            </div>
          )}
          
          {/* CTA */}
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 py-3 border border-violet-500/20">
            <span className="text-sm font-semibold text-violet-600">
              {hasActiveTournaments ? "Смотреть все турниры" : showFinishedFallback ? "Смотреть итоги" : "Все турниры"}
            </span>
            <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </Card>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────────
          SPECIAL EVENTS — 2 columns
      ───────────────────────────────────────────────────────────────── */}
      <Card title="Спецпроекты" badge={<span className="text-2xl">🎯</span>}>
        <div className="grid grid-cols-2 gap-3">
          {events.map((e) => (
            <motion.div
              key={e.id}
              whileTap={{ scale: 0.97 }}
              className="flex h-24 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] text-center shadow-lg"
            >
              <div className="flex h-8 w-8 items-center justify-center">{e.icon}</div>
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

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm offscreen-optimized" style={{ contain: 'layout' }}>
      {/* Header — h-6 */}
      <div className="mb-3 flex h-6 items-center justify-between">
        <h3 className="font-display text-[15px] font-bold text-[#1a1a2e]">{title}</h3>
        {badge && <span className="flex items-center justify-center">{badge}</span>}
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
  subtitle?: React.ReactNode;
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
