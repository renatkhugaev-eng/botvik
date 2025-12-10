import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const quizIdParam = req.nextUrl.searchParams.get("quizId");
  const quizId = quizIdParam ? Number(quizIdParam) : NaN;

  if (!quizIdParam || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "quizId_required" }, { status: 400 });
  }

  const entries = await prisma.leaderboardEntry.findMany({
    where: { quizId, periodType: "ALL_TIME" },
    orderBy: [
      { score: "desc" },
      { id: "asc" },
    ],
    take: 20,
    select: {
      score: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
        },
      },
    },
  });

  const result = entries.map((entry: (typeof entries)[number], idx): {
    place: number;
    user: { id: number; username: string | null; firstName: string | null };
    score: number;
  } => ({
    place: idx + 1,
    user: {
      id: entry.user.id,
      username: entry.user.username,
      firstName: entry.user.firstName,
    },
    score: entry.score,
  }));

  return NextResponse.json(result);
}

