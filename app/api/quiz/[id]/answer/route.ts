import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AnswerRequestBody = {
  sessionId?: number;
  questionId?: number;
  optionId?: number;
  timeSpentMs?: number;
  streak?: number;
};

/* ═══════════════════════════════════════════════════════════════════════════
   FAIR SCORING SYSTEM (Kahoot-style)
   
   Формула: POINTS = BASE + TIME_BONUS + STREAK_BONUS
   
   - BASE: 100 очков за правильный ответ
   - TIME_BONUS: 0-50 очков (линейно убывает от 0 до 15 сек)
   - STREAK_BONUS: +10 очков за каждый ответ в серии (макс +30)
   
   Примеры:
   - Ответ за 1 сек, без серии: 100 + 50 + 0 = 150
   - Ответ за 7 сек, серия 3: 100 + 27 + 30 = 157
   - Ответ за 14 сек, серия 1: 100 + 3 + 10 = 113
   - Неправильный ответ: 0
═══════════════════════════════════════════════════════════════════════════ */

const BASE_SCORE = 100;        // Базовые очки за правильный ответ
const MAX_TIME_BONUS = 50;     // Максимальный бонус за скорость
const TIME_LIMIT_MS = 15000;   // Лимит времени (15 сек)
const STREAK_BONUS = 10;       // Бонус за каждый ответ в серии
const MAX_STREAK_BONUS = 30;   // Максимальный бонус за серию

function calculateTimeBonus(timeSpentMs: number): number {
  // Если ответил мгновенно или очень быстро — максимум
  if (timeSpentMs <= 500) return MAX_TIME_BONUS;
  
  // Если превысил лимит — 0
  if (timeSpentMs >= TIME_LIMIT_MS) return 0;
  
  // Линейное уменьшение бонуса
  const remainingTime = TIME_LIMIT_MS - timeSpentMs;
  const bonus = Math.round((remainingTime / TIME_LIMIT_MS) * MAX_TIME_BONUS);
  
  return Math.max(0, bonus);
}

function calculateStreakBonus(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(streak * STREAK_BONUS, MAX_STREAK_BONUS);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  const streak = Math.max(0, Number(body.streak ?? 0));

  if (!sessionId || !questionId || !optionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: { id: true, quizId: true, finishedAt: true, totalScore: true },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  if (session.finishedAt) {
    return NextResponse.json({ error: "session_finished" }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, quizId: true },
  });

  if (!question || question.quizId !== quizId) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const correctOption = await prisma.answerOption.findFirst({
    where: { questionId, isCorrect: true },
    select: { id: true },
  });

  if (!correctOption) {
    return NextResponse.json({ error: "correct_option_missing" }, { status: 400 });
  }

  const isCorrect = correctOption.id === optionId;
  
  // Calculate score breakdown
  const timeBonus = isCorrect ? calculateTimeBonus(timeSpentMs) : 0;
  const streakBonus = isCorrect ? calculateStreakBonus(streak) : 0;
  const scoreDelta = isCorrect ? BASE_SCORE + timeBonus + streakBonus : 0;

  const totalScore = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.answer.create({
      data: {
        sessionId,
        questionId,
        optionId,
        isCorrect,
        timeSpentMs,
        scoreDelta,
      },
    });

    const updatedSession = await tx.quizSession.update({
      where: { id: sessionId },
      data: {
        totalScore: { increment: scoreDelta },
      },
      select: { totalScore: true },
    });

    return updatedSession.totalScore;
  });

  return NextResponse.json({
    correct: isCorrect,
    scoreDelta,
    totalScore,
    // Breakdown for UI
    breakdown: {
      base: isCorrect ? BASE_SCORE : 0,
      timeBonus,
      streakBonus,
      timeSpentMs,
    },
  });
}

