import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekEnd } from "@/lib/week";

export const runtime = "nodejs";

/**
 * POST /api/cron/weekly-reset
 * 
 * Called by Vercel Cron every Sunday at 23:59 UTC
 * 
 * 1. Gets top 3 from current week
 * 2. Saves them to WeeklyWinner table
 * 3. (Optional) Send notifications to winners
 * 
 * Note: We don't delete WeeklyScore - new week automatically uses new weekStart
 */
export async function POST(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  console.log(`[Weekly Reset] Processing week ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);

  // Get top 3 for this week
  const top3 = await prisma.weeklyScore.findMany({
    where: { weekStart },
    orderBy: { score: "desc" },
    take: 3,
    include: {
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

  if (top3.length === 0) {
    console.log("[Weekly Reset] No participants this week");
    return NextResponse.json({ 
      success: true, 
      message: "No participants this week",
      winners: [],
    });
  }

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
          score: entry.score,
          prize: prizes[i] || null,
        },
      });

      winners.push({
        place,
        user: entry.user,
        score: entry.score,
        prize: prizes[i],
      });

      console.log(`[Weekly Reset] Winner #${place}: ${entry.user.firstName || entry.user.username} with ${entry.score} points`);
    }
  }

  // TODO: Send Telegram notifications to winners
  // This would require the Telegram bot to send messages

  console.log(`[Weekly Reset] Saved ${winners.length} winners`);

  return NextResponse.json({
    success: true,
    week: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    },
    totalParticipants: await prisma.weeklyScore.count({ where: { weekStart } }),
    winners,
  });
}

// Also allow GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}

