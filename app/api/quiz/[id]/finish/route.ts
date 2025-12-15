import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateQuizXp, getLevelProgress, getLevelTitle, type XpBreakdown } from "@/lib/xp";
import { notifyLevelUp } from "@/lib/notifications";
import { getWeekStart } from "@/lib/week";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   WEIGHTED LEADERBOARD SCORE
   
   Вместо записи лучшего результата (который легко абузить перезапусками),
   используем взвешенный результат первых попыток:
   
   Веса попыток:
   - Попытка 1: 50% от результата
   - Попытка 2: 25% от результата  
   - Попытка 3: 15% от результата
   - Попытка 4: 7% от результата
   - Попытка 5: 3% от результата
   
   Сумма весов = 100%
   
   Это поощряет:
   - Хорошую подготовку перед первой попыткой
   - Честную игру (нет смысла переигрывать 100 раз)
   - Стабильность результатов
═══════════════════════════════════════════════════════════════════════════ */

// Веса для первых 5 попыток (сумма = 1.0)
const ATTEMPT_WEIGHTS = [0.50, 0.25, 0.15, 0.07, 0.03];

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
  const finishedSession = alreadyFinished
    ? session
    : await prisma.quizSession.update({
        where: { id: sessionId },
        data: { finishedAt: new Date() },
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

  // ═══ WEIGHTED SCORE CALCULATION ═══
  
  // Получаем все завершённые сессии пользователя для этого квиза
  const allSessions = await prisma.quizSession.findMany({
    where: { 
      userId: session.userId, 
      quizId,
      finishedAt: { not: null },
    },
    orderBy: { attemptNumber: "asc" },
    take: 5, // Только первые 5 попыток влияют на лидерборд
    select: {
      totalScore: true,
      attemptNumber: true,
    },
  });

  // Рассчитываем взвешенный результат
  let weightedScore = 0;
  let totalWeight = 0;

  for (const sess of allSessions) {
    const attemptIndex = sess.attemptNumber - 1;
    const weight = ATTEMPT_WEIGHTS[attemptIndex] ?? 0;
    weightedScore += sess.totalScore * weight;
    totalWeight += weight;
  }

  // Нормализуем если не все попытки использованы
  // (чтобы 1 попытка давала полный результат, а не 50%)
  const normalizedScore = totalWeight > 0 
    ? Math.round(weightedScore / totalWeight)
    : finishedSession.totalScore;

  // Также сохраняем лучший результат для отображения
  const bestScore = Math.max(...allSessions.map(s => s.totalScore));

  // Обновляем лидерборд (all-time)
  await prisma.leaderboardEntry.upsert({
    where: {
      userId_quizId_periodType: {
        userId: session.userId,
        quizId,
        periodType: "ALL_TIME",
      },
    },
    update: { score: normalizedScore },
    create: {
      userId: session.userId,
      quizId,
      periodType: "ALL_TIME",
      score: normalizedScore,
    },
  });

  // ═══ WEEKLY SCORE UPDATE ═══
  // Add this session's score to weekly competition (only if not already finished)
  console.log("[finish] alreadyFinished:", alreadyFinished, "userId:", session.userId, "score:", finishedSession.totalScore);
  
  if (!alreadyFinished) {
    try {
      const weekStart = getWeekStart();
      console.log("[finish] Updating weekly score for user", session.userId, "weekStart:", weekStart.toISOString());
      
      const weeklyResult = await prisma.weeklyScore.upsert({
        where: {
          userId_weekStart: {
            userId: session.userId,
            weekStart,
          },
        },
        update: {
          score: { increment: finishedSession.totalScore },
          quizzes: { increment: 1 },
        },
        create: {
          userId: session.userId,
          weekStart,
          score: finishedSession.totalScore,
          quizzes: 1,
        },
      });
      console.log("[finish] Weekly score updated:", weeklyResult);
    } catch (weeklyError) {
      // Don't fail the whole request if weekly update fails
      console.error("[finish] Weekly score update failed:", weeklyError);
    }
  }

  // Статистика попыток
  const attemptStats = {
    currentAttempt: finishedSession.attemptNumber,
    totalAttempts: allSessions.length,
    sessionsConsidered: allSessions.map(s => ({
      attempt: s.attemptNumber,
      score: s.totalScore,
      weight: ATTEMPT_WEIGHTS[s.attemptNumber - 1] ?? 0,
    })),
  };

  // ═══ XP SYSTEM ═══
  // Only award XP if session wasn't already finished (prevent double XP)
  let xpBreakdown: XpBreakdown | null = null;
  let levelUp = false;
  let newLevel = 0;
  let totalXp = 0;

  if (!alreadyFinished) {
    // Get user's current XP and last quiz date
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { xp: true, lastQuizAt: true },
    });

    const currentXp = user?.xp ?? 0;
    const lastQuizAt = user?.lastQuizAt;
    
    // Check if this is first quiz of the day
    const now = new Date();
    const isFirstQuizOfDay = !lastQuizAt || 
      lastQuizAt.toDateString() !== now.toDateString();

    // Get quiz total questions for perfect bonus calculation
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { questions: { select: { id: true } } },
    });
    const totalQuestions = quiz?.questions.length ?? 0;

    // Calculate correct count and max streak from session answers
    const answers = finishedSession.answers ?? session.answers ?? [];
    const correctCount = answers.filter(a => a.isCorrect).length;
    
    // Calculate max streak
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

    // Calculate XP
    xpBreakdown = calculateQuizXp({
      correctCount,
      totalQuestions,
      maxStreak,
      isFirstQuizOfDay,
    });

    // Get level before XP update
    const oldLevelInfo = getLevelProgress(currentXp);
    
    // Update user XP
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
    
    // Check for level up
    if (newLevelInfo.level > oldLevelInfo.level) {
      levelUp = true;
      newLevel = newLevelInfo.level;
      
      // Send push notification for level up (async, don't await)
      const levelTitle = getLevelTitle(newLevel);
      notifyLevelUp(session.userId, newLevel, levelTitle.title, xpBreakdown.total)
        .catch(err => console.error("Failed to send level up notification:", err));
    }
  } else {
    // Session was already finished, just get current XP
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { xp: true },
    });
    totalXp = user?.xp ?? 0;
  }

  const levelInfo = getLevelProgress(totalXp);

  // Calculate correct count from answers if not already calculated
  const allAnswers = finishedSession.answers ?? session.answers ?? [];
  const serverCorrectCount = allAnswers.filter(a => a.isCorrect).length;
  
  // Get total questions for this quiz
  const quizQuestions = await prisma.question.findMany({
    where: { quizId },
    select: { id: true },
  });
  const serverTotalQuestions = quizQuestions.length;

  return NextResponse.json({ 
    totalScore: finishedSession.totalScore,
    bestScore,
    leaderboardScore: normalizedScore,
    attemptStats,
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
  });
}
