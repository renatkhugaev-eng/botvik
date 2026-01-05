/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA GRAPH TYPES
 * Типы для автоматической генерации миссий через Google Street View API
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// GRAPH NODE & LINK
// ═══════════════════════════════════════════════════════════════════════════

/** Связь между панорамами (переход) */
export interface PanoLink {
  /** ID целевой панорамы */
  targetPanoId: string;
  /** Направление перехода (heading в градусах 0-360) */
  heading: number;
  /** Описание (название улицы и т.д.) */
  description?: string;
}

/** Узел графа — одна панорама */
export interface PanoNode {
  /** Уникальный ID панорамы Google Street View */
  panoId: string;
  /** Широта */
  lat: number;
  /** Долгота */
  lng: number;
  /** Связи — куда можно пойти */
  links: PanoLink[];
  /** Дистанция от старта (количество переходов) */
  distanceFromStart: number;
  /** Тупик? (только 1 выход) */
  isDeadEnd: boolean;
  /** Перекрёсток? (3+ выходов) */
  isIntersection: boolean;
  /** Угловой поворот? (резкий изгиб улицы) */
  isCorner: boolean;
  /** Описание локации */
  description?: string;
}

/** Граф панорам */
export interface PanoramaGraph {
  /** Все узлы (panoId -> PanoNode) */
  nodes: Map<string, PanoNode>;
  /** Стартовая панорама */
  startPanoId: string;
  /** Координаты старта */
  startCoordinates: [number, number];
  /** Максимальная глубина обхода */
  maxDepth: number;
  /** Статистика */
  stats: GraphStats;
}

/** Статистика графа */
export interface GraphStats {
  /** Всего узлов */
  totalNodes: number;
  /** Тупиков */
  deadEnds: number;
  /** Перекрёстков */
  intersections: number;
  /** Углов */
  corners: number;
  /** Максимальная глубина */
  maxDepth: number;
  /** Среднее количество связей */
  avgLinks: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE SPOT (ТОЧКА ДЛЯ УЛИКИ)
// ═══════════════════════════════════════════════════════════════════════════

/** Тип интересной точки */
export type SpotType = 
  | "dead_end"      // Тупик — идеально для финальных улик
  | "intersection"  // Перекрёсток — можно пропустить
  | "corner"        // Угол — спрятать за поворотом
  | "far_point"     // Дальняя точка — максимум шагов
  | "hidden_alley"; // Скрытый переулок

/** Интересная точка для размещения улики */
export interface ClueSpot {
  /** ID панорамы */
  panoId: string;
  /** Тип точки */
  type: SpotType;
  /** Координаты */
  lat: number;
  lng: number;
  /** Оптимальное направление камеры для обнаружения */
  heading: number;
  /** Сложность (1-5) */
  difficulty: number;
  /** Дистанция от старта (шаги) */
  distanceFromStart: number;
  /** Описание */
  description?: string;
  /** Почему эта точка хороша */
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MISSION THEME (ТЕМА МИССИИ)
// ═══════════════════════════════════════════════════════════════════════════

/** Доступные темы миссий */
export type MissionThemeType = 
  | "yakuza"       // Японская мафия
  | "spy"          // Шпионаж
  | "heist"        // Ограбление
  | "murder"       // Убийство
  | "smuggling"    // Контрабанда
  | "art_theft"    // Кража искусства
  | "kidnapping"   // Похищение
  | "corruption"   // Коррупция
  | "custom";      // Пользовательская

/** Конфигурация темы миссии */
export interface MissionTheme {
  type: MissionThemeType;
  title: string;
  description: string;
  briefing: string;
  icon: string;
  color: string;
  /** Шаблоны улик для этой темы */
  clueTemplates: ClueTemplate[];
}

/** Шаблон улики для генерации контента */
export interface ClueTemplate {
  /** Название шаблона */
  name: string;
  /** Иконка */
  icon: string;
  /** Шаблоны текста (с переменными {location}, {time} и т.д.) */
  nameTemplates: string[];
  /** Шаблоны story context */
  storyContextTemplates: string[];
  /** Шаблоны hint */
  hintTemplates: string[];
  /** Базовый XP */
  baseXp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION REQUEST & RESULT
// ═══════════════════════════════════════════════════════════════════════════

/** Запрос на генерацию миссии */
export interface MissionGenerationRequest {
  /** Координаты центра [lat, lng] */
  coordinates: [number, number];
  /** Тема миссии */
  theme: MissionThemeType;
  /** Количество улик (3-7) */
  clueCount: number;
  /** Максимальная глубина обхода (10-50) */
  maxDepth?: number;
  /** Максимальное количество узлов (50-300) */
  maxNodes?: number;
  /** Название локации (опционально, иначе определяется автоматически) */
  locationName?: string;
  /** Сложность */
  difficulty?: "easy" | "medium" | "hard" | "extreme";
}

/** Результат генерации */
export interface MissionGenerationResult {
  /** Успешно? */
  success: boolean;
  /** Сгенерированная миссия (если успешно) */
  mission?: GeneratedMission;
  /** Граф панорам (для предпросмотра) */
  graph?: PanoramaGraph;
  /** Выбранные точки для улик */
  spots?: ClueSpot[];
  /** Ошибка (если не успешно) */
  error?: string;
  /** Время генерации (мс) */
  generationTimeMs?: number;
}

/** Сгенерированная миссия */
export interface GeneratedMission {
  id: string;
  title: string;
  description: string;
  briefing: string;
  startCoordinates: [number, number];
  startPanoId: string;
  startHeading: number;
  allowNavigation: boolean;
  clues: GeneratedClue[];
  requiredClues: number;
  timeLimit: number;
  xpReward: number;
  speedBonusPerSecond: number;
  location: string;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  icon: string;
  color: string;
  /** Метаданные генерации */
  generatedAt: string;
  generatorVersion: string;
}

/** Сгенерированная улика */
export interface GeneratedClue {
  id: string;
  panoId: string;
  revealHeading: number;
  coneDegrees: number;
  dwellTime: number;
  name: string;
  description?: string;
  icon: string;
  storyContext: string;
  xpReward: number;
  hintText: string;
  scannerHint: string;
  /** Метаданные */
  spotType: SpotType;
  distanceFromStart: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE STREET VIEW API TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Ответ Google Street View Metadata API */
export interface StreetViewMetadataResponse {
  status: "OK" | "ZERO_RESULTS" | "NOT_FOUND" | "OVER_QUERY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | "UNKNOWN_ERROR";
  pano_id?: string;
  location?: {
    lat: number;
    lng: number;
  };
  copyright?: string;
  date?: string;
}

/** Ссылка на соседнюю панораму (из JavaScript API) */
export interface StreetViewLink {
  pano: string;
  heading: number;
  description?: string;
}

/** Данные панорамы (из JavaScript API) */
export interface StreetViewPanoramaData {
  location: {
    pano: string;
    latLng: {
      lat: () => number;
      lng: () => number;
    };
    description?: string;
  };
  links: StreetViewLink[];
  tiles: {
    worldSize: { width: number; height: number };
    tileSize: { width: number; height: number };
  };
  copyright?: string;
}

