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
  // Combined: Quiz scores + Panorama scores + Duel scores
  // Formula: (QuizBestSum + PanoramaBest + DuelBest) + ActivityBonus(quizAttempts + panoramaCount + duelCount)
  
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
  
  // Step 2: Get all users with panorama and duel stats
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      firstName: true,
      photoUrl: true,
      panoramaBestScore: true,
      panoramaCount: true,
      duelBestScore: true,
      duelCount: true,
      duelWins: true,
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
        quizBestScore: quiz.bestScore,
        quizAttempts: quiz.attempts,
        panoramaBestScore: user.panoramaBestScore,
        panoramaCount: user.panoramaCount,
        duelBestScore: user.duelBestScore,
        duelCount: user.duelCount,
        duelWins: user.duelWins,
        combinedBestScore,
        totalGames,
        totalScore,
      };
    })
    .filter(u => u.totalScore > 0) // Only users with some score
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);

  const result = combinedScores.map((entry, idx) => ({
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

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
    },
  });
}
