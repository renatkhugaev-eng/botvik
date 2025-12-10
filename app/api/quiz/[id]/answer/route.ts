import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AnswerRequestBody = {
  sessionId?: number;
  questionId?: number;
  optionId?: number;
  timeSpentMs?: number;
};

const BASE_SCORE = 100;
const MAX_BONUS = 50;
const FAST_THRESHOLD = 2000;
const SLOW_THRESHOLD = 15000;

function calculateBonus(timeSpentMs: number) {
  if (timeSpentMs <= FAST_THRESHOLD) return MAX_BONUS;
  if (timeSpentMs >= SLOW_THRESHOLD) return 0;

  const ratio = (SLOW_THRESHOLD - timeSpentMs) / (SLOW_THRESHOLD - FAST_THRESHOLD);
  return Math.round(MAX_BONUS * ratio);
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
  const bonus = isCorrect ? calculateBonus(timeSpentMs) : 0;
  const scoreDelta = isCorrect ? BASE_SCORE + bonus : 0;

  const totalScore = await prisma.$transaction(async (tx: any) => {
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
  });
}

