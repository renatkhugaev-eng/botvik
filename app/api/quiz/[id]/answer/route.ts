import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, quizAnswerLimiter, getClientIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

type AnswerRequestBody = {
  sessionId?: number;
  questionId?: number;
  optionId?: number;
  timeSpentMs?: number;
  // streak больше не принимается от клиента — считается на сервере
};

/* ═══════════════════════════════════════════════════════════════════════════
   FAIR SCORING SYSTEM v2.0
   
   Формула: POINTS = (BASE × DIFFICULTY × ATTEMPT_DECAY) + TIME_BONUS + STREAK_BONUS
   
   Компоненты:
   - BASE: 100 очков за правильный ответ
   - DIFFICULTY: 1.0x (легкий) → 1.5x (средний) → 2.0x (сложный)
   - ATTEMPT_DECAY: попытка 1 = 100%, попытка 2 = 70%, попытка 3 = 50%...
   - TIME_BONUS: 0-50 очков (линейно убывает от 0 до 15 сек)
   - STREAK_BONUS: +10 очков за каждый ответ в серии (макс +50)
   - WRONG_PENALTY: -15 очков за неправильный ответ (с учётом attempt decay)
   
   Anti-abuse:
   - Минимальное время ответа: 400ms (защита от ботов)
   - Максимальное время не ограничено (но бонус = 0)
   
   Примеры (попытка 1, средняя сложность):
   - Ответ за 1 сек, без серии: (100 × 1.5 × 1.0) + 48 + 0 = 198
   - Ответ за 7 сек, серия 3: (100 × 1.5 × 1.0) + 27 + 30 = 207
   - Неправильный ответ: -15 × 1.0 = -15 (но минимум 0 за сессию)
   
   Примеры (попытка 3, сложный вопрос):
   - Ответ за 2 сек, серия 5: (100 × 2.0 × 0.5) + 43 + 50 = 193
═══════════════════════════════════════════════════════════════════════════ */

const BASE_SCORE = 100;                    // Базовые очки за правильный ответ
const MAX_TIME_BONUS = 50;                 // Максимальный бонус за скорость
const TIME_LIMIT_MS = 15000;               // Лимит времени для бонуса (15 сек)
const STREAK_BONUS_PER = 10;               // Бонус за каждый ответ в серии
const MAX_STREAK_BONUS = 50;               // Максимальный бонус за серию
const WRONG_PENALTY = 15;                  // Штраф за неправильный ответ
const MIN_ANSWER_TIME_MS = 400;            // Минимальное время (защита от ботов)

// Множители сложности: 1 = легкий, 2 = средний, 3 = сложный
const DIFFICULTY_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.0,
};

// Decay множители для попыток (чем больше попыток - тем меньше очков)
const ATTEMPT_DECAY: Record<number, number> = {
  1: 1.0,   // Первая попытка - 100%
  2: 0.7,   // Вторая попытка - 70%
  3: 0.5,   // Третья попытка - 50%
  4: 0.35,  // Четвёртая попытка - 35%
  5: 0.25,  // Пятая попытка - 25%
};

function getAttemptMultiplier(attemptNumber: number): number {
  if (attemptNumber <= 0) return 1.0;
  if (attemptNumber > 5) return 0.2; // После 5 попытки - только 20%
  return ATTEMPT_DECAY[attemptNumber] ?? 0.2;
}

function getDifficultyMultiplier(difficulty: number): number {
  return DIFFICULTY_MULTIPLIERS[difficulty] ?? 1.0;
}

function calculateTimeBonus(timeSpentMs: number): number {
  // Если ответил слишком быстро - подозрительно, но бонус даём
  if (timeSpentMs < MIN_ANSWER_TIME_MS) return MAX_TIME_BONUS;
  
  // Если превысил лимит — 0
  if (timeSpentMs >= TIME_LIMIT_MS) return 0;
  
  // Линейное уменьшение бонуса
  const remainingTime = TIME_LIMIT_MS - timeSpentMs;
  const bonus = Math.round((remainingTime / TIME_LIMIT_MS) * MAX_TIME_BONUS);
  
  return Math.max(0, bonus);
}

function calculateStreakBonus(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(streak * STREAK_BONUS_PER, MAX_STREAK_BONUS);
}

