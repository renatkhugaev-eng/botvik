import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/cron/chat-cleanup
 * 
 * Автоматическая очистка старых сообщений чата
 * Вызывается Vercel Cron каждый день в 03:00 UTC (06:00 MSK)
 * 
 * Настройки:
 * - CHAT_RETENTION_DAYS: сколько дней хранить (default: 30)
 * - CHAT_MAX_MESSAGES: максимум сообщений (default: 10000)
 * 
 * Логика:
 * 1. Удаляем сообщения старше N дней
 * 2. Если после этого > MAX_MESSAGES, удаляем самые старые
 */

// Настройки retention
const RETENTION_DAYS = parseInt(process.env.CHAT_RETENTION_DAYS || "30", 10);
const MAX_MESSAGES = parseInt(process.env.CHAT_MAX_MESSAGES || "10000", 10);

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
  console.log(`[Chat Cleanup] Starting cleanup. Retention: ${RETENTION_DAYS} days, Max: ${MAX_MESSAGES} messages`);

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // ЭТАП 1: Удаление сообщений старше N дней
    // ═══════════════════════════════════════════════════════════════════════════
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    
    const deletedByAge = await prisma.chatMessage.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    
    console.log(`[Chat Cleanup] Deleted ${deletedByAge.count} messages older than ${RETENTION_DAYS} days`);

    // ═══════════════════════════════════════════════════════════════════════════
    // ЭТАП 2: Проверка лимита количества сообщений
    // ═══════════════════════════════════════════════════════════════════════════
    
    const totalMessages = await prisma.chatMessage.count();
    let deletedByLimit = 0;
    
    if (totalMessages > MAX_MESSAGES) {
      // Находим ID сообщения, после которого нужно удалить
      const excessCount = totalMessages - MAX_MESSAGES;
      
      // Получаем самые старые сообщения для удаления
      const oldestMessages = await prisma.chatMessage.findMany({
        orderBy: { createdAt: "asc" },
        take: excessCount,
        select: { id: true },
      });
      
      if (oldestMessages.length > 0) {
        const idsToDelete = oldestMessages.map(m => m.id);
        
        const deleted = await prisma.chatMessage.deleteMany({
          where: { id: { in: idsToDelete } },
        });
        
        deletedByLimit = deleted.count;
        console.log(`[Chat Cleanup] Deleted ${deletedByLimit} excess messages (limit: ${MAX_MESSAGES})`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ЭТАП 3: Статистика
    // ═══════════════════════════════════════════════════════════════════════════
    
    const remainingMessages = await prisma.chatMessage.count();
    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      settings: {
        retentionDays: RETENTION_DAYS,
        maxMessages: MAX_MESSAGES,
      },
      deleted: {
        byAge: deletedByAge.count,
        byLimit: deletedByLimit,
        total: deletedByAge.count + deletedByLimit,
      },
      remaining: remainingMessages,
      durationMs: duration,
    };
    
    console.log(`[Chat Cleanup] Complete. Deleted ${result.deleted.total} total, ${remainingMessages} remaining. Took ${duration}ms`);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("[Chat Cleanup] Error:", error);
    
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
