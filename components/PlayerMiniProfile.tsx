"use client";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PLAYER MINI PROFILE — Модальное окно мини-профиля игрока
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Показывает краткую информацию об игроке с возможностью:
 * - Добавить в друзья
 * - Вызвать на дуэль
 * - Перейти в полный профиль
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

interface PlayerData {
  id: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  score?: number;
  place?: number;
}

interface PlayerStats {
  level: number;
  xp: number;
  totalScore: number;
  totalGames: number;
  accuracy: number;
  duelWins?: number;
  duelCount?: number;
  winRate?: number;
}

interface PlayerMiniProfileProps {
  player: PlayerData | null;
  currentUserId: number | null;
  onClose: () => void;
}

const spring = { type: "spring", stiffness: 400, damping: 30 };

export function PlayerMiniProfile({ player, currentUserId, onClose }: PlayerMiniProfileProps) {
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "friend" | "loading">("loading");
  const [addingFriend, setAddingFriend] = useState(false);

  const isOwnProfile = player?.id === currentUserId;

  // Загрузка статистики игрока
  useEffect(() => {
    if (!player) return;

    const loadStats = async () => {
      setLoading(true);
      setFriendStatus("loading");

      try {
        const response = await api.get<{
          ok: boolean;
          stats?: {
            totalScore?: number;
            totalSessions?: number;
            totalCorrectAnswers?: number;
            totalAnswers?: number;
            xp?: { total: number; level: number };
          };
          user?: { xp?: number };
          isFriend?: boolean;
          friendshipStatus?: string | null;
          // Для бот-профилей
          xp?: { total: number; level: number };
          duelStats?: { wins: number; losses: number; winRate: number };
        }>(`/api/me/summary?userId=${player.id}`);

        if (response.ok) {
          // Определяем структуру ответа (обычный vs бот)
          const xpData = response.stats?.xp || response.xp;
          const totalScore = response.stats?.totalScore ?? player.score ?? 0;
          const totalGames = response.stats?.totalSessions ?? 0;
          const correctAnswers = response.stats?.totalCorrectAnswers ?? 0;
          const totalAnswers = response.stats?.totalAnswers ?? 1;
          const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

          setStats({
            level: xpData?.level ?? 1,
            xp: xpData?.total ?? 0,
            totalScore,
            totalGames,
            accuracy,
            duelWins: response.duelStats?.wins,
            duelCount: response.duelStats ? (response.duelStats.wins + response.duelStats.losses) : undefined,
            winRate: response.duelStats?.winRate ? Math.round(response.duelStats.winRate * 100) : undefined,
          });

          // Статус дружбы
          if (response.isFriend) {
            setFriendStatus("friend");
          } else if (response.friendshipStatus === "PENDING") {
            setFriendStatus("pending");
          } else {
            setFriendStatus("none");
          }
        }
      } catch (error) {
        console.error("[PlayerMiniProfile] Failed to load stats:", error);
        // Используем базовые данные
        setStats({
          level: 1,
          xp: 0,
          totalScore: player.score ?? 0,
          totalGames: 0,
          accuracy: 0,
        });
        setFriendStatus("none");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [player]);

  // Добавить в друзья
  const handleAddFriend = useCallback(async () => {
    if (!player || addingFriend || isOwnProfile) return;

    setAddingFriend(true);
    haptic.medium();

    try {
      const response = await api.post<{ ok: boolean }>("/api/friends", {
        friendId: player.id,
      });

      if (response.ok) {
        setFriendStatus("pending");
        haptic.success();
      }
    } catch {
      haptic.error();
    } finally {
      setAddingFriend(false);
    }
  }, [player, addingFriend, isOwnProfile]);

  // Вызвать на дуэль
  const handleChallenge = useCallback(() => {
    haptic.medium();
    // Переходим на страницу быстрой игры
    router.push("/miniapp/duels/quick");
    onClose();
  }, [router, onClose]);

  // Перейти в профиль
  const handleViewProfile = useCallback(() => {
    if (!player) return;
    haptic.light();
    router.push(`/miniapp/profile?userId=${player.id}`);
    onClose();
  }, [player, router, onClose]);

  if (!player) return null;

  const displayName = player.firstName || player.username || "Игрок";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={spring}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm"
        >
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header with gradient */}
            <div className="relative h-24 bg-gradient-to-r from-violet-600 to-indigo-600">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)]" />
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Place badge */}
              {player.place && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/30 text-white text-xs font-bold">
                  #{player.place}
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="relative -mt-12 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 animate-pulse opacity-50" />
                {player.photoUrl ? (
                  <Image
                    src={player.photoUrl}
                    alt=""
                    width={80}
                    height={80}
                    className="relative w-20 h-20 rounded-full object-cover border-4 border-zinc-900"
                  />
                ) : (
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 border-4 border-zinc-900 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {displayName[0].toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Level badge */}
                {stats && (
                  <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg">
                    Ур. {stats.level}
                  </div>
                )}
              </div>
            </div>

            {/* Name and score */}
            <div className="text-center px-4 pt-3 pb-4">
              <h3 className="text-lg font-bold text-white">
                {isOwnProfile ? "Это ты!" : displayName}
              </h3>
              {player.username && player.username !== player.firstName && (
                <p className="text-sm text-zinc-500">@{player.username}</p>
              )}
              {player.score !== undefined && (
                <p className="text-2xl font-black text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text mt-1">
                  {player.score} очков
                </p>
              )}
            </div>

            {/* Stats grid */}
            {loading ? (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ) : stats && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-white">{stats.totalGames}</p>
                    <p className="text-xs text-zinc-500">Игр</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-white">{stats.accuracy}%</p>
                    <p className="text-xs text-zinc-500">Точность</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-white">
                      {stats.winRate !== undefined ? `${stats.winRate}%` : stats.xp}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {stats.winRate !== undefined ? "Побед" : "XP"}
                    </p>
                  </div>
                </div>

                {/* Duel stats if available */}
                {stats.duelCount !== undefined && stats.duelCount > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-4 text-xs text-zinc-500">
                    <span>⚔️ {stats.duelCount} дуэлей</span>
                    <span>🏆 {stats.duelWins} побед</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="px-4 pb-4 space-y-2">
              {!isOwnProfile && (
                <>
                  {/* Add friend button */}
                  {friendStatus === "loading" ? (
                    <div className="w-full py-3 rounded-xl bg-zinc-800/50 text-zinc-500 text-center text-sm">
                      Загрузка...
                    </div>
                  ) : friendStatus === "none" ? (
                    <button
                      onClick={handleAddFriend}
                      disabled={addingFriend}
                      className="w-full py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {addingFriend ? (
                        <>
                          <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                          <span>Отправка...</span>
                        </>
                      ) : (
                        <>
                          <span>👥</span>
                          <span>Добавить в друзья</span>
                        </>
                      )}
                    </button>
                  ) : friendStatus === "pending" ? (
                    <div className="w-full py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-400 font-medium text-center">
                      ✓ Заявка отправлена
                    </div>
                  ) : (
                    <div className="w-full py-3 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 font-medium text-center">
                      ✓ В друзьях
                    </div>
                  )}

                  {/* Challenge button */}
                  <button
                    onClick={handleChallenge}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-medium shadow-lg shadow-red-900/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>⚔️</span>
                    <span>Вызвать на дуэль</span>
                  </button>
                </>
              )}

              {/* View profile button */}
              <button
                onClick={handleViewProfile}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-all active:scale-95"
              >
                👤 {isOwnProfile ? "Открыть профиль" : "Полный профиль"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}



