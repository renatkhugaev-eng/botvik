"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USE PROXIMITY AUDIO HOOK
 * Профессиональная система аудио-подсказок, привязанных к уликам
 * 
 * Функции:
 * - Heartbeat ускоряется при приближении к улике
 * - Тон меняется когда смотришь в правильном направлении
 * - Static помехи нарастают при близости
 * - Система "горячо-холодно" при перемещении
 * - Интеграция с Detective Instinct meter
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { getAudioHints } from "./audio-hints";
import { isClueAvailable } from "./clue-pano-matcher";
import type { HiddenClue, ClueRuntimeState } from "@/types/hidden-clue";
import type { IntensityLevel } from "@/types/audio-hints";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseProximityAudioProps {
  /** Список улик */
  clues: HiddenClue[];
  
  /** Состояния улик */
  clueStates: Map<string, ClueRuntimeState>;
  
  /** Текущий ID панорамы */
  currentPanoId: string | null;
  
  /** Текущее направление взгляда (heading) */
  currentHeading: number;
  
  /** Количество шагов от старта */
  stepCount: number;
  
  /** Включен ли хук */
  enabled?: boolean;
  
  /** Аудио включено */
  audioEnabled?: boolean;
  
  /** Идёт ли процесс обнаружения улики (reveal) — отключает proximity audio */
  isRevealing?: boolean;
  
  /** Коллбэк при изменении температуры */
  onTemperatureChange?: (temperature: ProximityTemperature) => void;
}

export interface ProximityTemperature {
  level: IntensityLevel;
  closestClue: HiddenClue | null;
  headingDelta: number; // Разница между текущим heading и нужным
  isLookingAtClue: boolean; // Смотрит ли на улику
  progressToClue: number; // 0-1, насколько близко к улике
}

type DirectionalFeedbackDirection = "left" | "right" | "center" | "behind";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Пороги для уровней интенсивности (в градусах от цели) */
const INTENSITY_THRESHOLDS = {
  burning: 20,  // < 20° от улики — почти смотришь
  hot: 60,      // < 60° от улики — близко
  warm: 120,    // < 120° от улики — в нужном направлении
  cold: 180,    // > 120° от улики — далеко/сзади
} as const;

/** BPM heartbeat для каждого уровня */
const HEARTBEAT_BPM: Record<IntensityLevel, number> = {
  cold: 60,      // Медленный — улика есть, но далеко/сзади
  warm: 80,      // Спокойный — в нужном направлении
  hot: 120,      // Ускоренный — близко
  burning: 160,  // Быстрый — почти нашёл
};

/** Static интенсивность для каждого уровня */
const STATIC_INTENSITY: Record<IntensityLevel, number> = {
  cold: 0.05,   // Лёгкие помехи — улика есть
  warm: 0.15,   // Заметные помехи
  hot: 0.35,    // Сильные помехи
  burning: 0.6, // Очень сильные
};

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
 * Вычисляет угловую разницу между двумя направлениями
 * Возвращает значение от -180 до 180
 */
function getHeadingDelta(current: number, target: number): number {
  const c = normalizeHeading(current);
  const t = normalizeHeading(target);
  
  let delta = t - c;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  
  return delta;
}

/**
 * Определяет направление к улике
 */
function getDirection(delta: number): DirectionalFeedbackDirection {
  const absDelta = Math.abs(delta);
  
  if (absDelta > 135) return "behind";
  if (absDelta <= 20) return "center";
  return delta > 0 ? "right" : "left";
}

/**
 * Определяет уровень интенсивности по угловой разнице
 */
