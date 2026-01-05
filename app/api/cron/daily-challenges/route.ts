/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DAILY CHALLENGES CRON — Генерация заданий на новый день
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Запускается в 00:05 UTC каждый день.
 * Генерирует 3 новых задания на текущий день.
 * Также очищает старые записи прогресса (старше 7 дней).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateTodayChallenges, getTodayUTC } from "@/lib/daily-challenges";

export const runtime = "nodejs";
export const maxDuration = 30;

// Vercel Cron secret для защиты эндпоинта
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию cron job
    const authHeader = request.headers.get("authorization");
    
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn("[DailyChallenges Cron] Unauthorized access attempt");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("[DailyChallenges Cron] Starting daily challenges generation...");
    
    const startTime = Date.now();
    const today = getTodayUTC();
    
    // 1. Генерируем задания на сегодня
    const challenges = await getOrCreateTodayChallenges();
    console.log(`[DailyChallenges Cron] Generated ${challenges.length} challenges for ${today.toISOString()}`);
    
    // 2. Очищаем старые записи прогресса (старше 7 дней)
    const cutoffDate = new Date(today);
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 7);
    
    // Удаляем старый прогресс пользователей
    const deletedProgress = await prisma.userDailyChallenge.deleteMany({
      where: {
        challenge: {
          date: { lt: cutoffDate },
        },
      },
    });
    console.log(`[DailyChallenges Cron] Deleted ${deletedProgress.count} old progress records`);
    
    // Удаляем старые бонусы
    const deletedBonuses = await prisma.dailyBonusClaim.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    });
    console.log(`[DailyChallenges Cron] Deleted ${deletedBonuses.count} old bonus claims`);
    
    // Удаляем старые задания
    const deletedChallenges = await prisma.dailyChallenge.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    });
    console.log(`[DailyChallenges Cron] Deleted ${deletedChallenges.count} old challenges`);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      ok: true,
      date: today.toISOString().split("T")[0],
      challengesGenerated: challenges.length,
      cleanup: {
        progressDeleted: deletedProgress.count,
        bonusesDeleted: deletedBonuses.count,
        challengesDeleted: deletedChallenges.count,
      },
      durationMs: duration,
    });
  } catch (error) {
    console.error("[DailyChallenges Cron] Error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

