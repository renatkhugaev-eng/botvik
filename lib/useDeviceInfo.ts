"use client";

/**
 * useDeviceInfo - Профессиональный хук для определения устройства и адаптации UI
 * 
 * Определяет:
 * - Тип устройства (mobile/tablet/desktop)
 * - Операционную систему (iOS/Android/Windows/macOS/Linux)
 * - Браузер и его особенности
 * - Safe area insets
 * - Ориентацию экрана
 * - Поддержку touch
 * - Telegram Mini App контекст
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type DeviceType = "mobile" | "tablet" | "desktop";
export type OS = "ios" | "android" | "windows" | "macos" | "linux" | "unknown";
export type Browser = "safari" | "chrome" | "firefox" | "edge" | "opera" | "telegram" | "unknown";
export type Orientation = "portrait" | "landscape";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type ScreenSize = {
  width: number;
  height: number;
  availableHeight: number; // Высота без клавиатуры
};

export type DeviceInfo = {
  // Устройство
  type: DeviceType;
  os: OS;
  osVersion: string | null;
  browser: Browser;
  browserVersion: string | null;
  
  // Экран
  screen: ScreenSize;
  orientation: Orientation;
  pixelRatio: number;
  
  // Возможности
  isTouch: boolean;
  isStandalone: boolean; // PWA режим
  isTelegramMiniApp: boolean;
  
  // Safe areas (для notch, dynamic island и т.д.)
  safeArea: SafeAreaInsets;
  
  // Флаги для быстрой проверки
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  
  // Keyboard
  isKeyboardVisible: boolean;
  keyboardHeight: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function detectOS(): { os: OS; version: string | null } {
  if (typeof window === "undefined") {
    return { os: "unknown", version: null };
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform?.toLowerCase() || "";

  // iOS detection
  if (/iPad|iPhone|iPod/.test(ua) || (platform === "macintel" && navigator.maxTouchPoints > 1)) {
    const match = ua.match(/OS (\d+[_\.]\d+)/);
    return { 
      os: "ios", 
      version: match ? match[1].replace("_", ".") : null 
    };
  }

  // Android detection
  if (/Android/.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    return { 
      os: "android", 
      version: match ? match[1] : null 
    };
  }

  // Windows
  if (/Windows/.test(ua)) {
    const match = ua.match(/Windows NT (\d+\.?\d*)/);
    return { 
      os: "windows", 
      version: match ? match[1] : null 
    };
  }

  // macOS
  if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[_\.]\d+)/);
    return { 
      os: "macos", 
      version: match ? match[1].replace("_", ".") : null 
    };
  }

  // Linux
  if (/Linux/.test(ua)) {
    return { os: "linux", version: null };
  }

  return { os: "unknown", version: null };
}

function detectBrowser(): { browser: Browser; version: string | null } {
  if (typeof window === "undefined") {
    return { browser: "unknown", version: null };
  }

  const ua = navigator.userAgent;

  // Telegram WebView
  if (/TelegramWebview|Telegram/.test(ua) || window.Telegram?.WebApp) {
    return { browser: "telegram", version: null };
  }

  // Edge (Chromium-based)
  if (/Edg\//.test(ua)) {
    const match = ua.match(/Edg\/(\d+\.?\d*)/);
    return { browser: "edge", version: match ? match[1] : null };
  }

  // Opera
  if (/OPR\//.test(ua)) {
    const match = ua.match(/OPR\/(\d+\.?\d*)/);
    return { browser: "opera", version: match ? match[1] : null };
  }

  // Chrome
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    const match = ua.match(/Chrome\/(\d+\.?\d*)/);
    return { browser: "chrome", version: match ? match[1] : null };
  }

  // Safari
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) {
    const match = ua.match(/Version\/(\d+\.?\d*)/);
    return { browser: "safari", version: match ? match[1] : null };
  }

  // Firefox
  if (/Firefox\//.test(ua)) {
    const match = ua.match(/Firefox\/(\d+\.?\d*)/);
    return { browser: "firefox", version: match ? match[1] : null };
  }

  return { browser: "unknown", version: null };
}

function detectDeviceType(width: number): DeviceType {
  // Breakpoints соответствуют Tailwind
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function detectOrientation(): Orientation {
  if (typeof window === "undefined") return "portrait";
  return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

function getSafeAreaInsets(): SafeAreaInsets {
  if (typeof window === "undefined") {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const style = getComputedStyle(document.documentElement);
  
  const parseInset = (prop: string): number => {
    const value = style.getPropertyValue(prop);
    return parseInt(value, 10) || 0;
  };

  // Пробуем CSS env() переменные
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  
  // Fallback через computed padding если env() не работает
  return {
    top: parseInset("--sat") || parseInt(computedStyle.paddingTop, 10) || 0,
    bottom: parseInset("--sab") || parseInt(computedStyle.paddingBottom, 10) || 0,
    left: parseInset("--sal") || parseInt(computedStyle.paddingLeft, 10) || 0,
    right: parseInset("--sar") || parseInt(computedStyle.paddingRight, 10) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useDeviceInfo(): DeviceInfo {
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    if (typeof window === "undefined") {
      return { width: 375, height: 812, availableHeight: 812 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      availableHeight: window.visualViewport?.height || window.innerHeight,
    };
  });

  const [orientation, setOrientation] = useState<Orientation>(() => detectOrientation());
  const [safeArea, setSafeArea] = useState<SafeAreaInsets>(() => getSafeAreaInsets());
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Обновление размеров экрана
  const updateScreenSize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const availableHeight = window.visualViewport?.height || height;
    
    setScreenSize({ width, height, availableHeight });
    setOrientation(width > height ? "landscape" : "portrait");
    setSafeArea(getSafeAreaInsets());
    
    // Определяем видимость клавиатуры по разнице высот
    const heightDiff = height - availableHeight;
    const keyboardVisible = heightDiff > 100; // Порог 100px
    setIsKeyboardVisible(keyboardVisible);
    setKeyboardHeight(keyboardVisible ? heightDiff : 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Устанавливаем CSS переменные для safe area
    const root = document.documentElement;
    root.style.setProperty("--sat", "env(safe-area-inset-top)");
    root.style.setProperty("--sab", "env(safe-area-inset-bottom)");
    root.style.setProperty("--sal", "env(safe-area-inset-left)");
    root.style.setProperty("--sar", "env(safe-area-inset-right)");

    // Слушаем изменения размера
    window.addEventListener("resize", updateScreenSize);
    
    // Visual Viewport API для более точного определения клавиатуры
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateScreenSize);
      window.visualViewport.addEventListener("scroll", updateScreenSize);
    }

    // Orientation change
    window.addEventListener("orientationchange", updateScreenSize);

    // Начальное обновление
    updateScreenSize();

    return () => {
      window.removeEventListener("resize", updateScreenSize);
      window.removeEventListener("orientationchange", updateScreenSize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateScreenSize);
        window.visualViewport.removeEventListener("scroll", updateScreenSize);
      }
    };
  }, [updateScreenSize]);

  // Мемоизированные статические значения (не меняются во время сессии)
  const staticInfo = useMemo(() => {
    const { os, version: osVersion } = detectOS();
    const { browser, version: browserVersion } = detectBrowser();
    
    const isTouch = typeof window !== "undefined" && (
      "ontouchstart" in window || 
      navigator.maxTouchPoints > 0
    );
    
    const isStandalone = typeof window !== "undefined" && (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
    
    const isTelegramMiniApp = typeof window !== "undefined" && Boolean(window.Telegram?.WebApp);

    return {
      os,
      osVersion,
      browser,
      browserVersion,
      isTouch,
      isStandalone,
      isTelegramMiniApp,
      pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    };
  }, []);

  // Динамические значения на основе размера экрана
  const dynamicInfo = useMemo(() => {
    const type = detectDeviceType(screenSize.width);
    
    return {
      type,
      isMobile: type === "mobile",
      isTablet: type === "tablet",
      isDesktop: type === "desktop",
      isIOS: staticInfo.os === "ios",
      isAndroid: staticInfo.os === "android",
    };
  }, [screenSize.width, staticInfo.os]);

  return {
    ...staticInfo,
    ...dynamicInfo,
    screen: screenSize,
    orientation,
    safeArea,
    isKeyboardVisible,
    keyboardHeight,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CSS VARIABLES HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Устанавливает CSS переменные для использования в стилях
 * --device-type: mobile | tablet | desktop
 * --screen-width: число в px
 * --screen-height: число в px
 * --keyboard-height: число в px
 * --is-keyboard-visible: 1 | 0
 */
