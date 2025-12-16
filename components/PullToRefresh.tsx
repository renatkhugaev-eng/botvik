"use client";

import { useState, useRef, ReactNode, useEffect, RefObject } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { haptic } from "@/lib/haptic";

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  /** External ref to access the scroll container */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Overlay content rendered OUTSIDE scroll container (e.g. Rive effects) */
  overlay?: ReactNode;
};

const PULL_THRESHOLD = 100; // Need to pull 100px to trigger
const MAX_PULL = 140;
const ACTIVATION_DISTANCE = 60; // Start showing indicator after 60px

export function PullToRefresh({ onRefresh, children, disabled = false, scrollRef, overlay }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const internalRef = useRef<HTMLDivElement>(null);
  // Use external ref if provided, otherwise use internal
  const containerRef = scrollRef ?? internalRef;
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const isPulling = useRef(false);
  
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const scale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.6, 1]);
  const rotate = useTransform(pullDistance, [0, PULL_THRESHOLD, MAX_PULL], [0, 180, 360]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      startY.current = e.touches[0].clientY;
      startScrollTop.current = container.scrollTop;
      isPulling.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      // Must have started at the very top
      if (startScrollTop.current > 0) return;
      
      // If scrolled down during this touch, ignore
      if (container.scrollTop > 0) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;
      
      // Only activate if pulling down significantly
      if (deltaY > ACTIVATION_DISTANCE) {
        isPulling.current = true;
        
        const dampedDelta = Math.min((deltaY - ACTIVATION_DISTANCE) * 0.5, MAX_PULL);
        
        const prevValue = pullDistance.get();
        if (dampedDelta >= PULL_THRESHOLD && prevValue < PULL_THRESHOLD) {
          haptic.medium();
        }
        
        pullDistance.set(dampedDelta);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || disabled || isRefreshing) {
        isPulling.current = false;
        if (pullDistance.get() > 0) {
          animate(pullDistance, 0, { duration: 0.3 });
        }
        return;
      }
      
      isPulling.current = false;
      const currentPull = pullDistance.get();
      
      if (currentPull >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        haptic.heavy();
        
        animate(pullDistance, 60, { duration: 0.2 });
        
        try {
          await onRefresh();
          haptic.success();
        } catch {
          haptic.error();
        } finally {
          animate(pullDistance, 0, { duration: 0.3 });
          setIsRefreshing(false);
        }
      } else {
        animate(pullDistance, 0, { duration: 0.3 });
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, isRefreshing, onRefresh, pullDistance]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ overflowX: 'clip' }}>
      {/* Overlay layer - rendered OUTSIDE scroll container (z-0, pointer-events-none) */}
      {overlay}
      
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullDistance.get() > 0 || isRefreshing) && (
          <motion.div 
            className="absolute left-1/2 top-4 z-50 -translate-x-1/2 pointer-events-none"
            style={{ opacity }}
          >
            <motion.div 
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xl shadow-black/15"
              style={{ scale }}
            >
              {isRefreshing ? (
                <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-violet-500 animate-spin" />
              ) : (
                <motion.svg 
                  className="h-5 w-5 text-violet-500" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2.5}
                  style={{ rotate }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </motion.svg>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content (z-10, above overlay) */}
      <div 
        ref={containerRef}
        className="relative z-10 h-full w-full overflow-y-auto overscroll-none touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
}
