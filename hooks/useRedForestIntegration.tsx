/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * КРАСНЫЙ ЛЕС — React Hook для интеграции с InkStoryPlayer
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Этот хук обеспечивает:
 * - Автосохранение состояния между выборами
 * - Загрузку состояния из предыдущих эпизодов
 * - Привязку внешних функций (haptic, звук, уведомления)
 * - Наблюдение за переменными (sanity, trust, clues)
 * - UI эффекты на основе состояния рассудка
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { InkRunner, type VariableObserver } from "@/lib/ink-runtime";
import {
  extractStateFromRunner,
  applyStateToRunner,
  saveState,
  loadState,
  getInitialStateForEpisode,
  type RedForestState,
} from "@/lib/ink-state-manager";
import { investigationHaptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════════

export interface RedForestIntegrationOptions {
  episodeId: string;
  onSanityChange?: (sanity: number) => void;
  onClueFound?: (clueCount: number) => void;
  onChapterChange?: (chapter: number) => void;
  onStateChange?: (state: RedForestState) => void;
  enableHaptic?: boolean;
  enableAutoSave?: boolean;
}

export interface RedForestIntegrationResult {
  // Текущее состояние
  sanity: number;
  daysRemaining: number;
  chapter: number;
  clueCount: number;
  cultAwareness: number;
  
  // UI состояния
  sanityLevel: "sane" | "disturbed" | "mad";
  moodOverlay: "none" | "light" | "medium" | "heavy";
  
  // Методы
  initializeRunner: (runner: InkRunner) => void;
  saveProgress: () => void;
  resetProgress: () => void;
  
  // Флаги
  isLoaded: boolean;
  hasExistingSave: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ХУК
// ═══════════════════════════════════════════════════════════════════════════════

export function useRedForestIntegration(
  options: RedForestIntegrationOptions
): RedForestIntegrationResult {
  const {
    episodeId,
    onSanityChange,
    onClueFound,
    onChapterChange,
    onStateChange,
    enableHaptic = true,
    enableAutoSave = true,
  } = options;

  // Состояние
  const [sanity, setSanity] = useState(85);
  const [daysRemaining, setDaysRemaining] = useState(7);
  const [chapter, setChapter] = useState(1);
  const [clueCount, setClueCount] = useState(0);
  const [cultAwareness, setCultAwareness] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasExistingSave, setHasExistingSave] = useState(false);

  // Refs
  const runnerRef = useRef<InkRunner | null>(null);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ
  // ═══════════════════════════════════════════════════════════════════════════

  const sanityLevel = sanity >= 60 ? "sane" : sanity >= 30 ? "disturbed" : "mad";
  
  const moodOverlay = sanity >= 70 
    ? "none" 
    : sanity >= 50 
      ? "light" 
      : sanity >= 30 
        ? "medium" 
        : "heavy";

  // ═══════════════════════════════════════════════════════════════════════════
  // НАБЛЮДАТЕЛЬ ПЕРЕМЕННЫХ
  // ═══════════════════════════════════════════════════════════════════════════

  const variableObserver: VariableObserver = useCallback(
    (variableName: string, newValue: unknown) => {
      switch (variableName) {
        case "sanity":
          const newSanity = Number(newValue);
          setSanity(newSanity);
          onSanityChange?.(newSanity);
          
          // Haptic feedback на изменение рассудка
          if (enableHaptic) {
            if (newSanity < 30) {
              investigationHaptic.suspense();
            } else if (newSanity < 50) {
              investigationHaptic.timerWarning();
            }
          }
          break;

        case "days_remaining":
          setDaysRemaining(Number(newValue));
          break;

        case "chapter":
          const newChapter = Number(newValue);
          setChapter(newChapter);
          onChapterChange?.(newChapter);
          
          if (enableHaptic) {
            investigationHaptic.sceneTransition();
          }
          break;

        case "evidence_collected":
          const newClueCount = Number(newValue);
          setClueCount(newClueCount);
          onClueFound?.(newClueCount);
          
          if (enableHaptic) {
            investigationHaptic.clueDiscovered();
          }
          break;

        case "cult_awareness":
          setCultAwareness(Number(newValue));
          break;
      }
    },
    [onSanityChange, onClueFound, onChapterChange, enableHaptic]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  const initializeRunner = useCallback(
    (runner: InkRunner) => {
      runnerRef.current = runner;

      // Отписываемся от предыдущих наблюдателей
      unsubscribeRef.current.forEach((unsub) => unsub());
      unsubscribeRef.current = [];

      // Проверяем наличие сохранения
      const existingSave = loadState(episodeId);
      setHasExistingSave(existingSave !== null);

      // Загружаем начальное состояние
      const initialState = getInitialStateForEpisode(episodeId);
      
      // Применяем состояние к runner
      if (runner.isRedForest()) {
        applyStateToRunner(runner, initialState);
      }

      // Обновляем локальное состояние
      setSanity(initialState.sanity);
      setDaysRemaining(initialState.days_remaining);
      setChapter(initialState.chapter);
      setClueCount(initialState.evidence_collected);
      setCultAwareness(initialState.cult_awareness);

      // Подписываемся на изменения переменных
      const unsub = runner.observeAllVariables(variableObserver);
      unsubscribeRef.current.push(unsub);

      // Привязываем внешние функции
      runner.bindRedForestFunctions({
        playSound: (sound) => {
          console.log(`[RedForest] Play sound: ${sound}`);
          // Интеграция со звуковой системой
        },
        triggerHaptic: (type) => {
          if (enableHaptic) {
            switch (type) {
              case "suspense":
                investigationHaptic.suspense();
                break;
              case "clue":
                investigationHaptic.clueDiscovered();
                break;
              case "dramatic":
                investigationHaptic.dramaticMoment();
                break;
              case "warning":
                investigationHaptic.timerWarning();
                break;
              default:
                investigationHaptic.sceneTransition();
            }
          }
        },
        saveCheckpoint: () => {
          if (runnerRef.current) {
            const state = extractStateFromRunner(runnerRef.current, episodeId);
            saveState(state);
            onStateChange?.(state);
          }
        },
        showNotification: (message) => {
          console.log(`[RedForest] Notification: ${message}`);
          // Интеграция с системой уведомлений
        },
      });

      setIsLoaded(true);
    },
    [episodeId, variableObserver, enableHaptic, onStateChange]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // СОХРАНЕНИЕ ПРОГРЕССА
  // ═══════════════════════════════════════════════════════════════════════════

  const saveProgress = useCallback(() => {
    if (!runnerRef.current) return;

    const state = extractStateFromRunner(runnerRef.current, episodeId);
    saveState(state);
    onStateChange?.(state);
  }, [episodeId, onStateChange]);

  // Автосохранение при изменениях
  useEffect(() => {
    if (!enableAutoSave || !isLoaded) return;

    // Сохраняем при любом значимом изменении
    const debounceTimer = setTimeout(() => {
      saveProgress();
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [sanity, chapter, clueCount, enableAutoSave, isLoaded, saveProgress]);

  // ═══════════════════════════════════════════════════════════════════════════
  // СБРОС ПРОГРЕССА
  // ═══════════════════════════════════════════════════════════════════════════

  const resetProgress = useCallback(() => {
    // Очищаем сохранение
    try {
      localStorage.removeItem(`red_forest_episode_${episodeId}`);
    } catch {
      // Ignore
    }

    // Сбрасываем состояние
    setSanity(85);
    setDaysRemaining(7);
    setChapter(1);
    setClueCount(0);
    setCultAwareness(0);
    setHasExistingSave(false);
  }, [episodeId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    sanity,
    daysRemaining,
    chapter,
    clueCount,
    cultAwareness,
    sanityLevel,
    moodOverlay,
    initializeRunner,
    saveProgress,
    resetProgress,
    isLoaded,
    hasExistingSave,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Индикатор рассудка для UI
 */
export function SanityIndicator({ sanity }: { sanity: number }) {
  const level = sanity >= 60 ? "sane" : sanity >= 30 ? "disturbed" : "mad";
  
  const colors = {
    sane: "from-emerald-500 to-green-600",
    disturbed: "from-amber-500 to-orange-600",
    mad: "from-red-500 to-rose-600",
  };

  const labels = {
    sane: "Ясный разум",
    disturbed: "Тревожность",
    mad: "На грани",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${colors[level]} animate-pulse`} />
      <span className="text-xs text-white/70">{labels[level]}</span>
      <span className="text-xs font-medium text-white">{sanity}%</span>
    </div>
  );
}

/**
 * Оверлей для визуализации состояния рассудка
 */
export function SanityOverlay({ level }: { level: "none" | "light" | "medium" | "heavy" }) {
  if (level === "none") return null;

  const intensity = {
    light: "opacity-5",
    medium: "opacity-15",
    heavy: "opacity-30",
  };

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-50 bg-red-900 ${intensity[level]} transition-opacity duration-1000`}
      style={{
        mixBlendMode: "multiply",
      }}
    >
      {level === "heavy" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-red-500/10 to-transparent" />
      )}
    </div>
  );
}
