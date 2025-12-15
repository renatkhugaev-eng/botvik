import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Get daily stats for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sessions = await prisma.quizSession.findMany({
      where: {
        startedAt: { gte: sevenDaysAgo },
      },
      select: {
        startedAt: true,
        userId: true,
      },
    });

    // Group by date
    const dailyMap = new Map<string, { sessions: number; users: Set<number> }>();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { sessions: 0, users: new Set() });
    }

    sessions.forEach((s) => {
      const dateStr = s.startedAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.sessions++;
        existing.users.add(s.userId);
      }
    });

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        sessions: data.sessions,
        users: data.users.size,
      }))
      .reverse();

    // Get top players by total score across all quizzes
    const topPlayersData = await prisma.quizSession.groupBy({
      by: ["userId"],
      _sum: { totalScore: true },
      _count: { id: true },
      orderBy: { _sum: { totalScore: "desc" } },
      take: 10,
    });

    const userIds = topPlayersData.map((p) => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, username: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const topPlayers = topPlayersData.map((p) => {
      const user = userMap.get(p.userId);
      return {
        id: p.userId,
        firstName: user?.firstName || null,
        username: user?.username || null,
        totalScore: p._sum.totalScore || 0,
        gamesPlayed: p._count.id,
      };
    });

    // Get quiz stats
    const quizStatsData = await prisma.quiz.findMany({
      select: {
        id: true,
        title: true,
        sessions: {
          select: { totalScore: true },
        },
      },
    });

    const quizStats = quizStatsData.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      sessions: quiz.sessions.length,
      avgScore:
        quiz.sessions.length > 0
          ? quiz.sessions.reduce((sum, s) => sum + s.totalScore, 0) / quiz.sessions.length
          : 0,
    }));

    return NextResponse.json({
      dailyStats,
      topPlayers,
      quizStats,
    });
  } catch (error) {
    console.error("Failed to fetch detailed stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

