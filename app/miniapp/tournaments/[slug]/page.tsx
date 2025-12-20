"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import { LottieAnimation } from "@/components/LottieAnimation";
import confettiAnimation from "@/public/animations/confetti.json";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type TournamentDetails = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  coverImage: string | null;
  gradient: { from: string; to: string };
  startsAt: string;
  endsAt: string;
  status: "UPCOMING" | "ACTIVE" | "FINISHED";
  type: string;
  minPlayers: number;
  maxPlayers: number | null;
  entryFee: number;
  participantsCount: number;
};

type Stage = {
  id: number;
  order: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  scoreMultiplier: number;
  quiz: {
    id: number;
    title: string;
    description: string | null;
    questionsCount: number;
  } | null;
  requirements: {
    topN: number | null;
    minScore: number | null;
  };
  myResult: {
    score: number;
    rank: number | null;
    passed: boolean;
    completedAt: string | null;
  } | null;
  status: "upcoming" | "active" | "finished";
};

type LeaderboardEntry = {
  rank: number;
  user: {
    id: number;
    firstName: string | null;
    username: string | null;
    photoUrl: string | null;
  };
  score: number;
  status: string;
};

type Prize = {
  place: number;
  title: string;
  description: string | null;
  icon: string;
  type: string;
  value: number;
  winner: {
    id: number;
    firstName: string | null;
    username: string | null;
    photoUrl: string | null;
  } | null;
  awardedAt: string | null;
};

type MyParticipation = {
  status: string;
  totalScore: number;
  rank: number | null;
  currentStage: number;
  joinedAt: string;
};

