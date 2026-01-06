import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, leaderboardLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { getGlobalLeaderboard, getQuizLeaderboard } from "@/lib/leaderboard-cache";

export const runtime = "nodejs";

// Next.js ISR disabled - using Redis cache instead
export const revalidate = false;

/**
 * GET /api/leaderboard
 * 
 * Unified scoring system: TotalScore = BestScore + ActivityBonus
 * 
 * Redis-cached for high performance:
 * - Global leaderboard: 30s TTL + 5min stale-while-revalidate
 * - Per-quiz leaderboard: 30s TTL + 5min stale-while-revalidate
 * 
 * Query params:
 * - quizId: number (optional) - specific quiz leaderboard
 * - If no quizId - returns global leaderboard (sum across all quizzes)
 */
export async function GET(req: NextRequest) {
  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req);
  const rateLimit = await checkRateLimit(leaderboardLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const quizIdParam = req.nextUrl.searchParams.get("quizId");
  const quizId = quizIdParam ? Number(quizIdParam) : null;

  // ═══ PER-QUIZ LEADERBOARD (Redis-cached) ═══
  if (quizId && !Number.isNaN(quizId)) {
    const { entries, fromCache, cachedAt } = await getQuizLeaderboard(quizId);

    return NextResponse.json(entries, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
        'X-Cache': fromCache ? 'HIT' : 'MISS',
        ...(cachedAt && { 'X-Cache-Age': String(Math.floor((Date.now() - cachedAt) / 1000)) }),
      },
    });
  }

  // ═══ GLOBAL LEADERBOARD (Redis-cached) ═══
  const { entries, fromCache, cachedAt } = await getGlobalLeaderboard();

  return NextResponse.json(entries, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      'X-Cache': fromCache ? 'HIT' : 'MISS',
      ...(cachedAt && { 'X-Cache-Age': String(Math.floor((Date.now() - cachedAt) / 1000)) }),
    },
  });
}
