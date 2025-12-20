import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Секрет для защиты cron endpoint
const CRON_SECRET = process.env.CRON_SECRET;

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/cleanup-purchases — Очистка старых PENDING покупок
// Вызывается по расписанию (Vercel Cron или внешний сервис)
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // Проверяем авторизацию
  const authHeader = req.headers.get("authorization");
  
  // В production требуем секрет
  if (process.env.NODE_ENV === "production") {
    if (!CRON_SECRET) {
      console.error("[cron/cleanup] CRON_SECRET not configured");
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn("[cron/cleanup] Unauthorized attempt");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    // Удаляем PENDING покупки старше 24 часов
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await prisma.purchase.deleteMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[cron/cleanup] Deleted ${result.count} orphaned PENDING purchases`);

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      cutoffDate: cutoffDate.toISOString(),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[cron/cleanup] Failed to cleanup purchases:", error);
    return NextResponse.json(
      { ok: false, error: "cleanup_failed" },
      { status: 500 }
    );
  }
}

