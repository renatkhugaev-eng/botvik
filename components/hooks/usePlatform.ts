"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * Platform Detection Hooks
 * 
 * Централизованные хуки для определения платформы пользователя.
 * Используются для адаптивного поведения (blur effects, animations, etc.)
 * 
 * @example
 * const { isIOS, isAndroid, isMobile, isTelegram } = usePlatform();
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PlatformInfo {
  /** iOS device (iPhone, iPad, iPod) */
  isIOS: boolean;
  /** Android device */
  isAndroid: boolean;
  /** Mobile device (iOS or Android) */
  isMobile: boolean;
  /** Desktop device */
  isDesktop: boolean;
  /** Running inside Telegram WebApp */
  isTelegram: boolean;
  /** Telegram iOS client */
  isTelegramIOS: boolean;
  /** Telegram Android client */
  isTelegramAndroid: boolean;
  /** Telegram Desktop client */
  isTelegramDesktop: boolean;
  /** User agent string */
  userAgent: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function detectPlatform(): PlatformInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    // SSR - return safe defaults
    return {
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isDesktop: true,
      isTelegram: false,
      isTelegramIOS: false,
      isTelegramAndroid: false,
      isTelegramDesktop: false,
      userAgent: "",
    };
  }

  const ua = navigator.userAgent;
  
  // Platform detection
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  const isDesktop = !isMobile;
  
  // Telegram detection
  const isTelegram = Boolean(window.Telegram?.WebApp?.initData);
  const isTelegramIOS = isTelegram && isIOS;
  const isTelegramAndroid = isTelegram && isAndroid;
  const isTelegramDesktop = isTelegram && isDesktop;

  return {
    isIOS,
    isAndroid,
    isMobile,
    isDesktop,
    isTelegram,
    isTelegramIOS,
    isTelegramAndroid,
    isTelegramDesktop,
    userAgent: ua,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to detect user's platform
 * 
 * @returns PlatformInfo object with all platform flags
 * 
 * @example
 * function MyComponent() {
 *   const { isIOS, isAndroid, isTelegram } = usePlatform();
 *   
 *   // iOS handles blur effects well
 *   const enableBlur = isIOS || !isAndroid;
 *   
 *   return <div style={{ backdropFilter: enableBlur ? 'blur(10px)' : 'none' }} />;
 * }
 */
export function usePlatform(): PlatformInfo {
  const [platform, setPlatform] = useState<PlatformInfo>(() => detectPlatform());

  useEffect(() => {
    // Re-detect on client (in case SSR returned defaults)
    setPlatform(detectPlatform());
  }, []);

  return platform;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to detect iOS
 * iOS handles blur effects and animations well
 */
export function useIsIOS(): boolean {
  const { isIOS } = usePlatform();
  return isIOS;
}

/**
 * Hook to detect Android
 * Android WebView has poor blur performance
 */
export function useIsAndroid(): boolean {
  const { isAndroid } = usePlatform();
  return isAndroid;
}

/**
 * Hook to detect mobile device
 */
export function useIsMobile(): boolean {
  const { isMobile } = usePlatform();
  return isMobile;
}

/**
 * Hook to detect Telegram environment
 */
export function useIsTelegram(): boolean {
  const { isTelegram } = usePlatform();
  return isTelegram;
}

/**
 * Hook to get blur capability
 * Returns true if device can handle blur effects well
 */
export function useCanBlur(): boolean {
  const { isIOS, isAndroid } = usePlatform();
  
  // iOS handles blur well, Android WebView doesn't
  return useMemo(() => isIOS || !isAndroid, [isIOS, isAndroid]);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default usePlatform;

