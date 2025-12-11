import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
    take: 50,
    select: {
      score: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          photoUrl: true,
        },
      },
    },
  });

  const result = entries.map((entry: (typeof entries)[number], idx: number): {
    place: number;
    user: { id: number; username: string | null; firstName: string | null; photoUrl: string | null };
    score: number;
  } => ({
    place: idx + 1,
    user: {
      id: entry.user.id,
      username: entry.user.username,
      firstName: entry.user.firstName,
      photoUrl: entry.user.photoUrl,
    },
    score: entry.score,
  }));

  return NextResponse.json(result);
}

