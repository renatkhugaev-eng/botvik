/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL FINISH API — Завершение дуэли и начисление XP
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/duels/[id]/finish — Завершить дуэль
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const userId = auth.user.id;

    const body = await request.json();
    const { challengerScore, opponentScore } = body as {
      challengerScore?: number;
      opponentScore?: number;
    };

    if (challengerScore === undefined || opponentScore === undefined) {
      return NextResponse.json({ ok: false, error: "MISSING_SCORES" }, { status: 400 });
    }

    const duel = await prisma.duel.findUnique({
      where: { id },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "DUEL_NOT_FOUND" }, { status: 404 });
    }

    // Проверяем что пользователь — участник
    if (duel.challengerId !== userId && duel.opponentId !== userId) {
      return NextResponse.json({ ok: false, error: "NOT_PARTICIPANT" }, { status: 403 });
    }

    // Проверяем статус
    if (duel.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { ok: false, error: "DUEL_NOT_IN_PROGRESS", status: duel.status },
        { status: 400 }
      );
    }

    // Определяем победителя
    let winnerId: number | null = null;
    if (challengerScore > opponentScore) {
      winnerId = duel.challengerId;
    } else if (opponentScore > challengerScore) {
      winnerId = duel.opponentId;
    }
    // Если равны — ничья (winnerId = null)

    // Обновляем дуэль
    const updatedDuel = await prisma.duel.update({
      where: { id },
      data: {
        status: "FINISHED",
        challengerScore,
        opponentScore,
        winnerId,
        finishedAt: new Date(),
      },
    });

    // Начисляем XP
    const xpUpdates: { odId: number; xpDelta: number }[] = [];

    if (winnerId) {
      // Есть победитель
      const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
      
      xpUpdates.push(
        { odId: winnerId, xpDelta: duel.xpReward },
        { odId: loserId, xpDelta: duel.xpLoser }
      );
    } else {
      // Ничья — оба получают половину награды
      const drawXp = Math.floor((duel.xpReward + duel.xpLoser) / 2);
      xpUpdates.push(
        { odId: duel.challengerId, xpDelta: drawXp },
        { odId: duel.opponentId, xpDelta: drawXp }
      );
    }

    // Применяем XP
    for (const { odId, xpDelta } of xpUpdates) {
      await prisma.user.update({
        where: { id: odId },
        data: { xp: { increment: xpDelta } },
      });
    }

    // Создаём активности для ленты друзей
    await prisma.userActivity.createMany({
      data: [
        {
          userId: duel.challengerId,
          type: winnerId === duel.challengerId ? "DUEL_WON" : winnerId === null ? "DUEL_DRAW" : "DUEL_LOST",
          title: winnerId === duel.challengerId ? "Победил в дуэли!" : winnerId === null ? "Ничья в дуэли" : "Проиграл дуэль",
          icon: winnerId === duel.challengerId ? "🏆" : winnerId === null ? "🤝" : "😔",
          data: {
            duelId: duel.id,
            score: challengerScore,
            opponentScore,
            xpEarned: xpUpdates.find(u => u.odId === duel.challengerId)?.xpDelta || 0,
          },
        },
        {
          userId: duel.opponentId,
          type: winnerId === duel.opponentId ? "DUEL_WON" : winnerId === null ? "DUEL_DRAW" : "DUEL_LOST",
          title: winnerId === duel.opponentId ? "Победил в дуэли!" : winnerId === null ? "Ничья в дуэли" : "Проиграл дуэль",
          icon: winnerId === duel.opponentId ? "🏆" : winnerId === null ? "🤝" : "😔",
          data: {
            duelId: duel.id,
            score: opponentScore,
            opponentScore: challengerScore,
            xpEarned: xpUpdates.find(u => u.odId === duel.opponentId)?.xpDelta || 0,
          },
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      duel: updatedDuel,
      xpAwarded: xpUpdates,
    });
  } catch (error) {
    console.error("[Duel Finish] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
