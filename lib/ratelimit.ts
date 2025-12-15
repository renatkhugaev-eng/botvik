import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

/**
 * Upstash Redis client
 * Configure via UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

/**
 * Check if Upstash is configured
 */
export function isRateLimitConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Rate limiters for different use cases
 */

// General API: 60 requests per minute per user
export const generalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:general",
  analytics: true,
});

// Quiz answers: 10 per minute (prevent spam clicking)
export const quizAnswerLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:quiz:answer",
  analytics: true,
});

// Quiz start: 5 per minute (prevent session spam)
export const quizStartLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "ratelimit:quiz:start",
  analytics: true,
});

// Leaderboard: 30 per minute
export const leaderboardLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:leaderboard",
  analytics: true,
});

// Auth: 10 per minute (prevent brute force)
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:auth",
  analytics: true,
});

// Admin: 100 per minute (more lenient for admins)
export const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  prefix: "ratelimit:admin",
  analytics: true,
});

/**
 * Result of rate limit check
 */
export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the limit resets
};

/**
 * Check rate limit for a given identifier
 * Returns response if rate limited, null if OK
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ limited: false } | { limited: true; response: NextResponse }> {
  // Skip rate limiting if not configured (development)
  if (!isRateLimitConfigured()) {
    return { limited: false };
  }
  
  try {
    const result = await limiter.limit(identifier);
    
    if (!result.success) {
      const resetInSeconds = Math.ceil((result.reset - Date.now()) / 1000);
      
      return {
        limited: true,
        response: NextResponse.json(
          {
            error: "RATE_LIMITED",
            message: `Слишком много запросов. Подождите ${resetInSeconds} секунд.`,
            retryAfter: resetInSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(resetInSeconds),
              "X-RateLimit-Limit": String(result.limit),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(result.reset),
            },
          }
        ),
      };
    }
    
    return { limited: false };
  } catch (error) {
    // If Redis is down, allow the request (fail open)
    console.error("[ratelimit] Redis error:", error);
    return { limited: false };
  }
}

/**
 * Get client identifier from request
 * Prefers Telegram ID, falls back to IP
 */
export function getClientIdentifier(req: NextRequest, telegramId?: string): string {
  if (telegramId) {
    return `tg:${telegramId}`;
  }
  
  // Fallback to IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  
  return `ip:${ip}`;
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: { limit: number; remaining: number; reset: number }
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.reset));
  return response;
}

