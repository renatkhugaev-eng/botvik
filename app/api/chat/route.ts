import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ChatMessagePayload } from "@/lib/supabase";
import { levelFromXp, getLevelTitle } from "@/lib/xp";

export const runtime = "nodejs";

/**
 * Chat API — GET для истории, POST для отправки
 * 
 * Оптимизации:
 * - Инкрементальная загрузка (after parameter)
 * - Убран серверный broadcast (клиенты сами обмениваются через Supabase)
 * - Кеширование на стороне клиента
 * 
 * Rate Limits:
 * - GET: 60 requests per minute (увеличено для polling)
 * - POST: 10 messages per minute (anti-spam)
 */

// Rate limiters
const redis = Redis.fromEnv();

const getMessagesLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"), // Увеличено для polling
  prefix: "chat:get",
});

const sendMessageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "chat:send",
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat — Получить сообщения
// 
// Query params:
// - limit: количество (default 50, max 100)
// - after: ID сообщения, после которого загружать (для инкрементальной загрузки)
// - before: ID сообщения, до которого загружать (для пагинации назад)
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // Rate limit
    const { success } = await getMessagesLimiter.limit(auth.user.id.toString());
    if (!success) {
      return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const after = searchParams.get("after"); // Для инкрементальной загрузки новых
    const before = searchParams.get("before"); // Для пагинации старых

    // Build where clause
    let whereClause = {};
    if (after) {
      whereClause = { id: { gt: parseInt(after) } };
    } else if (before) {
      whereClause = { id: { lt: parseInt(before) } };
    }

    // Fetch messages with reactions
    const messages = await prisma.chatMessage.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      orderBy: { createdAt: after ? "asc" : "desc" }, // asc для after, desc для before/initial
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
            equippedFrame: {
              select: {
                imageUrl: true,
              },
            },
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
      },
    });

    // Для initial load и before — реверсим для хронологического порядка
    const chronological = after ? messages : messages.reverse();

    // Map to payload with reactions
    const mappedMessages: ChatMessagePayload[] = chronological.map((m) => {
      const level = levelFromXp(m.user.xp);
      const { icon } = getLevelTitle(level);
      
      // Aggregate reactions: { "❤️": 3, "🔥": 1 }
      const reactions: Record<string, number> = {};
      let myReaction: string | null = null;
      
      for (const r of m.reactions) {
        reactions[r.emoji] = (reactions[r.emoji] || 0) + 1;
        if (r.userId === auth.user.id) {
          myReaction = r.emoji;
        }
      }
      
      return {
        id: m.id,
        odId: m.userId,
        username: m.user.username,
        firstName: m.user.firstName,
        photoUrl: m.user.photoUrl,
        frameUrl: m.user.equippedFrame?.imageUrl || null,
        level,
        levelIcon: icon,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
        reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
        myReaction,
      };
    });

    return NextResponse.json({
      ok: true,
      messages: mappedMessages,
      hasMore: messages.length === limit,
      // Для пагинации
      oldestId: chronological.length > 0 ? chronological[0].id : null,
      newestId: chronological.length > 0 ? chronological[chronological.length - 1].id : null,
    });
  } catch (error) {
    console.error("[Chat GET] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat — Отправить сообщение
// 
// Broadcast теперь делается на клиенте через Supabase Realtime
// Это быстрее и надёжнее чем серверный broadcast
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // Rate limit (stricter for sending)
    const { success, remaining } = await sendMessageLimiter.limit(auth.user.id.toString());
    if (!success) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", message: "Слишком много сообщений. Подождите минуту." },
        { status: 429 }
      );
    }

    // Parse body
    const body = await request.json();
    const text = (body.text || "").trim();

    // Validate
    if (!text) {
      return NextResponse.json({ ok: false, error: "EMPTY_MESSAGE" }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ ok: false, error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    // Basic content moderation
    const bannedPatterns = [
      /https?:\/\/[^\s]+/i, // URLs (можно убрать если нужны ссылки)
      /спам/i,
      /реклама/i,
    ];
    if (bannedPatterns.some((pattern) => pattern.test(text))) {
      return NextResponse.json({ ok: false, error: "CONTENT_BLOCKED" }, { status: 400 });
    }

    // Save to database
    const message = await prisma.chatMessage.create({
      data: {
        userId: auth.user.id,
        text,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
            equippedFrame: {
              select: {
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    // Calculate level
    const level = levelFromXp(message.user.xp);
    const { icon: levelIcon } = getLevelTitle(level);

    // Prepare payload (new message has no reactions)
    const payload: ChatMessagePayload = {
      id: message.id,
      odId: message.userId,
      username: message.user.username,
      firstName: message.user.firstName,
      photoUrl: message.user.photoUrl,
      frameUrl: message.user.equippedFrame?.imageUrl || null,
      level,
      levelIcon,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      reactions: undefined,
      myReaction: null,
    };

    // NOTE: Broadcast теперь делается на клиенте!
    // Клиент сам отправляет через Supabase channel.send()
    // Это быстрее (нет серверного round-trip) и надёжнее

    return NextResponse.json({
      ok: true,
      message: payload,
      remaining, // сколько сообщений ещё можно отправить
    });
  } catch (error) {
    console.error("[Chat POST] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
