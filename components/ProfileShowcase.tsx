"use client";

/**
 * Profile 2.0 Showcase Components
 * - AchievementShowcase: Витрина 3 избранных достижений
 * - StatusBadge: Статус пользователя
 * - CurrentlyPlaying: Индикатор "сейчас играет"
 * - ProfileBio: Краткое описание
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Import achievements list
import { ACHIEVEMENTS, type Achievement as AchievementDef } from "@/lib/achievements";

// Types
type UserStatus = "ONLINE" | "PLAYING" | "LOOKING_DUEL" | "BUSY" | "OFFLINE";

// ═══════════════════════════════════════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════════════════════════════════════

type StatusBadgeProps = {
  status: UserStatus | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
};

const STATUS_COLORS: Record<UserStatus, string> = {
  ONLINE: "bg-emerald-500",
  PLAYING: "bg-violet-500",
  LOOKING_DUEL: "bg-amber-500",
  BUSY: "bg-rose-500",
  OFFLINE: "bg-slate-400",
};

const STATUS_DEFAULT_TEXT: Record<UserStatus, string> = {
  ONLINE: "В сети",
  PLAYING: "Играет",
  LOOKING_DUEL: "Ищет дуэль",
  BUSY: "Занят",
  OFFLINE: "Не в сети",
};

export function StatusBadge({
  status,
  statusEmoji,
  statusText,
  size = "md",
  showText = true,
}: StatusBadgeProps) {
  if (!status) return null;

  const dotSize = size === "sm" ? "h-2 w-2" : size === "md" ? "h-2.5 w-2.5" : "h-3 w-3";
  const textSize = size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";

  const displayEmoji = statusEmoji || null;
  const displayText = statusText || STATUS_DEFAULT_TEXT[status];
  const isAnimated = status === "ONLINE" || status === "PLAYING" || status === "LOOKING_DUEL";

  return (
    <Badge
      variant="secondary"
      className={`${textSize} px-3 py-1 inline-flex items-center gap-1.5 w-fit rounded-full`}
    >
      {/* Status dot or emoji */}
      {displayEmoji ? (
        <span>{displayEmoji}</span>
      ) : (
        <span className={`${dotSize} rounded-full ${STATUS_COLORS[status]} ${isAnimated ? "animate-pulse" : ""}`} />
      )}
      
      {/* Text */}
      {showText && <span className="font-medium">{displayText}</span>}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Currently Playing Indicator
// ═══════════════════════════════════════════════════════════════════════════

type CurrentlyPlayingProps = {
  quizId: number;
  quizTitle: string;
  since?: Date | string | null;
  compact?: boolean;
};

export function CurrentlyPlaying({ quizTitle, since, compact = false }: CurrentlyPlayingProps) {
  // Вычисляем время с начала игры
  const playingFor = useMemo(() => {
    if (!since) return null;
    const start = new Date(since).getTime();
    const now = Date.now();
    const minutes = Math.floor((now - start) / 60000);
    
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours} ч ${minutes % 60} мин`;
  }, [since]);

  if (compact) {
    return (
      <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mr-1"
        >
          🎮
        </motion.span>
        Играет
      </Badge>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200/50">
      <CardContent className="p-3 flex items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg"
        >
          <span className="text-lg">🎮</span>
        </motion.div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium">Сейчас играет</p>
          <p className="font-bold truncate">{quizTitle}</p>
          {playingFor && (
            <p className="text-xs text-muted-foreground">
              {playingFor}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Achievement Showcase
// ═══════════════════════════════════════════════════════════════════════════

type AchievementShowcaseProps = {
  achievementIds: string[];
  size?: "sm" | "md" | "lg";
};

export function AchievementShowcase({ achievementIds, size = "md" }: AchievementShowcaseProps) {
  // Получаем данные достижений
  const achievements = useMemo(() => {
    return achievementIds
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
      .filter(Boolean) as AchievementDef[];
  }, [achievementIds]);

  if (achievements.length === 0) {
    return null;
  }

  const iconSize = size === "sm" ? "text-xl" : size === "md" ? "text-2xl" : "text-3xl";
  const cardSize = size === "sm" ? "p-2" : size === "md" ? "p-3" : "p-4";
  const textSize = size === "sm" ? "text-[9px]" : size === "md" ? "text-[10px]" : "text-xs";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">🏆</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Витрина
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => {
          const achievement = achievements[index];
          
          return (
            <motion.div
              key={index}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -2 }}
              className={`${cardSize} rounded-2xl flex flex-col items-center justify-center text-center transition-all ${
                achievement
                  ? "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200/50 shadow-sm cursor-default"
                  : "bg-muted/30 border border-dashed border-muted-foreground/20"
              }`}
            >
              {achievement ? (
                <>
                  <motion.span 
                    className={iconSize}
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    {achievement.icon}
                  </motion.span>
                  <span className={`${textSize} font-semibold mt-1 line-clamp-2`}>
                    {achievement.name}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground/50 text-lg">+</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile Bio
// ═══════════════════════════════════════════════════════════════════════════

type ProfileBioProps = {
  bio: string | null;
};

export function ProfileBio({ bio }: ProfileBioProps) {
  if (!bio) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      className="relative flex justify-center w-full py-2"
    >
      {/* Glowing neon text effect */}
      <div className="relative">
        {/* Animated sparkles */}
        <motion.span
          className="absolute -left-2 top-0 text-xs"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0 }}
        >
          ✦
        </motion.span>
        <motion.span
          className="absolute -right-2 bottom-0 text-xs"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
        >
          ✦
        </motion.span>
        <motion.span
          className="absolute left-1/4 -top-2 text-[10px]"
          animate={{ opacity: [0.2, 0.8, 0.2], y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}
        >
          ·
        </motion.span>
        <motion.span
          className="absolute right-1/4 -bottom-1 text-[10px]"
          animate={{ opacity: [0.2, 0.8, 0.2], y: [0, 3, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        >
          ·
        </motion.span>

        {/* Main text with glow */}
        <motion.p
          className="relative text-sm font-semibold text-center italic px-4"
          style={{
            background: "linear-gradient(135deg, #fff 0%, #e0e7ff 50%, #fff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(167,139,250,0.3)",
            filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))",
          }}
          animate={{
            textShadow: [
              "0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(167,139,250,0.3)",
              "0 0 30px rgba(255,255,255,0.7), 0 0 60px rgba(167,139,250,0.5)",
              "0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(167,139,250,0.3)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          « {bio} »
        </motion.p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Last Seen
// ═══════════════════════════════════════════════════════════════════════════

type LastSeenProps = {
  lastSeenAt: Date | string | null;
  status: UserStatus | null;
};

export function LastSeen({ lastSeenAt, status }: LastSeenProps) {
  const displayText = useMemo(() => {
    // Если онлайн - не показываем
    if (status === "ONLINE" || status === "PLAYING" || status === "LOOKING_DUEL") {
      return null;
    }
    
    if (!lastSeenAt) return null;
    
    const lastSeen = new Date(lastSeenAt).getTime();
    const now = Date.now();
    const minutes = Math.floor((now - lastSeen) / 60000);
    
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин назад`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    
    return new Date(lastSeenAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  }, [lastSeenAt, status]);

  if (!displayText) return null;

  return (
    <p className="text-xs text-muted-foreground">
      Был в сети {displayText}
    </p>
  );
}

export default {
  StatusBadge,
  CurrentlyPlaying,
  AchievementShowcase,
  ProfileBio,
  LastSeen,
};

