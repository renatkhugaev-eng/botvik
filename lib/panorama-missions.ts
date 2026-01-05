/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSIONS DATA
 * Все миссии используют новую систему скрытых улик
 * 
 * Поддерживает два режима panoId:
 * 1. Виртуальные (START, STEP_N, STEP_N-M, STEP_N+) — для демо-миссий
 * 2. Реальные Google Street View ID — для сгенерированных миссий
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HiddenClueMission } from "@/types/hidden-clue";
import { ALL_HIDDEN_MISSIONS } from "./demo-cases/all-hidden-missions";

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE FOR GENERATED MISSIONS
// В production это будет БД, пока — in-memory + localStorage
// ═══════════════════════════════════════════════════════════════════════════

let generatedMissions: HiddenClueMission[] = [];

/**
 * Добавить сгенерированную миссию
 */
export function addGeneratedMission(mission: HiddenClueMission): void {
  // Удаляем если уже есть с таким ID
  generatedMissions = generatedMissions.filter(m => m.id !== mission.id);
  generatedMissions.push(mission);
  
  // Сохраняем в localStorage для persistence
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("generated_missions", JSON.stringify(generatedMissions));
    } catch {
      console.warn("[PanoramaMissions] Failed to save to localStorage");
    }
  }
}

/**
 * Загрузить сгенерированные миссии из localStorage
 */
export function loadGeneratedMissions(): void {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("generated_missions");
      if (stored) {
        generatedMissions = JSON.parse(stored);
        console.log(`[PanoramaMissions] Loaded ${generatedMissions.length} generated missions`);
      }
    } catch {
      console.warn("[PanoramaMissions] Failed to load from localStorage");
    }
  }
}

/**
 * Получить сгенерированные миссии
 */
export function getGeneratedMissions(): HiddenClueMission[] {
  return generatedMissions;
}

/**
 * Очистить сгенерированные миссии
 */
export function clearGeneratedMissions(): void {
  generatedMissions = [];
  if (typeof window !== "undefined") {
    localStorage.removeItem("generated_missions");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED MISSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить все миссии (демо + сгенерированные)
 */
export function getAllMissions(): HiddenClueMission[] {
  return [...ALL_HIDDEN_MISSIONS, ...generatedMissions];
}

// Re-export demo missions
export const PANORAMA_MISSIONS = ALL_HIDDEN_MISSIONS;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить миссию по ID (ищет в демо и сгенерированных)
 */
export function getMissionById(id: string): HiddenClueMission | undefined {
  // Сначала ищем в демо-миссиях
  const demoMission = ALL_HIDDEN_MISSIONS.find(m => m.id === id);
  if (demoMission) return demoMission;
  
  // Затем в сгенерированных
  return generatedMissions.find(m => m.id === id);
}

/**
 * Получить миссии по сложности
 */
export function getMissionsByDifficulty(difficulty: HiddenClueMission["difficulty"]): HiddenClueMission[] {
  return getAllMissions().filter(m => m.difficulty === difficulty);
}

/**
 * Проверить, использует ли миссия виртуальные panoId (STEP_N, START и т.д.)
 * или реальные Google Street View ID
 */
export function usesVirtualPanoIds(mission: HiddenClueMission): boolean {
  if (!mission.clues || mission.clues.length === 0) return false;
  
  const firstClue = mission.clues[0];
  return (
    firstClue.panoId === "START" ||
    firstClue.panoId === "ANY" ||
    firstClue.panoId.startsWith("STEP_")
  );
}

/**
 * Проверить, является ли миссия сгенерированной
 */
export function isGeneratedMission(mission: HiddenClueMission): boolean {
  return mission.id.startsWith("gen_");
}

// Legacy exports for backwards compatibility
export const getHiddenClueMissionById = getMissionById;
export const getAllHiddenClueMissions = getAllMissions;
export const HIDDEN_CLUE_MISSIONS = PANORAMA_MISSIONS;
