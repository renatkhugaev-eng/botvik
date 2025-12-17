import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { supabase, isSupabaseConfigured, ChatMessagePayload } from "@/lib/supabase";
import { levelFromXp, getLevelTitle } from "@/lib/xp";

/**
 * Chat API — GET для истории, POST для отправки
 * 
 * Rate Limits:
 * - GET: 30 requests per minute
 * - POST: 10 messages per minute (anti-spam)
 */

// Rate limiters
const redis = Redis.fromEnv();

const getMessagesLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "chat:get",
});

const sendMessageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "chat:send",
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat — Получить последние сообщения
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
    const before = searchParams.get("before"); // cursor for pagination

    // Fetch messages
    const messages = await prisma.chatMessage.findMany({
      where: before ? { id: { lt: parseInt(before) } } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
          },
        },
      },
    });

    // Reverse to get chronological order
    const chronological = messages.reverse();

    return NextResponse.json({
      ok: true,
      messages: chronological.map((m) => {
        const level = levelFromXp(m.user.xp);
        const { icon } = getLevelTitle(level);
        return {
          id: m.id,
          userId: m.userId,
          username: m.user.username,
          firstName: m.user.firstName,
          photoUrl: m.user.photoUrl,
          level,
          levelIcon: icon,
          text: m.text,
          createdAt: m.createdAt.toISOString(),
        };
      }),
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    });
  } catch (error) {
    console.error("[Chat GET] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat — Отправить сообщение
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

    // Basic content moderation (можно расширить)
    const bannedWords = ["спам", "реклама"]; // TODO: расширить список
    const lowerText = text.toLowerCase();
    if (bannedWords.some((w) => lowerText.includes(w))) {
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
          },
        },
      },
    });

    // Calculate level
    const level = levelFromXp(message.user.xp);
    const { icon: levelIcon } = getLevelTitle(level);

    // Prepare payload for broadcast
    const payload: ChatMessagePayload = {
      id: message.id,
      userId: message.userId,
      username: message.user.username,
      firstName: message.user.firstName,
      photoUrl: message.user.photoUrl,
      level,
      levelIcon,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    };

    // Broadcast via Supabase Realtime (if configured)
    if (isSupabaseConfigured()) {
      try {
        const channel = supabase.channel("global:chat:broadcast");
        
        // Subscribe first, then send, then unsubscribe
        await new Promise<void>((resolve, reject) => {
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              channel
                .send({
                  type: "broadcast",
                  event: "new_message",
                  payload,
                })
                .then(() => {
                  supabase.removeChannel(channel);
                  resolve();
                })
                .catch(reject);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              reject(new Error(`Channel error: ${status}`));
            }
          });
          
          // Timeout after 3 seconds
          setTimeout(() => {
            supabase.removeChannel(channel);
            resolve(); // Don't fail the request
          }, 3000);
        });
      } catch (broadcastError) {
        // Don't fail the request if broadcast fails
        console.error("[Chat] Broadcast error:", broadcastError);
      }
    }

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
