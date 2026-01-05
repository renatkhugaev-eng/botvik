"use client";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DAILY CHALLENGES — Компонент ежедневных заданий
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

interface ChallengeProgress {
  id: number;
  slot: number;
  type: string;
  title: string;
  description: string | null;
  icon: string;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
  xpReward: number;
  energyReward: number;
  difficulty: number;
}

interface DailyChallengesData {
  date: string;
  challenges: ChallengeProgress[];
  allCompleted: boolean;
  allClaimed: boolean;
  bonusClaimed: boolean;
  bonusReward: {
    type: string;
    value: string;
    description: string;
  };
  expiresAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) return "Обновляется...";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
}

function getDifficultyColor(difficulty: number): string {
  switch (difficulty) {
    case 1: return "text-green-500";
    case 2: return "text-amber-500";
    case 3: return "text-red-500";
    default: return "text-slate-500";
  }
}

function getDifficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1: return "Легко";
    case 2: return "Средне";
    case 3: return "Сложно";
    default: return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

interface DailyChallengesProps {
  className?: string;
  onXpEarned?: (amount: number) => void;
}

export function DailyChallenges({ className = "", onXpEarned }: DailyChallengesProps) {
  const [data, setData] = useState<DailyChallengesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");
  
  // Загрузка данных
  const loadChallenges = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/challenges/daily");
      if (response.ok) {
        const json = await response.json();
        if (json.ok) {
          setData(json);
          setError(null);
        } else {
          setError(json.error || "Ошибка загрузки");
        }
      } else {
        setError("Ошибка сети");
      }
    } catch (err) {
      console.error("[DailyChallenges] Load error:", err);
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);
  
  // Таймер обновления — обновляем сразу при получении данных
  useEffect(() => {
    if (!data?.expiresAt) return;
    
    // Устанавливаем начальное значение сразу
    setTimeRemaining(formatTimeRemaining(data.expiresAt));
    
    // Обновляем каждую минуту
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(data.expiresAt));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [data?.expiresAt]);
  
  // Клейм награды за задание
  const handleClaim = async (challengeId: number) => {
    if (claimingId) return;
    
    setClaimingId(challengeId);
    haptic.medium();
    
    try {
      const response = await fetchWithAuth("/api/challenges/daily", {
        method: "POST",
        body: JSON.stringify({ challengeId }),
      });
      
      const json = await response.json();
      
      if (json.ok) {
        haptic.success();
        setData(json);
        if (json.xpEarned && onXpEarned) {
          onXpEarned(json.xpEarned);
        }
      } else {
        haptic.error();
      }
    } catch (err) {
      console.error("[DailyChallenges] Claim error:", err);
      haptic.error();
    } finally {
      setClaimingId(null);
    }
  };
  
  // Клейм бонуса за все задания
  const handleClaimBonus = async () => {
    if (claimingBonus) return;
    
    setClaimingBonus(true);
    haptic.heavy();
    
    try {
      const response = await fetchWithAuth("/api/challenges/daily", {
        method: "POST",
        body: JSON.stringify({ claimBonus: true }),
      });
      
      const json = await response.json();
      
      if (json.ok) {
        haptic.success();
        setData(json);
        if (json.xpEarned && onXpEarned) {
          onXpEarned(json.xpEarned);
        }
      } else {
        haptic.error();
      }
    } catch (err) {
      console.error("[DailyChallenges] Claim bonus error:", err);
      haptic.error();
    } finally {
      setClaimingBonus(false);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (error || !data) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <CardContent className="p-4 text-center">
          <span className="text-2xl">😔</span>
          <p className="mt-2 text-sm text-muted-foreground">{error || "Ошибка загрузки"}</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={loadChallenges}
            className="mt-2"
          >
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`overflow-hidden border-0 shadow-lg ${className}`}>
      {/* Gradient header */}
      <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-xl">🎯</span>
            <span>Ежедневные задания</span>
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            ⏱ {timeRemaining}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <AnimatePresence mode="popLayout">
          {data.challenges.map((challenge, index) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              className={`relative rounded-xl border p-3 transition-all ${
                challenge.isClaimed 
                  ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                  : challenge.isCompleted
                    ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                    : "bg-card border-border"
              }`}
            >
              {/* Completed checkmark */}
              {challenge.isClaimed && (
                <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs shadow-lg">
                  ✓
                </div>
              )}
              
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                  challenge.isClaimed 
                    ? "bg-green-100 dark:bg-green-800"
                    : challenge.isCompleted
                      ? "bg-amber-100 dark:bg-amber-800"
                      : "bg-muted"
                }`}>
                  {challenge.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{challenge.title}</p>
                    <span className={`text-[10px] font-medium ${getDifficultyColor(challenge.difficulty)}`}>
                      {getDifficultyLabel(challenge.difficulty)}
                    </span>
                  </div>
                  
                  {/* Progress */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress 
                      value={(challenge.currentValue / challenge.targetValue) * 100} 
                      className="h-2 flex-1"
                    />
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {challenge.currentValue}/{challenge.targetValue}
                    </span>
                  </div>
                  
                  {/* Rewards */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-amber-600 font-medium">
                      +{challenge.xpReward} XP
                    </span>
                    {challenge.energyReward > 0 && (
                      <span className="text-xs text-violet-600 font-medium">
                        +{challenge.energyReward} ⚡
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Claim button */}
                {challenge.isCompleted && !challenge.isClaimed && (
                  <Button
                    size="sm"
                    onClick={() => handleClaim(challenge.id)}
                    disabled={claimingId === challenge.id}
                    className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                  >
                    {claimingId === challenge.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      "Забрать"
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Bonus for completing all */}
        {data.allClaimed && !data.bonusClaimed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4"
          >
            <Button
              onClick={handleClaimBonus}
              disabled={claimingBonus}
              className="w-full h-12 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white border-0 shadow-lg shadow-purple-500/25"
            >
              {claimingBonus ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span className="mr-2">🎁</span>
                  Забрать бонус: {data.bonusReward.description}
                </>
              )}
            </Button>
          </motion.div>
        )}
        
        {/* All done message */}
        {data.bonusClaimed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-2"
          >
            <span className="text-2xl">🎉</span>
            <p className="mt-1 text-sm text-muted-foreground">
              Все задания выполнены! Возвращайся завтра
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default DailyChallenges;

