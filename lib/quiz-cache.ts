/**
 * In-memory cache for quiz questions
 * Questions don't change during gameplay, so we can cache them
 * 
 * TTL: 5 minutes (questions rarely change)
 * Max entries: 100 quizzes
 */

type QuestionWithAnswer = {
  id: number;
  order: number;
  difficulty: number;
  correctOptionId: number;
};

type CacheEntry = {
  questions: QuestionWithAnswer[];
  cachedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

const cache = new Map<number, CacheEntry>();

/**
 * Get questions from cache or null if not cached/expired
 */
export function getCachedQuestions(quizId: number): QuestionWithAnswer[] | null {
  const entry = cache.get(quizId);
  
  if (!entry) return null;
  
  // Check if expired
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(quizId);
    return null;
  }
  
  return entry.questions;
}

/**
 * Cache questions for a quiz
 */
export function cacheQuestions(quizId: number, questions: QuestionWithAnswer[]): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  
  cache.set(quizId, {
    questions,
    cachedAt: Date.now(),
  });
}

/**
 * Invalidate cache for a quiz (call when quiz is updated)
 */
export function invalidateQuizCache(quizId: number): void {
  cache.delete(quizId);
}

/**
 * Clear all cache
 */
export function clearQuizCache(): void {
  cache.clear();
}

/**
 * Get cache stats (for debugging)
 */
export function getQuizCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}