function calculateScore(params: {
  isCorrect: boolean;
  timeSpentMs: number;
  streak: number;
  difficulty: number;
  attemptNumber: number;
}): { scoreDelta: number; breakdown: ScoreBreakdown } {
  const { isCorrect, timeSpentMs, streak, difficulty, attemptNumber } = params;
  
  const difficultyMult = getDifficultyMultiplier(difficulty);
  const attemptMult = getAttemptMultiplier(attemptNumber);
  
  // Подозрительно быстрый ответ - помечаем но не блокируем
  const isSuspicious = timeSpentMs < MIN_ANSWER_TIME_MS;
  
  if (!isCorrect) {
    // Штраф за неправильный ответ (с учётом attempt decay)
    const penalty = Math.round(WRONG_PENALTY * attemptMult);
    return {
      scoreDelta: -penalty,
      breakdown: {
        base: 0,
        difficultyMultiplier: difficultyMult,
        attemptMultiplier: attemptMult,
        timeBonus: 0,
        streakBonus: 0,
        penalty,
        timeSpentMs,
        isSuspicious,
      },
    };
  }
  
  // Правильный ответ
  const baseWithDifficulty = Math.round(BASE_SCORE * difficultyMult);
  const baseWithDecay = Math.round(baseWithDifficulty * attemptMult);
  const timeBonus = Math.round(calculateTimeBonus(timeSpentMs) * attemptMult);
  const streakBonus = Math.round(calculateStreakBonus(streak) * attemptMult);
  
  const scoreDelta = baseWithDecay + timeBonus + streakBonus;
  
  return {
    scoreDelta,
    breakdown: {
      base: baseWithDecay,
      difficultyMultiplier: difficultyMult,
      attemptMultiplier: attemptMult,
      timeBonus,
      streakBonus,
      penalty: 0,
      timeSpentMs,
      isSuspicious,
    },
  };
}

