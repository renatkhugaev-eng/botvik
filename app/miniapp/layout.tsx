"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { NotificationProvider } from "@/components/InAppNotification";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setUser, addBreadcrumb } from "@/lib/sentry";
import { identifyUser } from "@/lib/posthog";
import { PerfModeProvider } from "@/components/context/PerfModeContext";
import { WebVitalsOverlay } from "@/components/debug/WebVitalsOverlay";
import { haptic } from "@/lib/haptic";
import { useDeviceCSSVariables } from "@/lib/useDeviceInfo";

// Динамический импорт Lottie для загрузочного экрана
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Компонент анимации кота для загрузки
function CatLoadingAnimation() {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch("/animations/cat Mark loading.json")
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch((err) => console.error("Failed to load cat animation:", err));
  }, []);

  if (!animationData) {
    return (
      <div className="h-40 w-40 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-red-900/30 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="h-48 w-48">
      <Lottie animationData={animationData} loop={true} className="h-full w-full" />
    </div>
  );
}

// Telegram types imported from types/telegram.d.ts

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
  
  // Устанавливаем CSS переменные для адаптивного layout
  useDeviceCSSVariables();

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
        // Fallback - use actual dev-mock user ID from database
        setSession({
          status: "ready",
          user: {
            id: 2952,
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
      
      // Only log in development to avoid leaking sensitive data
      if (process.env.NODE_ENV === "development") {
        console.log("[MiniApp] initData length", initData?.length);
        // Don't log full initDataUnsafe — it contains sensitive user data
      }

      // If initData is empty but initDataUnsafe has user, try to use it for dev
      if (!initData && initDataUnsafe?.user) {
        if (process.env.NODE_ENV === "development") {
          console.log("[MiniApp] Using initDataUnsafe user directly");
        }
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
          // Fallback - use actual dev-mock user ID from database
          setSession({
            status: "ready",
            user: {
              id: 2952,
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
        
        // Auth request with timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout
        
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            initData: initData ?? "",
            referralCode: savedRefCode || undefined, // Передаём реферальный код
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

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
        if (!aborted) {
          // Check if it's a timeout/abort error
          if (err instanceof Error && err.name === 'AbortError') {
            setSession({ status: "error", reason: "AUTH_TIMEOUT" });
          } else {
            setSession({ status: "error", reason: "NETWORK_ERROR" });
          }
        }
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f]">
          <CatLoadingAnimation />
          <p className="mt-2 text-sm text-white/50">Загрузка...</p>
        </div>
      );
    }

    if (session.status === "error") {
      const isTimeout = session.reason === "AUTH_TIMEOUT";
      const isNetwork = session.reason === "NETWORK_ERROR";
      
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 bg-[#0a0a0f]">
          <div className="w-full max-w-sm rounded-3xl bg-[#1a1a2e] border border-white/10 p-8 text-center">
            <div className="text-5xl mb-4">{isTimeout ? "⏱️" : isNetwork ? "📡" : "😔"}</div>
            <div className="text-lg font-semibold text-white">
              {isTimeout ? "Превышено время ожидания" : isNetwork ? "Проблема с сетью" : "Ошибка авторизации"}
            </div>
            <div className="mt-2 text-sm text-white/60">
              {isTimeout || isNetwork 
                ? "Проверьте интернет-соединение и попробуйте снова" 
                : "Откройте приложение из Telegram"}
            </div>
            <div className="mt-4 rounded-xl bg-black/30 px-3 py-2 text-xs text-white/40 font-mono">{session.reason}</div>
            {(isTimeout || isNetwork) && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors"
              >
                Попробовать снова
              </button>
            )}
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
            {/* Telegram SDK - afterInteractive to not block initial render */}
            <Script 
              src="https://telegram.org/js/telegram-web-app.js" 
              strategy="afterInteractive"
              onError={(e) => console.error("[TelegramSDK] Failed to load:", e)}
            />
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
