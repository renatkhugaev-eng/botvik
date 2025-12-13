import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   ANTI-ABUSE: Rate Limiting & Daily Limits
   
   - Rate limit: 1 новая сессия в минуту
   - Daily limit: 5 попыток в день на квиз
   - Attempt tracking: номер попытки для decay scoring
═══════════════════════════════════════════════════════════════════════════ */

const RATE_LIMIT_MS = 60_000; // 1 минута между сессиями
const MAX_DAILY_ATTEMPTS = 5; // Максимум попыток в день

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
  });

  // Если есть незавершённая сессия - возвращаем её
  if (existingSession) {
    const questions = await getQuestions(quizId);
    return NextResponse.json({
      sessionId: existingSession.id,
      quizId,
      attemptNumber: existingSession.attemptNumber,
      totalQuestions: questions.length,
      totalScore: existingSession.totalScore,
      questions,
    });
  }

  // ═══ ANTI-ABUSE CHECKS для новой сессии ═══

  // 1. Rate limiting - проверяем последнюю завершённую сессию
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

  // 2. Daily limit - считаем попытки за сегодня
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dailyAttempts = await prisma.quizSession.count({
    where: {
      userId: user.id,
      quizId,
      startedAt: { gte: todayStart },
    },
  });

  if (dailyAttempts >= MAX_DAILY_ATTEMPTS) {
    return NextResponse.json(
      { 
        error: "daily_limit_reached", 
        message: `Ты исчерпал ${MAX_DAILY_ATTEMPTS} попыток на сегодня. Возвращайся завтра!`,
        attemptsToday: dailyAttempts,
        maxDaily: MAX_DAILY_ATTEMPTS,
      },
      { status: 429 }
    );
  }

  // 3. Считаем общее количество попыток для attemptNumber
  const totalAttempts = await prisma.quizSession.count({
    where: { userId: user.id, quizId },
  });

  const attemptNumber = totalAttempts + 1;

  // Создаём новую сессию
  const session = await prisma.quizSession.create({
    data: { 
      quizId, 
      userId: user.id,
      attemptNumber,
    },
  });

  const questions = await getQuestions(quizId);

  return NextResponse.json({
    sessionId: session.id,
    quizId,
    attemptNumber,
    remainingAttempts: MAX_DAILY_ATTEMPTS - dailyAttempts - 1,
    totalQuestions: questions.length,
    totalScore: session.totalScore,
    questions,
  });
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

  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    order: q.order,
    difficulty: q.difficulty,
    options: q.answers.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  }));
}