type TournamentResponse = {
  ok: boolean;
  tournament: TournamentDetails;
  stages: Stage[];
  leaderboard: LeaderboardEntry[];
  prizes: Prize[];
  myParticipation: MyParticipation | null;
  myRank: number | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════

const spring = { type: "spring", stiffness: 400, damping: 30 };

// ═══════════════════════════════════════════════════════════════════════════
// STAGE TIMER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function StageTimer({ 
  startsAt, 
  endsAt, 
  status 
}: { 
  startsAt: string; 
  endsAt: string; 
  status: "upcoming" | "active" | "finished";
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "critical">("normal");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const targetDate = status === "upcoming" 
        ? new Date(startsAt).getTime()
        : new Date(endsAt).getTime();
      
      const diff = targetDate - now;
      
      if (diff <= 0) {
        setTimeLeft(status === "upcoming" ? "Начинается!" : "Завершён");
        setUrgency("normal");
        return;
      }

      // Определяем urgency
      const hoursLeft = diff / (1000 * 60 * 60);
      if (hoursLeft < 1) {
        setUrgency("critical");
      } else if (hoursLeft < 6) {
        setUrgency("warning");
      } else {
        setUrgency("normal");
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}д ${hours}ч`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}ч ${minutes}м`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}м ${seconds}с`);
      } else {
        setTimeLeft(`${seconds}с`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startsAt, endsAt, status]);

  if (status === "finished") {
    return null;
  }

  const colors = {
    normal: "bg-slate-100 text-slate-600",
    warning: "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-600 animate-pulse",
  };

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${colors[urgency]}`}>
      <span>⏱️</span>
      <span className="tabular-nums">
        {status === "upcoming" ? "Через " : "Осталось "}
        {timeLeft}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const mountedRef = useRef(true);

  const [data, setData] = useState<TournamentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null); // Ошибка загрузки
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"stages" | "leaderboard" | "prizes">("stages");
  const [timeLeft, setTimeLeft] = useState("");

  // Cleanup при unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Загрузка данных турнира
  const loadTournament = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setLoadError(null); // Сброс ошибки при новой загрузке
    try {
      const response = await api.get<TournamentResponse>(`/api/tournaments/${slug}`);
      if (!mountedRef.current) return;
      setData(response);
    } catch (err) {
      console.error("Failed to load tournament:", err);
      if (mountedRef.current) {
        // Сохраняем сообщение об ошибке для отображения пользователю
        const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки";
        setLoadError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  // Таймер обратного отсчёта
  useEffect(() => {
    if (!data?.tournament) return;

    const updateTimer = () => {
      const now = Date.now();
      const targetDate =
        data.tournament.status === "UPCOMING"
          ? new Date(data.tournament.startsAt).getTime()
          : new Date(data.tournament.endsAt).getTime();

      const diff = targetDate - now;
      if (diff <= 0) {
        setTimeLeft("Завершено");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}д ${hours}ч ${minutes}м`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}ч ${minutes}м ${seconds}с`);
      } else {
        setTimeLeft(`${minutes}м ${seconds}с`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [data?.tournament]);

  // Регистрация на турнир
  const handleJoin = async () => {
    if (!data?.tournament) return;
    setJoining(true);
    setJoinError(null);

    try {
      await api.post(`/api/tournaments/${slug}`, {});
      haptic.success();
      setJoinSuccess(true);
      await loadTournament(); // Перезагружаем данные
      
      // Скрыть success через 3 секунды
      setTimeout(() => setJoinSuccess(false), 3000);
    } catch (err: unknown) {
      haptic.warning();
      const error = err as { message?: string };
      setJoinError(error.message || "Не удалось присоединиться");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5 min-h-screen bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ec] px-4 pt-3 pb-24 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between py-3">
          <div className="h-11 w-11 rounded-2xl bg-slate-200" />
          <div className="h-8 w-24 rounded-full bg-slate-200" />
          <div className="w-11" />
        </div>
        
        {/* Hero skeleton */}
        <div className="h-72 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-300" />
        
        {/* Status skeleton */}
        <div className="h-24 rounded-2xl bg-slate-200" />
        
        {/* Tabs skeleton */}
        <div className="h-14 rounded-2xl bg-slate-200" />
        
        {/* Content skeleton */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  // Обработка ошибок загрузки
  if (loadError || !data?.tournament) {
    const isNetworkError = !!loadError;
    return (
      <div className="flex h-screen flex-col items-center justify-center px-4">
        <span className="text-6xl mb-4">{isNetworkError ? "📡" : "😕"}</span>
        <p className="text-lg font-bold text-slate-600 text-center">
          {isNetworkError ? "Ошибка соединения" : "Турнир не найден"}
        </p>
        {isNetworkError && (
          <p className="text-sm text-slate-400 mt-1 text-center">
            {loadError}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          {isNetworkError && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={loadTournament}
              className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white"
            >
              Повторить
            </motion.button>
          )}
          <button
            onClick={() => router.back()}
            className="rounded-xl bg-slate-100 px-6 py-3 font-semibold text-slate-600"
          >
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  const { tournament, stages, leaderboard, prizes, myParticipation, myRank } = data;
  const isActive = tournament.status === "ACTIVE";
  const isUpcoming = tournament.status === "UPCOMING";
  const isFinished = tournament.status === "FINISHED";
  const isJoined = !!myParticipation;

  return (
    <div className="relative flex flex-col gap-5 min-h-screen bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ec] px-4 pt-3 pb-24">
      {/* Success celebration overlay */}
      <AnimatePresence>
        {joinSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative mx-4 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-8 text-center shadow-2xl"
            >
              {/* Confetti Lottie animation */}
              <div className="absolute inset-0 pointer-events-none">
                <LottieAnimation
                  animationData={confettiAnimation}
                  loop={false}
                  autoplay={true}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="relative text-6xl mb-4"
              >
                ⚔️
              </motion.div>
              <h2 className="relative text-2xl font-black text-white mb-2">
                Вы в игре!
              </h2>
              <p className="relative text-white/80 mb-4">
                Удачи в турнире "{tournament.title}"
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setJoinSuccess(false)}
                className="relative rounded-xl bg-white/20 px-6 py-3 font-bold text-white backdrop-blur"
              >
                Начать играть →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
          className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-lg ${
            isActive
              ? "bg-emerald-500"
              : isUpcoming
                ? "bg-amber-500"
                : "bg-slate-500"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isActive ? "animate-pulse bg-white" : "bg-white/50"}`} />
          <span className="text-[14px] font-semibold text-white">
            {isActive ? "Идёт сейчас" : isUpcoming ? "Скоро" : "Завершён"}
          </span>
        </motion.div>

        <div className="w-11" />
      </motion.header>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl p-6"
        style={{
          background: `linear-gradient(135deg, ${tournament.gradient.from}, ${tournament.gradient.to})`,
        }}
      >
        {/* Glow effects */}
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-white/5 blur-3xl" />

        <div className="relative">
          {/* Icon & Title */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-4xl">
              {tournament.icon}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{tournament.title}</h1>
              <p className="text-sm text-white/60">{stages.length} этап(ов)</p>
            </div>
          </div>

          {/* Description */}
          {tournament.description && (
            <p className="text-sm text-white/70 mb-4">{tournament.description}</p>
          )}

          {/* Timer */}
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-black/20 p-4 mb-4">
            <span className="text-2xl">⏱️</span>
            <div>
              <p className="text-xs text-white/50">
                {isUpcoming ? "До начала" : isActive ? "До конца" : "Завершён"}
              </p>
              <p className="text-2xl font-black text-white tabular-nums">{timeLeft}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-xl font-bold text-white">{tournament.participantsCount}</p>
              <p className="text-xs text-white/50">Участников</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-xl font-bold text-white">{stages.length}</p>
              <p className="text-xs text-white/50">Этапов</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-xl font-bold text-white">{prizes.length}</p>
              <p className="text-xs text-white/50">Призов</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          MY STATUS
      ═══════════════════════════════════════════════════════════════════ */}
      {isJoined && myParticipation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Ваша позиция</p>
              <p className="text-3xl font-black">#{myRank ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Очки</p>
              <p className="text-3xl font-black tabular-nums">
                {myParticipation.totalScore.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-3 text-sm opacity-80">
            Этап {myParticipation.currentStage} из {stages.length}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          JOIN BUTTON
      ═══════════════════════════════════════════════════════════════════ */}
      {!isJoined && !isFinished && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleJoin}
            disabled={joining}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-center text-lg font-bold text-white shadow-xl shadow-violet-500/25 disabled:opacity-50"
          >
            {joining ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Присоединяемся...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="text-xl">⚔️</span>
                {tournament.entryFee > 0
                  ? `Участвовать (${tournament.entryFee} XP)`
                  : "Участвовать бесплатно"}
              </span>
            )}
          </motion.button>

          {joinError && (
            <p className="mt-2 text-center text-sm text-red-500">{joinError}</p>
          )}

          {tournament.minPlayers > tournament.participantsCount && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Минимум {tournament.minPlayers} участников для розыгрыша призов
            </p>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-black/5">
        {[
          { id: "stages" as const, label: "Этапы", icon: "🎯" },
          { id: "leaderboard" as const, label: "Рейтинг", icon: "🏆" },
          { id: "prizes" as const, label: "Призы", icon: "🎁" },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => {
              haptic.selection();
              setActiveTab(tab.id);
            }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex-1 rounded-xl py-3 text-[14px] font-semibold transition-colors ${
              activeTab === tab.id ? "text-white" : "text-slate-400"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeDetailTab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] shadow-lg"
                transition={spring}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              <span>{tab.icon}</span>
              {tab.label}
            </span>
          </motion.button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {activeTab === "stages" && (
          <StagesTab key="stages" stages={stages} isJoined={isJoined} />
        )}
        {activeTab === "leaderboard" && (
          <LeaderboardTab key="leaderboard" leaderboard={leaderboard} myRank={myRank} />
        )}
        {activeTab === "prizes" && (
          <PrizesTab key="prizes" prizes={prizes} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGES TAB
// ═══════════════════════════════════════════════════════════════════════════

function StagesTab({
  stages,
  isJoined,
}: {
  stages: Stage[];
  isJoined: boolean;
}) {
  // useRouter вызывается внутри компонента — правильный паттерн
  const router = useRouter();
  
  // Подсчёт прогресса
  const completedCount = stages.filter((s) => s.myResult?.completedAt).length;
  const progress = stages.length > 0 ? (completedCount / stages.length) * 100 : 0;
  
  // Проверяем какие этапы можно играть (предыдущий должен быть пройден)
  const canPlayStage = (stageIndex: number): boolean => {
    if (stageIndex === 0) return true; // Первый этап всегда доступен
    const previousStage = stages[stageIndex - 1];
    return !!previousStage?.myResult?.completedAt && previousStage?.myResult?.passed !== false;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col gap-4"
    >
      {/* Progress bar */}
      {isJoined && (
        <div className="rounded-2xl bg-white p-4 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Ваш прогресс</span>
            <span className="text-sm font-bold text-violet-600">
              {completedCount}/{stages.length} этапов
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Stages list with timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-slate-200" />
        
        <div className="flex flex-col gap-3">
          {stages.map((stage, index) => {
            const isCompleted = !!stage.myResult?.completedAt;
            const isLocked = stage.status === "upcoming";
            const isActive = stage.status === "active";
            // Проверяем: этап активен, пользователь участник, не пройден, 
            // И предыдущий этап успешно пройден (если не первый)
            const previousStageCompleted = canPlayStage(index);
            const canPlay = isActive && isJoined && !isCompleted && previousStageCompleted;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="relative"
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-4 z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold shadow-lg ${
                    isCompleted
                      ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                      : isActive
                        ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white animate-pulse"
                        : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {isCompleted ? "✓" : stage.order}
                </div>

                {/* Card */}
                <div
                  className={`ml-[72px] overflow-hidden rounded-2xl transition-all ${
                    isLocked
                      ? "bg-slate-50 opacity-60"
                      : isCompleted
                        ? "bg-gradient-to-r from-emerald-50 to-teal-50 ring-2 ring-emerald-500/20"
                        : isActive
                          ? "bg-white shadow-xl shadow-violet-500/10 ring-2 ring-violet-500/30"
                          : "bg-white shadow-lg"
                  }`}
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold ${isLocked ? "text-slate-400" : "text-slate-800"}`}>
                            {stage.title}
                          </h3>
                          {isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                              LIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {stage.type === "QUIZ" ? "🎯" : stage.type === "INVESTIGATION" ? "🔍" : "🧩"}{" "}
                          {stage.quiz?.questionsCount ?? 0} вопросов
                          {stage.scoreMultiplier > 1 && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                              ×{stage.scoreMultiplier} очков
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Score/Status badge + Timer */}
                      <div className="flex flex-col items-end gap-1">
                        {isCompleted && stage.myResult && (
                          <div className="text-right">
                            <p className="text-lg font-black text-emerald-600">
                              +{stage.myResult.score}
                            </p>
                            <p className="text-[10px] text-slate-500">очков</p>
                          </div>
                        )}
                        {!isCompleted && (
                          <StageTimer 
                            startsAt={stage.startsAt} 
                            endsAt={stage.endsAt} 
                            status={stage.status} 
                          />
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {stage.description && !isLocked && (
                      <p className="text-sm text-slate-500 mb-3">{stage.description}</p>
                    )}

                    {/* Requirements */}
                    {!isLocked && (stage.requirements.topN || stage.requirements.minScore) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {stage.requirements.topN && (
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                            🏆 Топ-{stage.requirements.topN} проходят
                          </span>
                        )}
                        {stage.requirements.minScore && (
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                            📊 Мин. {stage.requirements.minScore} очков
                          </span>
                        )}
                      </div>
                    )}

                    {/* Play button */}
                    {canPlay && stage.quiz && (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => {
                          if (!stage.quiz) return;
                          haptic.medium();
                          // Tournament stage tracking происходит автоматически в /api/quiz/[id]/finish
                          // через функцию processTournamentStage() которая:
                          // 1. Находит активный этап по quizId
                          // 2. Проверяет что предыдущие этапы пройдены
                          // 3. Применяет scoreMultiplier и сохраняет результат
                          router.push(`/miniapp/quiz/${stage.quiz.id}`);
                        }}
                        className="w-full rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-lg">▶️</span>
                          Начать этап
                        </span>
                      </motion.button>
                    )}

                    {/* Completed status */}
                    {isCompleted && stage.myResult && (
                      <div className="flex items-center justify-between rounded-xl bg-emerald-100/50 p-3">
                        <span className="text-sm font-medium text-emerald-700">
                          ✅ Этап пройден
                        </span>
                        {stage.myResult.rank && (
                          <span className="text-sm font-bold text-emerald-600">
                            #{stage.myResult.rank} место
                          </span>
                        )}
                      </div>
                    )}

                    {/* Locked message - либо по времени, либо по предыдущему этапу */}
                    {isLocked && (
                      <div className="flex items-center justify-center gap-2 py-2 text-slate-400">
                        <span className="text-lg">🔒</span>
                        <span className="text-sm">Этап ещё не начался</span>
                      </div>
                    )}
                    
                    {/* Blocked by previous stage */}
                    {!isLocked && isActive && !previousStageCompleted && isJoined && (
                      <div className="flex items-center justify-center gap-2 py-2 text-amber-600">
                        <span className="text-lg">⚠️</span>
                        <span className="text-sm">Сначала пройдите предыдущий этап</span>
                      </div>
                    )}
                    
                    {/* Not joined prompt */}
                    {isActive && !isJoined && (
                      <p className="text-center text-sm text-violet-600 font-medium py-2">
                        ⬆️ Присоединитесь к турниру чтобы играть
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════

function LeaderboardTab({
  leaderboard,
  myRank,
}: {
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
}) {
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col gap-4"
    >
      {leaderboard.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <motion.span 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block text-5xl mb-4"
          >
            👥
          </motion.span>
          <p className="text-lg font-semibold text-slate-600">Пока нет участников</p>
          <p className="text-sm text-slate-400 mt-1">Станьте первым!</p>
        </div>
      ) : (
        <>
          {/* Podium for top 3 */}
          {top3.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl">
              <div className="flex items-end justify-center gap-3">
                {/* 2nd place */}
                {top3[1] && (
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative mb-2">
                      {top3[1].user.photoUrl ? (
                        <img src={top3[1].user.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-4 ring-slate-400" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-xl font-bold text-white ring-4 ring-slate-400">
                          {(top3[1].user.firstName ?? top3[1].user.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-2xl">🥈</span>
                    </div>
                    <p className="text-xs font-medium text-white/70 truncate max-w-[80px]">
                      {top3[1].user.firstName ?? top3[1].user.username ?? "Игрок"}
                    </p>
                    <p className="text-sm font-bold text-white tabular-nums">{top3[1].score}</p>
                    <div className="mt-2 h-16 w-20 rounded-t-lg bg-gradient-to-t from-slate-500 to-slate-400" />
                  </motion.div>
                )}

                {/* 1st place */}
                {top3[0] && (
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center -mt-4"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-3xl mb-2"
                    >
                      👑
                    </motion.div>
                    <div className="relative mb-2">
                      {top3[0].user.photoUrl ? (
                        <img src={top3[0].user.photoUrl} alt="" className="h-18 w-18 rounded-full object-cover ring-4 ring-amber-400 shadow-lg shadow-amber-500/50" style={{ width: 72, height: 72 }} />
                      ) : (
                        <div className="flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-2xl font-bold text-white ring-4 ring-amber-400 shadow-lg shadow-amber-500/50" style={{ width: 72, height: 72 }}>
                          {(top3[0].user.firstName ?? top3[0].user.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-3xl">🥇</span>
                    </div>
                    <p className="text-sm font-bold text-white truncate max-w-[100px]">
                      {top3[0].user.firstName ?? top3[0].user.username ?? "Игрок"}
                    </p>
                    <p className="text-lg font-black text-amber-400 tabular-nums">{top3[0].score}</p>
                    <div className="mt-2 h-24 w-24 rounded-t-lg bg-gradient-to-t from-amber-500 to-amber-400" />
                  </motion.div>
                )}

                {/* 3rd place */}
                {top3[2] && (
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative mb-2">
                      {top3[2].user.photoUrl ? (
                        <img src={top3[2].user.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-4 ring-orange-400" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-lg font-bold text-white ring-4 ring-orange-400">
                          {(top3[2].user.firstName ?? top3[2].user.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-xl">🥉</span>
                    </div>
                    <p className="text-xs font-medium text-white/70 truncate max-w-[70px]">
                      {top3[2].user.firstName ?? top3[2].user.username ?? "Игрок"}
                    </p>
                    <p className="text-sm font-bold text-white tabular-nums">{top3[2].score}</p>
                    <div className="mt-2 h-12 w-16 rounded-t-lg bg-gradient-to-t from-orange-500 to-orange-400" />
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-lg">
              <div className="flex flex-col gap-2">
                {rest.map((entry, index) => {
                  const isMe = entry.rank === myRank;
                  return (
                    <motion.div
                      key={entry.user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                        isMe 
                          ? "bg-gradient-to-r from-violet-50 to-indigo-50 ring-2 ring-violet-500/30" 
                          : "bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      {/* Rank */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold text-slate-600">
                        {entry.rank}
                      </div>

                      {/* Avatar */}
                      {entry.user.photoUrl ? (
                        <img src={entry.user.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-bold text-white">
                          {(entry.user.firstName ?? entry.user.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                          {entry.user.firstName ?? entry.user.username ?? "Игрок"}
                          {isMe && <span className="ml-1 text-violet-500 font-bold">(вы)</span>}
                        </p>
                      </div>

                      {/* Score */}
                      <p className="font-bold text-slate-800 tabular-nums">
                        {entry.score.toLocaleString()}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIZES TAB
// ═══════════════════════════════════════════════════════════════════════════

function PrizesTab({ prizes }: { prizes: Prize[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col gap-4"
    >
      {/* Prize pool header */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-5 text-center text-white shadow-xl shadow-orange-500/30">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-5xl mb-2"
        >
          🏆
        </motion.div>
        <p className="text-sm opacity-80">Призовой фонд</p>
        <p className="text-3xl font-black">
          {prizes.reduce((sum, p) => sum + (p.type === "XP" ? p.value : 0), 0).toLocaleString()} XP
        </p>
      </div>

      {/* Prize list */}
      <div className="flex flex-col gap-3">
        {prizes.map((prize, index) => {
          const isTop3 = prize.place <= 3;
          const gradients = [
            "from-amber-400 via-yellow-400 to-amber-500", // 1st
            "from-slate-300 via-slate-200 to-slate-400",   // 2nd
            "from-orange-400 via-amber-400 to-orange-500", // 3rd
          ];

          return (
            <motion.div
              key={prize.place}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.08, type: "spring", stiffness: 300 }}
              whileHover={{ scale: 1.02 }}
              className={`relative overflow-hidden rounded-2xl ${
                isTop3
                  ? `bg-gradient-to-r ${gradients[prize.place - 1]} text-white shadow-xl`
                  : "bg-white shadow-lg"
              }`}
            >
              {/* Shimmer effect for top 3 */}
              {isTop3 && (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                />
              )}

              <div className="relative p-5">
                <div className="flex items-center gap-4">
                  {/* Place badge */}
                  <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${
                    isTop3 ? "bg-white/20" : "bg-slate-100"
                  }`}>
                    <span className="text-4xl">{prize.icon}</span>
                    {prize.place <= 3 && (
                      <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-slate-800 shadow-lg">
                        {prize.place}
                      </span>
                    )}
                  </div>

                  {/* Prize info */}
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${isTop3 ? "text-white/70" : "text-slate-500"}`}>
                      {prize.place} место
                    </p>
                    <p className={`text-xl font-black ${isTop3 ? "text-white" : "text-slate-800"}`}>
                      {prize.title}
                    </p>
                    {prize.description && (
                      <p className={`text-sm ${isTop3 ? "text-white/80" : "text-slate-500"}`}>
                        {prize.description}
                      </p>
                    )}
                  </div>

                  {/* Value badge */}
                  <div className={`rounded-xl px-3 py-2 ${
                    isTop3 ? "bg-white/20" : "bg-violet-100"
                  }`}>
                    <p className={`text-lg font-black ${isTop3 ? "text-white" : "text-violet-600"}`}>
                      {prize.value.toLocaleString()}
                    </p>
                    <p className={`text-[10px] font-medium ${isTop3 ? "text-white/70" : "text-violet-400"}`}>
                      {prize.type === "XP" ? "XP" : prize.type === "ENERGY" ? "⚡" : ""}
                    </p>
                  </div>
                </div>

                {/* Winner info */}
                {prize.winner && (
                  <div className={`mt-4 flex items-center gap-3 rounded-xl p-3 ${
                    isTop3 ? "bg-white/10" : "bg-emerald-50"
                  }`}>
                    <span className="text-lg">🎖️</span>
                    <div className="flex-1">
                      <p className={`text-xs ${isTop3 ? "text-white/70" : "text-slate-500"}`}>
                        Победитель
                      </p>
                      <p className={`font-bold ${isTop3 ? "text-white" : "text-emerald-700"}`}>
                        {prize.winner.firstName ?? prize.winner.username ?? "Игрок"}
                      </p>
                    </div>
                    {prize.winner.photoUrl && (
                      <img 
                        src={prize.winner.photoUrl} 
                        alt="" 
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white/50" 
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
