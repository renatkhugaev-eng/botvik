/**
 * Telegram Bot Notification Service
 * 
 * Sends push notifications through Telegram Bot API
 */

import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Rate limiting: minimum 1 hour between notifications per user
const MIN_NOTIFICATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════

export type NotificationType = 
  | "level_up"
  | "energy_full"
  | "daily_reminder"
  | "leaderboard_change"
  | "friend_activity"
  | "weekly_winner"
  | "tournament_winner";

type NotificationConfig = {
  type: NotificationType;
  preferenceField: keyof typeof NOTIFICATION_PREFERENCES;
  template: (data: Record<string, unknown>) => string;
};

const NOTIFICATION_PREFERENCES = {
  level_up: "notifyLevelUp",
  energy_full: "notifyEnergyFull",
  daily_reminder: "notifyDailyReminder",
  leaderboard_change: "notifyLeaderboard",
  friend_activity: "notifyFriends",
  weekly_winner: "notifyLeaderboard", // Winners always get notified via leaderboard preference
  tournament_winner: "notifyLeaderboard", // Tournament winners use leaderboard preference
} as const;

const NOTIFICATION_TEMPLATES: Record<NotificationType, (data: Record<string, unknown>) => string> = {
  level_up: (data) => `
🎉 *Поздравляем!*

Ты достиг *уровня ${data.level}*! ${data.title ? `\n🏅 Новый титул: ${data.title}` : ""}

+${data.xpEarned} XP за последний квиз

[▶️ Продолжить играть](https://t.me/truecrimetg_bot/app)
  `.trim(),

  energy_full: (data) => `
⚡ *Энергия восстановлена!*

У тебя снова ${data.energy}/${data.maxEnergy} энергии.
Время играть! 🎮

[▶️ Начать игру](https://t.me/truecrimetg_bot/app)
  `.trim(),

  daily_reminder: (data) => `
👋 *Привет, детектив!*

Ты ещё не играл сегодня. Не упусти ежедневный бонус *+30 XP*!

🔥 Твой уровень: ${data.level}
📊 Очков: ${data.score}

[▶️ Играть](https://t.me/truecrimetg_bot/app)
  `.trim(),

  leaderboard_change: (data) => `
🏆 *Изменение в рейтинге!*

${data.direction === "up" 
  ? `Ты поднялся на *#${data.newPosition}* место! 📈` 
  : `Тебя обогнали! Теперь ты на *#${data.newPosition}* месте 📉`}

${data.competitorName ? `Игрок ${data.competitorName} набрал ${data.competitorScore} очков.` : ""}

