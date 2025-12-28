import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd, getTimeUntilWeekEnd, getWeekLabel } from "@/lib/week";
import { checkRateLimit, leaderboardLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { calculateTotalScore, getScoreBreakdown, MAX_GAMES_FOR_BONUS } from "@/lib/scoring";

export const runtime = "nodejs";

/**
 * GET /api/leaderboard/weekly
 * 
 * Unified scoring system: TotalScore = BestScore + ActivityBonus
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

  // Get current week's scores (excluding AI bots)
  const weeklyScores = await prisma.weeklyScore.findMany({
    where: { 
      weekStart,
      user: {
        isBot: false, // Исключаем AI-ботов из лидерборда
      },
    },
    select: {
      bestScore: true,
      quizzes: true,
      panoramaBestScore: true,
      panoramaCount: true,
      duelBestScore: true,
      duelCount: true,
      duelWins: true,
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
  // Combined formula: (QuizBest + PanoramaBest + DuelBest) + ActivityBonus(quizzes + panoramas + duels)
  const scoredEntries = weeklyScores
    .map(entry => {
      const combinedBestScore = entry.bestScore + entry.panoramaBestScore + entry.duelBestScore;
      const totalGames = entry.quizzes + entry.panoramaCount + entry.duelCount;
      const totalScore = calculateTotalScore(combinedBestScore, totalGames);
      return {
        user: entry.user,
        bestScore: entry.bestScore,
        quizzes: entry.quizzes,
        panoramaBestScore: entry.panoramaBestScore,
        panoramaCount: entry.panoramaCount,
        duelBestScore: entry.duelBestScore,
        duelCount: entry.duelCount,
        duelWins: entry.duelWins,
        combinedBestScore,
        totalGames,
        totalScore,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);

  const leaderboard = scoredEntries.map((entry, idx) => ({
    place: idx + 1,
    user: entry.user,
    score: entry.totalScore,
    bestScore: entry.combinedBestScore,
    quizzes: entry.quizzes,
    panoramas: entry.panoramaCount,
    duels: entry.duelCount,
  }));

  // Get user's position if userId provided
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
      const breakdown = getScoreBreakdown(myCombinedBest, myTotalGames);
      
      // Count how many have higher total score
      const higherCount = scoredEntries.filter(e => e.totalScore > myTotalScore).length;
      
      myPosition = {
        place: higherCount + 1,
        score: myTotalScore,
        bestScore: myCombinedBest,
        quizzes: myScore.quizzes,
        panoramas: myScore.panoramaCount,
        duels: myScore.duelCount,
        duelWins: myScore.duelWins,
        activityBonus: breakdown.activityBonus,
        gamesUntilMaxBonus: breakdown.gamesUntilMaxBonus,
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
    // Scoring system info
    scoringInfo: {
      formula: "TotalScore = (QuizBest + PanoramaBest + DuelBest) + ActivityBonus",
      description: "Квизы, панорамы и дуэли суммируются",
      activityBonusPerGame: 50,
      maxActivityBonus: 500,
      maxGamesForBonus: MAX_GAMES_FOR_BONUS,
    },
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    },
  });
}
