/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MISSION GENERATOR v3.1.0
 * Автоматическая генерация панорамных миссий с контентом
 * 
 * Best Practices 2025:
 * - Zod валидация входных/выходных данных
 * - SeededRandom для воспроизводимости
 * - Темы вынесены в отдельные модули
 * - Адаптивные параметры
 * - Структурированные метрики
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

import { findOptimalClueSpots, getPlacementStats } from "./clue-placement";
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
export const GENERATOR_VERSION = "3.1.0";

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

/** Точность округления */
const HEADING_PRECISION = 2;
const COORDINATE_PRECISION = 6;

/** Минимальные требования к графу */
const MIN_GRAPH_NODES = 10;
const MIN_GRAPH_DEPTH = 3;

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
function calculateClueParams(
  difficulty: number, 
  graphMaxDepth: number
): { coneDegrees: number; dwellTime: number } {
  // Адаптивный конус: чем глубже граф, тем уже может быть конус на высоких сложностях
  const depthFactor = Math.min(1, graphMaxDepth / 40); // нормализуем до 40 шагов
  
  // Базовый конус: 30° для сложности 1, до 12° для сложности 5
  const baseCone = 30 - difficulty * 4;
  // Применяем фактор глубины (глубокие графы = можно уже конус)
  const coneDegrees = Math.max(12, Math.round(baseCone * (1 - depthFactor * 0.2)));
  
  // Время удержания: 2.0с для сложности 1, до 4.0с для сложности 5
  const dwellTime = round(2.0 + difficulty * 0.4, 1);
  
  return { coneDegrees, dwellTime };
}

/**
 * Вычислить награду XP на основе сложности
 */
function calculateXpReward(baseXp: number, difficulty: number): number {
  // Прогрессивный бонус: +20% за каждый уровень сложности
  return Math.round(baseXp * (1 + (difficulty - 1) * 0.2));
}

/**
 * Вычислить общую награду миссии на основе улик и сложности
 */
function calculateMissionReward(
  clues: GeneratedClue[], 
  difficulty: string,
  graphMaxDepth: number
): number {
  const totalClueXp = clues.reduce((sum, c) => sum + c.xpReward, 0);
  
  // Базовая награда = 50% от суммы улик
  let reward = Math.round(totalClueXp * 0.5);
  
  // Бонус за сложность
  const difficultyMultiplier: Record<string, number> = {
    easy: 0.8,
    medium: 1.0,
    hard: 1.2,
    extreme: 1.5,
  };
  reward = Math.round(reward * (difficultyMultiplier[difficulty] || 1.0));
  
  // Бонус за глубину графа (большие графы = больше награда)
  const depthBonus = Math.floor(graphMaxDepth / 10) * 20; // +20 XP за каждые 10 шагов глубины
  reward += depthBonus;
  
  return reward;
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
  rng: SeededRandom,
  graphMaxDepth: number
): GeneratedClue {
  const { coneDegrees, dwellTime } = calculateClueParams(spot.difficulty, graphMaxDepth);
  
  // Безопасное получение префикса panoId (для уникального ID улики)
  const panoIdPrefix = spot.panoId.slice(0, 8);
  
  return {
    id: `${theme}_clue_${index}_${panoIdPrefix}`,
    panoId: spot.panoId,
    revealHeading: round(spot.heading, HEADING_PRECISION),
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
      const availableThemes = getAllThemes().map(t => t.type).join(", ");
      return {
        success: false,
        error: `Неизвестная тема миссии: "${request.theme}". Доступные: ${availableThemes}`,
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // Проверяем граф — размер
    if (!graph.nodes || graph.nodes.size === 0) {
      return {
        success: false,
        error: "Граф панорам пуст. Сначала выполните сканирование.",
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    if (graph.nodes.size < MIN_GRAPH_NODES) {
      return {
        success: false,
        error: `Граф слишком маленький (${graph.nodes.size} узлов). ` +
               `Минимум ${MIN_GRAPH_NODES} узлов требуется. Увеличьте радиус сканирования.`,
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // Проверяем граф — глубина
    if (graph.maxDepth < MIN_GRAPH_DEPTH) {
      return {
        success: false,
        error: `Граф слишком мелкий (глубина ${graph.maxDepth} шагов). ` +
               `Минимум ${MIN_GRAPH_DEPTH} шага требуется. Увеличьте глубину сканирования.`,
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
    // АНАЛИЗ ГРАФА
    // ═══════════════════════════════════════════════════════════════════════
    
    const placementStats = getPlacementStats(graph);
    
    console.log(
      `[MissionGenerator] Анализ графа: ` +
      `${graph.nodes.size} узлов, глубина ${graph.maxDepth}, ` +
      `${placementStats.totalPotentialSpots} потенциальных точек ` +
      `(покрытие ${Math.round(placementStats.coverageRatio * 100)}%)`
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // ГЕНЕРАЦИЯ УЛИК
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1. Находим оптимальные точки для улик
    const spots = findOptimalClueSpots(graph, {
      clueCount,
      minDistanceBetweenClues: Math.max(3, Math.floor(graph.maxDepth * 0.08)),
      prioritizeDeadEnds: true,
    });
    
    if (spots.length < clueCount) {
      return {
        success: false,
        error: `Недостаточно интересных точек: найдено ${spots.length}, нужно ${clueCount}. ` +
               `Попробуйте увеличить глубину сканирования или выбрать другую локацию.`,
        generationTimeMs: Date.now() - startTime,
      };
    }
    
    // 2. Перемешиваем шаблоны для разнообразия (с seed)
    const shuffledTemplates = rng.shuffle([...theme.clueTemplates]);
    
    // 3. Генерируем улики
    const clues: GeneratedClue[] = spots.map((spot, index) => {
      const template = shuffledTemplates[index % shuffledTemplates.length];
      return generateClue(spot, index, template, request.theme, rng, graph.maxDepth);
    });
    
    // 4. Вычисляем параметры миссии на основе сложности
    const timeLimit = TIME_LIMIT_BY_DIFFICULTY[difficulty] || 600;
    const requiredCluesRatio = REQUIRED_CLUES_RATIO_BY_DIFFICULTY[difficulty] || 0.8;
    const requiredClues = Math.ceil(clueCount * requiredCluesRatio);
    const xpReward = calculateMissionReward(clues, difficulty, graph.maxDepth);
    
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
      xpReward,
      speedBonusPerSecond: 0.5,
      location: request.locationName || "Неизвестная локация",
      difficulty,
      icon: theme.icon,
      color: theme.color,
      generatedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      seed: actualSeed,
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
    
    const generationTimeMs = Date.now() - startTime;
    
    console.log(
      `[MissionGenerator] ✓ Миссия "${mission.title}" сгенерирована за ${generationTimeMs}ms: ` +
      `${clues.length} улик, награда ${xpReward} XP, лимит ${timeLimit}с, ` +
      `seed: ${actualSeed.slice(0, 12)}...`
    );
    
    return {
      success: true,
      mission,
      graph,
      spots,
      generationTimeMs,
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

export { getMissionTheme, getAllThemes, isValidTheme, getMaxClueCount };
export type { MissionTheme };
