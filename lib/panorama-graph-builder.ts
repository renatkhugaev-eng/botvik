/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA GRAPH BUILDER v3.0.0
 * Сервис для построения графа панорам через Google Street View API
 * 
 * Используется на клиенте (браузере) через Google Maps JavaScript API
 * 
 * Best Practices 2025:
 * - LRU кэширование запросов
 * - AbortController для отмены
 * - Exponential backoff retry
 * - Валидация panoId
 * - Метрики производительности
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
  /** Использовать кэш (по умолчанию true) */
  useCache?: boolean;
}

interface QueueItem {
  panoId: string;
  depth: number;
  parentHeading?: number;
}

/** Метрики сканирования */
export interface ScanMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  failedRequests: number;
  retries: number;
  totalTimeMs: number;
  avgRequestTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Минимальная задержка между запросами к API (Google рекомендует ~200ms) */
const MIN_REQUEST_DELAY_MS = 200;

/** Максимальное количество повторных попыток */
const MAX_RETRIES = 3;

/** Базовая задержка перед повторной попыткой (exponential backoff) */
const BASE_RETRY_DELAY_MS = 300;

/** Максимальный размер LRU кэша */
const CACHE_MAX_SIZE = 1000;

/** Время жизни записи в кэше (5 минут) */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
// LRU CACHE
// ═══════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  
  constructor(maxSize: number = CACHE_MAX_SIZE, ttlMs: number = CACHE_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Проверяем TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    // LRU: перемещаем в конец (самый свежий)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }
  
  set(key: string, data: T): void {
    // Удаляем старую запись если есть
    this.cache.delete(key);
    
    // Если кэш переполнен — удаляем самую старую запись
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
  
  /** Очистить просроченные записи */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
}

// Глобальный кэш панорам (сохраняется между вызовами)
const panoramaCache = new LRUCache<StreetViewPanoramaData>();

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
 * Exponential backoff задержка
 */
function getRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Валидация panoId
 */
function isValidPanoId(panoId: string | null | undefined): panoId is string {
  return typeof panoId === "string" && panoId.trim().length > 0;
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
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    
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
          const result = convertPanoramaData(data, lat, lng);
          resolve(result);
        } else {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Конвертировать сырые данные Google в наш формат
 */
function convertPanoramaData(
  data: any, 
  fallbackLat: number = 0, 
  fallbackLng: number = 0
): StreetViewPanoramaData {
  return {
    location: {
      pano: data.location?.pano || "",
      latLng: {
        lat: () => data.location?.latLng?.lat?.() ?? fallbackLat,
        lng: () => data.location?.latLng?.lng?.() ?? fallbackLng,
      },
      description: data.location?.description,
    },
    links: (data.links || [])
      .filter((link: any) => isValidPanoId(link?.pano))
      .map((link: any) => ({
        pano: link.pano,
        heading: link.heading ?? 0,
        description: link.description,
      })),
    tiles: {
      worldSize: { width: 0, height: 0 },
      tileSize: { width: 0, height: 0 },
    },
  };
}

/**
 * Получить панораму по ID с retry логикой и кэшированием
 */
export async function getPanoramaById(
  panoId: string,
  signal?: AbortSignal,
  options?: { useCache?: boolean; retries?: number }
): Promise<StreetViewPanoramaData | null> {
  const { useCache = true, retries = MAX_RETRIES } = options || {};
  
  // Валидация panoId
  if (!isValidPanoId(panoId)) {
    console.warn("[GraphBuilder] Invalid panoId provided:", panoId);
    return null;
  }
  
  // Проверяем кэш
  if (useCache) {
    const cached = panoramaCache.get(panoId);
    if (cached) {
      return cached;
    }
  }
  
  const service = createStreetViewService();
  
  // Функция для одной попытки
  const attempt = async (remainingRetries: number): Promise<StreetViewPanoramaData | null> => {
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
            const result = convertPanoramaData(data);
            
            // Сохраняем в кэш
            if (useCache) {
              panoramaCache.set(panoId, result);
            }
            
            resolve(result);
          } else if (
            (status === google.maps.StreetViewStatus.UNKNOWN_ERROR ||
             status === google.maps.StreetViewStatus.OVER_QUERY_LIMIT) &&
            remainingRetries > 0
          ) {
            // Retry с exponential backoff
            const retryDelay = getRetryDelay(MAX_RETRIES - remainingRetries);
            try {
              await delay(retryDelay, signal);
              const result = await attempt(remainingRetries - 1);
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
  };
  
  return attempt(retries);
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
 * Вычислить разницу между двумя углами (с учётом wrap-around)
 * Возвращает значение в диапазоне [-180, 180]
 */
function headingDifference(h1: number, h2: number): number {
  let diff = normalizeHeading(h2) - normalizeHeading(h1);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Вычислить среднее направление между двумя углами
 * Корректно обрабатывает wrap-around (например, 350° и 10° → 0°)
 */
export function averageHeading(h1: number, h2: number): number {
  h1 = normalizeHeading(h1);
  h2 = normalizeHeading(h2);
  
  const diff = headingDifference(h1, h2);
  return normalizeHeading(h1 + diff / 2);
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
    const h1 = normalizeHeading(links[0].heading);
    const h2 = normalizeHeading(links[1].heading);
    
    // Находим минимальное отклонение от направления движения
    const diff1 = Math.abs(headingDifference(h1, parentHeading));
    const diff2 = Math.abs(headingDifference(h2, parentHeading));
    const minDiff = Math.min(diff1, diff2);
    
    // Если минимальное отклонение > 60° — это угол
    isCorner = minDiff > 60;
  }
  
  return { isDeadEnd, isIntersection, isCorner };
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAPH BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Построить граф панорам
 * 
 * Использует BFS (обход в ширину) для исследования территории
 * начиная с заданных координат.
 */
export async function buildPanoramaGraph(
  startCoordinates: [number, number],
  options: BuildGraphOptions = {}
): Promise<PanoramaGraph & { metrics: ScanMetrics }> {
  const {
    maxDepth = 40,
    maxNodes = 200,
    requestTimeout = 5000,
    requestDelay = MIN_REQUEST_DELAY_MS,
    onProgress,
    signal,
    useCache = true,
  } = options;
  
  const startTime = Date.now();
  
  // Метрики
  const metrics: ScanMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failedRequests: 0,
    retries: 0,
    totalTimeMs: 0,
    avgRequestTimeMs: 0,
  };
  
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
  
  if (!startPano || !isValidPanoId(startPano.location.pano)) {
    throw new Error("Не удалось найти Street View в этой локации. Попробуйте другие координаты.");
  }
  
  // Валидация: проверяем что стартовая панорама имеет навигационные ссылки
  if (startPano.links.length === 0) {
    throw new Error(
      "Стартовая панорама не имеет навигационных ссылок. " +
      "Возможно, это indoor-панорама или музей. Попробуйте другие координаты."
    );
  }
  
  const startPanoId = startPano.location.pano;
  
  // Кэшируем стартовую панораму
  if (useCache) {
    panoramaCache.set(startPanoId, startPano);
  }
  
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
    if (!isValidPanoId(panoId)) {
      continue;
    }
    
    visited.add(panoId);
    
    // Проверяем кэш
    let panoData: StreetViewPanoramaData | null = null;
    const cached = useCache ? panoramaCache.get(panoId) : null;
    
    if (cached) {
      panoData = cached;
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
      metrics.totalRequests++;
      
      // Получаем данные панорамы с таймаутом
      const requestStart = Date.now();
      
      try {
        panoData = await Promise.race([
          getPanoramaById(panoId, signal, { useCache }),
          delay(requestTimeout, signal).then(() => null),
        ]) as StreetViewPanoramaData | null;
        
        metrics.avgRequestTimeMs = 
          (metrics.avgRequestTimeMs * (metrics.totalRequests - 1) + (Date.now() - requestStart)) / 
          metrics.totalRequests;
          
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          throw e;
        }
        metrics.failedRequests++;
        continue;
      }
    }
    
    if (!panoData) {
      metrics.failedRequests++;
      continue;
    }
    
    // Конвертируем ссылки
    const links: PanoLink[] = panoData.links
      .filter(link => isValidPanoId(link.pano))
      .map(link => ({
        targetPanoId: link.pano,
        heading: normalizeHeading(link.heading),
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
    
    // Rate limiting (только для не-кэшированных запросов)
    if (!cached && safeDelay > 0 && queue.length > 0) {
      await delay(safeDelay, signal);
    }
  }
  
  // 3. Вычисляем статистику
  const stats: GraphStats = calculateGraphStats(nodes, actualMaxDepth);
  
  metrics.totalTimeMs = Date.now() - startTime;
  
  onProgress?.(nodes.size, nodes.size, `Готово! ${nodes.size} панорам`);
  
  console.log(
    `[GraphBuilder] Сканирование завершено: ` +
    `${nodes.size} узлов, глубина ${actualMaxDepth}, ` +
    `кэш ${metrics.cacheHits}/${metrics.cacheHits + metrics.cacheMisses}, ` +
    `время ${metrics.totalTimeMs}ms`
  );
  
  return {
    nodes,
    startPanoId,
    startCoordinates,
    maxDepth: actualMaxDepth,
    stats,
    metrics,
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
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Очистить кэш панорам
 */
export function clearPanoramaCache(): void {
  panoramaCache.clear();
}

/**
 * Получить размер кэша
 */
export function getCacheSize(): number {
  return panoramaCache.size;
}

/**
 * Очистить просроченные записи в кэше
 */
export function cleanupCache(): number {
  return panoramaCache.cleanup();
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
