"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Script from "next/script";

type TelegramWebApp = {
  WebApp?: {
    initData?: string;
    ready?: () => void;
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

  useEffect(() => {
    let aborted = false;
    let attempts = 0;
    const maxAttempts = 10;
    const delayMs = 200;

    const authenticate = async () => {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.ready) tg.ready();
      console.log("[MiniApp] Telegram WebApp present:", Boolean(tg));

      const initData = tg?.initData;
      console.log("[MiniApp] initData length", initData?.length, initData?.slice?.(0, 80));

      if (!initData) {
        if (attempts < maxAttempts) {
          attempts += 1;
          setTimeout(authenticate, delayMs);
          return;
        }
        if (!aborted) {
          setSession({ status: "error", reason: "NO_TELEGRAM_WEBAPP" });
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
  }, []);

  const background = "bg-[#F4F5FB]";

  const content = useMemo(() => {
    if (session.status === "loading") {
      return (
        <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
          Загрузка…
        </div>
      );
    }

    if (session.status === "error") {
      return (
        <div className="flex min-h-screen items-center justify-center text-sm text-red-600">
          <div className="text-center">
            <div>Ошибка авторизации</div>
            {process.env.NODE_ENV !== "production" ? (
              <div className="mt-2 text-xs text-gray-500">Reason: {session.reason}</div>
            ) : null}
          </div>
        </div>
      );
    }

    return children;
  }, [children, session]);

  return (
    <MiniAppContext.Provider value={session}>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className={`min-h-screen w-full ${background} flex justify-center`}>
        <div className="w-full max-w-[600px]">{content}</div>
      </div>
    </MiniAppContext.Provider>
  );
}

