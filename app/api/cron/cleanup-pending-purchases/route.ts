import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/cleanup-pending-purchases — Очистка старых PENDING покупок
// Запускается раз в день для удаления незавершённых платежей
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: Request) {
  // Проверяем авторизацию (Vercel Cron или API key)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Vercel Cron отправляет специальный заголовок
  const isVercelCron = req.headers.get("x-vercel-cron") === "true";
  
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Удаляем PENDING покупки старше 24 часов
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.purchase.deleteMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`[cron/cleanup-pending-purchases] Deleted ${result.count} old pending purchases`);

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[cron/cleanup-pending-purchases] Error:", error);
    return NextResponse.json({ ok: false, error: "cleanup_failed" }, { status: 500 });
  }
}