[▶️ Вернуть позицию](https://t.me/truecrimetg_bot/app)
  `.trim(),

  friend_activity: (data) => `
👥 *Активность друга*

${data.friendName} ${data.action === "beat_score" 
  ? `побил твой рекорд в "${data.quizTitle}"! (${data.friendScore} очков)` 
  : `присоединился к игре!`}

[▶️ Посмотреть](https://t.me/truecrimetg_bot/app)
  `.trim(),

  weekly_winner: (data) => `
🏆 *Поздравляем!*

Ты занял *${data.place === 1 ? "🥇 1-е" : data.place === 2 ? "🥈 2-е" : "🥉 3-е"} место* в еженедельном соревновании!

📊 Твой результат: *${data.score}* очков
🎮 Сыграно игр: ${data.quizzes}
⭐ Лучший результат: ${data.bestScore}

${data.prize ? `\n🎁 ${data.prize}` : ""}

Новая неделя — новые возможности! 🚀

[▶️ Играть](https://t.me/truecrimetg_bot/app)
  `.trim(),

  tournament_winner: (data) => `
🏆 *Турнир завершён!*

Поздравляем! Ты занял *${data.place === 1 ? "🥇 1-е" : data.place === 2 ? "🥈 2-е" : data.place === 3 ? "🥉 3-е" : `${data.place}-е`} место* в турнире *"${data.tournamentTitle}"*!

📊 Твой результат: *${data.score}* очков
${data.xpAwarded ? `\n🎁 Получено: *+${data.xpAwarded} XP*` : ""}

${data.prizeTitle ? `🏅 Приз: ${data.prizeTitle}` : ""}

Следующий турнир уже скоро! 🚀

[▶️ Смотреть результаты](https://t.me/truecrimetg_bot/app)
  `.trim(),
};

// ═══════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Send a Telegram message to a user
 */
async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error("Telegram API error:", result);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

/**
 * Check if user has enabled notifications for this type
 */
async function canSendNotification(
  userId: number, 
  type: NotificationType
): Promise<{ allowed: boolean; telegramId?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramId: true,
      lastNotifiedAt: true,
      notifyLevelUp: true,
      notifyEnergyFull: true,
      notifyDailyReminder: true,
      notifyLeaderboard: true,
      notifyFriends: true,
    },
  });

  if (!user) {
    return { allowed: false };
  }

  // Check if notification type is enabled
  const preferenceMap: Record<NotificationType, boolean> = {
    level_up: user.notifyLevelUp,
    energy_full: user.notifyEnergyFull,
    daily_reminder: user.notifyDailyReminder,
    leaderboard_change: user.notifyLeaderboard,
    friend_activity: user.notifyFriends,
    weekly_winner: user.notifyLeaderboard, // Winners use leaderboard preference
    tournament_winner: user.notifyLeaderboard, // Tournament winners use leaderboard preference
  };

  if (!preferenceMap[type]) {
    return { allowed: false };
  }

  // Rate limiting (except for level_up which is important)
  if (type !== "level_up" && user.lastNotifiedAt) {
    const lastNotifiedTime = new Date(user.lastNotifiedAt).getTime();
    const timeSinceLastNotification = Date.now() - lastNotifiedTime;
    if (timeSinceLastNotification < MIN_NOTIFICATION_INTERVAL_MS) {
      return { allowed: false };
    }
  }

  return { allowed: true, telegramId: user.telegramId };
}

/**
 * Send a notification to a user
 */
export async function sendNotification(
  userId: number,
  type: NotificationType,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  const { allowed, telegramId } = await canSendNotification(userId, type);
  
  if (!allowed || !telegramId) {
    return false;
  }

  const template = NOTIFICATION_TEMPLATES[type];
  const message = template(data);

  const success = await sendTelegramMessage(telegramId, message);

  if (success) {
    // Update last notification time
    await prisma.user.update({
      where: { id: userId },
      data: { lastNotifiedAt: new Date() },
    });
  }

  return success;
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Notify user about level up
 */
export async function notifyLevelUp(
  userId: number,
  level: number,
  title: string,
  xpEarned: number
): Promise<boolean> {
  return sendNotification(userId, "level_up", { level, title, xpEarned });
}

/**
 * Notify user about full energy
 */
export async function notifyEnergyFull(
  userId: number,
  energy: number,
  maxEnergy: number
): Promise<boolean> {
  return sendNotification(userId, "energy_full", { energy, maxEnergy });
}

/**
 * Notify user with daily reminder
 */
export async function notifyDailyReminder(
  userId: number,
  level: number,
  score: number
): Promise<boolean> {
  return sendNotification(userId, "daily_reminder", { level, score });
}

/**
 * Notify user about leaderboard change
 */
export async function notifyLeaderboardChange(
  userId: number,
  direction: "up" | "down",
  newPosition: number,
  competitorName?: string,
  competitorScore?: number
): Promise<boolean> {
  return sendNotification(userId, "leaderboard_change", { 
    direction, 
    newPosition, 
    competitorName, 
    competitorScore 
  });
}

/**
 * Notify user about friend activity
 */
export async function notifyFriendActivity(
  userId: number,
  friendName: string,
  action: "beat_score" | "joined",
  quizTitle?: string,
  friendScore?: number
): Promise<boolean> {
  return sendNotification(userId, "friend_activity", { 
    friendName, 
    action, 
    quizTitle, 
    friendScore 
  });
}

/**
 * Notify user about weekly competition win
 */
export async function notifyWeeklyWinner(
  userId: number,
  place: 1 | 2 | 3,
  score: number,
  bestScore: number,
  quizzes: number,
  prize?: string
): Promise<boolean> {
  return sendNotification(userId, "weekly_winner", { 
    place, 
    score, 
    bestScore, 
    quizzes, 
    prize 
  });
}

/**
 * Notify user about tournament prize win
 */
export async function notifyTournamentWinner(
  userId: number,
  place: number,
  tournamentTitle: string,
  score: number,
  xpAwarded: number,
  prizeTitle?: string
): Promise<boolean> {
  return sendNotification(userId, "tournament_winner", { 
    place, 
    tournamentTitle,
    score,
    xpAwarded,
    prizeTitle,
  });
}

// ═══════════════════════════════════════════════════════════════════
// BATCH NOTIFICATIONS (for cron jobs)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send daily reminders to users who haven't played today
 * Should be called by a cron job (e.g., at 18:00)
 */
export async function sendDailyReminders(): Promise<{ sent: number; failed: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find users who haven't played today and have reminders enabled
  const users = await prisma.user.findMany({
    where: {
      notifyDailyReminder: true,
      OR: [
        { lastQuizAt: null },
        { lastQuizAt: { lt: today } },
      ],
    },
    select: {
      id: true,
      xp: true,
      leaderboardEntries: {
        select: { bestScore: true, attempts: true },
      },
    },
    take: 100, // Batch limit
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    // Рассчитываем total score по формуле Best + Activity
    const totalBestScore = user.leaderboardEntries.reduce((sum, e) => sum + e.bestScore, 0);
    const totalAttempts = user.leaderboardEntries.reduce((sum, e) => sum + e.attempts, 0);
    const totalScore = totalBestScore + Math.min(totalAttempts * 50, 500);
    const level = Math.max(1, Math.floor((-1 + Math.sqrt(1 + (4 * user.xp) / 50)) / 2));
    
    const success = await notifyDailyReminder(user.id, level, totalScore);
    if (success) sent++;
    else failed++;

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { sent, failed };
}

