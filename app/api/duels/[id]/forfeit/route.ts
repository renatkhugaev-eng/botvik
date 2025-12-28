/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL FORFEIT API — Сдаться в дуэли
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Позволяет игроку сдаться во время дуэли.
 * При сдаче:
 * - Игрок получает 0 очков
 * - Оппонент автоматически побеждает с текущими очками
 * - Обоим начисляется XP (победителю полный, проигравшему минимальный)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { notifyDuelResult } from "@/lib/notifications";
import { getWeekStart } from "@/lib/week";
import type { ActivityType, Prisma } from "@prisma/client";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Константы
const DUEL_POINTS_PER_CORRECT = 100;
const FORFEIT_XP_PENALTY = 0; // Сдавшийся не получает XP

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/duels/[id]/forfeit — Сдаться в дуэли
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const userId = auth.user.id;

    // Получаем дуэль с информацией о ботах
    const duel = await prisma.duel.findUnique({
      where: { id },
      include: {
        quiz: {
          select: {
            _count: { select: { questions: true } },
          },
        },
        challenger: { select: { firstName: true, username: true, isBot: true } },
        opponent: { select: { firstName: true, username: true, isBot: true } },
      },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "DUEL_NOT_FOUND" }, { status: 404 });
    }

    // Проверяем что пользователь — участник
    if (duel.challengerId !== userId && duel.opponentId !== userId) {
      return NextResponse.json({ ok: false, error: "NOT_PARTICIPANT" }, { status: 403 });
    }

    // Проверяем статус — можно сдаться только в активной дуэли
    if (duel.status !== "IN_PROGRESS") {
      if (duel.status === "FINISHED") {
        return NextResponse.json({ ok: false, error: "DUEL_ALREADY_FINISHED" }, { status: 400 });
      }
      return NextResponse.json(
        { ok: false, error: "DUEL_NOT_IN_PROGRESS", status: duel.status },
        { status: 400 }
      );
    }

    // Определяем победителя (оппонент сдавшегося)
    const winnerId = userId === duel.challengerId ? duel.opponentId : duel.challengerId;
    const loserId = userId;

    // Вычисляем очки победителя из его текущих ответов
    const winnerAnswers = await prisma.duelAnswer.findMany({
      where: { duelId: id, userId: winnerId },
      select: { isCorrect: true },
    });
    const winnerScore = winnerAnswers.filter(a => a.isCorrect).length * DUEL_POINTS_PER_CORRECT;

    // У сдавшегося 0 очков (forfeit penalty)
    const loserScore = 0;

    // Определяем финальные очки
    const challengerScore = duel.challengerId === winnerId ? winnerScore : loserScore;
    const opponentScore = duel.opponentId === winnerId ? winnerScore : loserScore;

    console.log(
      `[Duel Forfeit] User ${userId} forfeited duel ${id}. ` +
      `Winner: ${winnerId} (${winnerScore} pts)`
    );

    // Атомарная транзакция
    const result = await prisma.$transaction(async (tx) => {
      // Атомарно обновляем дуэль
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

      if (updateResult.count === 0) {
        return { alreadyFinished: true };
      }

      // Начисляем XP
      const xpUpdates = [
        { odId: winnerId, xpDelta: duel.xpReward },        // Победитель получает полный XP
        { odId: loserId, xpDelta: FORFEIT_XP_PENALTY },    // Сдавшийся не получает XP
      ];

      // Применяем XP и обновляем дуэльные статы для лидерборда
      // ВАЖНО: НЕ обновляем статистику для AI-ботов
      const weekStart = getWeekStart();
      
      for (const { odId, xpDelta } of xpUpdates) {
        // Проверяем является ли игрок ботом
        const isBot = odId === duel.challengerId 
          ? duel.challenger.isBot 
          : duel.opponent.isBot;
        
        // Пропускаем обновление статистики для ботов
        if (isBot) {
          console.log(`[Duel Forfeit] Skipping stats update for AI bot (id=${odId})`);
          continue;
        }
        
        const isWinner = odId === winnerId;
        const playerScore = isWinner ? winnerScore : loserScore;
        
        // Получаем текущие статы пользователя
        const currentUser = await tx.user.findUnique({
          where: { id: odId },
          select: { duelBestScore: true },
        });
        const shouldUpdateUserBest = playerScore > (currentUser?.duelBestScore ?? 0);
        
        // Обновляем User: XP + дуэльные статы
        await tx.user.update({
          where: { id: odId },
          data: { 
            ...(xpDelta > 0 && { xp: { increment: xpDelta } }),
            duelCount: { increment: 1 },
            ...(isWinner && { duelWins: { increment: 1 } }),
            ...(shouldUpdateUserBest && { duelBestScore: playerScore }),
          },
        });
        
        // Обновляем WeeklyScore для лидерборда
        const currentWeekly = await tx.weeklyScore.findUnique({
          where: { userId_weekStart: { userId: odId, weekStart } },
          select: { duelBestScore: true },
        });
        const shouldUpdateWeeklyBest = playerScore > (currentWeekly?.duelBestScore ?? 0);
        
        await tx.weeklyScore.upsert({
          where: { userId_weekStart: { userId: odId, weekStart } },
          create: {
            userId: odId,
            weekStart,
            duelBestScore: playerScore,
            duelCount: 1,
            duelWins: isWinner ? 1 : 0,
          },
          update: {
            duelCount: { increment: 1 },
            ...(isWinner && { duelWins: { increment: 1 } }),
            ...(shouldUpdateWeeklyBest && { duelBestScore: playerScore }),
          },
        });
      }

      // Создаём активности (только для реальных игроков)
      const isWinnerBot = winnerId === duel.challengerId 
        ? duel.challenger.isBot 
        : duel.opponent.isBot;
      const isLoserBot = loserId === duel.challengerId 
        ? duel.challenger.isBot 
        : duel.opponent.isBot;
      
      const activityData: {
        userId: number;
        type: ActivityType;
        title: string;
        icon: string;
        data: Prisma.InputJsonValue;
      }[] = [];
      
      if (!isWinnerBot) {
        activityData.push({
          userId: winnerId,
          type: "DUEL_WON" as ActivityType,
          title: "Соперник сдался!",
          icon: "🏆",
          data: {
            duelId: id,
            score: winnerScore,
            opponentScore: loserScore,
            xpEarned: duel.xpReward,
            forfeit: true,
          },
        });
      }
      
      if (!isLoserBot) {
        activityData.push({
          userId: loserId,
          type: "DUEL_LOST" as ActivityType,
          title: "Сдался в дуэли",
          icon: "🏳️",
          data: {
            duelId: id,
            score: loserScore,
            opponentScore: winnerScore,
            xpEarned: FORFEIT_XP_PENALTY,
            forfeit: true,
          },
        });
      }
      
      if (activityData.length > 0) {
        await tx.userActivity.createMany({ data: activityData });
      }

      return { xpUpdates, winnerId, challengerScore, opponentScore };
    });

    // Если дуэль уже завершена
    if ("alreadyFinished" in result && result.alreadyFinished) {
      const currentDuel = await prisma.duel.findUnique({ where: { id } });
      return NextResponse.json({
        ok: true,
        duel: currentDuel,
        alreadyFinished: true,
      });
    }

    // Получаем обновлённую дуэль
    const updatedDuel = await prisma.duel.findUnique({
      where: { id },
      include: {
        challenger: { select: { firstName: true, username: true } },
        opponent: { select: { firstName: true, username: true } },
      },
    });

    // Отправляем push-уведомления обоим
    if (updatedDuel && result.xpUpdates) {
      const challengerName = updatedDuel.challenger.firstName || updatedDuel.challenger.username || "Игрок";
      const opponentName = updatedDuel.opponent.firstName || updatedDuel.opponent.username || "Игрок";

      // Уведомление победителю
      notifyDuelResult(winnerId, {
        duelId: id,
        opponentName: winnerId === duel.challengerId ? opponentName : challengerName,
        isWinner: true,
        isDraw: false,
        myScore: winnerScore,
        opponentScore: loserScore,
        xpEarned: duel.xpReward,
      }).catch(err => console.error("[Duel Forfeit] Winner notification error:", err));

      // Уведомление сдавшемуся (для истории и подтверждения)
      notifyDuelResult(loserId, {
        duelId: id,
        opponentName: loserId === duel.challengerId ? opponentName : challengerName,
        isWinner: false,
        isDraw: false,
        myScore: loserScore,
        opponentScore: winnerScore,
        xpEarned: FORFEIT_XP_PENALTY,
      }).catch(err => console.error("[Duel Forfeit] Loser notification error:", err));
    }

    return NextResponse.json({
      ok: true,
      duel: updatedDuel,
      forfeitedBy: userId,
      winnerId: result.winnerId,
      scores: {
        challengerScore: result.challengerScore,
        opponentScore: result.opponentScore,
      },
    });
  } catch (error) {
    console.error("[Duel Forfeit] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

