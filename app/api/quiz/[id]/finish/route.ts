import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { calculateQuizXp, getLevelProgress, getLevelTitle, type XpBreakdown } from "@/lib/xp";
import { notifyLevelUp, checkAndNotifyLeaderboardChanges, notifyFriendActivity } from "@/lib/notifications";
import { getWeekStart } from "@/lib/week";
import { 
  calculateTotalScore, 
  getScoreBreakdown, 
  ACTIVITY_BONUS_PER_GAME, 
  MAX_ACTIVITY_BONUS,
  MAX_GAMES_FOR_BONUS 
} from "@/lib/scoring";
import {
  checkAndUnlockAchievements,
  checkTimeBasedAchievements,
  checkSpeedDemonAchievement,
  checkInstantAnswerAchievement,
  getUserStats,
  checkComebackAchievement,
} from "@/lib/achievement-checker";
import { 
  logQuizCompleted, 
  logHighScore, 
  logAchievement, 
  logLevelUp,
  logTournamentStage,
} from "@/lib/activity";
import { updateChallengeProgress } from "@/lib/daily-challenges";
import { DailyChallengeType } from "@prisma/client";
import { invalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Child logger with route context
const log = logger.child({ route: "quiz/finish" });

// ═══════════════════════════════════════════════════════════════════════════
// TOURNAMENT INTEGRATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

type TournamentStageInfo = {
  tournamentId: number;
  tournamentTitle: string;
  tournamentSlug: string;
  stageId: number;
  stageTitle: string;
  stageOrder: number;
  totalStages: number;
  scoreMultiplier: number;
  tournamentScore: number;
  newTotalScore: number;
  rank: number | null;
  passed: boolean;
  isLastStage: boolean;
  nextStageTitle: string | null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   UNIFIED SCORING SYSTEM: Best + Activity
   
   Формула: TotalScore = BestScore + ActivityBonus
   
   Где:
   - BestScore = лучший результат за одну игру
   - ActivityBonus = min(GamesPlayed × 50, 500)
   
   Преимущества:
   - Качество важнее количества (70-80% = лучший результат)
   - Активность поощряется (бонус за регулярную игру)
   - Анти-абуз (нет смысла играть 100+ раз)
   - Понятность ("Играй хорошо + играй регулярно")
═══════════════════════════════════════════════════════════════════════════ */

type FinishRequestBody = {
  sessionId?: number;
  tournamentStageId?: number; // Опционально: ID этапа турнира
};

// ═══════════════════════════════════════════════════════════════════════════
// REFERRER NOTIFICATION HELPER
// Notify referrer when their referral beats their per-quiz best score
// ═══════════════════════════════════════════════════════════════════════════

async function notifyReferrerIfBeaten(
  userId: number,
  quizId: number,
  newScore: number
): Promise<void> {
  // Get user with their referrer info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      firstName: true,
      referredById: true,
    },
  });
  
  if (!user?.referredById) return; // No referrer
  
  // Get referrer's best score for this quiz
  const referrerEntry = await prisma.leaderboardEntry.findUnique({
    where: {
      userId_quizId_periodType: {
        userId: user.referredById,
        quizId,
        periodType: "ALL_TIME",
      },
    },
    select: { bestScore: true },
  });
  
  // Only notify if referral beat referrer's score
  if (!referrerEntry || newScore <= referrerEntry.bestScore) return;
  
  // Get quiz title
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { title: true },
  });
  
  const userName = user.username || user.firstName || "Друг";
  
  await notifyFriendActivity(
    user.referredById,
    userName,
    "beat_score",
    quiz?.title,
    newScore
  );
  
  log.info("Notified referrer about beat score", { referrerId: user.referredById, userName });
}

// ═══════════════════════════════════════════════════════════════════════════
// TOURNAMENT STAGE PROCESSING
// Полная логика с транзакциями, проверкой последовательности и minScore/topN
// ═══════════════════════════════════════════════════════════════════════════

