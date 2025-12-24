import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/auth";
import { auditLog, createAuditEntry } from "@/lib/audit-log";
import { parseAndValidate, createQuizSchema } from "@/lib/validation";

export const runtime = "nodejs";

// GET - List all quizzes
export async function GET(req: NextRequest) {
  // ═══ ADMIN AUTHORIZATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { id: "desc" },
      include: {
        _count: {
          select: {
            questions: true,
            sessions: true,
          },
        },
      },
    });

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return NextResponse.json({ error: "Failed to fetch quizzes" }, { status: 500 });
  }
}

// POST - Create new quiz
export async function POST(req: NextRequest) {
  // ═══ ADMIN AUTHORIZATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ═══ VALIDATION ═══
  const validation = await parseAndValidate(req, createQuizSchema);
  if (!validation.success) {
    return validation.response;
  }
  const { title, description, prizeTitle, prizeDescription, isActive, questions } = validation.data;

  try {
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || null,
        prizeTitle,
        prizeDescription: prizeDescription || null,
        isActive: isActive ?? true,
        questions: questions
          ? {
              create: questions.map((q, index: number) => ({
                text: q.text,
                order: index + 1,
                difficulty: q.difficulty || 1,
                timeLimitSeconds: q.timeLimitSeconds || 15,
                answers: {
                  create: q.answers.map((a) => ({
                    text: a.text,
                    isCorrect: a.isCorrect || false,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          include: { answers: true },
        },
      },
    });

    // ═══ AUDIT LOG ═══
    await auditLog(createAuditEntry(
      req,
      { id: auth.user.id, telegramId: auth.user.telegramId },
      "quiz.create",
      { type: "quiz", id: quiz.id },
      { title, questionsCount: questions?.length ?? 0 }
    ));

    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    console.error("Failed to create quiz:", error);
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 });
  }
}

