import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLevelProgress, getLevelTitle } from "@/lib/xp";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

function toInt(value: string | null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const userIdParam = toInt(search.get("userId"));

  // ═══ UNIFIED AUTH: Use same auth as other endpoints ═══
  const auth = await authenticateRequest(req);
  
  let user = null;
  
  // Priority 1: userId from query params (if provided)
  if (userIdParam !== null) {
    user = await prisma.user.findUnique({ where: { id: userIdParam } });
  }
  
  // Priority 2: Authenticated user
  if (!user && auth.ok) {
    user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  }

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Получаем equipped frame отдельно (если есть)
  const equippedFrame = user.equippedFrameId
    ? await prisma.cosmeticItem.findUnique({
        where: { id: user.equippedFrameId },
        select: { id: true, slug: true, imageUrl: true, title: true },
      })
    : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSIONS & ANSWERS STATS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const totalSessions = await prisma.quizSession.count({
    where: { userId: user.id },
  });

  const totalCorrectAnswers = await prisma.answer.count({
    where: { session: { userId: user.id }, isCorrect: true },
  });

  // Общее количество ответов для точного расчёта accuracy
  const totalAnswers = await prisma.answer.count({
    where: { session: { userId: user.id } },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD SCORE (главная метрика для отображения)
  // Это взвешенный результат, согласованный с лидербордом
  // ═══════════════════════════════════════════════════════════════════════════
  
  const leaderboardEntries = await prisma.leaderboardEntry.findMany({
    where: { userId: user.id },
    select: { bestScore: true, attempts: true, quizId: true },
  });

  // Сумма всех leaderboard scores (Best + Activity Bonus)
  const totalBestScore = leaderboardEntries.reduce((sum, e) => sum + e.bestScore, 0);
  const totalAttempts = leaderboardEntries.reduce((sum, e) => sum + e.attempts, 0);
  const activityBonus = Math.min(totalAttempts * 50, 500);
  const leaderboardTotalScore = totalBestScore + activityBonus;

  // ═══════════════════════════════════════════════════════════════════════════
  // BEST SCORES BY QUIZ (для раздела "Рекорды")
  // Показываем лучший результат за 1 сессию + leaderboard score
  // ИСКЛЮЧАЕМ турнирные квизы — они доступны только через турниры
  // ═══════════════════════════════════════════════════════════════════════════
  
  const quizzesPlayed = await prisma.quizSession.groupBy({
    by: ["quizId"],
    where: { userId: user.id, finishedAt: { not: null } },
    _max: { totalScore: true },
    _count: { id: true },
  });

  const quizIds = quizzesPlayed.map((q) => q.quizId);
  
  // Получаем квизы, которые используются в турнирах (их исключим)
  const tournamentQuizIds = quizIds.length > 0
    ? (await prisma.tournamentStage.findMany({
        where: { quizId: { in: quizIds } },
        select: { quizId: true },
      })).map((s) => s.quizId)
    : [];
  
  const tournamentQuizSet = new Set(tournamentQuizIds);
  
  // Фильтруем — оставляем только НЕ турнирные квизы
  const nonTournamentQuizzes = quizzesPlayed.filter((q) => !tournamentQuizSet.has(q.quizId));
  const nonTournamentQuizIds = nonTournamentQuizzes.map((q) => q.quizId);
  
  const quizzes =
    nonTournamentQuizIds.length > 0
      ? await prisma.quiz.findMany({
          where: { id: { in: nonTournamentQuizIds } },
          select: { id: true, title: true },
        })
      : [];

  const bestScoreByQuiz = nonTournamentQuizzes.map((q) => {
    const quizTitle = quizzes.find((qq) => qq.id === q.quizId)?.title ?? "Викторина";
    const leaderboardEntry = leaderboardEntries.find((e) => e.quizId === q.quizId);
    
    // Рассчитываем итоговый score по формуле Best + Activity
    const entryBestScore = leaderboardEntry?.bestScore ?? 0;
    const entryAttempts = leaderboardEntry?.attempts ?? 0;
    const entryActivityBonus = Math.min(entryAttempts * 50, 500);
    const entryTotalScore = entryBestScore + entryActivityBonus;
    
    return {
      quizId: q.quizId,
      title: quizTitle,
      bestSessionScore: q._max.totalScore ?? 0,        // Лучший результат за 1 сессию
      leaderboardScore: entryTotalScore,               // Best + Activity Bonus
      bestScore: entryBestScore,                       // Лучший результат
      attempts: q._count.id,                           // Количество попыток
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAST SESSION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const lastSession = await prisma.quizSession.findFirst({
    where: { userId: user.id, finishedAt: { not: null } },
    orderBy: [
      { finishedAt: "desc" },
      { startedAt: "desc" },
    ],
    include: { quiz: { select: { id: true, title: true } } },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL ENERGY SYSTEM (общая энергия на все квизы)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const MAX_ATTEMPTS = 5;
  const HOURS_PER_ATTEMPT = 4;
  const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000;
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);

  // Считаем ВСЕ сессии пользователя глобально (не по квизам) + получаем бонусную энергию
  const [globalRecentAttempts, userBonusEnergy] = await Promise.all([
    prisma.quizSession.count({
    where: {
      userId: user.id,
      startedAt: { gte: cooldownAgo },
    },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { bonusEnergy: true },
    }),
  ]);
  
  const globalEnergyUsed = globalRecentAttempts;
  const globalEnergyRemaining = Math.max(0, MAX_ATTEMPTS - globalRecentAttempts);
  const bonusEnergy = userBonusEnergy?.bonusEnergy ?? 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL RANK (позиция среди всех игроков)
  // ═══════════════════════════════════════════════════════════════════════════

  // Получаем все записи и считаем total score по формуле Best + Activity
  const allEntries = await prisma.leaderboardEntry.findMany({
    select: { userId: true, bestScore: true, attempts: true },
  });

  // Агрегируем по пользователям
  const userScoresMap = new Map<number, { bestScore: number; attempts: number }>();
  for (const entry of allEntries) {
    const current = userScoresMap.get(entry.userId) ?? { bestScore: 0, attempts: 0 };
    userScoresMap.set(entry.userId, {
      bestScore: current.bestScore + entry.bestScore,
      attempts: current.attempts + entry.attempts,
    });
  }

  // Рассчитываем total scores и сортируем
  const allUsersScores = Array.from(userScoresMap.entries())
    .map(([userId, data]) => ({
      userId,
      totalScore: data.bestScore + Math.min(data.attempts * 50, 500),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const globalRank = allUsersScores.findIndex((u) => u.userId === user.id) + 1;
  const totalPlayers = allUsersScores.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // XP & LEVEL SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  
  const userXp = (user as { xp?: number }).xp ?? 0;
  const levelProgress = getLevelProgress(userXp);
  const levelTitle = getLevelTitle(levelProgress.level);

  return NextResponse.json({
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      equippedFrame: equippedFrame ?? null,
    },
    stats: {
      // Основные метрики
      totalScore: leaderboardTotalScore,           // ГЛАВНАЯ МЕТРИКА (согласована с лидербордом)
      totalSessions,
      totalQuizzesPlayed: quizzesPlayed.length,
      totalCorrectAnswers,
      totalAnswers,                                // Для точного расчёта accuracy
      
      // Рейтинг
      globalRank: globalRank > 0 ? globalRank : null,
      totalPlayers,
      
      // XP System
      xp: {
        total: userXp,
        level: levelProgress.level,
        progress: levelProgress.progress,
        currentLevelXp: levelProgress.currentLevelXp,
        nextLevelXp: levelProgress.nextLevelXp,
        xpInCurrentLevel: levelProgress.xpInCurrentLevel,
        xpNeededForNext: levelProgress.xpNeededForNext,
        title: levelTitle.title,
        icon: levelTitle.icon,
        color: levelTitle.color,
      },
      
      // По квизам
      bestScoreByQuiz,
      
      // Последняя сессия
      lastSession: lastSession
        ? {
            quizId: lastSession.quizId,
            quizTitle: lastSession.quiz.title,
            score: lastSession.totalScore,
            finishedAt: lastSession.finishedAt ?? lastSession.startedAt,
          }
        : null,
      
      // Глобальная энергия (общая на все квизы)
      globalEnergy: {
        used: globalEnergyUsed,
        remaining: globalEnergyRemaining,
        max: MAX_ATTEMPTS,
        hoursPerAttempt: HOURS_PER_ATTEMPT,
        bonus: bonusEnergy, // Бонусная энергия из Daily Rewards
      },
    },
  });
}