async function processTournamentStage(
  userId: number,
  quizId: number,
  sessionId: number,
  gameScore: number
): Promise<TournamentStageInfo | null> {
  const now = new Date();
  log.debug("Processing tournament stage", { userId, quizId, sessionId, gameScore });
  
  // ═══ 1. Находим турнирный этап с этим квизом ═══
  // ВАЖНО: Принимаем и ACTIVE и FINISHED турниры!
  // Причина: CRON может финализировать турнир ПОКА пользователь проходит квиз
  // Проверяем что сессия была начата ДО окончания турнира (защита от злоупотреблений)
  const activeStage = await prisma.tournamentStage.findFirst({
    where: {
      AND: [
        { quizId },
        {
          tournament: {
            // Принимаем ACTIVE и FINISHED турниры
            // FINISHED нужен для race condition: пользователь начал до финализации
            status: { in: ["ACTIVE", "FINISHED"] },
            participants: {
              some: {
                userId,
                // Также принимаем FINISHED участников (они стали FINISHED при финализации)
                status: { in: ["REGISTERED", "ACTIVE", "FINISHED"] },
              },
            },
          },
        },
        // Упрощённая проверка: этап должен был начаться (startsAt <= now) или не иметь времени начала
        // Не проверяем endsAt — чтобы засчитать результат если пользователь начал вовремя
        {
          OR: [
            { startsAt: null },
            { startsAt: { lte: now } },
          ],
        },
      ],
    },
    include: {
      tournament: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true, // Нужно для логирования race condition
          startsAt: true,
          endsAt: true,
          stages: {
            orderBy: { order: "asc" },
            select: { 
              id: true, 
              order: true, 
              title: true,
              minScore: true,
              topN: true,
            },
          },
        },
      },
    },
    orderBy: { tournament: { startsAt: "asc" } },
  });

  log.debug("Tournament activeStage query", activeStage ? {
    stageId: activeStage.id,
    stageOrder: activeStage.order,
    stageTitle: activeStage.title,
    tournamentId: activeStage.tournament?.id,
    tournamentStatus: activeStage.tournament?.status,
  } : { found: false });

  if (!activeStage) {
    // Детальная диагностика
    const debugStage = await prisma.tournamentStage.findFirst({
      where: { quizId },
      include: {
        tournament: {
          select: {
            id: true,
            status: true,
            endsAt: true,
            participants: {
              where: { userId },
              select: { status: true, currentStage: true },
            },
            stages: {
              orderBy: { order: "asc" },
              select: { id: true, order: true, title: true, startsAt: true, endsAt: true },
            },
          },
        },
      },
    });
    
    if (debugStage) {
      // Получаем результаты предыдущих этапов
      const previousResults = await prisma.tournamentStageResult.findMany({
        where: { userId, stageId: { in: debugStage.tournament.stages.map(s => s.id) } },
        select: { stageId: true, passed: true, completedAt: true, score: true },
      });
      
      const stagesInfo = debugStage.tournament.stages.map(s => {
        const result = previousResults.find(r => r.stageId === s.id);
        return {
          order: s.order,
          title: s.title,
          stageId: s.id,
          passed: result?.passed ?? null,
          completed: !!result?.completedAt,
          score: result?.score ?? null,
        };
      });
      
      log.info("No active tournament stage found", {
        quizId,
        userId,
        tournamentId: debugStage.tournament.id,
        tournamentStatus: debugStage.tournament.status,
        participantStatus: debugStage.tournament.participants[0]?.status ?? "NOT_JOINED",
        stageOrder: debugStage.order,
        stagesProgress: stagesInfo,
      });
    } else {
      log.debug("Quiz is not part of any tournament", { quizId });
    }
    
    return null;
  }

  // ═══ 1.5. ЗАЩИТА ОТ ЗЛОУПОТРЕБЛЕНИЙ ═══
  // Если турнир уже FINISHED, проверяем что сессия была начата ДО окончания турнира
  // Это предотвращает попытки засчитать квиз начатый ПОСЛЕ финализации
  if (activeStage.tournament.endsAt) {
    const quizSession = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: { startedAt: true },
    });
    
    if (quizSession && quizSession.startedAt > activeStage.tournament.endsAt) {
      log.warn("Session started after tournament ended - not counting", {
        sessionId,
        sessionStartedAt: quizSession.startedAt.toISOString(),
        tournamentEndsAt: activeStage.tournament.endsAt.toISOString(),
      });
      return null; // Не засчитываем — сессия начата после окончания турнира
    }
    
    // Логируем для отладки когда засчитываем FINISHED турнир
    if (activeStage.tournament.status === "FINISHED") {
      log.info("Race condition handled - counting finished tournament quiz", {
        tournamentId: activeStage.tournament.id,
        sessionId,
      });
    }
  }

  // ═══ 2. Проверяем, не пройден ли уже этот этап ═══
  const existingResult = await prisma.tournamentStageResult.findUnique({
    where: {
      stageId_userId: { stageId: activeStage.id, userId },
    },
  });

  if (existingResult?.completedAt) {
    // Этап уже пройден — не обновляем (защита от переигрывания)
    log.info("Tournament stage already completed", { stageId: activeStage.id, userId });
    return null;
  }

  // ═══ 3. Проверяем последовательность этапов ═══
  // Пользователь должен ЗАВЕРШИТЬ предыдущие этапы (не требуем passed=true)
  // Это нужно для backwards compatibility
  if (activeStage.order > 1) {
    const previousStages = activeStage.tournament.stages.filter(
      (s: { id: number; order: number; title: string; minScore: number | null; topN: number | null }) => 
        s.order < activeStage.order
    );
    
    // Находим ВСЕ завершённые результаты (без требования passed=true)
    const previousResults = await prisma.tournamentStageResult.findMany({
      where: {
        userId,
        stageId: { in: previousStages.map((s: { id: number }) => s.id) },
        completedAt: { not: null }, // Только завершённые
      },
      select: { stageId: true, passed: true, rank: true, score: true },
    });
    
    const completedStageIds = new Set(previousResults.map((r: { stageId: number }) => r.stageId));
    const allPreviousCompleted = previousStages.every((s: { id: number }) => completedStageIds.has(s.id));
    
    if (!allPreviousCompleted) {
      const missingStages = previousStages.filter((s: { id: number }) => !completedStageIds.has(s.id));
      log.warn("Previous tournament stages not completed", {
        userId,
        stageOrder: activeStage.order,
        missing: missingStages.map((s: { order: number; title: string }) => ({ order: s.order, title: s.title })),
        previousResults,
      });
      return null; // Не даём проходить этап вне последовательности
    }
    
    log.debug("All previous stages completed", { userId, previousResults });
  }

  // ═══ 4. Вычисляем очки с множителем ═══
  const tournamentScore = Math.round(gameScore * activeStage.scoreMultiplier);

  // ═══ 5. Проверяем minScore (если установлен) ═══
  const passedMinScore = activeStage.minScore === null || tournamentScore >= activeStage.minScore;

  // ═══ 6. АТОМАРНАЯ ТРАНЗАКЦИЯ: Сохраняем результат + обновляем ранги ═══
  // 
  // АРХИТЕКТУРНОЕ РЕШЕНИЕ о рангах:
  // - Ранги вычисляются для текущего пользователя внутри транзакции
  // - Другие участники НЕ обновляются (это было бы O(n) операций)
  // - При конкурентных запросах возможна временная неточность рангов
  // - ФИНАЛЬНЫЕ ранги пересчитываются в finalizeTournament() перед раздачей призов
  // - Это разумный компромисс между точностью и производительностью
  //
  const result = await prisma.$transaction(async (tx) => {
    // 6.1 Обновляем участника турнира (сначала, чтобы получить актуальный totalScore)
    const participant = await tx.tournamentParticipant.update({
      where: {
        tournamentId_userId: {
          tournamentId: activeStage.tournament.id,
          userId,
        },
      },
      data: {
        totalScore: { increment: tournamentScore },
        status: "ACTIVE",
      },
      select: { id: true, totalScore: true },
    });

    // 6.2 Вычисляем ранг ВНУТРИ транзакции для консистентности
    // Считаем позицию пользователя (сколько участников имеют больше очков)
    const higherScoreCount = await tx.tournamentParticipant.count({
      where: {
        tournamentId: activeStage.tournament.id,
        totalScore: { gt: participant.totalScore },
      },
    });
    const myRank = higherScoreCount + 1;

    // 6.3 Проверяем topN ВНУТРИ транзакции
    const passedTopN = activeStage.topN === null || myRank <= activeStage.topN;
    const passed = passedMinScore && passedTopN;

    // 6.4 Записываем результат этапа с корректным passed статусом
    const stageResult = await tx.tournamentStageResult.upsert({
      where: {
        stageId_userId: { stageId: activeStage.id, userId },
      },
      update: {
        score: tournamentScore,
        quizSessionId: sessionId,
        completedAt: now,
        passed,
        rank: myRank,
      },
      create: {
        stageId: activeStage.id,
        userId,
        score: tournamentScore,
        quizSessionId: sessionId,
        completedAt: now,
        passed,
        rank: myRank,
      },
    });

    // 6.5 Обновляем участника с рангом и currentStage
    await tx.tournamentParticipant.update({
      where: { id: participant.id },
      data: { 
        rank: myRank,
        // Увеличиваем currentStage только если passed
        ...(passed && { currentStage: activeStage.order + 1 }),
      },
    });

    return {
      stageResult,
      participant,
      myRank,
      passed,
      passedTopN,
    };
  });

  const passed = result.passed;

  // ═══ 8. Определяем следующий этап ═══
  const totalStages = activeStage.tournament.stages.length;
  const currentStageIndex = activeStage.tournament.stages.findIndex(
    (s: { id: number }) => s.id === activeStage.id
  );
  const nextStage = activeStage.tournament.stages[currentStageIndex + 1] ?? null;
  const isLastStage = currentStageIndex === totalStages - 1;

  log.info("Tournament stage completed", {
    userId,
    stageOrder: activeStage.order,
    totalStages,
    score: tournamentScore,
    rank: result.myRank,
    passed,
  });

  return {
    tournamentId: activeStage.tournament.id,
    tournamentTitle: activeStage.tournament.title,
    tournamentSlug: activeStage.tournament.slug,
    stageId: activeStage.id,
    stageTitle: activeStage.title,
    stageOrder: activeStage.order,
    totalStages,
    scoreMultiplier: activeStage.scoreMultiplier,
    tournamentScore,
    newTotalScore: result.participant.totalScore,
    rank: result.myRank,
    passed,
    isLastStage,
    nextStageTitle: nextStage?.title ?? null,
  };
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const authenticatedUserId = auth.user.id;

  const { id } = await context.params;
  const quizId = Number(id);
  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  let body: FinishRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "session_required" }, { status: 400 });
  }

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    select: { 
      id: true, 
      quizId: true, 
      userId: true, 
      totalScore: true, 
      finishedAt: true,
      attemptNumber: true,
      answers: {
        select: { isCorrect: true },
      },
    },
  });

  if (!session || session.quizId !== quizId) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // ═══ SESSION OWNERSHIP CHECK ═══
  // CRITICAL: Prevent users from finishing other users' sessions
  if (session.userId !== authenticatedUserId) {
    log.warn("SECURITY: Session ownership violation", {
      attemptedBy: authenticatedUserId,
      sessionId,
      sessionOwner: session.userId,
    });
    return NextResponse.json({ error: "session_not_yours" }, { status: 403 });
  }

  // Завершаем сессию, если ещё не завершена
  const alreadyFinished = session.finishedAt !== null;
  
  // Вычисляем maxStreak до завершения (для сохранения в БД)
  let sessionMaxStreak = 0;
  if (!alreadyFinished) {
    let streak = 0;
    for (const answer of session.answers) {
      if (answer.isCorrect) {
        streak++;
        sessionMaxStreak = Math.max(sessionMaxStreak, streak);
      } else {
        streak = 0;
      }
    }
  }
  
  const finishedSession = alreadyFinished
    ? session
    : await prisma.quizSession.update({
        where: { id: sessionId },
        data: { 
          finishedAt: new Date(),
          maxStreak: sessionMaxStreak, // Сохраняем максимальную серию
        },
        select: { 
          id: true, 
          quizId: true, 
          userId: true, 
          totalScore: true, 
          finishedAt: true,
          attemptNumber: true,
          answers: {
            select: { isCorrect: true },
          },
        },
      });

  const currentGameScore = finishedSession.totalScore;

  // ═══ LEADERBOARD UPDATE (All-Time) ═══
  // Best + Activity system for per-quiz leaderboard
  
  // Get current leaderboard entry
  const currentEntry = await prisma.leaderboardEntry.findUnique({
    where: {
      userId_quizId_periodType: {
        userId: session.userId,
        quizId,
        periodType: "ALL_TIME",
      },
    },
    select: { bestScore: true, attempts: true },
  });

  const currentBestScore = currentEntry?.bestScore ?? 0;
  const currentAttempts = currentEntry?.attempts ?? 0;
  
  // Update best score only if current game is better
  const newBestScore = Math.max(currentBestScore, currentGameScore);
  const newAttempts = alreadyFinished ? currentAttempts : currentAttempts + 1;

  // Update leaderboard entry
  await prisma.leaderboardEntry.upsert({
    where: {
      userId_quizId_periodType: {
        userId: session.userId,
        quizId,
        periodType: "ALL_TIME",
      },
    },
    update: { 
      bestScore: newBestScore,
      attempts: newAttempts,
    },
    create: {
      userId: session.userId,
      quizId,
      periodType: "ALL_TIME",
      bestScore: currentGameScore,
      attempts: 1,
    },
  });

  // Calculate total leaderboard score
  const leaderboardScore = calculateTotalScore(newBestScore, newAttempts);

  // ═══ INVALIDATE LEADERBOARD CACHE ═══
  // Async, non-blocking - cache will be refreshed on next request
  if (!alreadyFinished) {
    const weekStartForCache = getWeekStart();
    invalidateLeaderboardCache({
      quizId,
      weekStart: weekStartForCache,
      invalidateGlobal: true,
    }).catch(err => log.error("Leaderboard cache invalidation failed", { error: err, quizId }));
  }

  // ═══ NOTIFY REFERRER IF THEIR REFERRAL BEAT THEIR SCORE ═══
  if (!alreadyFinished && currentGameScore > currentBestScore) {
    // Check if user was referred by someone and beat their per-quiz score
    notifyReferrerIfBeaten(session.userId, quizId, currentGameScore).catch(err =>
      log.error("Referrer beat notification failed", { error: err, userId: session.userId })
    );
  }

  // ═══ WEEKLY SCORE UPDATE ═══
  // NEW: Sum of best scores per quiz (not just single best)
  
  let weeklyScoreInfo = null;
  
  if (!alreadyFinished) {
    try {
      const weekStart = getWeekStart();
      
      // ═══ 1. Update per-quiz best score for this week ═══
      const currentQuizBest = await prisma.weeklyQuizBest.findUnique({
        where: {
          userId_weekStart_quizId: {
            userId: session.userId,
            weekStart,
            quizId,
          },
        },
        select: { bestScore: true, attempts: true },
      });

      const previousQuizBest = currentQuizBest?.bestScore ?? 0;
      const previousAttempts = currentQuizBest?.attempts ?? 0;
      const newQuizBest = Math.max(previousQuizBest, currentGameScore);
      const isNewQuiz = !currentQuizBest; // First time playing this quiz this week
      const isImprovement = currentGameScore > previousQuizBest;

      await prisma.weeklyQuizBest.upsert({
        where: {
          userId_weekStart_quizId: {
            userId: session.userId,
            weekStart,
            quizId,
          },
        },
        update: {
          bestScore: newQuizBest,
          attempts: previousAttempts + 1,
        },
        create: {
          userId: session.userId,
          weekStart,
          quizId,
          bestScore: currentGameScore,
          attempts: 1,
        },
      });

      // ═══ 2. Calculate total weekly score (sum of all quiz bests) ═══
      const allQuizBests = await prisma.weeklyQuizBest.findMany({
        where: {
          userId: session.userId,
          weekStart,
        },
        select: { bestScore: true },
      });

      const totalBestScore = allQuizBests.reduce((sum, q) => sum + q.bestScore, 0);
      const uniqueQuizzes = allQuizBests.length;

      // ═══ 3. Update WeeklyScore with cached totals ═══
      const weeklyResult = await prisma.weeklyScore.upsert({
        where: {
          userId_weekStart: {
            userId: session.userId,
            weekStart,
          },
        },
        update: {
          totalBestScore,
          quizzes: uniqueQuizzes,
          bestScore: Math.max(currentGameScore, previousQuizBest), // Legacy field
        },
        create: {
          userId: session.userId,
          weekStart,
          totalBestScore,
          quizzes: 1,
          bestScore: currentGameScore, // Legacy field
        },
      });

      // ═══ 4. Calculate improvement for response ═══
      const scoreDelta = isImprovement ? (currentGameScore - previousQuizBest) : 0;

      weeklyScoreInfo = {
        totalBestScore: weeklyResult.totalBestScore,
        uniqueQuizzes: weeklyResult.quizzes,
        thisQuizBest: newQuizBest,
        thisQuizAttempts: previousAttempts + 1,
        isNewQuiz,
        isImprovement,
        scoreDelta,
        // Для совместимости со старым API
        bestScore: weeklyResult.totalBestScore,
        quizzes: weeklyResult.quizzes,
        totalScore: weeklyResult.totalBestScore, // Теперь это сумма лучших
        activityBonus: 0, // Больше не используется
        gamesUntilMaxBonus: 0, // Больше не используется
      };

      log.info("Weekly score updated", {
        quizId,
        previousQuizBest,
        currentGameScore,
        newQuizBest,
        totalBestScore,
        uniqueQuizzes,
        isNewQuiz,
        isImprovement,
      });
      
      // Check if this pushed anyone down in the leaderboard (async, non-blocking)
      checkAndNotifyLeaderboardChanges(
        session.userId,
        weeklyResult.totalBestScore,
        weekStart
      ).catch(err => log.error("Leaderboard notification failed", { error: err }));
      
    } catch (weeklyError) {
      log.error("Weekly score update failed", { error: weeklyError });
    }
  }

  // ═══ XP SYSTEM ═══
  let xpBreakdown: XpBreakdown | null = null;
  let levelUp = false;
  let newLevel = 0;
  let totalXp = 0;

  if (!alreadyFinished) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { xp: true, lastQuizAt: true },
    });

    const currentXp = user?.xp ?? 0;
    const lastQuizAt = user?.lastQuizAt;
    
    const now = new Date();
    const isFirstQuizOfDay = !lastQuizAt || 
      lastQuizAt.toDateString() !== now.toDateString();

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { questions: { select: { id: true } } },
    });
    const totalQuestions = quiz?.questions.length ?? 0;

    const answers = finishedSession.answers ?? session.answers ?? [];
    const correctCount = answers.filter(a => a.isCorrect).length;
    
    let maxStreak = 0;
    let currentStreak = 0;
    for (const answer of answers) {
      if (answer.isCorrect) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    xpBreakdown = calculateQuizXp({
      correctCount,
      totalQuestions,
      maxStreak,
      isFirstQuizOfDay,
    });

    const oldLevelInfo = getLevelProgress(currentXp);
    
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        xp: { increment: xpBreakdown.total },
        lastQuizAt: now,
      },
      select: { xp: true },
    });

    totalXp = updatedUser.xp;
    const newLevelInfo = getLevelProgress(totalXp);
    
    if (newLevelInfo.level > oldLevelInfo.level) {
      levelUp = true;
      newLevel = newLevelInfo.level;
      
      const levelTitle = getLevelTitle(newLevel);
      notifyLevelUp(session.userId, newLevel, levelTitle.title, xpBreakdown.total)
        .catch(err => log.error("Failed to send level up notification", { error: err, userId: session.userId }));
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { xp: true },
    });
    totalXp = user?.xp ?? 0;
  }

  const levelInfo = getLevelProgress(totalXp);

  // Calculate correct count from answers
  const allAnswers = finishedSession.answers ?? session.answers ?? [];
  const serverCorrectCount = allAnswers.filter(a => a.isCorrect).length;
  
  const quizQuestions = await prisma.question.findMany({
    where: { quizId },
    select: { id: true },
  });
  const serverTotalQuestions = quizQuestions.length;

  // Score breakdown for client
  const scoreBreakdown = getScoreBreakdown(newBestScore, newAttempts);

  // ═══ ACHIEVEMENTS CHECK ═══
  let newAchievements: { id: string; name: string; icon: string; xpReward: number }[] = [];
  
  if (!alreadyFinished) {
    try {
      // Собираем специальные достижения для проверки
      const specialAchievements: string[] = [...checkTimeBasedAchievements()];
      
      // Проверяем Speed Demon (все ответы < 3 сек)
      const isSpeedDemon = await checkSpeedDemonAchievement(sessionId);
      if (isSpeedDemon) {
        specialAchievements.push("speed_demon");
      }
      
      // Проверяем Instant Answer (любой ответ < 1 сек)
      const sessionAnswers = await prisma.answer.findMany({
        where: { sessionId },
        select: { timeSpentMs: true, isCorrect: true },
      });
      const hasInstantAnswer = sessionAnswers.some(a => 
        checkInstantAnswerAchievement(a.timeSpentMs, a.isCorrect)
      );
      if (hasInstantAnswer) {
        specialAchievements.push("instant_answer");
      }
      
      // Проверяем Comeback (7+ дней без игры)
      const stats = await getUserStats(session.userId);
      if (checkComebackAchievement(stats.daysSinceLastQuiz)) {
        specialAchievements.push("comeback");
      }
      
      // Проверяем и разблокируем достижения
      const achievementResult = await checkAndUnlockAchievements(
        session.userId,
        specialAchievements
      );
      
      if (achievementResult.newlyUnlocked.length > 0) {
        newAchievements = achievementResult.newlyUnlocked.map(u => ({
          id: u.achievement.id,
          name: u.achievement.name,
          icon: u.achievement.icon,
          xpReward: u.achievement.xpReward,
        }));
        
        log.info("Achievements unlocked", { userId: session.userId, count: newAchievements.length });
      }
    } catch (achievementError) {
      log.error("Achievement check failed", { error: achievementError });
    }
  }

  // ═══ TOURNAMENT STAGE PROCESSING ═══
  let tournamentStageInfo: TournamentStageInfo | null = null;
  
  log.debug("Processing tournament stage check", { alreadyFinished, quizId, userId: session.userId, sessionId });
  
  if (!alreadyFinished) {
    try {
      tournamentStageInfo = await processTournamentStage(
        session.userId,
        quizId,
        sessionId,
        currentGameScore
      );
      
      if (tournamentStageInfo) {
        log.info("Tournament stage completed", {
          tournament: tournamentStageInfo.tournamentTitle,
          stage: tournamentStageInfo.stageTitle,
          score: tournamentStageInfo.tournamentScore,
          rank: tournamentStageInfo.rank,
        });
      }
    } catch (tournamentError) {
      log.error("Tournament processing failed", { error: tournamentError });
    }
  }

  // ═══ ACTIVITY LOGGING (для ленты друзей) ═══
  if (!alreadyFinished) {
    // Получаем название квиза для активности
    const quizForActivity = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { title: true },
    });
    const quizTitle = quizForActivity?.title ?? "Квиз";

    // 1. Логируем завершение квиза
    logQuizCompleted(session.userId, quizId, quizTitle, currentGameScore).catch(err =>
      log.error("Activity log failed", { error: err, type: "quiz_completed" })
    );

    // 2. Если новый рекорд — отдельная активность
    if (currentGameScore > currentBestScore) {
      logHighScore(session.userId, quizId, quizTitle, currentGameScore).catch(err =>
        log.error("Activity log failed", { error: err, type: "high_score" })
      );
    }

    // 3. Логируем каждое новое достижение
    for (const achievement of newAchievements) {
      logAchievement(session.userId, achievement.id, achievement.name).catch(err =>
        log.error("Activity log failed", { error: err, type: "achievement" })
      );
    }

    // 4. Логируем повышение уровня
    if (levelUp) {
      logLevelUp(session.userId, newLevel).catch(err =>
        log.error("Activity log failed", { error: err, type: "level_up" })
      );
    }

    // 5. Логируем прохождение этапа турнира
    if (tournamentStageInfo) {
      logTournamentStage(
        session.userId, 
        tournamentStageInfo.tournamentId, 
        tournamentStageInfo.tournamentTitle,
        tournamentStageInfo.tournamentScore
      ).catch(err =>
        log.error("Activity log failed", { error: err, type: "tournament_stage" })
      );
    }
  }

  // ═══ PROFILE 2.0: Clear "currently playing" status ═══
  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        currentQuizId: null,
        currentSessionStart: null,
        status: "ONLINE",
        lastSeenAt: new Date(),
      },
    });
  } catch {
    // Non-critical, don't fail the request
    log.warn("Failed to clear playing status", { userId: session.userId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DAILY CHALLENGES — Обновляем прогресс (не блокируем ответ)
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (!alreadyFinished) {
    const challengeUpdates: Promise<void>[] = [];
    
    // QUIZ_COMPLETE — завершил квиз
    challengeUpdates.push(
      updateChallengeProgress({ userId: session.userId, type: DailyChallengeType.QUIZ_COMPLETE })
    );
    
    // CORRECT_ANSWERS — правильные ответы
    const correctCount = session.answers.filter(a => a.isCorrect).length;
    if (correctCount > 0) {
      challengeUpdates.push(
        updateChallengeProgress({ 
          userId: session.userId, 
          type: DailyChallengeType.CORRECT_ANSWERS, 
          increment: correctCount 
        })
      );
    }
    
    // ANSWER_STREAK — серия правильных ответов
    if (sessionMaxStreak > 0) {
      challengeUpdates.push(
        updateChallengeProgress({ 
          userId: session.userId, 
          type: DailyChallengeType.ANSWER_STREAK, 
          checkStreak: sessionMaxStreak 
        })
      );
    }
    
    Promise.all(challengeUpdates).catch(err => 
      log.error("Challenge progress error", { error: err })
    );
  }

  return NextResponse.json({ 
    // Current game result
    gameScore: currentGameScore,
    
    // Leaderboard info (Best + Activity)
    leaderboard: {
      bestScore: newBestScore,
      attempts: newAttempts,
      activityBonus: scoreBreakdown.activityBonus,
      totalScore: leaderboardScore,
      gamesUntilMaxBonus: scoreBreakdown.gamesUntilMaxBonus,
      isNewBest: currentGameScore > currentBestScore,
    },
    
    // Weekly competition info
    weekly: weeklyScoreInfo,
    
    // Legacy fields for compatibility
    totalScore: currentGameScore,
    bestScore: newBestScore,
    leaderboardScore,
    
    // Server-side accurate stats for star calculation
    correctCount: serverCorrectCount,
    totalQuestions: serverTotalQuestions,
    
    // XP info
    xp: {
      earned: xpBreakdown?.total ?? 0,
      breakdown: xpBreakdown,
      total: totalXp,
      level: levelInfo.level,
      progress: levelInfo.progress,
      xpToNextLevel: levelInfo.xpNeededForNext - levelInfo.xpInCurrentLevel,
      levelUp,
      newLevel: levelUp ? newLevel : undefined,
    },
    
    // Scoring system info (for UI explanations)
    scoringInfo: {
      formula: "TotalScore = BestScore + ActivityBonus",
      activityBonusPerGame: ACTIVITY_BONUS_PER_GAME,
      maxActivityBonus: MAX_ACTIVITY_BONUS,
      maxGamesForBonus: MAX_GAMES_FOR_BONUS,
    },
    
    // New achievements unlocked
    achievements: newAchievements,
    
    // Tournament stage info (if quiz is part of a tournament)
    tournament: tournamentStageInfo ? {
      id: tournamentStageInfo.tournamentId,
      title: tournamentStageInfo.tournamentTitle,
      slug: tournamentStageInfo.tournamentSlug,
      stage: {
        id: tournamentStageInfo.stageId,
        title: tournamentStageInfo.stageTitle,
        order: tournamentStageInfo.stageOrder,
        totalStages: tournamentStageInfo.totalStages,
        scoreMultiplier: tournamentStageInfo.scoreMultiplier,
      },
      score: tournamentStageInfo.tournamentScore,
      totalScore: tournamentStageInfo.newTotalScore,
      rank: tournamentStageInfo.rank,
      passed: tournamentStageInfo.passed,
      isLastStage: tournamentStageInfo.isLastStage,
      nextStageTitle: tournamentStageInfo.nextStageTitle,
    } : null,
  });
}
