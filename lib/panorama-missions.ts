/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSIONS DATA
 * Все миссии используют новую систему скрытых улик
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HiddenClueMission } from "@/types/hidden-clue";
import { ALL_HIDDEN_MISSIONS } from "./demo-cases/all-hidden-missions";

// Re-export all missions
export const PANORAMA_MISSIONS = ALL_HIDDEN_MISSIONS;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить миссию по ID
 */
export function getMissionById(id: string): HiddenClueMission | undefined {
  return PANORAMA_MISSIONS.find(m => m.id === id);
}

/**
 * Получить все миссии
 */
export function getAllMissions(): HiddenClueMission[] {
  return PANORAMA_MISSIONS;
}

/**
 * Получить миссии по сложности
 */
export function getMissionsByDifficulty(difficulty: HiddenClueMission["difficulty"]): HiddenClueMission[] {
  return PANORAMA_MISSIONS.filter(m => m.difficulty === difficulty);
}

// Legacy exports for backwards compatibility
export const getHiddenClueMissionById = getMissionById;
export const getAllHiddenClueMissions = getAllMissions;
export const HIDDEN_CLUE_MISSIONS = PANORAMA_MISSIONS;
