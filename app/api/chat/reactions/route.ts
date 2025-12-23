import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Chat Reactions API
 * 
 * POST — добавить/изменить реакцию
 * DELETE — удалить реакцию
 * 
 * Доступные эмодзи: ❤️ 🔥 😂 👍 😮 😢
 */

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_EMOJIS = ["❤️", "🔥", "😂", "👍", "😮", "😢"] as const;
type AllowedEmoji = typeof ALLOWED_EMOJIS[number];

// Rate limiter (generous — reactions are fast)
const redis = Redis.fromEnv();
const reactionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 реакций в минуту
  prefix: "chat:reaction",
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/reactions — Добавить/изменить реакцию
// Body: { messageId: number, emoji: string }
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // Rate limit
    const { success } = await reactionLimiter.limit(auth.user.id.toString());
    if (!success) {
      return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
    }

    // Parse body
    const body = await request.json();
    const { messageId, emoji } = body;

    // Validate messageId
    if (!messageId || typeof messageId !== "number") {
      return NextResponse.json({ ok: false, error: "INVALID_MESSAGE_ID" }, { status: 400 });
    }

    // Validate emoji
    if (!emoji || !ALLOWED_EMOJIS.includes(emoji as AllowedEmoji)) {
      return NextResponse.json({ 
        ok: false, 
        error: "INVALID_EMOJI",
        allowedEmojis: ALLOWED_EMOJIS,
      }, { status: 400 });
    }

    // Check if message exists
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    // Upsert reaction (create or update)
    const reaction = await prisma.messageReaction.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: auth.user.id,
        },
      },
      update: { emoji },
      create: {
        messageId,
        userId: auth.user.id,
        emoji,
      },
      select: {
        id: true,
        emoji: true,
        messageId: true,
        userId: true,
      },
    });

    // Get updated reaction counts for this message
    const reactionCounts = await getReactionCounts(messageId);

    return NextResponse.json({
      ok: true,
      reaction,
      reactionCounts,
    });

  } catch (error) {
    console.error("[Chat Reactions POST] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/chat/reactions — Удалить реакцию
// Query: ?messageId=123
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // Rate limit (same as POST)
    const { success } = await reactionLimiter.limit(auth.user.id.toString());
    if (!success) {
      return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
    }

    // Get messageId from query
    const { searchParams } = new URL(request.url);
    const messageIdStr = searchParams.get("messageId");
    const messageId = messageIdStr ? parseInt(messageIdStr) : null;

    if (!messageId || isNaN(messageId)) {
      return NextResponse.json({ ok: false, error: "INVALID_MESSAGE_ID" }, { status: 400 });
    }

    // Delete reaction
    await prisma.messageReaction.deleteMany({
      where: {
        messageId,
        userId: auth.user.id,
      },
    });

    // Get updated reaction counts
    const reactionCounts = await getReactionCounts(messageId);

    return NextResponse.json({
      ok: true,
      reactionCounts,
    });

  } catch (error) {
    console.error("[Chat Reactions DELETE] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Get reaction counts for a message
// ═══════════════════════════════════════════════════════════════════════════

async function getReactionCounts(messageId: number): Promise<Record<string, number>> {
  const counts = await prisma.messageReaction.groupBy({
    by: ["emoji"],
    where: { messageId },
    _count: { emoji: true },
  });

  return counts.reduce((acc, item) => {
    acc[item.emoji] = item._count.emoji;
    return acc;
  }, {} as Record<string, number>);
}
