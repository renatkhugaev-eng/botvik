import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Cache leaderboard for 30 seconds (stale-while-revalidate for 5 minutes)
export const revalidate = 30;

export async function GET(req: NextRequest) {
  const quizIdParam = req.nextUrl.searchParams.get("quizId");
  const quizId = quizIdParam ? Number(quizIdParam) : null;

  // If quizId is provided, return per-quiz leaderboard
  if (quizId && !Number.isNaN(quizId)) {
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

    const result = entries.map((entry, idx) => ({
      place: idx + 1,
      user: {
        id: entry.user.id,
        username: entry.user.username,
        firstName: entry.user.firstName,
        photoUrl: entry.user.photoUrl,
      },
      score: entry.score,
    }));

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      },
    });
  }

  // Global leaderboard — sum of all quiz scores per user
  const globalScores = await prisma.leaderboardEntry.groupBy({
    by: ["userId"],
    where: { periodType: "ALL_TIME" },
    _sum: { score: true },
    orderBy: { _sum: { score: "desc" } },
    take: 50,
  });

  // Get user details for each entry
  const userIds = globalScores.map((e) => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      firstName: true,
      photoUrl: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = globalScores.map((entry, idx) => {
    const user = userMap.get(entry.userId);
    return {
      place: idx + 1,
      user: {
        id: entry.userId,
        username: user?.username ?? null,
        firstName: user?.firstName ?? null,
        photoUrl: user?.photoUrl ?? null,
      },
      score: entry._sum.score ?? 0,
    };
  });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
    },
  });
}

