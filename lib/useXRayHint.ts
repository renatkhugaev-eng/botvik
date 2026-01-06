"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USE X-RAY HINT HOOK
 * Управление платной подсказкой "Рентген"
 * 
 * - Получает координаты игрока и ближайшей нераскрытой улики
 * - Списывает энергию через API
 * - Применяет XP штраф
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect } from "react";

// Declare google maps types for TypeScript
declare const google: {
  maps: {
    StreetViewService: new () => {
      getPanorama: (
        request: { pano: string },
        callback: (
          data: { location?: { latLng?: { lat: () => number; lng: () => number } } } | null,
          status: string
        ) => void
      ) => void;
    };
    StreetViewStatus: {
      OK: string;
    };
  };
};
import { fetchWithAuth } from "@/lib/api";
import type { HiddenClue, ClueRuntimeState } from "@/types/hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseXRayHintProps {
  /** Все улики миссии */
  clues: HiddenClue[];
  /** Состояния улик */
  clueStates: Map<string, ClueRuntimeState>;
  /** Текущие координаты игрока [lat, lng] */
  playerPosition: [number, number] | null;
  /** Включена ли подсказка */
  enabled?: boolean;
}

interface XRayHintState {
  /** Показывается ли миникарта */
  isActive: boolean;
  /** Сколько раз уже использована в этой миссии */
  usesCount: number;
  /** Идёт ли загрузка */
  isLoading: boolean;
  /** Текущая энергия пользователя */
  energy: number;
  /** Ближайшая нераскрытая улика */
  targetClue: HiddenClue | null;
  /** Координаты улики (получены через Google API) */
  clueCoordinates: [number, number] | null;
  /** XP множитель (1.0 = 100%, 0.8 = 80% после использования) */
  xpMultiplier: number;
  /** Ошибка */
  error: string | null;
}

