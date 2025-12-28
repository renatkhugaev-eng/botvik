/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MATCHMAKING API — Поиск соперника для быстрой игры
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Ищет реального игрока, если не находит — подключает AI незаметно.
 * Пользователь НЕ знает что играет с ботом.
 *
 * Flow:
 * 1. Игрок отправляет запрос на поиск
 * 2. Проверяем есть ли кто-то в очереди
 * 3. Если есть — создаём дуэль между ними
 * 4. Если нет — добавляем в очередь и ждём (с таймаутом)
 * 5. По таймауту — создаём дуэль с AI
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { levelFromXp } from "@/lib/xp";
import { getOrCreateAIPlayer, getDifficultyForPlayer } from "@/lib/ai-duel-bot";

export const runtime = "nodejs";

// Настройки matchmaking
const MATCHMAKING_TIMEOUT_MS = 5000; // Общее время ожидания
const CHECK_INTERVAL_MS = 1000; // Проверяем очередь каждую секунду
const MAX_CHECKS = 5; // 5 проверок по 1 сек = 5 сек

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/duels/matchmaking — Найти соперника
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;
    const body = await request.json();
    const { quizId } = body as { quizId?: number };

    if (!quizId) {
      return NextResponse.json({ ok: false, error: "MISSING_QUIZ_ID" }, { status: 400 });
    }

    // Проверяем квиз
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId, isActive: true },
      select: { id: true, title: true },
    });

    if (!quiz) {
      return NextResponse.json({ ok: false, error: "QUIZ_NOT_FOUND" }, { status: 404 });
    }

    // Получаем данные игрока
    const player = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, firstName: true, username: true, photoUrl: true },
    });
    const playerLevel = levelFromXp(player?.xp ?? 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // ШАГ 1: Проверяем очередь — есть ли реальный игрок?
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Ищем игрока в очереди для этого квиза (созданного недавно, ±5 уровней)
    const matchmakingEntry = await prisma.matchmakingQueue.findFirst({
      where: {
        quizId,
        status: "WAITING",
        userId: { not: userId }, // Не себя
        level: {
          gte: playerLevel - 5,
          lte: playerLevel + 5,
        },
        createdAt: {
          // Запись не старше 30 секунд
          gte: new Date(Date.now() - 30000),
        },
        user: {
          isBot: false, // Только реальные игроки
        },
      },
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
      orderBy: { createdAt: "asc" }, // FIFO
    });

    if (matchmakingEntry) {
      // Нашли реального игрока! Создаём дуэль
      console.log(`[Matchmaking] Found real player: ${matchmakingEntry.user.firstName} (id=${matchmakingEntry.userId})`);

      // Атомарно обновляем статус очереди
      const updated = await prisma.matchmakingQueue.updateMany({
        where: {
          id: matchmakingEntry.id,
          status: "WAITING",
        },
        data: {
          status: "MATCHED",
          matchedWith: userId,
        },
      });

      if (updated.count === 0) {
        // Кто-то уже забрал этого игрока — пробуем снова
        console.log("[Matchmaking] Race condition, player already matched");
        // Рекурсивный повтор не делаем для простоты — идём к AI
      } else {
        // Создаём дуэль
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
        const roomId = `duel:${Date.now()}`;

        const duel = await prisma.duel.create({
          data: {
            challengerId: userId,
            opponentId: matchmakingEntry.userId,
            quizId,
            expiresAt,
            xpReward: 50,
            xpLoser: 10,
            status: "ACCEPTED",
            acceptedAt: new Date(),
            roomId,
          },
        });

        return NextResponse.json({
          ok: true,
          status: "found",
          duel: { id: duel.id },
          roomId,
          opponent: {
            firstName: matchmakingEntry.user.firstName || matchmakingEntry.user.username || "Игрок",
            photoUrl: matchmakingEntry.user.photoUrl,
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ШАГ 2: Добавляем себя в очередь и ждём
    // ═══════════════════════════════════════════════════════════════════════════

    // Удаляем старые записи этого игрока
    await prisma.matchmakingQueue.deleteMany({
      where: { userId },
    });

    // Добавляем в очередь
    const myEntry = await prisma.matchmakingQueue.create({
      data: {
        userId,
        quizId,
        level: playerLevel,
        status: "WAITING",
      },
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Ждём с периодическими проверками — даём шанс реальным игрокам найти нас
    // ═══════════════════════════════════════════════════════════════════════════
    
    for (let check = 0; check < MAX_CHECKS; check++) {
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));

      // Проверяем не matched ли нас кто-то
      const updatedEntry = await prisma.matchmakingQueue.findUnique({
        where: { id: myEntry.id },
        select: { status: true, matchedWith: true },
      });

      if (updatedEntry?.status === "MATCHED" && updatedEntry.matchedWith) {
        // Нас нашёл другой игрок — ищем созданную дуэль
        const existingDuel = await prisma.duel.findFirst({
          where: {
            OR: [
              { challengerId: userId, opponentId: updatedEntry.matchedWith },
              { challengerId: updatedEntry.matchedWith, opponentId: userId },
            ],
            status: { in: ["ACCEPTED", "IN_PROGRESS"] },
          },
          include: {
            challenger: { select: { firstName: true, username: true, photoUrl: true } },
            opponent: { select: { firstName: true, username: true, photoUrl: true } },
          },
        });

        if (existingDuel) {
          const opponent = existingDuel.challengerId === userId 
            ? existingDuel.opponent 
            : existingDuel.challenger;

          // Удаляем из очереди
          await prisma.matchmakingQueue.delete({ where: { id: myEntry.id } });

          return NextResponse.json({
            ok: true,
            status: "found",
            duel: { id: existingDuel.id },
            roomId: existingDuel.roomId,
            opponent: {
              firstName: opponent.firstName || opponent.username || "Игрок",
              photoUrl: opponent.photoUrl,
            },
          });
        }
      }
    } // конец цикла проверок

    // ═══════════════════════════════════════════════════════════════════════════
    // ШАГ 3: Последняя проверка — может кто-то появился в очереди?
    // Это решает edge case когда два игрока пришли почти одновременно
    // ═══════════════════════════════════════════════════════════════════════════

    const lastChanceMatch = await prisma.matchmakingQueue.findFirst({
      where: {
        quizId,
        status: "WAITING",
        userId: { not: userId },
        level: {
          gte: playerLevel - 5,
          lte: playerLevel + 5,
        },
        createdAt: {
          gte: new Date(Date.now() - 30000),
        },
        user: {
          isBot: false,
        },
      },
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
      orderBy: { createdAt: "asc" },
    });

    if (lastChanceMatch) {
      console.log(`[Matchmaking] Last chance! Found real player: ${lastChanceMatch.user.firstName}`);

      // Атомарно обновляем статус
      const updated = await prisma.matchmakingQueue.updateMany({
        where: {
          id: lastChanceMatch.id,
          status: "WAITING",
        },
        data: {
          status: "MATCHED",
          matchedWith: userId,
        },
      });

      if (updated.count > 0) {
        // Удаляем себя из очереди
        await prisma.matchmakingQueue.deleteMany({ where: { userId } });

        // Создаём дуэль
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
        const roomId = `duel:${Date.now()}`;

        const duel = await prisma.duel.create({
          data: {
            challengerId: userId,
            opponentId: lastChanceMatch.userId,
            quizId,
            expiresAt,
            xpReward: 50,
            xpLoser: 10,
            status: "ACCEPTED",
            acceptedAt: new Date(),
            roomId,
          },
        });

        return NextResponse.json({
          ok: true,
          status: "found",
          duel: { id: duel.id },
          roomId,
          opponent: {
            firstName: lastChanceMatch.user.firstName || lastChanceMatch.user.username || "Игрок",
            photoUrl: lastChanceMatch.user.photoUrl,
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ШАГ 4: Таймаут — подключаем AI (незаметно!)
    // ═══════════════════════════════════════════════════════════════════════════

    console.log(`[Matchmaking] Timeout for user ${userId}, connecting AI opponent`);

    // Удаляем из очереди
    await prisma.matchmakingQueue.deleteMany({ where: { userId } });

    // Получаем AI-противника
    const aiPlayer = await getOrCreateAIPlayer(playerLevel);

    // Создаём дуэль с AI
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const roomId = `duel:${Date.now()}`;

    const duel = await prisma.duel.create({
      data: {
        challengerId: userId,
        opponentId: aiPlayer.id,
        quizId,
        expiresAt,
        xpReward: 50,
        xpLoser: 10,
        status: "ACCEPTED",
        acceptedAt: new Date(),
        roomId,
      },
    });

    // Возвращаем данные БЕЗ упоминания AI
    return NextResponse.json({
      ok: true,
      status: "found",
      duel: { id: duel.id },
      roomId,
      opponent: {
        firstName: aiPlayer.firstName,
        photoUrl: aiPlayer.photoUrl,
      },
    });

  } catch (error) {
    console.error("[Matchmaking] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

