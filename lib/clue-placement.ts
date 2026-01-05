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
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  PanoNode,
  PanoramaGraph,
  ClueSpot,
  SpotType,
} from "@/types/panorama-graph";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PlacementOptions {
  /** Количество улик для размещения */
  clueCount: number;
  /** Минимальная дистанция между уликами (шаги) */
  minDistanceBetweenClues?: number;
  /** Приоритизировать тупики */
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
 */
function calculateDifficulty(distance: number, type: SpotType): number {
  // Базовая сложность от дистанции (1-5)
  let baseDifficulty = Math.min(5, Math.ceil(distance / 8));
  
  // Модификаторы типа
  switch (type) {
    case "dead_end":
      baseDifficulty = Math.min(5, baseDifficulty + 1);
      break;
    case "hidden_alley":
      baseDifficulty = Math.min(5, baseDifficulty + 1);
      break;
    case "intersection":
      // Перекрёстки чуть легче — много путей
      baseDifficulty = Math.max(1, baseDifficulty - 1);
      break;
    case "corner":
      // Углы — средняя сложность
      break;
    case "far_point":
      baseDifficulty = 5;
      break;
  }
  
  return baseDifficulty;
}

/**
 * Вычислить оптимальное направление камеры для улики
 */
function calculateOptimalHeading(node: PanoNode): number {
  // Для тупиков — смотреть в противоположную сторону от входа
  if (node.isDeadEnd && node.links.length === 1) {
    const entryHeading = node.links[0].heading;
    return (entryHeading + 180) % 360;
  }
  
  // Для перекрёстков — наименее очевидное направление
  // (не по основному пути)
  if (node.isIntersection && node.links.length >= 3) {
    const headings = node.links.map(l => l.heading);
    // Найти направление между двумя самыми близкими
    headings.sort((a, b) => a - b);
    
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
  
  // Для углов — в сторону поворота
  if (node.isCorner && node.links.length === 2) {
    // Среднее направление
    const h1 = node.links[0].heading;
    const h2 = node.links[1].heading;
    return ((h1 + h2) / 2 + 90) % 360; // Перпендикулярно основному пути
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
  const spots: ClueSpot[] = [];
  
  graph.nodes.forEach(node => {
    // Пропускаем старт
    if (node.distanceFromStart === 0) return;
    
    let type: SpotType | null = null;
    
    // Тупики — отличные места!
    if (node.isDeadEnd && node.distanceFromStart >= 3) {
      type = "dead_end";
    }
    // Перекрёстки — можно пропустить
    else if (node.isIntersection && node.distanceFromStart >= 5) {
      type = "intersection";
    }
    // Углы — спрятать за поворотом
    else if (node.isCorner && node.distanceFromStart >= 4) {
      type = "corner";
    }
    // Дальние точки
    else if (node.distanceFromStart >= graph.maxDepth * 0.8) {
      type = "far_point";
    }
    // Переулки — мало связей на глубине
    else if (node.links.length <= 2 && node.distanceFromStart >= 10) {
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
function scoreSpot(spot: ClueSpot, graph: PanoramaGraph): number {
  let score = 0;
  
  // Базовый балл от дистанции (нормализованный)
  score += (spot.distanceFromStart / graph.maxDepth) * 30;
  
  // Бонус за тип
  switch (spot.type) {
    case "dead_end":
      score += 40; // Тупики — лучшие места
      break;
    case "hidden_alley":
      score += 35;
      break;
    case "corner":
      score += 25;
      break;
    case "far_point":
      score += 30;
      break;
    case "intersection":
      score += 15;
      break;
  }
  
  // Бонус за сложность
  score += spot.difficulty * 5;
  
  return score;
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
    minDistanceBetweenClues = 3,
    prioritizeDeadEnds = true,
    minFirstClueDepth = 2,
  } = options;
  
  if (spots.length === 0) return [];
  if (spots.length <= count) return spots;
  
  // Оцениваем все точки
  const scored: ScoredSpot[] = spots
    .filter(s => s.distanceFromStart >= minFirstClueDepth)
    .map(spot => ({
      spot,
      score: scoreSpot(spot, graph),
    }));
  
  // Сортируем по баллу
  scored.sort((a, b) => b.score - a.score);
  
  // Группируем по "зонам дистанции" для равномерного распределения
  const maxDist = Math.max(...spots.map(s => s.distanceFromStart));
  const zoneSize = Math.ceil(maxDist / count);
  
  const selected: ClueSpot[] = [];
  const zones: Set<number> = new Set();
  
  // Первый проход — по одной улике из каждой зоны
  for (const { spot } of scored) {
    const zone = Math.floor(spot.distanceFromStart / zoneSize);
    
    if (!zones.has(zone) && selected.length < count) {
      // Проверяем минимальную дистанцию до уже выбранных
      const tooClose = selected.some(
        s => Math.abs(s.distanceFromStart - spot.distanceFromStart) < minDistanceBetweenClues
      );
      
      if (!tooClose) {
        selected.push(spot);
        zones.add(zone);
      }
    }
  }
  
  // Второй проход — добираем если нужно
  if (selected.length < count) {
    for (const { spot } of scored) {
      if (selected.length >= count) break;
      if (selected.some(s => s.panoId === spot.panoId)) continue;
      
      const tooClose = selected.some(
        s => Math.abs(s.distanceFromStart - spot.distanceFromStart) < minDistanceBetweenClues
      );
      
      if (!tooClose) {
        selected.push(spot);
      }
    }
  }
  
  // Если всё равно мало — добираем без проверки дистанции
  if (selected.length < count) {
    for (const { spot } of scored) {
      if (selected.length >= count) break;
      if (!selected.some(s => s.panoId === spot.panoId)) {
        selected.push(spot);
      }
    }
  }
  
  // Сортируем по дистанции (от близких к дальним)
  selected.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  
  return selected;
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
  // 1. Находим все потенциальные точки
  const allSpots = findAllPotentialSpots(graph);
  
  console.log(`[CluePlacement] Найдено ${allSpots.length} потенциальных точек`);
  console.log(`[CluePlacement] Тупиков: ${allSpots.filter(s => s.type === "dead_end").length}`);
  console.log(`[CluePlacement] Перекрёстков: ${allSpots.filter(s => s.type === "intersection").length}`);
  console.log(`[CluePlacement] Углов: ${allSpots.filter(s => s.type === "corner").length}`);
  
  // 2. Выбираем N лучших с равномерным распределением
  const selected = selectDistributedSpots(
    allSpots,
    options.clueCount,
    graph,
    options
  );
  
  console.log(`[CluePlacement] Выбрано ${selected.length} точек для улик`);
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
    avgDifficulty: spots.length > 0 ? totalDifficulty / spots.length : 0,
    maxDistance,
  };
}

