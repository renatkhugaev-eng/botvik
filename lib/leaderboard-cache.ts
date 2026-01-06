/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEADERBOARD REDIS CACHING
 * 
 * Provides high-performance caching for leaderboard data using Upstash Redis.
 * 
 * Features:
 * - Global, per-quiz, and weekly leaderboard caching
 * - Stale-while-revalidate pattern
 * - Automatic cache invalidation on score changes
 * - Graceful fallback when Redis unavailable
 * 
 * Cache Keys:
 * - leaderboard:global           → Global leaderboard (top 50)
 * - leaderboard:quiz:{quizId}    → Per-quiz leaderboard (top 50)
 * - leaderboard:weekly:{weekStart} → Weekly leaderboard
 * - leaderboard:weekly:meta:{weekStart} → Weekly metadata (time remaining, etc.)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getRedisClient, isRateLimitConfigured } from "./ratelimit";
import { prisma } from "./prisma";
import { calculateTotalScore } from "./scoring";
import { getWeekStart, getWeekEnd, getTimeUntilWeekEnd, getWeekLabel } from "./week";
import { MAX_GAMES_FOR_BONUS } from "./scoring";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type LeaderboardEntry = {
  place: number;
  user: {
    id: number;
    username: string | null;
    firstName: string | null;
    photoUrl: string | null;
  };
  score: number;
  bestScore: number;
  attempts?: number;
  quizzes?: number;
  panoramas?: number;
  duels?: number;
};

export type GlobalLeaderboardData = {
  entries: LeaderboardEntry[];
  cachedAt: number;
};

export type QuizLeaderboardData = {
  quizId: number;
  entries: LeaderboardEntry[];
  cachedAt: number;
};

