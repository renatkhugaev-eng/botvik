"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION COMPONENT
 * Полноценная миссия с панорамой, уликами, таймером и результатами
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GooglePanorama, GooglePanoramaRef } from "./GooglePanorama";
import { haptic, investigationHaptic } from "@/lib/haptic";
import type { 
  PanoramaMission as MissionType, 
  PanoramaClue as ClueType,
  CameraDirection,
  PanoramaMissionProgress,
  ClueProgress,
} from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PanoramaMissionProps {
  mission: MissionType;
  
  /** Callback при завершении миссии */
  onComplete?: (result: PanoramaMissionProgress) => void;
  
  /** Callback при выходе из миссии */
  onExit?: () => void;
  
  /** Существующий прогресс (для продолжения) */
  existingProgress?: Partial<PanoramaMissionProgress>;
}

type MissionPhase = "briefing" | "playing" | "completed" | "failed";

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY COLORS
// ═══════════════════════════════════════════════════════════════════════════

const DIFFICULTY_COLORS: Record<MissionType["difficulty"], string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
  extreme: "#7c3aed",
};

const DIFFICULTY_LABELS: Record<MissionType["difficulty"], string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
  extreme: "Экстрим",
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PanoramaMission({
  mission,
  onComplete,
  onExit,
  existingProgress,
}: PanoramaMissionProps) {
  // ─── Refs ───
  const panoramaRef = useRef<GooglePanoramaRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ─── State ───
  const [phase, setPhase] = useState<MissionPhase>("briefing");
  const [cameraDirection, setCameraDirection] = useState<CameraDirection>(
    mission.startDirection || [0, 0]
  );
  const [foundClueIds, setFoundClueIds] = useState<string[]>(
    existingProgress?.cluesProgress?.filter(c => c.found).map(c => c.clueId) || []
  );
  const [cluesProgress, setCluesProgress] = useState<ClueProgress[]>(
    existingProgress?.cluesProgress || 
    mission.clues.map(c => ({ clueId: c.id, found: false }))
  );
  const [timeRemaining, setTimeRemaining] = useState(mission.timeLimit || 0);
  const [timeSpent, setTimeSpent] = useState(existingProgress?.timeSpent || 0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showHint, setShowHint] = useState(false);
  
  // ─── Derived state ───
  const totalClues = mission.clues.length;
  const foundCount = foundClueIds.length;
  const requiredClues = mission.requiredClues || totalClues;
  const isComplete = foundCount >= requiredClues;
  
  // ─── Timer effect ───
  useEffect(() => {
    if (phase !== "playing") return;
    
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
      
      if (mission.timeLimit) {
        setTimeRemaining(prev => {
          const next = prev - 1;
          if (next <= 0) {
            // Время вышло
            handleTimeUp();
            return 0;
          }
          if (next === 30) {
            haptic.warning(); // Предупреждение о времени
          }
          if (next <= 10) {
            haptic.light(); // Тиканье
          }
          return next;
        });
      }
    }, 1000);
    
    timerRef.current = interval;
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase, mission.timeLimit]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // ─── Handle time up ───
  const handleTimeUp = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    haptic.error();
    
    if (isComplete) {
      setPhase("completed");
    } else {
      setPhase("failed");
    }
  }, [isComplete]);
  
  // ─── Start mission ───
  const handleStart = () => {
    haptic.heavy();
    investigationHaptic?.suspense();
    setPhase("playing");
    setStartTime(new Date());
    if (mission.timeLimit) {
      setTimeRemaining(mission.timeLimit);
    }
  };
  
  // ─── Find clue ───
  const handleFindClue = useCallback((clue: ClueType) => {
    if (foundClueIds.includes(clue.id)) return;
    
    haptic.success();
    investigationHaptic?.clueDiscovered();
    
    setFoundClueIds(prev => [...prev, clue.id]);
    setCluesProgress(prev => 
      prev.map(cp => 
        cp.clueId === clue.id 
          ? { ...cp, found: true, foundAt: new Date(), isCorrect: true }
          : cp
      )
    );
    
    // Проверяем завершение
    const newFoundCount = foundClueIds.length + 1;
    if (newFoundCount >= requiredClues) {
      setTimeout(() => {
        haptic.success();
        investigationHaptic?.dramaticMoment();
        setPhase("completed");
      }, 500);
    }
  }, [foundClueIds, requiredClues]);
  
  // ─── Answer clue question ───
  const handleAnswerClue = useCallback((clue: ClueType, answer: string | number) => {
    let isCorrect = false;
    
    switch (clue.type) {
      case "text":
        const correctAnswers = Array.isArray(clue.answer) ? clue.answer : [clue.answer || ""];
        isCorrect = correctAnswers.some(a => 
          a.toLowerCase().trim() === String(answer).toLowerCase().trim()
        );
        break;
      
      case "count":
        isCorrect = Number(answer) === clue.correctCount;
        break;
      
      case "identify":
        isCorrect = Number(answer) === clue.correctOptionIndex;
        break;
    }
    
    if (isCorrect) {
      haptic.success();
      investigationHaptic?.clueDiscovered();
    } else {
      haptic.error();
    }
    
    setFoundClueIds(prev => [...prev, clue.id]);
    setCluesProgress(prev =>
      prev.map(cp =>
        cp.clueId === clue.id
          ? { ...cp, found: true, foundAt: new Date(), userAnswer: answer, isCorrect }
          : cp
      )
    );
    
    // Проверяем завершение
    const newFoundCount = foundClueIds.length + 1;
    if (newFoundCount >= requiredClues) {
      setTimeout(() => {
        setPhase("completed");
      }, 500);
    }
  }, [foundClueIds, requiredClues]);
  
  // ─── Complete mission ───
  const handleComplete = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    const correctClues = cluesProgress.filter(cp => cp.isCorrect).length;
    const baseXp = mission.xpReward;
    const speedBonus = mission.speedBonusPerSecond && timeRemaining > 0 
      ? timeRemaining * mission.speedBonusPerSecond 
      : 0;
    const accuracyMultiplier = correctClues / totalClues;
    const earnedXp = Math.round((baseXp + speedBonus) * accuracyMultiplier);
    
    const result: PanoramaMissionProgress = {
      missionId: mission.id,
      status: "completed",
      cluesProgress,
      cluesFound: foundCount,
      cluesTotal: totalClues,
      startedAt: startTime || undefined,
      completedAt: new Date(),
      timeSpent,
      earnedXp,
    };
    
    haptic.success();
    onComplete?.(result);
  };
  
  // ─── Direction change handler ───
  const handleDirectionChange = useCallback((dir: CameraDirection) => {
    setCameraDirection(dir);
  }, []);
  
  // ─── Format time ───
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: BRIEFING
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (phase === "briefing") {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-white/60"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Назад</span>
          </button>
          
          <div 
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: `${DIFFICULTY_COLORS[mission.difficulty]}20`,
              color: DIFFICULTY_COLORS[mission.difficulty],
            }}
          >
            {DIFFICULTY_LABELS[mission.difficulty]}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-6"
            style={{ 
              backgroundColor: `${mission.color || "#06b6d4"}20`,
              boxShadow: `0 0 60px ${mission.color || "#06b6d4"}30`,
            }}
          >
            {mission.icon || "🗺️"}
          </motion.div>
          
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-center mb-2"
          >
            {mission.title}
          </motion.h1>
          
          {/* Location */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/50 text-sm mb-6"
          >
            📍 {mission.location}
          </motion.p>
          
          {/* Briefing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 rounded-2xl p-4 mb-6 max-w-sm"
          >
            <p className="text-white/70 text-sm leading-relaxed text-center">
              {mission.briefing || mission.description}
            </p>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-6 mb-8"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{totalClues}</div>
              <div className="text-xs text-white/50">Улик</div>
            </div>
            {mission.timeLimit && (
              <>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">
                    {formatTime(mission.timeLimit)}
                  </div>
                  <div className="text-xs text-white/50">Время</div>
                </div>
              </>
            )}
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">+{mission.xpReward}</div>
              <div className="text-xs text-white/50">XP</div>
            </div>
          </motion.div>
        </div>
        
        {/* Start button */}
        <div className="p-4 pb-8">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            className="w-full py-4 rounded-2xl font-semibold text-white
              bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg"
            style={{ boxShadow: `0 10px 40px ${mission.color || "#06b6d4"}40` }}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Начать поиск
            </span>
          </motion.button>
        </div>
      </div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PLAYING
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (phase === "playing") {
    return (
      <div className="h-screen bg-[#0a0a12] text-white flex flex-col overflow-hidden">
        {/* HUD - Top */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <button
              onClick={onExit}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Timer (if applicable) */}
            {mission.timeLimit ? (
              <div className={`px-4 py-2 rounded-full backdrop-blur-sm font-mono text-lg font-bold
                ${timeRemaining <= 30 ? "bg-red-500/30 text-red-400" : "bg-black/40 text-white"}`}>
                ⏱️ {formatTime(timeRemaining)}
              </div>
            ) : (
              <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm font-mono text-lg">
                {formatTime(timeSpent)}
              </div>
            )}
            
            {/* Hint button */}
            <button
              onClick={() => setShowHint(!showHint)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <span className="text-lg">💡</span>
            </button>
          </div>
          
          {/* Hint popup */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 p-3 bg-black/60 backdrop-blur-sm rounded-xl text-sm text-white/80"
              >
                {mission.description}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Panorama */}
        <div ref={containerRef} className="flex-1 relative">
          <GooglePanorama
            ref={panoramaRef}
            coordinates={mission.startPoint}
            direction={mission.startDirection}
            allowNavigation={mission.allowNavigation !== false}
            onDirectionChange={handleDirectionChange}
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: COMPLETED / FAILED
  // ═══════════════════════════════════════════════════════════════════════════
  
  const correctClues = cluesProgress.filter(cp => cp.isCorrect).length;
  const earnedXp = phase === "completed" 
    ? Math.round(mission.xpReward * (correctClues / totalClues))
    : 0;
  
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col items-center justify-center px-6">
      {/* Result icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6
          ${phase === "completed" 
            ? "bg-green-500/20 shadow-[0_0_60px_rgba(34,197,94,0.3)]" 
            : "bg-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.3)]"
          }`}
      >
        {phase === "completed" ? "🎉" : "⏰"}
      </motion.div>
      
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`text-2xl font-bold text-center mb-2
          ${phase === "completed" ? "text-green-400" : "text-red-400"}`}
      >
        {phase === "completed" ? "Миссия выполнена!" : "Время вышло!"}
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-white/60 text-center mb-8"
      >
        {phase === "completed" 
          ? "Все улики найдены" 
          : `Найдено ${foundCount} из ${requiredClues} улик`
        }
      </motion.p>
      
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/5 rounded-2xl p-6 w-full max-w-sm mb-8"
      >
        <div className="flex justify-between mb-4">
          <span className="text-white/60">Найдено улик</span>
          <span className="font-bold">{foundCount}/{totalClues}</span>
        </div>
        <div className="flex justify-between mb-4">
          <span className="text-white/60">Правильных ответов</span>
          <span className="font-bold">{correctClues}/{foundCount}</span>
        </div>
        <div className="flex justify-between mb-4">
          <span className="text-white/60">Время</span>
          <span className="font-bold">{formatTime(timeSpent)}</span>
        </div>
        <div className="h-px bg-white/10 my-4" />
        <div className="flex justify-between">
          <span className="text-white/60">Заработано XP</span>
          <span className="font-bold text-green-400">+{earnedXp}</span>
        </div>
      </motion.div>
      
      {/* Action button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleComplete}
        className={`w-full max-w-sm py-4 rounded-2xl font-semibold text-white
          ${phase === "completed"
            ? "bg-gradient-to-r from-green-500 to-emerald-500"
            : "bg-gradient-to-r from-gray-600 to-gray-700"
          }`}
      >
        {phase === "completed" ? "Продолжить" : "Попробовать снова"}
      </motion.button>
    </div>
  );
}

