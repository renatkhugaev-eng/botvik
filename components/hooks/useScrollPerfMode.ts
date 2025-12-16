"use client";

import { useState, useEffect, useRef, RefObject } from "react";

type UseScrollPerfModeOptions = {
  /** Debounce delay in ms before scroll is considered "stopped" */
  debounceMs?: number;
  /** Ref to scroll container element. If null/undefined, uses window */
  target?: RefObject<HTMLElement | null>;
  /** Minimum scroll delta (px) to trigger perf mode. Ignores micro-scrolls. */
  threshold?: number;
};

/**
 * Hook to detect when user is actively scrolling.
 * Used to pause heavy animations during scroll for better performance.
 * 
 * Features:
 * - Only triggers on significant scroll (delta > threshold)
 * - Ignores micro-scrolls / tremor
 * - Handles iOS bounce (clamps negative scrollTop to 0)
 * - Single debounce timer, cleaned up on unmount
 * - Avoids unnecessary re-renders
 * - Fallback to window if target ref not yet mounted
 * 
 * @param options.target - Ref to scroll container (default: window)
 * @param options.debounceMs - Delay before scroll considered stopped (default: 160ms)
 * @param options.threshold - Min scroll delta in px to trigger (default: 8px)
 * @returns isScrolling - true while user is scrolling, false after debounce
 */
export function useScrollPerfMode({
  debounceMs = 160,
  target,
  threshold = 8,
}: UseScrollPerfModeOptions = {}) {
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Single timer ref for debounce
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track scrolling state without causing re-renders
  const isScrollingRef = useRef(false);
  // Track last scroll position
  const lastTopRef = useRef(0);
  // Track current listener target to prevent double listeners
  const currentTargetRef = useRef<HTMLElement | Window | null>(null);
  // RAF id for retry
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Helper to get scrollTop with iOS bounce clamp
    const getScrollTop = (scrollTarget: HTMLElement | Window): number => {
      if (scrollTarget instanceof Window) {
        return Math.max(0, window.scrollY);
      }
      return Math.max(0, scrollTarget.scrollTop);
    };
    
    const handleScroll = () => {
      const scrollTarget = currentTargetRef.current;
      if (!scrollTarget) return;
      
      const top = getScrollTop(scrollTarget);
      const delta = Math.abs(top - lastTopRef.current);
      lastTopRef.current = top;
      
      // Only trigger perf mode if scroll delta exceeds threshold
      if (delta > threshold && !isScrollingRef.current) {
        isScrollingRef.current = true;
        setIsScrolling(true);
      }

      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Set debounce timer to mark scroll as stopped
      if (isScrollingRef.current) {
        timerRef.current = setTimeout(() => {
          isScrollingRef.current = false;
          setIsScrolling(false);
          timerRef.current = null;
        }, debounceMs);
      }
    };
    
    // Subscribe to a scroll target
    const subscribe = (scrollTarget: HTMLElement | Window) => {
      // Don't double-subscribe to the same target
      if (currentTargetRef.current === scrollTarget) return;
      
      // Unsubscribe from previous target
      if (currentTargetRef.current) {
        currentTargetRef.current.removeEventListener("scroll", handleScroll);
      }
      
      currentTargetRef.current = scrollTarget;
      lastTopRef.current = getScrollTop(scrollTarget);
      scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    };
    
    // Try to subscribe to target, fallback to window
    const trySubscribe = () => {
      const el = target?.current;
      
      if (el) {
        // Target element is available
        subscribe(el);
      } else if (target) {
        // Target ref was provided but element not yet mounted
        // Fallback to window temporarily
        subscribe(window);
        
        // Schedule retry on next frame to check if element appeared
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const elRetry = target.current;
          if (elRetry && currentTargetRef.current !== elRetry) {
            subscribe(elRetry);
          }
        });
      } else {
        // No target ref provided, use window
        subscribe(window);
      }
    };
    
    trySubscribe();

    // Cleanup on unmount
    return () => {
      if (currentTargetRef.current) {
        currentTargetRef.current.removeEventListener("scroll", handleScroll);
        currentTargetRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, debounceMs, threshold]); // ✅ No target.current in deps

  return isScrolling;
}

export default useScrollPerfMode;
