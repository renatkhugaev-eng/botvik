"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USE CLUE DISCOVERY HOOK
 * Отслеживает обнаружение скрытых улик на панораме
 * 
 * Поддерживает виртуальные panoId:
 * - "START" — стартовая панорама
 * - "STEP_1" — после 1 перехода
 * - "STEP_2" — после 2 переходов
 * - "STEP_3+" — после 3+ переходов
 * - "ANY" — любая панорама
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { haptic } from "@/lib/haptic";
import type {
  HiddenClue,
  ClueRuntimeState,
  ClueDiscoveryEvent,
} from "@/types/hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseClueDiscoveryProps {
  clues: HiddenClue[];
  currentPanoId: string | null;
  currentHeading: number;
  stepCount: number; // Количество переходов от старта
  enabled?: boolean;
  onClueEvent?: (event: ClueDiscoveryEvent) => void;
}

interface UseClueDiscoveryResult {
  /** Состояния всех улик */
  clueStates: Map<string, ClueRuntimeState>;
  
  /** Улики доступные в текущей панораме */
  availableClues: HiddenClue[];
  
  /** Улика которую сейчас "открывает" игрок */
  revealingClue: HiddenClue | null;
  
  /** Прогресс обнаружения (0-1) */
  revealProgress: number;
  
  /** Все обнаруженные улики */
  revealedClues: HiddenClue[];
  
  /** Все собранные улики */
  collectedClues: HiddenClue[];
  
  /** Есть ли подсказка в текущей панораме */
  hasHintInCurrentPano: boolean;
  
  /** Собрать улику */
  collectClue: (clueId: string) => void;
  
  /** Показать подсказку сканера */
  showScannerHint: () => string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Нормализует угол в диапазон 0-360
 */
function normalizeHeading(heading: number): number {
  let h = heading % 360;
  if (h < 0) h += 360;
  return h;
}

/**
 * Проверяет попадает ли heading в конус обнаружения
 */
function isInRevealCone(
  currentHeading: number,
  targetHeading: number,
  coneDegrees: number
): boolean {
  const current = normalizeHeading(currentHeading);
  const target = normalizeHeading(targetHeading);
  
  let diff = Math.abs(current - target);
  if (diff > 180) diff = 360 - diff;
  
  return diff <= coneDegrees / 2;
}

/**
 * Проверяет соответствует ли виртуальный panoId текущему шагу
 * 
 * Поддерживаемые форматы:
 * - "START" → шаг 0
 * - "STEP_N" → точно шаг N (например "STEP_5" = шаг 5)
 * - "STEP_N+" → шаг N и выше (например "STEP_10+" = шаг 10+)
 * - "STEP_N-M" → диапазон шагов (например "STEP_5-10" = шаги 5-10)
 * - "ANY" → любой шаг
 */
function matchesVirtualPanoId(
  cluePanoId: string,
  stepCount: number
): boolean {
  // Специальные значения
  if (cluePanoId === "START") return stepCount === 0;
  if (cluePanoId === "ANY") return true;
  
  // Проверяем формат STEP_N-M (диапазон)
  const rangeMatch = cluePanoId.match(/^STEP_(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return stepCount >= min && stepCount <= max;
  }
  
  // Проверяем формат STEP_N+ (N и выше)
  const plusMatch = cluePanoId.match(/^STEP_(\d+)\+$/);
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10);
    return stepCount >= min;
  }
  
