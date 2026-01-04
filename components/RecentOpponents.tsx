"use client";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * RECENT OPPONENTS — Секция недавних соперников в профиле
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Показывает последних 10 уникальных соперников по дуэлям с возможностью:
 * - Добавить в друзья (если не друг)
 * - Вызвать на реванш
 * - Перейти в профиль
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

type DuelResult = "win" | "lose" | "draw";

interface RecentOpponent {
  id: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  level: number;
  xp: number;
  lastDuelId: string;
  lastDuelQuizId: number;
  lastDuelDate: string;
  result: DuelResult;
  myScore: number;
  opponentScore: number;
  isFriend: boolean;
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted";
}

interface RecentOpponentsProps {
  className?: string;
}

export function RecentOpponents({ className = "" }: RecentOpponentsProps) {
  const router = useRouter();
  const [opponents, setOpponents] = useState<RecentOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingFriend, setAddingFriend] = useState<number | null>(null);
  const [rematchingId, setRematchingId] = useState<number | null>(null);
  const [rematchSentIds, setRematchSentIds] = useState<Set<number>>(new Set());

  // Загрузка соперников
  useEffect(() => {
    const loadOpponents = async () => {
      try {
        const data = await api.get<{
          ok: boolean;
          opponents: RecentOpponent[];
          total: number;
        }>("/api/me/recent-opponents");

        if (data.ok) {
          setOpponents(data.opponents);
        } else {
          setError("Не удалось загрузить");
        }
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    };

    loadOpponents();
  }, []);

  // Добавить в друзья
  const handleAddFriend = async (opponent: RecentOpponent) => {
    if (addingFriend === opponent.id) return;

    setAddingFriend(opponent.id);
    haptic.medium();

    try {
      const response = await api.post<{ ok: boolean }>("/api/friends", {
        friendId: opponent.id,
      });

      if (response.ok) {
        // Обновляем локально
        setOpponents((prev) =>
          prev.map((o) =>
            o.id === opponent.id
              ? { ...o, friendshipStatus: "pending_sent" }
              : o
          )
        );
        haptic.success();
      }
    } catch {
      haptic.error();
    } finally {
      setAddingFriend(null);
    }
  };

  // Реванш — создаём новую дуэль с тем же оппонентом и квизом
  const handleRematch = async (opponent: RecentOpponent) => {
    if (rematchingId === opponent.id) return;
    
    setRematchingId(opponent.id);
    haptic.medium();
    
    try {
      // Проверяем что оппонент друг (иначе API не разрешит создать дуэль)
      if (opponent.friendshipStatus !== "accepted") {
        // Если не друг — переходим в быстрый поиск с этим квизом
        setRematchingId(null);
        router.push(`/miniapp/duels/quick?quizId=${opponent.lastDuelQuizId}`);
        return;
      }
      
      // Создаём дуэль с другом
      const response = await api.post<{
        ok: boolean;
        duel?: { id: string };
        duelId?: string; // При DUEL_ALREADY_EXISTS
        error?: string;
      }>("/api/duels", {
        opponentId: opponent.id,
        quizId: opponent.lastDuelQuizId,
      });
      
      if (response.ok && response.duel) {
        // Вызов отправлен — показываем статус
        haptic.success();
        setRematchSentIds(prev => new Set(prev).add(opponent.id));
      } else if (response.error === "DUEL_ALREADY_EXISTS" && response.duelId) {
        // Уже есть активная дуэль — пробуем принять (если мы оппонент и статус PENDING)
        try {
          const acceptResponse = await api.patch<{
            ok: boolean;
            duel?: { status: string };
            error?: string;
          }>(`/api/duels/${response.duelId}`, { action: "accept" });
          
          if (acceptResponse.ok) {
            // Дуэль принята — переходим к игре
            haptic.success();
            router.push(`/miniapp/duels/${response.duelId}`);
          } else {
            // Не удалось принять — просто переходим
            haptic.medium();
            router.push(`/miniapp/duels/${response.duelId}`);
          }
        } catch {
          router.push(`/miniapp/duels/${response.duelId}`);
        }
      } else {
        console.error("[Rematch] Failed:", response.error);
        haptic.error();
      }
    } catch (error) {
      console.error("[Rematch] Error:", error);
      haptic.error();
    } finally {
      setRematchingId(null);
    }
  };

  // Переход в профиль
  const handleViewProfile = (opponent: RecentOpponent) => {
    haptic.light();
    router.push(`/miniapp/profile?userId=${opponent.id}`);
  };

  // Форматирование даты
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "только что";
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  // Иконка результата
  const getResultIcon = (result: DuelResult) => {
    switch (result) {
      case "win":
        return "🏆";
      case "lose":
        return "💀";
      case "draw":
        return "🤝";
    }
  };

  // Цвет результата
  const getResultColor = (result: DuelResult) => {
    switch (result) {
      case "win":
        return "text-yellow-400";
      case "lose":
        return "text-red-400";
      case "draw":
        return "text-zinc-400";
    }
  };

  // Если загрузка или ошибка
  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Недавние соперники</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-32 h-40 bg-zinc-800/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || opponents.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Недавние соперники</h3>
        </div>
        <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <div className="text-3xl mb-2">🎯</div>
          <p className="text-zinc-500 text-sm">
            {error || "Пока нет соперников"}
          </p>
          <button
            onClick={() => {
              haptic.medium();
              router.push("/miniapp/duels/quick");
            }}
            className="mt-4 px-4 py-2 text-sm bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg transition-all"
          >
            🔍 Найти соперника
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Недавние соперники</h3>
        <span className="text-xs text-zinc-500">{opponents.length} игрок(ов)</span>
      </div>

      {/* Горизонтальный скролл */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <AnimatePresence>
          {opponents.map((opponent, index) => (
            <motion.div
              key={opponent.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex-shrink-0 w-36"
            >
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-3 h-full">
                {/* Аватар с результатом */}
                <div className="relative mb-3">
                  <button
                    onClick={() => handleViewProfile(opponent)}
                    className="w-16 h-16 mx-auto rounded-full overflow-hidden border-2 border-zinc-700 hover:border-zinc-500 transition-colors"
                  >
                    {opponent.photoUrl ? (
                      <Image
                        src={opponent.photoUrl}
                        alt=""
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized // Внешние URL (Telegram/DiceBear)
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xl">
                        {opponent.firstName?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </button>
                  {/* Значок результата */}
                  <div
                    className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-lg ${
                      opponent.result === "win"
                        ? "bg-yellow-600"
                        : opponent.result === "lose"
                        ? "bg-red-900"
                        : "bg-zinc-700"
                    }`}
                  >
                    {getResultIcon(opponent.result)}
                  </div>
                </div>

                {/* Имя и уровень */}
                <div className="text-center mb-2">
                  <button
                    onClick={() => handleViewProfile(opponent)}
                    className="font-medium text-white text-sm hover:text-red-400 transition-colors line-clamp-1"
                  >
                    {opponent.firstName || opponent.username || "Игрок"}
                  </button>
                  <p className="text-xs text-zinc-500">Ур. {opponent.level}</p>
                </div>

                {/* Счёт */}
                <div className="text-center mb-2">
                  <span className={`text-xs font-medium ${getResultColor(opponent.result)}`}>
                    {opponent.myScore} : {opponent.opponentScore}
                  </span>
                </div>

                {/* Дата */}
                <p className="text-center text-xs text-zinc-600 mb-3">
                  {formatDate(opponent.lastDuelDate)}
                </p>

                {/* Кнопки */}
                <div className="space-y-2">
                  {/* Добавить в друзья */}
                  {opponent.friendshipStatus === "none" && (
                    <button
                      onClick={() => handleAddFriend(opponent)}
                      disabled={addingFriend === opponent.id}
                      className="w-full py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-lg transition-all disabled:opacity-50"
                    >
                      {addingFriend === opponent.id ? "..." : "👥 В друзья"}
                    </button>
                  )}
                  {opponent.friendshipStatus === "pending_sent" && (
                    <div className="w-full py-1.5 text-xs bg-zinc-800/50 border border-zinc-700 text-zinc-500 rounded-lg text-center">
                      ✓ Заявка
                    </div>
                  )}
                  {opponent.friendshipStatus === "pending_received" && (
                    <div className="w-full py-1.5 text-xs bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-lg text-center">
                      📩 Ждёт ответа
                    </div>
                  )}
                  {opponent.friendshipStatus === "accepted" && (
                    <div className="w-full py-1.5 text-xs bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 rounded-lg text-center">
                      ✓ Друг
                    </div>
                  )}

                  {/* Реванш */}
                  <button
                    onClick={() => handleRematch(opponent)}
                    disabled={rematchingId === opponent.id || rematchSentIds.has(opponent.id)}
                    className="w-full py-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rematchSentIds.has(opponent.id) ? "✅ Отправлен" : rematchingId === opponent.id ? "⏳..." : "🔄 Реванш"}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

