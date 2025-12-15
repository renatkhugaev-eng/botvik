/**
 * Week utilities for weekly competition system
 */

/**
 * Get the start of the current week (Monday 00:00:00 UTC)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  // If Sunday (0), go back 6 days. Otherwise go back (day - 1) days.
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the current week (Sunday 23:59:59 UTC)
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Get milliseconds until end of week
 */
export function getTimeUntilWeekEnd(date: Date = new Date()): number {
  const end = getWeekEnd(date);
  return Math.max(0, end.getTime() - date.getTime());
}

/**
 * Format time remaining as "Xд Yч Zм"
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Завершено";
  
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}д ${hours}ч`;
  } else if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  } else {
    return `${minutes}м`;
  }
}

/**
 * Check if we're in the final hours of the week (for urgency)
 */
export function isWeekEnding(hoursThreshold: number = 6): boolean {
  const remaining = getTimeUntilWeekEnd();
  return remaining < hoursThreshold * 60 * 60 * 1000;
}

/**
 * Get week number of the year
 */
export function getWeekNumber(date: Date = new Date()): number {
  const start = getWeekStart(date);
  const startOfYear = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
  const diff = start.getTime() - startOfYear.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Format week label like "Неделя 51 (9-15 дек)"
 */
export function getWeekLabel(date: Date = new Date()): string {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  const weekNum = getWeekNumber(date);
  
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = months[start.getUTCMonth()];
  const endMonth = months[end.getUTCMonth()];
  
  if (startMonth === endMonth) {
    return `Неделя ${weekNum} (${startDay}-${endDay} ${startMonth})`;
  } else {
    return `Неделя ${weekNum} (${startDay} ${startMonth} - ${endDay} ${endMonth})`;
  }
}

