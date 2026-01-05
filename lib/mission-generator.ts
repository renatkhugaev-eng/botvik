/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MISSION GENERATOR v3.0.0
 * Автоматическая генерация панорамных миссий с контентом
 * 
 * Архитектура 2025:
 * - Zod валидация входных/выходных данных
 * - SeededRandom для воспроизводимости
 * - Темы вынесены в отдельные модули
 * - Округление координат для консистентности
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  PanoramaGraph,
  ClueSpot,
  MissionGenerationRequest,
  MissionGenerationResult,
} from "@/types/panorama-graph";

import { 
  getMissionTheme, 
  getAllThemes, 
  isValidTheme,
  getMaxClueCount,
  type MissionTheme,
} from "@/lib/themes";

import { findOptimalClueSpots } from "./clue-placement";
import { SeededRandom, generateSeed } from "./seeded-random";
import { 
  type GeneratedMission, 
  type GeneratedClue,
  type MissionThemeType,
  type ClueTemplate,
  safeValidateGeneratedMission,
} from "./schemas/panorama-mission";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Версия генератора — семантическое версионирование */
export const GENERATOR_VERSION = "3.0.0";

/** Лимит времени на миссию в зависимости от сложности (в секундах) */
const TIME_LIMIT_BY_DIFFICULTY: Record<string, number> = {
  easy: 900,      // 15 минут
  medium: 720,    // 12 минут
  hard: 600,      // 10 минут
  extreme: 480,   // 8 минут
};

/** Процент обязательных улик от общего количества */
const REQUIRED_CLUES_RATIO_BY_DIFFICULTY: Record<string, number> = {
  easy: 0.6,      // 60% — нужно найти меньше
  medium: 0.7,    // 70%
  hard: 0.8,      // 80%
  extreme: 0.9,   // 90% — почти все
};

/** Минимальное/максимальное количество улик */
const MIN_CLUE_COUNT = 3;
const MAX_CLUE_COUNT = 7;

/** Точность округления координат (знаков после запятой) */
const HEADING_PRECISION = 2;
const COORDINATE_PRECISION = 6;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Округлить число до заданной точности
 */
