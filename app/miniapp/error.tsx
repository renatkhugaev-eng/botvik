"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { motion } from "framer-motion";

/**
 * Local Error Boundary for Mini App routes
 * Provides better UX than global error by keeping the app shell intact
 */
export default function MiniAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to Sentry
    Sentry.captureException(error);
    console.error("[MiniApp Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/20 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full"
      >
        {/* Error Card */}
        <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 text-center shadow-xl border border-zinc-200/50 dark:border-white/10">
          {/* Error Icon */}
          <motion.div 
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20"
          >
            <span className="text-3xl">😵</span>
          </motion.div>
          
          {/* Title */}
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Упс! Ошибка
          </h2>
          
          {/* Description */}
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-5">
            Что-то пошло не так. Попробуй обновить страницу.
          </p>
          
          {/* Error Code (for debugging) */}
          {error.digest && (
            <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-xl px-3 py-1.5 mb-5 inline-block">
              <span className="text-zinc-400 text-xs font-mono">
                {error.digest}
              </span>
            </div>
          )}
          
          {/* Actions */}
          <div className="space-y-3">
            {/* Retry Button */}
            <button
              onClick={reset}
              className="w-full py-3.5 px-6 bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-zinc-900/10 hover:shadow-zinc-900/20 active:scale-[0.98]"
            >
              Попробовать снова
            </button>
            
            {/* Home Link */}
            <a
              href="/miniapp"
              className="block py-3 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors font-medium text-sm"
            >
              На главную
            </a>
          </div>
        </div>
        
        {/* Help text */}
        <p className="text-center text-zinc-400 text-xs mt-4">
          Если проблема повторяется, напиши нам
        </p>
      </motion.div>
    </div>
  );
}

