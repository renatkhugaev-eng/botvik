"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Tournament = {
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
  type: "QUIZ" | "INVESTIGATION" | "MIXED";
  timeRemaining: { ms: number; label: string } | null;
  myParticipation: {
    status: string;
    totalScore: number;
    rank: number | null;
    currentStage: number;
  } | null;
  participantsCount: number;
  minPlayers: number;
  stagesCount: number;
  prizes: {
    place: number;
    title: string;
    icon: string;
    type: string;
    value: number;
  }[];
};

type TournamentsResponse = {
  ok: boolean;
  tournaments: Tournament[];
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════

const spring = { type: "spring", stiffness: 400, damping: 30 };

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function TournamentsPage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "upcoming" | "finished">("active");

  // Cleanup при unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Загрузка турниров
  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusMap = {
        active: "ACTIVE",
        upcoming: "UPCOMING",
        finished: "FINISHED",
      };
      const response = await api.get<TournamentsResponse>(
        `/api/tournaments?status=${statusMap[activeTab]}`
      );
      if (!mountedRef.current) return;
      setTournaments(response.tournaments);
    } catch (err) {
      console.error("Failed to load tournaments:", err);
      if (mountedRef.current) {
        setError("Не удалось загрузить турниры");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  return (
    <div className="relative flex flex-col gap-5 min-h-screen bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ec] px-4 pt-3 pb-24">
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
          <span className="text-xl">⚔️</span>
          <span className="text-[14px] font-semibold text-white/90">Турниры</span>
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
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] via-[#2d1f3d] to-[#1a1a2e] p-6"
      >
        {/* Glow effects */}
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />

        <div className="relative text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="mx-auto mb-4 text-6xl"
          >
            🏆
          </motion.div>
          <h1 className="text-2xl font-black text-white">Соревнуйся и побеждай!</h1>
          <p className="mt-2 text-sm text-white/60">
            Участвуй в турнирах, набирай очки и выигрывай призы
          </p>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-black/5">
        {[
          { id: "active" as const, label: "Активные", icon: "🔥" },
          { id: "upcoming" as const, label: "Скоро", icon: "📅" },
          { id: "finished" as const, label: "Завершённые", icon: "🏁" },
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
                layoutId="activeTournamentTab"
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
          TOURNAMENTS LIST
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-12"
          >
            <span className="text-6xl mb-4">😔</span>
            <p className="text-lg font-bold text-slate-600">{error}</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={loadTournaments}
              className="mt-4 px-5 py-2.5 bg-slate-100 rounded-xl text-sm font-medium"
            >
              Повторить
            </motion.button>
          </motion.div>
        ) : tournaments.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center py-12"
          >
            <span className="text-6xl mb-4">
              {activeTab === "active" ? "😴" : activeTab === "upcoming" ? "📅" : "🏆"}
            </span>
            <p className="text-lg font-bold text-slate-600">
              {activeTab === "active"
                ? "Нет активных турниров"
                : activeTab === "upcoming"
                  ? "Скоро появятся новые турниры"
                  : "История пуста"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {activeTab === "active" && "Следите за обновлениями!"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            {tournaments.map((tournament, index) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                index={index}
                onClick={() => {
                  haptic.medium();
                  router.push(`/miniapp/tournaments/${tournament.slug}`);
                }}
                onStatusChange={() => {
                  // Перезагружаем список турниров при изменении статуса
                  setTimeout(() => loadTournaments(), 1000);
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOURNAMENT CARD
// ═══════════════════════════════════════════════════════════════════════════

// Хук для живого обратного отсчёта с callback при завершении
function useCountdown(
  targetDate: string | null, 
  shouldRun: boolean,
  onExpire?: () => void
) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [hasExpired, setHasExpired] = useState(false);
  
  // Стабильная ref для callback
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!targetDate || !shouldRun) {
      setTimeLeft(null);
      setHasExpired(false);
      return;
    }

    const target = new Date(targetDate).getTime();
    let expired = false;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Начался!");
        if (!expired) {
          expired = true;
          setHasExpired(true);
          // Вызываем callback для обновления данных
          onExpireRef.current?.();
        }
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
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}м ${seconds}с`);
      } else {
        setTimeLeft(`${seconds}с`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate, shouldRun]); // Убрали onExpire и hasExpired из зависимостей

  return { timeLeft, hasExpired };
}

function TournamentCard({
  tournament,
  index,
  onClick,
  onStatusChange,
}: {
  tournament: Tournament;
  index: number;
  onClick: () => void;
  onStatusChange?: () => void;
}) {
  const isActive = tournament.status === "ACTIVE";
  const isUpcoming = tournament.status === "UPCOMING";
  const isJoined = !!tournament.myParticipation;
  
  // Живой countdown: для UPCOMING — до старта, для ACTIVE — до конца
  const countdownTarget = isUpcoming ? tournament.startsAt : isActive ? tournament.endsAt : null;
  const { timeLeft: countdown, hasExpired } = useCountdown(
    countdownTarget, 
    isUpcoming || isActive,
    onStatusChange // Вызовется когда countdown закончится
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...spring }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl shadow-lg cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${tournament.gradient.from}, ${tournament.gradient.to})`,
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-50 blur-2xl"
        style={{ background: tournament.gradient.from }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl">
              {tournament.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{tournament.title}</h3>
              <p className="text-xs text-white/60">{tournament.stagesCount} этап(ов)</p>
            </div>
          </div>

          {/* Status badge with countdown */}
          <div
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isActive || (isUpcoming && hasExpired)
                ? "bg-emerald-500/20 text-emerald-300"
                : isUpcoming
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-slate-500/20 text-slate-300"
            }`}
          >
            {isActive || (isUpcoming && hasExpired) ? (
              <span className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {hasExpired ? "Начался!" : "Live"}
              </span>
            ) : isUpcoming ? (
              <span className="flex items-center gap-1 tabular-nums">
                ⏳ {countdown ?? "Скоро"}
              </span>
            ) : (
              "🏁 Завершён"
            )}
          </div>
        </div>

        {/* Description */}
        {tournament.description && (
          <p className="text-sm text-white/70 mb-4 line-clamp-2">{tournament.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">👥</span>
            <span className="text-sm font-semibold text-white">
              {tournament.participantsCount}
            </span>
          </div>
          {countdown && (
            <div className="flex items-center gap-1.5">
              <span className="text-lg">{isActive ? "🏁" : "⏱️"}</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {countdown}
              </span>
            </div>
          )}
        </div>

        {/* Prizes preview */}
        {tournament.prizes.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {tournament.prizes.slice(0, 3).map((prize) => (
              <div
                key={prize.place}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1"
              >
                <span className="text-sm">{prize.icon}</span>
                <span className="text-xs font-semibold text-white">{prize.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action button */}
        <div className="flex items-center justify-between">
          {isJoined ? (
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-sm font-semibold text-emerald-300">Участвуете</span>
              {tournament.myParticipation?.rank && (
                <span className="text-sm text-white/60">
                  • {tournament.myParticipation.rank} место
                </span>
              )}
            </div>
          ) : isActive || isUpcoming ? (
            <span className="text-sm font-semibold text-white/60">
              Нажмите чтобы присоединиться →
            </span>
          ) : (
            <span className="text-sm text-white/40">Турнир завершён</span>
          )}

          <svg
            className="h-5 w-5 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
