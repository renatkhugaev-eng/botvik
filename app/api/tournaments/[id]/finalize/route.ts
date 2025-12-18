import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/tournaments/[id]/finalize — Финализация турнира и раздача призов
// 
// Может быть вызвано:
// 1. Автоматически через updateTournamentStatuses (когда endsAt прошло)
// 2. Вручную админом
// 3. Через CRON job (Vercel cron)
// ═══════════════════════════════════════════════════════════════════════════

type PrizeDistributionResult = {
  place: number;
  title: string;
  type: string;
  value: number;
  winnerId: number;
  winnerUsername: string | null;
  xpAwarded: number;
};

type FinalizationResult = {
  tournamentId: number;
  tournamentTitle: string;
  status: "FINISHED";
  totalParticipants: number;
  prizesDistributed: PrizeDistributionResult[];
  totalXpAwarded: number;
};

/**
 * Финализирует турнир и раздаёт призы победителям
 */
async function finalizeTournament(tournamentId: number): Promise<FinalizationResult | null> {
  // 1. Получаем турнир с призами и топ-участниками
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      prizes: {
        where: { winnerId: null }, // Только неразданные призы
        orderBy: { place: "asc" },
      },
      participants: {
        where: { status: { in: ["ACTIVE", "REGISTERED"] } },
        orderBy: { totalScore: "desc" },
        include: {
          user: {
            select: { id: true, username: true, xp: true },
          },
        },
      },
      _count: { select: { participants: true } },
    },
  });

  if (!tournament) {
    return null;
  }

  // 2. Проверяем что турнир уже закончился по времени
  const now = new Date();
  if (tournament.endsAt && tournament.endsAt > now) {
    throw new Error("tournament_not_ended");
  }

  // 3. Проверяем что турнир не был уже финализирован
  if (tournament.status === "FINISHED") {
    // Проверяем есть ли неразданные призы
    if (tournament.prizes.length === 0) {
      throw new Error("already_finalized");
    }
    // Иначе продолжаем раздачу оставшихся призов
  }

  // 4. Нет участников — просто завершаем
  if (tournament.participants.length === 0) {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "FINISHED" },
    });
    
    return {
      tournamentId,
      tournamentTitle: tournament.title,
      status: "FINISHED",
      totalParticipants: 0,
      prizesDistributed: [],
      totalXpAwarded: 0,
    };
  }

  // 5. АТОМАРНАЯ ТРАНЗАКЦИЯ: Раздача призов
  const result = await prisma.$transaction(async (tx) => {
    const distributedPrizes: PrizeDistributionResult[] = [];
    let totalXpAwarded = 0;

    // Обновляем статус турнира
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "FINISHED" },
    });

    // Пересчитываем финальные ранги
    for (let i = 0; i < tournament.participants.length; i++) {
      await tx.tournamentParticipant.update({
        where: { id: tournament.participants[i].id },
        data: { 
          rank: i + 1,
          status: "FINISHED",
        },
      });
    }

    // Раздаём призы
    for (const prize of tournament.prizes) {
      const winnerIndex = prize.place - 1;
      const winner = tournament.participants[winnerIndex];

      if (!winner) {
        // Нет участника на этом месте — пропускаем приз
        console.log(`[finalize] No participant for place ${prize.place}`);
        continue;
      }

      // Начисляем XP если тип приза — XP
      let xpToAward = 0;
      if (prize.type === "XP") {
        xpToAward = prize.value;
        
        await tx.user.update({
          where: { id: winner.userId },
          data: { xp: { increment: xpToAward } },
        });
        
        totalXpAwarded += xpToAward;
      }

      // Помечаем приз как врученный
      await tx.tournamentPrize.update({
        where: { id: prize.id },
        data: {
          winnerId: winner.userId,
          awardedAt: new Date(),
        },
      });

      distributedPrizes.push({
        place: prize.place,
        title: prize.title,
        type: prize.type,
        value: prize.value,
        winnerId: winner.userId,
        winnerUsername: winner.user.username,
        xpAwarded: xpToAward,
      });

      console.log(
        `[finalize] Prize ${prize.place} (${prize.title}) → ` +
        `User ${winner.userId} (${winner.user.username}): +${xpToAward} XP`
      );
    }

    return {
      distributedPrizes,
      totalXpAwarded,
    };
  });

  console.log(
    `[finalize] Tournament ${tournamentId} finalized: ` +
    `${result.distributedPrizes.length} prizes, ${result.totalXpAwarded} XP total`
  );

  return {
    tournamentId,
    tournamentTitle: tournament.title,
    status: "FINISHED",
    totalParticipants: tournament._count.participants,
    prizesDistributed: result.distributedPrizes,
    totalXpAwarded: result.totalXpAwarded,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Аутентификация (можно расширить до проверки админа)
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const tournamentId = Number(id);
  
  if (!tournamentId || Number.isNaN(tournamentId)) {
    return NextResponse.json({ error: "invalid_tournament_id" }, { status: 400 });
  }

  try {
    const result = await finalizeTournament(tournamentId);
    
    if (!result) {
      return NextResponse.json({ error: "tournament_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    
    if (message === "tournament_not_ended") {
      return NextResponse.json({ 
        error: "tournament_not_ended",
        message: "Турнир ещё не закончился",
      }, { status: 400 });
    }
    
    if (message === "already_finalized") {
      return NextResponse.json({ 
        error: "already_finalized",
        message: "Турнир уже финализирован и призы розданы",
      }, { status: 400 });
    }

    console.error("[finalize] Error:", error);
    return NextResponse.json({ error: "finalization_failed" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT для использования в других модулях
// ═══════════════════════════════════════════════════════════════════════════

export { finalizeTournament };
