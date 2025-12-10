import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    select: { id: true, quizId: true, userId: true, totalScore: true, finishedAt: true },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const finishedSession =
    session.finishedAt !== null
      ? session
      : await prisma.quizSession.update({
          where: { id: sessionId },
          data: { finishedAt: new Date() },
          select: { id: true, quizId: true, userId: true, totalScore: true, finishedAt: true },
        });

  const bestScore = await prisma.quizSession.aggregate({
    where: { userId: session.userId, quizId },
    _max: { totalScore: true },
  });

  const topScore = bestScore._max.totalScore ?? finishedSession.totalScore;

  await prisma.leaderboardEntry.upsert({
    where: {
      userId_quizId_periodType: {
        userId: session.userId,
        quizId,
        periodType: "ALL_TIME",
      },
    },
    update: { score: topScore },
    create: {
      userId: session.userId,
      quizId,
      periodType: "ALL_TIME",
      score: topScore,
    },
  });

  return NextResponse.json({ totalScore: finishedSession.totalScore });
}

