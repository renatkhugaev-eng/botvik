/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL ANSWER API — Серверная запись ответов игроков
 * 
 * SECURITY: Все ответы записываются на сервер для:
 * - Защиты от подделки очков на клиенте
 * - Верификации правильности ответов
 * - Аудита и разрешения споров
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { seededShuffle } from "@/lib/seeded-shuffle";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

// Rate limiter: 30 ответов в минуту (достаточно для быстрой игры, но защита от спама)
// В dev-режиме без Redis — пропускаем rate limiting
let answerLimiter: Ratelimit | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = Redis.fromEnv();
    answerLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "duel:answer",
    });
  }
} catch (e) {
  console.warn("[Duel Answer] Redis not configured, skipping rate limiting");
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AnswerRequestBody = {
  questionIndex: number;
  optionId: number | null;  // null = таймаут
  timeSpentMs: number;
};

// Константы скоринга дуэлей (упрощённая система)
const DUEL_POINTS_PER_CORRECT = 100;
const MIN_ANSWER_TIME_MS = 300;     // Минимальное время для защиты от читов
const MAX_ANSWER_TIME_MS = 20000;   // Максимальное время с запасом

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/duels/[id]/answer — Записать ответ игрока
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ═══ AUTHENTICATION ═══
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { id: duelId } = await context.params;
    const userId = auth.user.id;

    // ═══ RATE LIMITING ═══
    if (answerLimiter) {
      const { success } = await answerLimiter.limit(`${userId}:${duelId}`);
      if (!success) {
        console.warn(`[Duel Answer] Rate limit exceeded for user ${userId} in duel ${duelId}`);
        return NextResponse.json(
          { ok: false, error: "RATE_LIMIT", message: "Слишком много запросов" },
          { status: 429 }
        );
      }
    }

    // ═══ PARSE BODY ═══
    let body: AnswerRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { questionIndex, optionId, timeSpentMs } = body;

    // ═══ VALIDATION ═══
    if (typeof questionIndex !== "number" || questionIndex < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_QUESTION_INDEX" }, { status: 400 });
    }

    if (typeof timeSpentMs !== "number" || timeSpentMs < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_TIME" }, { status: 400 });
    }

    // Клампируем время (защита от читов и аномалий)
    const clampedTimeMs = Math.max(MIN_ANSWER_TIME_MS, Math.min(timeSpentMs, MAX_ANSWER_TIME_MS));

    // ═══ GET DUEL WITH QUIZ ═══
    const duel = await prisma.duel.findUnique({
      where: { id: duelId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: {
                answers: {
                  select: { id: true, isCorrect: true },
                },
              },
            },
          },
        },
      },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "DUEL_NOT_FOUND" }, { status: 404 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ANTI-CHEAT: Применяем тот же shuffle что и в start/route.ts
    // Используем duelId как seed для детерминированного порядка
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Shuffle вопросов в том же порядке что и при старте
    const shuffledQuestions = seededShuffle(duel.quiz.questions, duelId);

    // ═══ PARTICIPANT CHECK ═══
    if (duel.challengerId !== userId && duel.opponentId !== userId) {
      console.warn(`[Duel Answer] User ${userId} is not a participant of duel ${duelId}`);
      return NextResponse.json({ ok: false, error: "NOT_PARTICIPANT" }, { status: 403 });
    }

    // ═══ STATUS CHECK ═══
    if (duel.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { ok: false, error: "DUEL_NOT_IN_PROGRESS", status: duel.status },
        { status: 400 }
      );
    }

    // ═══ QUESTION BOUNDS CHECK ═══
    if (questionIndex >= shuffledQuestions.length) {
      return NextResponse.json({ ok: false, error: "QUESTION_OUT_OF_BOUNDS" }, { status: 400 });
    }

    // ═══ SERVER-SIDE TIME VALIDATION ═══
    // Проверяем что прошло достаточно времени с начала дуэли
    if (duel.startedAt) {
      const elapsedSinceStart = Date.now() - duel.startedAt.getTime();
      // Минимальное время = (индекс вопроса * мин. время на вопрос)
      // Это предотвращает ответ на вопрос быстрее чем физически возможно
      const minTimeForQuestion = questionIndex * MIN_ANSWER_TIME_MS;
      
      if (elapsedSinceStart < minTimeForQuestion) {
        console.warn(
          `[Duel Answer] Suspicious timing: user ${userId} answered Q${questionIndex} ` +
          `only ${elapsedSinceStart}ms after duel start (min: ${minTimeForQuestion}ms)`
        );
        // Не блокируем, но логируем для анализа
      }
    }

    // ═══ CHECK FOR DUPLICATE ANSWER ═══
    const existingAnswer = await prisma.duelAnswer.findUnique({
      where: {
        duelId_userId_questionIndex: {
          duelId,
          userId,
          questionIndex,
        },
      },
    });

    if (existingAnswer) {
      // Идемпотентность — возвращаем существующий ответ
      return NextResponse.json({
        ok: true,
        alreadyAnswered: true,
        answer: {
          questionIndex: existingAnswer.questionIndex,
          isCorrect: existingAnswer.isCorrect,
          optionId: existingAnswer.optionId,
        },
      });
    }

    // ═══ VERIFY CORRECT ANSWER ═══
    // Используем shuffled порядок вопросов
    const question = shuffledQuestions[questionIndex];
    const correctOption = question.answers.find((a) => a.isCorrect);
    
    // Определяем правильность ответа
    // null optionId = таймаут = неправильно
    const isCorrect = optionId !== null && correctOption?.id === optionId;

    // ═══ VALIDATE OPTION ID (если не таймаут) ═══
    if (optionId !== null) {
      const validOptionIds = question.answers.map((a) => a.id);
      if (!validOptionIds.includes(optionId)) {
        console.warn(`[Duel Answer] Invalid optionId ${optionId} for question ${questionIndex} in duel ${duelId}`);
        return NextResponse.json({ ok: false, error: "INVALID_OPTION_ID" }, { status: 400 });
      }
    }

    // ═══ RECORD ANSWER ═══
    const answer = await prisma.duelAnswer.create({
      data: {
        duelId,
        userId,
        questionIndex,
        optionId,
        isCorrect,
        timeSpentMs: clampedTimeMs,
      },
    });

    console.log(
      `[Duel Answer] User ${userId} answered Q${questionIndex} in duel ${duelId}: ` +
      `optionId=${optionId}, isCorrect=${isCorrect}, timeMs=${clampedTimeMs}`
    );

    // NOTE: correctOptionId отправляется для UI (показ правильного ответа обоим игрокам)
    // Защита от читерства при реванше реализована через рандомизацию вопросов в start/route.ts
    return NextResponse.json({
      ok: true,
      answer: {
        questionIndex: answer.questionIndex,
        isCorrect: answer.isCorrect,
        optionId: answer.optionId,
        correctOptionId: correctOption?.id ?? null,
        timeSpentMs: answer.timeSpentMs,
      },
    });
  } catch (error) {
    console.error("[Duel Answer] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/duels/[id]/answer — Получить все ответы игрока в дуэли
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { id: duelId } = await context.params;
    const userId = auth.user.id;
    
    // Проверяем параметр checkOpponent для AI-режима
    const { searchParams } = new URL(request.url);
    const checkOpponentId = searchParams.get("checkOpponent");

    // Получаем дуэль для проверки участия
    const duel = await prisma.duel.findUnique({
      where: { id: duelId },
      select: {
        challengerId: true,
        opponentId: true,
        status: true,
      },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "DUEL_NOT_FOUND" }, { status: 404 });
    }

    if (duel.challengerId !== userId && duel.opponentId !== userId) {
      return NextResponse.json({ ok: false, error: "NOT_PARTICIPANT" }, { status: 403 });
    }

    // Если запрашиваем ответы оппонента (для AI-режима)
    if (checkOpponentId) {
      const opponentId = parseInt(checkOpponentId, 10);
      
      // Проверяем что запрашиваемый ID — действительно оппонент в этой дуэли
      if (opponentId !== duel.challengerId && opponentId !== duel.opponentId) {
        return NextResponse.json({ ok: false, error: "INVALID_OPPONENT_ID" }, { status: 400 });
      }
      
      // Получаем ответы оппонента (минимум данных для проверки)
      const opponentAnswers = await prisma.duelAnswer.findMany({
        where: {
          duelId,
          userId: opponentId,
        },
        orderBy: { questionIndex: "asc" },
        select: {
          questionIndex: true,
          isCorrect: true,
        },
      });

      return NextResponse.json({
        ok: true,
        answers: opponentAnswers,
      });
    }

    // Получаем ответы текущего пользователя
    const answers = await prisma.duelAnswer.findMany({
      where: {
        duelId,
        userId,
      },
      orderBy: { questionIndex: "asc" },
      select: {
        questionIndex: true,
        optionId: true,
        isCorrect: true,
        timeSpentMs: true,
        createdAt: true,
      },
    });

    // Подсчитываем очки
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const totalScore = correctCount * DUEL_POINTS_PER_CORRECT;

    return NextResponse.json({
      ok: true,
      answers,
      stats: {
        answered: answers.length,
        correct: correctCount,
        score: totalScore,
      },
    });
  } catch (error) {
    console.error("[Duel Answer GET] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

