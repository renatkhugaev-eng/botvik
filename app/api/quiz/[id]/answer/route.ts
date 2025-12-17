import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, quizAnswerLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { getCachedQuestions, cacheQuestions } from "@/lib/quiz-cache";

export const runtime = "nodejs";

type AnswerRequestBody = {
  sessionId?: number;
  questionId?: number;
  optionId?: number;
  timeSpentMs?: number;
};

/* ═══════════════════════════════════════════════════════════════════════════
   FAIR SCORING SYSTEM v2.0 (OPTIMIZED)
   
   Оптимизации:
   - Кеширование вопросов квиза (5 мин TTL)
   - Объединение запросов к БД (6 → 2)
   - Убрана избыточная проверка existingAnswer
   
   Формула: POINTS = (BASE × DIFFICULTY × ATTEMPT_DECAY) + TIME_BONUS + STREAK_BONUS
═══════════════════════════════════════════════════════════════════════════ */

const BASE_SCORE = 100;
const MAX_TIME_BONUS = 50;
const TIME_LIMIT_MS = 15000;
const STREAK_BONUS_PER = 10;
const MAX_STREAK_BONUS = 50;
const WRONG_PENALTY = 15;
const MIN_ANSWER_TIME_MS = 400;
const QUESTION_TIME_MS = 15000;
const GRACE_PERIOD_MS = 2000;

const DIFFICULTY_MULTIPLIERS: Record<number, number> = { 1: 1.0, 2: 1.5, 3: 2.0 };
const ATTEMPT_DECAY: Record<number, number> = { 1: 1.0, 2: 0.7, 3: 0.5, 4: 0.35, 5: 0.25 };

function getAttemptMultiplier(n: number): number {
  if (n <= 0) return 1.0;
  if (n > 5) return 0.2;
  return ATTEMPT_DECAY[n] ?? 0.2;
}

function getDifficultyMultiplier(d: number): number {
  return DIFFICULTY_MULTIPLIERS[d] ?? 1.0;
}

function calculateTimeBonus(ms: number): number {
  if (ms < MIN_ANSWER_TIME_MS) return MAX_TIME_BONUS;
  if (ms >= TIME_LIMIT_MS) return 0;
  return Math.max(0, Math.round(((TIME_LIMIT_MS - ms) / TIME_LIMIT_MS) * MAX_TIME_BONUS));
}

