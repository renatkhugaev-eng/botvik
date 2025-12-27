"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DETECTIVE INSTINCT UI COMPONENTS
 * Визуальные компоненты для системы "Детективное чутьё"
 * 
 * Компоненты:
 * - InstinctMeter: полоска чутья с анимацией
 * - DetectiveVisionOverlay: overlay с направлениями к уликам
 * - FlashbackOverlay: вспышка памяти с контентом
 * - VisionButton: кнопка активации режима видения
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { motion, AnimatePresence } from "framer-motion";
import type {
  InstinctMeterState,
  DetectiveVisionState,
  FlashbackState,
  ClueDirection,
  InstinctLevel,
} from "@/types/detective-instinct";

// ═══════════════════════════════════════════════════════════════════════════
// COLORS & STYLES
// ═══════════════════════════════════════════════════════════════════════════

const LEVEL_COLORS: Record<InstinctLevel, string> = {
  cold: "#64748b",     // Серый
  cool: "#06b6d4",     // Cyan
  warm: "#f59e0b",     // Amber
  hot: "#f97316",      // Orange
  burning: "#ef4444",  // Red
};

const LEVEL_GLOW: Record<InstinctLevel, string> = {
  cold: "none",
  cool: "0 0 10px rgba(6, 182, 212, 0.3)",
  warm: "0 0 15px rgba(245, 158, 11, 0.4)",
  hot: "0 0 20px rgba(249, 115, 22, 0.5)",
  burning: "0 0 30px rgba(239, 68, 68, 0.6)",
};

const MOOD_COLORS = {
  mysterious: { bg: "from-purple-900/90 to-indigo-900/90", border: "border-purple-500/50" },
  dangerous: { bg: "from-red-900/90 to-orange-900/90", border: "border-red-500/50" },
  sad: { bg: "from-gray-900/90 to-blue-900/90", border: "border-blue-500/50" },
  tense: { bg: "from-amber-900/90 to-orange-900/90", border: "border-amber-500/50" },
  revealing: { bg: "from-cyan-900/90 to-teal-900/90", border: "border-cyan-500/50" },
};

// ═══════════════════════════════════════════════════════════════════════════
// INSTINCT METER
// Полоска чутья с анимацией и направляющей стрелкой
// ═══════════════════════════════════════════════════════════════════════════

interface InstinctMeterProps {
  state: InstinctMeterState;
  className?: string;
}

