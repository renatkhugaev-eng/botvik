import { NextRequest, NextResponse } from "next/server";
import { getQuizDetails, getQuizCacheHeaders } from "@/lib/quiz-edge-cache";

export const runtime = "nodejs";

/**
 * GET /api/quiz/[id]
 * Get quiz info by ID (Redis-cached)
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

  const { quiz, fromCache } = await getQuizDetails(quizId);

  if (!quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  return NextResponse.json(quiz, {
    headers: {
      ...getQuizCacheHeaders("details"),
      "X-Cache": fromCache ? "HIT" : "MISS",
    },
  });
}
