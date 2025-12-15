import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET - List all quizzes
export async function GET() {
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
  try {
    const body = await req.json();
    const { title, description, prizeTitle, prizeDescription, isActive, questions } = body;

    if (!title || !prizeTitle) {
      return NextResponse.json({ error: "Title and prize title are required" }, { status: 400 });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || null,
        prizeTitle,
        prizeDescription: prizeDescription || null,
        isActive: isActive ?? true,
        questions: questions
          ? {
              create: questions.map((q: any, index: number) => ({
                text: q.text,
                order: index + 1,
                difficulty: q.difficulty || 1,
                timeLimitSeconds: q.timeLimitSeconds || 15,
                answers: {
                  create: q.answers.map((a: any) => ({
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

    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    console.error("Failed to create quiz:", error);
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 });
  }
}

