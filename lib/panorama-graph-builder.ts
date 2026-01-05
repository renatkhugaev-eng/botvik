/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA GRAPH BUILDER
 * Сервис для построения графа панорам через Google Street View API
 * 
 * Используется на клиенте (браузере) через Google Maps JavaScript API
 * 
 * v2.0.0 - Добавлены:
 * - AbortController для отмены
 * - Улучшенный rate limiting
 * - Валидация panoId
 * - Retry логика
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
  /** AbortSignal для отмены операции */
  signal?: AbortSignal;
}

interface QueueItem {
  panoId: string;
  depth: number;
  parentHeading?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Минимальная задержка между запросами к API (Google рекомендует ~200ms) */
const MIN_REQUEST_DELAY_MS = 200;

/** Максимальное количество повторных попыток */
const MAX_RETRIES = 2;

/** Задержка перед повторной попыткой */
const RETRY_DELAY_MS = 500;

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE STREET VIEW SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать новый экземпляр Street View Service
 * Не используем глобальное состояние для избежания race conditions
 */
function createStreetViewService(): any {
  if (typeof google === "undefined" || !google.maps) {
    throw new Error("Google Maps API не загружен");
  }
  return new google.maps.StreetViewService();
}

/**
 * Получить панораму по координатам
 */
export async function getPanoramaByLocation(
  lat: number,
  lng: number,
  radius: number = 50,
  signal?: AbortSignal
): Promise<StreetViewPanoramaData | null> {
  const service = createStreetViewService();
  
  return new Promise((resolve, reject) => {
    // Проверяем отмену
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    
    // Слушаем отмену
    const abortHandler = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abortHandler, { once: true });
    
    service.getPanorama(
      {
        location: { lat, lng },
        radius,
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data: any, status: any) => {
        signal?.removeEventListener("abort", abortHandler);
        
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
 * Получить панораму по ID с retry логикой
 */
export async function getPanoramaById(
  panoId: string,
  signal?: AbortSignal,
  retries: number = MAX_RETRIES
): Promise<StreetViewPanoramaData | null> {
  // Валидация panoId
  if (!panoId || panoId.trim().length === 0) {
    console.warn("[GraphBuilder] Empty panoId provided");
    return null;
  }
  
  const service = createStreetViewService();
  
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    
    const abortHandler = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abortHandler, { once: true });
    
    service.getPanorama(
      { pano: panoId },
      async (data: any, status: any) => {
        signal?.removeEventListener("abort", abortHandler);
        
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
        } else if (status === google.maps.StreetViewStatus.UNKNOWN_ERROR && retries > 0) {
          // Retry на неизвестные ошибки
          await delay(RETRY_DELAY_MS);
          try {
            const result = await getPanoramaById(panoId, signal, retries - 1);
            resolve(result);
          } catch (e) {
            reject(e);
          }
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
 * Задержка с поддержкой отмены
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    const abortHandler = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };
    
    signal?.addEventListener("abort", abortHandler, { once: true });
  });
}

/**
 * Определить тип узла (тупик, перекрёсток, угол)
 */
function analyzeNode(
  links: PanoLink[],
  parentHeading?: number
): { isDeadEnd: boolean; isIntersection: boolean; isCorner: boolean } {
  const isDeadEnd = links.length <= 1;
  const isIntersection = links.length >= 3;
  
  // Угол — если направление резко меняется (>60 градусов)
  let isCorner = false;
  if (parentHeading !== undefined && links.length === 2) {
    const headings = links.map(l => l.heading);
    const diff1 = Math.abs(headings[0] - parentHeading);
    const diff2 = Math.abs(headings[1] - parentHeading);
    const normalizedDiff1 = Math.min(diff1, 360 - diff1);
    const normalizedDiff2 = Math.min(diff2, 360 - diff2);
    const minDiff = Math.min(normalizedDiff1, normalizedDiff2);
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
    requestDelay = MIN_REQUEST_DELAY_MS,
    onProgress,
    signal,
  } = options;
  
  // Используем минимальную безопасную задержку
  const safeDelay = Math.max(requestDelay, MIN_REQUEST_DELAY_MS);
  
  const nodes = new Map<string, PanoNode>();
  const queue: QueueItem[] = [];
  const visited = new Set<string>();
  
  // Проверяем отмену в начале
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  
  // 1. Получить стартовую панораму
  onProgress?.(0, maxNodes, "Ищем стартовую панораму...");
  
  const startPano = await getPanoramaByLocation(
    startCoordinates[0],
    startCoordinates[1],
    100, // Увеличенный радиус для лучшего поиска
    signal
  );
  
  if (!startPano || !startPano.location.pano) {
    throw new Error("Не удалось найти Street View в этой локации");
  }
  
  const startPanoId = startPano.location.pano;
  queue.push({ panoId: startPanoId, depth: 0 });
  
  // 2. BFS обход
  let actualMaxDepth = 0;
  
  while (queue.length > 0 && nodes.size < maxNodes) {
    // Проверяем отмену
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    
    const { panoId, depth, parentHeading } = queue.shift()!;
    
    // Пропускаем если уже посетили или превысили глубину
    if (visited.has(panoId) || depth > maxDepth) {
      continue;
    }
    
    // Валидация panoId
    if (!panoId || panoId.trim().length === 0) {
      continue;
    }
    
    visited.add(panoId);
    
    // Получаем данные панорамы с таймаутом
    let panoData: StreetViewPanoramaData | null = null;
    
    try {
      panoData = await Promise.race([
        getPanoramaById(panoId, signal),
        delay(requestTimeout, signal).then(() => null),
      ]) as StreetViewPanoramaData | null;
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        throw e;
      }
      // Игнорируем другие ошибки и продолжаем
      continue;
    }
    
    if (!panoData) {
      continue;
    }
    
    // Фильтруем и конвертируем ссылки (удаляем пустые panoId)
    const links: PanoLink[] = panoData.links
      .filter(link => link.pano && link.pano.trim().length > 0)
      .map(link => ({
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
    if (safeDelay > 0 && queue.length > 0) {
      await delay(safeDelay, signal);
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
    avgLinks: nodes.size > 0 ? Math.round((totalLinks / nodes.size) * 10) / 10 : 0,
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
