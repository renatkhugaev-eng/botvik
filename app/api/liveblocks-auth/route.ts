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
    // Аутентифицируем пользователя через Telegram
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { user } = auth;

    // Получаем room из body
    const body = await request.json();
    const { room } = body;

    // Если запрашивается конкретная комната дуэли — проверяем доступ
    if (room && room.startsWith("duel:")) {
      const duelId = room.replace("duel:", "");
      
      const duel = await prisma.duel.findUnique({
        where: { id: duelId },
        select: {
          challengerId: true,
          opponentId: true,
          status: true,
        },
      });

      if (!duel) {
        return NextResponse.json({ error: "DUEL_NOT_FOUND" }, { status: 404 });
      }

      // Проверяем что пользователь — участник дуэли
      if (duel.challengerId !== user.id && duel.opponentId !== user.id) {
        return NextResponse.json({ error: "NOT_PARTICIPANT" }, { status: 403 });
      }

      // Проверяем что дуэль в правильном статусе
      if (!["ACCEPTED", "IN_PROGRESS"].includes(duel.status)) {
        return NextResponse.json({ error: "DUEL_NOT_ACTIVE" }, { status: 400 });
      }
    }

    // Создаём сессию Liveblocks
    const session = getLiveblocks().prepareSession(String(user.id), {
      userInfo: {
        odId: user.id,
        odName: user.firstName || user.username || "Игрок",
        odPhotoUrl: user.photoUrl,
      },
    });

    // Даём доступ к комнате дуэли
    if (room) {
      session.allow(room, session.FULL_ACCESS);
    }

    // Также даём доступ ко всем дуэлям пользователя (для будущих комнат)
    session.allow(`duel:*`, session.FULL_ACCESS);

    const { status, body: responseBody } = await session.authorize();

    return new NextResponse(responseBody, { 
      status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Liveblocks Auth] Error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
