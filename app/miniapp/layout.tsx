"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import Script from "next/script";
import { NotificationProvider } from "@/components/InAppNotification";

type TelegramWebApp = {
  WebApp?: {
    initData?: string;
    ready?: () => void;
    disableVerticalSwipes?: () => void;
    enableVerticalSwipes?: () => void;
    isVerticalSwipesEnabled?: boolean;
    platform?: string;
    version?: string;
    // Share functionality
    switchInlineQuery?: (query: string, chatTypes?: string[]) => void;
    openTelegramLink?: (url: string) => void;
    shareToStory?: (mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name?: string } }) => void;
  };
};

declare global {
  interface Window {
    Telegram?: TelegramWebApp;
  }
}

type MiniAppUser = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
};

type MiniAppSession =
  | { status: "loading"; attempt?: number }
  | { status: "error"; reason: string }
  | { status: "ready"; user: MiniAppUser };

const MiniAppContext = createContext<MiniAppSession>({ status: "loading" });

export function useMiniAppSession() {
  return useContext(MiniAppContext);
}

// Detect if running on Android
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MiniAppSession>({ status: "loading", attempt: 0 });
  const [debugInfo, setDebugInfo] = useState<string>("");
  const allowDevMock = process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true";
  const authStartTime = useRef<number>(Date.now());

  useEffect(() => {
    let aborted = false;
    let attempts = 0;
    // Increase retries for Android - SDK loads slower
    const maxAttempts = isAndroid() ? 25 : 15;
    const delayMs = isAndroid() ? 300 : 200;
    
    const log = (msg: string, data?: unknown) => {
      const elapsed = Date.now() - authStartTime.current;
      const logMsg = `[MiniApp ${elapsed}ms] ${msg}`;
      console.log(logMsg, data ?? "");
      setDebugInfo(prev => `${prev}\n${logMsg}`);
    };

    const authenticate = async () => {
      attempts += 1;
      setSession({ status: "loading", attempt: attempts });
      
      const tg = window.Telegram?.WebApp;
      
      // Log platform info
      if (attempts === 1) {
        log("Platform detection", {
          isAndroid: isAndroid(),
          userAgent: navigator.userAgent?.slice(0, 100),
          telegramPresent: Boolean(window.Telegram),
          webAppPresent: Boolean(tg),
          platform: tg?.platform,
          version: tg?.version,
        });
      }
      
      // Call ready() as early as possible
      if (tg?.ready) {
        tg.ready();
        log("Called tg.ready()");
      }
      
      // Disable Telegram's swipe-to-close gesture
      if (tg?.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
        log("Disabled vertical swipes");
      }

      // In dev we allow bypassing Telegram when explicitly enabled
      if (!tg && allowDevMock && process.env.NODE_ENV !== "production") {
        log("Dev mock session enabled, Telegram WebApp missing");
        setSession({
          status: "ready",
          user: {
            id: 1,
            telegramId: "dev-mock",
            username: "devuser",
            firstName: "Dev",
            lastName: "User",
            photoUrl: null,
          },
        });
        return;
      }

      const initData = tg?.initData;
      const initDataUnsafe = (tg as unknown as { initDataUnsafe?: { user?: unknown } })?.initDataUnsafe;
      
      log(`Attempt ${attempts}/${maxAttempts}`, {
        initDataLength: initData?.length ?? 0,
        hasInitDataUnsafe: Boolean(initDataUnsafe?.user),
      });

      if (!initData) {
        // Continue retrying
        if (attempts < maxAttempts) {
          if (!aborted) {
            setTimeout(authenticate, delayMs);
          }
          return;
        }
        
        // Max attempts reached
        if (allowDevMock && process.env.NODE_ENV !== "production") {
          log("Dev mock session enabled after retries");
          setSession({
            status: "ready",
            user: {
              id: 1,
              telegramId: "dev-mock",
              username: "devuser",
              firstName: "Dev",
              lastName: "User",
              photoUrl: null,
            },
          });
          return;
        }
        
        if (!aborted) {
          const reason = initDataUnsafe?.user ? "INIT_DATA_EMPTY_BUT_USER_EXISTS" : "NO_INIT_DATA";
          log("Auth failed", { reason, attempts });
          setSession({ status: "error", reason: `${reason} (${attempts} attempts)` });
        }
        return;
      }

      // We have initData, try to authenticate
      try {
        log("Sending auth request...");
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        const data = (await res.json()) as { ok: boolean; user?: MiniAppUser; reason?: string };
        log("Auth response", { ok: data.ok, reason: data.reason, hasUser: Boolean(data.user) });

        if (!res.ok || !data.ok || !data.user) {
          if (!aborted) {
            setSession({ status: "error", reason: data.reason ?? "AUTH_FAILED" });
          }
          return;
        }

        if (!aborted) {
          log("Auth successful!", { userId: data.user.id });
          setSession({ status: "ready", user: data.user });
        }
      } catch (err) {
        log("Auth network error", err);
        if (!aborted) {
          // On network error, retry a few more times
          if (attempts < maxAttempts + 3) {
            setTimeout(authenticate, delayMs * 2);
            return;
          }
          setSession({ status: "error", reason: "NETWORK_ERROR" });
        }
      }
    };

    // Wait a bit for SDK to initialize on Android
    const initialDelay = isAndroid() ? 500 : 100;
    setTimeout(authenticate, initialDelay);

    return () => {
      aborted = true;
    };
  }, [allowDevMock]);

  const content = useMemo(() => {
    if (session.status === "loading") {
      const attempt = session.attempt ?? 0;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
          <p className="mt-4 text-sm text-slate-400">Загрузка...</p>
          {attempt > 5 && (
            <p className="mt-2 text-xs text-slate-300">Подключение... ({attempt})</p>
          )}
          {attempt > 15 && (
            <p className="mt-2 text-xs text-slate-300 max-w-[280px] text-center">
              Если загрузка долгая, попробуйте перезапустить приложение
            </p>
          )}
        </div>
      );
    }

    if (session.status === "error") {
      const handleRetry = () => {
        window.location.reload();
      };
      
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
            <div className="text-5xl mb-4">😔</div>
            <div className="text-lg font-semibold text-slate-900">Ошибка авторизации</div>
            <div className="mt-2 text-sm text-slate-500">Откройте приложение из Telegram</div>
            <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 font-mono">{session.reason}</div>
            <button
              onClick={handleRetry}
              className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-medium text-white active:bg-violet-600 transition-colors"
            >
              Попробовать снова
            </button>
            {/* Debug info for Android issues */}
            {debugInfo && process.env.NODE_ENV !== "production" && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-900 p-2 text-left text-[10px] text-slate-300">
                {debugInfo}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return children;
  }, [children, session, debugInfo]);

  return (
    <MiniAppContext.Provider value={session}>
      <NotificationProvider>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <div className="app-container fixed inset-0 w-full h-full bg-[#f1f5f9] overflow-hidden touch-pan-y" style={{ overflowX: 'clip' }}>
          <div 
            className="w-full h-full px-3 pt-2 pb-4 overflow-y-auto overscroll-none touch-pan-y"
            style={{ overflowX: 'clip', maxWidth: '100%' }}
          >
            {content}
          </div>
        </div>
      </NotificationProvider>
    </MiniAppContext.Provider>
  );
}

