/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DAILY CHALLENGES — Система ежедневных заданий
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Автоматическое отслеживание прогресса по заданиям:
 * - Интеграция с дуэлями и квизами
 * - Генерация заданий на каждый день
 * - Награды за выполнение
 */

import { prisma } from "@/lib/prisma";
import { DailyChallengeType } from "@prisma/client";
import { getLevelProgress, getLevelTitle } from "@/lib/xp";
import { notifyLevelUp } from "@/lib/notifications";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export interface ChallengeProgress {
  id: number;
  slot: number;
  type: DailyChallengeType;
  title: string;
  description: string | null;
  icon: string;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
  xpReward: number;
  energyReward: number;
  difficulty: number;
}

export interface DailyChallengesData {
  date: string; // YYYY-MM-DD
  challenges: ChallengeProgress[];
  allCompleted: boolean;
  allClaimed: boolean;
  bonusClaimed: boolean;
  bonusReward: {
    type: string;
    value: string;
    description: string;
  };
  expiresAt: string; // ISO timestamp
}

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить текущую дату в UTC (без времени)
 */
export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Получить время до полуночи UTC
 */
export function getTimeUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return midnight.getTime() - now.getTime();
}

/**
 * Форматировать время до сброса
 */
export function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ГЕНЕРАЦИЯ ЗАДАНИЙ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить или создать задания на сегодня
 */
export async function getOrCreateTodayChallenges(retryCount = 0): Promise<ReturnType<typeof prisma.dailyChallenge.findMany>> {
  const today = getTodayUTC();
  
  // Проверяем есть ли уже задания на сегодня
  const existingChallenges = await prisma.dailyChallenge.findMany({
    where: { date: today },
    include: { definition: true },
    orderBy: { slot: "asc" },
  });
  
  if (existingChallenges.length >= 3) {
    return existingChallenges;
  }
  
  // Генерируем новые задания
  console.log("[DailyChallenges] Generating challenges for", today.toISOString());
  
  // Получаем все активные определения
  const definitions = await prisma.dailyChallengeDefinition.findMany({
    where: { isActive: true },
    orderBy: [
      { difficulty: "asc" },
      { id: "asc" },
    ],
  });
  
  if (definitions.length < 3) {
    // Защита от бесконечной рекурсии
    if (retryCount >= 1) {
      console.error("[DailyChallenges] Failed to seed definitions after retry!");
      throw new Error("Failed to create daily challenge definitions");
    }
    
    console.log("[DailyChallenges] Not enough definitions, seeding defaults...");
    await seedDefaultDefinitions();
    return getOrCreateTodayChallenges(retryCount + 1);
  }
  
  // Выбираем 3 задания разной сложности
  const easy = definitions.filter(d => d.difficulty === 1);
  const medium = definitions.filter(d => d.difficulty === 2);
  const hard = definitions.filter(d => d.difficulty === 3);
  
  // Случайный выбор с fallback
  const pick = (arr: typeof definitions, fallback: typeof definitions) => {
    const source = arr.length > 0 ? arr : fallback;
    return source[Math.floor(Math.random() * source.length)];
  };
  
  const selected = [
    pick(easy, definitions),
    pick(medium, definitions),
    pick(hard, definitions),
  ];
  
  // Убедимся что все разные
  const usedIds = new Set<number>();
  const finalSelection: typeof definitions = [];
  
  for (const def of selected) {
    if (!usedIds.has(def.id)) {
      usedIds.add(def.id);
      finalSelection.push(def);
    } else {
      // Найти замену
      const replacement = definitions.find(d => !usedIds.has(d.id));
      if (replacement) {
        usedIds.add(replacement.id);
        finalSelection.push(replacement);
      }
    }
  }
  
  // Создаём задания
  const createdChallenges = await Promise.all(
    finalSelection.map((def, index) =>
      prisma.dailyChallenge.upsert({
        where: {
          date_slot: {
            date: today,
            slot: index + 1,
          },
        },
        create: {
          date: today,
          slot: index + 1,
          definitionId: def.id,
        },
        update: {},
        include: { definition: true },
      })
    )
  );
  
  console.log("[DailyChallenges] Created", createdChallenges.length, "challenges");
  return createdChallenges;
}

/**
 * Создать дефолтные определения заданий
 */
