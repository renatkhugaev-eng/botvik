"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HIDDEN CLUE MISSION COMPONENT
 * Миссия с системой скрытых улик — они появляются только после обнаружения
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GooglePanorama, GooglePanoramaRef } from "./GooglePanorama";
import { 
  RevealProgress, 
  RevealedClueMarker, 
  ClueCollectionModal,
  SoftHintFlash,
  ScannerHint,
  ClueCounter,
} from "./HiddenClueUI";
import { useClueDiscovery } from "@/lib/useClueDiscovery";
import { haptic, investigationHaptic } from "@/lib/haptic";
import type { HiddenClueMission as MissionType, HiddenClue, ClueDiscoveryEvent } from "@/types/hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HiddenClueMissionProps {
  mission: MissionType;
  onComplete?: (result: MissionResult) => void;
  onExit?: () => void;
}

interface MissionResult {
  missionId: string;
  cluesCollected: number;
  cluesTotal: number;
  timeSpent: number;
  earnedXp: number;
  completed: boolean;
}

type MissionPhase = "briefing" | "playing" | "completed" | "failed";

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY CONFIG
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

export function HiddenClueMission({
  mission,
  onComplete,
  onExit,
}: HiddenClueMissionProps) {
  // ─── Refs ───
  const panoramaRef = useRef<GooglePanoramaRef>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ─── State ───
  const [phase, setPhase] = useState<MissionPhase>("briefing");
  const [currentPanoId, setCurrentPanoId] = useState<string | null>(null);
  const [currentHeading, setCurrentHeading] = useState(mission.startHeading || 0);
  const [stepCount, setStepCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(mission.timeLimit || 0);
  const [timeSpent, setTimeSpent] = useState(0);
  
  // UI State
  const [showHintFlash, setShowHintFlash] = useState(false);
  const [scannerHintText, setScannerHintText] = useState<string | null>(null);
  const [collectedClue, setCollectedClue] = useState<HiddenClue | null>(null);
  
  // ─── Clue discovery hook ───
  const {
    clueStates,
    availableClues,
    revealingClue,
    revealProgress,
    revealedClues,
    collectedClues,
    hasHintInCurrentPano,
    collectClue,
    showScannerHint,
  } = useClueDiscovery({
    clues: mission.clues,
    currentPanoId,
    currentHeading,
    stepCount,
    enabled: phase === "playing",
    onClueEvent: handleClueEvent,
  });
  
  // ─── Clue event handler ───
  function handleClueEvent(event: ClueDiscoveryEvent) {
    switch (event.type) {
      case "hint":
        // Показываем блик
        setShowHintFlash(true);
        setTimeout(() => setShowHintFlash(false), 300);
        break;
        
      case "revealed":
        // Улика обнаружена — можно теперь собрать
        investigationHaptic?.clueDiscovered();
        break;
        
      case "collected":
        // Показываем модальное окно
        setCollectedClue(event.clue);
        
        // Проверяем завершение
        const newCollectedCount = collectedClues.length + 1;
        if (newCollectedCount >= mission.requiredClues) {
          setTimeout(() => {
            setPhase("completed");
          }, 2000);
        }
        break;
    }
  }
  
  // ─── Timer effect ───
  useEffect(() => {
    if (phase !== "playing") return;
    
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
      
      if (mission.timeLimit) {
        setTimeRemaining(prev => {
          const next = prev - 1;
          if (next <= 0) {
            handleTimeUp();
            return 0;
          }
          if (next === 30) haptic.warning();
          if (next <= 10) haptic.light();
          return next;
        });
      }
    }, 1000);
    
    timerRef.current = interval;
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, mission.timeLimit]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // ─── Auto scanner hint every 30 sec ───
  useEffect(() => {
    if (phase !== "playing") return;
    
    const interval = setInterval(() => {
      const hint = showScannerHint();
      if (hint) {
        setScannerHintText(hint);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [phase, showScannerHint]);
  
  // ─── Handle time up ───
  const handleTimeUp = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    haptic.error();
    
    if (collectedClues.length >= mission.requiredClues) {
      setPhase("completed");
    } else {
      setPhase("failed");
    }
  }, [collectedClues.length, mission.requiredClues]);
  
  // ─── Start mission ───
  const handleStart = () => {
    haptic.heavy();
    investigationHaptic?.suspense();
    setPhase("playing");
    if (mission.timeLimit) setTimeRemaining(mission.timeLimit);
  };
  
  // ─── Handle panorama position change ───
  const handlePositionChange = useCallback((panoId: string) => {
    if (panoId !== currentPanoId) {
      setCurrentPanoId(panoId);
      setStepCount(prev => prev + 1);
      haptic.light();
    }
  }, [currentPanoId]);
  
  // ─── Handle direction change ───
  const handleDirectionChange = useCallback((direction: [number, number]) => {
    setCurrentHeading(direction[0]);
  }, []);
  
  // ─── Handle collect clue ───
  const handleCollect = (clue: HiddenClue) => {
    collectClue(clue.id);
    setCollectedClue(clue);
  };
  
  // ─── Complete mission ───
  const handleComplete = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const earnedXp = Math.round(
      mission.xpReward * (collectedClues.length / mission.clues.length)
    );
    
    const result: MissionResult = {
      missionId: mission.id,
      cluesCollected: collectedClues.length,
      cluesTotal: mission.clues.length,
      timeSpent,
      earnedXp,
      completed: phase === "completed",
    };
    
    haptic.success();
    onComplete?.(result);
  };
  
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
          <button onClick={onExit} className="flex items-center gap-2 text-white/60">
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
              backgroundColor: `${mission.color}20`,
              boxShadow: `0 0 60px ${mission.color}30`,
            }}
          >
            {mission.icon}
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
            className="bg-white/5 rounded-2xl p-4 mb-6 max-w-sm border border-white/10"
          >
            <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">📋 Брифинг</p>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">
              {mission.briefing}
            </p>
          </motion.div>
          
          {/* Warning */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 max-w-sm mb-6"
          >
            <p className="text-amber-400 text-xs text-center">
              ⚠️ Улики скрыты! Осматривайте всё внимательно. Сворачивайте в переулки.
            </p>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex gap-6 mb-8"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{mission.requiredClues}/{mission.clues.length}</div>
              <div className="text-xs text-white/50">Нужно улик</div>
            </div>
            {mission.timeLimit && (
              <>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{formatTime(mission.timeLimit)}</div>
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
            transition={{ delay: 0.7 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            className="w-full py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500"
            style={{ boxShadow: `0 10px 40px ${mission.color}40` }}
          >
            <span className="flex items-center justify-center gap-2">
              🔍 Начать расследование
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
    // Найти revealed улику для маркера
    const revealedClue = availableClues.find(c => {
      const state = clueStates.get(c.id);
      return state?.state === "revealed";
    });
    const revealedClueState = revealedClue ? clueStates.get(revealedClue.id) : null;
    
    return (
      <div className="h-screen bg-[#0a0a12] text-white flex flex-col overflow-hidden relative">
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
            
            {/* Timer */}
            {mission.timeLimit ? (
              <div className={`px-4 py-2 rounded-full backdrop-blur-sm font-mono text-lg font-bold
                ${timeRemaining <= 30 ? "bg-red-500/30 text-red-400 animate-pulse" : "bg-black/40 text-white"}`}>
                ⏱️ {formatTime(timeRemaining)}
              </div>
            ) : (
              <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm font-mono text-lg">
                {formatTime(timeSpent)}
              </div>
            )}
            
            {/* Clue counter */}
            <ClueCounter 
              found={collectedClues.length} 
              total={mission.clues.length}
              required={mission.requiredClues}
            />
          </div>
          
          {/* Hint indicator */}
          {hasHintInCurrentPano && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center"
            >
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">
                👁️ Что-то есть здесь... Осмотрись
              </span>
            </motion.div>
          )}
        </div>
        
        {/* Panorama */}
        <div className="flex-1 relative">
          <GooglePanorama
            ref={panoramaRef}
            coordinates={[40.758, -73.9855]} // Times Square
            direction={[mission.startHeading, 0]}
            allowNavigation={true}
            onDirectionChange={handleDirectionChange}
            onPositionChange={() => {
              // Get panoId from ref when position changes
              const panoId = panoramaRef.current?.getPanoId();
              if (panoId) handlePositionChange(panoId);
            }}
            onReady={() => {
              // Get initial panoId from ref
              const panoId = panoramaRef.current?.getPanoId();
              if (panoId) setCurrentPanoId(panoId);
            }}
            className="w-full h-full"
          />
          
          {/* Soft hint flash */}
          <SoftHintFlash visible={showHintFlash} />
          
          {/* Reveal progress indicator */}
          <AnimatePresence>
            {revealingClue && (
              <RevealProgress clue={revealingClue} progress={revealProgress} />
            )}
          </AnimatePresence>
          
          {/* Revealed clue marker */}
          <AnimatePresence>
            {revealedClue && revealedClueState && (
              <RevealedClueMarker
                clue={revealedClue}
                state={revealedClueState}
                onCollect={() => handleCollect(revealedClue)}
              />
            )}
          </AnimatePresence>
        </div>
        
        {/* Scanner hint */}
        <ScannerHint 
          text={scannerHintText} 
          onDismiss={() => setScannerHintText(null)} 
        />
        
        {/* Collection modal */}
        <AnimatePresence>
          {collectedClue && (
            <ClueCollectionModal
              clue={collectedClue}
              onClose={() => setCollectedClue(null)}
            />
          )}
        </AnimatePresence>
        
        {/* Bottom navigation hint */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
            <span>👆 Крутите камеру</span>
            <span>•</span>
            <span>🚶 Кликайте стрелки для перемещения</span>
          </div>
          
          {/* Step counter (debug) */}
          <div className="text-center text-white/30 text-xs mt-2">
            Шагов: {stepCount}
          </div>
        </div>
      </div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: COMPLETED / FAILED
  // ═══════════════════════════════════════════════════════════════════════════
  
  const earnedXp = phase === "completed"
    ? Math.round(mission.xpReward * (collectedClues.length / mission.clues.length))
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
        {phase === "completed" ? "Дело раскрыто!" : "Время вышло!"}
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-white/60 text-center mb-8"
      >
        {phase === "completed" 
          ? "Вы нашли достаточно улик для раскрытия дела" 
          : `Собрано ${collectedClues.length} из ${mission.requiredClues} улик`
        }
      </motion.p>
      
      {/* Collected clues */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/5 rounded-2xl p-4 w-full max-w-sm mb-6"
      >
        <p className="text-xs text-white/50 uppercase tracking-wider mb-3">Собранные улики</p>
        <div className="space-y-2">
          {collectedClues.map(clue => (
            <div key={clue.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
              <span className="text-xl">{clue.icon}</span>
              <span className="text-sm">{clue.name}</span>
              <span className="ml-auto text-green-400 text-xs">+{clue.xpReward}</span>
            </div>
          ))}
          {collectedClues.length === 0 && (
            <p className="text-white/30 text-sm text-center py-2">Улики не найдены</p>
          )}
        </div>
      </motion.div>
      
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white/5 rounded-2xl p-6 w-full max-w-sm mb-8"
      >
        <div className="flex justify-between mb-4">
          <span className="text-white/60">Собрано улик</span>
          <span className="font-bold">{collectedClues.length}/{mission.clues.length}</span>
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
        transition={{ delay: 0.6 }}
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

