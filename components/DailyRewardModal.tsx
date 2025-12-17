"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptic";
import { api } from "@/lib/api";
import type { DailyReward, DailyRewardStatus } from "@/lib/daily-rewards";

const spring = { type: "spring", stiffness: 400, damping: 30 };

type DailyRewardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onClaim: (reward: DailyReward, newXp: number, levelUp: boolean) => void;
};

type ClaimResponse = {
  ok: boolean;
  reward: DailyReward;
  newStreak: number;
  totalXp: number;
  levelUp: boolean;
  newLevel?: number;
  levelInfo: {
    level: number;
    progress: number;
    title: string;
    icon: string;
  };
};

export function DailyRewardModal({ isOpen, onClose, onClaim }: DailyRewardModalProps) {
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimedReward, setClaimedReward] = useState<DailyReward | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState<number | undefined>();

  // Загрузка статуса при открытии
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const data = await api.get<DailyRewardStatus & { totalXp: number }>("/api/daily-reward");
        setStatus(data);
        // Если уже забрал сегодня, не показываем модалку
        if (data.claimedToday) {
          onClose();
        }
      } catch (err) {
        console.error("Failed to fetch daily reward status:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatus();
  }, [isOpen, onClose]);

  // Забрать награду
  const handleClaim = useCallback(async () => {
    if (!status?.canClaim || claiming) return;
    
    setClaiming(true);
    haptic.medium();
    
    try {
      const data = await api.post<ClaimResponse>("/api/daily-reward", {});
      
      if (data.ok) {
        setClaimed(true);
        setClaimedReward(data.reward);
        setLevelUp(data.levelUp);
        setNewLevel(data.newLevel);
        haptic.success();
        
        // Уведомляем родителя
        onClaim(data.reward, data.totalXp, data.levelUp);
        
        // Закрываем через 2.5 секунды
        setTimeout(() => {
          onClose();
          // Сбрасываем состояние для следующего открытия
          setTimeout(() => {
            setClaimed(false);
            setClaimedReward(null);
            setLevelUp(false);
            setNewLevel(undefined);
          }, 300);
        }, 2500);
      }
    } catch (err) {
      console.error("Failed to claim daily reward:", err);
      haptic.error();
    } finally {
      setClaiming(false);
    }
  }, [status, claiming, onClaim, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={spring}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          {loading ? (
            // Loading state
            <div className="flex h-80 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
            </div>
          ) : claimed && claimedReward ? (
            // Success state
            <div className="p-6 text-center">
              {/* Celebration animation */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto mb-6"
              >
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                  {/* Glow effect */}
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 blur-xl"
                  />
                  {/* Main circle */}
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl">
                    <span className="text-5xl">{claimedReward.icon}</span>
                  </div>
                </div>
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[24px] font-black text-[#1a1a2e]"
              >
                {claimedReward.isSpecial ? "🎉 Отлично!" : "Получено!"}
              </motion.h2>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 space-y-2"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2">
                  <span className="text-xl">✨</span>
                  <span className="text-[16px] font-bold text-violet-700">+{claimedReward.xp} XP</span>
                </div>
                
                {claimedReward.bonusEnergy > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 ml-2">
                    <span className="text-xl">⚡</span>
                    <span className="text-[16px] font-bold text-amber-700">+{claimedReward.bonusEnergy} Энергия</span>
                  </div>
                )}
              </motion.div>
              
              {levelUp && newLevel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="mt-6 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 p-4"
                >
                  <p className="text-[14px] text-white/80">Новый уровень!</p>
                  <p className="text-[28px] font-black text-white">Level {newLevel} 🎊</p>
                </motion.div>
              )}
            </div>
          ) : status ? (
            // Main content
            <>
              {/* Header */}
              <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                >
                  <span className="text-5xl">{status.nextReward.icon}</span>
                </motion.div>
                <h2 className="font-display text-[24px] font-black text-white">
                  Ежедневная награда
                </h2>
                <p className="mt-2 text-[14px] text-white/80">
                  {status.streakBroken 
                    ? "Серия прервалась! Начни заново" 
                    : status.currentStreak > 0 
                      ? `Серия: ${status.currentStreak} ${status.currentStreak === 1 ? "день" : status.currentStreak < 5 ? "дня" : "дней"}`
                      : "Заходи каждый день за наградами!"}
                </p>
              </div>

              {/* Rewards grid */}
              <div className="p-5">
                <div className="mb-5 grid grid-cols-7 gap-1.5">
                  {status.allRewards.map((reward, index) => {
                    const isCurrent = index + 1 === (status.currentStreak % 7) + 1;
                    const isPast = index + 1 <= status.currentStreak % 7 && !status.streakBroken;
                    const isToday = isCurrent && status.canClaim;
                    
                    return (
                      <motion.div
                        key={reward.day}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`relative flex flex-col items-center rounded-xl p-2 ${
                          isToday
                            ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30 ring-2 ring-white"
                            : isPast
                              ? "bg-emerald-100"
                              : "bg-slate-100"
                        }`}
                      >
                        {/* Checkmark for past days */}
                        {isPast && (
                          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                            ✓
                          </div>
                        )}
                        
                        {/* Day number */}
                        <span className={`text-[10px] font-bold ${isToday ? "text-white" : isPast ? "text-emerald-700" : "text-slate-400"}`}>
                          {reward.day}
                        </span>
                        
                        {/* Icon */}
                        <span className={`text-lg ${isToday ? "" : isPast ? "opacity-80" : "opacity-60"}`}>
                          {reward.icon}
                        </span>
                        
                        {/* XP */}
                        <span className={`text-[9px] font-bold ${isToday ? "text-white" : isPast ? "text-emerald-600" : "text-slate-500"}`}>
                          +{reward.xp}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Today's reward highlight */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-5 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                        <span className="text-2xl">{status.nextReward.icon}</span>
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-[#1a1a2e]">{status.nextReward.title}</p>
                        <p className="text-[12px] text-slate-500">{status.nextReward.description}</p>
                      </div>
                    </div>
                    {status.nextReward.isSpecial && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                        СУПЕР
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* Claim button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!status.canClaim || claiming}
                  onClick={handleClaim}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-[16px] font-bold text-white shadow-lg shadow-orange-500/30 disabled:opacity-50"
                >
                  {claiming ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                    />
                  ) : (
                    <>
                      <span className="text-xl">🎁</span>
                      Забрать награду
                    </>
                  )}
                </motion.button>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="mt-4 w-full text-center text-[14px] text-slate-400 hover:text-slate-600"
                >
                  Позже
                </button>
              </div>
            </>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY REWARD BUTTON — Показывает на главной странице
// ═══════════════════════════════════════════════════════════════════════════

type DailyRewardButtonProps = {
  onClick: () => void;
  hasReward: boolean;
  streak: number;
};

export function DailyRewardButton({ onClick, hasReward, streak }: DailyRewardButtonProps) {
  if (!hasReward) return null;
  
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        haptic.medium();
        onClick();
      }}
      className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 shadow-lg shadow-orange-500/30"
    >
      {/* Pulse effect */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500"
      />
      
      <span className="relative text-xl">🎁</span>
      <div className="relative text-left">
        <p className="text-[12px] font-bold text-white">Награда</p>
        <p className="text-[10px] text-white/80">
          {streak > 0 ? `День ${(streak % 7) + 1}` : "Забери!"}
        </p>
      </div>
    </motion.button>
  );
}
