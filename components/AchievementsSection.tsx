"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import type { AchievementCategory, AchievementRarity } from "@/lib/achievements";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type AchievementData = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  xpReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  currentValue: number;
  secret?: boolean;
  requirement: {
    type: string;
    value: number;
  };
};

type AchievementsResponse = {
  ok: boolean;
  achievements: AchievementData[];
  stats: {
    total: number;
    unlocked: number;
    percentage: number;
    totalXpEarned: number;
    byRarity: Record<AchievementRarity, number>;
  };
  categories: Record<AchievementCategory, { name: string; icon: string; color: string }>;
  rarities: Record<AchievementRarity, { name: string; color: string; glow: string }>;
  justEarnedXp?: number;  // XP начисленный именно в этом запросе
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY TABS
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_ORDER: AchievementCategory[] = [
  "beginner",
  "quiz",
  "streak",
  "social",
  "score",
  "speed",
  "mastery",
  "special",
  "collector",
  "veteran",
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type AchievementsSectionProps = {
  compact?: boolean;
  onXpEarned?: (xpAmount: number) => void;  // Callback когда начислен XP
};

export const AchievementsSection = memo(function AchievementsSection({ compact = false, onXpEarned }: AchievementsSectionProps) {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | "all">("all");
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementData | null>(null);

  // Загрузка достижений
  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const response = await api.get<AchievementsResponse>("/api/achievements");
        setData(response);
        
        // Если был начислен XP СЕЙЧАС — уведомляем родителя для обновления UI
        if (response.justEarnedXp && response.justEarnedXp > 0 && onXpEarned) {
          onXpEarned(response.justEarnedXp);
        }
      } catch (err) {
        console.error("Failed to fetch achievements:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [onXpEarned]);

  // Фильтрация по категории
  const filteredAchievements = data?.achievements.filter(a => 
    selectedCategory === "all" || a.category === selectedCategory
  ) ?? [];

  // Сортировка: сначала разблокированные, потом по прогрессу
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return b.progress - a.progress;
  });

  const handleAchievementClick = useCallback((achievement: AchievementData) => {
    haptic.light();
    setSelectedAchievement(achievement);
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-center text-red-600">
        Не удалось загрузить достижения
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Достижения</p>
            <p className="text-2xl font-black">
              {data.stats.unlocked} / {data.stats.total}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Прогресс</p>
            <p className="text-2xl font-black">{data.stats.percentage}%</p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.stats.percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-white"
          />
        </div>
        
        {/* XP earned */}
        <p className="mt-2 text-center text-sm opacity-80">
          +{data.stats.totalXpEarned} XP заработано
        </p>
      </div>

      {/* Category tabs */}
      {!compact && (
        <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-2">
            <CategoryTab
              active={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
              icon="🏆"
              label="Все"
              count={data.achievements.filter(a => a.unlocked).length}
            />
            {CATEGORY_ORDER.map(cat => {
              const info = data.categories[cat];
              const count = data.achievements.filter(
                a => a.category === cat && a.unlocked
              ).length;
              const total = data.achievements.filter(a => a.category === cat).length;
              
              return (
                <CategoryTab
                  key={cat}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  icon={info.icon}
                  label={info.name}
                  count={count}
                  total={total}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements grid */}
      <div className={`grid gap-3 ${compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4"}`}>
        {(compact ? sortedAchievements.slice(0, 8) : sortedAchievements).map((achievement, index) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            rarities={data.rarities}
            onClick={() => handleAchievementClick(achievement)}
            delay={index * 0.02}
          />
        ))}
      </div>

      {/* Show more link for compact mode */}
      {compact && data.stats.total > 8 && (
        <button className="w-full rounded-xl bg-slate-100 py-3 text-center text-sm font-medium text-slate-600 hover:bg-slate-200">
          Показать все {data.stats.total} достижений →
        </button>
      )}

      {/* Achievement detail modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <AchievementModal
            achievement={selectedAchievement}
            rarities={data.rarities}
            onClose={() => setSelectedAchievement(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

// Display name for React DevTools
AchievementsSection.displayName = "AchievementsSection";

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function CategoryTab({
  active,
  onClick,
  icon,
  label,
  count,
  total,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
  total?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-violet-500 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <span>{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
      <span className={`text-xs ${active ? "text-white/70" : "text-slate-400"}`}>
        {count}{total ? `/${total}` : ""}
      </span>
    </button>
  );
}

function AchievementCard({
  achievement,
  rarities,
  onClick,
  delay,
}: {
  achievement: AchievementData;
  rarities: Record<AchievementRarity, { name: string; color: string; glow: string }>;
  onClick: () => void;
  delay: number;
}) {
  const rarityInfo = rarities[achievement.rarity];
  const isLocked = !achievement.unlocked;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      onClick={onClick}
      className={`relative flex flex-col items-center rounded-2xl p-3 transition-transform hover:scale-105 ${
        isLocked ? "bg-slate-100" : `bg-gradient-to-br from-white to-slate-50 shadow-lg ${rarityInfo.glow}`
      }`}
      style={{
        borderColor: isLocked ? undefined : rarityInfo.color,
        borderWidth: isLocked ? 0 : 2,
      }}
    >
      {/* Icon */}
      <div
        className={`mb-1 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
          isLocked ? "bg-slate-200 grayscale" : "bg-white shadow-sm"
        }`}
      >
        {isLocked && achievement.secret ? "❓" : achievement.icon}
      </div>

      {/* Progress bar for locked */}
      {isLocked && achievement.progress > 0 && !achievement.secret && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-violet-400"
            style={{ width: `${achievement.progress}%` }}
          />
        </div>
      )}

      {/* Checkmark for unlocked */}
      {!isLocked && (
        <div
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
          style={{ backgroundColor: rarityInfo.color }}
        >
          ✓
        </div>
      )}

      {/* Name (truncated) */}
      <p
        className={`mt-1 line-clamp-1 text-center text-[10px] font-medium ${
          isLocked ? "text-slate-400" : "text-slate-700"
        }`}
      >
        {isLocked && achievement.secret ? "???" : achievement.name}
      </p>
    </motion.button>
  );
}

function AchievementModal({
  achievement,
  rarities,
  onClose,
}: {
  achievement: AchievementData;
  rarities: Record<AchievementRarity, { name: string; color: string; glow: string }>;
  onClose: () => void;
}) {
  const rarityInfo = rarities[achievement.rarity];
  const isLocked = !achievement.unlocked;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div
          className="p-6 text-center text-white"
          style={{
            background: isLocked
              ? "linear-gradient(135deg, #64748b, #475569)"
              : `linear-gradient(135deg, ${rarityInfo.color}, ${rarityInfo.color}cc)`,
          }}
        >
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-5xl backdrop-blur-sm">
            {isLocked && achievement.secret ? "❓" : achievement.icon}
          </div>
          <h2 className="text-xl font-black">
            {isLocked && achievement.secret ? "Секретное достижение" : achievement.name}
          </h2>
          <p className="mt-1 text-sm opacity-80">{rarityInfo.name}</p>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-center text-slate-600">
            {isLocked && achievement.secret
              ? "Выполни секретное условие, чтобы узнать что это!"
              : achievement.description}
          </p>

          {/* Progress */}
          {isLocked && !achievement.secret && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-500">Прогресс</span>
                <span className="font-medium text-slate-700">
                  {achievement.currentValue} / {achievement.requirement.value}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${achievement.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Reward */}
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-3">
            <span className="text-xl">✨</span>
            <span className="font-bold text-amber-700">+{achievement.xpReward} XP</span>
          </div>

          {/* Unlocked date */}
          {achievement.unlockedAt && (
            <p className="mt-3 text-center text-xs text-slate-400">
              Получено {new Date(achievement.unlockedAt).toLocaleDateString("ru-RU")}
            </p>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-slate-100 py-3 font-medium text-slate-600 hover:bg-slate-200"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION POPUP — Показывает новые достижения
// ═══════════════════════════════════════════════════════════════════════════

type AchievementNotificationProps = {
  achievements: { id: string; name: string; icon: string; xpReward: number }[];
  onClose: () => void;
};

export function AchievementNotification({ achievements, onClose }: AchievementNotificationProps) {
  useEffect(() => {
    if (achievements.length > 0) {
      haptic.success();
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievements, onClose]);

  if (achievements.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed left-4 right-4 top-4 z-50"
      >
        <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 shadow-lg shadow-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {achievements.slice(0, 3).map((a, i) => (
                <div
                  key={a.id}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-lg"
                  style={{ zIndex: 3 - i }}
                >
                  {a.icon}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <p className="font-bold text-white">
                {achievements.length === 1
                  ? "Новое достижение!"
                  : `${achievements.length} новых достижений!`}
              </p>
              <p className="text-sm text-white/80">
                {achievements.map(a => a.name).join(", ")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white"
            >
              ✕
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
