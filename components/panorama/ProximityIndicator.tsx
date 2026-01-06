"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROXIMITY INDICATOR
 * Визуальный индикатор направления к улике
 * 
 * Показывает:
 * - Стрелку направления (лево/право/назад)
 * - Температуру (холодно/тепло/горячо)
 * - Пульсацию при приближении
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { motion, AnimatePresence } from "framer-motion";
import type { ProximityTemperature } from "@/lib/useProximityAudio";
import type { IntensityLevel } from "@/types/audio-hints";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ProximityIndicatorProps {
  temperature: ProximityTemperature;
  visible?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TEMPERATURE_COLORS: Record<IntensityLevel, string> = {
  cold: "#3b82f6",      // Blue
  warm: "#f59e0b",      // Amber
  hot: "#ef4444",       // Red
  burning: "#dc2626",   // Dark Red
};

const TEMPERATURE_LABELS: Record<IntensityLevel, string> = {
  cold: "Холодно",
  warm: "Теплее...",
  hot: "Горячо!",
  burning: "🔥 Очень горячо!",
};

const TEMPERATURE_ICONS: Record<IntensityLevel, string> = {
  cold: "❄️",
  warm: "🌡️",
  hot: "🔥",
  burning: "💥",
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Стрелка направления
 */
function DirectionArrow({ headingDelta }: { headingDelta: number }) {
  const absDelta = Math.abs(headingDelta);
  
  // Определяем иконку и поворот
  let rotation = 0;
  let icon = "👁️";
  
  if (absDelta <= 20) {
    icon = "👁️"; // Смотрит прямо
  } else if (absDelta > 135) {
    icon = "↩️"; // Сзади
    rotation = 180;
  } else if (headingDelta > 0) {
    icon = "➡️"; // Справа
    rotation = 0;
  } else {
    icon = "⬅️"; // Слева
    rotation = 0;
  }
  
  return (
    <motion.span
      animate={{ 
        rotate: rotation,
        scale: absDelta <= 20 ? [1, 1.2, 1] : 1,
      }}
      transition={{ 
        rotate: { duration: 0.3 },
        scale: { duration: 0.5, repeat: Infinity },
      }}
      className="text-lg"
    >
      {icon}
    </motion.span>
  );
}

/**
 * Пульсирующий круг
 * Пульсирует ВСЕГДА когда есть улика, но скорость зависит от температуры
 */
function PulseCircle({ level }: { level: IntensityLevel }) {
  const color = TEMPERATURE_COLORS[level];
  
  // Скорость пульсации зависит от температуры
  // cold: медленная, burning: быстрая
  const pulseDuration = 
    level === "burning" ? 0.3 : 
    level === "hot" ? 0.5 : 
    level === "warm" ? 0.8 :
    1.2; // cold — очень медленная
  
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ 
        backgroundColor: color,
        opacity: 0.3,
      }}
      animate={{
        scale: [1, 1.3, 1],
        opacity: [0.3, 0.1, 0.3],
      }}
      transition={{
        duration: pulseDuration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

/**
 * Текстовая подсказка направления
 * Показывается ВСЕГДА когда есть улика (включая cold)
 */
function DirectionHint({ headingDelta }: { headingDelta: number }) {
  const absDelta = Math.abs(headingDelta);
  let hint = "";
  
  if (absDelta <= 20) {
    hint = "Смотри внимательнее!";
  } else if (absDelta > 135) {
    hint = "Развернись!";
  } else if (headingDelta > 0) {
    hint = absDelta > 90 ? "Поверни направо →" : "Чуть правее";
  } else {
    hint = absDelta > 90 ? "← Поверни налево" : "Чуть левее";
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="text-xs text-white/70 mt-1 whitespace-nowrap"
    >
      {hint}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ProximityIndicator({ 
  temperature, 
  visible = true 
}: ProximityIndicatorProps) {
  const { level, headingDelta, isLookingAtClue, closestClue } = temperature;
  
  // Не показываем только если нет улик
  if (!visible || !closestClue) {
    return null;
  }
  
  const color = TEMPERATURE_COLORS[level];
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed left-1/2 bottom-32 -translate-x-1/2 z-30 pointer-events-none"
      >
        <div className="flex flex-col items-center">
          {/* Основной индикатор */}
          <motion.div
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{ 
              backgroundColor: `${color}30`,
              border: `2px solid ${color}`,
              boxShadow: `0 0 20px ${color}50`,
            }}
            animate={isLookingAtClue ? {
              scale: [1, 1.1, 1],
              boxShadow: [
                `0 0 20px ${color}50`,
                `0 0 40px ${color}80`,
                `0 0 20px ${color}50`,
              ],
            } : {}}
            transition={{ duration: 0.5, repeat: isLookingAtClue ? Infinity : 0 }}
          >
            {/* Пульсация */}
            <PulseCircle level={level} />
            
            {/* Иконка */}
            <span className="text-2xl relative z-10">
              {isLookingAtClue ? TEMPERATURE_ICONS[level] : <DirectionArrow headingDelta={headingDelta} />}
            </span>
          </motion.div>
          
          {/* Температурный лейбл */}
          <motion.div
            className="mt-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
            style={{ 
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}40`,
            }}
            animate={level === "burning" ? {
              scale: [1, 1.05, 1],
            } : {}}
            transition={{ duration: 0.3, repeat: level === "burning" ? Infinity : 0 }}
          >
            {TEMPERATURE_LABELS[level]}
          </motion.div>
          
          {/* Подсказка направления */}
          <AnimatePresence>
            {!isLookingAtClue && (
              <DirectionHint headingDelta={headingDelta} />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDGE GLOW INDICATOR
// Свечение по краям экрана, указывающее направление
// ═══════════════════════════════════════════════════════════════════════════

interface EdgeGlowProps {
  headingDelta: number;
  level: IntensityLevel;
  visible?: boolean;
}

export function EdgeGlowIndicator({ headingDelta, level, visible = true }: EdgeGlowProps) {
  if (!visible) return null;
  
  const color = TEMPERATURE_COLORS[level];
  const absDelta = Math.abs(headingDelta);
  const intensity = 1 - (absDelta / 180); // 0-1
  
  // Определяем какой край подсвечивать
  const isLeft = headingDelta < -20;
  const isRight = headingDelta > 20;
  const isBehind = absDelta > 135;
  const isFront = absDelta <= 20;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-20">
      {/* Левый край */}
      {isLeft && !isBehind && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-16"
          style={{
            background: `linear-gradient(to right, ${color}${Math.round(intensity * 60).toString(16).padStart(2, '0')}, transparent)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      
      {/* Правый край */}
      {isRight && !isBehind && (
        <motion.div
          className="absolute right-0 top-0 bottom-0 w-16"
          style={{
            background: `linear-gradient(to left, ${color}${Math.round(intensity * 60).toString(16).padStart(2, '0')}, transparent)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      
      {/* Нижний край (сзади) */}
      {isBehind && (
        <motion.div
          className="absolute left-0 right-0 bottom-0 h-16"
          style={{
            background: `linear-gradient(to top, ${color}40, transparent)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
      
      {/* Виньетка при близости */}
      {isFront && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, transparent 50%, ${color}20 100%)`,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}

export default ProximityIndicator;

