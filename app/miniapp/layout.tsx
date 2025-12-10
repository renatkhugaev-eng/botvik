"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type TelegramWebApp = {
  WebApp?: {
    initData?: string;
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
  | { status: "error"; error: string }
  | { status: "ready"; user: MiniAppUser };

const MiniAppContext = createContext<MiniAppSession>({ status: "loading" });

export function useMiniAppSession() {
  return useContext(MiniAppContext);
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MiniAppSession>({ status: "loading" });

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      queueMicrotask(() => setSession({ status: "error", error: "no_init_data" }));
      return;
    }

    let aborted = false;

    const authenticate = async () => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
          if (!aborted) setSession({ status: "error", error: "auth_failed" });
          return;
        }

        const data = (await res.json()) as MiniAppUser;
        if (!aborted) {
          setSession({ status: "ready", user: data });
        }
      } catch (err) {
        console.error("Auth error", err);
        if (!aborted) setSession({ status: "error", error: "network_error" });
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
          Ошибка авторизации
        </div>
      );
    }

    return children;
  }, [children, session]);

  return (
    <MiniAppContext.Provider value={session}>
      <div className={`min-h-screen w-full ${background} flex justify-center`}>
        <div className="w-full max-w-[600px]">{content}</div>
      </div>
    </MiniAppContext.Provider>
  );
}

