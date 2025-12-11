import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toInt(value: string | null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const userIdParam = toInt(search.get("userId"));

  const allowDevMock =
    process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true" &&
    process.env.NODE_ENV !== "production";

  let user =
    userIdParam !== null
      ? await prisma.user.findUnique({ where: { id: userIdParam } })
      : null;

  if (!user && allowDevMock) {
    const mockTelegramId = "dev-1";
    user = await prisma.user.upsert({
      where: { telegramId: mockTelegramId },
      update: {
        username: "devuser",
        firstName: "Dev",
        lastName: "User",
      },
      create: {
        telegramId: mockTelegramId,
        username: "devuser",
        firstName: "Dev",
        lastName: "User",
      },
    });
  }

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const totalSessions = await prisma.quizSession.count({
    where: { userId: user.id },
  });

  const totalCorrectAnswers = await prisma.answer.count({
    where: { session: { userId: user.id }, isCorrect: true },
  });

  const sessionsAggregate = await prisma.quizSession.aggregate({
    where: { userId: user.id },
    _sum: { totalScore: true },
  });

  const quizzesPlayed = await prisma.quizSession.groupBy({
    by: ["quizId"],
    where: { userId: user.id },
    _max: { totalScore: true },
  });

  const quizIds = quizzesPlayed.map((q) => q.quizId);
  const quizzes =
    quizIds.length > 0
      ? await prisma.quiz.findMany({
          where: { id: { in: quizIds } },
          select: { id: true, title: true },
        })
      : [];

  const bestScoreByQuiz = quizzesPlayed.map((q) => {
    const quizTitle = quizzes.find((qq) => qq.id === q.quizId)?.title ?? "Викторина";
    return {
      quizId: q.quizId,
      title: quizTitle,
      bestScore: q._max.totalScore ?? 0,
    };
  });

  const lastSession = await prisma.quizSession.findFirst({
    where: { userId: user.id },
    orderBy: [
      { finishedAt: "desc" },
      { startedAt: "desc" },
    ],
    include: { quiz: { select: { id: true, title: true } } },
  });

  const totalScore = sessionsAggregate._sum.totalScore ?? 0;

  return NextResponse.json({
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    stats: {
      totalSessions,
      totalQuizzesPlayed: quizzesPlayed.length,
      totalCorrectAnswers,
      totalScore,
      bestScoreByQuiz,
      lastSession: lastSession
        ? {
            quizId: lastSession.quizId,
            quizTitle: lastSession.quiz.title,
            score: lastSession.totalScore,
            finishedAt: lastSession.finishedAt ?? lastSession.startedAt,
          }
        : null,
    },
  });
}


