import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_DAILY_ATTEMPTS = 5; // Максимум попыток за 24 часа

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  
  const quizzes = await prisma.quiz.findMany({
    where: { isActive: true },
    orderBy: [
      { startsAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      prizeTitle: true,
    },
  });

  // Если userId не передан, возвращаем просто список квизов
  if (!userId) {
    return NextResponse.json(quizzes);
  }

  const userIdNum = Number(userId);
  if (Number.isNaN(userIdNum)) {
    return NextResponse.json(quizzes);
  }

  // Получаем информацию о лимитах для каждого квиза
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const quizzesWithLimits = await Promise.all(
    quizzes.map(async (quiz) => {
      // Проверяем rate limit (последняя завершённая сессия)
      const lastSession = await prisma.quizSession.findFirst({
        where: { userId: userIdNum, quizId: quiz.id, finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      });

      let rateLimitWaitSeconds: number | null = null;
      if (lastSession?.finishedAt) {
        const timeSinceLastSession = Date.now() - lastSession.finishedAt.getTime();
        if (timeSinceLastSession < RATE_LIMIT_MS) {
          rateLimitWaitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastSession) / 1000);
        }
      }

      // Проверяем daily limit (sliding window 24h)
      const recentSessions = await prisma.quizSession.findMany({
        where: {
          userId: userIdNum,
          quizId: quiz.id,
          startedAt: { gte: twentyFourHoursAgo },
        },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      });

      const attemptsIn24h = recentSessions.length;
      let dailyLimitWaitMs: number | null = null;
      let nextSlotAt: string | null = null;

      if (attemptsIn24h >= MAX_DAILY_ATTEMPTS) {
        const oldestSession = recentSessions[0];
        const nextSlot = new Date(oldestSession.startedAt.getTime() + 24 * 60 * 60 * 1000);
        dailyLimitWaitMs = nextSlot.getTime() - Date.now();
        nextSlotAt = nextSlot.toISOString();
      }

      // Проверяем незавершённую сессию
      const unfinishedSession = await prisma.quizSession.findFirst({
        where: { userId: userIdNum, quizId: quiz.id, finishedAt: null },
        select: { id: true },
      });

      return {
        ...quiz,
        limitInfo: {
          attemptsIn24h,
          maxAttempts: MAX_DAILY_ATTEMPTS,
          remaining: Math.max(0, MAX_DAILY_ATTEMPTS - attemptsIn24h),
          rateLimitWaitSeconds,
          dailyLimitWaitMs,
          nextSlotAt,
          hasUnfinishedSession: !!unfinishedSession,
        },
      };
    })
  );

  return NextResponse.json(quizzesWithLimits);
}