function round(value: number, precision: number): number {
  const multiplier = Math.pow(10, precision);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Генерировать уникальный ID миссии
 * Формат: gen_[timestamp]_[random]
 */
function generateMissionId(rng: SeededRandom): string {
  const timestamp = Date.now();
  const random = rng.int(100000, 999999);
  return `gen_${timestamp}_${random}`;
}

/**
 * Вычислить параметры сложности улики
 */
function calculateClueParams(difficulty: number): {
  coneDegrees: number;
  dwellTime: number;
} {
  // Чем сложнее — тем уже конус и дольше смотреть
  const coneDegrees = Math.max(12, 30 - difficulty * 4); // 30 → 12
  const dwellTime = round(2.0 + difficulty * 0.4, 1); // 2.0 → 4.0
  
  return { coneDegrees, dwellTime };
}

/**
 * Вычислить награду XP на основе сложности
 */
function calculateXpReward(baseXp: number, difficulty: number): number {
  return Math.round(baseXp * (1 + (difficulty - 1) * 0.2));
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Сгенерировать улику для точки
 */
function generateClue(
  spot: ClueSpot,
  index: number,
  template: ClueTemplate,
  theme: MissionThemeType,
  rng: SeededRandom
): GeneratedClue {
  const { coneDegrees, dwellTime } = calculateClueParams(spot.difficulty);
  
  // Безопасное получение префикса panoId
  const panoIdPrefix = spot.panoId.slice(0, 8);
  
  return {
    id: `${theme}_clue_${index}_${panoIdPrefix}`,
    panoId: spot.panoId,
    revealHeading: round(spot.heading, HEADING_PRECISION), // Округляем до 2 знаков
    coneDegrees,
    dwellTime,
    name: rng.choice(template.nameTemplates),
    description: spot.description,
    icon: template.icon,
    storyContext: rng.choice(template.storyContextTemplates),
    xpReward: calculateXpReward(template.baseXp, spot.difficulty),
    hintText: rng.choice(template.hintTemplates),
    scannerHint: `Обнаружен объект типа "${template.name}".`,
    spotType: spot.type,
    distanceFromStart: spot.distanceFromStart,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Сгенерировать миссию на основе графа
 * 
 * @param graph - Граф панорам от Google Street View
 * @param request - Параметры генерации
 * @param seed - Опциональный seed для воспроизводимости
 * @returns Результат генерации с миссией или ошибкой
 */
export function generateMission(
  graph: PanoramaGraph,
  request: MissionGenerationRequest,
  seed?: string
): MissionGenerationResult {
  const startTime = Date.now();
  
  // Создаём генератор случайных чисел
  const actualSeed = seed || generateSeed();
  const rng = new SeededRandom(actualSeed);
  
  try {
    // ═══════════════════════════════════════════════════════════════════════
    // ВАЛИДАЦИЯ
    // ═══════════════════════════════════════════════════════════════════════
    
    // Проверяем тему
    if (!isValidTheme(request.theme)) {
      return {
        success: false,
        error: `Неизвестная тема миссии: "${request.theme}". Доступные: yakuza, spy, heist, murder, smuggling, art_theft, kidnapping, corruption, custom`,
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // Проверяем граф
    if (!graph.nodes || graph.nodes.size === 0) {
      return {
        success: false,
        error: "Граф панорам пуст. Сначала выполните сканирование.",
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    const theme = getMissionTheme(request.theme);
    const difficulty = request.difficulty || "hard";
    const maxThemeClues = getMaxClueCount(request.theme);
    
    // Нормализуем количество улик
    const clueCount = Math.min(
      Math.max(MIN_CLUE_COUNT, request.clueCount),
      MAX_CLUE_COUNT,
      maxThemeClues
    );
    
    // Предупреждаем если запрошено больше чем есть шаблонов
    if (request.clueCount > maxThemeClues) {
      console.warn(
        `[MissionGenerator] Запрошено ${request.clueCount} улик, но тема "${request.theme}" ` +
        `имеет только ${maxThemeClues} шаблонов. Используем ${clueCount}.`
      );
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // ГЕНЕРАЦИЯ
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1. Находим оптимальные точки для улик
    const spots = findOptimalClueSpots(graph, {
      clueCount,
      minDistanceBetweenClues: 3,
      prioritizeDeadEnds: true,
      minFirstClueDepth: 2,
    });
    
    if (spots.length < clueCount) {
      return {
        success: false,
        error: `Недостаточно интересных точек: найдено ${spots.length}, нужно ${clueCount}. ` +
               `Попробуйте увеличить глубину сканирования.`,
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // 2. Перемешиваем шаблоны для разнообразия (с seed)
    const shuffledTemplates = rng.shuffle([...theme.clueTemplates]);
    
    // 3. Генерируем улики
    const clues: GeneratedClue[] = spots.map((spot, index) => {
      const template = shuffledTemplates[index % shuffledTemplates.length];
      return generateClue(spot, index, template, request.theme, rng);
    });
    
    // 4. Вычисляем награды и параметры на основе сложности
    const totalXp = clues.reduce((sum, c) => sum + c.xpReward, 0);
    const baseReward = Math.round(totalXp * 0.5);
    
    // Динамические параметры от сложности
    const timeLimit = TIME_LIMIT_BY_DIFFICULTY[difficulty] || 600;
    const requiredCluesRatio = REQUIRED_CLUES_RATIO_BY_DIFFICULTY[difficulty] || 0.8;
    const requiredClues = Math.ceil(clueCount * requiredCluesRatio);
    
    // 5. Собираем миссию
    const mission: GeneratedMission = {
      id: generateMissionId(rng),
      title: theme.title,
      description: theme.description,
      briefing: theme.briefing,
      startCoordinates: [
        round(graph.startCoordinates[0], COORDINATE_PRECISION),
        round(graph.startCoordinates[1], COORDINATE_PRECISION),
      ],
      startPanoId: graph.startPanoId,
      startHeading: 0,
      allowNavigation: true,
      clues,
      requiredClues,
      timeLimit,
      xpReward: baseReward,
      speedBonusPerSecond: 0.5,
      location: request.locationName || "Неизвестная локация",
      difficulty,
      icon: theme.icon,
      color: theme.color,
      generatedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      seed: actualSeed, // Сохраняем seed для воспроизводимости
    };
    
    // 6. Валидируем результат через Zod
    const validation = safeValidateGeneratedMission(mission);
    if (!validation.success) {
      console.error("[MissionGenerator] Generated mission failed validation:", validation.error);
      return {
        success: false,
        error: `Ошибка валидации миссии: ${validation.error}`,
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    console.log(
      `[MissionGenerator] Успешно сгенерирована миссия "${mission.title}" ` +
      `с ${clues.length} уликами (seed: ${actualSeed.slice(0, 12)}...)`
    );
    
    return {
      success: true,
      mission,
      graph,
      spots,
      generationTimeMs: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error("[MissionGenerator] Ошибка генерации:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      generationTimeMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Конвертировать сгенерированную миссию в формат HiddenClueMission
 */
export function toHiddenClueMission(generated: GeneratedMission): import("@/types/hidden-clue").HiddenClueMission {
  return {
    id: generated.id,
    title: generated.title,
    description: generated.description,
    briefing: generated.briefing,
    startCoordinates: generated.startCoordinates,
    startPanoId: generated.startPanoId,
    startHeading: generated.startHeading,
    allowNavigation: generated.allowNavigation,
    clues: generated.clues.map(clue => ({
      id: clue.id,
      panoId: clue.panoId,
      revealHeading: clue.revealHeading,
      coneDegrees: clue.coneDegrees,
      dwellTime: clue.dwellTime,
      name: clue.name,
      description: clue.description,
      icon: clue.icon,
      storyContext: clue.storyContext,
      xpReward: clue.xpReward,
      hintText: clue.hintText,
      scannerHint: clue.scannerHint,
    })),
    requiredClues: generated.requiredClues,
    timeLimit: generated.timeLimit,
    xpReward: generated.xpReward,
    speedBonusPerSecond: generated.speedBonusPerSecond,
    location: generated.location,
    difficulty: generated.difficulty,
    icon: generated.icon,
    color: generated.color,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// Реэкспортируем для обратной совместимости
export { getMissionTheme, getAllThemes, isValidTheme, getMaxClueCount };
export type { MissionTheme };
