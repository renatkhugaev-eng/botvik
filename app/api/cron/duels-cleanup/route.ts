/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CRON: DUELS CLEANUP — Очистка истёкших дуэлей
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Запускается каждый час через Vercel Cron
 * - Переводит PENDING дуэли с истёкшим expiresAt в EXPIRED
 * - Переводит IN_PROGRESS дуэли без активности > 30 минут в EXPIRED
 * - Отправляет уведомления участникам
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDuelExpired } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

// Защита от внешних вызовов
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию cron
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let expiredPending = 0;
    let expiredInProgress = 0;

    // ═══ 1. PENDING дуэли с истёкшим expiresAt ═══
    // Сначала получаем дуэли для отправки уведомлений
    const expiredPendingDuels = await prisma.duel.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
        challenger: { select: { firstName: true, username: true } },
      },
    });

    // Обновляем статус
    if (expiredPendingDuels.length > 0) {
      await prisma.duel.updateMany({
        where: {
          id: { in: expiredPendingDuels.map(d => d.id) },
        },
        data: {
          status: "EXPIRED",
        },
      });

      // Отправляем уведомления обоим участникам
      for (const duel of expiredPendingDuels) {
        const challengerName = duel.challenger.firstName || duel.challenger.username || "Игрок";
        
        // Уведомляем оппонента
        notifyDuelExpired(duel.opponentId, { challengerName }).catch(err => 
          console.error(`[Duels Cleanup] Notification error for opponent ${duel.opponentId}:`, err)
        );
        
        // Небольшая задержка между уведомлениями
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    expiredPending = expiredPendingDuels.length;

    // ═══ 2. IN_PROGRESS дуэли без активности > 30 минут ═══
    // Если startedAt давно и нет ответов — считаем заброшенной
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    // Находим заброшенные дуэли
    const abandonedDuels = await prisma.duel.findMany({
      where: {
        status: "IN_PROGRESS",
        startedAt: { lt: thirtyMinutesAgo },
      },
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
      },
    });

    // Проверяем каждую на наличие недавних ответов
    for (const duel of abandonedDuels) {
      const recentAnswer = await prisma.duelAnswer.findFirst({
        where: {
          duelId: duel.id,
          createdAt: { gte: thirtyMinutesAgo },
        },
      });

      if (!recentAnswer) {
        // Нет активности — переводим в EXPIRED
        await prisma.duel.update({
          where: { id: duel.id },
          data: { status: "EXPIRED" },
        });
        expiredInProgress++;
      }
    }

    console.log(
      `[Duels Cleanup] Expired: ${expiredPending} pending, ${expiredInProgress} in_progress`
    );

    return NextResponse.json({
      ok: true,
      expiredPending,
      expiredInProgress,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[Duels Cleanup] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

