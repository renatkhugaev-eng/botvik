import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateQuizXp, getLevelProgress, getLevelTitle, type XpBreakdown } from "@/lib/xp";
import { notifyLevelUp } from "@/lib/notifications";
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
} from "@/lib/achievement-checker";

export const runtime = "nodejs";

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
};

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  // ═══ WEEKLY SCORE UPDATE ═══
  // Same Best + Activity system for weekly competition
  
  let weeklyScoreInfo = null;
  
  if (!alreadyFinished) {
    try {
      const weekStart = getWeekStart();
      
      // Get current weekly entry
      const currentWeekly = await prisma.weeklyScore.findUnique({
        where: {
          userId_weekStart: {
            userId: session.userId,
            weekStart,
          },
        },
        select: { bestScore: true, quizzes: true },
      });

      const weeklyBestScore = currentWeekly?.bestScore ?? 0;
      const weeklyQuizzes = currentWeekly?.quizzes ?? 0;
      
      // Update best score only if current game is better
      const newWeeklyBest = Math.max(weeklyBestScore, currentGameScore);
      const newWeeklyQuizzes = weeklyQuizzes + 1;

      const weeklyResult = await prisma.weeklyScore.upsert({
        where: {
          userId_weekStart: {
            userId: session.userId,
            weekStart,
          },
        },
        update: {
          bestScore: newWeeklyBest,
          quizzes: newWeeklyQuizzes,
        },
        create: {
          userId: session.userId,
          weekStart,
          bestScore: currentGameScore,
          quizzes: 1,
        },
      });

      weeklyScoreInfo = {
        bestScore: weeklyResult.bestScore,
        quizzes: weeklyResult.quizzes,
        totalScore: calculateTotalScore(weeklyResult.bestScore, weeklyResult.quizzes),
        activityBonus: Math.min(weeklyResult.quizzes * ACTIVITY_BONUS_PER_GAME, MAX_ACTIVITY_BONUS),
        gamesUntilMaxBonus: Math.max(0, MAX_GAMES_FOR_BONUS - weeklyResult.quizzes),
      };

      console.log("[finish] Weekly score updated:", weeklyScoreInfo);
    } catch (weeklyError) {
      console.error("[finish] Weekly score update failed:", weeklyError);
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
        .catch(err => console.error("Failed to send level up notification:", err));
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
      
      // Проверяем идеальную игру
      if (serverCorrectCount === serverTotalQuestions && serverTotalQuestions > 0) {
        // perfect_game будет проверен автоматически через perfect_games stat
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
        
        console.log(
          `[finish] User ${session.userId} unlocked ${newAchievements.length} achievements`
        );
      }
    } catch (achievementError) {
      console.error("[finish] Achievement check failed:", achievementError);
    }
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
  });
}