function calculateStreakBonus(streak: number): number {
  return streak <= 0 ? 0 : Math.min(streak * STREAK_BONUS_PER, MAX_STREAK_BONUS);
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
  const isSuspicious = timeSpentMs < MIN_ANSWER_TIME_MS;
  
  if (!isCorrect) {
    const penalty = Math.round(WRONG_PENALTY * attemptMult);
    return {
      scoreDelta: -penalty,
      breakdown: {
        base: 0, difficultyMultiplier: difficultyMult, attemptMultiplier: attemptMult,
        timeBonus: 0, streakBonus: 0, penalty, timeSpentMs, isSuspicious,
      },
    };
  }
  
  const baseWithDecay = Math.round(BASE_SCORE * difficultyMult * attemptMult);
  const timeBonus = Math.round(calculateTimeBonus(timeSpentMs) * attemptMult);
  const streakBonus = Math.round(calculateStreakBonus(streak) * attemptMult);
  
  return {
    scoreDelta: baseWithDecay + timeBonus + streakBonus,
    breakdown: {
      base: baseWithDecay, difficultyMultiplier: difficultyMult, attemptMultiplier: attemptMult,
      timeBonus, streakBonus, penalty: 0, timeSpentMs, isSuspicious,
    },
  };
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  // ═══ RATE LIMITING (temporarily disabled for debugging) ═══
  // const identifier = getClientIdentifier(req, user.telegramId);
  // const rateLimit = await checkRateLimit(quizAnswerLimiter, identifier);
  // if (rateLimit.limited) {
  //   return rateLimit.response;
  // }

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

  const { sessionId, questionId, optionId, timeSpentMs: clientTimeMs } = body;
  const timeSpentMs = Math.max(0, Number(clientTimeMs ?? 0));

  if (!sessionId || !questionId || !optionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // ═══ OPTIMIZED: Single query for session ═══
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      quizId: true,
      finishedAt: true,
      totalScore: true,
      attemptNumber: true,
      currentQuestionIndex: true,
      currentQuestionStartedAt: true,
      currentStreak: true,
    },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  if (session.userId !== user.id) {
    return NextResponse.json({ error: "session_not_yours" }, { status: 403 });
  }

  if (session.finishedAt) {
    return NextResponse.json({ error: "session_finished" }, { status: 400 });
  }

  // ═══ OPTIMIZED: Get questions from cache or DB ═══
  let questions = getCachedQuestions(quizId);
  
  if (!questions) {
    // Cache miss - fetch from DB with correct options included
    const dbQuestions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        difficulty: true,
        order: true,
        answers: {
          where: { isCorrect: true },
          select: { id: true },
          take: 1,
        },
      },
    });
    
    questions = dbQuestions.map(q => ({
      id: q.id,
      order: q.order,
      difficulty: q.difficulty,
      correctOptionId: q.answers[0]?.id ?? -1,
    }));
    
    // Cache for next requests
    cacheQuestions(quizId, questions);
  }

  // ═══ VALIDATE QUESTION ORDER ═══
  const expectedQuestion = questions[session.currentQuestionIndex];
  
  if (!expectedQuestion) {
    return NextResponse.json({ error: "quiz_completed" }, { status: 400 });
  }

  if (expectedQuestion.id !== questionId) {
    return NextResponse.json({
      error: "wrong_question_order",
      message: `Expected question ${session.currentQuestionIndex + 1}`,
    }, { status: 400 });
  }

  if (expectedQuestion.correctOptionId === -1) {
    return NextResponse.json({ error: "correct_option_missing" }, { status: 400 });
  }

  // ═══ SERVER-SIDE TIME CALCULATION ═══
  const now = new Date();
  let serverTimeSpentMs = timeSpentMs;
  
  if (session.currentQuestionStartedAt) {
    serverTimeSpentMs = now.getTime() - session.currentQuestionStartedAt.getTime();
    if (serverTimeSpentMs < 0) serverTimeSpentMs = timeSpentMs;
    
    // ═══ TIMEOUT CHECK ═══
    if (serverTimeSpentMs > QUESTION_TIME_MS + GRACE_PERIOD_MS) {
      await prisma.$transaction([
        prisma.answer.create({
          data: {
            sessionId,
            questionId,
            optionId: null,
            isCorrect: false,
            timeSpentMs: QUESTION_TIME_MS,
            scoreDelta: 0,
          },
        }),
        prisma.quizSession.update({
          where: { id: sessionId },
          data: {
            currentQuestionIndex: session.currentQuestionIndex + 1,
            currentQuestionStartedAt: now,
            currentStreak: 0,
          },
        }),
      ]);
      
      return NextResponse.json({
        correct: false,
        scoreDelta: 0,
        totalScore: session.totalScore,
        streak: 0,
        timeout: true,
        message: "Время истекло",
      });
    }
    
    if (serverTimeSpentMs > 60000) serverTimeSpentMs = 60000;
  }

  // ═══ CALCULATE SCORE ═══
  const isCorrect = expectedQuestion.correctOptionId === optionId;
  const currentStreak = session.currentStreak;
  
  const { scoreDelta, breakdown } = calculateScore({
    isCorrect,
    timeSpentMs: serverTimeSpentMs,
    streak: currentStreak,
    difficulty: expectedQuestion.difficulty,
    attemptNumber: session.attemptNumber,
  });

  const newStreak = isCorrect ? currentStreak + 1 : 0;
  const newScore = Math.max(0, session.totalScore + scoreDelta);

  // ═══ OPTIMIZED: Single transaction with batch operations ═══
  // currentQuestionStartedAt = null — таймер следующего вопроса начнётся
  // когда клиент вызовет /view (показ вопроса пользователю)
  await prisma.$transaction([
    prisma.answer.create({
      data: {
        sessionId,
        questionId,
        optionId,
        isCorrect,
        timeSpentMs: serverTimeSpentMs,
        scoreDelta,
      },
    }),
    prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        totalScore: newScore,
        currentQuestionIndex: session.currentQuestionIndex + 1,
        currentQuestionStartedAt: null,
        currentStreak: newStreak,
      },
    }),
  ]);

  return NextResponse.json({
    correct: isCorrect,
    scoreDelta,
    totalScore: newScore,
    streak: newStreak,
    breakdown: {
      ...breakdown,
      serverTimeSpentMs,
      clientTimeSpentMs: timeSpentMs,
      streakUsed: currentStreak,
    },
  });
}
