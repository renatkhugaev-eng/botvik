/**
 * ══════════════════════════════════════════════════════════════════════════════
 * RECENT OPPONENTS API — Недавние соперники по дуэлям
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Возвращает список последних 10 уникальных соперников с которыми играл пользователь.
 * Используется для:
 * - Секции "Недавние соперники" в профиле
 * - Быстрого добавления в друзья
 * - Функции "Реванш"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { levelFromXp } from "@/lib/xp";

export const runtime = "nodejs";

type DuelResult = "win" | "lose" | "draw";

interface RecentOpponent {
  id: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  level: number;
  xp: number;
  lastDuelId: string;
  lastDuelDate: string;
  result: DuelResult;
  myScore: number;
  opponentScore: number;
  isFriend: boolean;
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted";
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/me/recent-opponents — Получить недавних соперников
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;

    // Получаем все дуэли пользователя (завершённые)
    const duels = await prisma.duel.findMany({
      where: {
        status: "FINISHED",
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
      },
      orderBy: { finishedAt: "desc" },
      take: 50, // Берём больше, чтобы отфильтровать дубликаты и ботов
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
        challengerScore: true,
        opponentScore: true,
        winnerId: true,
        finishedAt: true,
        challenger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
            isBot: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
            isBot: true,
          },
        },
      },
    });

    // Получаем список друзей и заявок
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId },
          { friendId: userId },
        ],
      },
      select: {
        userId: true,
        friendId: true,
        status: true,
      },
    });

    // Создаём map для быстрого поиска статуса дружбы
    const friendshipMap = new Map<number, { isFriend: boolean; status: string; direction: "sent" | "received" }>();
    for (const f of friendships) {
      const otherId = f.userId === userId ? f.friendId : f.userId;
      const direction = f.userId === userId ? "sent" : "received";
      friendshipMap.set(otherId, { 
        isFriend: f.status === "ACCEPTED", 
        status: f.status,
        direction,
      });
    }

    // Собираем уникальных соперников
    const seenOpponents = new Set<number>();
    const recentOpponents: RecentOpponent[] = [];

    for (const duel of duels) {
      // Определяем кто соперник
      const isChallenger = duel.challengerId === userId;
      const opponent = isChallenger ? duel.opponent : duel.challenger;
      
      // Пропускаем ботов и себя
      if (opponent.isBot || opponent.id === userId) continue;
      
      // Пропускаем если уже добавлен
      if (seenOpponents.has(opponent.id)) continue;
      seenOpponents.add(opponent.id);

      // Определяем результат
      const myScore = isChallenger ? (duel.challengerScore ?? 0) : (duel.opponentScore ?? 0);
      const oppScore = isChallenger ? (duel.opponentScore ?? 0) : (duel.challengerScore ?? 0);
      
      let result: DuelResult;
      if (duel.winnerId === userId) {
        result = "win";
      } else if (duel.winnerId === null) {
        result = "draw";
      } else {
        result = "lose";
      }

      // Определяем статус дружбы
      const friendship = friendshipMap.get(opponent.id);
      let friendshipStatus: RecentOpponent["friendshipStatus"] = "none";
      
      if (friendship) {
        if (friendship.isFriend) {
          friendshipStatus = "accepted";
        } else if (friendship.status === "PENDING") {
          friendshipStatus = friendship.direction === "sent" ? "pending_sent" : "pending_received";
        }
      }

      recentOpponents.push({
        id: opponent.id,
        username: opponent.username,
        firstName: opponent.firstName,
        photoUrl: opponent.photoUrl,
        level: levelFromXp(opponent.xp),
        xp: opponent.xp,
        lastDuelId: duel.id,
        lastDuelDate: duel.finishedAt?.toISOString() ?? new Date().toISOString(),
        result,
        myScore,
        opponentScore: oppScore,
        isFriend: friendship?.isFriend ?? false,
        friendshipStatus,
      });

      // Максимум 10 соперников
      if (recentOpponents.length >= 10) break;
    }

    return NextResponse.json({
      ok: true,
      opponents: recentOpponents,
      total: recentOpponents.length,
    });

  } catch (error) {
    console.error("[Recent Opponents] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

