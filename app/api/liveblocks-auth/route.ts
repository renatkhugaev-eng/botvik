/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LIVEBLOCKS AUTH ENDPOINT
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Авторизует пользователя для доступа к Liveblocks rooms.
 * Проверяет что пользователь имеет право доступа к дуэли.
 */

import { NextRequest, NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Lazy initialization — создаём только при первом запросе
let liveblocks: Liveblocks | null = null;

function getLiveblocks(): Liveblocks {
  if (!liveblocks) {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) {
      throw new Error("LIVEBLOCKS_SECRET_KEY is not configured");
    }
    liveblocks = new Liveblocks({ secret });
  }
  return liveblocks;
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем dev-mode
    const isDevMode = request.headers.get("X-Dev-Mode") === "true";
    
    // Аутентифицируем пользователя через Telegram (или dev-mock в dev режиме)
    const auth = await authenticateRequest(request);
    
    // В dev-mode без initData используем dev-mock пользователя
    if (!auth.ok && isDevMode && process.env.NODE_ENV === "development") {
      console.log("[Liveblocks Auth] Dev mode: using dev-mock user");
      
      // Находим или создаём dev-mock пользователя
      let devUser = await prisma.user.findUnique({
        where: { telegramId: "dev-mock" },
      });
      
      if (!devUser) {
        devUser = await prisma.user.create({
          data: {
            telegramId: "dev-mock",
            username: "devuser",
            firstName: "Dev",
            lastName: "User",
            xp: 100,
          },
        });
      }
      
      // Продолжаем с dev-mock пользователем
      const user = devUser;
      return await handleLiveblocksAuth(request, user);
    }
    
    if (!auth.ok) {
      console.error("[Liveblocks Auth] Authentication failed:", auth.error);
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { user } = auth;
    return await handleLiveblocksAuth(request, user);
  } catch (error) {
    console.error("[Liveblocks Auth] Error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function handleLiveblocksAuth(
  request: NextRequest,
  user: { id: number; firstName: string | null; username: string | null; photoUrl: string | null }
) {
  try {

    // Получаем room из body (с обработкой ошибок)
    let room: string | undefined;
    try {
      const body = await request.json();
      room = body?.room;
    } catch {
      // Body может быть пустым — это нормально
      console.log("[Liveblocks Auth] No room in body, granting access to all user duels");
    }

    // Если запрашивается конкретная комната дуэли — проверяем доступ
    if (room && room.startsWith("duel:")) {
      const duelId = room.replace("duel:", "");
      
      console.log(`[Liveblocks Auth] User ${user.id} requesting room: ${room}`);
      
      const duel = await prisma.duel.findUnique({
        where: { id: duelId },
        select: {
          challengerId: true,
          opponentId: true,
          status: true,
        },
      });

      if (!duel) {
        console.error(`[Liveblocks Auth] Duel ${duelId} not found`);
        return NextResponse.json({ error: "DUEL_NOT_FOUND" }, { status: 404 });
      }

      // Проверяем что пользователь — участник дуэли
      if (duel.challengerId !== user.id && duel.opponentId !== user.id) {
        console.error(`[Liveblocks Auth] User ${user.id} is not participant of duel ${duelId}`);
        return NextResponse.json({ error: "NOT_PARTICIPANT" }, { status: 403 });
      }

      // Проверяем что дуэль в правильном статусе
      if (!["ACCEPTED", "IN_PROGRESS"].includes(duel.status)) {
        console.error(`[Liveblocks Auth] Duel ${duelId} has wrong status: ${duel.status}`);
        return NextResponse.json({ error: "DUEL_NOT_ACTIVE", status: duel.status }, { status: 400 });
      }
      
      console.log(`[Liveblocks Auth] Access granted to user ${user.id} for duel ${duelId}`);
    }

    // ═══ СОЗДАЁМ СЕССИЮ LIVEBLOCKS ═══
    const session = getLiveblocks().prepareSession(String(user.id), {
      userInfo: {
        odId: user.id,
        odName: user.firstName || user.username || "Игрок",
        odPhotoUrl: user.photoUrl,
      },
    });

    // ═══ SECURITY: Даём доступ ТОЛЬКО к проверенным комнатам ═══
    // НЕ используем wildcard duel:* — это дыра в безопасности!
    
    // Если запрошена конкретная комната — даём доступ (уже проверено выше)
    if (room) {
      session.allow(room, session.FULL_ACCESS);
    }

    // Получаем все активные дуэли пользователя и даём доступ к каждой
    const userDuels = await prisma.duel.findMany({
      where: {
        OR: [
          { challengerId: user.id },
          { opponentId: user.id },
        ],
        status: { in: ["ACCEPTED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });

    // Даём доступ только к своим дуэлям
    for (const duel of userDuels) {
      session.allow(`duel:${duel.id}`, session.FULL_ACCESS);
    }

    const { status, body: responseBody } = await session.authorize();

    return new NextResponse(responseBody, { 
      status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Liveblocks Auth] handleLiveblocksAuth Error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
