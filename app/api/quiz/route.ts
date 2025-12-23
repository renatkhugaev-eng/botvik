import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Cache quiz list for 60 seconds
export const revalidate = 60;

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_ATTEMPTS = 5; // Максимум попыток (энергия)
const HOURS_PER_ATTEMPT = 4; // Часов на восстановление 1 попытки
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000; // 4 часа в мс

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  
  // Получаем ID ВСЕХ квизов, которые являются этапами турниров (любого статуса)
  // Турнирные квизы не должны показываться в общем списке
  const tournamentQuizIds = await prisma.tournamentStage.findMany({
    where: {
      quizId: { not: null },
    },
    select: { quizId: true },
  });
  
  const excludeQuizIds = tournamentQuizIds
    .map(s => s.quizId)
    .filter((id): id is number => id !== null);
  
  // Исключаем турнирные квизы из общего списка
  const quizzes = await prisma.quiz.findMany({
    where: { 
      isActive: true,
      id: { notIn: excludeQuizIds.length > 0 ? excludeQuizIds : undefined },
    },
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

  // Если userId не передан, возвращаем просто список квизов (можно кэшировать)
  if (!userId) {
    return NextResponse.json(quizzes, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }

  const userIdNum = Number(userId);
  if (Number.isNaN(userIdNum)) {
    return NextResponse.json(quizzes);
  }

  // ═══ ГЛОБАЛЬНАЯ ЭНЕРГИЯ — одна на все квизы ═══
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);
  
  // Считаем ВСЕ сессии пользователя за период cooldown (глобально)
  const allRecentSessions = await prisma.quizSession.findMany({
    where: {
      userId: userIdNum,
      startedAt: { gte: cooldownAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });

  const globalUsedAttempts = allRecentSessions.length;
  const globalRemaining = Math.max(0, MAX_ATTEMPTS - globalUsedAttempts);
  
  // Получаем бонусную энергию пользователя
  const userBonusEnergy = await prisma.user.findUnique({
    where: { id: userIdNum },
    select: { bonusEnergy: true },
  });
  const bonusEnergy = userBonusEnergy?.bonusEnergy ?? 0;
  
  let globalEnergyWaitMs: number | null = null;
  let globalNextSlotAt: string | null = null;

  // Показываем кулдаун ТОЛЬКО если нет ни обычной, ни бонусной энергии
  if (globalUsedAttempts >= MAX_ATTEMPTS && bonusEnergy <= 0 && allRecentSessions.length > 0) {
    const oldestSession = allRecentSessions[0];
    const nextSlot = new Date(oldestSession.startedAt.getTime() + ATTEMPT_COOLDOWN_MS);
    globalEnergyWaitMs = nextSlot.getTime() - Date.now();
    globalNextSlotAt = nextSlot.toISOString();
  }

  // Для каждого квиза добавляем rate limit + глобальную энергию
  const quizzesWithLimits = await Promise.all(
    quizzes.map(async (quiz) => {
      // Rate limit — per-quiz (последняя завершённая сессия ЭТОГО квиза)
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

      // Проверяем незавершённую сессию
      const unfinishedSession = await prisma.quizSession.findFirst({
        where: { userId: userIdNum, quizId: quiz.id, finishedAt: null },
        select: { id: true },
      });

      return {
        ...quiz,
        limitInfo: {
          // Глобальная энергия (одна на все квизы)
          usedAttempts: globalUsedAttempts,
          maxAttempts: MAX_ATTEMPTS,
          remaining: globalRemaining,
          energyWaitMs: globalEnergyWaitMs,
          nextSlotAt: globalNextSlotAt,
          // Бонусная энергия — если есть, можно играть даже при remaining=0
          bonusEnergy,
          // Rate limit per-quiz
          rateLimitWaitSeconds,
          hasUnfinishedSession: !!unfinishedSession,
          hoursPerAttempt: HOURS_PER_ATTEMPT,
        },
      };
    })
  );

  return NextResponse.json(quizzesWithLimits);
}

