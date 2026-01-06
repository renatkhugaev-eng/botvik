import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { getQuizList, getQuizCacheHeaders } from "@/lib/quiz-edge-cache";

export const runtime = "nodejs";

// Disable Next.js ISR - using Redis cache instead
export const revalidate = false;

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_ATTEMPTS = 5; // Максимум попыток (энергия)
const HOURS_PER_ATTEMPT = 4; // Часов на восстановление 1 попытки
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000; // 4 часа в мс

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const withLimits = search.get("withLimits") === "true";

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC: Только список квизов (Redis-кэшируется)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!withLimits) {
    const { quizzes, fromCache, cacheAge } = await getQuizList();
    
    return NextResponse.json({ quizzes }, {
      headers: {
        ...getQuizCacheHeaders("list"),
        "X-Cache": fromCache ? "HIT" : "MISS",
        ...(cacheAge !== null && { "X-Cache-Age": String(Math.floor(cacheAge / 1000)) }),
      },
    });
  }
  
  // For withLimits=true, we still need fresh tournament IDs
  const { quizzes } = await getQuizList();

  // ═══════════════════════════════════════════════════════════════════════════
  // PROTECTED: С информацией о лимитах — ТРЕБУЕТСЯ АВТОРИЗАЦИЯ
  // SECURITY: Раньше принимался userId из query params — это IDOR уязвимость!
  // ═══════════════════════════════════════════════════════════════════════════
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;

  // ═══ ГЛОБАЛЬНАЯ ЭНЕРГИЯ — одна на все квизы ═══
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);
  
  // Считаем ВСЕ сессии пользователя за период cooldown (глобально)
  const allRecentSessions = await prisma.quizSession.findMany({
    where: {
      userId,
      startedAt: { gte: cooldownAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });

  const globalUsedAttempts = allRecentSessions.length;
  const globalRemaining = Math.max(0, MAX_ATTEMPTS - globalUsedAttempts);
  
  // Получаем бонусную энергию пользователя
  const userBonusEnergy = await prisma.user.findUnique({
    where: { id: userId },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMIZED: Batch queries вместо N+1
  // Раньше: 2 запроса на каждый квиз (lastSession + unfinishedSession)
  // Теперь: 2 запроса на ВСЕ квизы
  // ═══════════════════════════════════════════════════════════════════════════
  
  const quizIds = quizzes.map(q => q.id);
  
  // Batch query 1: Последние завершённые сессии для каждого квиза
  const lastFinishedSessions = await prisma.quizSession.findMany({
    where: {
      userId,
      quizId: { in: quizIds },
      finishedAt: { not: null },
    },
    orderBy: { finishedAt: "desc" },
    distinct: ["quizId"],
    select: { quizId: true, finishedAt: true },
  });
  
  // Batch query 2: Незавершённые сессии
  const unfinishedSessions = await prisma.quizSession.findMany({
    where: {
      userId,
      quizId: { in: quizIds },
      finishedAt: null,
    },
    select: { quizId: true },
  });
  
  // Создаём lookup maps для O(1) доступа
  const lastFinishedByQuiz = new Map(
    lastFinishedSessions.map(s => [s.quizId, s.finishedAt])
  );
  const unfinishedQuizIds = new Set(unfinishedSessions.map(s => s.quizId));

  // Формируем ответ без дополнительных запросов в цикле
  const quizzesWithLimits = quizzes.map((quiz) => {
    // Rate limit — per-quiz (последняя завершённая сессия ЭТОГО квиза)
    const lastFinished = lastFinishedByQuiz.get(quiz.id);
    let rateLimitWaitSeconds: number | null = null;
    
    if (lastFinished) {
      const timeSinceLastSession = Date.now() - lastFinished.getTime();
      if (timeSinceLastSession < RATE_LIMIT_MS) {
        rateLimitWaitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastSession) / 1000);
      }
    }

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
        hasUnfinishedSession: unfinishedQuizIds.has(quiz.id),
        hoursPerAttempt: HOURS_PER_ATTEMPT,
      },
    };
  });

  return NextResponse.json(quizzesWithLimits);
}
