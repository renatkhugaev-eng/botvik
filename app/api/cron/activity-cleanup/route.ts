import { NextRequest, NextResponse } from "next/server";
import { cleanupOldActivities } from "@/lib/activity";

export const runtime = "nodejs";

/**
 * POST /api/cron/activity-cleanup
 * 
 * Автоматическая очистка старых записей активности для ленты друзей
 * Вызывается Vercel Cron каждый день в 04:00 UTC (07:00 MSK)
 * 
 * Настройки:
 * - ACTIVITY_RETENTION_DAYS: сколько дней хранить (default: 30)
 * 
 * Логика:
 * - Удаляем записи активности старше N дней
 * - Это предотвращает неограниченный рост таблицы UserActivity
 */

// Настройки retention
const RETENTION_DAYS = parseInt(process.env.ACTIVITY_RETENTION_DAYS || "30", 10);

export async function POST(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  console.log(`[Activity Cleanup] Starting cleanup. Retention: ${RETENTION_DAYS} days`);

  try {
    // Удаляем старые активности
    const deletedCount = await cleanupOldActivities(RETENTION_DAYS);
    
    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      settings: {
        retentionDays: RETENTION_DAYS,
      },
      deleted: deletedCount,
      durationMs: duration,
    };
    
    console.log(`[Activity Cleanup] Complete. Deleted ${deletedCount} activities. Took ${duration}ms`);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("[Activity Cleanup] Error:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET для ручного тестирования
export async function GET(req: NextRequest) {
  return POST(req);
}
