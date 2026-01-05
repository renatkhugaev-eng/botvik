/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE PLACEMENT ALGORITHM
 * Алгоритм автоматического размещения улик на графе панорам
 * 
 * Выбирает "интересные" точки:
 * - Тупики (отличные места для финальных улик)
 * - Перекрёстки (можно пропустить если не смотреть)
 * - Углы (спрятать за поворотом)
 * - Дальние точки (максимальная глубина)
 * 
 * v2.0.0 - Исправлено:
 * - prioritizeDeadEnds теперь используется
 * - Защита от пустого графа
 * - Улучшенная документация магических чисел
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  PanoNode,
  PanoramaGraph,
  ClueSpot,
  SpotType,
} from "@/types/panorama-graph";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (с обоснованием)
// ═══════════════════════════════════════════════════════════════════════════

/** Минимальная глубина для первой улики (чтобы не спавнить у старта) */
const DEFAULT_MIN_FIRST_CLUE_DEPTH = 2;

/** Минимальное расстояние между уликами (в шагах), чтобы они не были рядом */
const DEFAULT_MIN_DISTANCE_BETWEEN_CLUES = 3;

/** 
 * Множитель дистанции для расчёта сложности
 * difficulty = ceil(distance / DIFFICULTY_DISTANCE_DIVISOR)
 * При divisor=8: 8 шагов = сложность 1, 16 = 2, 24 = 3 и т.д.
 */
const DIFFICULTY_DISTANCE_DIVISOR = 8;

/**
 * Минимальная глубина для разных типов точек
 * Тупики ценнее, можно ближе к старту
 */
const MIN_DEPTH_BY_TYPE: Record<SpotType, number> = {
  dead_end: 3,      // Тупики на 3+ шагах
  corner: 4,        // Углы на 4+ шагах
  intersection: 5,  // Перекрёстки на 5+ шагах
  hidden_alley: 10, // Переулки глубже
  far_point: 0,     // Определяется динамически
};

/**
 * Бонусы к скору за тип точки
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
  /** Минимальная глубина для первой улики */
  minFirstClueDepth?: number;
}

interface ScoredSpot {
  spot: ClueSpot;
  score: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Вычислить базовую сложность на основе дистанции и типа
 * Диапазон: 1-5
 */
function calculateDifficulty(distance: number, type: SpotType): number {
  // Базовая сложность от дистанции (1-5)
  let baseDifficulty = Math.min(5, Math.ceil(distance / DIFFICULTY_DISTANCE_DIVISOR));
  
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
    return (entryHeading + 180) % 360;
  }
  
  // Для перекрёстков — наименее очевидное направление
  // Находим самый большой промежуток между направлениями
  if (node.isIntersection && node.links.length >= 3) {
    const headings = node.links.map(l => l.heading).sort((a, b) => a - b);
    
    let maxGap = 0;
    let gapMidpoint = 0;
    
    for (let i = 0; i < headings.length; i++) {
      const next = (i + 1) % headings.length;
      let gap = headings[next] - headings[i];
      if (gap < 0) gap += 360;
      
      if (gap > maxGap) {
        maxGap = gap;
        gapMidpoint = (headings[i] + gap / 2) % 360;
      }
    }
    
    return gapMidpoint;
  }
  
  // Для углов — перпендикулярно основному пути
  if (node.isCorner && node.links.length === 2) {
    const h1 = node.links[0].heading;
    const h2 = node.links[1].heading;
    // Среднее направление + 90 градусов
    return ((h1 + h2) / 2 + 90) % 360;
  }
  
  // По умолчанию — случайное направление
  return Math.random() * 360;
}

/**
 * Получить описание причины выбора точки
 */