export function InstinctMeter({ state, className = "" }: InstinctMeterProps) {
  const { level, category, angleToClue } = state;
  const color = LEVEL_COLORS[category];
  const glow = LEVEL_GLOW[category];
  
  // Анимация пульсации для высоких уровней
  const shouldPulse = category === "hot" || category === "burning";
  
  return (
    <div className={`relative ${className}`}>
      {/* Метка */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/50">
          Чутьё
        </span>
        {category !== "cold" && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: shouldPulse ? [1, 1.1, 1] : 1,
            }}
            transition={{ 
              duration: 0.5,
              repeat: shouldPulse ? Infinity : 0,
              repeatType: "reverse",
            }}
            className="text-[10px] font-bold uppercase"
            style={{ color }}
          >
            {category === "cool" && "Слабо..."}
            {category === "warm" && "Тепло"}
            {category === "hot" && "Горячо!"}
            {category === "burning" && "🔥 ЗДЕСЬ!"}
          </motion.span>
        )}
      </div>
      
      {/* Полоска */}
      <div 
        className="relative h-2 bg-white/10 rounded-full overflow-hidden"
        style={{ boxShadow: glow }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ 
            width: `${level * 100}%`,
            opacity: shouldPulse ? [1, 0.7, 1] : 1,
          }}
          transition={{ 
            width: { type: "spring", damping: 20 },
            opacity: shouldPulse ? { duration: 0.5, repeat: Infinity, repeatType: "reverse" } : {},
          }}
          style={{ 
            background: `linear-gradient(90deg, ${color}80, ${color})`,
          }}
        />
        
        {/* Деления */}
        {[0.25, 0.5, 0.75].map(mark => (
          <div
            key={mark}
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${mark * 100}%` }}
          />
        ))}
      </div>
      
      {/* Направляющая стрелка */}
      <AnimatePresence>
        {angleToClue !== null && level > 0.1 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center justify-center mt-2"
          >
            <motion.div
              animate={{ rotate: angleToClue }}
              transition={{ type: "spring", damping: 15 }}
              className="text-lg"
              style={{ color }}
            >
              ↑
            </motion.div>
            <span className="text-[10px] text-white/50 ml-1">
              {Math.abs(angleToClue) < 10 ? "Прямо!" : 
               angleToClue > 0 ? "Вправо" : "Влево"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISION BUTTON
// Кнопка активации режима видения
// ═══════════════════════════════════════════════════════════════════════════

interface VisionButtonProps {
  state: DetectiveVisionState;
  onActivate: () => void;
  className?: string;
}

export function VisionButton({ state, onActivate, className = "" }: VisionButtonProps) {
  const { isActive, remainingTime, cooldownRemaining, canActivate } = state;
  
  return (
    <motion.button
      onClick={canActivate ? onActivate : undefined}
      disabled={!canActivate}
      whileTap={canActivate ? { scale: 0.95 } : {}}
      className={`
        relative w-12 h-12 rounded-full flex items-center justify-center
        transition-all duration-300
        ${isActive 
          ? "bg-cyan-500/40 ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]" 
          : canActivate 
            ? "bg-white/10 hover:bg-white/20" 
            : "bg-white/5 opacity-50"
        }
        ${className}
      `}
    >
      {/* Иконка глаза */}
      <motion.span
        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.5, repeat: isActive ? Infinity : 0 }}
        className="text-xl"
      >
        👁️
      </motion.span>
      
      {/* Таймер активности */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 
            bg-cyan-500 rounded text-[10px] font-bold text-white"
        >
          {remainingTime}с
        </motion.div>
      )}
      
      {/* Cooldown overlay */}
      {cooldownRemaining > 0 && !isActive && (
        <div className="absolute inset-0 flex items-center justify-center 
          bg-black/50 rounded-full">
          <span className="text-xs font-bold text-white/70">{cooldownRemaining}</span>
        </div>
      )}
      
      {/* Circular progress for cooldown */}
      {cooldownRemaining > 0 && !isActive && (
        <svg 
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 48 48"
        >
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="rgba(6, 182, 212, 0.3)"
            strokeWidth="2"
            strokeDasharray={`${(1 - cooldownRemaining / 30) * 138} 138`}
          />
        </svg>
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTIVE VISION OVERLAY
// Полноэкранный overlay с направлениями к уликам
// ═══════════════════════════════════════════════════════════════════════════

interface DetectiveVisionOverlayProps {
  state: DetectiveVisionState;
  className?: string;
}

export function DetectiveVisionOverlay({ state, className = "" }: DetectiveVisionOverlayProps) {
  if (!state.isActive) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 pointer-events-none z-30 ${className}`}
    >
      {/* Фильтр (vignette + цветовой сдвиг) */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, 
              transparent 30%, 
              rgba(6, 182, 212, 0.1) 60%, 
              rgba(6, 182, 212, 0.3) 100%
            )
          `,
          mixBlendMode: "overlay",
        }}
      />
      
      {/* Сканирующие линии */}
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundPositionY: ["0%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(6, 182, 212, 0.05) 2px,
            rgba(6, 182, 212, 0.05) 4px
          )`,
          backgroundSize: "100% 200%",
        }}
      />
      
      {/* Мерцающая рамка */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute inset-4 border-2 border-cyan-400/30 rounded-xl"
      />
      
      {/* Направляющие стрелки к уликам */}
      <div className="absolute inset-0 flex items-center justify-center">
        {state.clueDirections.map(direction => (
          <ClueDirectionArrow key={direction.clueId} direction={direction} />
        ))}
      </div>
      
      {/* Центральный индикатор */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-4 h-4 rounded-full border-2 border-cyan-400"
        />
      </div>
      
      {/* Надпись */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-20 left-1/2 -translate-x-1/2 text-center"
      >
        <div className="px-4 py-2 bg-black/60 backdrop-blur-sm rounded-xl border border-cyan-500/30">
          <span className="text-cyan-400 text-sm font-medium">
            🔮 Детективное видение активно
          </span>
          <div className="text-cyan-400/60 text-xs mt-1">
            Стрелки указывают на скрытые улики
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE DIRECTION ARROW
// Стрелка, указывающая на улику
// ═══════════════════════════════════════════════════════════════════════════

interface ClueDirectionArrowProps {
  direction: ClueDirection;
}

function ClueDirectionArrow({ direction }: ClueDirectionArrowProps) {
  const { angle, distance, clueIcon, clueName } = direction;
  
  // Позиция стрелки на экране (по окружности)
  const radius = 120; // пикселей от центра
  const x = Math.sin(angle * Math.PI / 180) * radius;
  const y = -Math.cos(angle * Math.PI / 180) * radius;
  
  // Размер и яркость зависят от расстояния
  const scale = 1 - distance * 0.3;
  const opacity = 1 - distance * 0.5;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity, 
        scale,
        x,
        y,
      }}
      transition={{ type: "spring", damping: 15 }}
      className="absolute flex flex-col items-center"
    >
      {/* Стрелка */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"],
        }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{ transform: `rotate(${angle}deg)` }}
        className="text-2xl text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]"
      >
        ⬆️
      </motion.div>
      
      {/* Иконка улики */}
      <div className="mt-1 text-lg drop-shadow-lg">{clueIcon}</div>
      
      {/* Название (при близком расстоянии) */}
      {distance < 0.3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-1 px-2 py-0.5 bg-black/60 rounded text-[10px] text-cyan-400 whitespace-nowrap"
        >
          {clueName}
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLASHBACK OVERLAY
// Вспышка памяти с контентом
// ═══════════════════════════════════════════════════════════════════════════

interface FlashbackOverlayProps {
  state: FlashbackState;
  onDismiss: () => void;
  className?: string;
}

export function FlashbackOverlay({ state, onDismiss, className = "" }: FlashbackOverlayProps) {
  if (!state.isActive || !state.content) return null;
  
  const { content } = state;
  const moodStyle = MOOD_COLORS[content.mood];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${className}`}
    >
      {/* Backdrop с эффектом */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80"
      />
      
      {/* Вспышка */}
      <motion.div
        initial={{ opacity: 1, scale: 2 }}
        animate={{ opacity: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-white pointer-events-none"
      />
      
      {/* Эффект помех/глитча */}
      <motion.div
        animate={{ 
          opacity: [0, 0.1, 0, 0.05, 0],
          x: [0, -2, 2, -1, 0],
        }}
        transition={{ duration: 0.3, repeat: 3 }}
        className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent"
      />
      
      {/* Контент */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring" }}
        className={`
          relative max-w-sm w-full p-6 rounded-2xl
          bg-gradient-to-br ${moodStyle.bg}
          border ${moodStyle.border}
          backdrop-blur-xl
          shadow-2xl
        `}
      >
        {/* Заголовок */}
        <div className="flex items-center gap-3 mb-4">
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-4xl"
          >
            {content.icon}
          </motion.span>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50 mb-1">
              Видение
            </div>
            <h3 className="text-lg font-bold text-white">
              {content.title}
            </h3>
          </div>
        </div>
        
        {/* Текст */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-white/80 text-sm leading-relaxed italic"
        >
          "{content.text}"
        </motion.p>
        
        {/* Индикатор закрытия */}
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 3, ease: "linear" }}
          className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-2xl"
        />
        
        {/* Подсказка */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs">
          Нажмите чтобы закрыть
        </div>
      </motion.div>
      
      {/* Декоративные частицы */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: "50%", 
              y: "50%",
              opacity: 0,
              scale: 0,
            }}
            animate={{ 
              x: `${20 + Math.random() * 60}%`, 
              y: `${20 + Math.random() * 60}%`,
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0.5],
            }}
            transition={{ 
              duration: 2 + Math.random(),
              delay: Math.random() * 0.5,
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
            className="absolute w-2 h-2 bg-white/30 rounded-full blur-sm"
          />
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  InstinctMeter,
  VisionButton,
  DetectiveVisionOverlay,
  FlashbackOverlay,
};

