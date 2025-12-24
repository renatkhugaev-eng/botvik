import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd } from "@/lib/week";
import { calculateTotalScore } from "@/lib/scoring";
import { notifyWeeklyWinner } from "@/lib/notifications";
import { requireCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";

/**
 * POST /api/cron/weekly-reset
 * 
 * Called by Vercel Cron every Sunday at 23:59 UTC
 * 
 * Uses unified scoring: TotalScore = BestScore + ActivityBonus
 * 
 * 1. Gets all participants from current week
 * 2. Calculates total scores using unified formula
 * 3. Saves top 3 to WeeklyWinner table
 * 4. (Optional) Send notifications to winners
 * 
 * Note: We don't delete WeeklyScore - new week automatically uses new weekStart
 */
export async function POST(req: NextRequest) {
  // ═══ UNIFIED CRON AUTH ═══
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  console.log(`[Weekly Reset] Processing week ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);

  // Get all participants for this week
  const allScores = await prisma.weeklyScore.findMany({
    where: { weekStart },
    select: {
      userId: true,
      bestScore: true,
      quizzes: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          telegramId: true,
        },
      },
    },
  });

  if (allScores.length === 0) {
    console.log("[Weekly Reset] No participants this week");
    return NextResponse.json({ 
      success: true, 
      message: "No participants this week",
      winners: [],
    });
  }

  // Calculate total scores using unified formula and sort
  const rankedScores = allScores
    .map(entry => ({
      ...entry,
      totalScore: calculateTotalScore(entry.bestScore, entry.quizzes),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  // Get top 3
  const top3 = rankedScores.slice(0, 3);

  // Prize descriptions
  const prizes = [
    "🥇 Главный приз недели",
    "🥈 Второе место",
    "🥉 Третье место",
  ];

  // Save winners
  const winners = [];
  for (let i = 0; i < top3.length; i++) {
    const entry = top3[i];
    const place = i + 1;

    // Check if already saved (idempotency)
    const existing = await prisma.weeklyWinner.findUnique({
      where: { weekStart_place: { weekStart, place } },
    });

    if (!existing) {
      const winner = await prisma.weeklyWinner.create({
        data: {
          userId: entry.userId,
          weekStart,
          weekEnd,
          place,
          score: entry.totalScore, // Store calculated total score
          prize: prizes[i] || null,
        },
      });

      winners.push({
        place,
        user: entry.user,
        score: entry.totalScore,
        bestScore: entry.bestScore,
        quizzes: entry.quizzes,
        prize: prizes[i],
      });

      console.log(`[Weekly Reset] Winner #${place}: ${entry.user.firstName || entry.user.username} with ${entry.totalScore} points (best: ${entry.bestScore}, games: ${entry.quizzes})`);
    }
  }

  // Send Telegram notifications to winners
  const notificationResults = { sent: 0, failed: 0 };
  
  for (const winner of winners) {
    try {
      const success = await notifyWeeklyWinner(
        winner.user.id,
        winner.place as 1 | 2 | 3,
        winner.score,
        winner.bestScore,
        winner.quizzes,
        winner.prize
      );
      
      if (success) {
        notificationResults.sent++;
        console.log(`[Weekly Reset] Notification sent to winner #${winner.place}`);
      } else {
        notificationResults.failed++;
      }
      
      // Small delay to avoid Telegram rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Weekly Reset] Failed to notify winner #${winner.place}:`, error);
      notificationResults.failed++;
    }
  }

  console.log(`[Weekly Reset] Saved ${winners.length} winners, notified ${notificationResults.sent}`);

  return NextResponse.json({
    success: true,
    week: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    },
    totalParticipants: allScores.length,
    winners,
    notifications: notificationResults,
    scoringFormula: "TotalScore = BestScore + ActivityBonus (max 500 for 10 games)",
  });
}

// Also allow GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
