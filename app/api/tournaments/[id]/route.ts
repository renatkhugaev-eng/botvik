import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/tournaments/[id] — Детали турнира
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;
  const { id } = await context.params;
  
  // Поиск по ID или slug
  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { id: Number(id) || 0 },
        { slug: id },
      ],
    },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              description: true,
              questions: { select: { id: true } },
            },
          },
          results: {
            where: { userId },
            select: {
              score: true,
              rank: true,
              passed: true,
              completedAt: true,
            },
          },
        },
      },
      participants: {
        orderBy: { totalScore: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
      },
      prizes: {
        orderBy: { place: "asc" },
        include: {
          winner: {
            select: {
              id: true,
              firstName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
      },
      _count: {
        select: { participants: true },
      },
    },
  });
  
  if (!tournament) {
    return NextResponse.json({ error: "tournament_not_found" }, { status: 404 });
  }
  
  // Получаем участие текущего пользователя
  const myParticipation = await prisma.tournamentParticipant.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId: tournament.id,
        userId,
      },
    },
  });
  
  // Форматируем этапы
  const stages = tournament.stages.map((stage) => ({
    id: stage.id,
    order: stage.order,
    title: stage.title,
    description: stage.description,
    type: stage.type,
    startsAt: stage.startsAt?.toISOString() ?? tournament.startsAt.toISOString(),
    endsAt: stage.endsAt?.toISOString() ?? tournament.endsAt.toISOString(),
    scoreMultiplier: stage.scoreMultiplier,
    
    // Квиз (если есть)
    quiz: stage.quiz ? {
      id: stage.quiz.id,
      title: stage.quiz.title,
      description: stage.quiz.description,
      questionsCount: stage.quiz.questions.length,
    } : null,
    
    // Правила прохождения
    requirements: {
      topN: stage.topN,
      minScore: stage.minScore,
    },
    
    // Мой результат
    myResult: stage.results[0] ?? null,
    
    // Статус этапа
    status: getStageStatus(stage, tournament.startsAt, tournament.endsAt),
  }));
  
  // Форматируем лидерборд
  const leaderboard = tournament.participants.map((p, index) => ({
    rank: index + 1,
    score: p.totalScore,
    status: p.status,
    user: p.user,
  }));
  
  // Моя позиция в общем рейтинге
  const myRank = myParticipation?.rank ?? null;
  
  return NextResponse.json({
    ok: true,
    tournament: {
      id: tournament.id,
      slug: tournament.slug,
      title: tournament.title,
      description: tournament.description,
      icon: tournament.icon,
      coverImage: tournament.coverImage,
      gradient: { from: tournament.gradientFrom, to: tournament.gradientTo },
      
      startsAt: tournament.startsAt.toISOString(),
      endsAt: tournament.endsAt.toISOString(),
      status: tournament.status,
      type: tournament.type,
      
      minPlayers: tournament.minPlayers,
      maxPlayers: tournament.maxPlayers,
      entryFee: tournament.entryFee,
      
      participantsCount: tournament._count.participants,
    },
    stages,
    leaderboard,
    prizes: tournament.prizes.map((p) => ({
      place: p.place,
      title: p.title,
      description: p.description,
      icon: p.icon,
      type: p.type,
      value: p.value,
      winner: p.winner,
      awardedAt: p.awardedAt?.toISOString() ?? null,
    })),
    myParticipation: myParticipation ? {
      status: myParticipation.status,
      totalScore: myParticipation.totalScore,
      rank: myParticipation.rank,
      currentStage: myParticipation.currentStage,
      joinedAt: myParticipation.joinedAt.toISOString(),
    } : null,
    myRank,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/tournaments/[id] — Регистрация на турнир
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;
  const { id } = await context.params;
  
  // Получаем турнир
  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { id: Number(id) || 0 },
        { slug: id },
      ],
    },
    include: {
      _count: { select: { participants: true } },
    },
  });
  
  if (!tournament) {
    return NextResponse.json({ error: "tournament_not_found" }, { status: 404 });
  }
  
  // Проверяем статус турнира
  if (tournament.status === "FINISHED" || tournament.status === "CANCELLED") {
    return NextResponse.json({ error: "tournament_ended" }, { status: 400 });
  }
  
  // Проверяем максимум участников
  if (tournament.maxPlayers && tournament._count.participants >= tournament.maxPlayers) {
    return NextResponse.json({ error: "tournament_full" }, { status: 400 });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // АТОМАРНАЯ ТРАНЗАКЦИЯ: XP списание + регистрация участника
  // Предотвращает race condition и потерю XP при ошибке
  // ═══════════════════════════════════════════════════════════════════════════
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Проверяем уже зарегистрирован ли (внутри транзакции для атомарности)
      const existing = await tx.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: tournament.id,
            userId,
          },
        },
      });
      
      if (existing) {
        throw new Error("already_registered");
      }
      
      // 2. Проверяем и списываем XP (если есть entryFee)
      if (tournament.entryFee > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { xp: true },
        });
        
        if (!user || user.xp < tournament.entryFee) {
          throw new Error(`insufficient_xp:${tournament.entryFee}:${user?.xp ?? 0}`);
        }
        
        // Списываем XP атомарно
        await tx.user.update({
          where: { id: userId },
          data: { xp: { decrement: tournament.entryFee } },
        });
      }
      
      // 3. Регистрируем участника
      const participant = await tx.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          userId,
          status: tournament.status === "ACTIVE" ? "ACTIVE" : "REGISTERED",
        },
      });
      
      return participant;
    });
    
    console.log(`[tournaments] User ${userId} joined tournament ${tournament.id}`);
    
    return NextResponse.json({
      ok: true,
      participant: {
        id: result.id,
        status: result.status,
        joinedAt: result.joinedAt.toISOString(),
      },
      message: tournament.status === "ACTIVE" 
        ? "Вы присоединились к турниру!" 
        : "Вы зарегистрированы! Турнир скоро начнётся.",
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    
    // Обработка известных ошибок
    if (errorMessage === "already_registered") {
      return NextResponse.json({ error: "already_registered" }, { status: 400 });
    }
    
    if (errorMessage.startsWith("insufficient_xp:")) {
      const [, required, current] = errorMessage.split(":");
      return NextResponse.json({ 
        error: "insufficient_xp",
        required: Number(required),
        current: Number(current),
      }, { status: 400 });
    }
    
    console.error("[tournaments] Registration failed:", error);
    return NextResponse.json({ error: "registration_failed" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getStageStatus(
  stage: { startsAt: Date | null; endsAt: Date | null },
  tournamentStart: Date,
  tournamentEnd: Date
): "upcoming" | "active" | "finished" {
  const now = Date.now();
  const start = stage.startsAt?.getTime() ?? tournamentStart.getTime();
  const end = stage.endsAt?.getTime() ?? tournamentEnd.getTime();
  
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "active";
}
