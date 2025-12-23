/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL FINISH API — Завершение дуэли и начисление XP
 * 
 * SECURITY FIX: Очки теперь вычисляются на сервере из DuelAnswer,
 * а не принимаются от клиента. Это предотвращает подделку результатов.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { notifyDuelResult } from "@/lib/notifications";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Константы скоринга
const DUEL_POINTS_PER_CORRECT = 100;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Вычислить очки игрока из серверных ответов
// ═══════════════════════════════════════════════════════════════════════════

async function calculatePlayerScore(duelId: string, userId: number): Promise<number> {
  const answers = await prisma.duelAnswer.findMany({
    where: { duelId, userId },
    select: { isCorrect: true },
  });
  
  const correctCount = answers.filter((a) => a.isCorrect).length;
  return correctCount * DUEL_POINTS_PER_CORRECT;
}

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

    // Получаем дуэль с информацией о квизе
    const duel = await prisma.duel.findUnique({
      where: { id },
      include: {
        quiz: {
          select: {
            _count: { select: { questions: true } },
          },
        },
      },
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
      // Если дуэль уже завершена — возвращаем существующие данные (идемпотентность)
      if (duel.status === "FINISHED") {
        return NextResponse.json({
          ok: true,
          duel,
          alreadyFinished: true,
        });
      }
      return NextResponse.json(
        { ok: false, error: "DUEL_NOT_IN_PROGRESS", status: duel.status },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY FIX: Вычисляем очки на СЕРВЕРЕ из DuelAnswer
    // Клиент больше НЕ может передать свои очки
    // ═══════════════════════════════════════════════════════════════════════════
    
    const [challengerScore, opponentScore] = await Promise.all([
      calculatePlayerScore(id, duel.challengerId),
      calculatePlayerScore(id, duel.opponentId),
    ]);

    // Валидация: проверяем что очки не превышают максимум
    const maxScore = duel.quiz._count.questions * DUEL_POINTS_PER_CORRECT;
    
    if (challengerScore > maxScore || opponentScore > maxScore) {
      console.error(
        `[Duel Finish] CRITICAL: Calculated scores exceed maximum! ` +
        `Challenger: ${challengerScore}, Opponent: ${opponentScore}, Max: ${maxScore}`
      );
      return NextResponse.json({ ok: false, error: "SCORE_CALCULATION_ERROR" }, { status: 500 });
    }

    // ═══ ПРОВЕРКА ЧТО ОБА ИГРОКА ОТВЕТИЛИ ═══
    const [challengerAnswerCount, opponentAnswerCount] = await Promise.all([
      prisma.duelAnswer.count({ where: { duelId: id, userId: duel.challengerId } }),
      prisma.duelAnswer.count({ where: { duelId: id, userId: duel.opponentId } }),
    ]);

    const totalQuestions = duel.quiz._count.questions;
    
    // Если не все ответили — проверяем не слишком ли рано финишируют
    if (challengerAnswerCount < totalQuestions || opponentAnswerCount < totalQuestions) {
      // Минимальное время: 2 секунды на вопрос (быстрые игроки) + reveal time
      // 5 вопросов × 2 сек = 10 сек + reveal
      const minGameDurationMs = totalQuestions * 2000;
      const gameDuration = duel.startedAt 
        ? Date.now() - duel.startedAt.getTime()
        : 0;

      // Только если прошло совсем мало времени — отклоняем
      if (gameDuration < minGameDurationMs && challengerAnswerCount === 0 && opponentAnswerCount === 0) {
        console.warn(
          `[Duel Finish] Attempt to finish too early: duration=${gameDuration}ms, ` +
          `challenger=${challengerAnswerCount}/${totalQuestions}, ` +
          `opponent=${opponentAnswerCount}/${totalQuestions}`
        );
        return NextResponse.json(
          { ok: false, error: "GAME_NOT_COMPLETE", message: "Игра ещё не завершена" },
          { status: 400 }
        );
      }
      
      console.log(
        `[Duel Finish] Completing with answers: ` +
        `Challenger ${challengerAnswerCount}/${totalQuestions}, ` +
        `Opponent ${opponentAnswerCount}/${totalQuestions}, ` +
        `Duration: ${gameDuration}ms`
      );
    }

    console.log(
      `[Duel Finish] Calculated scores for duel ${id}: ` +
      `Challenger=${challengerScore}, Opponent=${opponentScore}`
    );

    // Определяем победителя
    let winnerId: number | null = null;
    if (challengerScore > opponentScore) {
      winnerId = duel.challengerId;
    } else if (opponentScore > challengerScore) {
      winnerId = duel.opponentId;
    }
    // Если равны — ничья (winnerId = null)

    // Атомарная транзакция для предотвращения race condition
    const result = await prisma.$transaction(async (tx) => {
      // Атомарно обновляем дуэль только если статус всё ещё IN_PROGRESS
      const updateResult = await tx.duel.updateMany({
        where: { 
          id, 
          status: "IN_PROGRESS",
        },
        data: {
          status: "FINISHED",
          challengerScore,
          opponentScore,
          winnerId,
          finishedAt: new Date(),
        },
      });

      // Если не обновилось — другой запрос уже завершил дуэль
      if (updateResult.count === 0) {
        return { alreadyFinished: true };
      }

      // Начисляем XP
      const xpUpdates: { odId: number; xpDelta: number }[] = [];

      if (winnerId) {
        const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
        xpUpdates.push(
          { odId: winnerId, xpDelta: duel.xpReward },
          { odId: loserId, xpDelta: duel.xpLoser }
        );
      } else {
        const drawXp = Math.floor((duel.xpReward + duel.xpLoser) / 2);
        xpUpdates.push(
          { odId: duel.challengerId, xpDelta: drawXp },
          { odId: duel.opponentId, xpDelta: drawXp }
        );
      }

      // Применяем XP
      for (const { odId, xpDelta } of xpUpdates) {
        await tx.user.update({
          where: { id: odId },
          data: { xp: { increment: xpDelta } },
        });
      }

      // Создаём активности для ленты друзей
      await tx.userActivity.createMany({
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

      return { xpUpdates, winnerId, challengerScore, opponentScore };
    });

    // Если дуэль уже была завершена другим запросом
    if ("alreadyFinished" in result && result.alreadyFinished) {
      const currentDuel = await prisma.duel.findUnique({ where: { id } });
      return NextResponse.json({
        ok: true,
        duel: currentDuel,
        alreadyFinished: true,
      });
    }

    const updatedDuel = await prisma.duel.findUnique({
      where: { id },
      include: {
        challenger: { select: { firstName: true, username: true } },
        opponent: { select: { firstName: true, username: true } },
      },
    });

    // Отправляем push-уведомления обоим игрокам (только если есть xpUpdates)
    if (updatedDuel && result.xpUpdates) {
      const challengerName = updatedDuel.challenger.firstName || updatedDuel.challenger.username || "Игрок";
      const opponentName = updatedDuel.opponent.firstName || updatedDuel.opponent.username || "Игрок";
      const isDraw = result.winnerId === null;

      // Уведомление челленджеру
      const challengerXp = result.xpUpdates.find(u => u.odId === duel.challengerId)?.xpDelta ?? 0;
      notifyDuelResult(duel.challengerId, {
        duelId: id,
        opponentName,
        isWinner: result.winnerId === duel.challengerId,
        isDraw,
        myScore: result.challengerScore ?? 0,
        opponentScore: result.opponentScore ?? 0,
        xpEarned: challengerXp,
      }).catch(err => console.error("[Duel Finish] Notification error:", err));

      // Уведомление оппоненту
      const opponentXp = result.xpUpdates.find(u => u.odId === duel.opponentId)?.xpDelta ?? 0;
      notifyDuelResult(duel.opponentId, {
        duelId: id,
        opponentName: challengerName,
        isWinner: result.winnerId === duel.opponentId,
        isDraw,
        myScore: result.opponentScore ?? 0,
        opponentScore: result.challengerScore ?? 0,
        xpEarned: opponentXp,
      }).catch(err => console.error("[Duel Finish] Notification error:", err));
    }

    return NextResponse.json({
      ok: true,
      duel: updatedDuel,
      xpAwarded: result.xpUpdates,
      serverCalculatedScores: {
        challengerScore: result.challengerScore,
        opponentScore: result.opponentScore,
        winnerId: result.winnerId,
      },
    });
  } catch (error) {
    console.error("[Duel Finish] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
