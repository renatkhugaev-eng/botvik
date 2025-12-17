import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/quiz/[id]/view
 * 
 * Сигнализирует серверу, что клиент ПОКАЗАЛ вопрос пользователю.
 * Это запускает серверный таймер для данного вопроса.
 * 
 * Решает проблему: раньше таймер начинался сразу после ответа на предыдущий вопрос,
 * но пользователь ещё смотрел экран результата. Теперь таймер начинается
 * только когда клиент реально показывает следующий вопрос.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  const { id } = await context.params;
  const quizId = Number(id);
  
  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  let body: { sessionId?: number; questionIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { sessionId, questionIndex } = body;

  if (!sessionId || questionIndex === undefined) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      quizId: true,
      finishedAt: true,
      currentQuestionIndex: true,
      currentQuestionStartedAt: true,
    },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  if (session.userId !== userId) {
    return NextResponse.json({ error: "session_not_yours" }, { status: 403 });
  }

  if (session.finishedAt) {
    return NextResponse.json({ error: "session_finished" }, { status: 400 });
  }

  // Проверяем что индекс вопроса совпадает
  if (session.currentQuestionIndex !== questionIndex) {
    return NextResponse.json({ 
      error: "wrong_question_index",
      expected: session.currentQuestionIndex,
      received: questionIndex,
    }, { status: 400 });
  }

  const now = new Date();
  
  // Обновляем только если таймер ещё не запущен (предотвращает читерство)
  if (!session.currentQuestionStartedAt) {
    await prisma.quizSession.update({
      where: { id: sessionId },
      data: { currentQuestionStartedAt: now },
    });
  }

  return NextResponse.json({
    success: true,
    questionIndex,
    serverTime: now.toISOString(),
    questionStartedAt: session.currentQuestionStartedAt?.toISOString() ?? now.toISOString(),
  });
}
