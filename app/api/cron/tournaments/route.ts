import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { finalizeTournament } from "@/app/api/tournaments/[id]/finalize/route";
import { sendTournamentStartingNotifications } from "@/lib/notifications";
import { getRedisClient, isRateLimitConfigured } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60; // До 60 секунд для Pro плана

// ═══════════════════════════════════════════════════════════════════════════
// CRON: Управление турнирами
// 
// Запускается каждые 5 минут:
// 1. Уведомляет участников о скором старте (за 30 мин)
// 2. Активирует турниры (UPCOMING → ACTIVE)
// 3. Финализирует турниры и раздаёт призы (ACTIVE → FINISHED)
// 4. Уведомления победителям отправляются в finalizeTournament
//
// ВАЖНО: Использует shared функцию finalizeTournament для избежания дублирования
// ═══════════════════════════════════════════════════════════════════════════

// Время до старта когда отправлять "starting soon" (30 минут)
const STARTING_SOON_THRESHOLD_MS = 30 * 60 * 1000;
// Время жизни ключа в Redis (25 минут) — чуть меньше порога чтобы не пропустить
const STARTING_SOON_TTL_MS = 25 * 60 * 1000;

/**
 * Проверяет, отправляли ли уже "starting soon" для этого турнира
 * Использует Redis для debounce (TTL = 25 минут)
 */
async function wasStartingSoonNotified(tournamentId: number): Promise<boolean> {
  if (!isRateLimitConfigured()) return false; // В dev всегда отправляем
  
  try {
    const redis = getRedisClient();
    const key = `tournament:starting-soon:${tournamentId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch {
    return false; // Fail open — отправляем если Redis недоступен
  }
}

/**
 * Помечает турнир как уведомлённый о скором старте
 */
async function markStartingSoonNotified(tournamentId: number): Promise<void> {
  if (!isRateLimitConfigured()) return;
  
  try {
    const redis = getRedisClient();
    const key = `tournament:starting-soon:${tournamentId}`;
    await redis.set(key, Date.now(), { px: STARTING_SOON_TTL_MS });
  } catch (error) {
    console.error(`[cron/tournaments] Redis error marking ${tournamentId}:`, error);
  }
}

export async function GET(req: NextRequest) {
  // ═══ UNIFIED CRON AUTH ═══
  const { requireCronAuth } = await import("@/lib/cron-auth");
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const now = new Date();
  const results = {
    startingSoonNotified: 0,
    startingSoonSkipped: 0,
    activated: 0,
    finalized: 0,
    prizesDistributed: 0,
    totalXpAwarded: 0,
    winnersNotified: 0,
    participantsNotified: 0,
    notificationsSkipped: 0,
    notificationsFailed: 0,
    errors: [] as string[],
  };

  try {
    // ═══ 1. "STARTING SOON" УВЕДОМЛЕНИЯ ═══
    // Турниры которые начнутся в течение 30 минут
    // Используем Redis для debounce (не спамим)
    const startingSoonThreshold = new Date(now.getTime() + STARTING_SOON_THRESHOLD_MS);
    
    const tournamentsStartingSoon = await prisma.tournament.findMany({
      where: {
        status: "UPCOMING",
        startsAt: {
          gt: now,
          lte: startingSoonThreshold,
        },
      },
      select: { id: true, title: true },
    });
    
    for (const tournament of tournamentsStartingSoon) {
      try {
        // Проверяем через Redis — уже уведомляли?
        const alreadyNotified = await wasStartingSoonNotified(tournament.id);
        if (alreadyNotified) {
          continue; // Пропускаем — уже отправляли
        }
        
        const { sent, skipped } = await sendTournamentStartingNotifications(tournament.id);
        results.startingSoonNotified += sent;
        results.startingSoonSkipped += skipped;
        
        // Помечаем в Redis что уведомили (TTL = 25 мин)
        await markStartingSoonNotified(tournament.id);
        
        if (sent > 0) {
          console.log(`[cron/tournaments] "Starting soon" notifications for "${tournament.title}": ${sent} sent, ${skipped} skipped`);
        }
      } catch (error) {
        console.error(`[cron/tournaments] Failed to send starting notifications for ${tournament.id}:`, error);
      }
    }
    
    // ═══ 2. UPCOMING → ACTIVE ═══
    const activated = await prisma.tournament.updateMany({
      where: {
        status: "UPCOMING",
        startsAt: { lte: now },
      },
      data: { status: "ACTIVE" },
    });
    results.activated = activated.count;

    if (activated.count > 0) {
      console.log(`[cron/tournaments] Activated ${activated.count} tournaments`);
    }

    // ═══ 3. Находим турниры для финализации ═══
    const tournamentsToFinalize = await prisma.tournament.findMany({
      where: {
        status: "ACTIVE",
        endsAt: { lte: now },
      },
      select: { id: true, title: true },
    });

    // ═══ 4. Финализируем каждый турнир через shared функцию ═══
    // Уведомления победителям и участникам отправляются внутри finalizeTournament
    for (const tournament of tournamentsToFinalize) {
      try {
        // Используем общую функцию finalizeTournament (DRY principle)
        // Она сама отправляет уведомления всем участникам
        const result = await finalizeTournament(tournament.id);

        if (!result) {
          results.errors.push(`${tournament.title}: Tournament not found`);
          continue;
        }

        results.finalized++;
        results.prizesDistributed += result.prizesDistributed.length;
        results.totalXpAwarded += result.totalXpAwarded;
        results.winnersNotified += result.notifications.winners;
        results.participantsNotified += result.notifications.participants;
        results.notificationsSkipped += result.notifications.skipped;
        results.notificationsFailed += result.notifications.failed;

        console.log(
          `[cron/tournaments] Finalized: ${result.tournamentTitle} ` +
          `(${result.prizesDistributed.length} prizes, ${result.totalXpAwarded} XP, ` +
          `${result.notifications.winners + result.notifications.participants} sent, ` +
          `${result.notifications.skipped} skipped, ${result.notifications.failed} failed)`
        );

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        
        // Обрабатываем ожидаемые ошибки
        if (message === "tournament_not_ended") {
          // Турнир ещё не закончился — это нормально, пропускаем
          continue;
        }
        
        if (message === "already_finalized") {
          // Уже финализирован — это нормально, пропускаем
          continue;
        }
        
        results.errors.push(`${tournament.title}: ${message}`);
        console.error(`[cron/tournaments] Error finalizing ${tournament.id}:`, error);

        // Помечаем как FINISHED даже при ошибке, чтобы не застрять
        try {
          await prisma.tournament.update({
            where: { id: tournament.id },
            data: { status: "FINISHED" },
          });
        } catch {
          // Ignore — турнир может быть уже FINISHED
        }
      }
    }

  } catch (error) {
    console.error("[cron/tournaments] Critical error:", error);
    return NextResponse.json({ 
      error: "cron_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }

  // Логируем только если что-то произошло
  if (results.activated > 0 || results.finalized > 0 || results.startingSoonNotified > 0) {
    console.log(
      `[cron/tournaments] Complete: ` +
      `starting-soon: ${results.startingSoonNotified} sent/${results.startingSoonSkipped} skipped, ` +
      `${results.activated} activated, ${results.finalized} finalized, ` +
      `${results.prizesDistributed} prizes (${results.totalXpAwarded} XP), ` +
      `notifications: ${results.winnersNotified} winners + ${results.participantsNotified} participants ` +
      `(${results.notificationsSkipped} skipped, ${results.notificationsFailed} failed)`
    );
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  });
}