function getSpotReason(type: SpotType, distance: number): string {
  switch (type) {
    case "dead_end":
      return `Тупик на глубине ${distance} — идеально для скрытой улики`;
    case "intersection":
      return `Перекрёсток на глубине ${distance} — можно пропустить`;
    case "corner":
      return `Угол на глубине ${distance} — спрятано за поворотом`;
    case "far_point":
      return `Дальняя точка (${distance} шагов) — сложно добраться`;
    case "hidden_alley":
      return `Переулок на глубине ${distance} — малозаметный путь`;
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
  const farPointThreshold = Math.max(1, graph.maxDepth * 0.8);
  
  graph.nodes.forEach(node => {
    // Пропускаем старт
    if (node.distanceFromStart === 0) return;
    
    let type: SpotType | null = null;
    
    // Определяем тип точки по приоритету
    if (node.isDeadEnd && node.distanceFromStart >= MIN_DEPTH_BY_TYPE.dead_end) {
      type = "dead_end";
    } else if (node.isCorner && node.distanceFromStart >= MIN_DEPTH_BY_TYPE.corner) {
      type = "corner";
    } else if (node.isIntersection && node.distanceFromStart >= MIN_DEPTH_BY_TYPE.intersection) {
      type = "intersection";
    } else if (node.distanceFromStart >= farPointThreshold) {
      type = "far_point";
    } else if (node.links.length <= 2 && node.distanceFromStart >= MIN_DEPTH_BY_TYPE.hidden_alley) {
      type = "hidden_alley";
    }
    
    if (type) {
      spots.push({
        panoId: node.panoId,
        type,
        lat: node.lat,
        lng: node.lng,
        heading: calculateOptimalHeading(node),
        difficulty: calculateDifficulty(node.distanceFromStart, type),
        distanceFromStart: node.distanceFromStart,
        description: node.description,
        reason: getSpotReason(type, node.distanceFromStart),
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
  
  // Базовый балл от дистанции (нормализованный 0-30)
  const normalizedDistance = graph.maxDepth > 0 
    ? (spot.distanceFromStart / graph.maxDepth) 
    : 0;
  score += normalizedDistance * 30;
  
  // Бонус за тип
  score += SCORE_BONUS_BY_TYPE[spot.type] || 0;
  
  // Дополнительный бонус за тупики если включён приоритет
  if (prioritizeDeadEnds && spot.type === "dead_end") {
    score += 20;
  }
  
  // Бонус за сложность (0-25)
  score += spot.difficulty * 5;
  
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
    minFirstClueDepth = DEFAULT_MIN_FIRST_CLUE_DEPTH,
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
  
  // Оцениваем все точки с учётом фильтра по минимальной глубине
  const scored: ScoredSpot[] = spots
    .filter(s => s.distanceFromStart >= minFirstClueDepth)
    .map(spot => ({
      spot,
      score: scoreSpot(spot, graph, prioritizeDeadEnds),
    }));
  
  // Если после фильтрации ничего не осталось — берём всё без фильтра
  if (scored.length === 0) {
    console.warn("[CluePlacement] No spots after depth filter, using all");
    return spots
      .slice(0, count)
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  }
  
  // Сортируем по баллу (лучшие первые)
  scored.sort((a, b) => b.score - a.score);
  
  // Группируем по "зонам дистанции" для равномерного распределения
  const maxDist = Math.max(...spots.map(s => s.distanceFromStart));
  const zoneSize = Math.max(1, Math.ceil(maxDist / count));
  
  const selected: ClueSpot[] = [];
  const usedZones = new Set<number>();
  const usedPanoIds = new Set<string>();
  
  // Вспомогательная функция проверки минимальной дистанции
  const isTooClose = (spot: ClueSpot): boolean => {
    return selected.some(
      s => Math.abs(s.distanceFromStart - spot.distanceFromStart) < minDistanceBetweenClues
    );
  };
  
  // Первый проход — по одной улике из каждой зоны
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
  
  // Сортируем по дистанции (от близких к дальним)
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
  
  // 1. Находим все потенциальные точки
  const allSpots = findAllPotentialSpots(graph);
  
  console.log(`[CluePlacement] Найдено ${allSpots.length} потенциальных точек`);
  console.log(`[CluePlacement] Тупиков: ${allSpots.filter(s => s.type === "dead_end").length}`);
  console.log(`[CluePlacement] Углов: ${allSpots.filter(s => s.type === "corner").length}`);
  console.log(`[CluePlacement] Перекрёстков: ${allSpots.filter(s => s.type === "intersection").length}`);
  console.log(`[CluePlacement] Дальних точек: ${allSpots.filter(s => s.type === "far_point").length}`);
  console.log(`[CluePlacement] Переулков: ${allSpots.filter(s => s.type === "hidden_alley").length}`);
  
  // 2. Выбираем N лучших с равномерным распределением
  const selected = selectDistributedSpots(
    allSpots,
    options.clueCount,
    graph,
    options
  );
  
  console.log(`[CluePlacement] Выбрано ${selected.length} точек для улик:`);
  selected.forEach((spot, i) => {
    console.log(`  ${i + 1}. ${spot.type} на глубине ${spot.distanceFromStart} (сложность ${spot.difficulty})`);
  });
  
  return selected;
}

/**
 * Получить статистику по потенциальным точкам
 */
export function getPlacementStats(graph: PanoramaGraph): {
  totalSpots: number;
  byType: Record<SpotType, number>;
  avgDifficulty: number;
  maxDistance: number;
} {
  const spots = findAllPotentialSpots(graph);
  
  const byType: Record<SpotType, number> = {
    dead_end: 0,
    intersection: 0,
    corner: 0,
    far_point: 0,
    hidden_alley: 0,
  };
  
  let totalDifficulty = 0;
  let maxDistance = 0;
  
  spots.forEach(spot => {
    byType[spot.type]++;
    totalDifficulty += spot.difficulty;
    maxDistance = Math.max(maxDistance, spot.distanceFromStart);
  });
  
  return {
    totalSpots: spots.length,
    byType,
    avgDifficulty: spots.length > 0 
      ? Math.round((totalDifficulty / spots.length) * 10) / 10 
      : 0,
    maxDistance,
  };
}
