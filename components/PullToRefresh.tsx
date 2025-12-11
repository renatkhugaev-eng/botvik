"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { haptic } from "@/lib/haptic";

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
};

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const scale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);
  const rotate = useTransform(pullDistance, [0, PULL_THRESHOLD, MAX_PULL], [0, 180, 360]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      pullDistance.set(0);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = Math.max(0, currentY.current - startY.current);
    const dampedDiff = Math.min(diff * 0.5, MAX_PULL);
    
    // Haptic feedback when crossing threshold
    const prevValue = pullDistance.get();
    if (dampedDiff >= PULL_THRESHOLD && prevValue < PULL_THRESHOLD) {
      haptic.light();
    }
    
    pullDistance.set(dampedDiff);
  }, [isPulling, disabled, isRefreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;
    setIsPulling(false);

    const currentPull = pullDistance.get();
    
    if (currentPull >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      haptic.medium();
      
      // Animate to loading position
      animate(pullDistance, 60, { duration: 0.2 });
      
      try {
        await onRefresh();
        haptic.success();
      } catch {
        haptic.error();
      } finally {
        // Animate back
        animate(pullDistance, 0, { duration: 0.3 });
        setIsRefreshing(false);
      }
    } else {
      // Snap back
      animate(pullDistance, 0, { duration: 0.3 });
    }
  }, [isPulling, disabled, isRefreshing, onRefresh, pullDistance]);

  return (
    <div 
      className="relative h-full w-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div 
        className="absolute left-1/2 top-0 z-50 flex -translate-x-1/2 items-center justify-center"
        style={{ 
          y: useTransform(pullDistance, [0, MAX_PULL], [-50, 30]),
          opacity,
        }}
      >
        <motion.div 
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg shadow-black/10"
          style={{ scale }}
        >
          {isRefreshing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-violet-500"
            />
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

      {/* Content container */}
      <motion.div
        ref={containerRef}
        className="h-full w-full overflow-y-auto"
        style={{ y: pullDistance }}
      >
        {children}
      </motion.div>
    </div>
  );
}
