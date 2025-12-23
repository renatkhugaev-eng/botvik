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
  referralsCount: number;
  userId: number;
  // Специальные поля для достижений
  rareAchievementsCount: number;  // Количество редких+ достижений
  totalAchievementsCount: number; // Всего разблокированных достижений
  daysSinceLastQuiz: number;      // Дней с последнего квиза (для comeback)
  quizzesToday: number;           // Квизов сегодня (для weekend_warrior)
  isWeekend: boolean;             // Сегодня выходной
  // Статистика дуэлей
  duelsPlayed: number;            // Сыграно дуэлей
  duelsWon: number;               // Побед в дуэлях
  duelWinStreak: number;          // Текущая серия побед
  duelsPerfect: number;           // Идеальных дуэлей (100%)
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
    referralsCount,
  ] = await Promise.all([
    // Данные пользователя
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        xp: true,
        dailyRewardStreak: true,
        totalDailyStreak: true,
        maxDailyStreak: true,
        bonusEnergy: true,
        bonusEnergyEarned: true,
        bonusEnergyUsed: true,
        createdAt: true,
        lastQuizAt: true, // Для comeback achievement
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
    
    // Количество рефералов (приглашённых друзей)
    prisma.user.count({
      where: { referredById: userId },
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

  // Максимальная серия правильных ответов (из сохранённого maxStreak сессий)
  const maxStreak = await prisma.quizSession.aggregate({
    where: { userId },
    _max: { maxStreak: true },
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

  // ═══ СПЕЦИАЛЬНЫЕ ПОЛЯ ДЛЯ ДОСТИЖЕНИЙ ═══
  
  // Дней с последнего квиза (для comeback)
  const daysSinceLastQuiz = user?.lastQuizAt
    ? Math.floor((Date.now() - user.lastQuizAt.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  
  // Проверяем выходной (суббота=6 или воскресенье=0)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Квизов сегодня (для weekend_warrior)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const quizzesToday = await prisma.quizSession.count({
    where: {
      userId,
      startedAt: { gte: todayStart },
    },
  });
  
  // Количество разблокированных достижений
  const unlockedAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const totalAchievementsCount = unlockedAchievements.length;
  
  // Количество редких+ достижений (rare, epic, legendary)
  const rareRarities = ["rare", "epic", "legendary"];
  const rareAchievementsCount = unlockedAchievements.filter(ua => {
    const ach = ACHIEVEMENTS.find(a => a.id === ua.achievementId);
    return ach && rareRarities.includes(ach.rarity);
  }).length;

  return {
    quizzesPlayed: sessionsData._count?.id ?? 0,
    quizzesCompleted: completedSessions,
    correctAnswers: correctCount,
    totalScore: sessionsData._sum?.totalScore ?? 0,
    bestScore: sessionsData._max?.totalScore ?? 0,
    perfectGames: Number(perfectGames[0]?.count ?? 0),
    // Используем totalDailyStreak для достижений (не сбрасывается после 7)
    // Fallback на dailyRewardStreak для обратной совместимости
    dailyStreak: user?.totalDailyStreak ?? user?.dailyRewardStreak ?? 0,
    maxQuizStreak: maxStreak._max?.maxStreak ?? 0,
    friendsCount,
    chatMessages: chatCount,
    level: levelProgress.level,
    xp: user?.xp ?? 0,
    fastAnswers,
    weeklyTop: Number(weeklyTopCount[0]?.count ?? 0),
    weeklyWins,
    bonusEnergyEarned: user?.bonusEnergyEarned ?? 0,
    bonusEnergyUsed: user?.bonusEnergyUsed ?? 0,
    differentQuizzes: differentQuizzes.length,
    loginDays: Number(loginDays[0]?.count ?? 0),
    accountAgeDays,
    referralsCount,
    userId,
    // Специальные поля
    rareAchievementsCount,
    totalAchievementsCount,
    daysSinceLastQuiz,
    quizzesToday,
    isWeekend,
    // Статистика дуэлей (вычисляется отдельно)
    ...(await getDuelStats(userId)),
  };
}

/**
 * Получить статистику дуэлей для достижений
 */
async function getDuelStats(userId: number): Promise<{
  duelsPlayed: number;
  duelsWon: number;
  duelWinStreak: number;
  duelsPerfect: number;
}> {
  // Всего сыгранных дуэлей
  const duelsPlayed = await prisma.duel.count({
    where: {
      OR: [{ challengerId: userId }, { opponentId: userId }],
      status: "FINISHED",
    },
  });

  // Побед в дуэлях
  const duelsWon = await prisma.duel.count({
    where: {
      winnerId: userId,
      status: "FINISHED",
    },
  });

  // Серия побед (текущая)
  // Получаем последние дуэли в обратном порядке и считаем подряд идущие победы
  const recentDuels = await prisma.duel.findMany({
    where: {
      OR: [{ challengerId: userId }, { opponentId: userId }],
      status: "FINISHED",
    },
    orderBy: { finishedAt: "desc" },
    take: 20, // Достаточно для проверки серии
    select: { winnerId: true },
  });

  let duelWinStreak = 0;
  for (const duel of recentDuels) {
    if (duel.winnerId === userId) {
      duelWinStreak++;
    } else {
      break; // Серия прервалась
    }
  }

  // Идеальные дуэли (100% правильных ответов + победа)
  // Находим дуэли где пользователь победил и все его ответы правильные
  const perfectDuels = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT d.id) as count
    FROM "Duel" d
    WHERE d."winnerId" = ${userId}
      AND d.status = 'FINISHED'
      AND NOT EXISTS (
        SELECT 1 FROM "DuelAnswer" da 
        WHERE da."duelId" = d.id 
          AND da."userId" = ${userId} 
          AND da."isCorrect" = false
      )
      AND EXISTS (
        SELECT 1 FROM "DuelAnswer" da 
        WHERE da."duelId" = d.id 
          AND da."userId" = ${userId}
      )
  `;

  return {
    duelsPlayed,
    duelsWon,
    duelWinStreak,
    duelsPerfect: Number(perfectDuels[0]?.count ?? 0),
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
    case "referrals_count": return stats.referralsCount;
    case "rare_achievements": return stats.rareAchievementsCount;
    case "total_achievements": return stats.totalAchievementsCount;
    case "quizzes_today": return stats.isWeekend ? stats.quizzesToday : 0; // Только в выходные
    case "duels_played": return stats.duelsPlayed;
    case "duels_won": return stats.duelsWon;
    case "duel_win_streak": return stats.duelWinStreak;
    case "duels_perfect": return stats.duelsPerfect;
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
 * 
 * АРХИТЕКТУРА:
 * 1. Параллельное получение stats + unlocked (эффективно)
 * 2. Вычисление достижений для разблокировки (чистые функции)
 * 3. ТРАНЗАКЦИЯ: createMany + XP increment (атомарно)
 * 4. skipDuplicates для защиты от race condition
 * 5. Логирование всех операций
 */
export async function checkAndUnlockAchievements(
  userId: number,
  specialAchievementIds?: string[]
): Promise<AchievementCheckResult> {
  // ═══════════════════════════════════════════════════════════════════════════
  // ЭТАП 1: Параллельное получение данных (минимум запросов)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [stats, unlockedIds] = await Promise.all([
    getUserStats(userId),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    }),
  ]);
  
  const unlockedSet = new Set(unlockedIds.map(u => u.achievementId));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЭТАП 2: Вычисление достижений для разблокировки (без БД)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const toUnlock: Achievement[] = [];
  
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
      toUnlock.push(achievement);
    }
  }
  
  // Достижения-коллекторы теперь проверяются через total_achievements requirement
  // (см. checkAchievementCondition с stats.totalAchievementsCount)
  
  // Если нечего разблокировать — быстрый выход
  if (toUnlock.length === 0) {
    return {
      newlyUnlocked: [],
      totalUnlocked: unlockedSet.size,
      totalAchievements: ACHIEVEMENTS.length,
      xpEarned: 0,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЭТАП 3: АТОМАРНАЯ ТРАНЗАКЦИЯ — создание достижений + начисление XP
  // ═══════════════════════════════════════════════════════════════════════════
  
  const xpToAdd = toUnlock.reduce((sum, a) => sum + a.xpReward, 0);
  const now = new Date();
  
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Batch создание достижений (skipDuplicates для race condition)
      await tx.userAchievement.createMany({
        data: toUnlock.map(achievement => ({
          userId,
          achievementId: achievement.id,
          progress: achievement.requirement.value,
          unlockedAt: now,
        })),
        skipDuplicates: true, // Защита от race condition
      });
      
      // 2. Один запрос на XP (атомарно с достижениями)
      if (xpToAdd > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { xp: { increment: xpToAdd } },
        });
      }
    });
    
    // Успешно — формируем результат
    const newlyUnlocked: UnlockedAchievement[] = toUnlock.map(achievement => ({
      achievement,
      unlockedAt: now,
      isNew: true,
    }));
    
    console.log(
      `[achievements] User ${userId} unlocked ${toUnlock.length} achievements: ` +
      `${toUnlock.map(a => a.id).join(", ")} (+${xpToAdd} XP)`
    );
    
    return {
      newlyUnlocked,
      totalUnlocked: unlockedSet.size + toUnlock.length,
      totalAchievements: ACHIEVEMENTS.length,
      xpEarned: xpToAdd,
    };
    
  } catch (error) {
    // Транзакция откатилась — ничего не сохранено
    console.error(`[achievements] Transaction failed for user ${userId}:`, error);
    
    // Возвращаем пустой результат (достижения не разблокированы)
    return {
      newlyUnlocked: [],
      totalUnlocked: unlockedSet.size,
      totalAchievements: ACHIEVEMENTS.length,
      xpEarned: 0,
    };
  }
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
  
  return achievements;
}

/**
 * Проверить достижение "Comeback" (вернулся после 7+ дней отсутствия)
 */
export function checkComebackAchievement(daysSinceLastQuiz: number): boolean {
  return daysSinceLastQuiz >= 7;
}

/**
 * Проверить все автоматические специальные достижения на основе stats
 */
export function checkAutoSpecialAchievements(stats: UserStats): string[] {
  const achievements: string[] = [];
  
  // Добавляем временные достижения
  achievements.push(...checkTimeBasedAchievements());
  
  // Comeback (7+ дней без игры)
  if (checkComebackAchievement(stats.daysSinceLastQuiz)) {
    achievements.push("comeback");
  }
  
  // Weekend Warrior теперь проверяется через quizzes_today requirement
  // (не нужен здесь)
  
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