export type WeeklyLeaderboardData = {
  week: {
    label: string;
    start: string;
    end: string;
    timeRemaining: number;
    isEnding: boolean;
  };
  leaderboard: LeaderboardEntry[];
  totalParticipants: number;
  lastWeekWinners: Array<{
    place: number;
    user: {
      id: number;
      username: string | null;
      firstName: string | null;
      photoUrl: string | null;
    };
    score: number;
    prize: string | null;
  }>;
  scoringInfo: {
    formula: string;
    description: string;
    activityBonusPerGame: number;
    maxActivityBonus: number;
    maxGamesForBonus: number;
  };
  cachedAt: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_CONFIG = {
  // TTL in seconds
  GLOBAL_TTL: 30,           // Global leaderboard: 30 seconds
  QUIZ_TTL: 30,             // Per-quiz leaderboard: 30 seconds
  WEEKLY_TTL: 30,           // Weekly leaderboard: 30 seconds
  WEEKLY_META_TTL: 60,      // Weekly metadata: 60 seconds (less volatile)
  
  // Stale-while-revalidate: serve stale for this many seconds while fetching fresh
  SWR_WINDOW: 300,          // 5 minutes
  
  // Background refresh debounce (prevents thundering herd)
  REFRESH_DEBOUNCE_MS: 5000, // 5 seconds
  
  // Cache key prefixes
  PREFIX: {
    GLOBAL: "leaderboard:global",
    QUIZ: "leaderboard:quiz",
    WEEKLY: "leaderboard:weekly",
    WEEKLY_META: "leaderboard:weekly:meta",
    REFRESH_LOCK: "leaderboard:refresh-lock",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY REFRESH DEBOUNCE (prevents thundering herd in single instance)
// For multi-instance, we also use Redis lock
// ═══════════════════════════════════════════════════════════════════════════

const pendingRefreshes = new Map<string, Promise<void>>();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Safe Redis operations with fallback
// ═══════════════════════════════════════════════════════════════════════════

async function safeRedisGet<T>(key: string): Promise<T | null> {
  if (!isRateLimitConfigured()) {
    return null;
  }
  
  try {
    const redis = getRedisClient();
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error(`[leaderboard-cache] Redis GET error for ${key}:`, error);
    return null;
  }
}

async function safeRedisSet(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  if (!isRateLimitConfigured()) {
    return false;
  }
  
  try {
    const redis = getRedisClient();
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error(`[leaderboard-cache] Redis SET error for ${key}:`, error);
    return false;
  }
}

async function safeRedisDel(...keys: string[]): Promise<boolean> {
  if (!isRateLimitConfigured()) {
    return false;
  }
  
  try {
    const redis = getRedisClient();
    await redis.del(...keys);
    return true;
  } catch (error) {
    console.error(`[leaderboard-cache] Redis DEL error:`, error);
    return false;
  }
}

/**
 * Acquire a distributed lock for background refresh (prevents thundering herd across instances)
 * Returns true if lock acquired, false if already locked
 */
async function tryAcquireRefreshLock(key: string): Promise<boolean> {
  if (!isRateLimitConfigured()) {
    return true; // Allow refresh if Redis not configured
  }
  
  try {
    const redis = getRedisClient();
    const lockKey = `${CACHE_CONFIG.PREFIX.REFRESH_LOCK}:${key}`;
    
    // SET NX with TTL - only sets if key doesn't exist
    const result = await redis.set(lockKey, Date.now(), {
      nx: true,
      px: CACHE_CONFIG.REFRESH_DEBOUNCE_MS,
    });
    
    return result === "OK";
  } catch (error) {
    console.error(`[leaderboard-cache] Lock acquisition error:`, error);
    return true; // Fail open - allow refresh
  }
}

/**
 * Debounced background refresh - prevents thundering herd
 * Uses both in-memory deduplication and distributed Redis lock
 */
async function debouncedRefresh(
  key: string,
  refreshFn: () => Promise<void>
): Promise<void> {
  // 1. Check in-memory pending refreshes (single instance dedup)
  const pending = pendingRefreshes.get(key);
  if (pending) {
    return pending; // Reuse existing refresh promise
  }
  
  // 2. Try to acquire distributed lock (multi-instance dedup)
  const hasLock = await tryAcquireRefreshLock(key);
  if (!hasLock) {
    return; // Another instance is refreshing
  }
  
  // 3. Execute refresh with tracking
  const refreshPromise = refreshFn()
    .catch(err => console.error(`[leaderboard-cache] Refresh failed for ${key}:`, err))
    .finally(() => {
      pendingRefreshes.delete(key);
    });
  
  pendingRefreshes.set(key, refreshPromise);
  return refreshPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL LEADERBOARD CACHE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch global leaderboard from database
 * Combined: Quiz scores + Panorama scores + Duel scores
 */
async function fetchGlobalLeaderboardFromDB(): Promise<LeaderboardEntry[]> {
  // Step 1: Get quiz aggregated scores
  const quizAggregated = await prisma.leaderboardEntry.groupBy({
    by: ["userId"],
    where: { periodType: "ALL_TIME" },
    _sum: {
      bestScore: true,
      attempts: true,
    },
  });
  
  const quizMap = new Map(quizAggregated.map(e => [
    e.userId,
    { bestScore: e._sum.bestScore ?? 0, attempts: e._sum.attempts ?? 0 }
  ]));
  
  // Step 2: Get all users with panorama and duel stats (excluding AI bots)
  const allUsers = await prisma.user.findMany({
    where: {
      isBot: false,
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      photoUrl: true,
      panoramaBestScore: true,
      panoramaCount: true,
      duelBestScore: true,
      duelCount: true,
    },
  });
  
  // Step 3: Calculate combined scores
  const combinedScores = allUsers
    .map(user => {
      const quiz = quizMap.get(user.id) ?? { bestScore: 0, attempts: 0 };
      const combinedBestScore = quiz.bestScore + user.panoramaBestScore + user.duelBestScore;
      const totalGames = quiz.attempts + user.panoramaCount + user.duelCount;
      const totalScore = calculateTotalScore(combinedBestScore, totalGames);
      
      return {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        photoUrl: user.photoUrl,
        quizAttempts: quiz.attempts,
        panoramaCount: user.panoramaCount,
        duelCount: user.duelCount,
        combinedBestScore,
        totalScore,
      };
    })
    .filter(u => u.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);

  return combinedScores.map((entry, idx) => ({
    place: idx + 1,
    user: {
      id: entry.userId,
      username: entry.username ?? null,
      firstName: entry.firstName ?? null,
      photoUrl: entry.photoUrl ?? null,
    },
    score: entry.totalScore,
    bestScore: entry.combinedBestScore,
    quizzes: entry.quizAttempts,
    panoramas: entry.panoramaCount,
    duels: entry.duelCount,
  }));
}

/**
 * Get global leaderboard with Redis caching
 * Uses stale-while-revalidate pattern
 */
export async function getGlobalLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  fromCache: boolean;
  cachedAt: number | null;
}> {
  const cacheKey = CACHE_CONFIG.PREFIX.GLOBAL;
  
  // Try to get from cache
  const cached = await safeRedisGet<GlobalLeaderboardData>(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.GLOBAL_TTL * 1000;
    
    // If stale but within SWR window, return cached and refresh in background
    // Uses debounced refresh to prevent thundering herd
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, refreshGlobalLeaderboardCache);
    }
    
    return {
      entries: cached.entries,
      fromCache: true,
      cachedAt: cached.cachedAt,
    };
  }
  
  // Cache miss - fetch from DB and cache
  const entries = await fetchGlobalLeaderboardFromDB();
  const cachedAt = Date.now();
  
  // Store in cache
  await safeRedisSet(cacheKey, { entries, cachedAt }, CACHE_CONFIG.GLOBAL_TTL + CACHE_CONFIG.SWR_WINDOW);
  
  return {
    entries,
    fromCache: false,
    cachedAt,
  };
}

/**
 * Refresh global leaderboard cache
 */
async function refreshGlobalLeaderboardCache(): Promise<void> {
  const entries = await fetchGlobalLeaderboardFromDB();
  const cachedAt = Date.now();
  await safeRedisSet(CACHE_CONFIG.PREFIX.GLOBAL, { entries, cachedAt }, CACHE_CONFIG.GLOBAL_TTL + CACHE_CONFIG.SWR_WINDOW);
}

// ═══════════════════════════════════════════════════════════════════════════
// PER-QUIZ LEADERBOARD CACHE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch per-quiz leaderboard from database
 */
async function fetchQuizLeaderboardFromDB(quizId: number): Promise<LeaderboardEntry[]> {
  const entries = await prisma.leaderboardEntry.findMany({
    where: { quizId, periodType: "ALL_TIME" },
    select: {
      bestScore: true,
      attempts: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          photoUrl: true,
        },
      },
    },
  });

  return entries
    .map(entry => ({
      user: entry.user,
      bestScore: entry.bestScore,
      attempts: entry.attempts,
      totalScore: calculateTotalScore(entry.bestScore, entry.attempts),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50)
    .map((entry, idx) => ({
      place: idx + 1,
      user: {
        id: entry.user.id,
        username: entry.user.username,
        firstName: entry.user.firstName,
        photoUrl: entry.user.photoUrl,
      },
      score: entry.totalScore,
      bestScore: entry.bestScore,
      attempts: entry.attempts,
    }));
}

/**
 * Get per-quiz leaderboard with Redis caching
 */
export async function getQuizLeaderboard(quizId: number): Promise<{
  entries: LeaderboardEntry[];
  fromCache: boolean;
  cachedAt: number | null;
}> {
  const cacheKey = `${CACHE_CONFIG.PREFIX.QUIZ}:${quizId}`;
  
  // Try to get from cache
  const cached = await safeRedisGet<QuizLeaderboardData>(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.QUIZ_TTL * 1000;
    
    // Uses debounced refresh to prevent thundering herd
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, () => refreshQuizLeaderboardCache(quizId));
    }
    
    return {
      entries: cached.entries,
      fromCache: true,
      cachedAt: cached.cachedAt,
    };
  }
  
  // Cache miss
  const entries = await fetchQuizLeaderboardFromDB(quizId);
  const cachedAt = Date.now();
  
  await safeRedisSet(cacheKey, { quizId, entries, cachedAt }, CACHE_CONFIG.QUIZ_TTL + CACHE_CONFIG.SWR_WINDOW);
  
  return {
    entries,
    fromCache: false,
    cachedAt,
  };
}

