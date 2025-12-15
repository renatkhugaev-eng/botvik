"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { NotificationProvider } from "@/components/InAppNotification";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setUser, addBreadcrumb } from "@/lib/sentry";

type TelegramWebApp = {
  WebApp?: {
    initData?: string;
    ready?: () => void;
    disableVerticalSwipes?: () => void;
    enableVerticalSwipes?: () => void;
    isVerticalSwipesEnabled?: boolean;
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
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; user: MiniAppUser };

const MiniAppContext = createContext<MiniAppSession>({ status: "loading" });

export function useMiniAppSession() {
  return useContext(MiniAppContext);
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MiniAppSession>({ status: "loading" });
  const allowDevMock = process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true";

  useEffect(() => {
    let aborted = false;
    let attempts = 0;
    const maxAttempts = 10;
    const delayMs = 200;

    const authenticate = async () => {
      const tg = window.Telegram?.WebApp;
      if (tg?.ready) tg.ready();
      
      // Disable Telegram's swipe-to-close gesture to allow normal scrolling
      if (tg?.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
        console.log("[MiniApp] Disabled vertical swipes");
      }
      
      console.log("[MiniApp] Telegram WebApp present:", Boolean(tg));

      // In dev we allow bypassing Telegram when explicitly enabled
      if (!tg && allowDevMock && process.env.NODE_ENV !== "production") {
        console.log("[MiniApp] Dev mock session enabled, Telegram WebApp missing");
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
      const initDataUnsafe = (tg as any)?.initDataUnsafe;
      console.log("[MiniApp] initData length", initData?.length);
      console.log("[MiniApp] initDataUnsafe", JSON.stringify(initDataUnsafe));

      // If initData is empty but initDataUnsafe has user, try to use it for dev
      if (!initData && initDataUnsafe?.user) {
        console.log("[MiniApp] Using initDataUnsafe user directly");
      }

      if (!initData) {
        if (attempts < maxAttempts) {
          attempts += 1;
          setTimeout(authenticate, delayMs);
          return;
        }
        if (allowDevMock && process.env.NODE_ENV !== "production") {
          console.log("[MiniApp] Dev mock session enabled after retries, initData missing");
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
          setSession({ status: "error", reason });
        }
        return;
      }

      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: initData ?? "" }),
        });

        const data = (await res.json()) as { ok: boolean; user?: MiniAppUser; reason?: string };
        console.log("[MiniApp] auth response", data);

        if (!res.ok || !data.ok || !data.user) {
          if (!aborted) setSession({ status: "error", reason: data.reason ?? "AUTH_FAILED" });
          return;
        }

        if (!aborted) {
          setSession({ status: "ready", user: data.user });
          // Set user context for Sentry
          setUser({
            id: data.user.id,
            telegramId: data.user.telegramId,
            username: data.user.username,
          });
          addBreadcrumb("User authenticated", "auth", { userId: data.user.id });
        }
      } catch (err) {
        console.error("Auth error", err);
        if (!aborted) setSession({ status: "error", reason: "NETWORK_ERROR" });
      }
    };

    authenticate();

    return () => {
      aborted = true;
    };
  }, [allowDevMock]);

  const content = useMemo(() => {
    if (session.status === "loading") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
          <p className="mt-4 text-sm text-slate-400">Загрузка...</p>
        </div>
      );
    }

    if (session.status === "error") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
            <div className="text-5xl mb-4">😔</div>
            <div className="text-lg font-semibold text-slate-900">Ошибка авторизации</div>
            <div className="mt-2 text-sm text-slate-500">Откройте приложение из Telegram</div>
            <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 font-mono">{session.reason}</div>
          </div>
        </div>
      );
    }

    return children;
  }, [children, session]);

  return (
    <MiniAppContext.Provider value={session}>
      <NotificationProvider>
        <ErrorBoundary>
          <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
          <div className="app-container fixed inset-0 w-full h-full bg-[#f1f5f9] overflow-hidden touch-pan-y" style={{ overflowX: 'clip' }}>
            <div 
              className="w-full h-full px-3 pt-2 pb-4 overflow-y-auto overscroll-none touch-pan-y"
              style={{ overflowX: 'clip', maxWidth: '100%' }}
            >
              {content}
            </div>
          </div>
        </ErrorBoundary>
      </NotificationProvider>
    </MiniAppContext.Provider>
  );
}
