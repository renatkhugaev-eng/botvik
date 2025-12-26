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
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        >
          {/* Пульсирующий круг */}
          <motion.div
            className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl"
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.5, 0.2, 0.5]
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Кнопка */}
          <motion.button
            onClick={handleClick}
            className="relative flex flex-col items-center gap-2 px-6 py-4 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-2xl shadow-blue-500/30 border border-white/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Иконка */}
            <motion.div
              className="text-3xl"
              animate={{ 
                rotate: [-5, 5, -5],
                y: [0, -3, 0]
              }}
              transition={{ 
                duration: 0.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              🔍
            </motion.div>
            
            {/* Текст */}
            <div className="text-center">
              <p className="text-white font-bold text-sm">
                Здесь что-то есть!
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                Нажми чтобы исследовать
              </p>
            </div>
            
            {/* Награда */}
            {visibleClue.xpReward && (
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                +{visibleClue.xpReward} XP
              </div>
            )}
          </motion.button>
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

