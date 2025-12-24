import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // ═══ ADMIN AUTHORIZATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Get total counts
    const [totalUsers, totalQuizzes, totalSessions] = await Promise.all([
      prisma.user.count(),
      prisma.quiz.count(),
      prisma.quizSession.count(),
    ]);

    // Get today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySessions = await prisma.quizSession.count({
      where: {
        startedAt: { gte: today },
      },
    });

    // Get average score
    const avgScoreResult = await prisma.quizSession.aggregate({
      _avg: { totalScore: true },
      where: { finishedAt: { not: null } },
    });

    // Get top quiz by sessions
    const topQuizData = await prisma.quizSession.groupBy({
      by: ["quizId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });

    let topQuiz = null;
    if (topQuizData.length > 0) {
      const quiz = await prisma.quiz.findUnique({
        where: { id: topQuizData[0].quizId },
        select: { title: true },
      });
      if (quiz) {
        topQuiz = {
          title: quiz.title,
          sessions: topQuizData[0]._count.id,
        };
      }
    }

    return NextResponse.json({
      totalUsers,
      totalQuizzes,
      totalSessions,
      todaySessions,
      avgScore: avgScoreResult._avg.totalScore ?? 0,
      topQuiz,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

