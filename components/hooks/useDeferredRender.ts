"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useDeferredRender — Defer heavy component rendering for better LCP
 * 
 * Стратегия:
 * 1. requestIdleCallback с timeout (предпочтительно)
 * 2. fallback на setTimeout для браузеров без поддержки
 * 
 * @param options.timeoutMs - максимальное время ожидания (default: 1500ms)
 * @param options.fallbackMs - время для setTimeout fallback (default: 1200ms)
 * @param options.disabled - отключить defer (например при perf-mode)
 */
type UseDeferredRenderOptions = {
  timeoutMs?: number;
  fallbackMs?: number;
  disabled?: boolean;
};

export function useDeferredRender({
  timeoutMs = 1500,
  fallbackMs = 1200,
  disabled = false,
}: UseDeferredRenderOptions = {}): boolean {
  const [showDeferred, setShowDeferred] = useState(false);
  
  useEffect(() => {
    // If disabled, show immediately
    if (disabled) {
      setShowDeferred(true);
      return;
    }
    
    let cancelled = false;
    
    // Try requestIdleCallback first (better for LCP)
    if (typeof requestIdleCallback !== "undefined") {
      const handle = requestIdleCallback(
        () => {
          if (!cancelled) setShowDeferred(true);
        },
        { timeout: timeoutMs }
      );
      
      return () => {
        cancelled = true;
        cancelIdleCallback(handle);
      };
    }
    
    // Fallback to setTimeout
    const timer = setTimeout(() => {
      if (!cancelled) setShowDeferred(true);
    }, fallbackMs);
    
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [timeoutMs, fallbackMs, disabled]);
  
  return showDeferred;
}

/**
 * usePauseOnScroll — Pause rendering during active scroll
 * 
 * Используется вместе с useDeferredRender:
 * - Во время скролла не показывать/не анимировать HeroRich
 * - После остановки скролла — восстановить
 */
export function usePauseOnScroll(isPerfMode: boolean): boolean {
  const [paused, setPaused] = useState(false);
  
  useEffect(() => {
    if (isPerfMode) {
      setPaused(true);
    } else {
      // Small delay before resuming to avoid flicker
      const timer = setTimeout(() => setPaused(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isPerfMode]);
  
  return paused;
}

