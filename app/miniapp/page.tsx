"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "./layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonQuizCard, SkeletonProfileHeader } from "@/components/Skeleton";
import { usePerformance } from "@/lib/usePerformance";
import { fetchWithAuth } from "@/lib/api";

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
};

type LeaderboardPosition = {
  place: number;
  score: number;
  totalPlayers: number;
  topScore: number;
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

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (session.status !== "ready") return;
    
    setLoading(true);
    setError(null);
    try {
      // Передаём userId для получения информации о лимитах
      const quizzesRes = await fetchWithAuth(`/api/quiz?userId=${session.user.id}`);
      const quizzesData = await quizzesRes.json() as QuizSummary[];
      setQuizzes(quizzesData);
      
      // Инициализируем countdowns из серверных данных
      // ВАЖНО: Energy в приоритете над Rate limit (если энергия кончилась, показываем её)
      const newCountdowns: Record<number, number> = {};
      
      // Глобальная энергия — берём из первого квиза (теперь одинаковая для всех)
      const firstQuiz = quizzesData[0];
      const globalEnergy = firstQuiz?.limitInfo?.remaining ?? 5;
      const maxEnergy = firstQuiz?.limitInfo?.maxAttempts ?? 5;
      
      for (const quiz of quizzesData) {
        if (quiz.limitInfo) {
          if (quiz.limitInfo.energyWaitMs && quiz.limitInfo.energyWaitMs > 0) {
            // Energy depleted — показываем сколько ждать до +1 энергии
            newCountdowns[quiz.id] = Math.ceil(quiz.limitInfo.energyWaitMs / 1000);
          } else if (quiz.limitInfo.rateLimitWaitSeconds && quiz.limitInfo.rateLimitWaitSeconds > 0) {
            // Rate limit — секунды между попытками
            newCountdowns[quiz.id] = quiz.limitInfo.rateLimitWaitSeconds;
          }
        }
      }
      setCountdowns(newCountdowns);
      
      // Обновляем глобальную энергию в userStats
      setUserStats(prev => ({ 
        ...prev, 
        totalQuizzesPlayed: prev?.totalQuizzesPlayed ?? 0,
        totalScore: prev?.totalScore ?? 0,
        minEnergy: globalEnergy, 
        maxEnergy 
      }));
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
        const statsRes = await fetchWithAuth(`/api/me/summary?userId=${session.user.id}`);
        const data = await statsRes.json();
        setUserStats(prev => ({
          totalQuizzesPlayed: data.stats?.totalQuizzesPlayed ?? 0,
          totalScore: data.stats?.totalScore ?? 0,
          minEnergy: prev?.minEnergy ?? 5,
          maxEnergy: prev?.maxEnergy ?? 5,
        }));
      } catch {
        // Ignore
      }
    }
  }, [fetchData, session]);

  // Fetch user stats
  useEffect(() => {
    if (session.status !== "ready") return;
    fetchWithAuth(`/api/me/summary?userId=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setUserStats(prev => ({
          totalQuizzesPlayed: data.stats?.totalQuizzesPlayed ?? 0,
          totalScore: data.stats?.totalScore ?? 0,
          minEnergy: prev?.minEnergy ?? 5,
          maxEnergy: prev?.maxEnergy ?? 5,
        }));
      })
      .catch(() => {
        setUserStats({ totalQuizzesPlayed: 0, totalScore: 0, minEnergy: 5, maxEnergy: 5 });
      });
  }, [session]);

  // Real-time online players via Server-Sent Events
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    
    const connect = () => {
      eventSource = new EventSource('/api/online');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setOnlinePlayers(data.count);
        } catch {
          // Ignore parse errors
        }
      };
      
      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };
    
    connect();
    
    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Fetch GLOBAL leaderboard position (sum of all quiz scores)
  useEffect(() => {
    if (session.status !== "ready") return;
    
    // Fetch global leaderboard (no quizId = global)
    fetchWithAuth(`/api/leaderboard`)
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
  }, [session]);

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

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-6 w-full overflow-x-hidden">
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
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>

        {/* Live Players Counter — centered */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[#1a1a2e] px-3 py-1.5"
        >
          <img src="/icons/6.PNG" alt="" className="h-6 w-6 object-contain" />
          <span className="text-xs font-medium text-white whitespace-nowrap">
            <span className="font-bold tabular-nums">{onlinePlayers}</span> <span className="text-white/50">играют сейчас</span>
          </span>
        </motion.div>

      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Centered Avatar + Stats (Duolingo/Headspace style)
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.section 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center py-4"
      >
        {/* Centered Avatar — clickable to profile */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            haptic.medium();
            router.push("/miniapp/profile");
          }}
          className="relative mb-4"
        >
          {/* Large diffused glow behind avatar - cyan/violet */}
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
          {/* Animated gradient ring — outer glow */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 opacity-60 animate-spin-slow gpu-accelerated" />
          {/* Animated gradient ring — sharp edge */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 opacity-80 animate-spin-slow gpu-accelerated" />
          
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt={name}
              className="relative h-24 w-24 rounded-full object-cover ring-[3px] ring-white shadow-xl"
            />
          ) : (
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d] ring-[3px] ring-white shadow-xl">
              <span className="text-3xl font-bold text-white">{avatarLetter}</span>
            </div>
          )}
          
          {/* Online indicator */}
          <div className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          </div>
        </motion.button>
        
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
            <img src="/icons/11.PNG" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-white tabular-nums">{userStats?.minEnergy ?? 5}</span>
          </motion.div>
          
          {/* Score pill */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 pl-1.5 pr-3 py-1 shadow-lg shadow-violet-500/25"
          >
            <img src="/icons/7.PNG" alt="" className="h-8 w-8 object-contain" />
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

            {/* Leaderboard Position */}
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
                    <img src="/icons/54.PNG" alt="" className="h-9 w-9 object-contain" />
                  ) : myPosition.place === 1 ? (
                    <img src="/icons/fire-medal.png" alt="1" className="h-8 w-8 object-contain" />
                  ) : myPosition.place === 2 ? (
                    <img src="/icons/medal.png" alt="2" className="h-7 w-7 object-contain" />
                  ) : myPosition.place === 3 ? (
                    <img src="/icons/medal.png" alt="3" className="h-7 w-7 object-contain" />
                  ) : (
                    <span className="text-[14px] font-black text-white">{myPosition.place}</span>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-bold text-white">
                  {!myPosition || myPosition.place === 0 
                    ? "Лидерборд" 
                    : `${myPosition.place} место`
                  }
                </p>
                <p className="text-[10px] text-white/40">
                  {myPosition?.score 
                    ? `${myPosition.score.toLocaleString()} очков →` 
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
          />
        </motion.div>
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
        <img src="/icons/54.PNG" alt="" className="h-12 w-12 object-contain" />
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
    { id: "t1", title: "Серийники 60-х", time: "20:00", icon: <img src="/icons/55.PNG" alt="" className="h-8 w-8 object-contain" />, bg: "from-[#2d132c] to-[#1a1a2e]" },
    { id: "t2", title: "Ночь культов", time: "12ч", icon: <img src="/icons/49.PNG" alt="" className="h-8 w-8 object-contain" />, bg: "from-[#1e3a5f] to-[#0d1b2a]" },
  ];

  const events = [
    { id: "e1", title: "Неделя загадок", tag: "Марафон", icon: <img src="/icons/28.PNG" alt="" className="h-8 w-8 object-contain" /> },
    { id: "e2", title: "Cold Cases", tag: "Нераскрытые", icon: <img src="/icons/29.PNG" alt="" className="h-8 w-8 object-contain" /> },
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
            <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
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
        {/* Animated spinning border - GPU optimized */}
        <div className="absolute -inset-[2px] rounded-[22px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 opacity-40" />
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
              
              {/* Treasure Chest with glow */}
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center"
              >
                {/* Glow effect - GPU optimized */}
                <div className="absolute inset-0 rounded-full glow-amber animate-pulse gpu-accelerated" />
                <div className="absolute inset-2 rounded-full glow-violet opacity-50" />
                
                {/* Chest image */}
                <img src="/icons/17.PNG" alt="" className="relative h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
              </motion.div>
            </div>

            {/* Prize Amount with counter effect */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, ...spring }}
              className="relative mb-4 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] px-4 py-4"
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
                    className="bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-[40px] font-black tabular-nums tracking-tight text-transparent"
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
                  className={`flex h-14 items-center gap-3 rounded-xl bg-gradient-to-r ${tier.bg} px-3 ring-1 ${tier.ring}`}
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
                { icon: <img src="/icons/56.PNG" alt="" className="h-7 w-7 object-contain" />, label: "Играй" },
                { icon: (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M3 20L9 14l4 4 8-10" stroke="url(#chartGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 8h4v4" stroke="url(#chartGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs><linearGradient id="chartGrad" x1="3" y1="20" x2="21" y2="8"><stop stopColor="#34D399"/><stop offset="1" stopColor="#10B981"/></linearGradient></defs>
                  </svg>
                ), label: "Набирай" },
                { icon: <img src="/icons/54.PNG" alt="" className="h-7 w-7 object-contain" />, label: "Побеждай" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    {step.icon}
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
      <Card title="Турниры" badge={
        <img src="/icons/2.PNG" alt="" className="h-8 w-8 object-contain rotate-90" />
      }>
        <div className="flex flex-col gap-2">
          {tournaments.map((t) => (
            <Row
              key={t.id}
              icon={
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.bg} shadow-lg`}>
                  {t.icon}
                </div>
              }
              title={t.title}
              subtitle={<span className="flex items-center gap-1"><img src="/icons/30.PNG" alt="" className="h-4 w-4 object-contain" /> Через {t.time}</span>}
              trailing={<Chevron />}
            />
          ))}
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────
          SPECIAL EVENTS — 2 columns
      ───────────────────────────────────────────────────────────────── */}
      <Card title="Спецпроекты" badge={<img src="/icons/8.PNG" alt="" className="h-8 w-8 object-contain" />}>
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
    <div className="rounded-2xl bg-white p-4 shadow-sm">
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
