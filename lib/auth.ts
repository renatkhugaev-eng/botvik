import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInitData, parseInitData } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * User context from Telegram authentication
 */
export type AuthUser = {
  id: number;           // Database user ID
  telegramId: string;   // Telegram user ID
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Result of authentication check
 */
export type AuthResult = 
  | { ok: true; user: AuthUser }
  | { ok: false; error: string; status: number };

/**
 * Extract initData from request headers or cookies
 * The client should send initData in the X-Telegram-Init-Data header
 */
function getInitDataFromRequest(req: NextRequest): string | null {
  // Option 1: From custom header (recommended)
  const headerData = req.headers.get("X-Telegram-Init-Data");
  if (headerData) return headerData;
  
  // Option 2: From cookie (for SSR pages)
  const cookieData = req.cookies.get("telegram_init_data")?.value;
  if (cookieData) return cookieData;
  
  return null;
}

/**
 * Authenticate request using Telegram initData
 * 
 * Usage:
 * ```ts
 * const auth = await authenticateRequest(req);
 * if (!auth.ok) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const user = auth.user;
 * ```
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const initData = getInitDataFromRequest(req);
  
  if (!initData) {
    // Allow dev mode bypass
    if (process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true" && process.env.NODE_ENV === "development") {
      // Return mock user for development
      const mockUser = await prisma.user.findFirst({
        orderBy: { id: "asc" },
      });
      
      if (mockUser) {
        return {
          ok: true,
          user: {
            id: mockUser.id,
            telegramId: mockUser.telegramId,
            username: mockUser.username,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
          },
        };
      }
    }
    
    return {
      ok: false,
      error: "NO_AUTH_DATA",
      status: 401,
    };
  }
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[auth] NO_BOT_TOKEN configured");
    return {
      ok: false,
      error: "SERVER_CONFIG_ERROR",
      status: 500,
    };
  }
  
  // Validate the initData signature
  const validation = validateInitData(initData, botToken);
  if (!validation.ok) {
    return {
      ok: false,
      error: `AUTH_FAILED: ${validation.reason}`,
      status: 401,
    };
  }
  
  // Parse user from initData
  const parsed = parseInitData(initData);
  const userRaw = parsed["user"];
  
  if (!userRaw) {
    return {
      ok: false,
      error: "NO_USER_IN_AUTH_DATA",
      status: 401,
    };
  }
  
  let tgUser: { id: number; username?: string; first_name?: string; last_name?: string };
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    return {
      ok: false,
      error: "INVALID_USER_DATA",
      status: 401,
    };
  }
  
  if (!tgUser?.id) {
    return {
      ok: false,
      error: "NO_USER_ID",
      status: 401,
    };
  }
  
  // Find or create user in database
  const user = await prisma.user.upsert({
    where: { telegramId: String(tgUser.id) },
    update: {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
    },
    create: {
      telegramId: String(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
    },
  });
  
  return {
    ok: true,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(error: string = "Unauthorized"): NextResponse {
  return NextResponse.json(
    { error, ok: false },
    { status: 401 }
  );
}

/**
 * Helper to check if user is admin
 */
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").filter(Boolean);

export function isAdmin(telegramId: string): boolean {
  // Always allow dev-mock in development
  if (process.env.NODE_ENV === "development" && telegramId === "dev-mock") {
    return true;
  }
  return ADMIN_TELEGRAM_IDS.includes(telegramId);
}

/**
 * Authenticate and check admin access
 */
export async function authenticateAdmin(req: NextRequest): Promise<AuthResult> {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return auth;
  }
  
  if (!isAdmin(auth.user.telegramId)) {
    return {
      ok: false,
      error: "ADMIN_ACCESS_REQUIRED",
      status: 403,
    };
  }
  
  return auth;
}

