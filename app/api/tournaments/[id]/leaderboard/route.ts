import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/tournaments/[id]/leaderboard — Лидерборд турнира
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;
  const { id } = await context.params;
  const search = req.nextUrl.searchParams;
  const limit = Math.min(Number(search.get("limit")) || 50, 100);
  const offset = Number(search.get("offset")) || 0;
  
  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { id: Number(id) || 0 },
        { slug: id },
      ],
    },
    select: { id: true, title: true, status: true },
  });
  
  if (!tournament) {
    return NextResponse.json({ error: "tournament_not_found" }, { status: 404 });
  }
  
  // Получаем участников с рейтингом
  const [participants, totalCount] = await Promise.all([
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { totalScore: "desc" },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    }),
    prisma.tournamentParticipant.count({
      where: { tournamentId: tournament.id },
    }),
  ]);
  
  // Форматируем лидерборд с рангами
  const leaderboard = participants.map((p, index) => ({
    rank: offset + index + 1,
    user: p.user,
    score: p.totalScore,
    status: p.status,
    currentStage: p.currentStage,
  }));
  
  // Находим позицию текущего пользователя
  const myParticipation = await prisma.tournamentParticipant.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId: tournament.id,
        userId,
      },
    },
    select: { totalScore: true },
  });
  
  let myPosition = null;
  if (myParticipation) {
    // Считаем сколько участников имеют больше очков
    const higherCount = await prisma.tournamentParticipant.count({
      where: {
        tournamentId: tournament.id,
        totalScore: { gt: myParticipation.totalScore },
      },
    });
    myPosition = {
      rank: higherCount + 1,
      score: myParticipation.totalScore,
    };
  }
  
  return NextResponse.json({
    ok: true,
    tournament: {
      id: tournament.id,
      title: tournament.title,
      status: tournament.status,
    },
    leaderboard,
    myPosition,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    },
  });
}
