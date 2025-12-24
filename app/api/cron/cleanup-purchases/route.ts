import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/cleanup-purchases — Очистка старых PENDING покупок
// Вызывается по расписанию (Vercel Cron или внешний сервис)
// NOTE: Объединённый endpoint (раньше был также cleanup-pending-purchases)
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // ═══ UNIFIED CRON AUTH ═══
  const authError = requireCronAuth(req);
  if (authError) return authError;

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

