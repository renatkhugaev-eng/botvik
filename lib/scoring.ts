/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNIFIED SCORING SYSTEM
 * 
 * Профессиональная соревновательная система "Best + Activity"
 * 
 * Формула: TotalScore = BestScore + ActivityBonus
 * 
 * Где:
 * - BestScore = лучший результат за одну игру (макс ~2000+ очков)
 * - ActivityBonus = min(GamesPlayed × BONUS_PER_GAME, MAX_BONUS)
 * 
 * Преимущества:
 * - Качество важнее количества (70-80% = лучший результат)
 * - Активность поощряется (бонус за регулярную игру)
 * - Анти-абуз (нет смысла играть 100 раз — бонус ограничен)
 * - Понятность ("Играй хорошо + играй регулярно")
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══ CONSTANTS ═══

/** Бонус за каждую сыгранную игру */
export const ACTIVITY_BONUS_PER_GAME = 50;

/** Максимальный бонус за активность (10 игр) */
export const MAX_ACTIVITY_BONUS = 500;

/** Максимальное количество игр, влияющих на бонус */
export const MAX_GAMES_FOR_BONUS = MAX_ACTIVITY_BONUS / ACTIVITY_BONUS_PER_GAME; // 10

// ═══ SCORING FUNCTIONS ═══

/**
 * Рассчитывает итоговый счёт по единой формуле
 * 
 * @param bestScore - Лучший результат за одну игру
 * @param gamesPlayed - Количество сыгранных игр
 * @returns Итоговый счёт
 * 
 * @example
 * calculateTotalScore(1500, 5)  // 1500 + 250 = 1750
 * calculateTotalScore(1500, 15) // 1500 + 500 = 2000 (capped)
 */
export function calculateTotalScore(bestScore: number, gamesPlayed: number): number {
  const activityBonus = calculateActivityBonus(gamesPlayed);
  return bestScore + activityBonus;
}

/**
 * Рассчитывает бонус за активность
 * 
 * @param gamesPlayed - Количество сыгранных игр
 * @returns Бонус (0-500)
 */
export function calculateActivityBonus(gamesPlayed: number): number {
  return Math.min(gamesPlayed * ACTIVITY_BONUS_PER_GAME, MAX_ACTIVITY_BONUS);
}

/**
 * Проверяет, нужно ли обновить лучший результат
 * 
 * @param currentBestScore - Текущий лучший результат
 * @param newScore - Новый результат
 * @returns true если новый результат лучше
 */
export function shouldUpdateBestScore(currentBestScore: number, newScore: number): boolean {
  return newScore > currentBestScore;
}

/**
 * Рассчитывает прогресс до следующего бонуса активности
 * 
 * @param gamesPlayed - Количество сыгранных игр
 * @returns Объект с информацией о прогрессе
 */
export function getActivityProgress(gamesPlayed: number): {
  currentBonus: number;
  maxBonus: number;
  gamesUntilMax: number;
  progressPercent: number;
  isMaxed: boolean;
} {
  const currentBonus = calculateActivityBonus(gamesPlayed);
  const gamesUntilMax = Math.max(0, MAX_GAMES_FOR_BONUS - gamesPlayed);
  const progressPercent = Math.min(100, (gamesPlayed / MAX_GAMES_FOR_BONUS) * 100);
  
  return {
    currentBonus,
    maxBonus: MAX_ACTIVITY_BONUS,
    gamesUntilMax,
    progressPercent,
    isMaxed: gamesPlayed >= MAX_GAMES_FOR_BONUS,
  };
}

// ═══ SCORE BREAKDOWN ═══

export type ScoreBreakdown = {
  bestScore: number;
  activityBonus: number;
  totalScore: number;
  gamesPlayed: number;
  gamesUntilMaxBonus: number;
};

/**
 * Возвращает детальную разбивку счёта
 */
export function getScoreBreakdown(bestScore: number, gamesPlayed: number): ScoreBreakdown {
  const activityBonus = calculateActivityBonus(gamesPlayed);
  const totalScore = bestScore + activityBonus;
  const gamesUntilMaxBonus = Math.max(0, MAX_GAMES_FOR_BONUS - gamesPlayed);
  
  return {
    bestScore,
    activityBonus,
    totalScore,
    gamesPlayed,
    gamesUntilMaxBonus,
  };
}

// ═══ LEADERBOARD HELPERS ═══

/**
 * Сортирует записи лидерборда по итоговому счёту
 */
export function sortLeaderboardEntries<T extends { bestScore: number; attempts?: number; quizzes?: number }>(
  entries: T[]
): (T & { totalScore: number })[] {
  return entries
    .map(entry => ({
      ...entry,
      totalScore: calculateTotalScore(entry.bestScore, entry.attempts ?? entry.quizzes ?? 0),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Форматирует счёт для отображения
 */
export function formatScore(score: number): string {
  return score.toLocaleString('ru-RU');
}

/**
 * Форматирует разбивку счёта для отображения
 */
export function formatScoreBreakdown(breakdown: ScoreBreakdown): string {
  if (breakdown.activityBonus > 0) {
    return `${formatScore(breakdown.bestScore)} + ${formatScore(breakdown.activityBonus)} бонус`;
  }
  return formatScore(breakdown.bestScore);
}

