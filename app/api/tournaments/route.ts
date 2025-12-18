import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/tournaments — Список турниров
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;
  const search = req.nextUrl.searchParams;
  const statusFilter = search.get("status"); // UPCOMING, ACTIVE, FINISHED
  
  // Автоматически обновляем статусы турниров
  await updateTournamentStatuses();
  
  // Фильтр по статусу
  const whereClause: Prisma.TournamentWhereInput = {};
  if (statusFilter) {
    whereClause.status = { in: [statusFilter as "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED"] };
  } else {
    // По умолчанию показываем только активные и предстоящие
    whereClause.status = { in: ["UPCOMING", "ACTIVE"] };
  }
  
  const tournaments = await prisma.tournament.findMany({
    where: whereClause,
    include: {
      stages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          type: true,
          startsAt: true,
          endsAt: true,
        },
      },
      participants: {
        where: { userId },
        select: {
          id: true,
          status: true,
          totalScore: true,
          rank: true,
          currentStage: true,
        },
      },
      prizes: {
        orderBy: { place: "asc" },
        take: 3,
        select: {
          place: true,
          title: true,
          icon: true,
          type: true,
          value: true,
        },
      },
      _count: {
        select: { participants: true },
      },
    },
    orderBy: [
      { status: "asc" }, // ACTIVE первыми
      { startsAt: "asc" },
    ],
  });
  
  // Форматируем ответ
  const formatted = tournaments.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    icon: t.icon,
    coverImage: t.coverImage,
    gradient: { from: t.gradientFrom, to: t.gradientTo },
    
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt.toISOString(),
    status: t.status,
    type: t.type,
    
    // Время до начала/конца
    timeRemaining: getTimeRemaining(t.status, t.startsAt, t.endsAt),
    
    // Участие текущего пользователя
    myParticipation: t.participants[0] ?? null,
    
    // Статистика
    participantsCount: t._count.participants,
    minPlayers: t.minPlayers,
    stagesCount: t.stages.length,
    
    // Призы (топ-3)
    prizes: t.prizes,
  }));
  
  return NextResponse.json({
    ok: true,
    tournaments: formatted,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Дебаунс для updateTournamentStatuses
 * Обновляем статусы максимум раз в 5 секунд
 * (достаточно часто для UX, но не слишком нагружает БД)
 */
let lastStatusUpdate = 0;
const STATUS_UPDATE_DEBOUNCE_MS = 5_000; // 5 секунд

/**
 * Автоматически обновляет статусы турниров на основе времени
 * С дебаунсом для оптимизации (не чаще раза в минуту)
 * 
 * Также запускает финализацию и раздачу призов для завершившихся турниров
 */
async function updateTournamentStatuses() {
  const now = Date.now();
  
  // Проверяем дебаунс
  if (now - lastStatusUpdate < STATUS_UPDATE_DEBOUNCE_MS) {
    return; // Пропускаем — обновляли недавно
  }
  
  lastStatusUpdate = now;
  const nowDate = new Date();
  
  try {
    // UPCOMING → ACTIVE (если началось)
    const activatedCount = await prisma.tournament.updateMany({
      where: {
        status: "UPCOMING",
        startsAt: { lte: nowDate },
      },
      data: { status: "ACTIVE" },
    });
    
    // Находим турниры, которые нужно финализировать
    // (ACTIVE, время вышло, есть неразданные призы)
    const tournamentsToFinalize = await prisma.tournament.findMany({
      where: {
        status: "ACTIVE",
        endsAt: { lte: nowDate },
      },
      select: { id: true, title: true },
    });
    
    // Финализируем каждый турнир (раздаём призы)
    let finalizedCount = 0;
    for (const tournament of tournamentsToFinalize) {
      try {
        // Динамический импорт для избежания circular dependency
        const { finalizeTournament } = await import("./[id]/finalize/route");
        await finalizeTournament(tournament.id);
        finalizedCount++;
        console.log(`[tournaments] Auto-finalized: ${tournament.title}`);
      } catch (err) {
        console.error(`[tournaments] Failed to finalize ${tournament.id}:`, err);
        
        // Если финализация не удалась, всё равно помечаем как FINISHED
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: "FINISHED" },
        });
      }
    }
    
    if (activatedCount.count > 0 || finalizedCount > 0) {
      console.log(
        `[tournaments] Status update: ${activatedCount.count} activated, ${finalizedCount} finalized`
      );
    }
  } catch (error) {
    console.error("[tournaments] Status update failed:", error);
    // Не бросаем ошибку — это фоновая операция
  }
}

/**
 * Вычисляет оставшееся время
 */
function getTimeRemaining(
  status: string,
  startsAt: Date,
  endsAt: Date
): { ms: number; label: string } | null {
  const now = Date.now();
  
  if (status === "UPCOMING") {
    const ms = startsAt.getTime() - now;
    return { ms, label: formatDuration(ms) };
  }
  
  if (status === "ACTIVE") {
    const ms = endsAt.getTime() - now;
    return { ms, label: formatDuration(ms) };
  }
  
  return null;
}

/**
 * Форматирует длительность в читаемый вид
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return "Завершено";
  
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}
