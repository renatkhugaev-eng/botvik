import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/quiz/[id]
 * Get quiz info by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quizId = Number(id);

  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      description: true,
      prizeTitle: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  return NextResponse.json(quiz);
}
