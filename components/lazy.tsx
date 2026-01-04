"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/Skeleton";

// ═══════════════════════════════════════════════════════════════════════════
// LAZY LOADING COMPONENTS
// Тяжёлые компоненты загружаются только при необходимости
// ═══════════════════════════════════════════════════════════════════════════

// Placeholder для модальных окон (не нужен fallback - они скрыты)
const ModalPlaceholder = () => null;

// Placeholder для фида друзей
function FeedPlaceholder() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-2 w-32 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Placeholder для секции достижений
function AchievementsPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Placeholder для недавних соперников
function RecentOpponentsPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-28 h-36 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DailyRewardModal - Модальное окно ежедневных наград
 * Загружается только при открытии модалки
 */
export const LazyDailyRewardModal = dynamic(
  () => import("@/components/DailyRewardModal").then((mod) => mod.DailyRewardModal),
  {
    ssr: false,
    loading: ModalPlaceholder,
  }
);

/**
 * FriendsFeed - Лента активности друзей
 * Загружается после основного контента страницы
 */
export const LazyFriendsFeed = dynamic(
  () => import("@/components/FriendsFeed").then((mod) => mod.FriendsFeed),
  {
    ssr: false,
    loading: FeedPlaceholder,
  }
);

/**
 * AchievementsSection - Секция достижений
 * Загружается на вкладке профиля
 */
export const LazyAchievementsSection = dynamic(
  () => import("@/components/AchievementsSection").then((mod) => mod.AchievementsSection),
  {
    ssr: false,
    loading: AchievementsPlaceholder,
  }
);

/**
 * RecentOpponents - Недавние соперники
 * Загружается на вкладке друзей в профиле
 */
export const LazyRecentOpponents = dynamic(
  () => import("@/components/RecentOpponents").then((mod) => mod.RecentOpponents),
  {
    ssr: false,
    loading: RecentOpponentsPlaceholder,
  }
);

/**
 * PlayerMiniProfile - Мини-профиль игрока (модальное окно)
 * Загружается при клике на игрока в лидерборде
 */
export const LazyPlayerMiniProfile = dynamic(
  () => import("@/components/PlayerMiniProfile").then((mod) => mod.PlayerMiniProfile),
  {
    ssr: false,
    loading: ModalPlaceholder,
  }
);

/**
 * ProfileEditor - Редактор профиля
 * Загружается при открытии редактирования
 */
export const LazyProfileEditor = dynamic(
  () => import("@/components/ProfileEditor").then((mod) => mod.ProfileEditor),
  {
    ssr: false,
    loading: ModalPlaceholder,
  }
);

/**
 * ShareCard - Карточка для шеринга
 * Загружается при нажатии на "Поделиться"
 */
export const LazyShareCard = dynamic(
  () => import("@/components/ShareCard").then((mod) => mod.ShareCard),
  {
    ssr: false,
    loading: ModalPlaceholder,
  }
);

/**
 * LottieAnimation - Анимации Lottie
 * Тяжёлая библиотека, загружается по требованию
 */
export const LazyLottieAnimation = dynamic(
  () => import("@/components/LottieAnimation").then((mod) => mod.LottieAnimation),
  {
    ssr: false,
    loading: () => <div className="animate-pulse bg-white/10 rounded-lg" />,
  }
);

