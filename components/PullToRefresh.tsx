"use client";

import { useState, useRef, ReactNode, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { haptic } from "@/lib/haptic";

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
};

const PULL_THRESHOLD = 70;
const MAX_PULL = 100;

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const wasScrolled = useRef(false); // Was content ever scrolled in this session?
  const touchBlocked = useRef(false); // Block pull for this touch
  const isActivated = useRef(false);
  
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const scale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);
  const rotate = useTransform(pullDistance, [0, PULL_THRESHOLD, MAX_PULL], [0, 180, 360]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;

    // Track if user ever scrolled - if yes, block pull for this touch
    const handleScroll = () => {
      if (container.scrollTop > 5) {
        wasScrolled.current = true;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      startY.current = e.touches[0].clientY;
      isActivated.current = false;
      
      // Block pull if: started not at top, OR was scrolled recently
      touchBlocked.current = container.scrollTop > 0 || wasScrolled.current;
      
      // Reset wasScrolled only if we're at the very top
      if (container.scrollTop === 0) {
        wasScrolled.current = false;
        touchBlocked.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (disabled || isRefreshing || touchBlocked.current) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;
      const scrollTop = container.scrollTop;
      
      // If scrolled down at any point, block pull
      if (scrollTop > 0) {
        touchBlocked.current = true;
        wasScrolled.current = true;
        isActivated.current = false;
        pullDistance.set(0);
        return;
      }
      
      // Only allow pull if: at top AND pulling down AND not blocked
      if (deltaY > 15 && scrollTop === 0 && !touchBlocked.current) {
        isActivated.current = true;
        e.preventDefault();
        
        const dampedDelta = Math.min((deltaY - 15) * 0.5, MAX_PULL);
        
        const prevValue = pullDistance.get();
        if (dampedDelta >= PULL_THRESHOLD && prevValue < PULL_THRESHOLD) {
          haptic.light();
        }
        
        pullDistance.set(dampedDelta);
      } else if (deltaY < 0) {
        // User is trying to scroll down - block pull and allow scroll
        touchBlocked.current = true;
        isActivated.current = false;
        pullDistance.set(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isActivated.current || disabled || isRefreshing) {
        isActivated.current = false;
        if (pullDistance.get() > 0) {
          animate(pullDistance, 0, { duration: 0.2 });
        }
        return;
      }
      
      isActivated.current = false;
      const currentPull = pullDistance.get();
      
      if (currentPull >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        haptic.medium();
        
        animate(pullDistance, 50, { duration: 0.2 });
        
        try {
          await onRefresh();
          haptic.success();
        } catch {
          haptic.error();
        } finally {
          animate(pullDistance, 0, { duration: 0.25 });
          setIsRefreshing(false);
        }
      } else {
        animate(pullDistance, 0, { duration: 0.25 });
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    wrapper.addEventListener("touchstart", handleTouchStart, { passive: true });
    wrapper.addEventListener("touchmove", handleTouchMove, { passive: false });
    wrapper.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      wrapper.removeEventListener("touchstart", handleTouchStart);
      wrapper.removeEventListener("touchmove", handleTouchMove);
      wrapper.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, isRefreshing, onRefresh, pullDistance]);

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      {/* Pull indicator */}
      <motion.div 
        className="absolute left-1/2 top-0 z-50 flex -translate-x-1/2 items-center justify-center pointer-events-none"
        style={{ 
          y: useTransform(pullDistance, [0, MAX_PULL], [-40, 20]),
          opacity,
        }}
      >
        <motion.div 
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg shadow-black/10"
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

      {/* Content */}
      <motion.div
        ref={containerRef}
        className="h-full w-full overflow-y-auto overscroll-contain"
        style={{ y: pullDistance }}
      >
        {children}
      </motion.div>
    </div>
  );
}
