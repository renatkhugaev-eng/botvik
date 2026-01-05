/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA GRAPH BUILDER
 * Сервис для построения графа панорам через Google Street View API
 * 
 * Используется на клиенте (браузере) через Google Maps JavaScript API
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

import type {
  PanoNode,
  PanoLink,
  PanoramaGraph,
  GraphStats,
  StreetViewPanoramaData,
} from "@/types/panorama-graph";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BuildGraphOptions {
  /** Максимальная глубина обхода (шагов от старта) */
  maxDepth?: number;
  /** Максимальное количество узлов */
  maxNodes?: number;
  /** Таймаут на один запрос (мс) */
  requestTimeout?: number;
  /** Задержка между запросами (мс) — для rate limiting */
  requestDelay?: number;
  /** Callback для прогресса */
  onProgress?: (current: number, total: number, message: string) => void;
}

interface QueueItem {
  panoId: string;
  depth: number;
  parentHeading?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE STREET VIEW SERVICE
// ═══════════════════════════════════════════════════════════════════════════

let streetViewService: any = null;

/**
 * Инициализировать Google Street View Service
 * Должен вызываться после загрузки Google Maps API
 */
export function initStreetViewService(): any {
  if (!streetViewService) {
    if (typeof google === "undefined" || !google.maps) {
      throw new Error("Google Maps API не загружен");
    }
    streetViewService = new google.maps.StreetViewService();
  }
  return streetViewService;
}

/**
 * Получить панораму по координатам
 */
export async function getPanoramaByLocation(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<StreetViewPanoramaData | null> {
  const service = initStreetViewService();
  
  return new Promise((resolve) => {
    service.getPanorama(
      {
        location: { lat, lng },
        radius,
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data: any, status: any) => {
        if (status === google.maps.StreetViewStatus.OK && data) {
          resolve({
            location: {
              pano: data.location?.pano || "",
              latLng: {
                lat: () => data.location?.latLng?.lat() || lat,
                lng: () => data.location?.latLng?.lng() || lng,
              },
              description: data.location?.description,
            },
            links: data.links?.map((link: any) => ({
              pano: link.pano || "",
              heading: link.heading || 0,
              description: link.description,
            })) || [],
            tiles: {
              worldSize: { width: 0, height: 0 },
              tileSize: { width: 0, height: 0 },
            },
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Получить панораму по ID
 */
export async function getPanoramaById(
  panoId: string
): Promise<StreetViewPanoramaData | null> {
  const service = initStreetViewService();
  
  return new Promise((resolve) => {
    service.getPanorama(
      { pano: panoId },
      (data: any, status: any) => {
        if (status === google.maps.StreetViewStatus.OK && data) {
          resolve({
            location: {
              pano: data.location?.pano || panoId,
              latLng: {
                lat: () => data.location?.latLng?.lat() || 0,
                lng: () => data.location?.latLng?.lng() || 0,
              },
              description: data.location?.description,
            },
            links: data.links?.map((link: any) => ({
              pano: link.pano || "",
              heading: link.heading || 0,
              description: link.description,
            })) || [],
            tiles: {
              worldSize: { width: 0, height: 0 },
              tileSize: { width: 0, height: 0 },
            },
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAPH BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Задержка
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Определить тип узла (тупик, перекрёсток, угол)
 */
function analyzeNode(
  links: PanoLink[],
  parentHeading?: number
): { isDeadEnd: boolean; isIntersection: boolean; isCorner: boolean } {
  const isDeadEnd = links.length === 1;
  const isIntersection = links.length >= 3;
  
  // Угол — если направление резко меняется (>60 градусов)
  let isCorner = false;
  if (parentHeading !== undefined && links.length === 2) {
    const headings = links.map(l => l.heading);
    const diff1 = Math.abs(headings[0] - parentHeading);
    const diff2 = Math.abs(headings[1] - parentHeading);
    const minDiff = Math.min(diff1, 360 - diff1, diff2, 360 - diff2);
    isCorner = minDiff > 60;
  }
  
  return { isDeadEnd, isIntersection, isCorner };
}

/**
 * Построить граф панорам
 * 
 * Использует BFS (обход в ширину) для исследования территории
 * начиная с заданных координат.
 */
export async function buildPanoramaGraph(
  startCoordinates: [number, number],
  options: BuildGraphOptions = {}
): Promise<PanoramaGraph> {
  const {
    maxDepth = 40,
    maxNodes = 200,
    requestTimeout = 5000,
    requestDelay = 100,
    onProgress,
  } = options;
  
  const nodes = new Map<string, PanoNode>();
  const queue: QueueItem[] = [];
  const visited = new Set<string>();
  
  // 1. Получить стартовую панораму
  onProgress?.(0, maxNodes, "Ищем стартовую панораму...");
  
  const startPano = await getPanoramaByLocation(
    startCoordinates[0],
    startCoordinates[1]
  );
  
  if (!startPano) {
    throw new Error("Не удалось найти Street View в этой локации");
  }
  
  const startPanoId = startPano.location.pano;
  queue.push({ panoId: startPanoId, depth: 0 });
  
  // 2. BFS обход
  let processed = 0;
  let actualMaxDepth = 0;
  
  while (queue.length > 0 && nodes.size < maxNodes) {
    const { panoId, depth, parentHeading } = queue.shift()!;
    
    // Пропускаем если уже посетили или превысили глубину
    if (visited.has(panoId) || depth > maxDepth) {
      continue;
    }
    
    visited.add(panoId);
    
    // Получаем данные панорамы
    const panoData = await Promise.race([
      getPanoramaById(panoId),
      delay(requestTimeout).then(() => null),
    ]) as StreetViewPanoramaData | null;
    
    if (!panoData) {
      continue;
    }
    
    // Конвертируем ссылки
    const links: PanoLink[] = panoData.links.map(link => ({
      targetPanoId: link.pano,
      heading: link.heading,
      description: link.description,
    }));
    
    // Анализируем узел
    const { isDeadEnd, isIntersection, isCorner } = analyzeNode(links, parentHeading);
    
    // Сохраняем узел
    const node: PanoNode = {
      panoId,
      lat: panoData.location.latLng.lat(),
      lng: panoData.location.latLng.lng(),
      links,
      distanceFromStart: depth,
      isDeadEnd,
      isIntersection,
      isCorner,
      description: panoData.location.description,
    };
    
    nodes.set(panoId, node);
    processed++;
    actualMaxDepth = Math.max(actualMaxDepth, depth);
    
    // Отчёт о прогрессе
    onProgress?.(
      nodes.size,
      maxNodes,
      `Сканируем... ${nodes.size} панорам (глубина ${depth})`
    );
    
    // Добавляем соседей в очередь
    for (const link of links) {
      if (!visited.has(link.targetPanoId)) {
        queue.push({
          panoId: link.targetPanoId,
          depth: depth + 1,
          parentHeading: link.heading,
        });
      }
    }
    
    // Rate limiting
    if (requestDelay > 0) {
      await delay(requestDelay);
    }
  }
  
  // 3. Вычисляем статистику
  const stats: GraphStats = calculateGraphStats(nodes, actualMaxDepth);
  
  onProgress?.(nodes.size, nodes.size, `Готово! ${nodes.size} панорам`);
  
  return {
    nodes,
    startPanoId,
    startCoordinates,
    maxDepth: actualMaxDepth,
    stats,
  };
}

/**
 * Вычислить статистику графа
 */
function calculateGraphStats(
  nodes: Map<string, PanoNode>,
  maxDepth: number
): GraphStats {
  let deadEnds = 0;
  let intersections = 0;
  let corners = 0;
  let totalLinks = 0;
  
  nodes.forEach(node => {
    if (node.isDeadEnd) deadEnds++;
    if (node.isIntersection) intersections++;
    if (node.isCorner) corners++;
    totalLinks += node.links.length;
  });
  
  return {
    totalNodes: nodes.size,
    deadEnds,
    intersections,
    corners,
    maxDepth,
    avgLinks: nodes.size > 0 ? totalLinks / nodes.size : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Сериализовать граф в JSON
 */
export function serializeGraph(graph: PanoramaGraph): string {
  return JSON.stringify({
    ...graph,
    nodes: Array.from(graph.nodes.entries()),
  });
}

/**
 * Десериализовать граф из JSON
 */
export function deserializeGraph(json: string): PanoramaGraph {
  const data = JSON.parse(json);
  return {
    ...data,
    nodes: new Map(data.nodes),
  };
}

/**
 * Конвертировать граф в формат для отправки на сервер
 */
export function graphToSerializable(graph: PanoramaGraph): {
  nodes: [string, PanoNode][];
  startPanoId: string;
  startCoordinates: [number, number];
  maxDepth: number;
  stats: GraphStats;
} {
  return {
    nodes: Array.from(graph.nodes.entries()),
    startPanoId: graph.startPanoId,
    startCoordinates: graph.startCoordinates,
    maxDepth: graph.maxDepth,
    stats: graph.stats,
  };
}

/**
 * Восстановить граф из серверного формата
 */
export function graphFromSerializable(data: {
  nodes: [string, PanoNode][];
  startPanoId: string;
  startCoordinates: [number, number];
  maxDepth: number;
  stats: GraphStats;
}): PanoramaGraph {
  return {
    nodes: new Map(data.nodes),
    startPanoId: data.startPanoId,
    startCoordinates: data.startCoordinates,
    maxDepth: data.maxDepth,
    stats: data.stats,
  };
}

