"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type ActivityType = 
  | "QUIZ_COMPLETED"
  | "QUIZ_HIGH_SCORE"
  | "ACHIEVEMENT_UNLOCKED"
  | "LEVEL_UP"
  | "TOURNAMENT_JOIN"
  | "TOURNAMENT_STAGE"
  | "TOURNAMENT_WIN"
  | "FRIEND_ADDED"
  | "STREAK_MILESTONE";

type ActivityUser = {
  id: number;
  firstName: string | null;
  username: string | null;
  photoUrl: string | null;
  xp: number;
};

type Activity = {
  id: number;
  type: ActivityType;
  title: string;
  icon: string;
  data: Record<string, unknown>;
  createdAt: string;
  user: ActivityUser;
};

type FeedResponse = {
  activities: Activity[];
  nextCursor: number | null;
  hasMore: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════

function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} д назад`;
  
  return then.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getActivityColor(type: ActivityType): string {
  switch (type) {
    case "QUIZ_COMPLETED":
      return "from-violet-500/20 to-purple-500/20 border-violet-500/30";
    case "QUIZ_HIGH_SCORE":
      return "from-amber-500/20 to-orange-500/20 border-amber-500/30";
    case "ACHIEVEMENT_UNLOCKED":
      return "from-emerald-500/20 to-green-500/20 border-emerald-500/30";
    case "LEVEL_UP":
      return "from-blue-500/20 to-cyan-500/20 border-blue-500/30";
    case "TOURNAMENT_JOIN":
    case "TOURNAMENT_STAGE":
      return "from-red-500/20 to-pink-500/20 border-red-500/30";
    case "TOURNAMENT_WIN":
      return "from-yellow-500/20 to-amber-500/20 border-yellow-500/30";
    case "FRIEND_ADDED":
      return "from-pink-500/20 to-rose-500/20 border-pink-500/30";
    case "STREAK_MILESTONE":
      return "from-orange-500/20 to-red-500/20 border-orange-500/30";
    default:
      return "from-slate-500/20 to-gray-500/20 border-slate-500/30";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ ЭЛЕМЕНТА ЛЕНТЫ
// ═══════════════════════════════════════════════════════════════════════════

function ActivityItem({ activity, index }: { activity: Activity; index: number }) {
  const router = useRouter();
  
  const handleUserClick = () => {
    router.push(`/miniapp/profile?userId=${activity.user.id}`);
  };

  const handleActivityClick = () => {
    // Navigate based on activity type
    if (activity.type === "QUIZ_COMPLETED" || activity.type === "QUIZ_HIGH_SCORE") {
      const quizId = activity.data.quizId;
      if (quizId) {
        router.push(`/miniapp/quiz/${quizId}`);
      }
    } else if (activity.type.startsWith("TOURNAMENT_")) {
      const tournamentId = activity.data.tournamentId;
      if (tournamentId) {
        router.push(`/miniapp/tournaments/${tournamentId}`);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`relative flex gap-3 p-3 rounded-xl bg-gradient-to-r ${getActivityColor(activity.type)} border backdrop-blur-sm`}
    >
      {/* Аватар пользователя */}
      <button
        onClick={handleUserClick}
        className="flex-shrink-0 group"
      >
        {activity.user.photoUrl ? (
          <img
            src={activity.user.photoUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20 group-hover:ring-white/40 transition-all"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20">
            {(activity.user.firstName?.[0] || activity.user.username?.[0] || "?").toUpperCase()}
          </div>
        )}
      </button>

      {/* Контент */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Имя пользователя */}
            <button
              onClick={handleUserClick}
              className="font-semibold text-white text-sm hover:text-violet-300 transition-colors truncate block"
            >
              {activity.user.firstName || activity.user.username || "Пользователь"}
            </button>
            
            {/* Описание активности */}
            <button
              onClick={handleActivityClick}
              className="text-white/70 text-xs mt-0.5 hover:text-white/90 transition-colors text-left"
            >
              {activity.title}
            </button>
          </div>

          {/* Иконка и время */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-xl">{activity.icon}</span>
            <span className="text-[10px] text-white/40">
              {formatTimeAgo(activity.createdAt)}
            </span>
          </div>
        </div>

        {/* Дополнительные данные (очки, место и т.д.) */}
        {(activity.data.score || activity.data.place) && (
          <div className="flex items-center gap-2 mt-2">
            {activity.data.score && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                {String(activity.data.score)} очков
              </span>
            )}
            {activity.data.place && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {String(activity.data.place)} место
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПУСТОЕ СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════════════

function EmptyFeed() {
  const router = useRouter();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 py-4 px-3"
    >
      <div className="text-2xl">👥</div>
      <div className="flex-1">
        <p className="text-white/60 text-sm">
          Добавьте друзей, чтобы видеть их активность
        </p>
      </div>
      <button
        onClick={() => router.push("/miniapp/profile")}
        className="px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
      >
        Найти
      </button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// СКЕЛЕТОН ЗАГРУЗКИ
// ═══════════════════════════════════════════════════════════════════════════

function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-xl bg-white/5 animate-pulse"
        >
          <div className="w-10 h-10 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded w-24" />
            <div className="h-3 bg-white/10 rounded w-full" />
          </div>
          <div className="w-6 h-6 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ГЛАВНЫЙ КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

type FriendsFeedProps = {
  userId: number;
  limit?: number;
  showHeader?: boolean;
  maxVisible?: number; // Максимум видимых событий (для скролла)
  className?: string;
};

export function FriendsFeed({ 
  userId, 
  limit = 10, 
  showHeader = true,
  maxVisible = 3, // По умолчанию 3 видимых события
  className = "" 
}: FriendsFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFeed = useCallback(async (cursor?: number) => {
    if (!userId || isNaN(userId)) {
      setError("Пользователь не определён");
      setLoading(false);
      return;
    }
    
    try {
      const params = new URLSearchParams({
        userId: String(userId),
        limit: String(limit),
      });
      if (cursor) params.set("cursor", String(cursor));

      const res = await fetch(`/api/friends/feed?${params}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data: FeedResponse = await res.json();
      
      if (cursor) {
        setActivities(prev => [...prev, ...data.activities]);
      } else {
        setActivities(data.activities);
      }
      
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      setLoadingMore(true);
      fetchFeed(nextCursor);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        {showHeader && (
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Лента друзей</h3>
            <div className="w-16 h-4 bg-white/10 rounded animate-pulse" />
          </div>
        )}
        <FeedSkeleton count={maxVisible} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-xl bg-red-500/10 border border-red-500/20 ${className}`}>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span>👥</span>
            <span>Лента друзей</span>
          </h3>
          {activities.length > 0 && (
            <span className="text-xs text-white/40">
              {activities.length} событий
            </span>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {activities.length === 0 ? (
          <EmptyFeed />
        ) : (
          <div className="relative">
            {/* Скролл-контейнер с ограниченной высотой */}
            <div 
              className="space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-1"
              style={{ maxHeight: `${maxVisible * 72 + (maxVisible - 1) * 8}px` }} // ~72px на событие + gap
            >
              {activities.map((activity, index) => (
                <ActivityItem 
                  key={activity.id} 
                  activity={activity} 
                  index={index}
                />
              ))}

              {/* Кнопка "Загрузить ещё" внутри скролла */}
              {hasMore && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 text-center text-sm text-white/50 hover:text-white/70 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Загрузка..." : "Показать ещё"}
                </motion.button>
              )}
            </div>
            
            {/* Градиент-индикатор скролла снизу */}
            {activities.length > maxVisible && (
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0f0f1a] to-transparent pointer-events-none" />
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FriendsFeed;
