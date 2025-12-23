/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USER ACTIVITY SYSTEM
 * Создание записей активности для ленты друзей
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";
import type { ActivityType } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type ActivityData = {
  quizId?: number;
  quizTitle?: string;
  score?: number;
  rank?: number;
  achievementId?: string;
  achievementTitle?: string;
  level?: number;
  tournamentId?: number;
  tournamentTitle?: string;
  place?: number;
  friendId?: number;
  friendName?: string;
  streakDays?: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// ИКОНКИ ПО ТИПАМ АКТИВНОСТИ
// ═══════════════════════════════════════════════════════════════════════════

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  QUIZ_COMPLETED: "🎯",
  QUIZ_HIGH_SCORE: "🏆",
  ACHIEVEMENT_UNLOCKED: "⭐",
  LEVEL_UP: "🚀",
  TOURNAMENT_JOIN: "⚔️",
  TOURNAMENT_STAGE: "🎮",
  TOURNAMENT_WIN: "🥇",
  FRIEND_ADDED: "🤝",
  STREAK_MILESTONE: "🔥",
};

// ═══════════════════════════════════════════════════════════════════════════
// ГЕНЕРАЦИЯ ЗАГОЛОВКОВ
// ═══════════════════════════════════════════════════════════════════════════

function generateTitle(type: ActivityType, data: ActivityData): string {
  switch (type) {
    case "QUIZ_COMPLETED":
      return `Прошёл квиз «${data.quizTitle || "Квиз"}»`;
    case "QUIZ_HIGH_SCORE":
      return `Новый рекорд: ${data.score} очков!`;
    case "ACHIEVEMENT_UNLOCKED":
      return `Получил достижение «${data.achievementTitle || "Достижение"}»`;
    case "LEVEL_UP":
      return `Достиг ${data.level} уровня!`;
    case "TOURNAMENT_JOIN":
      return `Участвует в турнире «${data.tournamentTitle || "Турнир"}»`;
    case "TOURNAMENT_STAGE":
      return `Прошёл этап турнира: ${data.score} очков`;
    case "TOURNAMENT_WIN":
      return `Занял ${data.place} место в турнире!`;
    case "FRIEND_ADDED":
      return `Теперь друзья с ${data.friendName || "новым другом"}`;
    case "STREAK_MILESTONE":
      return `Серия ${data.streakDays} дней подряд! 🔥`;
    default:
      return "Активность";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ОСНОВНАЯ ФУНКЦИЯ СОЗДАНИЯ АКТИВНОСТИ
// ═══════════════════════════════════════════════════════════════════════════

export async function createActivity(
  userId: number,
  type: ActivityType,
  data: ActivityData
): Promise<void> {
  try {
    await prisma.userActivity.create({
      data: {
        userId,
        type,
        title: generateTitle(type, data),
        icon: ACTIVITY_ICONS[type],
        data: data as object,
      },
    });
  } catch (error) {
    // Не прерываем основной флоу из-за ошибки активности
    console.error("[activity] Failed to create activity:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// УДОБНЫЕ ФУНКЦИИ ДЛЯ ЧАСТЫХ СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════════════════

export async function logQuizCompleted(
  userId: number,
  quizId: number,
  quizTitle: string,
  score: number
): Promise<void> {
  await createActivity(userId, "QUIZ_COMPLETED", { quizId, quizTitle, score });
}

export async function logHighScore(
  userId: number,
  quizId: number,
  quizTitle: string,
  score: number
): Promise<void> {
  await createActivity(userId, "QUIZ_HIGH_SCORE", { quizId, quizTitle, score });
}

export async function logAchievement(
  userId: number,
  achievementId: string,
  achievementTitle: string
): Promise<void> {
  await createActivity(userId, "ACHIEVEMENT_UNLOCKED", { achievementId, achievementTitle });
}

export async function logLevelUp(
  userId: number,
  level: number
): Promise<void> {
  await createActivity(userId, "LEVEL_UP", { level });
}

export async function logTournamentJoin(
  userId: number,
  tournamentId: number,
  tournamentTitle: string
): Promise<void> {
  await createActivity(userId, "TOURNAMENT_JOIN", { tournamentId, tournamentTitle });
}

export async function logTournamentStage(
  userId: number,
  tournamentId: number,
  tournamentTitle: string,
  score: number
): Promise<void> {
  await createActivity(userId, "TOURNAMENT_STAGE", { tournamentId, tournamentTitle, score });
}

export async function logTournamentWin(
  userId: number,
  tournamentId: number,
  tournamentTitle: string,
  place: number
): Promise<void> {
  await createActivity(userId, "TOURNAMENT_WIN", { tournamentId, tournamentTitle, place });
}

export async function logFriendAdded(
  userId: number,
  friendId: number,
  friendName: string
): Promise<void> {
  await createActivity(userId, "FRIEND_ADDED", { friendId, friendName });
}

export async function logStreakMilestone(
  userId: number,
  streakDays: number
): Promise<void> {
  await createActivity(userId, "STREAK_MILESTONE", { streakDays });
}

// ═══════════════════════════════════════════════════════════════════════════
// ОЧИСТКА СТАРЫХ АКТИВНОСТЕЙ (для cron job)
// ═══════════════════════════════════════════════════════════════════════════

export async function cleanupOldActivities(daysToKeep = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await prisma.userActivity.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });
  
  return result.count;
}
