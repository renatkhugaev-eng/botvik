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

// Timeout for Telegram API calls (10 seconds)
const TELEGRAM_API_TIMEOUT_MS = 10_000;

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
  | "tournament_winner"
  | "tournament_finished"
  | "tournament_starting"
  | "duel_challenge"
  | "duel_accepted"
  | "duel_declined"
  | "duel_cancelled"
  | "duel_result"
  | "duel_expired";

/**
 * Важные уведомления, которые обходят rate limit:
 * - level_up: редкое и важное событие
 * - energy_full: пользователь ждёт чтобы играть
 * - tournament_winner: одноразовое уведомление о победе
 * - tournament_finished: одноразовое уведомление о завершении
 * - tournament_starting: важно не пропустить старт
 * - weekly_winner: еженедельное уведомление о победе
 * - duel_*: дуэли требуют быстрой реакции
 */
const RATE_LIMIT_BYPASS_TYPES: NotificationType[] = [
  "level_up",
  "energy_full",        // ← Добавлено! Пользователь ждёт восстановления
  "tournament_winner",
  "tournament_finished",
  "tournament_starting", // ← Добавлено! Важно не пропустить
  "weekly_winner",
  "duel_challenge",
  "duel_accepted",
  "duel_declined",
  "duel_cancelled",
  "duel_result",
  "duel_expired",
];

const NOTIFICATION_PREFERENCES = {
  level_up: "notifyLevelUp",
  energy_full: "notifyEnergyFull",
  daily_reminder: "notifyDailyReminder",
  leaderboard_change: "notifyLeaderboard",
  friend_activity: "notifyFriends",
  weekly_winner: "notifyLeaderboard", // Winners always get notified via leaderboard preference
  tournament_winner: "notifyLeaderboard", // Tournament winners use leaderboard preference
  tournament_finished: "notifyLeaderboard", // All participants get tournament results
  tournament_starting: "notifyLeaderboard", // Tournament is about to start
  duel_challenge: "notifyFriends", // Duels use friends preference
  duel_accepted: "notifyFriends",
  duel_declined: "notifyFriends",
  duel_cancelled: "notifyFriends",
  duel_result: "notifyFriends",
  duel_expired: "notifyFriends",
} as const;

