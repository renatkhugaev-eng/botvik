"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE DETECTOR COMPONENT
 * Показывает индикатор когда камера смотрит на улику
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptic";
import type { PanoramaClue, CameraDirection } from "@/types/panorama";
import { isClueVisible } from "@/lib/panorama-utils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClueDetectorProps {
  clues: PanoramaClue[];
  foundClueIds: string[];
  cameraDirection: CameraDirection;
  onClueDetected: (clue: PanoramaClue) => void;
  disabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ClueDetector({
  clues,
  foundClueIds,
  cameraDirection,
  onClueDetected,
  disabled = false,
}: ClueDetectorProps) {
  const [lastHapticClueId, setLastHapticClueId] = useState<string | null>(null);
  
  // Найти улику которая сейчас видна
  const visibleClue = useMemo(() => {
    if (disabled) return null;
    
    for (const clue of clues) {
      // Пропускаем уже найденные
      if (foundClueIds.includes(clue.id)) continue;
      
      // Проверяем видимость
      if (isClueVisible(clue, cameraDirection)) {
        return clue;
      }
    }
    
    return null;
  }, [clues, foundClueIds, cameraDirection, disabled]);
  
  // Вибрация когда нашли новую улику
  useEffect(() => {
    if (visibleClue && visibleClue.id !== lastHapticClueId) {
      haptic.medium();
      setLastHapticClueId(visibleClue.id);
    } else if (!visibleClue) {
      setLastHapticClueId(null);
    }
  }, [visibleClue, lastHapticClueId]);
  
  const handleClick = () => {
    if (visibleClue) {
      haptic.heavy();
      onClueDetected(visibleClue);
    }
  };
  
  return (
    <AnimatePresence>
      {visibleClue && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20"
        >
          <motion.button
            onClick={handleClick}
            className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full shadow-lg shadow-blue-500/40 border border-white/20"
            whileTap={{ scale: 0.95 }}
            animate={{ 
              boxShadow: [
                "0 10px 40px rgba(59, 130, 246, 0.4)",
                "0 10px 60px rgba(59, 130, 246, 0.6)",
                "0 10px 40px rgba(59, 130, 246, 0.4)"
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {/* Иконка с пульсацией */}
            <motion.span
              className="text-2xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              🔍
            </motion.span>
            
            {/* Текст */}
            <span className="text-white font-bold text-sm">
              Нашёл! Нажми сюда
            </span>
            
            {/* XP badge */}
            {visibleClue.xpReward && (
              <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                +{visibleClue.xpReward}
              </span>
            )}
          </motion.button>
          
          {/* Подсказка под кнопкой */}
          <p className="text-center text-white/50 text-xs mt-2">
            {visibleClue.hint || "Ты смотришь в нужном направлении!"}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI INDICATOR (для показа в углу)
// ═══════════════════════════════════════════════════════════════════════════

export function ClueProximityIndicator({
  clues,
  foundClueIds,
  cameraDirection,
}: {
  clues: PanoramaClue[];
  foundClueIds: string[];
  cameraDirection: CameraDirection;
}) {
  // Считаем сколько улик рядом (в пределах 90 градусов)
  const nearbyCount = useMemo(() => {
    let count = 0;
    for (const clue of clues) {
      if (foundClueIds.includes(clue.id)) continue;
      if (isClueVisible(clue, cameraDirection)) {
        count++;
      }
    }
    return count;
  }, [clues, foundClueIds, cameraDirection]);
  
  if (nearbyCount === 0) return null;
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="absolute top-4 right-4 z-10"
    >
      <motion.div
        className="flex items-center gap-2 bg-blue-500/80 backdrop-blur-sm px-3 py-2 rounded-full text-white text-sm font-medium shadow-lg"
        animate={{ 
          boxShadow: [
            "0 0 0 0 rgba(59, 130, 246, 0.5)",
            "0 0 0 10px rgba(59, 130, 246, 0)",
            "0 0 0 0 rgba(59, 130, 246, 0)"
          ]
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <span className="text-lg">🔥</span>
        <span>Горячо!</span>
      </motion.div>
    </motion.div>
  );
}

