/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUELS API — Создание и получение дуэлей
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Поддерживает два режима:
 * 1. Дуэль с другом: { opponentId, quizId }
 * 2. Дуэль с AI: { mode: "ai", quizId, difficulty? }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { notifyDuelChallenge } from "@/lib/notifications";
import { levelFromXp } from "@/lib/xp";
import {
  getOrCreateAIPlayer,
  getDifficultyForPlayer,
  type AIBotDifficulty,
} from "@/lib/ai-duel-bot";
import { isAIDuelRequest, type CreateDuelRequest } from "@/types/ai-duel";

export const runtime = "nodejs";

// Rate limiter: 10 дуэлей в час
const redis = Redis.fromEnv();
const createDuelLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "duel:create",
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/duels — Получить мои дуэли
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;

    // Получаем все активные дуэли пользователя
    const duels = await prisma.duel.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: {
          in: ["PENDING", "ACCEPTED", "IN_PROGRESS"],
        },
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Разделяем на входящие и исходящие
    const incoming = duels.filter(
      (d) => d.opponentId === userId && d.status === "PENDING"
    );
    const outgoing = duels.filter(
      (d) => d.challengerId === userId && d.status === "PENDING"
    );
    const active = duels.filter(
      (d) => d.status === "ACCEPTED" || d.status === "IN_PROGRESS"
    );

    return NextResponse.json({
      ok: true,
      incoming,
      outgoing,
      active,
    });
  } catch (error) {
    console.error("[Duels GET] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/duels — Создать дуэль (с другом или AI)
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const userId = auth.user.id;

    // Rate limit
    const { success } = await createDuelLimiter.limit(userId.toString());
    if (!success) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", message: "Слишком много вызовов. Подождите." },
        { status: 429 }
      );
    }

    const body = await request.json() as CreateDuelRequest;

    // ═══════════════════════════════════════════════════════════════════════════
    // РЕЖИМ AI — быстрая игра с ботом
    // ═══════════════════════════════════════════════════════════════════════════
    if (isAIDuelRequest(body)) {
      const { quizId, difficulty: requestedDifficulty } = body;

      if (!quizId) {
        return NextResponse.json(
          { ok: false, error: "MISSING_QUIZ_ID" },
          { status: 400 }
        );
      }

      // Проверяем квиз
      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId, isActive: true },
        select: { id: true, title: true },
      });

      if (!quiz) {
        return NextResponse.json(
          { ok: false, error: "QUIZ_NOT_FOUND" },
          { status: 404 }
        );
      }

      // Получаем данные игрока для подбора AI
      const player = await prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true },
      });
      const playerLevel = levelFromXp(player?.xp ?? 0);

      // Подбираем сложность AI
      const difficulty: AIBotDifficulty = requestedDifficulty ?? getDifficultyForPlayer(playerLevel);

      // Получаем или создаём AI-противника
      const aiPlayer = await getOrCreateAIPlayer(playerLevel);

      console.log(
        `[Duels AI] Creating AI duel: player=${userId} (lvl ${playerLevel}), ` +
        `bot=${aiPlayer.id} (${aiPlayer.firstName}), difficulty=${difficulty}`
      );

      // Создаём дуэль с AI — сразу в статусе ACCEPTED (не требует принятия)
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 час для AI дуэлей
      const roomId = `duel:ai:${Date.now()}`; // Уникальный room ID

      const duel = await prisma.duel.create({
        data: {
          challengerId: userId,
          opponentId: aiPlayer.id,
          quizId: quizId,
          expiresAt,
          xpReward: 50,
          xpLoser: 10,
          status: "ACCEPTED", // AI сразу "принимает" дуэль
          acceptedAt: new Date(),
          roomId,
        },
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              firstName: true,
              photoUrl: true,
              xp: true,
            },
          },
          opponent: {
            select: {
              id: true,
              username: true,
              firstName: true,
              photoUrl: true,
              xp: true,
            },
          },
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return NextResponse.json({
        ok: true,
        duel,
        roomId,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // РЕЖИМ ДРУГ — обычная дуэль
    // ═══════════════════════════════════════════════════════════════════════════
    const { opponentId, quizId } = body;

    // Валидация
    if (!opponentId || !quizId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    if (opponentId === userId) {
      return NextResponse.json(
        { ok: false, error: "CANNOT_CHALLENGE_SELF" },
        { status: 400 }
      );
    }

    // Проверяем что оппонент существует
    const opponent = await prisma.user.findUnique({
      where: { id: opponentId },
      select: { id: true, firstName: true, username: true },
    });

    if (!opponent) {
      return NextResponse.json(
        { ok: false, error: "OPPONENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Проверяем что они друзья
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId: userId, friendId: opponentId },
          { userId: opponentId, friendId: userId },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { ok: false, error: "NOT_FRIENDS" },
        { status: 400 }
      );
    }

    // Проверяем что квиз существует и активен
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId, isActive: true },
      select: { id: true, title: true },
    });

    if (!quiz) {
      return NextResponse.json(
        { ok: false, error: "QUIZ_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Проверяем нет ли уже активной дуэли между ними
    const existingDuel = await prisma.duel.findFirst({
      where: {
        OR: [
          { challengerId: userId, opponentId: opponentId },
          { challengerId: opponentId, opponentId: userId },
        ],
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
      },
    });

    if (existingDuel) {
      return NextResponse.json(
        { ok: false, error: "DUEL_ALREADY_EXISTS", duelId: existingDuel.id },
        { status: 400 }
      );
    }

    // Создаём дуэль
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа

    const duel = await prisma.duel.create({
      data: {
        challengerId: userId,
        opponentId: opponentId,
        quizId: quizId,
        expiresAt,
        xpReward: 50,
        xpLoser: 10,
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Отправляем push-уведомление оппоненту
    const challengerName = duel.challenger.firstName || duel.challenger.username || "Игрок";
    notifyDuelChallenge(opponentId, {
      duelId: duel.id,
      challengerName,
      quizTitle: duel.quiz.title,
      xpReward: duel.xpReward,
    }).catch((err) => {
      console.error("[Duels] Failed to send challenge notification:", err);
    });

    return NextResponse.json({
      ok: true,
      duel,
    });
  } catch (error) {
    console.error("[Duels POST] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