const NOTIFICATION_TEMPLATES: Record<NotificationType, (data: Record<string, unknown>) => string> = {
  level_up: (data) => `
🎉 *Поздравляем!*

Ты достиг *уровня ${data.level}*! ${data.title ? `\n🏅 Новый титул: ${data.title}` : ""}

+${data.xpEarned} XP за последний квиз

[▶️ Продолжить играть](https://t.me/truecrimetg_bot/app)
  `.trim(),

  energy_full: (data) => `
⚡ *Энергия полностью восстановлена!*

У тебя ${data.energy}/${data.maxEnergy} энергии — полный заряд! 🔋
Самое время разгадать пару загадок 🕵️

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
🏆 *Поздравляем, чемпион!*

Ты занял *${data.place === 1 ? "🥇 1-е" : data.place === 2 ? "🥈 2-е" : data.place === 3 ? "🥉 3-е" : `${data.place}-е`} место* в турнире *"${data.tournamentTitle}"*!

📊 Твой результат: *${data.score}* очков
${data.xpAwarded ? `🎁 Награда: *+${data.xpAwarded} XP*` : ""}
${data.prizeTitle ? `🏅 Приз: *${data.prizeTitle}*` : ""}

Ты лучший из *${data.totalParticipants || "многих"}* участников! 🔥

[▶️ Смотреть результаты](https://t.me/truecrimetg_bot/app?startapp=tournament_${data.tournamentSlug || ""})
  `.trim(),

  tournament_finished: (data) => `
🏁 *Турнир завершён!*

Турнир *"${data.tournamentTitle}"* подошёл к концу.

📊 Твой результат: *${data.score}* очков
🏆 Твоё место: *#${data.rank}* из ${data.totalParticipants}
${data.stagesCompleted ? `✅ Пройдено этапов: ${data.stagesCompleted}/${data.totalStages}` : ""}

${typeof data.rank === "number" && data.rank <= 3 ? "🎉 Ты в тройке лидеров!" : typeof data.rank === "number" && data.rank <= 10 ? "👏 Отличный результат! Ты в топ-10!" : "Продолжай тренироваться — следующий турнир уже скоро!"}

[▶️ Смотреть результаты](https://t.me/truecrimetg_bot/app?startapp=tournament_${data.tournamentSlug || ""})
  `.trim(),

  tournament_starting: (data) => `
⚔️ *Турнир начинается!*

Турнир *"${data.tournamentTitle}"* стартует ${data.startsIn || "совсем скоро"}!

${data.isRegistered ? "✅ Ты уже зарегистрирован — не пропусти старт!" : "🎮 Успей зарегистрироваться!"}

👥 Участников: ${data.participantsCount || 0}
🏆 Призы: ${data.prizePool || "XP и уникальные награды"}

[▶️ Перейти к турниру](https://t.me/truecrimetg_bot/app?startapp=tournament_${data.tournamentSlug || ""})
  `.trim(),

  // ═══ ДУЭЛИ ═══
  
  duel_challenge: (data) => `
⚔️ *Вызов на дуэль!*

${data.challengerName} вызывает тебя на дуэль!

🎯 Квиз: *${data.quizTitle}*
🏆 Награда: *+${data.xpReward} XP* победителю

⏰ Вызов действует 24 часа

[▶️ Принять вызов](https://t.me/truecrimetg_bot/app?startapp=duel_${data.duelId})
  `.trim(),

  duel_accepted: (data) => `
✅ *Дуэль принята!*

${data.opponentName} принял твой вызов на дуэль!

🎯 Квиз: *${data.quizTitle}*
⚔️ Игра уже ждёт вас!

[▶️ Начать дуэль](https://t.me/truecrimetg_bot/app?startapp=duel_${data.duelId})
  `.trim(),

  duel_declined: (data) => `
❌ *Дуэль отклонена*

${data.opponentName} отклонил твой вызов на дуэль.

Не расстраивайся — вызови кого-нибудь другого! 💪

[▶️ Найти соперника](https://t.me/truecrimetg_bot/app?startapp=duels)
  `.trim(),

  duel_result: (data) => `
${data.isWinner ? "🏆 *Победа в дуэли!*" : data.isDraw ? "🤝 *Ничья в дуэли!*" : "😔 *Поражение в дуэли*"}

${data.isWinner 
  ? `Ты победил ${data.opponentName}!` 
  : data.isDraw 
  ? `Ничья с ${data.opponentName}!`
  : `${data.opponentName} оказался сильнее.`}

📊 Счёт: *${data.myScore}* : *${data.opponentScore}*
${data.xpEarned ? `🎁 Получено: *+${data.xpEarned} XP*` : ""}

[▶️ Играть ещё](https://t.me/truecrimetg_bot/app?startapp=duels)
  `.trim(),

  duel_cancelled: (data) => `
❌ *Дуэль отменена*

${data.challengerName} отменил вызов на дуэль.

[▶️ Найти другого соперника](https://t.me/truecrimetg_bot/app?startapp=duels)
  `.trim(),

  duel_expired: (data) => `
⏰ *Дуэль истекла*

Вызов на дуэль от ${data.challengerName} истёк — никто не ответил вовремя.

[▶️ Вызвать друга](https://t.me/truecrimetg_bot/app?startapp=duels)
  `.trim(),
};

// ═══════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Send a Telegram message to a user
 * Includes timeout protection to prevent hanging requests
 */
