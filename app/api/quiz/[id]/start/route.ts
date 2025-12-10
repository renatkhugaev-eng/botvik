import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, isActive: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  const existingSession = await prisma.quizSession.findFirst({
    where: { quizId, userId, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const session =
    existingSession ??
    (await prisma.quizSession.create({
      data: { quizId, userId },
    }));

  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      text: true,
      order: true,
      answers: {
        select: {
          id: true,
          text: true,
        },
      },
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    quizId,
    totalQuestions: questions.length,
    totalScore: session.totalScore,
    questions: questions.map((q: (typeof questions)[number]) => ({
      id: q.id,
      text: q.text,
      order: q.order,
      options: q.answers.map((option: (typeof q.answers)[number]) => ({
        id: option.id,
        text: option.text,
      })),
    })),
  });
}
