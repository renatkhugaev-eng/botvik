/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE PLACEMENT ALGORITHM v3.0.0
 * Алгоритм автоматического размещения улик на графе панорам
 * 
 * Best Practices 2025:
 * - Адаптивные параметры относительно размера графа
 * - Корректная обработка углов (wrap-around)
 * - Улучшенное зональное распределение
 * - Документированные магические числа
 * 
 * Выбирает "интересные" точки:
 * - Тупики (отличные места для финальных улик)
 * - Перекрёстки (можно пропустить если не смотреть)
 * - Углы (спрятать за поворотом)
 * - Дальние точки (максимальная глубина)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  PanoNode,
  PanoramaGraph,
  ClueSpot,
  SpotType,
} from "@/types/panorama-graph";
import { averageHeading } from "./panorama-graph-builder";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (с обоснованием)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Минимальное расстояние между уликами (в шагах), чтобы они не были рядом
 * Значение 3 выбрано эмпирически: достаточно чтобы улики не были в соседних панорамах,
 * но не слишком большое для маленьких графов
 */
const DEFAULT_MIN_DISTANCE_BETWEEN_CLUES = 3;

/** 
 * Множитель дистанции для расчёта сложности
 * difficulty = ceil(distance / DIFFICULTY_DISTANCE_DIVISOR)
 * При divisor=8: 8 шагов = сложность 1, 16 = 2, 24 = 3 и т.д.
 */
const DIFFICULTY_DISTANCE_DIVISOR = 8;

/**
 * Минимальные глубины для разных типов точек (в % от maxDepth)
 * Используются относительные значения для адаптации к размеру графа
 */
const MIN_DEPTH_RATIO_BY_TYPE: Record<SpotType, number> = {
  dead_end: 0.08,      // 8% от maxDepth (минимум 2)
  corner: 0.10,        // 10% от maxDepth (минимум 3)
  intersection: 0.12,  // 12% от maxDepth (минимум 4)
  hidden_alley: 0.25,  // 25% от maxDepth — переулки глубже
  far_point: 0.80,     // 80% от maxDepth — дальние точки
};

/**
 * Абсолютные минимумы для типов (защита для маленьких графов)
 */
const MIN_DEPTH_ABSOLUTE: Record<SpotType, number> = {
  dead_end: 2,
  corner: 3,
  intersection: 4,
  hidden_alley: 6,
  far_point: 10,
};

/**
 * Бонусы к скору за тип точки (определяют приоритет)
 */
