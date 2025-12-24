/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHECK SUBSCRIPTION API — Verify Telegram channel subscription
 * Best practices 2025: Use authenticated user's telegramId, rate limiting
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, generalLimiter, getClientIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

// Channel to check subscription (without @)
const REQUIRED_CHANNEL = "dark_bookshelf";

type ChatMemberStatus = 
  | "creator" 
  | "administrator" 
  | "member" 
  | "restricted" 
  | "left" 
  | "kicked";

type TelegramResponse = {
  ok: boolean;
  result?: {
    status: ChatMemberStatus;
  };
  description?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/check-subscription — Check if user is subscribed to channel
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // ═══ DEV MODE BYPASS ═══
  const allowDevMock = process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true";
  if (allowDevMock && process.env.NODE_ENV !== "production") {
    console.log("[check-subscription] DEV MODE - skipping subscription check");
    return NextResponse.json({
      subscribed: true,
      status: "dev-mock",
      channel: REQUIRED_CHANNEL,
    });
  }

  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      { subscribed: false, error: auth.error },
      { status: auth.status }
    );
  }

  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(generalLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ GET BOT TOKEN ═══
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[check-subscription] NO_BOT_TOKEN");
    // In dev without token, allow access
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        subscribed: true,
        status: "no-token-dev",
        channel: REQUIRED_CHANNEL,
      });
    }
    return NextResponse.json(
      { subscribed: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }

  try {
    // ═══ CHECK SUBSCRIPTION VIA TELEGRAM API ═══
    const telegramUserId = auth.user.telegramId;
    
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${REQUIRED_CHANNEL}&user_id=${telegramUserId}`
    );

    const data = (await response.json()) as TelegramResponse;
    
    console.log("[check-subscription]", {
      telegramUserId,
      channel: REQUIRED_CHANNEL,
      response: data,
    });

    if (data.ok && data.result) {
      const status = data.result.status;
      const isSubscribed = ["creator", "administrator", "member"].includes(status);

      return NextResponse.json({
        subscribed: isSubscribed,
        status,
        channel: REQUIRED_CHANNEL,
      });
    }

    // Telegram API error (bot not admin in channel, channel not found, etc.)
    return NextResponse.json({
      subscribed: false,
      error: data.description ?? "TELEGRAM_API_ERROR",
      channel: REQUIRED_CHANNEL,
    });
    
  } catch (error) {
    console.error("[check-subscription] Error:", error);
    return NextResponse.json(
      { subscribed: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
