"use client";

import Image from "next/image";
import { useState, memo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// OptimizedImage — Оптимизированное изображение с fallback
// Использует next/image для статических изображений из /public
// ═══════════════════════════════════════════════════════════════════════════

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  quality?: number;
}

function OptimizedImageComponent({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  quality = 75,
}: OptimizedImageProps) {
  const [error, setError] = useState(false);

  // Для локальных изображений используем next/image
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  
  if (!isLocal || error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      quality={quality}
      onError={() => setError(true)}
    />
  );
}

export const OptimizedImage = memo(OptimizedImageComponent);

// ═══════════════════════════════════════════════════════════════════════════
// OptimizedAvatar — Оптимизированная аватарка с поддержкой внешних URL
// ═══════════════════════════════════════════════════════════════════════════

interface OptimizedAvatarProps {
  src: string | null;
  alt?: string;
  size: number;
  fallbackLetter?: string;
  className?: string;
  priority?: boolean;
}

function OptimizedAvatarComponent({
  src,
  alt = "Avatar",
  size,
  fallbackLetter = "U",
  className = "",
  priority = false,
}: OptimizedAvatarProps) {
  const [error, setError] = useState(false);

  // Fallback когда нет изображения или ошибка загрузки
  if (!src || error) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d] ${className}`}
        style={{ width: size, height: size }}
      >
        <span 
          className="font-bold text-white" 
          style={{ fontSize: size * 0.4 }}
        >
          {fallbackLetter.toUpperCase()}
        </span>
      </div>
    );
  }

  // Определяем, является ли URL внешним
  const isExternal = src.startsWith("http://") || src.startsWith("https://");
  const isLocal = src.startsWith("/") && !src.startsWith("//");

  // Для внешних URL с поддержкой в remotePatterns — используем next/image
  const isSupportedExternal = isExternal && (
    src.includes("telegram.org") ||
    src.includes("telegram-cdn.org") ||
    src.includes("dicebear.com") ||
    src.includes("t.me")
  );

  if (isLocal || isSupportedExternal) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        priority={priority}
        onError={() => setError(true)}
        unoptimized={isSupportedExternal} // DiceBear и Telegram уже оптимизированы
      />
    );
  }

  // Fallback для неподдерживаемых внешних URL
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
    />
  );
}

export const OptimizedAvatar = memo(OptimizedAvatarComponent);

// ═══════════════════════════════════════════════════════════════════════════
// OptimizedIcon — Оптимизированная иконка из /public/icons
// ═══════════════════════════════════════════════════════════════════════════

interface OptimizedIconProps {
  name: string; // e.g., "coin", "trophy", "17"
  size?: number;
  className?: string;
  alt?: string;
}

function OptimizedIconComponent({
  name,
  size = 24,
  className = "",
  alt = "",
}: OptimizedIconProps) {
  // Определяем расширение (предпочитаем webp)
  const src = `/icons/${name}.webp`;

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
}

export const OptimizedIcon = memo(OptimizedIconComponent);

