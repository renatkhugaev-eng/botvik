"use client";

import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptic";

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
};

/**
 * Simple refresh wrapper with a floating refresh button
 * More reliable than gesture-based pull-to-refresh in Telegram Mini Apps
 */
export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || disabled) return;
    
    setIsRefreshing(true);
    haptic.medium();
    
    try {
      await onRefresh();
      haptic.success();
    } catch {
      haptic.error();
    } finally {
      setIsRefreshing(false);
      setShowButton(false);
    }
  };

  // Show refresh button when user scrolls to top
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setShowButton(target.scrollTop === 0);
  };

  return (
    <div className="relative h-full w-full">
      {/* Floating refresh button - appears when at top */}
      <AnimatePresence>
        {showButton && !isRefreshing && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={handleRefresh}
            className="absolute left-1/2 top-2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg shadow-black/10 active:scale-95 transition-transform"
          >
            <svg 
              className="h-4 w-4 text-violet-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="text-[13px] font-semibold text-slate-600">Обновить</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-1/2 top-2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg shadow-black/10"
          >
            <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-violet-500 animate-spin" />
            <span className="text-[13px] font-semibold text-slate-600">Обновляем...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content - normal scrolling, no interference */}
      <div 
        className="h-full w-full overflow-y-auto"
        onScroll={handleScroll}
      >
        {children}
      </div>
    </div>
  );
}
