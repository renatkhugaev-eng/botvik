import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyEnergyFull } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════
// SCHEDULED NOTIFICATIONS PROCESSOR
// Обрабатывает запланированные уведомления и отправляет их вовремя
// Запускается каждую минуту через Vercel Cron
// ═══════════════════════════════════════════════════════════════════

const MAX_ENERGY = 5;
const BATCH_SIZE = 50; // Максимум уведомлений за один запуск
const SEND_DELAY_MS = 50; // Задержка между отправками (20 msg/sec)

/**
 * POST /api/cron/scheduled-notifications
 * 
 * Находит уведомления, время которых наступило, и отправляет их.
 * Запускается каждую минуту.
 */
export async function POST(req: NextRequest) {
  // ═══ UNIFIED CRON AUTH ═══
  const { requireCronAuth } = await import("@/lib/cron-auth");
  const authError = requireCronAuth(req);
  if (authError) return authError;
  
  const now = new Date();
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };
  
  try {
    // Находим все уведомления, время которых наступило
    const pendingNotifications = await prisma.scheduledNotification.findMany({
      where: {
        scheduledAt: { lte: now },
        sentAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            notifyEnergyFull: true,
            notifyDailyReminder: true,
            notifyLeaderboard: true,
          },
        },
      },
      take: BATCH_SIZE,
      orderBy: { scheduledAt: "asc" },
    });
    
    results.processed = pendingNotifications.length;
    
    if (pendingNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending notifications",
        ...results,
        timestamp: now.toISOString(),
      });
    }
    
    console.log(`[scheduled-notifications] Processing ${pendingNotifications.length} notifications`);
    
    for (const notification of pendingNotifications) {
      try {
        const { user, type, data } = notification;
        let success = false;
        let shouldSkip = false;
        
        switch (type) {
          case "ENERGY_RESTORED": {
            // Проверяем что пользователь ещё хочет уведомления
            if (!user.notifyEnergyFull) {
              shouldSkip = true;
              break;
            }
            
            // Отправляем уведомление о ПОЛНОМ восстановлении энергии (5/5)
            success = await notifyEnergyFull(user.id, MAX_ENERGY, MAX_ENERGY);
            break;
          }
          
          case "DAILY_REMINDER": {
            if (!user.notifyDailyReminder) {
              shouldSkip = true;
              break;
            }
            // Можно добавить логику для daily reminder
            shouldSkip = true; // Пока не реализовано
            break;
          }
          
          case "TOURNAMENT_STARTING": {
            if (!user.notifyLeaderboard) {
              shouldSkip = true;
              break;
            }
            // Можно добавить логику для tournament starting
            shouldSkip = true; // Пока не реализовано
            break;
          }
          
          default:
            shouldSkip = true;
        }
        
        // Помечаем уведомление как отправленное
        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { sentAt: new Date() },
        });
        
        if (shouldSkip) {
          results.skipped++;
        } else if (success) {
          results.sent++;
        } else {
          results.failed++;
        }
        
        // Задержка между отправками
        await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        
      } catch (error) {
        console.error(`[scheduled-notifications] Error processing notification ${notification.id}:`, error);
        results.failed++;
        results.errors.push(`Notification ${notification.id}: ${String(error)}`);
        
        // Помечаем как отправленное чтобы не повторять
        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { sentAt: new Date() },
        });
      }
    }
    
    // Очистка старых уведомлений (старше 7 дней)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await prisma.scheduledNotification.deleteMany({
      where: {
        sentAt: { lte: weekAgo },
      },
    });
    
    if (deleted.count > 0) {
      console.log(`[scheduled-notifications] Cleaned up ${deleted.count} old notifications`);
    }
    
    console.log(
      `[scheduled-notifications] Complete: ${results.processed} processed, ` +
      `${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`
    );
    
    return NextResponse.json({
      success: true,
      ...results,
      cleanedUp: deleted.count,
      timestamp: now.toISOString(),
    });
    
  } catch (error) {
    console.error("[scheduled-notifications] Fatal error:", error);
    return NextResponse.json(
      { error: "internal_error", message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET for health check
 */
export async function GET() {
  // Показываем статистику pending уведомлений
  const now = new Date();
  
  const [pending, upcoming] = await Promise.all([
    prisma.scheduledNotification.count({
      where: { scheduledAt: { lte: now }, sentAt: null },
    }),
    prisma.scheduledNotification.count({
      where: { scheduledAt: { gt: now }, sentAt: null },
    }),
  ]);
  
  return NextResponse.json({
    endpoint: "/api/cron/scheduled-notifications",
    description: "Process and send scheduled notifications",
    method: "POST",
    auth: "Bearer CRON_SECRET",
    schedule: "Every minute",
    stats: {
      pendingNow: pending,
      upcomingLater: upcoming,
    },
  });
}
