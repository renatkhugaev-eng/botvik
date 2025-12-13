import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   ANTI-ABUSE: Rate Limiting & Sliding Window Limits
   
   - Rate limit: 1 новая сессия в минуту
   - Sliding window: 5 попыток за последние 24 часа (скользящее окно)
   - Attempt tracking: номер попытки для decay scoring
   
   DEV BYPASS: Установи BYPASS_LIMITS=true в .env.local для отключения лимитов
═══════════════════════════════════════════════════════════════════════════ */

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_DAILY_ATTEMPTS = 5; // Максимум попыток в день

// Dev bypass для тестирования (только в development)
const bypassLimits = 
  process.env.BYPASS_LIMITS === "true" && 
  process.env.NODE_ENV !== "production";

type StartRequestBody = {
  userId?: number;
};

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const quizId = Number(id);
  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  let body: StartRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: "user_required" }, { status: 400 });
  }

  const allowDevMock =
    process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true" &&
    process.env.NODE_ENV !== "production";

  const telegramId = `dev-${userId}`;

  let user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user && allowDevMock) {
    user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        username: "devuser",
        firstName: "Dev",
        lastName: "User",
      },
      create: {
        telegramId,
        username: "devuser",
        firstName: "Dev",
        lastName: "User",
      },
    });
  }

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, isActive: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  // Проверяем, есть ли незавершённая сессия
  const existingSession = await prisma.quizSession.findFirst({
    where: { quizId, userId: user.id, finishedAt: null },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      attemptNumber: true,
      totalScore: true,
      currentQuestionIndex: true,
      currentStreak: true, // Server-side streak
    },
  });

  // Если есть незавершённая сессия - возвращаем её и обновляем время вопроса
  if (existingSession) {
    const questions = await getQuestions(quizId);
    const now = new Date();
    
    // Обновляем время начала текущего вопроса (для случая если пользователь вернулся)
    await prisma.quizSession.update({
      where: { id: existingSession.id },
      data: { currentQuestionStartedAt: now },
    });
    
    return NextResponse.json({
      sessionId: existingSession.id,
      quizId,
      attemptNumber: existingSession.attemptNumber,
      totalQuestions: questions.length,
      totalScore: existingSession.totalScore,
      currentQuestionIndex: existingSession.currentQuestionIndex,
      currentStreak: existingSession.currentStreak, // Возвращаем серверный streak
      questions,
      serverTime: now.toISOString(),
    });
  }

  // ═══ ANTI-ABUSE CHECKS для новой сессии ═══
  // (пропускаются если bypassLimits = true в dev режиме)

  // 1. Rate limiting - проверяем последнюю завершённую сессию
  if (!bypassLimits) {
    const lastSession = await prisma.quizSession.findFirst({
      where: { userId: user.id, quizId, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    });

    if (lastSession?.finishedAt) {
      const timeSinceLastSession = Date.now() - lastSession.finishedAt.getTime();
      if (timeSinceLastSession < RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastSession) / 1000);
        return NextResponse.json(
          { 
            error: "rate_limited", 
            message: `Подожди ${waitSeconds} секунд перед новой попыткой`,
            waitSeconds,
          },
          { status: 429 }
        );
      }
    }
  }

  // 2. Sliding window 24h - считаем попытки за последние 24 часа
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Получаем сессии за последние 24 часа (для расчёта когда освободится слот)
  const recentSessions = await prisma.quizSession.findMany({
    where: {
      userId: user.id,
      quizId,
      startedAt: { gte: twentyFourHoursAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });

  const attemptsIn24h = recentSessions.length;

  if (!bypassLimits && attemptsIn24h >= MAX_DAILY_ATTEMPTS) {
    // Когда освободится следующий слот (самая старая сессия + 24 часа)
    const oldestSession = recentSessions[0];
    const nextSlotAt = new Date(oldestSession.startedAt.getTime() + 24 * 60 * 60 * 1000);
    const waitMs = nextSlotAt.getTime() - Date.now();
    const waitMinutes = Math.ceil(waitMs / 60000);
    const waitHours = Math.floor(waitMinutes / 60);
    const remainingMinutes = waitMinutes % 60;
    
    // Формируем читаемое сообщение
    let waitMessage: string;
    if (waitHours > 0) {
      waitMessage = `${waitHours} ч ${remainingMinutes} мин`;
    } else {
      waitMessage = `${remainingMinutes} мин`;
    }

    return NextResponse.json(
      { 
        error: "daily_limit_reached", 
        message: `Лимит ${MAX_DAILY_ATTEMPTS} попыток за 24 часа исчерпан`,
        attemptsIn24h,
        maxDaily: MAX_DAILY_ATTEMPTS,
        nextSlotAt: nextSlotAt.toISOString(),
        waitMs,
        waitMessage,
      },
      { status: 429 }
    );
  }

  // 3. Считаем общее количество попыток для attemptNumber
  const totalAttempts = await prisma.quizSession.count({
    where: { userId: user.id, quizId },
  });

  const attemptNumber = totalAttempts + 1;

  // Создаём новую сессию с server-side time tracking и streak = 0
  const now = new Date();
  const session = await prisma.quizSession.create({
    data: { 
      quizId, 
      userId: user.id,
      attemptNumber,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: now, // Время начала первого вопроса
      currentStreak: 0, // Начинаем с 0 streak
    },
  });

  const questions = await getQuestions(quizId);

  return NextResponse.json({
    sessionId: session.id,
    quizId,
    attemptNumber,
    remainingAttempts: MAX_DAILY_ATTEMPTS - attemptsIn24h - 1,
    totalQuestions: questions.length,
    totalScore: session.totalScore,
    currentStreak: 0, // Начальный streak
    questions,
    serverTime: now.toISOString(), // Для синхронизации клиента
  });
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper function to get questions with shuffled options
async function getQuestions(quizId: number) {
  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      text: true,
      order: true,
      difficulty: true,
      answers: {
        select: {
          id: true,
          text: true,
        },
      },
    },
  });

  // Shuffle options for each question to prevent memorization
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    order: q.order,
    difficulty: q.difficulty,
    options: shuffleArray(q.answers.map((option) => ({
      id: option.id,
      text: option.text,
    }))),
  }));
}