type ScoreBreakdown = {
  base: number;
  difficultyMultiplier: number;
  attemptMultiplier: number;
  timeBonus: number;
  streakBonus: number;
  penalty: number;
  timeSpentMs: number;
  isSuspicious: boolean;
};

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req, user.telegramId);
  const rateLimit = await checkRateLimit(quizAnswerLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const { id } = await context.params;
  const quizId = Number(id);
  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  let body: AnswerRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  const questionId = body.questionId;
  const optionId = body.optionId;
  const timeSpentMs = Math.max(0, Number(body.timeSpentMs ?? 0));

  if (!sessionId || !questionId || !optionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Получаем сессию с attemptNumber, server-side time tracking и streak
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: { 
      id: true, 
      userId: true,  // For ownership validation
      quizId: true, 
      finishedAt: true, 
      totalScore: true, 
      attemptNumber: true,
      currentQuestionIndex: true,
      currentQuestionStartedAt: true,
      currentStreak: true, // Server-side streak
    },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // ═══ OWNERSHIP VALIDATION ═══
  if (session.userId !== user.id) {
    return NextResponse.json({ error: "session_not_yours" }, { status: 403 });
  }

  if (session.finishedAt) {
    return NextResponse.json({ error: "session_finished" }, { status: 400 });
  }

  // ═══ QUESTION ORDER VALIDATION ═══
  // Получаем список вопросов в правильном порядке
  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: { id: true, difficulty: true, order: true },
  });

  // Проверяем, что пользователь отвечает на правильный вопрос
  const expectedQuestion = questions[session.currentQuestionIndex];
  
  if (!expectedQuestion) {
    return NextResponse.json({ error: "quiz_completed" }, { status: 400 });
  }

  if (expectedQuestion.id !== questionId) {
    return NextResponse.json({ 
      error: "wrong_question_order",
      message: `Ожидается вопрос ${session.currentQuestionIndex + 1}, получен другой`,
      expectedQuestionId: expectedQuestion.id,
      receivedQuestionId: questionId,
    }, { status: 400 });
  }

  // Проверяем, не был ли уже дан ответ на этот вопрос (дополнительная защита)
  const existingAnswer = await prisma.answer.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });

  if (existingAnswer) {
    return NextResponse.json({ error: "already_answered" }, { status: 400 });
  }

  const question = expectedQuestion;

  const correctOption = await prisma.answerOption.findFirst({
    where: { questionId, isCorrect: true },
    select: { id: true },
  });

  if (!correctOption) {
    return NextResponse.json({ error: "correct_option_missing" }, { status: 400 });
  }

  // ═══ SERVER-SIDE TIME CALCULATION & TIMEOUT CHECK ═══
  const now = new Date();
  const QUESTION_TIME_MS = 15000; // 15 секунд на вопрос
  const GRACE_PERIOD_MS = 2000;   // 2 секунды grace period для сетевых задержек
  
  let serverTimeSpentMs = timeSpentMs; // Fallback на клиентское время
  
  if (session.currentQuestionStartedAt) {
    serverTimeSpentMs = now.getTime() - session.currentQuestionStartedAt.getTime();
    
    // Защита от отрицательного времени (в случае проблем с синхронизацией)
    if (serverTimeSpentMs < 0) serverTimeSpentMs = timeSpentMs;
    
    // ═══ TIMEOUT CHECK ═══
    // Если время истекло (с grace period для сетевых задержек) — записываем timeout
    if (serverTimeSpentMs > QUESTION_TIME_MS + GRACE_PERIOD_MS) {
      // Записываем как timeout
      await prisma.$transaction(async (tx) => {
        await tx.answer.create({
          data: {
            sessionId,
            questionId,
            optionId: null, // Timeout - no option selected
            isCorrect: false,
            timeSpentMs: QUESTION_TIME_MS,
            scoreDelta: 0,
          },
        });
        
        await tx.quizSession.update({
          where: { id: sessionId },
          data: {
            currentQuestionIndex: session.currentQuestionIndex + 1,
            currentQuestionStartedAt: now,
            currentStreak: 0,
          },
        });
      });
      
      return NextResponse.json({
        correct: false,
        scoreDelta: 0,
        totalScore: session.totalScore,
        streak: 0,
        timeout: true,
        message: "Время истекло",
      });
    }
    
    // Максимум 60 секунд (защита от зависших сессий)
    if (serverTimeSpentMs > 60000) serverTimeSpentMs = 60000;
  }

  const isCorrect = correctOption.id === optionId;
  
  // ═══ SERVER-SIDE STREAK ═══
  // Streak учитывается ДО ответа (текущая серия правильных)
  const currentStreak = session.currentStreak;
  
  // Рассчитываем очки с серверным временем и серверным streak
  const { scoreDelta, breakdown } = calculateScore({
    isCorrect,
    timeSpentMs: serverTimeSpentMs,
    streak: currentStreak, // Используем серверный streak
    difficulty: question.difficulty,
    attemptNumber: session.attemptNumber,
  });

  // Новый streak: +1 если правильно, 0 если неправильно
  const newStreak = isCorrect ? currentStreak + 1 : 0;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.answer.create({
      data: {
        sessionId,
        questionId,
        optionId,
        isCorrect,
        timeSpentMs: serverTimeSpentMs, // Сохраняем серверное время
        scoreDelta,
      },
    });

    // Обновляем totalScore, streak и переходим к следующему вопросу
    const newScore = Math.max(0, session.totalScore + scoreDelta);
    
    const updatedSession = await tx.quizSession.update({
      where: { id: sessionId },
      data: {
        totalScore: newScore,
        currentQuestionIndex: session.currentQuestionIndex + 1,
        currentQuestionStartedAt: now, // Время начала следующего вопроса
        currentStreak: newStreak, // Обновляем серверный streak
      },
      select: { totalScore: true, currentStreak: true },
    });

    return { 
      totalScore: updatedSession.totalScore,
      newStreak: updatedSession.currentStreak,
    };
  });

  return NextResponse.json({
    correct: isCorrect,
    scoreDelta,
    totalScore: result.totalScore,
    streak: result.newStreak, // Возвращаем новый streak для UI
    breakdown: {
      ...breakdown,
      serverTimeSpentMs, // Показываем серверное время для прозрачности
      clientTimeSpentMs: timeSpentMs,
      streakUsed: currentStreak, // Какой streak был использован для расчёта
    },
  });
}
