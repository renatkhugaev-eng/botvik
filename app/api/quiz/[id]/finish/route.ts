import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   WEIGHTED LEADERBOARD SCORE
   
   Вместо записи лучшего результата (который легко абузить перезапусками),
   используем взвешенный результат первых попыток:
   
   Веса попыток:
   - Попытка 1: 50% от результата
   - Попытка 2: 25% от результата  
   - Попытка 3: 15% от результата
   - Попытка 4: 7% от результата
   - Попытка 5: 3% от результата
   
   Сумма весов = 100%
   
   Это поощряет:
   - Хорошую подготовку перед первой попыткой
   - Честную игру (нет смысла переигрывать 100 раз)
   - Стабильность результатов
═══════════════════════════════════════════════════════════════════════════ */

// Веса для первых 5 попыток (сумма = 1.0)
const ATTEMPT_WEIGHTS = [0.50, 0.25, 0.15, 0.07, 0.03];

type FinishRequestBody = {
  sessionId?: number;
};

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const quizId = Number(id);
  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  let body: FinishRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "session_required" }, { status: 400 });
  }

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: { 
      id: true, 
      quizId: true, 
      userId: true, 
      totalScore: true, 
      finishedAt: true,
      attemptNumber: true,
    },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // Завершаем сессию, если ещё не завершена
  const finishedSession =
    session.finishedAt !== null
      ? session
      : await prisma.quizSession.update({
          where: { id: sessionId },
          data: { finishedAt: new Date() },
          select: { 
            id: true, 
            quizId: true, 
            userId: true, 
            totalScore: true, 
            finishedAt: true,
            attemptNumber: true,
          },
        });

  // ═══ WEIGHTED SCORE CALCULATION ═══
  
  // Получаем все завершённые сессии пользователя для этого квиза
  const allSessions = await prisma.quizSession.findMany({
    where: { 
      userId: session.userId, 
      quizId,
      finishedAt: { not: null },
    },
    orderBy: { attemptNumber: "asc" },
    take: 5, // Только первые 5 попыток влияют на лидерборд
    select: {
      totalScore: true,
      attemptNumber: true,
    },
  });

  // Рассчитываем взвешенный результат
  let weightedScore = 0;
  let totalWeight = 0;

  for (const sess of allSessions) {
    const attemptIndex = sess.attemptNumber - 1;
    const weight = ATTEMPT_WEIGHTS[attemptIndex] ?? 0;
    weightedScore += sess.totalScore * weight;
    totalWeight += weight;
  }

  // Нормализуем если не все попытки использованы
  // (чтобы 1 попытка давала полный результат, а не 50%)
  const normalizedScore = totalWeight > 0 
    ? Math.round(weightedScore / totalWeight)
    : finishedSession.totalScore;

  // Также сохраняем лучший результат для отображения
  const bestScore = Math.max(...allSessions.map(s => s.totalScore));

  // Обновляем лидерборд
  await prisma.leaderboardEntry.upsert({
    where: {
      userId_quizId_periodType: {
        userId: session.userId,
        quizId,
        periodType: "ALL_TIME",
      },
    },
    update: { score: normalizedScore },
    create: {
      userId: session.userId,
      quizId,
      periodType: "ALL_TIME",
      score: normalizedScore,
    },
  });

  // Статистика попыток
  const attemptStats = {
    currentAttempt: finishedSession.attemptNumber,
    totalAttempts: allSessions.length,
    sessionsConsidered: allSessions.map(s => ({
      attempt: s.attemptNumber,
      score: s.totalScore,
      weight: ATTEMPT_WEIGHTS[s.attemptNumber - 1] ?? 0,
    })),
  };

  return NextResponse.json({ 
    totalScore: finishedSession.totalScore,
    bestScore,
    leaderboardScore: normalizedScore,
    attemptStats,
  });
}
