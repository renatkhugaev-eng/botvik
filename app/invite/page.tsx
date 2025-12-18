"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Landing страница для реферальных ссылок
 * 
 * Если открыто в Telegram WebApp — редиректит на /miniapp с параметром
 * Если в браузере — показывает кнопку для открытия в Telegram
 */
function InviteContent() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const [isTelegram, setIsTelegram] = useState<boolean | null>(null);
  
  // Имя бота
  const botName = "truecrimetg_bot";
  const telegramLink = `https://t.me/${botName}?start=ref_${refCode || ""}`;
  
  useEffect(() => {
    // Проверяем, открыто ли в Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg?.initData) {
      // Мы в Telegram — редиректим на miniapp с параметром
      setIsTelegram(true);
      
      // Сохраняем реферальный код
      if (refCode) {
        localStorage.setItem("referral_code", refCode);
      }
      
      // Редирект на основное приложение
      window.location.replace("/miniapp");
    } else {
      // Мы в браузере
      setIsTelegram(false);
    }
  }, [refCode]);
  
  // Показываем загрузку пока определяем окружение
  if (isTelegram === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }
  
  // Страница для браузера
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] p-6 text-center">
      {/* Logo/Icon */}
      <div className="mb-6 text-7xl">🎮</div>
      
      {/* Title */}
      <h1 className="mb-3 text-2xl font-bold text-white">
        Тебя пригласили в игру!
      </h1>
      
      {/* Subtitle */}
      <p className="mb-8 max-w-sm text-white/60">
        Открой ссылку в Telegram чтобы начать играть и получить бонус <span className="text-amber-400 font-semibold">+25 XP</span> на старте
      </p>
      
      {/* Telegram Button */}
      <a
        href={telegramLink}
        className="flex items-center gap-3 rounded-2xl bg-[#2AABEE] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#2AABEE]/30 transition-transform hover:scale-105 active:scale-95"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        Открыть в Telegram
      </a>
      
      {/* Footer hint */}
      <p className="mt-6 text-xs text-white/30">
        Или скопируй ссылку и открой в Telegram
      </p>
      
      {/* Referral code display */}
      {refCode && (
        <div className="mt-4 rounded-lg bg-white/5 px-4 py-2">
          <span className="text-xs text-white/40">Код приглашения: </span>
          <span className="font-mono text-sm text-white">{refCode}</span>
        </div>
      )}
    </div>
  );
}

// Loading fallback
function InviteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
    </div>
  );
}

// Default export with Suspense
export default function InvitePage() {
  return (
    <Suspense fallback={<InviteLoading />}>
      <InviteContent />
    </Suspense>
  );
}
