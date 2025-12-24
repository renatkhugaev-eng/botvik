/**
 * DEBUG: Notification Status Check
 * 
 * Позволяет проверить статус уведомлений для пользователя:
 * - Включены ли уведомления
 * - Когда было последнее уведомление
 * - Сколько pending scheduled notifications
 * - Заблокировал ли пользователь бота
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authenticateAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Только для админов или в dev режиме
  const isDevMode = process.env.NODE_ENV === "development";
  
  if (!isDevMode) {
    const auth = await authenticateAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  const search = req.nextUrl.searchParams;
  const targetUserId = Number(search.get("userId"));

  if (!targetUserId) {
    // Общая статистика
    const [
      totalUsers,
      usersWithNotificationsEnabled,
      pendingNotifications,
      sentLastHour,
      sentLastDay,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          OR: [
            { notifyLevelUp: true },
            { notifyEnergyFull: true },
            { notifyDailyReminder: true },
            { notifyLeaderboard: true },
            { notifyFriends: true },
          ],
        },
      }),
      prisma.scheduledNotification.count({
        where: { sentAt: null },
      }),
      prisma.scheduledNotification.count({
        where: {
          sentAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
      prisma.scheduledNotification.count({
        where: {
          sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return NextResponse.json({
      overview: {
        totalUsers,
        usersWithNotificationsEnabled,
        pendingNotifications,
        sentLastHour,
        sentLastDay,
      },
      usage: "GET /api/notifications/debug?userId=123 для проверки конкретного пользователя",
    });
  }

  // Статус конкретного пользователя
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastNotifiedAt: true,
      notifyLevelUp: true,
      notifyEnergyFull: true,
      notifyDailyReminder: true,
      notifyLeaderboard: true,
      notifyFriends: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Pending notifications для этого пользователя
  const pendingNotifications = await prisma.scheduledNotification.findMany({
    where: {
      userId: targetUserId,
      sentAt: null,
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      type: true,
      scheduledAt: true,
      createdAt: true,
    },
  });

  // Последние отправленные
  const recentSent = await prisma.scheduledNotification.findMany({
    where: {
      userId: targetUserId,
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      scheduledAt: true,
      sentAt: true,
    },
  });

  // Расчёт rate limit
  const now = Date.now();
  const lastNotifiedTime = user.lastNotifiedAt ? new Date(user.lastNotifiedAt).getTime() : 0;
  const timeSinceLastNotification = now - lastNotifiedTime;
  const rateLimitMs = 60 * 60 * 1000; // 1 hour
  const isRateLimited = timeSinceLastNotification < rateLimitMs;
  const rateLimitEndsIn = isRateLimited 
    ? Math.ceil((rateLimitMs - timeSinceLastNotification) / 60000) 
    : 0;

  return NextResponse.json({
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
    },
    preferences: {
      levelUp: user.notifyLevelUp,
      energyFull: user.notifyEnergyFull,
      dailyReminder: user.notifyDailyReminder,
      leaderboard: user.notifyLeaderboard,
      friends: user.notifyFriends,
    },
    rateLimit: {
      lastNotifiedAt: user.lastNotifiedAt,
      isRateLimited,
      rateLimitEndsInMinutes: rateLimitEndsIn,
      note: "Rate limit applies only to: daily_reminder, leaderboard_change, friend_activity",
    },
    pendingNotifications,
    recentSent,
    tips: [
      "Если pendingNotifications не пустой - проверьте CRON job /api/cron/scheduled-notifications",
      "Если isRateLimited=true - обычные уведомления блокируются на 1 час",
      "Если preferences отключены - уведомления не отправляются",
      "Проверьте что CRON_SECRET настроен в Vercel Environment Variables",
    ],
  });
}

