/**
 * Achievement Checker Service
 * 
 * Проверяет и разблокирует достижения на основе реальных данных
 */

import { prisma } from "@/lib/prisma";
import { getLevelProgress } from "@/lib/xp";
import { 
  ACHIEVEMENTS, 
  Achievement, 
  AchievementRequirementType,
  getAchievementById 
} from "@/lib/achievements";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type UserStats = {
  quizzesPlayed: number;
  quizzesCompleted: number;
  correctAnswers: number;
  totalScore: number;
  bestScore: number;
  perfectGames: number;
  dailyStreak: number;
  maxQuizStreak: number;
  friendsCount: number;
  chatMessages: number;
  level: number;
  xp: number;
  fastAnswers: number;
  weeklyTop: number;
  weeklyWins: number;
  bonusEnergyEarned: number;
  bonusEnergyUsed: number;
  differentQuizzes: number;
  loginDays: number;
  accountAgeDays: number;
  userId: number;
};

export type UnlockedAchievement = {
  achievement: Achievement;
  unlockedAt: Date;
  isNew: boolean;
};

export type AchievementCheckResult = {
  newlyUnlocked: UnlockedAchievement[];
  totalUnlocked: number;
  totalAchievements: number;
  xpEarned: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// STATS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Собрать все статистики пользователя для проверки достижений
 */
export async function getUserStats(userId: number): Promise<UserStats> {
  // Параллельно получаем все данные
  const [
    user,
    sessionsData,
    answersData,
    friendsCount,
    chatCount,
    weeklyWins,
    differentQuizzes,
  ] = await Promise.all([
    // Данные пользователя
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        xp: true,
        dailyRewardStreak: true,
        bonusEnergy: true,
        createdAt: true,
      },
    }),
    
    // Статистика сессий
    prisma.quizSession.aggregate({
      where: { userId },
      _count: { id: true },
      _max: { totalScore: true },
      _sum: { totalScore: true },
    }),
    
    // Статистика ответов
    prisma.answer.groupBy({
      by: ["isCorrect"],
      where: { session: { userId } },
      _count: { id: true },
    }),
    
    // Количество друзей
    prisma.friendship.count({
      where: {
        OR: [
          { userId, status: "ACCEPTED" },
          { friendId: userId, status: "ACCEPTED" },
        ],
      },
    }),
    
    // Сообщения в чате
    prisma.chatMessage.count({
      where: { userId },
    }),
    
    // Победы в недельных соревнованиях
    prisma.weeklyWinner.count({
      where: { userId },
    }),
    
    // Разные квизы
    prisma.quizSession.groupBy({
      by: ["quizId"],
      where: { userId },
    }),
  ]);

  // Завершённые сессии
  const completedSessions = await prisma.quizSession.count({
    where: { userId, finishedAt: { not: null } },
  });

  // Идеальные игры (все ответы правильные)
  const perfectGames = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT s.id) as count
    FROM "QuizSession" s
    WHERE s."userId" = ${userId}
      AND s."finishedAt" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Answer" a 
        WHERE a."sessionId" = s.id AND a."isCorrect" = false
      )
      AND EXISTS (
        SELECT 1 FROM "Answer" a 
        WHERE a."sessionId" = s.id
      )
  `;

  // Быстрые ответы (< 3000ms)
  const fastAnswers = await prisma.answer.count({
    where: {
      session: { userId },
      isCorrect: true,
      timeSpentMs: { lt: 3000 },
    },
  });

  // Максимальная серия правильных ответов (из сессий)
  const maxStreak = await prisma.quizSession.aggregate({
    where: { userId },
    _max: { currentStreak: true },
  });

  // Количество дней захода (уникальные даты сессий)
  const loginDays = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT DATE("startedAt")) as count
    FROM "QuizSession"
    WHERE "userId" = ${userId}
  `;

  // Топ-10 недельных рейтингов
  const weeklyTopCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM (
      SELECT ws."weekStart", ws."bestScore",
        RANK() OVER (PARTITION BY ws."weekStart" ORDER BY ws."bestScore" DESC) as rank
      FROM "WeeklyScore" ws
      WHERE ws."userId" = ${userId}
    ) ranked
    WHERE rank <= 10
  `;

  // Подсчёт правильных ответов
  const correctCount = answersData.find(a => a.isCorrect)?._count?.id ?? 0;
  
  // Уровень
  const levelProgress = getLevelProgress(user?.xp ?? 0);
  
  // Возраст аккаунта в днях
  const accountAgeDays = user?.createdAt 
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  return {
    quizzesPlayed: sessionsData._count?.id ?? 0,
    quizzesCompleted: completedSessions,
    correctAnswers: correctCount,
    totalScore: sessionsData._sum?.totalScore ?? 0,
    bestScore: sessionsData._max?.totalScore ?? 0,
    perfectGames: Number(perfectGames[0]?.count ?? 0),
    dailyStreak: user?.dailyRewardStreak ?? 0,
    maxQuizStreak: maxStreak._max?.currentStreak ?? 0,
    friendsCount,
    chatMessages: chatCount,
    level: levelProgress.level,
    xp: user?.xp ?? 0,
    fastAnswers,
    weeklyTop: Number(weeklyTopCount[0]?.count ?? 0),
    weeklyWins,
    bonusEnergyEarned: 0, // TODO: track this separately
    bonusEnergyUsed: 0,   // TODO: track this separately
    differentQuizzes: differentQuizzes.length,
    loginDays: Number(loginDays[0]?.count ?? 0),
    accountAgeDays,
    userId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT CHECKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить значение статистики для типа условия
 */
function getStatValue(stats: UserStats, type: AchievementRequirementType): number {
  switch (type) {
    case "quizzes_played": return stats.quizzesPlayed;
    case "quizzes_completed": return stats.quizzesCompleted;
    case "correct_answers": return stats.correctAnswers;
    case "total_score": return stats.totalScore;
    case "best_score": return stats.bestScore;
    case "perfect_games": return stats.perfectGames;
    case "daily_streak": return stats.dailyStreak;
    case "quiz_streak": return stats.maxQuizStreak;
    case "friends_count": return stats.friendsCount;
    case "chat_messages": return stats.chatMessages;
    case "level": return stats.level;
    case "xp": return stats.xp;
    case "fast_answers": return stats.fastAnswers;
    case "weekly_top": return stats.weeklyTop;
    case "weekly_wins": return stats.weeklyWins;
    case "bonus_energy_earned": return stats.bonusEnergyEarned;
    case "bonus_energy_used": return stats.bonusEnergyUsed;
    case "different_quizzes": return stats.differentQuizzes;
    case "login_days": return stats.loginDays;
    case "special": return 0; // Special achievements checked separately
    default: return 0;
  }
}

/**
 * Проверить, выполнено ли условие достижения
 */
function checkAchievementCondition(achievement: Achievement, stats: UserStats): boolean {
  if (achievement.requirement.type === "special") {
    // Special achievements are triggered by specific events
    return false;
  }
  
  const currentValue = getStatValue(stats, achievement.requirement.type);
  return currentValue >= achievement.requirement.value;
}

/**
 * Проверить и разблокировать достижения для пользователя
 */
export async function checkAndUnlockAchievements(
  userId: number,
  specialAchievementIds?: string[]
): Promise<AchievementCheckResult> {
  // Получаем статистику пользователя
  const stats = await getUserStats(userId);
  
  // Получаем уже разблокированные достижения
  const unlockedIds = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const unlockedSet = new Set(unlockedIds.map(u => u.achievementId));
  
  // Проверяем каждое достижение
  const newlyUnlocked: UnlockedAchievement[] = [];
  let xpEarned = 0;
  
  for (const achievement of ACHIEVEMENTS) {
    // Пропускаем уже разблокированные
    if (unlockedSet.has(achievement.id)) continue;
    
    let shouldUnlock = false;
    
    // Проверяем специальные достижения
    if (achievement.requirement.type === "special") {
      if (specialAchievementIds?.includes(achievement.id)) {
        shouldUnlock = true;
      }
    } else {
      // Проверяем обычные условия
      shouldUnlock = checkAchievementCondition(achievement, stats);
    }
    
    if (shouldUnlock) {
      // Разблокируем достижение
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          progress: achievement.requirement.value,
        },
      });
      
      // Начисляем XP
      await prisma.user.update({
        where: { id: userId },
        data: { xp: { increment: achievement.xpReward } },
      });
      
      newlyUnlocked.push({
        achievement,
        unlockedAt: new Date(),
        isNew: true,
      });
      
      xpEarned += achievement.xpReward;
      unlockedSet.add(achievement.id);
    }
  }
  
  // Проверяем достижения-коллекторы (количество разблокированных достижений)
  const achievementCounts = [10, 25, 50, 75];
  const achievementMilestones: Record<number, string> = {
    10: "achievements_10",
    25: "achievements_25",
    50: "achievements_50",
    75: "achievements_75",
  };
  
  for (const count of achievementCounts) {
    const milestoneId = achievementMilestones[count];
    if (!unlockedSet.has(milestoneId) && unlockedSet.size >= count) {
      const achievement = getAchievementById(milestoneId);
      if (achievement) {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: milestoneId,
            progress: count,
          },
        });
        
        await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: achievement.xpReward } },
        });
        
        newlyUnlocked.push({
          achievement,
          unlockedAt: new Date(),
          isNew: true,
        });
        
        xpEarned += achievement.xpReward;
        unlockedSet.add(milestoneId);
      }
    }
  }
  
  return {
    newlyUnlocked,
    totalUnlocked: unlockedSet.size,
    totalAchievements: ACHIEVEMENTS.length,
    xpEarned,
  };
}

/**
 * Получить все достижения пользователя с прогрессом
 */
export async function getUserAchievements(userId: number) {
  const [userAchievements, stats] = await Promise.all([
    prisma.userAchievement.findMany({
      where: { userId },
      select: {
        achievementId: true,
        unlockedAt: true,
        notified: true,
      },
    }),
    getUserStats(userId),
  ]);
  
  const unlockedMap = new Map(
    userAchievements.map(ua => [ua.achievementId, ua])
  );
  
  return ACHIEVEMENTS.map(achievement => {
    const unlocked = unlockedMap.get(achievement.id);
    const currentValue = getStatValue(stats, achievement.requirement.type);
    const progress = Math.min(
      (currentValue / achievement.requirement.value) * 100,
      100
    );
    
    return {
      ...achievement,
      unlocked: !!unlocked,
      unlockedAt: unlocked?.unlockedAt ?? null,
      notified: unlocked?.notified ?? false,
      progress: unlocked ? 100 : progress,
      currentValue,
      // Скрываем описание секретных незаконченных достижений
      description: achievement.secret && !unlocked 
        ? "???" 
        : achievement.description,
      name: achievement.secret && !unlocked 
        ? "???" 
        : achievement.name,
    };
  });
}

/**
 * Отметить достижения как просмотренные
 */
export async function markAchievementsNotified(
  userId: number,
  achievementIds: string[]
): Promise<void> {
  await prisma.userAchievement.updateMany({
    where: {
      userId,
      achievementId: { in: achievementIds },
    },
    data: { notified: true },
  });
}

/**
 * Получить новые (непросмотренные) достижения
 */
export async function getNewAchievements(userId: number) {
  const newAchievements = await prisma.userAchievement.findMany({
    where: {
      userId,
      notified: false,
    },
    select: { achievementId: true, unlockedAt: true },
    orderBy: { unlockedAt: "desc" },
  });
  
  return newAchievements
    .map(ua => ({
      achievement: getAchievementById(ua.achievementId),
      unlockedAt: ua.unlockedAt,
    }))
    .filter(a => a.achievement !== undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIAL ACHIEVEMENT TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Проверить специальные достижения, связанные со временем
 */
export function checkTimeBasedAchievements(): string[] {
  const now = new Date();
  // Конвертируем в MSK (UTC+3)
  const mskHour = (now.getUTCHours() + 3) % 24;
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
  const achievements: string[] = [];
  
  // Полуночник (00:00-04:00 MSK)
  if (mskHour >= 0 && mskHour < 4) {
    achievements.push("night_owl");
  }
  
  // Ранняя пташка (05:00-07:00 MSK)
  if (mskHour >= 5 && mskHour < 7) {
    achievements.push("early_bird");
  }
  
  // Новогодняя ночь (31 декабря или 1 января)
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) {
    achievements.push("new_year");
  }
  
  // Выходной (суббота или воскресенье)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // weekend_warrior проверяется отдельно (10 квизов за день)
  }
  
  return achievements;
}

/**
 * Проверить достижение "OG Player" (первые 100 игроков)
 */
export async function checkOGPlayerAchievement(userId: number): Promise<boolean> {
  const userCount = await prisma.user.count({
    where: { id: { lte: userId } },
  });
  return userCount <= 100;
}

/**
 * Проверить достижение "Speed Demon" (все ответы < 3 сек)
 */
export async function checkSpeedDemonAchievement(sessionId: number): Promise<boolean> {
  const answers = await prisma.answer.findMany({
    where: { sessionId },
    select: { timeSpentMs: true, isCorrect: true },
  });
  
  if (answers.length === 0) return false;
  
  return answers.every(a => a.isCorrect && a.timeSpentMs < 3000);
}

/**
 * Проверить достижение "Instant Answer" (ответ < 1 сек)
 */
export function checkInstantAnswerAchievement(timeSpentMs: number, isCorrect: boolean): boolean {
  return isCorrect && timeSpentMs < 1000;
}