async function seedDefaultDefinitions() {
  const defaults = [
    // Лёгкие (difficulty: 1)
    {
      type: DailyChallengeType.DUEL_WIN,
      targetValue: 1,
      title: "Выиграй 1 дуэль",
      description: "Победи в любой дуэли",
      icon: "⚔️",
      xpReward: 50,
      energyReward: 0,
      difficulty: 1,
    },
    {
      type: DailyChallengeType.DUEL_PLAY,
      targetValue: 2,
      title: "Сыграй 2 дуэли",
      description: "Заверши 2 дуэли (победа или поражение)",
      icon: "🎮",
      xpReward: 30,
      energyReward: 0,
      difficulty: 1,
    },
    {
      type: DailyChallengeType.QUIZ_COMPLETE,
      targetValue: 1,
      title: "Пройди квиз",
      description: "Заверши любой квиз",
      icon: "📝",
      xpReward: 30,
      energyReward: 0,
      difficulty: 1,
    },
    
    // Средние (difficulty: 2)
    {
      type: DailyChallengeType.CORRECT_ANSWERS,
      targetValue: 10,
      title: "10 правильных ответов",
      description: "Ответь правильно 10 раз в любом режиме",
      icon: "✅",
      xpReward: 50,
      energyReward: 1,
      difficulty: 2,
    },
    {
      type: DailyChallengeType.DUEL_WIN,
      targetValue: 3,
      title: "Выиграй 3 дуэли",
      description: "Победи в 3 дуэлях",
      icon: "🏆",
      xpReward: 80,
      energyReward: 1,
      difficulty: 2,
    },
    
    // Сложные (difficulty: 3)
    {
      type: DailyChallengeType.PERFECT_DUEL,
      targetValue: 1,
      title: "Идеальная победа",
      description: "Победи в дуэли с 0 ошибками",
      icon: "💎",
      xpReward: 100,
      energyReward: 2,
      difficulty: 3,
    },
    {
      type: DailyChallengeType.ANSWER_STREAK,
      targetValue: 5,
      title: "Серия 5 ответов",
      description: "Ответь правильно 5 раз подряд",
      icon: "🔥",
      xpReward: 100,
      energyReward: 1,
      difficulty: 3,
    },
  ];
  
  console.log("[DailyChallenges] Seeding default definitions...");
  
  // Проверяем существующие определения
  const existing = await prisma.dailyChallengeDefinition.findMany({
    select: { type: true, targetValue: true },
  });
  const existingKeys = new Set(existing.map(e => `${e.type}_${e.targetValue}`));
  
  // Создаём только отсутствующие
  for (const def of defaults) {
    const key = `${def.type}_${def.targetValue}`;
    if (!existingKeys.has(key)) {
      await prisma.dailyChallengeDefinition.create({ data: def });
    }
  }
  
  console.log("[DailyChallenges] Seeded definitions");
}

// ═══════════════════════════════════════════════════════════════════════════
// ПРОГРЕСС ПОЛЬЗОВАТЕЛЯ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить прогресс пользователя по заданиям на сегодня
 */
