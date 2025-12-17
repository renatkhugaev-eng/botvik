/**
 * Daily Rewards System
 * 
 * Система ежедневных наград для повышения retention
 * - 7-дневный цикл с возрастающими наградами
 * - Бонусная энергия на день 3 и 7
 * - Сброс серии при пропуске дня
 */

// ═══════════════════════════════════════════════════════════════════
// REWARD CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export type DailyReward = {
  day: number;
  xp: number;
  bonusEnergy: number;
  icon: string;
  title: string;
  description: string;
  isSpecial: boolean;
};

/**
 * 7-дневный цикл наград
 * После дня 7 цикл начинается заново с дня 1
 */
export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, xp: 10,  bonusEnergy: 0, icon: "🎁", title: "День 1",  description: "+10 XP", isSpecial: false },
  { day: 2, xp: 20,  bonusEnergy: 0, icon: "🎁", title: "День 2",  description: "+20 XP", isSpecial: false },
  { day: 3, xp: 30,  bonusEnergy: 1, icon: "⚡", title: "День 3",  description: "+30 XP + Энергия", isSpecial: true },
  { day: 4, xp: 40,  bonusEnergy: 0, icon: "🎁", title: "День 4",  description: "+40 XP", isSpecial: false },
  { day: 5, xp: 50,  bonusEnergy: 0, icon: "🎁", title: "День 5",  description: "+50 XP", isSpecial: false },
  { day: 6, xp: 75,  bonusEnergy: 0, icon: "🎁", title: "День 6",  description: "+75 XP", isSpecial: false },
  { day: 7, xp: 100, bonusEnergy: 2, icon: "👑", title: "День 7!", description: "+100 XP + 2 Энергии", isSpecial: true },
];

/**
 * Получить награду для конкретного дня серии
 */
export function getRewardForDay(day: number): DailyReward {
  // Нормализуем день к диапазону 1-7
  const normalizedDay = ((day - 1) % 7) + 1;
  return DAILY_REWARDS[normalizedDay - 1];
}

/**
 * Получить награду для следующего дня (который игрок получит)
 */
export function getNextReward(currentStreak: number): DailyReward {
  const nextDay = (currentStreak % 7) + 1;
  return getRewardForDay(nextDay);
}

// ═══════════════════════════════════════════════════════════════════
// TIME UTILITIES
// ═══════════════════════════════════════════════════════════════════

const MSK_OFFSET_HOURS = 3; // UTC+3

/**
 * Получить начало дня (полночь) по Московскому времени
 * 
 * MSK = UTC+3, поэтому:
 * - 00:00 MSK = 21:00 UTC (предыдущего дня)
 * - Если сейчас 02:00 MSK (23:00 UTC), то начало дня = 21:00 UTC
 * - Если сейчас 22:00 MSK (19:00 UTC), то начало дня = 21:00 UTC (того же дня UTC)
 */
export function getMoscowDayStart(date: Date = new Date()): Date {
  // Получаем текущее время в MSK
  const mskTime = new Date(date.getTime() + MSK_OFFSET_HOURS * 60 * 60 * 1000);
  
  // Получаем дату в MSK (год, месяц, день)
  const mskYear = mskTime.getUTCFullYear();
  const mskMonth = mskTime.getUTCMonth();
  const mskDay = mskTime.getUTCDate();
  
  // Создаём полночь MSK как UTC timestamp
  // 00:00 MSK = 21:00 UTC предыдущего дня
  const midnightMskAsUtc = Date.UTC(mskYear, mskMonth, mskDay, 0, 0, 0, 0) - MSK_OFFSET_HOURS * 60 * 60 * 1000;
  
  return new Date(midnightMskAsUtc);
}

/**
 * Получить начало текущего дня MSK
 */
export function getTodayStart(): Date {
  return getMoscowDayStart(new Date());
}

/**
 * Получить начало вчерашнего дня MSK
 */
export function getYesterdayStart(): Date {
  const today = getTodayStart();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Проверить, был ли timestamp сегодня (MSK)
 */
export function isToday(timestamp: Date): boolean {
  const todayStart = getTodayStart();
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return timestamp >= todayStart && timestamp < tomorrowStart;
}

/**
 * Проверить, был ли timestamp вчера (MSK)
 */
export function isYesterday(timestamp: Date): boolean {
  const yesterdayStart = getYesterdayStart();
  const todayStart = getTodayStart();
  return timestamp >= yesterdayStart && timestamp < todayStart;
}

/**
 * Время до следующей полночи MSK в миллисекундах
 */
export function msUntilNextDay(): number {
  const now = new Date();
  const todayStart = getTodayStart();
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return Math.max(0, tomorrowStart.getTime() - now.getTime());
}

// ═══════════════════════════════════════════════════════════════════
// REWARD STATUS LOGIC
// ═══════════════════════════════════════════════════════════════════

export type DailyRewardStatus = {
  canClaim: boolean;              // Можно ли забрать награду сейчас
  currentStreak: number;          // Текущая серия (0-7)
  nextReward: DailyReward;        // Следующая награда
  allRewards: DailyReward[];      // Все награды для отображения
  claimedToday: boolean;          // Уже забрал сегодня
  streakBroken: boolean;          // Серия прервалась (пропустил день)
  msUntilNext: number;            // Миллисекунды до следующего дня
  lastClaimAt: Date | null;       // Когда последний раз забрал
};

/**
 * Вычислить статус ежедневной награды для пользователя
 */
export function getDailyRewardStatus(
  dailyRewardStreak: number,
  lastDailyRewardAt: Date | null
): DailyRewardStatus {
  const now = new Date();
  
  // Проверяем, забрал ли награду сегодня
  const claimedToday = lastDailyRewardAt ? isToday(lastDailyRewardAt) : false;
  
  // Проверяем, не прервалась ли серия (пропустил день)
  let streakBroken = false;
  let effectiveStreak = dailyRewardStreak;
  
  if (lastDailyRewardAt && !claimedToday && !isYesterday(lastDailyRewardAt)) {
    // Последний раз забирал награду не сегодня и не вчера - серия прервалась
    streakBroken = true;
    effectiveStreak = 0;
  }
  
  // Можно забрать если ещё не забирал сегодня
  const canClaim = !claimedToday;
  
  // Следующая награда
  const nextReward = getNextReward(effectiveStreak);
  
  return {
    canClaim,
    currentStreak: effectiveStreak,
    nextReward,
    allRewards: DAILY_REWARDS,
    claimedToday,
    streakBroken,
    msUntilNext: msUntilNextDay(),
    lastClaimAt: lastDailyRewardAt,
  };
}

/**
 * Рассчитать новую серию после получения награды
 */
export function calculateNewStreak(
  currentStreak: number,
  lastDailyRewardAt: Date | null
): number {
  // Если серия прервалась (не забирал вчера) - начинаем с 1
  if (lastDailyRewardAt && !isToday(lastDailyRewardAt) && !isYesterday(lastDailyRewardAt)) {
    return 1;
  }
  
  // Увеличиваем серию (цикл 1-7)
  return (currentStreak % 7) + 1;
}
