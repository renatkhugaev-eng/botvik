/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUELS HISTORY API — История завершённых дуэлей
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/duels/history — Получить историю дуэлей
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;

    // Параметры пагинации
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor"); // ID последней дуэли для пагинации

    // Получаем завершённые дуэли
    const duels = await prisma.duel.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: "FINISHED",
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { finishedAt: "desc" },
      take: limit + 1, // +1 для проверки есть ли ещё
    });

    // Проверяем есть ли следующая страница
    const hasMore = duels.length > limit;
    if (hasMore) duels.pop();

    // Форматируем данные
    const formattedDuels = duels.map((duel) => {
      const isChallenger = duel.challengerId === userId;
      const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
      const opponentScore = isChallenger ? duel.opponentScore : duel.challengerScore;
      const opponent = isChallenger ? duel.opponent : duel.challenger;

      let result: "win" | "loss" | "draw";
      if (duel.winnerId === userId) {
        result = "win";
      } else if (duel.winnerId === null) {
        result = "draw";
      } else {
        result = "loss";
      }

      return {
        id: duel.id,
        result,
        myScore,
        opponentScore,
        opponent: {
          id: opponent.id,
          name: opponent.firstName || opponent.username || "Игрок",
          photoUrl: opponent.photoUrl,
        },
        quiz: {
          id: duel.quiz.id,
          title: duel.quiz.title,
        },
        finishedAt: duel.finishedAt,
      };
    });

    // Статистика
    const stats = await prisma.duel.groupBy({
      by: ["winnerId"],
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: "FINISHED",
      },
      _count: true,
    });

    // Подсчитываем статистику
    let wins = 0;
    let losses = 0;
    let draws = 0;
    const totalCount = await prisma.duel.count({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: "FINISHED",
      },
    });

    for (const stat of stats) {
      if (stat.winnerId === userId) {
        wins = stat._count;
      } else if (stat.winnerId === null) {
        draws = stat._count;
      } else {
        losses += stat._count;
      }
    }

    return NextResponse.json({
      ok: true,
      duels: formattedDuels,
      stats: {
        total: totalCount,
        wins,
        losses,
        draws,
        winRate: totalCount > 0 ? Math.round((wins / totalCount) * 100) : 0,
      },
      pagination: {
        hasMore,
        nextCursor: hasMore ? duels[duels.length - 1]?.id : null,
      },
    });
  } catch (error) {
    console.error("[Duels History] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

