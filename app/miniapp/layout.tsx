"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { NotificationProvider } from "@/components/InAppNotification";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setUser, addBreadcrumb } from "@/lib/sentry";
import { identifyUser } from "@/lib/posthog";
import { PerfModeProvider } from "@/components/context/PerfModeContext";
import { WebVitalsOverlay } from "@/components/debug/WebVitalsOverlay";
import { haptic } from "@/lib/haptic";

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
    // Payments
    openInvoice?: (url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
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

    // ═══ REFERRAL: Читаем ?ref= из URL и сохраняем ═══
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref") || urlParams.get("startapp")?.replace("ref_", "");
    if (refCode) {
      localStorage.setItem("referral_code", refCode);
      console.log("[MiniApp] Saved referral code:", refCode);
    }

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
        // Fetch real user from API to get actual ID
        try {
          const res = await fetch("/api/me/summary");
          if (res.ok) {
            const data = await res.json();
            setSession({
              status: "ready",
              user: {
                id: data.user.id,
                telegramId: data.user.telegramId || "dev-mock",
                username: data.user.username || "devuser",
                firstName: data.user.firstName || "Dev",
                lastName: data.user.lastName || "User",
                photoUrl: null,
              },
            });
            return;
          }
        } catch (e) {
          console.warn("[MiniApp] Failed to fetch dev user:", e);
        }
        // Fallback
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
          // Fetch real user from API to get actual ID
          try {
            const res = await fetch("/api/me/summary");
            if (res.ok) {
              const data = await res.json();
              setSession({
                status: "ready",
                user: {
                  id: data.user.id,
                  telegramId: data.user.telegramId || "dev-mock",
                  username: data.user.username || "devuser",
                  firstName: data.user.firstName || "Dev",
                  lastName: data.user.lastName || "User",
                  photoUrl: null,
                },
              });
              return;
            }
          } catch (e) {
            console.warn("[MiniApp] Failed to fetch dev user:", e);
          }
          // Fallback
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
        // Получаем сохранённый реферальный код
        const savedRefCode = localStorage.getItem("referral_code");
        
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            initData: initData ?? "",
            referralCode: savedRefCode || undefined, // Передаём реферальный код
          }),
        });

        const data = (await res.json()) as { ok: boolean; user?: MiniAppUser; reason?: string };
        console.log("[MiniApp] auth response", data);

        if (!res.ok || !data.ok || !data.user) {
          if (!aborted) setSession({ status: "error", reason: data.reason ?? "AUTH_FAILED" });
          return;
        }

        if (!aborted) {
          setSession({ status: "ready", user: data.user });
          
          // Очищаем реферальный код после использования
          if (savedRefCode) {
            localStorage.removeItem("referral_code");
            console.log("[MiniApp] Referral code used and cleared");
          }
          
          // Set user context for Sentry
          setUser({
            id: data.user.id,
            telegramId: data.user.telegramId,
            username: data.user.username,
          });
          addBreadcrumb("User authenticated", "auth", { userId: data.user.id });
          // Identify user for Posthog analytics
          identifyUser({
            id: data.user.id,
            telegramId: data.user.telegramId,
            username: data.user.username,
            firstName: data.user.firstName,
          });
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

  // Show floating navigation only on main miniapp page
  const pathname = usePathname();
  const router = useRouter();
  const showBottomNav = session.status === "ready" && pathname === "/miniapp";

  return (
    <MiniAppContext.Provider value={session}>
      <PerfModeProvider>
        <NotificationProvider>
          <ErrorBoundary>
            <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
            <div className="app-container fixed inset-0 w-full h-full bg-[#0f0f1a] overflow-hidden touch-pan-y" style={{ overflowX: 'clip' }}>
              
              {/* ═══════════════════════════════════════════════════════════════
                  BOTTOM NAVIGATION — Simple fixed bottom bar
              ═══════════════════════════════════════════════════════════════ */}
              {showBottomNav && (
                <motion.nav 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
                  className="fixed left-1/2 -translate-x-1/2 z-50"
                  style={{ bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
                >
                  <div className="flex items-center gap-1 rounded-full bg-[#1a1a2e] px-2 py-2 border border-white/10">
                    {/* Магазин */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        haptic.light();
                        router.push("/miniapp/shop");
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold"
                      style={{ boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)" }}
                      aria-label="Магазин"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 01-8 0"/>
                      </svg>
                      Магазин
                    </motion.button>

                    {/* Чат */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        haptic.light();
                        router.push("/miniapp/chat");
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold"
                      style={{ boxShadow: "0 0 20px rgba(6, 182, 212, 0.4)" }}
                      aria-label="Чат"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                      Чат
                    </motion.button>
                  </div>
                </motion.nav>
              )}

              {/* Full-bleed layout — страницы сами контролируют отступы */}
              <div 
                className="relative z-10 w-full h-full overflow-y-auto overscroll-none touch-pan-y"
                tabIndex={0}
                role="main"
                aria-label="Основное содержимое"
                style={{ 
                  overflowX: 'clip', 
                  maxWidth: '100%',
                  // Safe area insets for notch devices
                  paddingTop: 'env(safe-area-inset-top)',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                  paddingLeft: 'env(safe-area-inset-left)',
                  paddingRight: 'env(safe-area-inset-right)',
                }}
              >
                {content}
              </div>
              {/* Debug overlay — add ?debug=vitals to URL to show */}
              <WebVitalsOverlay />
            </div>
          </ErrorBoundary>
        </NotificationProvider>
      </PerfModeProvider>
    </MiniAppContext.Provider>
  );
}
