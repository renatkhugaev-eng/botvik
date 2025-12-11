"use client";

import { useState, useRef, useCallback, ReactNode, useEffect } from "react";
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
  const isPullingRef = useRef(false);
  const canPullRef = useRef(false); // Track if pull is allowed (started at top)
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const scale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);
  const rotate = useTransform(pullDistance, [0, PULL_THRESHOLD, MAX_PULL], [0, 180, 360]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      startY.current = e.touches[0].clientY;
      
      // Only allow pull if starting at the top
      canPullRef.current = container.scrollTop <= 0;
      isPullingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      // If we didn't start at top, allow normal scrolling
      if (!canPullRef.current) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      
      // If scrolling down (diff < 0), allow normal behavior
      if (diff <= 0) {
        if (isPullingRef.current) {
          // Was pulling, now going back up - reset
          pullDistance.set(0);
          isPullingRef.current = false;
        }
        return;
      }
      
      // User is at top and pulling down - activate pull-to-refresh
      if (container.scrollTop <= 0 && diff > 10) {
        isPullingRef.current = true;
        
        // Prevent Telegram from closing the app
        e.preventDefault();
        
        const dampedDiff = Math.min(diff * 0.4, MAX_PULL);
        
        // Haptic feedback when crossing threshold
        const prevValue = pullDistance.get();
        if (dampedDiff >= PULL_THRESHOLD && prevValue < PULL_THRESHOLD) {
          haptic.light();
        }
        
        pullDistance.set(dampedDiff);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current || disabled) {
        canPullRef.current = false;
        return;
      }
      
      isPullingRef.current = false;
      canPullRef.current = false;

      const currentPull = pullDistance.get();
      
      if (currentPull >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        haptic.medium();
        
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

    wrapper.addEventListener("touchstart", handleTouchStart, { passive: true });
    wrapper.addEventListener("touchmove", handleTouchMove, { passive: false });
    wrapper.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      wrapper.removeEventListener("touchstart", handleTouchStart);
      wrapper.removeEventListener("touchmove", handleTouchMove);
      wrapper.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, isRefreshing, onRefresh, pullDistance]);

  return (
    <div ref={wrapperRef} className="relative h-full w-full overflow-hidden">
      {/* Pull indicator */}
      <motion.div 
        className="absolute left-1/2 top-0 z-50 flex -translate-x-1/2 items-center justify-center pointer-events-none"
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
