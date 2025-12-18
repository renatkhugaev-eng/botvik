import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { finalizeTournament } from "@/app/api/tournaments/[id]/finalize/route";
import { notifyTournamentWinner } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60; // До 60 секунд для Pro плана

// ═══════════════════════════════════════════════════════════════════════════
// CRON: Управление турнирами
// 
// Запускается каждые 5 минут:
// 1. Активирует турниры (UPCOMING → ACTIVE)
// 2. Финализирует турниры и раздаёт призы (ACTIVE → FINISHED)
//
// ВАЖНО: Использует shared функцию finalizeTournament для избежания дублирования
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // Проверяем что это Vercel CRON
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // В dev режиме пропускаем проверку
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const results = {
    activated: 0,
    finalized: 0,
    prizesDistributed: 0,
    totalXpAwarded: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    // ═══ 1. UPCOMING → ACTIVE ═══
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

    // ═══ 2. Находим турниры для финализации ═══
    const tournamentsToFinalize = await prisma.tournament.findMany({
      where: {
        status: "ACTIVE",
        endsAt: { lte: now },
      },
      select: { id: true, title: true },
    });

    // ═══ 3. Финализируем каждый турнир через shared функцию ═══
    for (const tournament of tournamentsToFinalize) {
      try {
        // Используем общую функцию finalizeTournament (DRY principle)
        const result = await finalizeTournament(tournament.id);

        if (!result) {
          results.errors.push(`${tournament.title}: Tournament not found`);
          continue;
        }

        results.finalized++;
        results.prizesDistributed += result.prizesDistributed.length;
        results.totalXpAwarded += result.totalXpAwarded;

        console.log(
          `[cron/tournaments] Finalized: ${result.tournamentTitle} ` +
          `(${result.prizesDistributed.length} prizes, ${result.totalXpAwarded} XP)`
        );

        // ═══ 4. Отправляем уведомления победителям ═══
        for (const prize of result.prizesDistributed) {
          try {
            await notifyTournamentWinner(
              prize.winnerId,
              prize.place,
              result.tournamentTitle,
              0, // Score будет в уведомлении
              prize.xpAwarded,
              prize.title
            );
            results.notificationsSent++;
          } catch (notifyError) {
            console.error(
              `[cron/tournaments] Failed to notify winner ${prize.winnerId}:`,
              notifyError
            );
            // Не добавляем в errors — уведомления некритичны
          }
        }

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
  if (results.activated > 0 || results.finalized > 0) {
    console.log(
      `[cron/tournaments] Complete: ` +
      `${results.activated} activated, ${results.finalized} finalized, ` +
      `${results.prizesDistributed} prizes (${results.totalXpAwarded} XP), ` +
      `${results.notificationsSent} notifications`
    );
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  });
}
