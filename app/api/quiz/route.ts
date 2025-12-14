import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_ATTEMPTS = 5; // Максимум попыток (энергия)
const HOURS_PER_ATTEMPT = 4; // Часов на восстановление 1 попытки
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000; // 4 часа в мс

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
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);
  
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

      // Проверяем energy (sliding window по cooldown)
      const recentSessions = await prisma.quizSession.findMany({
        where: {
          userId: userIdNum,
          quizId: quiz.id,
          startedAt: { gte: cooldownAgo },
        },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      });

      const usedAttempts = recentSessions.length;
      let energyWaitMs: number | null = null;
      let nextSlotAt: string | null = null;

      if (usedAttempts >= MAX_ATTEMPTS) {
        const oldestSession = recentSessions[0];
        const nextSlot = new Date(oldestSession.startedAt.getTime() + ATTEMPT_COOLDOWN_MS);
        energyWaitMs = nextSlot.getTime() - Date.now();
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
          usedAttempts,
          maxAttempts: MAX_ATTEMPTS,
          remaining: Math.max(0, MAX_ATTEMPTS - usedAttempts),
          rateLimitWaitSeconds,
          energyWaitMs,
          nextSlotAt,
          hasUnfinishedSession: !!unfinishedSession,
          hoursPerAttempt: HOURS_PER_ATTEMPT,
        },
      };
    })
  );

  return NextResponse.json(quizzesWithLimits);
}