const SCORE_BONUS_BY_TYPE: Record<SpotType, number> = {
  dead_end: 40,      // Тупики — лучшие места (нужно специально идти)
  hidden_alley: 35,  // Переулки — тоже хорошо скрыты
  far_point: 30,     // Дальние точки — награда за исследование
  corner: 25,        // Углы — спрятаны за поворотом
  intersection: 15,  // Перекрёстки — легко пропустить, но и найти
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PlacementOptions {
  /** Количество улик для размещения */
  clueCount: number;
  /** Минимальная дистанция между уликами (шаги) */
  minDistanceBetweenClues?: number;
  /** Приоритизировать тупики (добавляет бонус к скору) */
  prioritizeDeadEnds?: boolean;
  /** Минимальная глубина для первой улики (по умолчанию адаптивная) */
  minFirstClueDepth?: number;
}

interface ScoredSpot {
  spot: ClueSpot;
  score: number;
}

/** Метрики размещения */
export interface PlacementMetrics {
  totalPotentialSpots: number;
  spotsByType: Record<SpotType, number>;
  selectedSpots: number;
  avgDifficulty: number;
  avgDistance: number;
  coverageRatio: number; // % графа покрытого уликами
}

// ═══════════════════════════════════════════════════════════════════════════
// ANGLE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Нормализовать угол в диапазон [0, 360)
 */
function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/**
 * Вычислить противоположное направление
 */
function oppositeHeading(heading: number): number {
  return normalizeHeading(heading + 180);
}

/**
 * Добавить смещение к углу
 */
function addHeading(heading: number, offset: number): number {
  return normalizeHeading(heading + offset);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTIVE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Вычислить адаптивную минимальную глубину для типа точки
 */
function getAdaptiveMinDepth(type: SpotType, graphMaxDepth: number): number {
  const ratio = MIN_DEPTH_RATIO_BY_TYPE[type];
  const absolute = MIN_DEPTH_ABSOLUTE[type];
  
  // Используем максимум из относительного и абсолютного значения
  return Math.max(absolute, Math.floor(graphMaxDepth * ratio));
}

/**
 * Вычислить адаптивную минимальную глубину для первой улики
 */
function getAdaptiveMinFirstClueDepth(graphMaxDepth: number): number {
  // 5% от глубины графа, минимум 2 шага
  return Math.max(2, Math.floor(graphMaxDepth * 0.05));
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Вычислить базовую сложность на основе дистанции и типа
 * Диапазон: 1-5
 */
function calculateDifficulty(distance: number, type: SpotType, graphMaxDepth: number): number {
  // Нормализованная дистанция (0-1)
  const normalizedDistance = graphMaxDepth > 0 ? distance / graphMaxDepth : 0;
  
  // Базовая сложность от дистанции (1-5)
  let baseDifficulty = Math.ceil(normalizedDistance * 5);
  baseDifficulty = Math.max(1, Math.min(5, baseDifficulty));
  
  // Модификаторы типа
  switch (type) {
    case "dead_end":
    case "hidden_alley":
      // Тупики и переулки сложнее — нужно специально искать
      baseDifficulty = Math.min(5, baseDifficulty + 1);
      break;
    case "intersection":
      // Перекрёстки чуть легче — много путей, легче наткнуться
      baseDifficulty = Math.max(1, baseDifficulty - 1);
      break;
    case "far_point":
      // Дальние точки всегда максимальной сложности
      baseDifficulty = 5;
      break;
    case "corner":
      // Углы — средняя сложность, без модификатора
      break;
  }
  
  return baseDifficulty;
}

/**
 * Вычислить оптимальное направление камеры для улики
 */
function calculateOptimalHeading(node: PanoNode): number {
  // Для тупиков — смотреть в противоположную сторону от входа
  // Игрок смотрит назад откуда пришёл, и там улика
  if (node.isDeadEnd && node.links.length === 1) {
    const entryHeading = node.links[0].heading;
    return oppositeHeading(entryHeading);
  }
  
  // Для перекрёстков — наименее очевидное направление
  // Находим самый большой промежуток между направлениями
  if (node.isIntersection && node.links.length >= 3) {
    const headings = node.links
      .map(l => normalizeHeading(l.heading))
      .sort((a, b) => a - b);
    
    let maxGap = 0;
    let gapMidpoint = 0;
    
    for (let i = 0; i < headings.length; i++) {
      const current = headings[i];
      const next = headings[(i + 1) % headings.length];
      
      // Вычисляем промежуток с учётом wrap-around
      let gap = next - current;
      if (gap <= 0) gap += 360;
      
      if (gap > maxGap) {
        maxGap = gap;
        // Середина промежутка
        gapMidpoint = normalizeHeading(current + gap / 2);
      }
    }
    
    return gapMidpoint;
  }
  
  // Для углов — перпендикулярно среднему направлению пути
  if (node.isCorner && node.links.length === 2) {
    const h1 = node.links[0].heading;
    const h2 = node.links[1].heading;
    // Используем корректное усреднение + 90 градусов
    return addHeading(averageHeading(h1, h2), 90);
  }
  
  // Для обычных узлов — направление в сторону с меньшим количеством связей
  if (node.links.length === 2) {
    // Улика между двумя направлениями (перпендикулярно пути)
    const h1 = node.links[0].heading;
    const h2 = node.links[1].heading;
    return addHeading(averageHeading(h1, h2), 90);
  }
  
  // По умолчанию — случайное направление (но детерминированное на основе panoId)
  const hash = node.panoId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (hash * 137) % 360; // Детерминированный "случайный" угол
}

/**
 * Получить описание причины выбора точки
 */
function getSpotReason(type: SpotType, distance: number, graphMaxDepth: number): string {
  const depthPercent = graphMaxDepth > 0 
    ? Math.round((distance / graphMaxDepth) * 100) 
    : 0;
    
  switch (type) {
    case "dead_end":
      return `Тупик на ${depthPercent}% глубины (${distance} шагов) — идеально для скрытой улики`;
    case "intersection":
      return `Перекрёсток на ${depthPercent}% глубины (${distance} шагов) — можно пропустить`;
    case "corner":
      return `Угол на ${depthPercent}% глубины (${distance} шагов) — спрятано за поворотом`;
    case "far_point":
      return `Дальняя точка (${distance} шагов, ${depthPercent}%) — сложно добраться`;
    case "hidden_alley":
      return `Переулок на ${depthPercent}% глубины (${distance} шагов) — малозаметный путь`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPOT FINDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Найти все потенциальные точки для улик
 */
export function findAllPotentialSpots(graph: PanoramaGraph): ClueSpot[] {
  // Защита от пустого графа
  if (!graph.nodes || graph.nodes.size === 0) {
    console.warn("[CluePlacement] Empty graph provided");
    return [];
  }
  
  const spots: ClueSpot[] = [];
  const { maxDepth } = graph;
  
  // Вычисляем пороги для far_point адаптивно
  const farPointThreshold = getAdaptiveMinDepth("far_point", maxDepth);
  
  graph.nodes.forEach(node => {
    // Пропускаем старт (улика не может быть в точке старта)
    if (node.distanceFromStart === 0) return;
    
    let type: SpotType | null = null;
    
    // Определяем тип точки по приоритету (от более ценных к менее)
    if (node.isDeadEnd && node.distanceFromStart >= getAdaptiveMinDepth("dead_end", maxDepth)) {
      type = "dead_end";
    } else if (node.isCorner && node.distanceFromStart >= getAdaptiveMinDepth("corner", maxDepth)) {
      type = "corner";
    } else if (node.isIntersection && node.distanceFromStart >= getAdaptiveMinDepth("intersection", maxDepth)) {
      type = "intersection";
    } else if (node.distanceFromStart >= farPointThreshold) {
      type = "far_point";
    } else if (node.links.length <= 2 && node.distanceFromStart >= getAdaptiveMinDepth("hidden_alley", maxDepth)) {
      type = "hidden_alley";
    }
    
    if (type) {
      const heading = calculateOptimalHeading(node);
      const difficulty = calculateDifficulty(node.distanceFromStart, type, maxDepth);
      
      spots.push({
        panoId: node.panoId,
        type,
        lat: node.lat,
        lng: node.lng,
        heading: Math.round(heading * 100) / 100, // Округляем до 2 знаков
        difficulty,
        distanceFromStart: node.distanceFromStart,
        description: node.description,
        reason: getSpotReason(type, node.distanceFromStart, maxDepth),
      });
    }
  });
  
  return spots;
}

/**
 * Оценить точку для ранжирования
 */
function scoreSpot(
  spot: ClueSpot, 
  graph: PanoramaGraph,
  prioritizeDeadEnds: boolean = false
): number {
  let score = 0;
  const { maxDepth } = graph;
  
  // Базовый балл от дистанции (нормализованный 0-30)
  // Чем дальше — тем лучше (награда за исследование)
  const normalizedDistance = maxDepth > 0 
    ? (spot.distanceFromStart / maxDepth) 
    : 0;
  score += normalizedDistance * 30;
  
  // Бонус за тип точки
  score += SCORE_BONUS_BY_TYPE[spot.type] || 0;
  
  // Дополнительный бонус за тупики если включён приоритет
  if (prioritizeDeadEnds && spot.type === "dead_end") {
    score += 20;
  }
  
  // Бонус за сложность (0-25)
  score += spot.difficulty * 5;
  
  // Небольшой бонус за "интересность" — если точка на перекрёстке с 4+ путями
  // или на дальнем тупике
  if (spot.type === "dead_end" && normalizedDistance > 0.6) {
    score += 10; // Дальние тупики особенно ценны
  }
  
  return Math.round(score * 10) / 10;
}

/**
 * Выбрать N лучших точек, распределённых по дистанции
 */
export function selectDistributedSpots(
  spots: ClueSpot[],
  count: number,
  graph: PanoramaGraph,
  options: PlacementOptions = { clueCount: count }
): ClueSpot[] {
  const {
    minDistanceBetweenClues = DEFAULT_MIN_DISTANCE_BETWEEN_CLUES,
    prioritizeDeadEnds = true,
    minFirstClueDepth,
  } = options;
  
  // Защита от пустого массива
  if (spots.length === 0) {
    console.warn("[CluePlacement] No spots provided for selection");
    return [];
  }
  
  // Если точек меньше или равно нужному количеству — возвращаем все
  if (spots.length <= count) {
    return [...spots].sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  }
  
  // Адаптивная минимальная глубина для первой улики
  const effectiveMinFirstClueDepth = minFirstClueDepth ?? 
    getAdaptiveMinFirstClueDepth(graph.maxDepth);
  
  // Оцениваем все точки с учётом фильтра по минимальной глубине
  const scored: ScoredSpot[] = spots
    .filter(s => s.distanceFromStart >= effectiveMinFirstClueDepth)
    .map(spot => ({
      spot,
      score: scoreSpot(spot, graph, prioritizeDeadEnds),
    }));
  
  // Если после фильтрации ничего не осталось — берём всё без фильтра
  if (scored.length === 0) {
    console.warn("[CluePlacement] No spots after depth filter, using all spots");
    return spots
      .slice(0, count)
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  }
  
  // Сортируем по баллу (лучшие первые)
  scored.sort((a, b) => b.score - a.score);
  
  // Вычисляем зоны для равномерного распределения
  const maxDist = Math.max(...spots.map(s => s.distanceFromStart));
  const zoneSize = Math.max(1, Math.ceil(maxDist / count));
  
  const selected: ClueSpot[] = [];
  const usedZones = new Set<number>();
  const usedPanoIds = new Set<string>();
  
  // Вспомогательная функция проверки минимальной дистанции
  const isTooClose = (spot: ClueSpot): boolean => {
    // Адаптивная минимальная дистанция на основе размера графа
    const adaptiveMinDistance = Math.max(
      minDistanceBetweenClues,
      Math.floor(graph.maxDepth * 0.05) // Минимум 5% от глубины
    );
    
    return selected.some(
      s => Math.abs(s.distanceFromStart - spot.distanceFromStart) < adaptiveMinDistance
    );
  };
  
  // Первый проход — по одной улике из каждой зоны (равномерное распределение)
  for (const { spot } of scored) {
    if (selected.length >= count) break;
    if (usedPanoIds.has(spot.panoId)) continue;
    
    const zone = Math.floor(spot.distanceFromStart / zoneSize);
    
    if (!usedZones.has(zone) && !isTooClose(spot)) {
      selected.push(spot);
      usedZones.add(zone);
      usedPanoIds.add(spot.panoId);
    }
  }
  
  // Второй проход — добираем лучшие с проверкой дистанции
  for (const { spot } of scored) {
    if (selected.length >= count) break;
    if (usedPanoIds.has(spot.panoId)) continue;
    
    if (!isTooClose(spot)) {
      selected.push(spot);
      usedPanoIds.add(spot.panoId);
    }
  }
  
  // Третий проход — если всё равно мало, добираем без проверки дистанции
  if (selected.length < count) {
    for (const { spot } of scored) {
      if (selected.length >= count) break;
      if (!usedPanoIds.has(spot.panoId)) {
        selected.push(spot);
        usedPanoIds.add(spot.panoId);
      }
    }
  }
  
  // Сортируем по дистанции (от близких к дальним — для нарастающей сложности)
  return selected.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Найти оптимальные точки для размещения улик
 */
export function findOptimalClueSpots(
  graph: PanoramaGraph,
  options: PlacementOptions
): ClueSpot[] {
  // Защита от пустого графа
  if (!graph.nodes || graph.nodes.size === 0) {
    console.error("[CluePlacement] Cannot find clue spots in empty graph");
    return [];
  }
  
  const startTime = Date.now();
  
  // 1. Находим все потенциальные точки
  const allSpots = findAllPotentialSpots(graph);
  
  console.log(
    `[CluePlacement] Анализ графа (${graph.nodes.size} узлов, глубина ${graph.maxDepth}):`
  );
  console.log(`  • Потенциальных точек: ${allSpots.length}`);
  console.log(`  • Тупиков: ${allSpots.filter(s => s.type === "dead_end").length}`);
  console.log(`  • Углов: ${allSpots.filter(s => s.type === "corner").length}`);
  console.log(`  • Перекрёстков: ${allSpots.filter(s => s.type === "intersection").length}`);
  console.log(`  • Дальних точек: ${allSpots.filter(s => s.type === "far_point").length}`);
  console.log(`  • Переулков: ${allSpots.filter(s => s.type === "hidden_alley").length}`);
  
  // 2. Выбираем N лучших с равномерным распределением
  const selected = selectDistributedSpots(
    allSpots,
    options.clueCount,
    graph,
    options
  );
  
  const timeMs = Date.now() - startTime;
  
  console.log(`[CluePlacement] Выбрано ${selected.length} точек за ${timeMs}ms:`);
  selected.forEach((spot, i) => {
    console.log(
      `  ${i + 1}. ${spot.type} на глубине ${spot.distanceFromStart} ` +
      `(${Math.round(spot.distanceFromStart / graph.maxDepth * 100)}%) ` +
      `сложность ${spot.difficulty}, heading ${spot.heading.toFixed(1)}°`
    );
  });
  
  return selected;
}

/**
 * Получить статистику по потенциальным точкам
 */
export function getPlacementStats(graph: PanoramaGraph): PlacementMetrics {
  const spots = findAllPotentialSpots(graph);
  
  const spotsByType: Record<SpotType, number> = {
    dead_end: 0,
    intersection: 0,
    corner: 0,
    far_point: 0,
    hidden_alley: 0,
  };
  
  let totalDifficulty = 0;
  let totalDistance = 0;
  
  spots.forEach(spot => {
    spotsByType[spot.type]++;
    totalDifficulty += spot.difficulty;
    totalDistance += spot.distanceFromStart;
  });
  
  return {
    totalPotentialSpots: spots.length,
    spotsByType,
    selectedSpots: 0, // Заполняется после selectDistributedSpots
    avgDifficulty: spots.length > 0 
      ? Math.round((totalDifficulty / spots.length) * 10) / 10 
      : 0,
    avgDistance: spots.length > 0 
      ? Math.round((totalDistance / spots.length) * 10) / 10 
      : 0,
    coverageRatio: graph.nodes.size > 0 
      ? Math.round((spots.length / graph.nodes.size) * 100) / 100 
      : 0,
  };
}