interface UseXRayHintReturn extends XRayHintState {
  /** Купить и активировать рентген */
  activateXRay: () => Promise<boolean>;
  /** Закрыть миникарту */
  closeXRay: () => void;
  /** Можно ли использовать (есть энергия + есть улики) */
  canUse: boolean;
  /** Стоимость */
  cost: number;
  /** Осталось использований */
  usesRemaining: number;
  /** Максимум использований */
  maxUses: number;
  /** Была ли использована хотя бы раз (для XP penalty) */
  wasUsed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const XRAY_COST = 0; // БЕСПЛАТНО
const XP_PENALTY = 0.2; // 20% штраф к XP (сохраняем баланс)
const MAX_XRAY_USES = 7; // Максимум использований за миссию

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Get panorama coordinates by panoId
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Проверяет, является ли panoId виртуальным (не реальным Google panoId)
 */
function isVirtualPanoId(panoId: string): boolean {
  return panoId === "START" || 
         panoId.startsWith("STEP_") || 
         panoId.startsWith("VIRTUAL_");
}

async function getPanoramaCoordinates(panoId: string): Promise<[number, number] | null> {
  // Виртуальные panoId не могут быть разрешены через Google API
  if (isVirtualPanoId(panoId)) {
    console.warn(`[XRay] Cannot get coordinates for virtual panoId: ${panoId}`);
    return null;
  }

  return new Promise((resolve) => {
    if (!window.google?.maps) {
      resolve(null);
      return;
    }

    const streetViewService = new google.maps.StreetViewService();
    
    streetViewService.getPanorama(
      { pano: panoId },
      (data, status) => {
        // Сравниваем со строкой "OK" напрямую
        if (status === "OK" && data?.location?.latLng) {
          const lat = data.location.latLng.lat();
          const lng = data.location.latLng.lng();
          resolve([lat, lng]);
        } else {
          console.warn(`[XRay] Failed to get coordinates for panoId: ${panoId}, status: ${status}`);
          resolve(null);
        }
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useXRayHint({
  clues,
  clueStates,
  playerPosition,
  enabled = true,
}: UseXRayHintProps): UseXRayHintReturn {
  // ─── State ───
  const [state, setState] = useState<XRayHintState>({
    isActive: false,
    usesCount: 0,
    isLoading: false,
    energy: 0,
    targetClue: null,
    clueCoordinates: null,
    xpMultiplier: 1.0,
    error: null,
  });

  const fetchedEnergyRef = useRef(false);

  // ─── Fetch initial energy (только если подсказка платная) ───
  useEffect(() => {
    // При бесплатной подсказке не нужно запрашивать энергию
    if (XRAY_COST === 0 || !enabled || fetchedEnergyRef.current) return;
    fetchedEnergyRef.current = true;

    fetchWithAuth("/api/panorama/hint/xray")
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setState(prev => ({ ...prev, energy: data.currentEnergy }));
        }
      })
      .catch(console.error);
  }, [enabled]);

  // ─── Find nearest unrevealed clue with REAL panoId ───
  // Использует distanceFromStart если доступно, иначе порядок в массиве
  // Фильтрует улики с виртуальными panoId (для них X-Ray не работает)
  const findNearestClue = useCallback((): HiddenClue | null => {
    const unrevealedClues = clues.filter(clue => {
      const clueState = clueStates.get(clue.id);
      const isUnrevealed = !clueState || clueState.state === "hidden" || clueState.state === "hinted";
      // Отфильтровываем улики с виртуальными panoId — для них X-Ray не работает
      const hasRealPanoId = !isVirtualPanoId(clue.panoId);
      return isUnrevealed && hasRealPanoId;
    });

    if (unrevealedClues.length === 0) return null;

    // Сортируем по distanceFromStart (если есть в типе улики)
    // Улики с меньшим расстоянием — ближе к игроку
    const sortedClues = [...unrevealedClues].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const distA = (a as any).distanceFromStart ?? Infinity;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const distB = (b as any).distanceFromStart ?? Infinity;
      return distA - distB;
    });

    return sortedClues[0];
  }, [clues, clueStates]);

  // ─── Activate X-Ray ───
  const activateXRay = useCallback(async (): Promise<boolean> => {
    if (state.usesCount >= MAX_XRAY_USES || state.isLoading) return false;

    // Проверяем доступность Google Maps API ДО списания энергии
    if (!window.google?.maps) {
      setState(prev => ({ ...prev, error: "Google Maps не загружен. Попробуйте позже." }));
      return false;
    }

    const targetClue = findNearestClue();
    if (!targetClue) {
      // Проверяем, есть ли нераскрытые улики вообще (возможно, все с виртуальными panoId)
      const anyUnrevealed = clues.some(c => {
        const state = clueStates.get(c.id);
        return !state || state.state === "hidden" || state.state === "hinted";
      });
      
      const errorMsg = anyUnrevealed 
        ? "Рентген недоступен для этой миссии" // Есть улики, но все виртуальные
        : "Все улики уже найдены";
      
      setState(prev => ({ ...prev, error: errorMsg }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. СНАЧАЛА получаем координаты улики (бесплатно)
      const clueCoords = await getPanoramaCoordinates(targetClue.panoId);
      
      if (!clueCoords) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Не удалось определить координаты улики. Энергия не списана.",
        }));
        return false;
      }

      // 2. Списываем энергию через API (если подсказка платная)
      if (XRAY_COST > 0) {
        const response = await fetchWithAuth("/api/panorama/hint/xray", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: "current",
            clueId: targetClue.id,
            clueName: targetClue.name,
          }),
        });

        const data = await response.json();

        if (!data.ok) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: data.message || "Ошибка покупки подсказки",
          }));
          return false;
        }

        // Платная активация
        setState(prev => ({
          ...prev,
          isActive: true,
          usesCount: prev.usesCount + 1,
          isLoading: false,
          energy: data.remainingEnergy,
          targetClue,
          clueCoordinates: clueCoords,
          xpMultiplier: 1 - XP_PENALTY, // 0.8
          error: null,
        }));
      } else {
        // БЕСПЛАТНАЯ активация
        setState(prev => ({
          ...prev,
          isActive: true,
          usesCount: prev.usesCount + 1,
          isLoading: false,
          targetClue,
          clueCoordinates: clueCoords,
          xpMultiplier: 1 - XP_PENALTY, // 0.8 — штраф к XP сохраняем для баланса
          error: null,
        }));
      }

      return true;

    } catch (err) {
      console.error("[XRay] Error:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Ошибка сети",
      }));
      return false;
    }
  }, [state.usesCount, state.isLoading, findNearestClue, clues, clueStates]);

  // ─── Close X-Ray ───
  const closeXRay = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
    }));
  }, []);

  // ─── Computed values ───
  const hasAvailableClues = !!findNearestClue();
  const canAfford = XRAY_COST === 0 || state.energy >= XRAY_COST;
  const usesRemaining = MAX_XRAY_USES - state.usesCount;
  const canUse = enabled && 
                 usesRemaining > 0 && 
                 canAfford && 
                 hasAvailableClues;

  return {
    ...state,
    activateXRay,
    closeXRay,
    canUse,
    cost: XRAY_COST,
    usesRemaining,
    maxUses: MAX_XRAY_USES,
    wasUsed: state.usesCount > 0, // Для XP penalty
  };
}