async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();
    
    if (!result.ok) {
      // Don't log "bot was blocked by user" as error — it's expected
      if (result.error_code === 403) {
        console.log(`[notifications] User ${chatId} blocked the bot`);
      } else {
        console.error("Telegram API error:", result);
      }
      return false;
    }

    return true;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort (timeout)
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[notifications] Telegram API timeout for user ${chatId}`);
    } else {
      console.error("Failed to send Telegram message:", error);
    }
    return false;
  }
}

type CanSendResult = 
  | { allowed: true; telegramId: string }
  | { allowed: false; reason: "user_not_found" | "preference_disabled" | "rate_limited" };

/**
 * Check if user has enabled notifications for this type
 */
async function canSendNotification(
  userId: number, 
  type: NotificationType
): Promise<CanSendResult> {
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
    return { allowed: false, reason: "user_not_found" };
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
    tournament_finished: user.notifyLeaderboard, // All participants get tournament results
    tournament_starting: user.notifyLeaderboard, // Tournament is about to start
    duel_challenge: user.notifyFriends, // Duels use friends preference
    duel_accepted: user.notifyFriends,
    duel_declined: user.notifyFriends,
    duel_cancelled: user.notifyFriends,
    duel_result: user.notifyFriends,
    duel_expired: user.notifyFriends,
  };

  if (!preferenceMap[type]) {
    return { allowed: false, reason: "preference_disabled" };
  }

  // Rate limiting — bypass for important one-time notifications
  const bypassRateLimit = RATE_LIMIT_BYPASS_TYPES.includes(type);
  
  if (!bypassRateLimit && user.lastNotifiedAt) {
    const lastNotifiedTime = new Date(user.lastNotifiedAt).getTime();
    const timeSinceLastNotification = Date.now() - lastNotifiedTime;
    if (timeSinceLastNotification < MIN_NOTIFICATION_INTERVAL_MS) {
      return { allowed: false, reason: "rate_limited" };
    }
  }

  return { allowed: true, telegramId: user.telegramId };
}

export type SendNotificationResult = 
  | { success: true }
  | { success: false; reason: "user_not_found" | "preference_disabled" | "rate_limited" | "send_failed" };

/**
 * Send a notification to a user
 * Returns detailed result for better tracking
 */
export async function sendNotification(
  userId: number,
  type: NotificationType,
  data: Record<string, unknown> = {}
): Promise<SendNotificationResult> {
  const canSend = await canSendNotification(userId, type);
  
  if (!canSend.allowed) {
    // Логируем причину пропуска для диагностики
    if (process.env.NODE_ENV === "development" || process.env.DEBUG_NOTIFICATIONS === "true") {
      console.log(`[notifications] Skipped ${type} for user ${userId}: ${canSend.reason}`);
    }
    return { success: false, reason: canSend.reason };
  }

  const template = NOTIFICATION_TEMPLATES[type];
  const message = template(data);

  const success = await sendTelegramMessage(canSend.telegramId, message);

  if (success) {
    // Update last notification time
    await prisma.user.update({
      where: { id: userId },
      data: { lastNotifiedAt: new Date() },
    });
    return { success: true };
  }

  return { success: false, reason: "send_failed" };
}

/**
 * Simple wrapper that returns boolean for backward compatibility
 */
async function sendNotificationSimple(
  userId: number,
  type: NotificationType,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  const result = await sendNotification(userId, type, data);
  return result.success;
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
  return sendNotificationSimple(userId, "level_up", { level, title, xpEarned });
}

/**
 * Notify user about full energy
 */
export async function notifyEnergyFull(
  userId: number,
  energy: number,
  maxEnergy: number
): Promise<boolean> {
  return sendNotificationSimple(userId, "energy_full", { energy, maxEnergy });
}

/**
 * Notify user with daily reminder
 */
export async function notifyDailyReminder(
  userId: number,
  level: number,
  score: number
): Promise<boolean> {
  return sendNotificationSimple(userId, "daily_reminder", { level, score });
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
  return sendNotificationSimple(userId, "leaderboard_change", { 
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
  return sendNotificationSimple(userId, "friend_activity", { 
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
  return sendNotificationSimple(userId, "weekly_winner", { 
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
  data: {
    place: number;
    tournamentTitle: string;
    tournamentSlug: string;
    score: number;
    xpAwarded: number;
    prizeTitle?: string;
    totalParticipants: number;
  }
): Promise<SendNotificationResult> {
  return sendNotification(userId, "tournament_winner", data);
}

/**
 * Notify user about tournament completion (non-winners)
 */
export async function notifyTournamentFinished(
  userId: number,
  data: {
    tournamentTitle: string;
    tournamentSlug: string;
    score: number;
    rank: number;
    place?: number; // Место в призовой части (1-3) если применимо
    totalParticipants: number;
    stagesCompleted?: number;
    totalStages?: number;
  }
): Promise<SendNotificationResult> {
  return sendNotification(userId, "tournament_finished", data);
}

/**
 * Notify user about tournament starting soon
 */
export async function notifyTournamentStarting(
  userId: number,
  data: {
    tournamentTitle: string;
    tournamentSlug: string;
    startsIn: string;
    isRegistered: boolean;
    participantsCount: number;
    prizePool?: string;
  }
): Promise<SendNotificationResult> {
  return sendNotification(userId, "tournament_starting", data);
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

// ═══════════════════════════════════════════════════════════════════
// TOURNAMENT NOTIFICATIONS (called from finalizeTournament)
// ═══════════════════════════════════════════════════════════════════

export type TournamentParticipantResult = {
  userId: number;
  rank: number;
  score: number;
  stagesCompleted: number;
  prizePlace?: number;
  prizeTitle?: string;
  xpAwarded?: number;
};

export type TournamentNotificationData = {
  tournamentId: number;
  tournamentTitle: string;
  tournamentSlug: string;
  totalParticipants: number;
  totalStages: number;
  participants: TournamentParticipantResult[];
};

export type TournamentNotificationStats = {
  winners: number;
  participants: number;
  skipped: number;  // Rate limited or disabled preferences
  failed: number;   // Actual send failures
};

/**
 * Send notifications to all tournament participants after finalization
 * 
 * - Winners (places 1-3): Special winner notification with prize info
 * - Other participants: Tournament finished notification with their stats
 * 
 * Uses batched sending with delays to avoid Telegram rate limits
 */
export async function sendTournamentResultNotifications(
  data: TournamentNotificationData
): Promise<TournamentNotificationStats> {
  const BATCH_DELAY_MS = 50; // 50ms between messages (20 msg/sec max)
  const WINNER_PLACES = [1, 2, 3]; // Top 3 get special notification
  
  let winners = 0;
  let participants = 0;
  let skipped = 0;
  let failed = 0;
  
  console.log(
    `[notifications] Sending tournament results for "${data.tournamentTitle}" ` +
    `to ${data.participants.length} participants`
  );
  
  for (const participant of data.participants) {
    try {
      const isWinner = participant.prizePlace && WINNER_PLACES.includes(participant.prizePlace);
      
      if (isWinner && participant.prizePlace) {
        // Winner notification
        const result = await notifyTournamentWinner(participant.userId, {
          place: participant.prizePlace,
          tournamentTitle: data.tournamentTitle,
          tournamentSlug: data.tournamentSlug,
          score: participant.score,
          xpAwarded: participant.xpAwarded || 0,
          prizeTitle: participant.prizeTitle,
          totalParticipants: data.totalParticipants,
        });
        
        if (result.success) {
          winners++;
        } else if (result.reason === "send_failed") {
          failed++;
        } else {
          skipped++; // preference_disabled, rate_limited, user_not_found
        }
      } else {
        // Regular participant notification
        const result = await notifyTournamentFinished(participant.userId, {
          tournamentTitle: data.tournamentTitle,
          tournamentSlug: data.tournamentSlug,
          score: participant.score,
          rank: participant.rank,
          place: participant.prizePlace, // Добавляем place для шаблона
          totalParticipants: data.totalParticipants,
          stagesCompleted: participant.stagesCompleted,
          totalStages: data.totalStages,
        });
        
        if (result.success) {
          participants++;
        } else if (result.reason === "send_failed") {
          failed++;
        } else {
          skipped++;
        }
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      
    } catch (error) {
      console.error(`[notifications] Failed to notify user ${participant.userId}:`, error);
      failed++;
    }
  }
  
  console.log(
    `[notifications] Tournament "${data.tournamentTitle}" notifications complete: ` +
    `${winners} winners, ${participants} participants, ${skipped} skipped, ${failed} failed`
  );
  
  return { winners, participants, skipped, failed };
}

/**
 * Send "tournament starting soon" notifications to registered participants
 * Should be called ~30 minutes before tournament starts (via cron)
 */
export async function sendTournamentStartingNotifications(
  tournamentId: number
): Promise<{ sent: number; skipped: number; failed: number }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        select: { userId: true },
      },
      prizes: {
        orderBy: { place: "asc" },
        take: 3,
        select: { title: true, value: true },
      },
      _count: { select: { participants: true } },
    },
  });
  
  if (!tournament) {
    console.error(`[notifications] Tournament ${tournamentId} not found`);
    return { sent: 0, skipped: 0, failed: 0 };
  }
  
  // Calculate time until start
  const now = Date.now();
  const startsAt = new Date(tournament.startsAt).getTime();
  const diffMs = startsAt - now;
  
  let startsIn = "совсем скоро";
  if (diffMs > 0) {
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      startsIn = `через ${hours} ч`;
    } else if (minutes > 0) {
      startsIn = `через ${minutes} мин`;
    }
  }
  
  // Build prize pool description
  const prizePool = tournament.prizes.length > 0
    ? tournament.prizes.map(p => p.title).join(", ")
    : "XP и уникальные награды";
  
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  
  console.log(
    `[notifications] Sending "starting soon" for "${tournament.title}" ` +
    `to ${tournament.participants.length} participants`
  );
  
  for (const participant of tournament.participants) {
    const result = await notifyTournamentStarting(participant.userId, {
      tournamentTitle: tournament.title,
      tournamentSlug: tournament.slug,
      startsIn,
      isRegistered: true,
      participantsCount: tournament._count.participants,
      prizePool,
    });
    
    if (result.success) {
      sent++;
    } else if (result.reason === "send_failed") {
      failed++;
    } else {
      skipped++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(
    `[notifications] Tournament "${tournament.title}" starting notifications: ` +
    `${sent} sent, ${skipped} skipped, ${failed} failed`
  );
  
  return { sent, skipped, failed };
}

// ═══════════════════════════════════════════════════════════════════
// WEEKLY LEADERBOARD CHANGE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if a user's score update pushed others down in weekly leaderboard
 * Only notifies users who were pushed out of top 10
 * 
 * @param userId - The user whose score increased
 * @param newScore - Their new total weekly score
 * @param weekStart - The start of the current week
 */
export async function checkAndNotifyLeaderboardChanges(
  userId: number,
  newScore: number,
  weekStart: Date
): Promise<{ notified: number; skipped: number }> {
  const TOP_N = 10; // Only track top 10 positions
  
  try {
    // Get the current top 11 (we need 11 to know who was #10 before)
    const topScores = await prisma.weeklyScore.findMany({
      where: { weekStart },
      orderBy: { bestScore: "desc" },
      take: TOP_N + 1,
      select: {
        userId: true,
        bestScore: true,
        quizzes: true,
        user: {
          select: { 
            id: true, 
            username: true, 
            firstName: true,
            notifyLeaderboard: true,
          },
        },
      },
    });
    
    // Find the current user's position in the top
    const userIndex = topScores.findIndex(s => s.userId === userId);
    
    // If user is not in top 11, nothing to notify
    if (userIndex === -1) {
      return { notified: 0, skipped: 0 };
    }
    
    // User's new position (1-indexed)
    const userPosition = userIndex + 1;
    
    // Find user info for the notification
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, firstName: true },
    });
    const userName = currentUser?.username || currentUser?.firstName || "Игрок";
    
    let notified = 0;
    let skipped = 0;
    
    // Check if someone got pushed out of top 10 (user at position 11)
    if (topScores.length > TOP_N) {
      const pushedUser = topScores[TOP_N];
      
      // Only notify if they're not the current user and have notifications enabled
      if (pushedUser.userId !== userId && pushedUser.user.notifyLeaderboard) {
        // They were pushed from #10 to #11
        const success = await notifyLeaderboardChange(
          pushedUser.userId,
          "down",
          TOP_N + 1,
          userName,
          newScore
        );
        
        if (success) {
          notified++;
          console.log(
            `[notifications] Leaderboard: user ${pushedUser.userId} pushed down by ${userId}`
          );
        } else {
          skipped++;
        }
      }
    }
    
    // Also notify users directly below the current user if they dropped
    // But only if they were in top 10 and moved down
    // This is handled by the natural ordering - we already notified #11
    
    return { notified, skipped };
    
  } catch (error) {
    console.error("[notifications] Leaderboard change check failed:", error);
    return { notified: 0, skipped: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SCHEDULED ENERGY NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

const HOURS_PER_ENERGY = 4;
const ENERGY_COOLDOWN_MS = HOURS_PER_ENERGY * 60 * 60 * 1000;

/**
 * Планирует уведомление о ПОЛНОМ восстановлении энергии
 * Вызывается когда пользователь использует энергию
 * 
 * @param userId - ID пользователя
 * @param newestSessionStartedAt - Время начала самой новой сессии (последняя восстановится)
 */
export async function scheduleEnergyNotification(
  userId: number,
  newestSessionStartedAt: Date
): Promise<void> {
  try {
    // Рассчитываем когда ВСЯ энергия восстановится (4 часа после последней сессии)
    const scheduledAt = new Date(newestSessionStartedAt.getTime() + ENERGY_COOLDOWN_MS);
    
    // Проверяем, есть ли уже запланированное уведомление
    const existing = await prisma.scheduledNotification.findFirst({
      where: {
        userId,
        type: "ENERGY_RESTORED",
        sentAt: null,
      },
    });

    if (existing) {
      // Всегда обновляем на ПОЗДНЕЕ время (когда ВСЯ энергия восстановится)
      if (scheduledAt > existing.scheduledAt) {
        await prisma.scheduledNotification.update({
          where: { id: existing.id },
          data: { scheduledAt },
        });
        console.log(`[notifications] Updated energy notification for user ${userId}: ${scheduledAt.toISOString()}`);
      }
      return;
    }

    // Проверяем что пользователь хочет получать уведомления
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyEnergyFull: true },
    });

    if (!user?.notifyEnergyFull) {
      return;
    }

    // Создаём запланированное уведомление
    await prisma.scheduledNotification.create({
      data: {
        userId,
        type: "ENERGY_RESTORED",
        scheduledAt,
        data: { fullEnergy: true }, // Вся энергия восстановлена
      },
    });

    console.log(`[notifications] Scheduled FULL energy notification for user ${userId}: ${scheduledAt.toISOString()}`);
  } catch (error) {
    console.error(`[notifications] Failed to schedule energy notification:`, error);
  }
}

/**
 * Отменяет запланированное уведомление об энергии
 * Вызывается если энергия восстановилась раньше (например, бонусная)
 */
export async function cancelEnergyNotification(userId: number): Promise<void> {
  try {
    await prisma.scheduledNotification.deleteMany({
      where: {
        userId,
        type: "ENERGY_RESTORED",
        sentAt: null,
      },
    });
  } catch (error) {
    console.error(`[notifications] Failed to cancel energy notification:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// DUEL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Notify user about duel challenge
 */
