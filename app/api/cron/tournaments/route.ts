import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyTournamentWinner } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60; // До 60 секунд для Pro плана

// ═══════════════════════════════════════════════════════════════════════════
// CRON: Управление турнирами
// 
// Запускается каждые 5 минут:
// 1. Активирует турниры (UPCOMING → ACTIVE)
// 2. Финализирует турниры и раздаёт призы (ACTIVE → FINISHED)
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

    // ═══ 2. Находим турниры для финализации ═══
    const tournamentsToFinalize = await prisma.tournament.findMany({
      where: {
        status: "ACTIVE",
        endsAt: { lte: now },
      },
      include: {
        prizes: {
          where: { winnerId: null },
          orderBy: { place: "asc" },
        },
        participants: {
          orderBy: { totalScore: "desc" },
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    // ═══ 3. Финализируем каждый турнир ═══
    for (const tournament of tournamentsToFinalize) {
      try {
        // Атомарная транзакция для раздачи призов
        const prizeResult = await prisma.$transaction(async (tx) => {
          let prizesGiven = 0;
          let xpGiven = 0;

          // Обновляем статус турнира
          await tx.tournament.update({
            where: { id: tournament.id },
            data: { status: "FINISHED" },
          });

          // Обновляем статусы участников и ранги
          for (let i = 0; i < tournament.participants.length; i++) {
            await tx.tournamentParticipant.update({
              where: { id: tournament.participants[i].id },
              data: { rank: i + 1, status: "FINISHED" },
            });
          }

          // Раздаём призы
          for (const prize of tournament.prizes) {
            const winnerIndex = prize.place - 1;
            const winner = tournament.participants[winnerIndex];

            if (!winner) continue;

            // Начисляем XP
            if (prize.type === "XP") {
              await tx.user.update({
                where: { id: winner.userId },
                data: { xp: { increment: prize.value } },
              });
              xpGiven += prize.value;
            }

            // Помечаем приз
            await tx.tournamentPrize.update({
              where: { id: prize.id },
              data: {
                winnerId: winner.userId,
                awardedAt: now,
              },
            });

            prizesGiven++;
            
            console.log(
              `[cron/tournaments] ${tournament.title}: ` +
              `Prize #${prize.place} → ${winner.user.username} (+${prize.value} XP)`
            );

            // Отправляем уведомление победителю
            await notifyTournamentWinner(
              winner.userId,
              prize.place,
              tournament.title,
              winner.totalScore,
              prize.type === "XP" ? prize.value : 0,
              prize.title
            );
          }

          return { prizesGiven, xpGiven };
        });

        results.finalized++;
        results.prizesDistributed += prizeResult.prizesGiven;
        results.totalXpAwarded += prizeResult.xpGiven;

        console.log(
          `[cron/tournaments] Finalized: ${tournament.title} ` +
          `(${prizeResult.prizesGiven} prizes, ${prizeResult.xpGiven} XP)`
        );

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`${tournament.title}: ${message}`);
        console.error(`[cron/tournaments] Error finalizing ${tournament.id}:`, error);

        // Всё равно помечаем как FINISHED
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: "FINISHED" },
        });
      }
    }

  } catch (error) {
    console.error("[cron/tournaments] Critical error:", error);
    return NextResponse.json({ 
      error: "cron_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }

  console.log(
    `[cron/tournaments] Complete: ` +
    `${results.activated} activated, ${results.finalized} finalized, ` +
    `${results.prizesDistributed} prizes (${results.totalXpAwarded} XP)`
  );

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  });
}
