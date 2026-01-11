"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type InkRunner } from "@/lib/ink-runtime";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

type SanityInfectionIndicatorProps = {
  runner: InkRunner;
  /** Начальные значения (опционально) */
  initialSanity?: number;
  initialInfection?: number;
};

type IndicatorState = {
  sanity: number;
  infection: number;
  prevSanity: number;
  prevInfection: number;
};

// ══════════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ══════════════════════════════════════════════════════════════════════════════

/** Получить цвет санити в зависимости от уровня */
function getSanityColor(sanity: number): string {
  if (sanity >= 70) return "from-cyan-400 to-blue-500";
  if (sanity >= 50) return "from-blue-400 to-indigo-500";
  if (sanity >= 30) return "from-indigo-500 to-purple-600";
  if (sanity >= 15) return "from-purple-600 to-red-600";
  return "from-red-600 to-red-900";
}

/** Получить цвет заражения в зависимости от уровня */
function getInfectionColor(infection: number): string {
  if (infection <= 10) return "from-slate-400 to-slate-500";
  if (infection <= 30) return "from-violet-400 to-purple-500";
  if (infection <= 50) return "from-purple-500 to-red-500";
  if (infection <= 70) return "from-red-500 to-red-600";
  return "from-red-600 to-red-900";
}

/** Получить статус санити */
function getSanityStatus(sanity: number): { label: string; icon: string; pulse: boolean } {
  if (sanity >= 80) return { label: "Стабильно", icon: "◆", pulse: false };
  if (sanity >= 60) return { label: "Напряжение", icon: "◇", pulse: false };
  if (sanity >= 40) return { label: "Тревога", icon: "◈", pulse: true };
  if (sanity >= 20) return { label: "Паника", icon: "⬥", pulse: true };
  return { label: "РАЗРУШЕНИЕ", icon: "☠", pulse: true };
}

