"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USE DETECTIVE INSTINCT HOOK
 * Комбинированная система детективного чутья:
 * - Instinct Meter: полоска, показывающая близость к улике
 * - Detective Vision: временный режим с направлениями к уликам
 * - Flashback: вспышки памяти при приближении к улике
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { haptic } from "@/lib/haptic";
import type { HiddenClue, ClueRuntimeState } from "@/types/hidden-clue";
import type {
  InstinctMeterState,
  DetectiveVisionState,
  FlashbackState,
  FlashbackContent,
  ClueDirection,
  InstinctLevel,
  InstinctEvent,
  DetectiveInstinctConfig,
} from "@/types/detective-instinct";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseDetectiveInstinctProps {
  /** Все улики миссии */
  clues: HiddenClue[];
  
  /** Состояния улик (из useClueDiscovery) */
  clueStates: Map<string, ClueRuntimeState>;
  
  /** Текущее направление камеры */
  currentHeading: number;
  
  /** Текущий шаг (для виртуальных panoId) */
  stepCount: number;
  
  /** Включена ли система */
  enabled?: boolean;
  
  /** Конфигурация */
  config?: Partial<DetectiveInstinctConfig>;
  
  /** Callback для событий */
  onInstinctEvent?: (event: InstinctEvent) => void;
}

interface UseDetectiveInstinctResult {
  /** Состояние Instinct Meter */
  meter: InstinctMeterState;
  
  /** Состояние Detective Vision */
  vision: DetectiveVisionState;
  
  /** Состояние Flashback */
  flashback: FlashbackState;
  
  /** Активировать Detective Vision */
  activateVision: () => void;
  
  /** Закрыть Flashback */
  dismissFlashback: () => void;
  