export async function getUserDailyChallenges(userId: number): Promise<DailyChallengesData> {
  const today = getTodayUTC();
  const challenges = await getOrCreateTodayChallenges();
  
  // Получаем или создаём прогресс пользователя
  const progressRecords = await Promise.all(
    challenges.map(async (challenge) => {
      const progress = await prisma.userDailyChallenge.upsert({
        where: {
          userId_challengeId: {
            userId,
            challengeId: challenge.id,
          },
        },
        create: {
          userId,
          challengeId: challenge.id,
          currentValue: 0,
        },
        update: {},
        include: {
          challenge: {
            include: { definition: true },
          },
        },
      });
      return progress;
    })
  );
  
  // Проверяем бонус за все задания
  const bonusClaim = await prisma.dailyBonusClaim.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });
  
  // Формируем ответ
  const challengeProgress: ChallengeProgress[] = progressRecords.map((p) => ({
    id: p.id,
    slot: p.challenge.slot,
    type: p.challenge.definition.type,
    title: p.challenge.definition.title,
    description: p.challenge.definition.description,
    icon: p.challenge.definition.icon,
    targetValue: p.challenge.definition.targetValue,
    currentValue: p.currentValue,
    isCompleted: p.isCompleted,
    isClaimed: p.isClaimed,
    xpReward: p.challenge.definition.xpReward,
    energyReward: p.challenge.definition.energyReward,
    difficulty: p.challenge.definition.difficulty,
  }));
  
  // Сортируем по слоту
  challengeProgress.sort((a, b) => a.slot - b.slot);
  
  const allCompleted = challengeProgress.every((c) => c.isCompleted);
  const allClaimed = challengeProgress.every((c) => c.isClaimed);
  
  // Время до сброса
  const midnight = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  
  return {
    date: today.toISOString().split("T")[0],
    challenges: challengeProgress,
    allCompleted,
    allClaimed,
    bonusClaimed: !!bonusClaim,
    bonusReward: {
      type: "xp",
      value: "200",
      description: "200 XP + Кейс с рамкой",
    },
    expiresAt: midnight.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ОБНОВЛЕНИЕ ПРОГРЕССА
// ═══════════════════════════════════════════════════════════════════════════

interface UpdateProgressParams {
  userId: number;
  type: DailyChallengeType;
  increment?: number;      // Увеличить на N (по умолчанию 1)
  setValue?: number;       // Установить конкретное значение
  checkPerfect?: boolean;  // Для PERFECT_DUEL — проверить условие
  checkStreak?: number;    // Для ANSWER_STREAK — текущая серия
}

/**
 * Обновить прогресс по заданию
 * ВАЖНО: Обёрнуто в try-catch чтобы ошибки не влияли на основную логику
 */
export async function updateChallengeProgress(params: UpdateProgressParams): Promise<void> {
  try {
    const { userId, type, increment = 1, setValue, checkPerfect, checkStreak } = params;
    
    // Проверяем что это не бот (боты не участвуют в Daily Challenges)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBot: true },
    });
    
    if (user?.isBot) {
      return; // Боты не получают прогресс по заданиям
    }
    
    const today = getTodayUTC();
    
    // Находим задание этого типа на сегодня
    const challenge = await prisma.dailyChallenge.findFirst({
      where: {
        date: today,
        definition: { type },
      },
      include: { definition: true },
    });
    
    if (!challenge) {
      // Нет задания этого типа сегодня — это нормально
      return;
    }
    
    // Получаем или создаём прогресс пользователя (FIX: race condition)
    const userProgress = await prisma.userDailyChallenge.upsert({
      where: {
        userId_challengeId: {
          userId,
          challengeId: challenge.id,
        },
      },
      create: {
        userId,
        challengeId: challenge.id,
        currentValue: 0,
      },
      update: {},
    });
    
    if (userProgress.isCompleted) {
      // Уже выполнено
      return;
    }
    
    // Вычисляем новое значение
    let newValue: number;
    
    if (setValue !== undefined) {
      newValue = setValue;
    } else if (type === DailyChallengeType.PERFECT_DUEL && checkPerfect) {
      // Для идеальной победы: если checkPerfect=true, засчитываем
      newValue = userProgress.currentValue + 1;
    } else if (type === DailyChallengeType.ANSWER_STREAK && checkStreak !== undefined) {
      // Для серии: сохраняем лучший результат
      newValue = Math.max(userProgress.currentValue, checkStreak);
    } else {
      newValue = userProgress.currentValue + increment;
    }
    
    // Проверяем выполнение
    const isCompleted = newValue >= challenge.definition.targetValue;
    
    // Обновляем
    await prisma.userDailyChallenge.update({
      where: { id: userProgress.id },
      data: {
        currentValue: newValue,
        isCompleted,
        completedAt: isCompleted && !userProgress.isCompleted ? new Date() : undefined,
      },
    });
    
    console.log(
      `[DailyChallenges] Updated progress for user ${userId}: ${type} ${newValue}/${challenge.definition.targetValue} (completed: ${isCompleted})`
    );
  } catch (error) {
    // Логируем ошибку, но не бросаем — не влияем на основную логику дуэли/квиза
    console.error(`[DailyChallenges] Error updating progress:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// КЛЕЙМ НАГРАД
// ═══════════════════════════════════════════════════════════════════════════

interface ClaimResult {
  ok: boolean;
  error?: string;
  xpEarned?: number;
  energyEarned?: number;
  bonusEarned?: boolean;
}

/**
 * Получить награду за выполненное задание
 * ВАЖНО: Используем атомарное обновление для защиты от double-claim
 */
export async function claimChallengeReward(
  userId: number,
  challengeProgressId: number
): Promise<ClaimResult> {
  try {
    // Атомарная транзакция с блокировкой записи
    const result = await prisma.$transaction(async (tx) => {
      // Получаем прогресс с блокировкой FOR UPDATE (через findFirst + select)
      const progress = await tx.userDailyChallenge.findUnique({
        where: { id: challengeProgressId },
        include: {
          challenge: {
            include: { definition: true },
          },
        },
      });
      
      if (!progress) {
        return { ok: false as const, error: "CHALLENGE_NOT_FOUND" };
      }
      
      if (progress.userId !== userId) {
        return { ok: false as const, error: "NOT_AUTHORIZED" };
      }
      
      if (!progress.isCompleted) {
        return { ok: false as const, error: "NOT_COMPLETED" };
      }
      
      if (progress.isClaimed) {
        return { ok: false as const, error: "ALREADY_CLAIMED" };
      }
      
      const def = progress.challenge.definition;
      
      // Получаем текущий XP пользователя
      const userBefore = await tx.user.findUnique({
        where: { id: userId },
        select: { xp: true },
      });
      
      const oldLevel = userBefore ? getLevelProgress(userBefore.xp).level : 1;
      
      // Атомарно обновляем прогресс (с проверкой что ещё не claimed)
      const updated = await tx.userDailyChallenge.updateMany({
        where: { 
          id: progress.id,
          isClaimed: false, // Дополнительная защита на уровне БД
        },
        data: {
          isClaimed: true,
          claimedAt: new Date(),
        },
      });
      
      // Если не обновилось — значит уже claimed другим запросом
      if (updated.count === 0) {
        return { ok: false as const, error: "ALREADY_CLAIMED" };
      }
      
      // Выдаём XP и энергию
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: def.xpReward },
          bonusEnergy: { increment: def.energyReward },
          bonusEnergyEarned: { increment: def.energyReward },
        },
      });
      
      return {
        ok: true as const,
        xpEarned: def.xpReward,
        energyEarned: def.energyReward,
        oldLevel,
        newXp: updatedUser.xp,
      };
    });
    
    if (!result.ok) {
      return result;
    }
    
    // Проверяем level up (вне транзакции)
    const newLevel = getLevelProgress(result.newXp).level;
    if (newLevel > result.oldLevel) {
      const levelInfo = getLevelTitle(newLevel);
      notifyLevelUp(userId, newLevel, levelInfo.title, result.xpEarned)
        .catch(err => console.error("[DailyChallenges] Level up notification error:", err));
    }
    
    return {
      ok: true,
      xpEarned: result.xpEarned,
      energyEarned: result.energyEarned,
    };
  } catch (error) {
    console.error("[DailyChallenges] Claim error:", error);
    return { ok: false, error: "INTERNAL_ERROR" };
  }
}

/**
 * Получить бонус за выполнение всех заданий
 * ВАЖНО: Unique constraint на userId+date защищает от double-claim
 */
export async function claimDailyBonus(userId: number): Promise<ClaimResult> {
  try {
    const today = getTodayUTC();
    const bonusXP = 200;
    
    // Проверяем что все задания выполнены и получены
    const data = await getUserDailyChallenges(userId);
    
    if (!data.allCompleted) {
      return { ok: false, error: "NOT_ALL_COMPLETED" };
    }
    
    if (!data.allClaimed) {
      return { ok: false, error: "NOT_ALL_CLAIMED" };
    }
    
    if (data.bonusClaimed) {
      return { ok: false, error: "BONUS_ALREADY_CLAIMED" };
    }
    
    // Атомарная транзакция
    const result = await prisma.$transaction(async (tx) => {
      // Получаем текущий XP пользователя
      const userBefore = await tx.user.findUnique({
        where: { id: userId },
        select: { xp: true },
      });
      
      const oldLevel = userBefore ? getLevelProgress(userBefore.xp).level : 1;
      
      // Пытаемся создать запись бонуса (unique constraint защитит от дублей)
      await tx.dailyBonusClaim.create({
        data: {
          userId,
          date: today,
          rewardType: "xp",
          rewardValue: String(bonusXP),
        },
      });
      
      // Выдаём XP
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: bonusXP },
        },
      });
      
      return { oldLevel, newXp: updatedUser.xp };
    });
    
    // Проверяем level up (вне транзакции)
    const newLevel = getLevelProgress(result.newXp).level;
    if (newLevel > result.oldLevel) {
      const levelInfo = getLevelTitle(newLevel);
      notifyLevelUp(userId, newLevel, levelInfo.title, bonusXP)
        .catch(err => console.error("[DailyChallenges] Bonus level up notification error:", err));
    }
    
    return {
      ok: true,
      xpEarned: bonusXP,
      bonusEarned: true,
    };
  } catch (error) {
    // Unique constraint violation = уже получен бонус
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { ok: false, error: "BONUS_ALREADY_CLAIMED" };
    }
    console.error("[DailyChallenges] Bonus claim error:", error);
    return { ok: false, error: "INTERNAL_ERROR" };
  }
}