/**
 * Refresh per-quiz leaderboard cache
 */
async function refreshQuizLeaderboardCache(quizId: number): Promise<void> {
  const entries = await fetchQuizLeaderboardFromDB(quizId);
  const cachedAt = Date.now();
  const cacheKey = `${CACHE_CONFIG.PREFIX.QUIZ}:${quizId}`;
  await safeRedisSet(cacheKey, { quizId, entries, cachedAt }, CACHE_CONFIG.QUIZ_TTL + CACHE_CONFIG.SWR_WINDOW);
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY LEADERBOARD CACHE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch weekly leaderboard from database
 */
async function fetchWeeklyLeaderboardFromDB(weekStart: Date): Promise<{
  leaderboard: LeaderboardEntry[];
  totalParticipants: number;
}> {
  // Get current week's scores (excluding AI bots)
  const weeklyScores = await prisma.weeklyScore.findMany({
    where: { 
      weekStart,
      user: {
        isBot: false,
      },
    },
    select: {
      bestScore: true,
      quizzes: true,
      panoramaBestScore: true,
      panoramaCount: true,
      duelBestScore: true,
      duelCount: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      },
    },
  });

  // Calculate total scores and sort
  const scoredEntries = weeklyScores
    .map(entry => {
      const combinedBestScore = entry.bestScore + entry.panoramaBestScore + entry.duelBestScore;
      const totalGames = entry.quizzes + entry.panoramaCount + entry.duelCount;
      const totalScore = calculateTotalScore(combinedBestScore, totalGames);
      return {
        user: entry.user,
        combinedBestScore,
        totalGames,
        totalScore,
        quizzes: entry.quizzes,
        panoramaCount: entry.panoramaCount,
        duelCount: entry.duelCount,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);

  const leaderboard: LeaderboardEntry[] = scoredEntries.map((entry, idx) => ({
    place: idx + 1,
    user: {
      id: entry.user.id,
      username: entry.user.username,
      firstName: entry.user.firstName,
      photoUrl: entry.user.photoUrl,
    },
    score: entry.totalScore,
    bestScore: entry.combinedBestScore,
    quizzes: entry.quizzes,
    panoramas: entry.panoramaCount,
    duels: entry.duelCount,
  }));

  // Total participants this week
  const totalParticipants = await prisma.weeklyScore.count({
    where: { weekStart },
  });

  return { leaderboard, totalParticipants };
}

/**
 * Get weekly leaderboard with Redis caching
 */
export async function getWeeklyLeaderboard(userId?: number): Promise<{
  data: WeeklyLeaderboardData;
  myPosition: {
    place: number;
    score: number;
    bestScore: number;
    quizzes: number;
    panoramas: number;
    duels: number;
    duelWins: number;
    activityBonus: number;
    gamesUntilMaxBonus: number;
  } | null;
  fromCache: boolean;
}> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const timeRemaining = getTimeUntilWeekEnd(now);
  const weekLabel = getWeekLabel(now);
  
  const cacheKey = `${CACHE_CONFIG.PREFIX.WEEKLY}:${weekStart.toISOString()}`;
  
  // Try to get from cache
  const cached = await safeRedisGet<WeeklyLeaderboardData>(cacheKey);
  
  let data: WeeklyLeaderboardData;
  let fromCache = false;
  
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age > CACHE_CONFIG.WEEKLY_TTL * 1000;
    
    // Uses debounced refresh to prevent thundering herd
    if (isStale && age < CACHE_CONFIG.SWR_WINDOW * 1000) {
      debouncedRefresh(cacheKey, () => refreshWeeklyLeaderboardCache(weekStart));
    }
    
    // Update dynamic time fields
    data = {
      ...cached,
      week: {
        ...cached.week,
        timeRemaining,
        isEnding: timeRemaining < 6 * 60 * 60 * 1000,
      },
    };
    fromCache = true;
  } else {
    // Cache miss - fetch from DB
    const { leaderboard, totalParticipants } = await fetchWeeklyLeaderboardFromDB(weekStart);
    
    // Get last week's winners
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

    const lastWeekWinners = await prisma.weeklyWinner.findMany({
      where: { weekStart: lastWeekStart },
      orderBy: { place: "asc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
      },
    });
    
    const cachedAt = Date.now();
    
    data = {
      week: {
        label: weekLabel,
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
        timeRemaining,
        isEnding: timeRemaining < 6 * 60 * 60 * 1000,
      },
      leaderboard,
      totalParticipants,
      lastWeekWinners: lastWeekWinners.map((w) => ({
        place: w.place,
        user: {
          id: w.user.id,
          username: w.user.username,
          firstName: w.user.firstName,
          photoUrl: w.user.photoUrl,
        },
        score: w.score,
        prize: w.prize,
      })),
      scoringInfo: {
        formula: "TotalScore = (QuizBest + PanoramaBest + DuelBest) + ActivityBonus",
        description: "Квизы, панорамы и дуэли суммируются",
        activityBonusPerGame: 50,
        maxActivityBonus: 500,
        maxGamesForBonus: MAX_GAMES_FOR_BONUS,
      },
      cachedAt,
    };
    
    // Store in cache
    await safeRedisSet(cacheKey, data, CACHE_CONFIG.WEEKLY_TTL + CACHE_CONFIG.SWR_WINDOW);
  }
  
  // Get user's position if userId provided (always fresh, not cached)
  let myPosition = null;
  if (userId) {
    const myScore = await prisma.weeklyScore.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      select: { 
        bestScore: true, quizzes: true, 
        panoramaBestScore: true, panoramaCount: true,
        duelBestScore: true, duelCount: true, duelWins: true,
      },
    });

    if (myScore) {
      const myCombinedBest = myScore.bestScore + myScore.panoramaBestScore + myScore.duelBestScore;
      const myTotalGames = myScore.quizzes + myScore.panoramaCount + myScore.duelCount;
      const myTotalScore = calculateTotalScore(myCombinedBest, myTotalGames);
      const activityBonus = Math.min(myTotalGames * 50, 500);
      
      // Determine user's place accurately
      // First check if user is in cached top-50
      const inTop50 = data.leaderboard.some(e => e.user.id === userId);
      
      let place: number;
      
      // Count how many in top-50 have higher score
      const higherInTop50 = data.leaderboard.filter(e => e.score > myTotalScore).length;
      
      if (inTop50) {
        // User is in top-50, use cached leaderboard
        place = higherInTop50 + 1;
      } else {
        // User is NOT in top-50
        // Check if there are less than 50 participants total
        if (data.leaderboard.length < 50) {
          // Less than 50 participants - can calculate exact position
          place = higherInTop50 + 1;
        } else {
          // 50+ participants and user not in top-50
          // User is at position 51 or lower
          // For exact position we'd need expensive query, so use estimate
          place = 50 + 1; // At least 51st place
        }
      }
      
      myPosition = {
        place,
        score: myTotalScore,
        bestScore: myCombinedBest,
        quizzes: myScore.quizzes,
        panoramas: myScore.panoramaCount,
        duels: myScore.duelCount,
        duelWins: myScore.duelWins,
        activityBonus,
        gamesUntilMaxBonus: Math.max(0, MAX_GAMES_FOR_BONUS - myTotalGames),
      };
    }
  }
  
  return { data, myPosition, fromCache };
}

