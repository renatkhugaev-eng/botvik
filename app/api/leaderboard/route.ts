import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, leaderboardLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { calculateTotalScore } from "@/lib/scoring";

export const runtime = "nodejs";

// Cache leaderboard for 30 seconds (stale-while-revalidate for 5 minutes)
export const revalidate = 30;

/**
 * GET /api/leaderboard
 * 
 * Unified scoring system: TotalScore = BestScore + ActivityBonus
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

  // ═══ PER-QUIZ LEADERBOARD ═══
  if (quizId && !Number.isNaN(quizId)) {
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

    // Calculate total scores and sort
    const scoredEntries = entries
      .map(entry => ({
        user: entry.user,
        bestScore: entry.bestScore,
        attempts: entry.attempts,
        totalScore: calculateTotalScore(entry.bestScore, entry.attempts),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 50);

    const result = scoredEntries.map((entry, idx) => ({
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

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      },
    });
  }

  // ═══ GLOBAL LEADERBOARD ═══
  // Sum of all quiz scores per user (using unified formula)
  // OPTIMIZATION: Use Prisma groupBy for aggregation instead of fetching all records
  // This prevents memory issues with large datasets
  
  const aggregatedFromDb = await prisma.leaderboardEntry.groupBy({
    by: ["userId"],
    where: { periodType: "ALL_TIME" },
    _sum: {
      bestScore: true,
      attempts: true,
    },
    orderBy: {
      _sum: {
        bestScore: "desc",
      },
    },
    take: 200, // Limit to top 200 to process, then slice to 50
  });

  // Calculate total scores from aggregated data
  const aggregatedScores = aggregatedFromDb
    .map((entry) => ({
      userId: entry.userId,
      bestScore: entry._sum.bestScore ?? 0,
      attempts: entry._sum.attempts ?? 0,
      totalScore: calculateTotalScore(entry._sum.bestScore ?? 0, entry._sum.attempts ?? 0),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);

  // Get user details
  const userIds = aggregatedScores.map(e => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      firstName: true,
      photoUrl: true,
    },
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  const result = aggregatedScores.map((entry, idx) => {
    const user = userMap.get(entry.userId);
    return {
      place: idx + 1,
      user: {
        id: entry.userId,
        username: user?.username ?? null,
        firstName: user?.firstName ?? null,
        photoUrl: user?.photoUrl ?? null,
      },
      score: entry.totalScore,
      bestScore: entry.bestScore,
      attempts: entry.attempts,
    };
  });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
    },
  });
}
