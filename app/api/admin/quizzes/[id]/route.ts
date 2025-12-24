import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/auth";
import { auditLog, createAuditEntry } from "@/lib/audit-log";
import { parseAndValidate, validateId, updateQuizSchema } from "@/lib/validation";

export const runtime = "nodejs";

// GET - Get single quiz with questions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ═══ ADMIN AUTHORIZATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const quizId = Number(id);

  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 });
  }

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            answers: true,
          },
        },
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Failed to fetch quiz:", error);
    return NextResponse.json({ error: "Failed to fetch quiz" }, { status: 500 });
  }
}

// PATCH - Update quiz
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ═══ ADMIN AUTHORIZATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const idResult = validateId(id, "quizId");
  if (!idResult.success) {
    return idResult.response;
  }
  const quizId = idResult.value;

  // ═══ VALIDATION ═══
  const validation = await parseAndValidate(req, updateQuizSchema);
  if (!validation.success) {
    return validation.response;
  }
  const { title, description, prizeTitle, prizeDescription, isActive } = validation.data;

  try {
    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(prizeTitle !== undefined && { prizeTitle }),
        ...(prizeDescription !== undefined && { prizeDescription }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // ═══ AUDIT LOG ═══
    await auditLog(createAuditEntry(
      req,
      { id: auth.user.id, telegramId: auth.user.telegramId },
      "quiz.update",
      { type: "quiz", id: quizId },
      { title, isActive }
    ));

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Failed to update quiz:", error);
    return NextResponse.json({ error: "Failed to update quiz" }, { status: 500 });
  }
}

// DELETE - Delete quiz
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ═══ ADMIN AUTHORIZATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const idResult = validateId(id, "quizId");
  if (!idResult.success) {
    return idResult.response;
  }
  const quizId = idResult.value;

  // Get quiz title for audit log before deletion
  const quizToDelete = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { title: true },
  });

  if (!quizToDelete) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  try {
    // Delete in order: answers -> questions -> sessions -> leaderboard entries -> quiz
    await prisma.$transaction(async (tx) => {
      // Get all questions for this quiz
      const questions = await tx.question.findMany({
        where: { quizId },
        select: { id: true },
      });
      const questionIds = questions.map((q) => q.id);

      // Delete answers for questions
      await tx.answerOption.deleteMany({
        where: { questionId: { in: questionIds } },
      });

      // Delete user answers
      await tx.answer.deleteMany({
        where: { question: { quizId } },
      });

      // Delete questions
      await tx.question.deleteMany({
        where: { quizId },
      });

      // Delete sessions
      await tx.quizSession.deleteMany({
        where: { quizId },
      });

      // Delete leaderboard entries
      await tx.leaderboardEntry.deleteMany({
        where: { quizId },
      });

      // Finally delete the quiz
      await tx.quiz.delete({
        where: { id: quizId },
      });
    });

    // ═══ AUDIT LOG ═══
    await auditLog(createAuditEntry(
      req,
      { id: auth.user.id, telegramId: auth.user.telegramId },
      "quiz.delete",
      { type: "quiz", id: quizId },
      { quizTitle: quizToDelete.title }
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete quiz:", error);
    return NextResponse.json({ error: "Failed to delete quiz" }, { status: 500 });
  }
}

