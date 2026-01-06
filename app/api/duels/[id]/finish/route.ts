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
import { getWeekStart } from "@/lib/week";
import { updateChallengeProgress } from "@/lib/daily-challenges";
import { DailyChallengeType } from "@prisma/client";
import type { ActivityType, Prisma } from "@prisma/client";
import { invalidateLeaderboardCache } from "@/lib/leaderboard-cache";

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

    // Получаем дуэль с информацией о квизе и ботах
    const duel = await prisma.duel.findUnique({
      where: { id },
      include: {
        quiz: {
          select: {
            _count: { select: { questions: true } },
          },
        },
        challenger: {
          select: { isBot: true },
        },
        opponent: {
          select: { isBot: true },
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

      // Применяем XP и обновляем дуэльные статы для лидерборда
      // ВАЖНО: НЕ обновляем статистику для AI-ботов (они не участвуют в лидербордах)
      const weekStart = getWeekStart();
      
      for (const { odId, xpDelta } of xpUpdates) {
        // Проверяем является ли игрок ботом
        const isBot = odId === duel.challengerId 
          ? duel.challenger.isBot 
          : duel.opponent.isBot;
        
        // Пропускаем обновление статистики для ботов
        if (isBot) {
          console.log(`[Duel Finish] Skipping stats update for AI bot (id=${odId})`);
          continue;
        }
        
        const isWinner = odId === winnerId;
        const playerScore = odId === duel.challengerId ? challengerScore : opponentScore;
        
        // Получаем текущие статы пользователя
        const currentUser = await tx.user.findUnique({
          where: { id: odId },
          select: { duelBestScore: true },
        });
        const shouldUpdateBest = playerScore > (currentUser?.duelBestScore ?? 0);
        
        // Обновляем User: XP + дуэльные статы
        await tx.user.update({
          where: { id: odId },
          data: { 
            xp: { increment: xpDelta },
            duelCount: { increment: 1 },
            ...(isWinner && { duelWins: { increment: 1 } }),
            ...(shouldUpdateBest && { duelBestScore: playerScore }),
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

      // Создаём активности для ленты друзей (только для реальных игроков)
      const activityData: {
        userId: number;
        type: ActivityType;
        title: string;
        icon: string;
        data: Prisma.InputJsonValue;
      }[] = [];
      
      if (!duel.challenger.isBot) {
        activityData.push({
          userId: duel.challengerId,
          type: (winnerId === duel.challengerId ? "DUEL_WON" : winnerId === null ? "DUEL_DRAW" : "DUEL_LOST") as ActivityType,
          title: winnerId === duel.challengerId ? "Победил в дуэли!" : winnerId === null ? "Ничья в дуэли" : "Проиграл дуэль",
          icon: winnerId === duel.challengerId ? "🏆" : winnerId === null ? "🤝" : "😔",
          data: {
            duelId: duel.id,
            score: challengerScore,
            opponentScore,
            xpEarned: xpUpdates.find(u => u.odId === duel.challengerId)?.xpDelta || 0,
          },
        });
      }
      
      if (!duel.opponent.isBot) {
        activityData.push({
          userId: duel.opponentId,
          type: (winnerId === duel.opponentId ? "DUEL_WON" : winnerId === null ? "DUEL_DRAW" : "DUEL_LOST") as ActivityType,
          title: winnerId === duel.opponentId ? "Победил в дуэли!" : winnerId === null ? "Ничья в дуэли" : "Проиграл дуэль",
          icon: winnerId === duel.opponentId ? "🏆" : winnerId === null ? "🤝" : "😔",
          data: {
            duelId: duel.id,
            score: opponentScore,
            opponentScore: challengerScore,
            xpEarned: xpUpdates.find(u => u.odId === duel.opponentId)?.xpDelta || 0,
          },
        });
      }
      
      if (activityData.length > 0) {
        await tx.userActivity.createMany({ data: activityData });
      }

      return { xpUpdates, winnerId, challengerScore, opponentScore };
    });

    // ═══ INVALIDATE LEADERBOARD CACHE ═══
    // Only invalidate if this was a fresh finish (not already finished)
    if (!("alreadyFinished" in result)) {
      const weekStart = getWeekStart();
      invalidateLeaderboardCache({
        weekStart,
        invalidateGlobal: true,
      }).catch(err => console.error("[duel/finish] Leaderboard cache invalidation failed:", err));
    }

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

    // ═══════════════════════════════════════════════════════════════════════════
    // DAILY CHALLENGES — Обновляем прогресс (только для реальных игроков)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const challengeUpdates: Promise<void>[] = [];
    
    // Получаем ответы для каждого игрока (включая индекс для streak)
    const [challengerAnswers, opponentAnswers] = await Promise.all([
      prisma.duelAnswer.findMany({
        where: { duelId: id, userId: duel.challengerId },
        select: { isCorrect: true, questionIndex: true },
      }),
      prisma.duelAnswer.findMany({
        where: { duelId: id, userId: duel.opponentId },
        select: { isCorrect: true, questionIndex: true },
      }),
    ]);
    
    const challengerCorrect = challengerAnswers.filter(a => a.isCorrect).length;
    const opponentCorrect = opponentAnswers.filter(a => a.isCorrect).length;
    const quizTotalQuestions = duel.quiz._count.questions;
    
    // Вычисляем максимальную серию правильных ответов для каждого игрока
    const calculateMaxStreak = (answers: typeof challengerAnswers): number => {
      // Сортируем по индексу вопроса
      const sorted = [...answers].sort((a, b) => a.questionIndex - b.questionIndex);
      let maxStreak = 0;
      let currentStreak = 0;
      for (const ans of sorted) {
        if (ans.isCorrect) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      return maxStreak;
    };
    
    const challengerStreak = calculateMaxStreak(challengerAnswers);
    const opponentStreak = calculateMaxStreak(opponentAnswers);
    
    // Challenger challenges (если не бот)
    if (!duel.challenger.isBot) {
      // DUEL_PLAY — сыграл дуэль
      challengeUpdates.push(
        updateChallengeProgress({ userId: duel.challengerId, type: DailyChallengeType.DUEL_PLAY })
      );
      
      // CORRECT_ANSWERS — правильные ответы
      if (challengerCorrect > 0) {
        challengeUpdates.push(
          updateChallengeProgress({ 
            userId: duel.challengerId, 
            type: DailyChallengeType.CORRECT_ANSWERS, 
            increment: challengerCorrect 
          })
        );
      }
      
      // DUEL_WIN — победа
      if (result.winnerId === duel.challengerId) {
        challengeUpdates.push(
          updateChallengeProgress({ userId: duel.challengerId, type: DailyChallengeType.DUEL_WIN })
        );
        
        // PERFECT_DUEL — победа с 0 ошибками
        if (challengerCorrect === quizTotalQuestions) {
          challengeUpdates.push(
            updateChallengeProgress({ 
              userId: duel.challengerId, 
              type: DailyChallengeType.PERFECT_DUEL,
              checkPerfect: true 
            })
          );
        }
      }
      
      // ANSWER_STREAK — серия правильных ответов
      if (challengerStreak > 0) {
        challengeUpdates.push(
          updateChallengeProgress({ 
            userId: duel.challengerId, 
            type: DailyChallengeType.ANSWER_STREAK,
            checkStreak: challengerStreak 
          })
        );
      }
    }
    
    // Opponent challenges (если не бот)
    if (!duel.opponent.isBot) {
      // DUEL_PLAY — сыграл дуэль
      challengeUpdates.push(
        updateChallengeProgress({ userId: duel.opponentId, type: DailyChallengeType.DUEL_PLAY })
      );
      
      // CORRECT_ANSWERS — правильные ответы
      if (opponentCorrect > 0) {
        challengeUpdates.push(
          updateChallengeProgress({ 
            userId: duel.opponentId, 
            type: DailyChallengeType.CORRECT_ANSWERS, 
            increment: opponentCorrect 
          })
        );
      }
      
      // DUEL_WIN — победа
      if (result.winnerId === duel.opponentId) {
        challengeUpdates.push(
          updateChallengeProgress({ userId: duel.opponentId, type: DailyChallengeType.DUEL_WIN })
        );
        
        // PERFECT_DUEL — победа с 0 ошибками
        if (opponentCorrect === quizTotalQuestions) {
          challengeUpdates.push(
            updateChallengeProgress({ 
              userId: duel.opponentId, 
              type: DailyChallengeType.PERFECT_DUEL,
              checkPerfect: true 
            })
          );
        }
      }
      
      // ANSWER_STREAK — серия правильных ответов
      if (opponentStreak > 0) {
        challengeUpdates.push(
          updateChallengeProgress({ 
            userId: duel.opponentId, 
            type: DailyChallengeType.ANSWER_STREAK,
            checkStreak: opponentStreak 
          })
        );
      }
    }
    
    // Выполняем все обновления параллельно (не блокируя ответ)
    Promise.all(challengeUpdates).catch(err => 
      console.error("[Duel Finish] Challenge progress error:", err)
    );

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