export function useDeviceCSSVariables() {
  const device = useDeviceInfo();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    
    // Тип устройства
    root.style.setProperty("--device-type", device.type);
    root.dataset.device = device.type;
    root.dataset.os = device.os;
    
    // Размеры
    root.style.setProperty("--screen-width", `${device.screen.width}px`);
    root.style.setProperty("--screen-height", `${device.screen.height}px`);
    root.style.setProperty("--available-height", `${device.screen.availableHeight}px`);
    
    // Клавиатура
    root.style.setProperty("--keyboard-height", `${device.keyboardHeight}px`);
    root.style.setProperty("--is-keyboard-visible", device.isKeyboardVisible ? "1" : "0");
    
    // Safe area
    root.style.setProperty("--safe-top", `${device.safeArea.top}px`);
    root.style.setProperty("--safe-bottom", `${device.safeArea.bottom}px`);
    root.style.setProperty("--safe-left", `${device.safeArea.left}px`);
    root.style.setProperty("--safe-right", `${device.safeArea.right}px`);
    
    // Pixel ratio
    root.style.setProperty("--pixel-ratio", `${device.pixelRatio}`);

  }, [device]);

  return device;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIVE BREAKPOINT HOOK
// ═══════════════════════════════════════════════════════════════════════════

type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export function useBreakpoint(): Breakpoint {
  const { screen } = useDeviceInfo();
  
  return useMemo(() => {
    const width = screen.width;
    if (width >= BREAKPOINTS["2xl"]) return "2xl";
    if (width >= BREAKPOINTS.xl) return "xl";
    if (width >= BREAKPOINTS.lg) return "lg";
    if (width >= BREAKPOINTS.md) return "md";
    if (width >= BREAKPOINTS.sm) return "sm";
    return "xs";
  }, [screen.width]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener("change", handler);
    
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export default useDeviceInfo;

