/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONVERT PANORAMA MISSION TO HIDDEN CLUE FORMAT
 * Конвертирует старый формат миссий в новый с системой скрытых улик
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { PanoramaMission, PanoramaClue } from "@/types/panorama";
import type { HiddenClueMission, HiddenClue } from "@/types/hidden-clue";

/**
 * Конвертирует старую улику в новый формат HiddenClue
 */
function convertClue(clue: PanoramaClue, index: number): HiddenClue {
  // Определяем виртуальный panoId на основе индекса
  // Первые 2 улики на старте, остальные — в переулках
  let panoId: string;
  if (index < 2) {
    panoId = "START";
  } else if (index < 4) {
    panoId = "STEP_1";
  } else if (index < 6) {
    panoId = "STEP_2";
  } else {
    panoId = "STEP_3+";
  }
  
  // Конвертируем detectionRadius в coneDegrees (примерно x2)
  const coneDegrees = (clue.detectionRadius || 20) * 3;
  
  // DwellTime зависит от сложности (больше индекс = сложнее)
  const dwellTime = 0.8 + (index * 0.2);
  
  return {
    id: clue.id,
    panoId,
    revealHeading: clue.position?.yaw ?? 0,
    coneDegrees: Math.min(coneDegrees, 90), // Максимум 90 градусов
    dwellTime: Math.min(dwellTime, 2.0), // Максимум 2 секунды
    
    name: clue.name,
    description: clue.description || "",
    icon: clue.icon || "🔍",
    storyContext: clue.storyContext || `Найдена улика: ${clue.name}`,
    xpReward: clue.xpReward || 30,
    
    hintText: clue.hint,
    scannerHint: `Сканер обнаружил что-то в этом районе...`,
  };
}

/**
 * Конвертирует PanoramaMission в HiddenClueMission
 */
export function convertToHiddenClueMission(mission: PanoramaMission): HiddenClueMission {
  const hiddenClues = mission.clues.map((clue, index) => convertClue(clue, index));
  
  // Требуется найти 60% улик
  const requiredClues = Math.ceil(hiddenClues.length * 0.6);
  
  return {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    briefing: mission.briefing || mission.description,
    
    startCoordinates: mission.startPoint as [number, number],
    startPanoId: "START",
    startHeading: mission.startDirection?.[0] ?? 0,
    
    clues: hiddenClues,
    requiredClues,
    
    timeLimit: mission.timeLimit,
    xpReward: mission.xpReward,
    
    location: mission.location,
    difficulty: mission.difficulty,
    icon: mission.icon || "🗺️",
    color: mission.color || "#06b6d4",
  };
}

