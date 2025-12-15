import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd, getTimeUntilWeekEnd, getWeekLabel } from "@/lib/week";
import { checkRateLimit, leaderboardLimiter, getClientIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * GET /api/leaderboard/weekly
 * 
 * Returns:
 * - Current week's leaderboard (top 50)
 * - Time remaining until week end
 * - Last week's winners (if any)
 * - User's current position
 */
export async function GET(req: NextRequest) {
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const rateLimit = await checkRateLimit(leaderboardLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const userIdParam = req.nextUrl.searchParams.get("userId");
  const userId = userIdParam ? Number(userIdParam) : null;

  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const timeRemaining = getTimeUntilWeekEnd(now);
  const weekLabel = getWeekLabel(now);

  // Get current week's leaderboard
  const weeklyScores = await prisma.weeklyScore.findMany({
    where: { weekStart },
    orderBy: { score: "desc" },
    take: 50,
    include: {
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

  const leaderboard = weeklyScores.map((entry, idx) => ({
    place: idx + 1,
    user: entry.user,
    score: entry.score,
    quizzes: entry.quizzes,
  }));

  // Get user's position if userId provided
  let myPosition = null;
  if (userId) {
    const myScore = await prisma.weeklyScore.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    if (myScore) {
      // Count how many have higher score
      const higherCount = await prisma.weeklyScore.count({
        where: {
          weekStart,
          score: { gt: myScore.score },
        },
      });
      myPosition = {
        place: higherCount + 1,
        score: myScore.score,
        quizzes: myScore.quizzes,
      };
    }
  }

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

  // Total participants this week
  const totalParticipants = await prisma.weeklyScore.count({
    where: { weekStart },
  });

  return NextResponse.json({
    week: {
      label: weekLabel,
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      timeRemaining, // milliseconds
      isEnding: timeRemaining < 6 * 60 * 60 * 1000, // less than 6 hours
    },
    leaderboard,
    myPosition,
    totalParticipants,
    lastWeekWinners: lastWeekWinners.map((w) => ({
      place: w.place,
      user: w.user,
      score: w.score,
      prize: w.prize,
    })),
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    },
  });
}

