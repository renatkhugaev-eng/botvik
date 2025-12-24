"use client";

import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import type { ReferralStats } from "@/lib/referral";
import { REFERRAL_REWARDS } from "@/lib/referral";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ReferralData = ReferralStats & {
  rewards: typeof REFERRAL_REWARDS;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ReferralSection = memo(function ReferralSection() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Загрузка данных при раскрытии
  const loadData = useCallback(async () => {
    if (data) return; // Уже загружено
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<ReferralData>("/api/referral");
      setData(response);
    } catch (err) {
      setError("Не удалось загрузить");
      console.error("[Referral] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [data]);

  // Копирование ссылки
  const copyLink = useCallback(async () => {
    if (!data) return;
    
    try {
      await navigator.clipboard.writeText(data.referralLink);
      haptic.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      haptic.error();
    }
  }, [data]);

  // Шаринг через Telegram
  const shareToTelegram = useCallback(() => {
    if (!data) return;
    
    haptic.medium();
    const text = encodeURIComponent(
      `🎮 Играй со мной в крутую викторину! Получи +${data.rewards.referred.xp} XP в подарок 🎁`
    );
    const url = encodeURIComponent(data.referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  }, [data]);

  // Toggle expand
  const toggleExpand = () => {
    haptic.light();
    setExpanded(!expanded);
    if (!expanded) {
      loadData();
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1a1a2e] to-[#16162a] p-4">
      {/* Header - всегда видимый */}
      <button
        onClick={toggleExpand}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-xl">
            🔗
          </div>
          <div className="text-left">
            <div className="font-semibold text-white">Пригласи друзей</div>
            <div className="text-xs text-white/50">
              Получи +{REFERRAL_REWARDS.referrer.xp} XP за каждого
            </div>
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/50"
        >
          ▼
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                </div>
              ) : error ? (
                <div className="text-center text-sm text-red-400">{error}</div>
              ) : data ? (
                <>
                  {/* Статистика */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/5 p-3 text-center">
                      <div className="text-lg font-bold text-white">
                        {data.referralsCount}
                      </div>
                      <div className="text-[10px] text-white/50">Друзей</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 text-center">
                      <div className="text-lg font-bold text-amber-400">
                        +{data.totalXpEarned}
                      </div>
                      <div className="text-[10px] text-white/50">XP</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3 text-center">
                      <div className="text-lg font-bold text-cyan-400">
                        +{data.totalEnergyEarned}
                      </div>
                      <div className="text-[10px] text-white/50">Энергия</div>
                    </div>
                  </div>

                  {/* Реферальный код */}
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="mb-2 text-xs text-white/50">Твой код:</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-black/30 px-3 py-2 font-mono text-sm tracking-widest text-white">
                        {data.referralCode}
                      </div>
                      <button
                        onClick={copyLink}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          copied
                            ? "bg-green-500 text-white"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {copied ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>

                  {/* Кнопки */}
                  <div className="flex gap-2">
                    <button
                      onClick={copyLink}
                      className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
                    >
                      {copied ? "Скопировано! ✓" : "Копировать ссылку"}
                    </button>
                    <button
                      onClick={shareToTelegram}
                      className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Поделиться 📤
                    </button>
                  </div>

                  {/* Награды */}
                  <div className="rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-3">
                    <div className="mb-2 text-xs font-medium text-white/70">
                      Награды:
                    </div>
                    <div className="space-y-1 text-xs text-white/60">
                      <div>
                        🎁 Ты получаешь: +{data.rewards.referrer.xp} XP и +
                        {data.rewards.referrer.bonusEnergy} энергию
                      </div>
                      <div>
                        🎉 Друг получает: +{data.rewards.referred.xp} XP на старте
                      </div>
                    </div>
                  </div>

                  {/* Список приглашённых */}
                  {data.referrals.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs text-white/50">
                        Приглашённые друзья ({data.referrals.length}):
                      </div>
                      <div className="max-h-32 space-y-2 overflow-y-auto">
                        {data.referrals.map((ref) => (
                          <div
                            key={ref.id}
                            className="flex items-center gap-2 rounded-lg bg-white/5 p-2"
                          >
                            {ref.photoUrl ? (
                              <Image
                                src={ref.photoUrl}
                                alt=""
                                width={32}
                                height={32}
                                loading="lazy"
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm">
                                👤
                              </div>
                            )}
                            <div className="flex-1 truncate text-sm text-white">
                              {ref.firstName || ref.username || "Аноним"}
                            </div>
                            <div className="text-[10px] text-white/30">
                              {new Date(ref.joinedAt).toLocaleDateString("ru")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Display name for React DevTools
ReferralSection.displayName = "ReferralSection";
