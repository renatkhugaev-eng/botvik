import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

type TimeoutRequestBody = {
  sessionId?: number;
  questionId?: number;
};

/**
 * POST /api/quiz/[id]/timeout
 * Handle question timeout - sync server state when time expires
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ═══ AUTHENTICATION ═══
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

  let body: TimeoutRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  const questionId = body.questionId;

  if (!sessionId || !questionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Get session
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: { 
      id: true, 
      userId: true,
      quizId: true, 
      finishedAt: true, 
      totalScore: true,
      currentQuestionIndex: true,
    },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // ═══ SESSION OWNERSHIP CHECK ═══
  if (session.userId !== userId) {
    console.warn(`[quiz/timeout] ⚠️ SECURITY: User ${userId} attempted to timeout session ${sessionId} owned by user ${session.userId}`);
    return NextResponse.json({ error: "session_not_yours" }, { status: 403 });
  }

  if (session.finishedAt) {
    return NextResponse.json({ error: "session_finished" }, { status: 400 });
  }

  // Get questions in order
  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  // Validate question order
  const expectedQuestion = questions[session.currentQuestionIndex];
  
  if (!expectedQuestion || expectedQuestion.id !== questionId) {
    // Question already processed or wrong order - just return current state
    return NextResponse.json({
      skipped: false,
      message: "Question already processed",
      currentQuestionIndex: session.currentQuestionIndex,
      totalScore: session.totalScore,
    });
  }

  // Check if already answered
  const existingAnswer = await prisma.answer.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });

  if (existingAnswer) {
    return NextResponse.json({
      skipped: false,
      message: "Already answered",
      currentQuestionIndex: session.currentQuestionIndex + 1,
      totalScore: session.totalScore,
    });
  }

  // Record timeout answer and advance to next question
  const now = new Date();
  const QUESTION_TIME_MS = 15000;
  
  const result = await prisma.$transaction(async (tx) => {
    // Record timeout as answer with optionId = null
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
    
    // Update session - advance to next question, reset streak
    // currentQuestionStartedAt = null — таймер начнётся когда клиент вызовет /view
    const updatedSession = await tx.quizSession.update({
      where: { id: sessionId },
      data: {
        currentQuestionIndex: session.currentQuestionIndex + 1,
        currentQuestionStartedAt: null,
        currentStreak: 0,
      },
      select: { 
        currentQuestionIndex: true, 
        totalScore: true,
      },
    });
    
    return updatedSession;
  });

  return NextResponse.json({
    skipped: true,
    currentQuestionIndex: result.currentQuestionIndex,
    totalScore: result.totalScore,
    streak: 0,
  });
}