export async function notifyDuelChallenge(
  opponentId: number,
  data: {
    duelId: string;
    challengerName: string;
    quizTitle: string;
    xpReward: number;
  }
): Promise<SendNotificationResult> {
  return sendNotification(opponentId, "duel_challenge", data);
}

/**
 * Notify challenger that duel was accepted
 */
export async function notifyDuelAccepted(
  challengerId: number,
  data: {
    duelId: string;
    opponentName: string;
    quizTitle: string;
  }
): Promise<SendNotificationResult> {
  return sendNotification(challengerId, "duel_accepted", data);
}

/**
 * Notify challenger that duel was declined
 */
export async function notifyDuelDeclined(
  challengerId: number,
  data: {
    opponentName: string;
  }
): Promise<SendNotificationResult> {
  return sendNotification(challengerId, "duel_declined", data);
}

/**
 * Notify user about duel result
 */
export async function notifyDuelResult(
  userId: number,
  data: {
    duelId: string;
    opponentName: string;
    isWinner: boolean;
    isDraw: boolean;
    myScore: number;
    opponentScore: number;
    xpEarned: number;
  }
): Promise<SendNotificationResult> {
  return sendNotification(userId, "duel_result", data);
}

/**
 * Notify opponent that duel was cancelled by challenger
 */
export async function notifyDuelCancelled(
  opponentId: number,
  data: {
    challengerName: string;
  }
): Promise<SendNotificationResult> {
  return sendNotification(opponentId, "duel_cancelled", data);
}

/**
 * Notify users about expired duel
 */
export async function notifyDuelExpired(
  userId: number,
  data: {
    challengerName: string;
  }
): Promise<SendNotificationResult> {
  return sendNotification(userId, "duel_expired", data);
}

