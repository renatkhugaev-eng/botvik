import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { 
  sendTournamentResultNotifications, 
  type TournamentParticipantResult 
} from "@/lib/notifications";

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
  tournamentSlug: string;
  status: "FINISHED";
  totalParticipants: number;
  prizesDistributed: PrizeDistributionResult[];
  totalXpAwarded: number;
  notifications: {
    winners: number;
    participants: number;
    skipped: number;
    failed: number;
  };
};

/**
 * Финализирует турнир и раздаёт призы победителям
 * После раздачи призов отправляет уведомления всем участникам
 */
async function finalizeTournament(tournamentId: number): Promise<FinalizationResult | null> {
  // 1. Получаем турнир с призами, участниками и этапами
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
      stages: {
        select: { id: true },
      },
      _count: { select: { participants: true } },
    },
  });
  
  // 2. Получаем количество пройденных этапов для каждого участника
  // TournamentStageResult связан с User, а не с TournamentParticipant
  // Поэтому делаем отдельный запрос
  const stageResultsCounts = tournament ? await prisma.tournamentStageResult.groupBy({
    by: ['userId'],
    where: {
      stage: { tournamentId },
      completedAt: { not: null },
    },
    _count: { id: true },
  }) : [];
  
  // Создаём Map для быстрого поиска
  const stagesCompletedByUser = new Map(
    stageResultsCounts.map(r => [r.userId, r._count.id])
  );

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
      tournamentSlug: tournament.slug,
      status: "FINISHED",
      totalParticipants: 0,
      prizesDistributed: [],
      totalXpAwarded: 0,
      notifications: { winners: 0, participants: 0, skipped: 0, failed: 0 },
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

    // ═══ ОПТИМИЗИРОВАННЫЙ ПЕРЕСЧЁТ РАНГОВ ═══
    // Используем batch updates вместо O(n) отдельных запросов
    // 
    // Участники уже отсортированы по totalScore DESC
    // Обновляем ранги партиями по 50 для баланса производительности
    const BATCH_SIZE = 50;
    const participantBatches: typeof tournament.participants[] = [];
    
    for (let i = 0; i < tournament.participants.length; i += BATCH_SIZE) {
      participantBatches.push(tournament.participants.slice(i, i + BATCH_SIZE));
    }
    
    let currentRank = 1;
    for (const batch of participantBatches) {
      // Используем Promise.all для параллельного обновления в батче
      await Promise.all(
        batch.map((participant, batchIndex) => 
          tx.tournamentParticipant.update({
            where: { id: participant.id },
            data: { 
              rank: currentRank + batchIndex,
              status: "FINISHED",
            },
          })
        )
      );
      currentRank += batch.length;
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

  // ═══ ОТПРАВКА УВЕДОМЛЕНИЙ ═══
  // Запускаем асинхронно, не блокируя ответ
  // Уведомления отправляются после успешного завершения транзакции
  
  // Строим карту призов для быстрого поиска
  const prizesByUserId = new Map(
    result.distributedPrizes.map(p => [p.winnerId, p])
  );
  
  // Подготавливаем данные для уведомлений
  const participantResults: TournamentParticipantResult[] = tournament.participants.map(
    (p, index) => {
      const prize = prizesByUserId.get(p.userId);
      return {
        userId: p.userId,
        rank: index + 1,
        score: p.totalScore,
        stagesCompleted: stagesCompletedByUser.get(p.userId) ?? 0,
        prizePlace: prize?.place,
        prizeTitle: prize?.title,
        xpAwarded: prize?.xpAwarded,
      };
    }
  );
  
  // Отправляем уведомления (не блокируем ответ)
  let notificationResult = { winners: 0, participants: 0, skipped: 0, failed: 0 };
  
  try {
    notificationResult = await sendTournamentResultNotifications({
      tournamentId,
      tournamentTitle: tournament.title,
      tournamentSlug: tournament.slug,
      totalParticipants: tournament._count.participants,
      totalStages: tournament.stages.length,
      participants: participantResults,
    });
  } catch (notifyError) {
    console.error("[finalize] Notification error (non-fatal):", notifyError);
    // Не бросаем ошибку — финализация успешна, уведомления — бонус
  }

  return {
    tournamentId,
    tournamentTitle: tournament.title,
    tournamentSlug: tournament.slug,
    status: "FINISHED",
    totalParticipants: tournament._count.participants,
    prizesDistributed: result.distributedPrizes,
    totalXpAwarded: result.totalXpAwarded,
    notifications: notificationResult,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // ═══ AUTHORIZATION ═══
  // Финализация требует админских прав или секретного ключа
  // Это предотвращает случайную/злонамеренную финализацию турниров
  
  // Проверяем секретный ключ (для cron jobs и внутренних вызовов)
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isInternalCall = authHeader === `Bearer ${cronSecret}` && cronSecret;
  
  if (!isInternalCall) {
    // Если не внутренний вызов — проверяем авторизацию пользователя
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    
    // Проверяем права администратора по Telegram ID
    // ADMIN_TELEGRAM_IDS в .env: "123456789,987654321"
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim());
    const isAdmin = adminIds.includes(auth.user.telegramId);
    
    if (!isAdmin) {
      console.log(`[finalize] Unauthorized attempt by user ${auth.user.id} (tg: ${auth.user.telegramId})`);
      return NextResponse.json(
        { error: "forbidden", message: "Требуются права администратора" },
        { status: 403 }
      );
    }
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