function getIntensityLevel(absDelta: number): IntensityLevel {
  if (absDelta <= INTENSITY_THRESHOLDS.burning) return "burning";
  if (absDelta <= INTENSITY_THRESHOLDS.hot) return "hot";
  if (absDelta <= INTENSITY_THRESHOLDS.warm) return "warm";
  return "cold";
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useProximityAudio({
  clues,
  clueStates,
  currentPanoId,
  currentHeading,
  stepCount,
  enabled = true,
  audioEnabled = true,
  isRevealing = false,
  onTemperatureChange,
}: UseProximityAudioProps) {
  
  // ─── Refs ───
  const audioRef = useRef(getAudioHints());
  const lastIntensityRef = useRef<IntensityLevel>("cold");
  const lastDirectionRef = useRef<DirectionalFeedbackDirection>("center");
  const lastStepRef = useRef(stepCount);
  const temperatureHistoryRef = useRef<IntensityLevel[]>([]);
  const lastDirectionalSoundRef = useRef(0);
  const lastProximityPulseRef = useRef(0); // Throttle для proximity pulse
  const isProximityAudioActiveRef = useRef(false); // Флаг активности
  const lastMovementSoundRef = useRef(0); // Throttle для звуков при перемещении
  
  // ─── Доступные улики (скрытые, в текущей панораме) ───
  const availableClues = useMemo(() => {
    return clues.filter(clue => {
      const state = clueStates.get(clue.id);
      if (!state || state.state === "collected" || state.state === "revealed") {
        return false;
      }
      return isClueAvailable(clue, currentPanoId, stepCount);
    });
  }, [clues, clueStates, currentPanoId, stepCount]);
  
  // ─── Ближайшая улика и расчёт температуры ───
  const temperature = useMemo((): ProximityTemperature => {
    if (availableClues.length === 0) {
      return {
        level: "cold",
        closestClue: null,
        headingDelta: 180,
        isLookingAtClue: false,
        progressToClue: 0,
      };
    }
    
    // Находим улику с минимальной угловой разницей
    let minDelta = Infinity;
    let closestClueFound: HiddenClue | null = null;
    
    for (const clue of availableClues) {
      const delta = Math.abs(getHeadingDelta(currentHeading, clue.revealHeading));
      if (delta < minDelta) {
        minDelta = delta;
        closestClueFound = clue;
      }
    }
    
    const level = getIntensityLevel(minDelta);
    const coneDegrees = closestClueFound?.coneDegrees ?? 30;
    const isLookingAtClue = minDelta <= coneDegrees / 2;
    
    // Progress: 0 при 180°, 1 при 0°
    const progressToClue = 1 - (minDelta / 180);
    
    return {
      level,
      closestClue: closestClueFound,
      headingDelta: closestClueFound 
        ? getHeadingDelta(currentHeading, closestClueFound.revealHeading) 
        : 180,
      isLookingAtClue,
      progressToClue,
    };
  }, [availableClues, currentHeading]);
  
  // ─── Notify temperature change ───
  useEffect(() => {
    onTemperatureChange?.(temperature);
  }, [temperature, onTemperatureChange]);
  
  // ─── Основной аудио-эффект ───
  useEffect(() => {
    // Отключаем proximity audio если:
    // - хук отключен
    // - аудио отключено
    // - идёт процесс revealing (чтобы не конфликтовать с reveal progress)
    if (!enabled || !audioEnabled || isRevealing) {
      if (isProximityAudioActiveRef.current) {
        audioRef.current.stopAll();
        isProximityAudioActiveRef.current = false;
      }
      return;
    }
    
    const audio = audioRef.current;
    const { level, closestClue, headingDelta, isLookingAtClue, progressToClue } = temperature;
    
    // Если нет доступных улик — не управляем аудио (оставляем другим системам)
    if (!closestClue) {
      if (isProximityAudioActiveRef.current) {
        audio.stopAll();
        isProximityAudioActiveRef.current = false;
      }
      return;
    }
    
    isProximityAudioActiveRef.current = true;
    
    // ════════════════════════════════════════════════════════════════════════
    // 1. HEARTBEAT — ускоряется при приближении
    // Играется ВСЕГДА когда есть улика в панораме (даже если сзади)
    // ════════════════════════════════════════════════════════════════════════
    
    const targetBpm = HEARTBEAT_BPM[level];
    // Плавная интерполяция BPM на основе прогресса
    const adjustedBpm = Math.round(targetBpm + (progressToClue * 20));
    audio.startHeartbeat(Math.min(180, Math.max(60, adjustedBpm)));
    
    // ════════════════════════════════════════════════════════════════════════
    // 2. STATIC — помехи нарастают при близости
    // Играются ВСЕГДА когда есть улика в панораме
    // ════════════════════════════════════════════════════════════════════════
    
    const staticIntensity = STATIC_INTENSITY[level];
    // Static усиливается если смотришь на улику
    const adjustedStatic = isLookingAtClue 
      ? staticIntensity * 1.5 
      : staticIntensity;
    audio.startStatic(Math.min(1, adjustedStatic));
    
    // ════════════════════════════════════════════════════════════════════════
    // 3. НАПРАВЛЕННЫЕ ЗВУКИ — подсказка куда смотреть
    // Играются ВСЕГДА когда есть улика в панораме, независимо от угла!
    // ════════════════════════════════════════════════════════════════════════
    
    const now = Date.now();
    const direction = getDirection(headingDelta);
    
    // Играем направленный звук:
    // - При смене направления (лево↔право↔сзади↔центр)
    // - Или каждые 2.5 сек как напоминание
    // - НО не когда уже смотришь на улику (там свои звуки)
    if (
      closestClue && 
      !isLookingAtClue &&
      (direction !== lastDirectionRef.current || now - lastDirectionalSoundRef.current > 2500)
    ) {
      lastDirectionRef.current = direction;
      lastDirectionalSoundRef.current = now;
      
      // Воспроизводим направленный hint со стереоэффектом
      audio.playDirectionalHint(direction);
    }
    
    // Proximity pulse при смотрении на улику (throttled — max 1 раз в 200ms)
    if (isLookingAtClue && level === "burning") {
      if (now - lastProximityPulseRef.current > 200) {
        lastProximityPulseRef.current = now;
        audio.playProximityPulse(progressToClue);
      }
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // 4. ИЗМЕНЕНИЕ ИНТЕНСИВНОСТИ — событие при переходе уровня
    // Не дублируем если недавно играли направленный звук (< 500ms)
    // ════════════════════════════════════════════════════════════════════════
    
    if (level !== lastIntensityRef.current) {
      const timeSinceDirectional = now - lastDirectionalSoundRef.current;
      const shouldPlayIntensitySound = timeSinceDirectional > 500;
      
      const wasWarmer = getIntensityRank(level) > getIntensityRank(lastIntensityRef.current);
      
      if (wasWarmer && shouldPlayIntensitySound) {
        // Становится "теплее" — позитивный звук
        if (level === "burning") {
          audio.playDiscovery(); // Почти нашёл!
        } else if (level === "hot") {
          audio.playScanner();
        } else if (level === "warm") {
          audio.playHint();
        }
      } else if (!wasWarmer && shouldPlayIntensitySound) {
        // Становится "холоднее" — whisper предупреждение
        if (level === "cold" && lastIntensityRef.current !== "cold") {
          audio.playWhisper();
        }
      }
      
      lastIntensityRef.current = level;
    }
    
  }, [enabled, audioEnabled, isRevealing, temperature]);
  
  // ─── Горячо-холодно при перемещении ───
  useEffect(() => {
    if (!enabled || !audioEnabled || isRevealing) return;
    if (stepCount === lastStepRef.current) return;
    
    const audio = audioRef.current;
    const history = temperatureHistoryRef.current;
    const currentLevel = temperature.level;
    const now = Date.now();
    
    // Добавляем текущую температуру в историю
    history.push(currentLevel);
    if (history.length > 5) history.shift();
    
    // Throttle: не играем звуки чаще чем раз в 1 секунду
    const timeSinceLastSound = now - lastMovementSoundRef.current;
    if (timeSinceLastSound < 1000) {
      lastStepRef.current = stepCount;
      return;
    }
    
    // Проверяем тренд — становится теплее или холоднее?
    if (history.length >= 2) {
      const prevRank = getIntensityRank(history[history.length - 2]);
      const currRank = getIntensityRank(currentLevel);
      
      if (currRank > prevRank) {
        // Ближе к улике — поощрение
        audio.playHint();
        lastMovementSoundRef.current = now;
      } else if (currRank < prevRank && prevRank >= 2) {
        // Дальше от улики (если был warm или выше) — предупреждение
        audio.playWhisper();
        lastMovementSoundRef.current = now;
      }
    }
    
    lastStepRef.current = stepCount;
  }, [enabled, audioEnabled, isRevealing, stepCount, temperature.level]);
  
  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      audioRef.current.stopAll();
      isProximityAudioActiveRef.current = false;
    };
  }, []);
  
  // ─── Reset refs при смене улик ───
  useEffect(() => {
    // Сбрасываем историю температуры при смене набора улик
    temperatureHistoryRef.current = [];
    lastIntensityRef.current = "cold";
  }, [clues]);
  
  // ─── Manual controls ───
  const playDirectionalHint = useCallback((direction: "left" | "right" | "forward") => {
    const audio = audioRef.current;
    
    // Используем новый метод со стерео-панорамированием
    switch (direction) {
      case "left":
        audio.playDirectionalHint("left");
        break;
      case "right":
        audio.playDirectionalHint("right");
        break;
      case "forward":
        audio.playDirectionalHint("center");
        break;
    }
  }, []);
  
  const stopAll = useCallback(() => {
    audioRef.current.stopAll();
  }, []);
  
  return {
    temperature,
    availableClues,
    playDirectionalHint,
    stopAll,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getIntensityRank(level: IntensityLevel): number {
  switch (level) {
    case "cold": return 0;
    case "warm": return 1;
    case "hot": return 2;
    case "burning": return 3;
  }
}

export default useProximityAudio;

