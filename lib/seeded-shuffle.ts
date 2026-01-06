/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SEEDED SHUFFLE — Детерминированная рандомизация
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Используется для рандомизации вопросов в дуэлях.
 * Seed гарантирует что оба игрока получат одинаковый порядок.
 *
 * Anti-cheat: предотвращает запоминание ответов при реванше
 */

/**
 * Простой seeded random на основе строкового seed
 * Возвращает число от 0 до 1
 */
export function seededRandom(seed: string, index: number): number {
  const str = seed + index.toString();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

/**
 * Детерминированный shuffle массива (Fisher-Yates с seeded random)
 * Один и тот же seed всегда даёт одинаковый результат
 */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed, i) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

