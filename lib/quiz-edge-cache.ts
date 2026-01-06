/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QUIZ EDGE CACHING — Redis + HTTP Edge Cache
 * 
 * Multi-layer caching for quiz data:
 * 
 * Layer 1: Vercel Edge Cache (CDN) — fastest, HTTP headers
 * Layer 2: Redis (Upstash) — distributed, shared across instances
 * Layer 3: In-memory (fallback) — single instance, used when Redis unavailable
 * 
 * Cache Strategy:
 * - Quiz list: 5 min TTL (changes rarely, high traffic)
 * - Quiz details: 10 min TTL (static data)
 * - Quiz questions: 30 min TTL (almost never changes)
 * - Tournament quiz IDs: 2 min TTL (can change when tournaments start/end)
 * 
 * Invalidation:
 * - Called from admin panel when quiz is updated
 * - Called when tournament status changes
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getRedisClient, isRateLimitConfigured } from "./ratelimit";
import { prisma } from "./prisma";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type CachedQuizListItem = {
  id: number;
  title: string;
  description: string | null;
  prizeTitle: string | null;
};

export type CachedQuizDetails = {
  id: number;
  title: string;
  description: string | null;
  prizeTitle: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  questionCount: number;
};

export type CachedQuizQuestion = {
  id: number;
  text: string;
  order: number;
  difficulty: number;
  options: { id: number; text: string }[];
};

type CacheData<T> = {
  data: T;
  cachedAt: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_CONFIG = {
  // TTL in seconds
  QUIZ_LIST_TTL: 300,           // 5 minutes
  QUIZ_DETAILS_TTL: 600,        // 10 minutes
  QUIZ_QUESTIONS_TTL: 1800,     // 30 minutes
  TOURNAMENT_QUIZ_IDS_TTL: 120, // 2 minutes
  
  // SWR window (serve stale while revalidating)
  SWR_WINDOW: 300,              // 5 minutes
  
  // Cache key prefixes
  PREFIX: {
    QUIZ_LIST: "quiz:list",
    QUIZ_DETAILS: "quiz:details",
    QUIZ_QUESTIONS: "quiz:questions",
    TOURNAMENT_QUIZ_IDS: "quiz:tournament-ids",
    REFRESH_LOCK: "quiz:refresh-lock",
  },
};

// In-memory fallback cache (single instance)
const memoryCache = new Map<string, CacheData<unknown>>();
const MEMORY_CACHE_MAX_SIZE = 50;

// Pending refresh promises (prevents thundering herd)
const pendingRefreshes = new Map<string, Promise<void>>();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Safe Redis operations
// ═══════════════════════════════════════════════════════════════════════════

async function safeRedisGet<T>(key: string): Promise<T | null> {
  if (!isRateLimitConfigured()) {
    // Fallback to memory cache
    const entry = memoryCache.get(key) as CacheData<T> | undefined;
    if (entry) {
      return entry.data;
    }
    return null;
  }
  
  try {
    const redis = getRedisClient();
    return await redis.get<T>(key);
  } catch (error) {
    console.error(`[quiz-edge-cache] Redis GET error for ${key}:`, error);
    // Fallback to memory
    const entry = memoryCache.get(key) as CacheData<T> | undefined;
    return entry?.data ?? null;
  }
}

async function safeRedisSet(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  // Always update memory cache as fallback
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, { data: value, cachedAt: Date.now() });
  
  if (!isRateLimitConfigured()) {
    return true;
  }
  
  try {
    const redis = getRedisClient();
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error(`[quiz-edge-cache] Redis SET error for ${key}:`, error);
    return false;
  }
}

async function safeRedisDel(...keys: string[]): Promise<boolean> {
  // Clear memory cache
  for (const key of keys) {
    memoryCache.delete(key);
  }
  
  if (!isRateLimitConfigured()) {
    return true;
  }
  
  try {
    const redis = getRedisClient();
    await redis.del(...keys);
    return true;
  } catch (error) {
    console.error(`[quiz-edge-cache] Redis DEL error:`, error);
    return false;
  }
}