  // Проверяем формат STEP_N (точный шаг)
  const exactMatch = cluePanoId.match(/^STEP_(\d+)$/);
  if (exactMatch) {
    const exact = parseInt(exactMatch[1], 10);
    return stepCount === exact;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useClueDiscovery({
  clues,
  currentPanoId,
  currentHeading,
  stepCount,
  enabled = true,
  onClueEvent,
}: UseClueDiscoveryProps): UseClueDiscoveryResult {
  
  // ─── State ───
  const [clueStates, setClueStates] = useState<Map<string, ClueRuntimeState>>(() => {
    const map = new Map<string, ClueRuntimeState>();
    clues.forEach(clue => {
      map.set(clue.id, {
        clueId: clue.id,
        state: "hidden",
        dwellProgress: 0,
      });
    });
    return map;
  });
  
  const [revealingClue, setRevealingClue] = useState<HiddenClue | null>(null);
  const [revealProgress, setRevealProgress] = useState(0);
  
  // ─── Refs ───
  const lastHintTimeRef = useRef<Map<string, number>>(new Map());
  const dwellStartRef = useRef<number | null>(null);
  const lastScannerHintRef = useRef<number>(0);
  const clueStatesRef = useRef(clueStates);
  const headingRef = useRef(currentHeading);
  const stepCountRef = useRef(stepCount);
  
  // Keep refs updated
  useEffect(() => {
    clueStatesRef.current = clueStates;
  }, [clueStates]);
  
  useEffect(() => {
    headingRef.current = currentHeading;
  }, [currentHeading]);
  
  useEffect(() => {
    stepCountRef.current = stepCount;
  }, [stepCount]);
  
  // ─── Available clues in current location (MEMOIZED) ───
  const availableClues = useMemo(() => {
    return clues.filter(clue => {
      const state = clueStates.get(clue.id);
      // Уже собрана — не показываем
      if (state?.state === "collected") return false;
      // Проверяем виртуальный panoId
      return matchesVirtualPanoId(clue.panoId, stepCount);
    });
  }, [clues, clueStates, stepCount]);
  
  // ─── Has hint in current pano ───
  const hasHintInCurrentPano = useMemo(() => {
    return availableClues.some(clue => {
      const state = clueStates.get(clue.id);
      return state?.state === "hidden";
    });
  }, [availableClues, clueStates]);
  
  // ─── Derived (MEMOIZED) ───
  const revealedClues = useMemo(() => {
    return clues.filter(c => {
      const state = clueStates.get(c.id);
      return state?.state === "revealed" || state?.state === "collected";
    });
  }, [clues, clueStates]);
  
  const collectedClues = useMemo(() => {
    return clues.filter(c => {
      const state = clueStates.get(c.id);
      return state?.state === "collected";
    });
  }, [clues, clueStates]);
  
  // ─── Collect clue ───
  const collectClue = useCallback((clueId: string) => {
    const clue = clues.find(c => c.id === clueId);
    if (!clue) return;
    
    setClueStates(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(clueId);
      if (current && current.state === "revealed") {
        newMap.set(clueId, {
          ...current,
          state: "collected",
          collectedAt: new Date(),
        });
        
        haptic.success();
        onClueEvent?.({
          type: "collected",
          clue,
          timestamp: new Date(),
        });
      }
      return newMap;
    });
  }, [clues, onClueEvent]);
  
  // ─── Scanner hint ───
  const showScannerHint = useCallback((): string | null => {
    const now = Date.now();
    
    // Только раз в 30 секунд
    if (now - lastScannerHintRef.current < 30000) return null;
    
    // Найти скрытую улику
    const hiddenClues = clues.filter(c => {
      const state = clueStates.get(c.id);
      return state?.state === "hidden";
    });
    
    if (hiddenClues.length === 0) return null;
    
    // Предпочитаем улики доступные в текущей локации
    const priorityClues = hiddenClues.filter(c => 
      matchesVirtualPanoId(c.panoId, stepCount)
    );
    
    const targetClues = priorityClues.length > 0 ? priorityClues : hiddenClues;
    const randomClue = targetClues[Math.floor(Math.random() * targetClues.length)];
    lastScannerHintRef.current = now;
    
    haptic.light();
    
    return randomClue.scannerHint || "Сканер обнаружил что-то поблизости...";
  }, [clues, clueStates, stepCount]);
  
  // ─── Stable callback ref ───
  const onClueEventRef = useRef(onClueEvent);
  useEffect(() => {
    onClueEventRef.current = onClueEvent;
  }, [onClueEvent]);
  
  // ─── Main discovery loop ───
  // Минимальные зависимости — только enabled и currentPanoId
  // Остальное читаем из refs
  useEffect(() => {
    if (!enabled || !currentPanoId) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const heading = headingRef.current;
      const step = stepCountRef.current;
      const states = clueStatesRef.current;
      
      // Получаем доступные улики из текущего состояния
      const currentAvailable = clues.filter(clue => {
        const state = states.get(clue.id);
        if (state?.state === "collected") return false;
        return matchesVirtualPanoId(clue.panoId, step);
      });
      
      // Проверяем каждую доступную улику
      currentAvailable.forEach(clue => {
        const currentState = states.get(clue.id);
        if (!currentState) return;
        
        // Уже собрана или обнаружена — пропускаем
        if (currentState.state === "collected" || currentState.state === "revealed") {
          return;
        }
        
        // Проверяем попадание в конус
        const inCone = isInRevealCone(heading, clue.revealHeading, clue.coneDegrees);
        
        if (inCone) {
          // Игрок смотрит в нужную сторону
          if (currentState.state === "hidden") {
            // Начинаем revealing
            setClueStates(prev => {
              const newMap = new Map(prev);
              newMap.set(clue.id, {
                ...currentState,
                state: "revealing",
                dwellProgress: 0,
              });
              return newMap;
            });
            setRevealingClue(clue);
            dwellStartRef.current = now;
            haptic.light();
            
            // Отправляем событие начала обнаружения
            onClueEventRef.current?.({
              type: "revealing",
              clue,
              timestamp: new Date(),
            });
          } else if (currentState.state === "revealing") {
            // Продолжаем revealing — считаем время
            const elapsed = (now - (dwellStartRef.current || now)) / 1000;
            const progress = Math.min(1, elapsed / clue.dwellTime);
            
            setRevealProgress(progress);
            
            if (progress >= 1) {
              // ОБНАРУЖЕНО!
              setClueStates(prev => {
                const newMap = new Map(prev);
                newMap.set(clue.id, {
                  ...currentState,
                  state: "revealed",
                  dwellProgress: 1,
                  revealedAt: new Date(),
                });
                return newMap;
              });
              setRevealingClue(null);
              setRevealProgress(0);
              dwellStartRef.current = null;
              
              haptic.heavy();
              onClueEventRef.current?.({
                type: "revealed",
                clue,
                timestamp: new Date(),
              });
            }
          }
        } else {
          // Игрок НЕ смотрит в нужную сторону
          if (currentState.state === "revealing") {
            // Сбрасываем прогресс
            setClueStates(prev => {
              const newMap = new Map(prev);
              newMap.set(clue.id, {
                ...currentState,
                state: "hidden",
                dwellProgress: 0,
              });
              return newMap;
            });
            setRevealingClue(null);
            setRevealProgress(0);
            dwellStartRef.current = null;
          }
          
          // Мягкая подсказка — раз в 10 секунд с шансом 20%
          const lastHint = lastHintTimeRef.current.get(clue.id) || 0;
          if (now - lastHint > 10000 && currentState.state === "hidden") {
            lastHintTimeRef.current.set(clue.id, now);
            
            if (Math.random() < 0.2) {
              haptic.light();
              onClueEventRef.current?.({
                type: "hint",
                clue,
                timestamp: new Date(),
              });
            }
          }
        }
      });
    }, 100); // 10 FPS
    
    return () => clearInterval(interval);
  }, [enabled, currentPanoId, clues]);
  
  return {
    clueStates,
    availableClues,
    revealingClue,
    revealProgress,
    revealedClues,
    collectedClues,
    hasHintInCurrentPano,
    collectClue,
    showScannerHint,
  };
}