/**
 * Refresh weekly leaderboard cache
 */
async function refreshWeeklyLeaderboardCache(weekStart: Date): Promise<void> {
  const weekEnd = getWeekEnd(weekStart);
  const timeRemaining = getTimeUntilWeekEnd(new Date());
  const weekLabel = getWeekLabel(weekStart);
  
  const { leaderboard, totalParticipants } = await fetchWeeklyLeaderboardFromDB(weekStart);
  
  // Get last week's winners
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

  const lastWeekWinners = await prisma.weeklyWinner.findMany({
    where: { weekStart: lastWeekStart },
    orderBy: { place: "asc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          photoUrl: true,
        },
      },
    },
  });
  
  const cachedAt = Date.now();
  const cacheKey = `${CACHE_CONFIG.PREFIX.WEEKLY}:${weekStart.toISOString()}`;
  
  const data: WeeklyLeaderboardData = {
    week: {
      label: weekLabel,
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      timeRemaining,
      isEnding: timeRemaining < 6 * 60 * 60 * 1000,
    },
    leaderboard,
    totalParticipants,
    lastWeekWinners: lastWeekWinners.map((w) => ({
      place: w.place,
      user: {
        id: w.user.id,
        username: w.user.username,
        firstName: w.user.firstName,
        photoUrl: w.user.photoUrl,
      },
      score: w.score,
      prize: w.prize,
    })),
    scoringInfo: {
      formula: "TotalScore = (QuizBest + PanoramaBest + DuelBest) + ActivityBonus",
      description: "Квизы, панорамы и дуэли суммируются",
      activityBonusPerGame: 50,
      maxActivityBonus: 500,
      maxGamesForBonus: MAX_GAMES_FOR_BONUS,
    },
    cachedAt,
  };
  
  await safeRedisSet(cacheKey, data, CACHE_CONFIG.WEEKLY_TTL + CACHE_CONFIG.SWR_WINDOW);
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Invalidate leaderboard cache after score change
 * Called from quiz/finish, panorama/finish, duel/finish
 * 
 * @param quizId - Quiz ID for per-quiz cache invalidation
 * @param weekStart - Week start for weekly cache invalidation
 */
