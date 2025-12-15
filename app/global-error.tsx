"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global Error Boundary for Next.js App Router
 * Catches all unhandled errors and reports them to Sentry
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 p-6">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center shadow-2xl border border-white/20">
            {/* Error Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <svg 
                className="w-10 h-10 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-3">
              Упс! Что-то пошло не так
            </h2>
            
            {/* Description */}
            <p className="text-slate-300 mb-6">
              Произошла непредвиденная ошибка. Мы уже работаем над её исправлением.
            </p>
            
            {/* Error Code */}
            {error.digest && (
              <div className="bg-slate-800/50 rounded-xl px-4 py-2 mb-6 inline-block">
                <span className="text-slate-400 text-sm font-mono">
                  Код: {error.digest}
                </span>
              </div>
            )}
            
            {/* Retry Button */}
            <button
              onClick={reset}
              className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 active:scale-[0.98]"
            >
              Попробовать снова
            </button>
            
            {/* Home Link */}
            <a
              href="/miniapp"
              className="block mt-4 text-violet-400 hover:text-violet-300 transition-colors font-medium"
            >
              Вернуться на главную
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

