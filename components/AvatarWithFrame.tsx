"use client";

import { memo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// AvatarWithFrame — Аватарка с косметической рамкой
// ═══════════════════════════════════════════════════════════════════════════

interface AvatarWithFrameProps {
  photoUrl: string | null;
  frameUrl?: string | null;
  size?: number;
  fallbackLetter?: string;
  className?: string;
  showRing?: boolean;
  ringColor?: string;
}

function AvatarWithFrameComponent({
  photoUrl,
  frameUrl,
  size = 48,
  fallbackLetter = "U",
  className = "",
  showRing = false,
  ringColor = "from-purple-500 to-pink-500",
}: AvatarWithFrameProps) {
  // Рамка должна быть немного больше аватарки
  const frameSize = size * 1.25;
  const frameOffset = (frameSize - size) / 2;

  return (
    <div 
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Опциональное кольцо под аватаркой */}
      {showRing && (
        <div 
          className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${ringColor} opacity-60`}
        />
      )}
      
      {/* Аватарка */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="Avatar"
          width={size}
          height={size}
          className="relative h-full w-full rounded-full object-cover"
          style={{ aspectRatio: "1/1" }}
        />
      ) : (
        <div 
          className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d]"
        >
          <span 
            className="font-bold text-white"
            style={{ fontSize: size * 0.4 }}
          >
            {fallbackLetter.toUpperCase()}
          </span>
        </div>
      )}
      
      {/* Косметическая рамка (поверх аватарки) */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt="Frame"
          width={frameSize}
          height={frameSize}
          className="pointer-events-none absolute"
          style={{
            top: -frameOffset,
            left: -frameOffset,
            width: frameSize,
            height: frameSize,
          }}
        />
      )}
    </div>
  );
}

// Мемоизация для предотвращения лишних ререндеров
export const AvatarWithFrame = memo(AvatarWithFrameComponent);

// ═══════════════════════════════════════════════════════════════════════════
// Вариант для лидерборда (компактный)
// ═══════════════════════════════════════════════════════════════════════════

interface LeaderboardAvatarProps {
  photoUrl: string | null;
  frameUrl?: string | null;
  firstName?: string | null;
  size?: number;
  rank?: number;
}

function LeaderboardAvatarComponent({
  photoUrl,
  frameUrl,
  firstName,
  size = 40,
  rank,
}: LeaderboardAvatarProps) {
  const fallbackLetter = firstName?.[0] || "?";
  
  // Цвет кольца в зависимости от места
  const getRingColor = () => {
    switch (rank) {
      case 1: return "from-yellow-400 to-amber-500";
      case 2: return "from-gray-300 to-gray-400";
      case 3: return "from-amber-600 to-orange-700";
      default: return "from-purple-500/50 to-pink-500/50";
    }
  };

  return (
    <AvatarWithFrame
      photoUrl={photoUrl}
      frameUrl={frameUrl}
      size={size}
      fallbackLetter={fallbackLetter}
      showRing={rank !== undefined && rank <= 3}
      ringColor={getRingColor()}
    />
  );
}

export const LeaderboardAvatar = memo(LeaderboardAvatarComponent);

// ═══════════════════════════════════════════════════════════════════════════
// Вариант для профиля (большой, с анимацией)
// ═══════════════════════════════════════════════════════════════════════════

interface ProfileAvatarProps {
  photoUrl: string | null;
  frameUrl?: string | null;
  firstName?: string | null;
  levelColor?: string;
}

function ProfileAvatarComponent({
  photoUrl,
  frameUrl,
  firstName,
  levelColor = "from-purple-500 to-pink-500",
}: ProfileAvatarProps) {
  const fallbackLetter = firstName?.[0] || "U";
  const size = 96; // 24 * 4 = 96px (h-24 w-24)

  return (
    <div className="relative">
      {/* Внешнее вращающееся кольцо */}
      <div
        className={`absolute -inset-2 rounded-full bg-gradient-to-r ${levelColor} opacity-30 animate-spin-slow`}
        style={{ animationDuration: "8s" }}
      />
      
      {/* Внутреннее свечение */}
      <div 
        className={`absolute -inset-1 rounded-full bg-gradient-to-r ${levelColor} opacity-40`}
      />
      
      {/* Основная аватарка с рамкой */}
      <div className="relative ring-4 ring-black rounded-full">
        <AvatarWithFrame
          photoUrl={photoUrl}
          frameUrl={frameUrl}
          size={size}
          fallbackLetter={fallbackLetter}
        />
      </div>
    </div>
  );
}

export const ProfileAvatar = memo(ProfileAvatarComponent);