  /** Сбросить все состояния */
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const defaultConfig: DetectiveInstinctConfig = {
  meterEnabled: true,
  visionEnabled: true,
  flashbackEnabled: true,
  visionDuration: 5,
  visionCooldown: 30,
  meterDetectionRadius: 90,
  flashbackRadius: 60,
  flashbackDuration: 3000,
};

/**
 * Нормализует угол в диапазон 0-360
 */
function normalizeHeading(heading: number): number {
  let h = heading % 360;
  if (h < 0) h += 360;
  return h;
}

/**
 * Вычисляет угловое расстояние между двумя направлениями
 */
function angularDistance(heading1: number, heading2: number): number {
  const h1 = normalizeHeading(heading1);
  const h2 = normalizeHeading(heading2);
  let diff = Math.abs(h1 - h2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Вычисляет относительный угол к улике (для стрелки)
 * Возвращает угол от -180 до 180, где 0 = прямо
 */
function relativeAngle(currentHeading: number, targetHeading: number): number {
  const current = normalizeHeading(currentHeading);
  const target = normalizeHeading(targetHeading);
  let diff = target - current;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Конвертирует расстояние в уровень чутья
 */
function distanceToLevel(distance: number, maxRadius: number): InstinctLevel {
  const normalized = Math.max(0, 1 - distance / maxRadius);
  
  if (normalized < 0.2) return "cold";
  if (normalized < 0.4) return "cool";
  if (normalized < 0.6) return "warm";
  if (normalized < 0.8) return "hot";
  return "burning";
}

/**
 * Проверяет соответствует ли виртуальный panoId текущему шагу
 * Поддерживает: START, STEP_N, STEP_N+, STEP_N-M, ANY
 */
function matchesVirtualPanoId(cluePanoId: string, stepCount: number): boolean {
  if (cluePanoId === "START") return stepCount === 0;
  if (cluePanoId === "ANY") return true;
  
  // STEP_N-M (диапазон)
  const rangeMatch = cluePanoId.match(/^STEP_(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return stepCount >= min && stepCount <= max;
  }
  
  // STEP_N+ (N и выше)
  const plusMatch = cluePanoId.match(/^STEP_(\d+)\+$/);
  if (plusMatch) {
    return stepCount >= parseInt(plusMatch[1], 10);
  }
  
  // STEP_N (точный шаг)
  const exactMatch = cluePanoId.match(/^STEP_(\d+)$/);
  if (exactMatch) {
    return stepCount === parseInt(exactMatch[1], 10);
  }
  
  return false;
}

/**
 * Генерирует flashback контент из улики
 */
function generateFlashback(clue: HiddenClue): FlashbackContent {
  // Определяем mood по контексту
  let mood: FlashbackContent["mood"] = "mysterious";
  const context = (clue.storyContext || "").toLowerCase();
  
  if (context.includes("кровь") || context.includes("убий") || context.includes("опасн")) {
    mood = "dangerous";
  } else if (context.includes("погиб") || context.includes("смерт") || context.includes("жертв")) {
    mood = "sad";
  } else if (context.includes("доказательств") || context.includes("улик") || context.includes("найден")) {
    mood = "revealing";
  } else if (context.includes("время") || context.includes("спеш") || context.includes("скор")) {
    mood = "tense";
  }
  
  return {
    clueId: clue.id,
    title: clue.name,
    text: clue.hintText || "Что-то здесь произошло...",
    icon: clue.icon,
    mood,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useDetectiveInstinct({
  clues,
  clueStates,
  currentHeading,
  stepCount,
  enabled = true,
  config: userConfig,
  onInstinctEvent,
}: UseDetectiveInstinctProps): UseDetectiveInstinctResult {
  
  // Merge config
  const config = useMemo(() => ({
    ...defaultConfig,
    ...userConfig,
  }), [userConfig]);
  
  // ─── Stable callback ref ───
  const onInstinctEventRef = useRef(onInstinctEvent);
  useEffect(() => {
    onInstinctEventRef.current = onInstinctEvent;
  }, [onInstinctEvent]);
  
  // ─── Instinct Meter State ───
  const [meterLevel, setMeterLevel] = useState(0);
  const [nearestClue, setNearestClue] = useState<HiddenClue | null>(null);
  const [angleToClue, setAngleToClue] = useState<number | null>(null);
  const [distanceToClue, setDistanceToClue] = useState<number | null>(null);
  const lastMeterLevel = useRef<InstinctLevel>("cold");
  
  // ─── Detective Vision State ───
  const [visionActive, setVisionActive] = useState(false);
  const [visionRemaining, setVisionRemaining] = useState(0);
  const [visionCooldown, setVisionCooldown] = useState(0);
  const visionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ─── Flashback State ───
  const [flashbackActive, setFlashbackActive] = useState(false);
  const [flashbackContent, setFlashbackContent] = useState<FlashbackContent | null>(null);
  const [shownFlashbacks, setShownFlashbacks] = useState<Set<string>>(new Set());
  const flashbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ─── Available clues (hidden only, not revealing/revealed/collected) ───
  const availableClues = useMemo(() => {
    return clues.filter(clue => {
      const state = clueStates.get(clue.id);
      // Пропускаем улики которые уже обнаружены, собраны или в процессе обнаружения
      if (!state || state.state === "collected" || state.state === "revealed" || state.state === "revealing") {
        return false;
      }
      return matchesVirtualPanoId(clue.panoId, stepCount);
    });
  }, [clues, clueStates, stepCount]);
  
  // ─── Instinct Meter Update ───
  useEffect(() => {
    if (!enabled || !config.meterEnabled) return;
    
    // Найти ближайшую скрытую улику
    let closestClue: HiddenClue | null = null;
    let minDistance = Infinity;
    
    for (const clue of availableClues) {
      const distance = angularDistance(currentHeading, clue.revealHeading);
      if (distance < minDistance) {
        minDistance = distance;
        closestClue = clue;
      }
    }
    
    if (closestClue !== null && minDistance <= config.meterDetectionRadius) {
      // Улика в радиусе чутья — сохраняем ссылку для TypeScript
      const foundClue = closestClue;
      const level = Math.max(0, 1 - minDistance / config.meterDetectionRadius);
      
      setMeterLevel(level);
      setNearestClue(foundClue);
      setAngleToClue(relativeAngle(currentHeading, foundClue.revealHeading));
      setDistanceToClue(minDistance);
      
      // Проверяем изменение уровня для событий
      const newCategory = distanceToLevel(minDistance, config.meterDetectionRadius);
      if (newCategory !== lastMeterLevel.current) {
        lastMeterLevel.current = newCategory;
        
        // Haptic feedback при изменении уровня
        if (newCategory === "burning") {
          haptic.heavy();
          onInstinctEventRef.current?.({ type: "meter_burning", clue: foundClue, timestamp: new Date() });
        } else if (newCategory === "hot") {
          haptic.medium();
          onInstinctEventRef.current?.({ type: "meter_hot", clue: foundClue, timestamp: new Date() });
        } else if (newCategory === "warm") {
          haptic.light();
          onInstinctEventRef.current?.({ type: "meter_warming", clue: foundClue, timestamp: new Date() });
        } else if (newCategory === "cold" || newCategory === "cool") {
          onInstinctEventRef.current?.({ type: "meter_cold", timestamp: new Date() });
        }
      }
      
      // ─── Flashback check ───
      if (
        config.flashbackEnabled && 
        minDistance <= config.flashbackRadius &&
        !shownFlashbacks.has(foundClue.id) &&
        !flashbackActive
      ) {
        // Показываем flashback
        const content = generateFlashback(foundClue);
        setFlashbackContent(content);
        setFlashbackActive(true);
        setShownFlashbacks(prev => new Set([...prev, foundClue.id]));
        
        haptic.medium();
        onInstinctEventRef.current?.({ type: "flashback_start", clue: foundClue, timestamp: new Date() });
        
        // Автоматически скрываем
        flashbackTimerRef.current = setTimeout(() => {
          setFlashbackActive(false);
          setFlashbackContent(null);
          onInstinctEventRef.current?.({ type: "flashback_end", timestamp: new Date() });
        }, config.flashbackDuration);
      }
      
    } else {
      // Нет улик в радиусе
      setMeterLevel(0);
      setNearestClue(null);
      setAngleToClue(null);
      setDistanceToClue(null);
      
      if (lastMeterLevel.current !== "cold") {
        lastMeterLevel.current = "cold";
        onInstinctEventRef.current?.({ type: "meter_cold", timestamp: new Date() });
      }
    }
  }, [
    enabled, 
    config, 
    availableClues, 
    currentHeading, 
    shownFlashbacks, 
    flashbackActive,
  ]);
  
  // ─── Clue Directions for Vision ───
  const clueDirections: ClueDirection[] = useMemo(() => {
    if (!visionActive) return [];
    
    return availableClues.map(clue => ({
      clueId: clue.id,
      clueName: clue.name,
      clueIcon: clue.icon,
      angle: relativeAngle(currentHeading, clue.revealHeading),
      distance: angularDistance(currentHeading, clue.revealHeading) / 180, // Нормализуем
      visible: true,
    }));
  }, [visionActive, availableClues, currentHeading]);
  
  // ─── Activate Vision ───
  const activateVision = useCallback(() => {
    if (!config.visionEnabled || visionCooldown > 0 || visionActive) return;
    
    setVisionActive(true);
    setVisionRemaining(config.visionDuration);
    
    haptic.heavy();
    onInstinctEventRef.current?.({ type: "vision_start", timestamp: new Date() });
    
    // Таймер обратного отсчёта
    visionTimerRef.current = setInterval(() => {
      setVisionRemaining(prev => {
        if (prev <= 1) {
          // Время вышло
          if (visionTimerRef.current) clearInterval(visionTimerRef.current);
          setVisionActive(false);
          setVisionCooldown(config.visionCooldown);
          
          onInstinctEventRef.current?.({ type: "vision_end", timestamp: new Date() });
          
          // Запускаем cooldown
          cooldownTimerRef.current = setInterval(() => {
            setVisionCooldown(cd => {
              if (cd <= 1) {
                if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
                return 0;
              }
              return cd - 1;
            });
          }, 1000);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [config, visionCooldown, visionActive]);
  
  // ─── Dismiss Flashback ───
  const dismissFlashback = useCallback(() => {
    if (flashbackTimerRef.current) {
      clearTimeout(flashbackTimerRef.current);
    }
    setFlashbackActive(false);
    setFlashbackContent(null);
    onInstinctEventRef.current?.({ type: "flashback_end", timestamp: new Date() });
  }, []);
  
  // ─── Reset ───
  const reset = useCallback(() => {
    // Clear all timers
    if (visionTimerRef.current) clearInterval(visionTimerRef.current);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    if (flashbackTimerRef.current) clearTimeout(flashbackTimerRef.current);
    
    // Reset state
    setMeterLevel(0);
    setNearestClue(null);
    setAngleToClue(null);
    setDistanceToClue(null);
    setVisionActive(false);
    setVisionRemaining(0);
    setVisionCooldown(0);
    setFlashbackActive(false);
    setFlashbackContent(null);
    setShownFlashbacks(new Set());
    lastMeterLevel.current = "cold";
  }, []);
  
  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      if (visionTimerRef.current) clearInterval(visionTimerRef.current);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (flashbackTimerRef.current) clearTimeout(flashbackTimerRef.current);
    };
  }, []);
  
  // ─── Build result objects ───
  const meter: InstinctMeterState = {
    level: meterLevel,
    category: distanceToLevel(
      distanceToClue ?? config.meterDetectionRadius,
      config.meterDetectionRadius
    ),
    nearestClue,
    angleToClue,
    distanceToClue,
  };
  
  const vision: DetectiveVisionState = {
    isActive: visionActive,
    remainingTime: visionRemaining,
    cooldownRemaining: visionCooldown,
    canActivate: config.visionEnabled && visionCooldown === 0 && !visionActive,
    clueDirections,
  };
  
  const flashbackState: FlashbackState = {
    isActive: flashbackActive,
    content: flashbackContent,
    shownForClues: shownFlashbacks,
  };
  
  return {
    meter,
    vision,
    flashback: flashbackState,
    activateVision,
    dismissFlashback,
    reset,
  };
}

export default useDetectiveInstinct;