async function tryAcquireRefreshLock(key: string, ttlMs: number): Promise<boolean> {
  if (!isRateLimitConfigured()) {
    return true;
  }
  
  try {
    const redis = getRedisClient();
    const lockKey = `${CACHE_CONFIG.PREFIX.REFRESH_LOCK}:${key}`;
    const result = await redis.set(lockKey, Date.now(), { nx: true, px: ttlMs });
    return result === "OK";
  } catch {
    return true; // Fail open
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBOUNCED REFRESH (prevents thundering herd)
// ═══════════════════════════════════════════════════════════════════════════

async function debouncedRefresh(
  key: string,
  refreshFn: () => Promise<void>
): Promise<void> {
  const pending = pendingRefreshes.get(key);
  if (pending) return pending;
  
  const hasLock = await tryAcquireRefreshLock(key, 5000);
  if (!hasLock) return;
  
  const refreshPromise = refreshFn()
    .catch(err => console.error(`[quiz-edge-cache] Refresh failed for ${key}:`, err))
    .finally(() => pendingRefreshes.delete(key));
  
  pendingRefreshes.set(key, refreshPromise);
  return refreshPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOURNAMENT QUIZ IDs CACHE
// Quizzes that are part of tournaments should not appear in regular list
// ═══════════════════════════════════════════════════════════════════════════

async function fetchTournamentQuizIdsFromDB(): Promise<number[]> {
  const stages = await prisma.tournamentStage.findMany({
    where: { quizId: { not: null } },
    select: { quizId: true },
  });
  
  return stages
    .map(s => s.quizId)
    .filter((id): id is number => id !== null);
}

export async function getTournamentQuizIds(): Promise<number[]> {
  const cacheKey = CACHE_CONFIG.PREFIX.TOURNAMENT_QUIZ_IDS;
  
  type CachedTournamentIds = { ids: number[]; cachedAt: number };
  const cached = await safeRedisGet<CachedTournamentIds>(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.TOURNAMENT_QUIZ_IDS_TTL * 1000;
    
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, async () => {
        const ids = await fetchTournamentQuizIdsFromDB();
        await safeRedisSet(cacheKey, { ids, cachedAt: Date.now() }, 
          CACHE_CONFIG.TOURNAMENT_QUIZ_IDS_TTL + CACHE_CONFIG.SWR_WINDOW);
      });
    }
    
    return cached.ids;
  }
  
  const ids = await fetchTournamentQuizIdsFromDB();
  await safeRedisSet(cacheKey, { ids, cachedAt: Date.now() }, 
    CACHE_CONFIG.TOURNAMENT_QUIZ_IDS_TTL + CACHE_CONFIG.SWR_WINDOW);
  
  return ids;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ LIST CACHE (public, no user-specific data)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchQuizListFromDB(excludeIds: number[]): Promise<CachedQuizListItem[]> {
  const quizzes = await prisma.quiz.findMany({
    where: { 
      isActive: true,
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
    },
    orderBy: [
      { startsAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      prizeTitle: true,
    },
  });
  
  return quizzes;
}

/**
 * Simple hash function for cache key generation
 * Uses sum + length to create unique-ish identifier
 */
function hashIds(ids: number[]): string {
  if (ids.length === 0) return "none";
  const sorted = [...ids].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, id) => acc + id, 0);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${ids.length}_${sum}_${first}_${last}`;
}

export async function getQuizList(): Promise<{
  quizzes: CachedQuizListItem[];
  fromCache: boolean;
  cacheAge: number | null;
}> {
  // First, get tournament quiz IDs (also cached)
  const tournamentQuizIds = await getTournamentQuizIds();
  
  // Create cache key with proper hash (prevents key collisions)
  const idsHash = hashIds(tournamentQuizIds);
  const cacheKey = `${CACHE_CONFIG.PREFIX.QUIZ_LIST}:${idsHash}`;
  
  type CachedQuizList = { quizzes: CachedQuizListItem[]; cachedAt: number };
  const cached = await safeRedisGet<CachedQuizList>(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.QUIZ_LIST_TTL * 1000;
    
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, async () => {
        const quizzes = await fetchQuizListFromDB(tournamentQuizIds);
        await safeRedisSet(cacheKey, { quizzes, cachedAt: Date.now() }, 
          CACHE_CONFIG.QUIZ_LIST_TTL + CACHE_CONFIG.SWR_WINDOW);
      });
    }
    
    return {
      quizzes: cached.quizzes,
      fromCache: true,
      cacheAge: age,
    };
  }
  
  const quizzes = await fetchQuizListFromDB(tournamentQuizIds);
  const cachedAt = Date.now();
  
  await safeRedisSet(cacheKey, { quizzes, cachedAt }, 
    CACHE_CONFIG.QUIZ_LIST_TTL + CACHE_CONFIG.SWR_WINDOW);
  
  return {
    quizzes,
    fromCache: false,
    cacheAge: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ DETAILS CACHE
// ═══════════════════════════════════════════════════════════════════════════

async function fetchQuizDetailsFromDB(quizId: number): Promise<CachedQuizDetails | null> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      description: true,
      prizeTitle: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { questions: true } },
    },
  });
  
  if (!quiz) return null;
  
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    prizeTitle: quiz.prizeTitle,
    isActive: quiz.isActive,
    startsAt: quiz.startsAt?.toISOString() ?? null,
    endsAt: quiz.endsAt?.toISOString() ?? null,
    questionCount: quiz._count.questions,
  };
}

export async function getQuizDetails(quizId: number): Promise<{
  quiz: CachedQuizDetails | null;
  fromCache: boolean;
}> {
  const cacheKey = `${CACHE_CONFIG.PREFIX.QUIZ_DETAILS}:${quizId}`;
  
  type CachedDetails = { quiz: CachedQuizDetails; cachedAt: number };
  const cached = await safeRedisGet<CachedDetails>(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.QUIZ_DETAILS_TTL * 1000;
    
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, async () => {
        const quiz = await fetchQuizDetailsFromDB(quizId);
        if (quiz) {
          await safeRedisSet(cacheKey, { quiz, cachedAt: Date.now() }, 
            CACHE_CONFIG.QUIZ_DETAILS_TTL + CACHE_CONFIG.SWR_WINDOW);
        }
      });
    }
    
    return { quiz: cached.quiz, fromCache: true };
  }
  
  const quiz = await fetchQuizDetailsFromDB(quizId);
  
  if (quiz) {
    await safeRedisSet(cacheKey, { quiz, cachedAt: Date.now() }, 
      CACHE_CONFIG.QUIZ_DETAILS_TTL + CACHE_CONFIG.SWR_WINDOW);
  }
  
  return { quiz, fromCache: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ QUESTIONS CACHE (Static structure, shuffled on client)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchQuizQuestionsFromDB(quizId: number): Promise<CachedQuizQuestion[]> {
  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      text: true,
      order: true,
      difficulty: true,
      answers: {
        select: { id: true, text: true },
      },
    },
  });

  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    order: q.order,
    difficulty: q.difficulty,
    options: q.answers.map((a) => ({ id: a.id, text: a.text })),
  }));
}

export async function getQuizQuestions(quizId: number): Promise<{
  questions: CachedQuizQuestion[];
  fromCache: boolean;
}> {
  const cacheKey = `${CACHE_CONFIG.PREFIX.QUIZ_QUESTIONS}:${quizId}`;
  
  type CachedQuestions = { questions: CachedQuizQuestion[]; cachedAt: number };
  const cached = await safeRedisGet<CachedQuestions>(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.QUIZ_QUESTIONS_TTL * 1000;
    
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, async () => {
        const questions = await fetchQuizQuestionsFromDB(quizId);
        await safeRedisSet(cacheKey, { questions, cachedAt: Date.now() }, 
          CACHE_CONFIG.QUIZ_QUESTIONS_TTL + CACHE_CONFIG.SWR_WINDOW);
      });
    }
    
    return { questions: cached.questions, fromCache: true };
  }
  
  const questions = await fetchQuizQuestionsFromDB(quizId);
  
  await safeRedisSet(cacheKey, { questions, cachedAt: Date.now() }, 
    CACHE_CONFIG.QUIZ_QUESTIONS_TTL + CACHE_CONFIG.SWR_WINDOW);
  
  return { questions, fromCache: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Invalidate quiz cache when quiz is updated
 */
export async function invalidateQuizCache(quizId: number): Promise<void> {
  const keysToDelete = [
    `${CACHE_CONFIG.PREFIX.QUIZ_DETAILS}:${quizId}`,
    `${CACHE_CONFIG.PREFIX.QUIZ_QUESTIONS}:${quizId}`,
  ];
  
  await safeRedisDel(...keysToDelete);
  
  // Also need to invalidate quiz list (it might include this quiz)
  // We invalidate all quiz lists by pattern
  if (isRateLimitConfigured()) {
    try {
      const redis = getRedisClient();
      const listKeys = await redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ_LIST}:*`);
      if (listKeys.length > 0) {
        await redis.del(...listKeys);
      }
    } catch (error) {
      console.error("[quiz-edge-cache] Failed to invalidate quiz lists:", error);
    }
  }
  
  // Clear memory cache for quiz lists
  for (const key of memoryCache.keys()) {
    if (key.startsWith(CACHE_CONFIG.PREFIX.QUIZ_LIST)) {
      memoryCache.delete(key);
    }
  }
  
  console.log(`[quiz-edge-cache] Invalidated cache for quiz ${quizId}`);
}