export async function invalidateLeaderboardCache(options: {
  quizId?: number;
  weekStart?: Date;
  invalidateGlobal?: boolean;
}): Promise<void> {
  const keysToDelete: string[] = [];
  
  // Always invalidate global on any score change
  if (options.invalidateGlobal !== false) {
    keysToDelete.push(CACHE_CONFIG.PREFIX.GLOBAL);
  }
  
  // Per-quiz cache
  if (options.quizId) {
    keysToDelete.push(`${CACHE_CONFIG.PREFIX.QUIZ}:${options.quizId}`);
  }
  
  // Weekly cache
  if (options.weekStart) {
    keysToDelete.push(`${CACHE_CONFIG.PREFIX.WEEKLY}:${options.weekStart.toISOString()}`);
  }
  
  if (keysToDelete.length > 0) {
    await safeRedisDel(...keysToDelete);
    console.log(`[leaderboard-cache] Invalidated keys: ${keysToDelete.join(", ")}`);
  }
}

/**
 * Invalidate all leaderboard caches
 * Use sparingly (e.g., admin operations)
 */
export async function invalidateAllLeaderboardCaches(): Promise<void> {
  if (!isRateLimitConfigured()) {
    return;
  }
  
  try {
    const redis = getRedisClient();
    
    // Get all leaderboard keys
    const globalKeys = await redis.keys(`${CACHE_CONFIG.PREFIX.GLOBAL}*`);
    const quizKeys = await redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ}:*`);
    const weeklyKeys = await redis.keys(`${CACHE_CONFIG.PREFIX.WEEKLY}:*`);
    
    const allKeys = [...globalKeys, ...quizKeys, ...weeklyKeys];
    
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`[leaderboard-cache] Invalidated ${allKeys.length} cache keys`);
    }
  } catch (error) {
    console.error("[leaderboard-cache] Failed to invalidate all caches:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE STATS (for monitoring/debugging)
// ═══════════════════════════════════════════════════════════════════════════

export async function getLeaderboardCacheStats(): Promise<{
  configured: boolean;
  globalCached: boolean;
  globalAge: number | null;
  weeklyCached: boolean;
  weeklyAge: number | null;
  quizCachesCount: number;
}> {
  if (!isRateLimitConfigured()) {
    return {
      configured: false,
      globalCached: false,
      globalAge: null,
      weeklyCached: false,
      weeklyAge: null,
      quizCachesCount: 0,
    };
  }
  
  try {
    const redis = getRedisClient();
    
    // Check global cache
    const globalData = await redis.get<GlobalLeaderboardData>(CACHE_CONFIG.PREFIX.GLOBAL);
    const globalAge = globalData ? Date.now() - globalData.cachedAt : null;
    
    // Check weekly cache
    const weekStart = getWeekStart(new Date());
    const weeklyKey = `${CACHE_CONFIG.PREFIX.WEEKLY}:${weekStart.toISOString()}`;
    const weeklyData = await redis.get<WeeklyLeaderboardData>(weeklyKey);
    const weeklyAge = weeklyData ? Date.now() - weeklyData.cachedAt : null;
    
    // Count quiz caches
    const quizKeys = await redis.keys(`${CACHE_CONFIG.PREFIX.QUIZ}:*`);
    
    return {
      configured: true,
      globalCached: !!globalData,
      globalAge,
      weeklyCached: !!weeklyData,
      weeklyAge,
      quizCachesCount: quizKeys.length,
    };
  } catch (error) {
    console.error("[leaderboard-cache] Failed to get stats:", error);
    return {
      configured: true,
      globalCached: false,
      globalAge: null,
      weeklyCached: false,
      weeklyAge: null,
      quizCachesCount: 0,
    };
  }
}

