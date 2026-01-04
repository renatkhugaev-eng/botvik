"use client";

import { memo, useState } from "react";
import Image from "next/image";

// ═══════════════════════════════════════════════════════════════════════════
// AvatarImage — Оптимизированное изображение аватара
// ═══════════════════════════════════════════════════════════════════════════

function AvatarImage({ src, size }: { src: string; size: number }) {
  const [error, setError] = useState(false);
  
  // Если ошибка загрузки — fallback на обычный img
  if (error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Avatar"
        className="h-full w-full rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  
  // Для внешних URL с поддержкой в remotePatterns
  const isSupportedExternal = 
    src.includes("telegram.org") ||
    src.includes("telegram-cdn.org") ||
    src.includes("dicebear.com") ||
    src.includes("t.me");
  
  if (isSupportedExternal || src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt="Avatar"
        width={size}
        height={size}
        className="h-full w-full rounded-full object-cover"
        onError={() => setError(true)}
        unoptimized={isSupportedExternal} // Внешние уже оптимизированы
      />
    );
  }
  
  // Fallback для неизвестных внешних URL
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Avatar"
      className="h-full w-full rounded-full object-cover"
      loading="lazy"
    />
  );
}

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
  // ═══════════════════════════════════════════════════════════════════════════
  // ПРОФЕССИОНАЛЬНОЕ РЕШЕНИЕ: CSS Grid + Transform центрирование
  // 
  // Архитектура:
  // 1. Контейнер = размер рамки (size * multiplier)
  // 2. Рамка заполняет контейнер полностью (inset-0)
  // 3. Аватар центрируется через CSS transform (не пиксельные расчёты)
  // 4. Микро-коррекции через translate для конкретных рамок
  // ═══════════════════════════════════════════════════════════════════════════
  
  const frameMultiplier = 1.85;
  const hasFrame = !!frameUrl;
  const containerSize = hasFrame ? size * frameMultiplier : size;
  
  // Извлекаем slug рамки для микро-коррекций (поддержка PNG и WebP)
  const frameSlug = frameUrl?.split('/').pop()?.replace(/\.(png|webp)$/, '') ?? null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // КОРРЕКЦИИ — рассчитаны скриптом scripts/analyze-frames.ts
  // Значения в процентах от размера аватара (size)
  // y: положительное = вниз, отрицательное = вверх
  // x: положительное = вправо, отрицательное = влево
  // ═══════════════════════════════════════════════════════════════════════════
  const corrections: Record<string, { x: number; y: number }> = {
    bunny: { y: -0.10, x: 0.01 },
    cat: { y: 0.00, x: 0.01 },
    chick: { y: 0.00, x: 0.00 },
    cow: { y: -0.07, x: 0.00 },
    dog: { y: -0.02, x: 0.03 },
    fox: { y: 0.05, x: 0.03 },
    frog: { y: 0.06, x: 0.00 },
    giraffe: { y: 0.00, x: 0.00 },
    hippo: { y: 0.03, x: 0.00 },
    horse: { y: 0.00, x: 0.01 },
    mouse: { y: -0.03, x: 0.01 },
    panda: { y: -0.02, x: 0.01 },
    penguin: { y: 0.04, x: 0.00 },
    pig: { y: -0.03, x: 0.02 },
    sheep: { y: -0.03, x: -0.02 },
    tiger: { y: 0.06, x: 0.00 },
    zebra: { y: 0.03, x: -0.01 },
  };
  
  const correctionPercent = frameSlug && corrections[frameSlug] 
    ? corrections[frameSlug] 
    : { x: 0, y: 0 };
  
  // Конвертируем проценты в пиксели
  const correction = {
    x: size * correctionPercent.x,
    y: size * correctionPercent.y,
  };

  // Без рамки — простой рендер аватара
  if (!hasFrame) {
    return (
      <div 
        className={`relative flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {showRing && (
          <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${ringColor} opacity-60`} />
        )}
        {photoUrl ? (
          <AvatarImage src={photoUrl} size={size} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d]">
            <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
              {fallbackLetter.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    );
  }

  // С рамкой — аватар фиксирован в центре, РАМКА двигается
  return (
    <div 
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Аватар — ВСЕГДА в центре контейнера */}
      <div
        className="absolute"
        style={{
          width: size,
          height: size,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {showRing && (
          <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${ringColor} opacity-60`} />
        )}
        {photoUrl ? (
          <AvatarImage src={photoUrl} size={size} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d]">
            <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
              {fallbackLetter.toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      {/* Рамка — двигается для выравнивания отверстия с аватаром */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameUrl}
        alt="Frame"
        className="pointer-events-none absolute"
        style={{
          width: containerSize,
          height: containerSize,
          top: correction.y,
          left: correction.x,
        }}
      />
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