/**
 * Invalidate tournament-related caches
 */
export async function invalidateTournamentCache(): Promise<void> {
  await safeRedisDel(CACHE_CONFIG.PREFIX.TOURNAMENT_QUIZ_IDS);
  
  // Invalidate all quiz lists (tournament filter may have changed)
  if (isRateLimitConfigured()) {
    try {
      const redis = getRedisClient();
      const listKeys = await redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ_LIST}:*`);
      if (listKeys.length > 0) {
        await redis.del(...listKeys);
      }
    } catch (error) {
      console.error("[quiz-edge-cache] Failed to invalidate quiz lists:", error);
    }
  }
  
  console.log("[quiz-edge-cache] Invalidated tournament cache");
}

/**
 * Invalidate all quiz caches (admin operation)
 */
export async function invalidateAllQuizCaches(): Promise<void> {
  memoryCache.clear();
  
  if (!isRateLimitConfigured()) {
    return;
  }
  
  try {
    const redis = getRedisClient();
    
    const allPatterns = [
      `${CACHE_CONFIG.PREFIX.QUIZ_LIST}:*`,
      `${CACHE_CONFIG.PREFIX.QUIZ_DETAILS}:*`,
      `${CACHE_CONFIG.PREFIX.QUIZ_QUESTIONS}:*`,
      CACHE_CONFIG.PREFIX.TOURNAMENT_QUIZ_IDS,
    ];
    
    for (const pattern of allPatterns) {
      if (pattern.includes("*")) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } else {
        await redis.del(pattern);
      }
    }
    
    console.log("[quiz-edge-cache] Invalidated all quiz caches");
  } catch (error) {
    console.error("[quiz-edge-cache] Failed to invalidate all caches:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE STATS
// ═══════════════════════════════════════════════════════════════════════════

export async function getQuizCacheStats(): Promise<{
  configured: boolean;
  memoryCacheSize: number;
  quizListCached: boolean;
  tournamentIdsCached: boolean;
  quizDetailsCount: number;
  quizQuestionsCount: number;
}> {
  if (!isRateLimitConfigured()) {
    return {
      configured: false,
      memoryCacheSize: memoryCache.size,
      quizListCached: false,
      tournamentIdsCached: false,
      quizDetailsCount: 0,
      quizQuestionsCount: 0,
    };
  }
  
  try {
    const redis = getRedisClient();
    
    const [listKeys, detailsKeys, questionsKeys, tournamentIds] = await Promise.all([
      redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ_LIST}:*`),
      redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ_DETAILS}:*`),
      redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ_QUESTIONS}:*`),
      redis.exists(CACHE_CONFIG.PREFIX.TOURNAMENT_QUIZ_IDS),
    ]);
    
    return {
      configured: true,
      memoryCacheSize: memoryCache.size,
      quizListCached: listKeys.length > 0,
      tournamentIdsCached: tournamentIds === 1,
      quizDetailsCount: detailsKeys.length,
      quizQuestionsCount: questionsKeys.length,
    };
  } catch (error) {
    console.error("[quiz-edge-cache] Failed to get stats:", error);
    return {
      configured: true,
      memoryCacheSize: memoryCache.size,
      quizListCached: false,
      tournamentIdsCached: false,
      quizDetailsCount: 0,
      quizQuestionsCount: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP CACHE HEADERS HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get optimal Cache-Control header based on cache type
 */
export function getQuizCacheHeaders(type: "list" | "details" | "questions"): Record<string, string> {
  const configs = {
    list: { maxAge: 60, swr: 300 },      // 1 min + 5 min SWR
    details: { maxAge: 120, swr: 300 },  // 2 min + 5 min SWR
    questions: { maxAge: 300, swr: 600 }, // 5 min + 10 min SWR
  };
  
  const config = configs[type];
  
  return {
    "Cache-Control": `public, s-maxage=${config.maxAge}, stale-while-revalidate=${config.swr}`,
  };
}