/** Получить статус заражения */
function getInfectionStatus(infection: number): { label: string; icon: string; pulse: boolean } {
  if (infection <= 10) return { label: "Чист", icon: "○", pulse: false };
  if (infection <= 30) return { label: "Начало", icon: "◐", pulse: false };
  if (infection <= 50) return { label: "Развитие", icon: "◑", pulse: true };
  if (infection <= 70) return { label: "Сильное", icon: "●", pulse: true };
  return { label: "ПОТЕРЯН", icon: "◉", pulse: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// ГЛАВНЫЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function SanityInfectionIndicator({
  runner,
  initialSanity = 100,
  initialInfection = 0,
}: SanityInfectionIndicatorProps) {
  const [state, setState] = useState<IndicatorState>({
    sanity: initialSanity,
    infection: initialInfection,
    prevSanity: initialSanity,
    prevInfection: initialInfection,
  });
  
  const [changeFlash, setChangeFlash] = useState<"sanity" | "infection" | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // ПОДПИСКА НА ИЗМЕНЕНИЯ ПЕРЕМЕННЫХ
  // ══════════════════════════════════════════════════════════════════════════

  const handleVariableChange = useCallback((variableName: string, newValue: unknown) => {
    if (variableName === "sanity" && typeof newValue === "number") {
      setState(prev => {
        if (prev.sanity !== newValue) {
          setChangeFlash("sanity");
          setTimeout(() => setChangeFlash(null), 500);
        }
        return {
          ...prev,
          prevSanity: prev.sanity,
          sanity: newValue,
        };
      });
    }
    
    if (variableName === "infection_level" && typeof newValue === "number") {
      setState(prev => {
        if (prev.infection !== newValue) {
          setChangeFlash("infection");
          setTimeout(() => setChangeFlash(null), 500);
        }
        return {
          ...prev,
          prevInfection: prev.infection,
          infection: newValue,
        };
      });
    }
  }, []);

  // Подписываемся на изменения при монтировании
  useEffect(() => {
    const unsubscribeSanity = runner.observeVariable("sanity", handleVariableChange);
    const unsubscribeInfection = runner.observeVariable("infection_level", handleVariableChange);
    
    // Получаем начальные значения
    const currentSanity = runner.getVariable("sanity");
    const currentInfection = runner.getVariable("infection_level");
    
    if (typeof currentSanity === "number") {
      setState(prev => ({ ...prev, sanity: currentSanity, prevSanity: currentSanity }));
    }
    if (typeof currentInfection === "number") {
      setState(prev => ({ ...prev, infection: currentInfection, prevInfection: currentInfection }));
    }
    
    return () => {
      unsubscribeSanity();
      unsubscribeInfection();
    };
  }, [runner, handleVariableChange]);

  // ══════════════════════════════════════════════════════════════════════════
  // ВЫЧИСЛЕНИЯ
  // ══════════════════════════════════════════════════════════════════════════

  const sanityStatus = getSanityStatus(state.sanity);
  const infectionStatus = getInfectionStatus(state.infection);
  const sanityColor = getSanityColor(state.sanity);
  const infectionColor = getInfectionColor(state.infection);
  
  const sanityDelta = state.sanity - state.prevSanity;
  const infectionDelta = state.infection - state.prevInfection;
  
  const isCritical = state.sanity < 20 || state.infection > 80;

  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР — Горизонтальный компактный вариант
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      className="flex items-center gap-3 px-3 py-1.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    >
      <div className="flex items-center gap-3">
        {/* ═══ САНИТИ ═══ */}
        <div className="flex items-center gap-2">
          <motion.span 
            className={`text-[10px] ${state.sanity < 30 ? "text-red-400" : "text-cyan-400/70"}`}
            animate={sanityStatus.pulse ? { opacity: [1, 0.4, 1] } : {}}
            transition={sanityStatus.pulse ? { duration: 1, repeat: Infinity } : {}}
          >
            {sanityStatus.icon}
          </motion.span>
          
          {/* Прогресс-бар санити */}
          <div className="relative w-16 h-1.5 rounded-full bg-black/40 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${sanityColor} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${state.sanity}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          
          {/* Значение */}
          <motion.span
            className={`text-[10px] font-mono min-w-[20px] ${state.sanity < 30 ? "text-red-400" : "text-white/50"}`}
            animate={changeFlash === "sanity" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            {state.sanity}
          </motion.span>
          
          {/* Дельта */}
          <AnimatePresence>
            {sanityDelta !== 0 && changeFlash === "sanity" && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[9px] font-mono ${sanityDelta > 0 ? "text-green-400" : "text-red-400"}`}
              >
                {sanityDelta > 0 ? `+${sanityDelta}` : sanityDelta}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Разделитель */}
        <div className="w-px h-3 bg-white/10" />

        {/* ═══ ЗАРАЖЕНИЕ ═══ */}
        <div className="flex items-center gap-2">
          <motion.span 
            className={`text-[10px] ${state.infection > 50 ? "text-red-400" : "text-violet-400/70"}`}
            animate={infectionStatus.pulse ? { opacity: [1, 0.4, 1] } : {}}
            transition={infectionStatus.pulse ? { duration: 1, repeat: Infinity } : {}}
          >
            {infectionStatus.icon}
          </motion.span>
          
          {/* Прогресс-бар заражения */}
          <div className="relative w-16 h-1.5 rounded-full bg-black/40 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${infectionColor} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${state.infection}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          
          {/* Значение */}
          <motion.span
            className={`text-[10px] font-mono min-w-[20px] ${state.infection > 50 ? "text-red-400" : "text-white/50"}`}
            animate={changeFlash === "infection" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            {state.infection}
          </motion.span>
          
          {/* Дельта */}
          <AnimatePresence>
            {infectionDelta !== 0 && changeFlash === "infection" && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[9px] font-mono ${infectionDelta < 0 ? "text-green-400" : "text-red-400"}`}
              >
                {infectionDelta > 0 ? `+${infectionDelta}` : infectionDelta}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        
        {/* Критическое предупреждение — маленькая иконка */}
        <AnimatePresence>
          {isCritical && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0.5, 1, 0.5], scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-red-500 text-xs"
            >
              ⚠
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ══════════════════════════════════════════════════════════════════════════════

export default SanityInfectionIndicator;
