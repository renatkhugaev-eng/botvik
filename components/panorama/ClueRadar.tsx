"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE RADAR COMPONENT
 * Показывает насколько близко игрок к ближайшей улике (теплее/холоднее)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanoramaClue, CameraDirection } from "@/types/panorama";
import { normalizeYaw } from "@/lib/panorama-utils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClueRadarProps {
  clues: PanoramaClue[];
  foundClueIds: string[];
  cameraDirection: CameraDirection;
  className?: string;
}

type HeatLevel = "freezing" | "cold" | "warm" | "hot" | "burning";

// ═══════════════════════════════════════════════════════════════════════════
// HEAT CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const HEAT_CONFIG: Record<HeatLevel, { 
  label: string; 
  emoji: string; 
  color: string; 
  bg: string;
  pulse: boolean;
}> = {
  freezing: { 
    label: "Холодно", 
    emoji: "❄️", 
    color: "text-blue-300",
    bg: "bg-blue-500/20",
    pulse: false,
  },
  cold: { 
    label: "Прохладно", 
    emoji: "🌊", 
    color: "text-cyan-400",
    bg: "bg-cyan-500/20",
    pulse: false,
  },
  warm: { 
    label: "Тепло", 
    emoji: "☀️", 
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    pulse: false,
  },
  hot: { 
    label: "Горячо!", 
    emoji: "🔥", 
    color: "text-orange-400",
    bg: "bg-orange-500/30",
    pulse: true,
  },
  burning: { 
    label: "ОЧЕНЬ ГОРЯЧО!", 
    emoji: "💥", 
    color: "text-red-400",
    bg: "bg-red-500/40",
    pulse: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Вычисляет расстояние до улики в градусах
 */
function getDistanceToClue(
  clue: PanoramaClue,
  cameraYaw: number,
  cameraPitch: number
): number {
  let clueYaw: number;
  let cluePitch = 0;
  
  if (clue.position) {
    clueYaw = clue.position.yaw;
    cluePitch = clue.position.pitch;
  } else if (clue.sector) {
    // Центр сектора
    const from = normalizeYaw(clue.sector.fromYaw);
    const to = normalizeYaw(clue.sector.toYaw);
    if (from <= to) {
      clueYaw = (from + to) / 2;
    } else {
      clueYaw = normalizeYaw((from + to + 360) / 2);
    }
  } else {
    return 999;
  }
  
  // Разница углов
  let yawDiff = Math.abs(normalizeYaw(cameraYaw) - normalizeYaw(clueYaw));
  if (yawDiff > 180) yawDiff = 360 - yawDiff;
  
  const pitchDiff = Math.abs(cameraPitch - cluePitch);
  
  return Math.sqrt(yawDiff ** 2 + pitchDiff ** 2);
}

/**
 * Определяет уровень "тепла" по расстоянию
 */
function getHeatLevel(distance: number): HeatLevel {
  if (distance <= 15) return "burning";
  if (distance <= 30) return "hot";
  if (distance <= 60) return "warm";
  if (distance <= 120) return "cold";
  return "freezing";
}

/**
 * Получает направление к ближайшей улике
 */
function getDirectionArrow(
  clue: PanoramaClue,
  cameraYaw: number
): string {
  let clueYaw: number;
  
  if (clue.position) {
    clueYaw = clue.position.yaw;
  } else if (clue.sector) {
    const from = normalizeYaw(clue.sector.fromYaw);
    const to = normalizeYaw(clue.sector.toYaw);
    clueYaw = from <= to ? (from + to) / 2 : normalizeYaw((from + to + 360) / 2);
  } else {
    return "";
  }
  
  let diff = normalizeYaw(clueYaw) - normalizeYaw(cameraYaw);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  if (Math.abs(diff) <= 20) return "⬆️";
  if (diff > 0 && diff <= 90) return "↗️";
  if (diff > 90) return "➡️";
  if (diff < 0 && diff >= -90) return "↖️";
  return "⬅️";
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ClueRadar({
  clues,
  foundClueIds,
  cameraDirection,
  className = "",
}: ClueRadarProps) {
  const [cameraYaw, cameraPitch] = cameraDirection;
  
  // Находим ближайшую ненайденную улику
  const { nearestClue, distance, heatLevel, arrow } = useMemo(() => {
    let nearest: PanoramaClue | null = null;
    let minDist = Infinity;
    
    for (const clue of clues) {
      if (foundClueIds.includes(clue.id)) continue;
      
      const dist = getDistanceToClue(clue, cameraYaw, cameraPitch);
      if (dist < minDist) {
        minDist = dist;
        nearest = clue;
      }
    }
    
    return {
      nearestClue: nearest,
      distance: minDist,
      heatLevel: getHeatLevel(minDist),
      arrow: nearest ? getDirectionArrow(nearest, cameraYaw) : "",
    };
  }, [clues, foundClueIds, cameraYaw, cameraPitch]);
  
  // Если все улики найдены
  if (!nearestClue) {
    return null;
  }
  
  const config = HEAT_CONFIG[heatLevel];
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${config.bg} backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10 ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Emoji индикатор */}
        <motion.span 
          className="text-2xl"
          animate={config.pulse ? { 
            scale: [1, 1.2, 1],
          } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {config.emoji}
        </motion.span>
        
        {/* Текст */}
        <div className="flex-1">
          <p className={`font-bold ${config.color}`}>
            {config.label}
          </p>
          <p className="text-xs text-white/50">
            Осталось улик: {clues.length - foundClueIds.length}
          </p>
        </div>
        
        {/* Стрелка направления */}
        <AnimatePresence mode="wait">
          <motion.span
            key={arrow}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="text-2xl"
          >
            {arrow}
          </motion.span>
        </AnimatePresence>
      </div>
      
      {/* Прогресс-бар тепла */}
      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            heatLevel === "burning" ? "bg-red-500" :
            heatLevel === "hot" ? "bg-orange-500" :
            heatLevel === "warm" ? "bg-yellow-500" :
            heatLevel === "cold" ? "bg-cyan-500" :
            "bg-blue-500"
          }`}
          initial={{ width: 0 }}
          animate={{ 
            width: `${Math.max(5, 100 - (distance / 180) * 100)}%` 
          }}
          transition={{ type: "spring", damping: 20 }}
        />
      </div>
    </motion.div>
  );
}

