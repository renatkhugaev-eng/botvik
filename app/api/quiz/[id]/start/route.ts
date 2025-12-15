import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   ANTI-ABUSE: Rate Limiting & Energy System
   
   - Rate limit: 1 новая сессия в минуту
   - Energy system: 5 попыток, восстановление 1 попытки каждые 4 часа
   - Attempt tracking: номер попытки для decay scoring
   
   DEV BYPASS: Установи BYPASS_LIMITS=true в .env.local для отключения лимитов
═══════════════════════════════════════════════════════════════════════════ */

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_ATTEMPTS = 5; // Максимум попыток (энергия)
const HOURS_PER_ATTEMPT = 4; // Часов на восстановление 1 попытки
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000; // 4 часа в мс

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

  // Если есть незавершённая сессия - возвращаем её с проверкой timeout
  if (existingSession) {
    const questions = await getQuestions(quizId);
    const now = new Date();
    const QUESTION_TIME_MS = 15000; // 15 секунд на вопрос
    
    // Получаем полную сессию с временем начала вопроса
    let session = await prisma.quizSession.findUnique({
      where: { id: existingSession.id },
      select: { 
        id: true,
        currentQuestionStartedAt: true,
        currentQuestionIndex: true,
        currentStreak: true,
        totalScore: true,
        attemptNumber: true,
      },
    });
    
    if (!session) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }
    
    // ═══ SERVER-SIDE TIMEOUT CHECK ═══
    // Автоматически пропускаем вопросы с истёкшим временем
    let questionStartedAt = session.currentQuestionStartedAt;
    let currentIndex = session.currentQuestionIndex;
    let currentStreak = session.currentStreak;
    let skippedQuestions = 0;
    
    while (currentIndex < questions.length) {
      // Если время не установлено — устанавливаем сейчас
      if (!questionStartedAt) {
        questionStartedAt = now;
        await prisma.quizSession.update({
          where: { id: session.id },
          data: { currentQuestionStartedAt: now },
        });
        break;
      }
      
      // Проверяем, истекло ли время
      const elapsedMs = now.getTime() - questionStartedAt.getTime();
      
      if (elapsedMs < QUESTION_TIME_MS) {
        // Время ещё есть — выходим из цикла
        break;
      }
      
      // Время истекло — записываем timeout и переходим к следующему вопросу
      const currentQuestion = questions[currentIndex];
      
      // Проверяем, не был ли уже записан ответ
      const existingAnswer = await prisma.answer.findUnique({
        where: { sessionId_questionId: { sessionId: session.id, questionId: currentQuestion.id } },
      });
      
      if (!existingAnswer) {
        // Записываем timeout как ответ
        await prisma.answer.create({
          data: {
            sessionId: session.id,
            questionId: currentQuestion.id,
            optionId: null, // Timeout - no option selected
            isCorrect: false,
            timeSpentMs: QUESTION_TIME_MS,
            scoreDelta: 0,
          },
        });
        skippedQuestions++;
      }
      
      // Переходим к следующему вопросу
      currentIndex++;
      currentStreak = 0; // Reset streak on timeout
      questionStartedAt = now; // Новое время для следующего вопроса
      
      // Обновляем сессию
      await prisma.quizSession.update({
        where: { id: session.id },
        data: {
          currentQuestionIndex: currentIndex,
          currentQuestionStartedAt: now,
          currentStreak: 0,
        },
      });
    }
    
    // Если пропустили все вопросы — завершаем квиз
    if (currentIndex >= questions.length) {
      const finishedSession = await prisma.quizSession.update({
        where: { id: session.id },
        data: { finishedAt: now },
        select: { totalScore: true },
      });
      
      return NextResponse.json({
        sessionId: session.id,
        quizId,
        attemptNumber: session.attemptNumber,
        totalQuestions: questions.length,
        totalScore: finishedSession.totalScore,
        currentQuestionIndex: currentIndex,
        currentStreak: 0,
        questions,
        serverTime: now.toISOString(),
        questionStartedAt: now.toISOString(),
        finished: true,
        skippedQuestions,
      });
    }
    
    return NextResponse.json({
      sessionId: session.id,
      quizId,
      attemptNumber: session.attemptNumber,
      totalQuestions: questions.length,
      totalScore: session.totalScore,
      currentQuestionIndex: currentIndex,
      currentStreak: currentStreak,
      questions,
      serverTime: now.toISOString(),
      questionStartedAt: questionStartedAt?.toISOString() ?? now.toISOString(),
      skippedQuestions: skippedQuestions > 0 ? skippedQuestions : undefined,
    });
  }

  // ═══ ANTI-ABUSE CHECKS для новой сессии ═══
  // (пропускаются если bypassLimits = true в dev режиме)

  // 1. Energy system - ОБЩАЯ энергия на ВСЕ квизы (не per-quiz)
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);

  // Считаем ВСЕ сессии пользователя за период cooldown (не только для этого квиза)
  const recentSessions = await prisma.quizSession.findMany({
    where: {
      userId: user.id,
      // БЕЗ фильтра quizId — считаем глобально
      startedAt: { gte: cooldownAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true, quizId: true },
  });

  const usedAttempts = recentSessions.length;

  if (!bypassLimits && usedAttempts >= MAX_ATTEMPTS) {
    // Когда освободится следующий слот (самая старая сессия + cooldown)
    const oldestSession = recentSessions[0];
    const nextSlotAt = new Date(oldestSession.startedAt.getTime() + ATTEMPT_COOLDOWN_MS);
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
        error: "energy_depleted", 
        message: `Энергия закончилась! Восстановление через ${waitMessage}`,
        usedAttempts,
        maxAttempts: MAX_ATTEMPTS,
        nextSlotAt: nextSlotAt.toISOString(),
        waitMs,
        waitMessage,
        hoursPerAttempt: HOURS_PER_ATTEMPT,
      },
      { status: 429 }
    );
  }

  // 2. Rate limiting - проверяем последнюю завершённую сессию (между попытками)
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
    remainingAttempts: MAX_ATTEMPTS - usedAttempts - 1,
    totalQuestions: questions.length,
    totalScore: session.totalScore,
    currentStreak: 0, // Начальный streak
    questions,
    serverTime: now.toISOString(),
    questionStartedAt: now.toISOString(), // Время начала первого вопроса
    energyInfo: {
      used: usedAttempts + 1,
      max: MAX_ATTEMPTS,
      hoursPerAttempt: HOURS_PER_ATTEMPT,
    },
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
