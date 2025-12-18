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
 * In-memory user cache to avoid DB queries on every request
 * TTL: 5 minutes
 */
const userCache = new Map<string, { user: AuthUser; cachedAt: number }>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedUser(telegramId: string): AuthUser | null {
  const entry = userCache.get(telegramId);
  if (!entry) return null;
  
  if (Date.now() - entry.cachedAt > USER_CACHE_TTL_MS) {
    userCache.delete(telegramId);
    return null;
  }
  
  return entry.user;
}

function setCachedUser(telegramId: string, user: AuthUser): void {
  // Limit cache size
  if (userCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of userCache) {
      if (now - value.cachedAt > USER_CACHE_TTL_MS) {
        userCache.delete(key);
      }
    }
  }
  
  userCache.set(telegramId, { user, cachedAt: Date.now() });
}

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
 * OPTIMIZED: Uses cache to avoid DB queries on repeated requests
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const initData = getInitDataFromRequest(req);
  
  if (!initData) {
    // Allow dev mode bypass
    if (process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true" && process.env.NODE_ENV === "development") {
      // Use same dev-mock user as layout.tsx (telegramId: "dev-mock")
      let mockUser = await prisma.user.findUnique({
        where: { telegramId: "dev-mock" },
      });
      
      // Create if doesn't exist
      if (!mockUser) {
        mockUser = await prisma.user.upsert({
          where: { telegramId: "dev-mock" },
          update: {},
          create: {
            telegramId: "dev-mock",
            username: "devuser",
            firstName: "Dev",
            lastName: "User",
          },
        });
      }
      
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
  const startParam = parsed["start_param"] ?? null; // Реферальный код из deep link
  
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
  
  const telegramId = String(tgUser.id);
  
  // ═══ OPTIMIZED: Check cache first ═══
  const cachedUser = getCachedUser(telegramId);
  if (cachedUser) {
    return { ok: true, user: cachedUser };
  }
  
  // ═══ OPTIMIZED: Use findUnique first, only upsert if not found ═══
  let user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (!user) {
    // ═══ REFERRAL SYSTEM: Process referral code if present ═══
    let referrerId: number | null = null;
    
    if (startParam && startParam.startsWith("ref_")) {
      const referralCode = startParam.replace("ref_", "").toUpperCase();
      
      // Найти реферера по коду
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true, telegramId: true },
      });
      
      // Защита от самореферала
      if (referrer && referrer.telegramId !== telegramId) {
        referrerId = referrer.id;
      }
    }
    
    // ═══ АТОМАРНАЯ ТРАНЗАКЦИЯ: Создание пользователя + награды ═══
    try {
      user = await prisma.$transaction(async (tx) => {
        // 1. Создаём пользователя
        const newUser = await tx.user.create({
          data: {
            telegramId,
            username: tgUser.username ?? null,
            firstName: tgUser.first_name ?? null,
            lastName: tgUser.last_name ?? null,
            xp: referrerId ? 25 : 0, // Награда новичку сразу при создании
            ...(referrerId && { referredById: referrerId }),
          },
        });
        
        // 2. Награда рефереру (если есть) — в той же транзакции
        if (referrerId) {
          await tx.user.update({
            where: { id: referrerId },
            data: {
              xp: { increment: 50 },
              bonusEnergy: { increment: 1 },
              bonusEnergyEarned: { increment: 1 },
            },
          });
          
          console.log(`[auth] Referral processed: user ${newUser.id} referred by ${referrerId}`);
        }
        
        return newUser;
      });
    } catch (txError) {
      console.error("[auth] Transaction failed, creating user without referral:", txError);
      
      // Fallback: создаём пользователя без реферала
      user = await prisma.user.create({
        data: {
          telegramId,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          lastName: tgUser.last_name ?? null,
        },
      });
    }
  }
  // Note: We don't update existing users on every request anymore
  // Profile updates can be handled separately if needed
  
  const authUser: AuthUser = {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  
  // Cache the user
  setCachedUser(telegramId, authUser);
  
  return { ok: true, user: authUser };
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
  if (process.env.NODE_ENV === "development" && telegramId === "dev-mock") {
    return true;
  }
  return ADMIN_TELEGRAM_IDS.includes(telegramId);
}

/**
 * Authenticate and check admin access
 * Supports both Telegram auth AND browser session (admin_token cookie)
 */
export async function authenticateAdmin(req: NextRequest): Promise<AuthResult> {
  // ═══ OPTION 1: Try Telegram auth first ═══
  const auth = await authenticateRequest(req);
  
  if (auth.ok) {
    if (!isAdmin(auth.user.telegramId)) {
      return {
        ok: false,
        error: "ADMIN_ACCESS_REQUIRED",
        status: 403,
      };
    }
    return auth;
  }
  
  // ═══ OPTION 2: Check admin_token cookie (browser session) ═══
  const adminToken = req.cookies.get("admin_token")?.value;
  
  if (adminToken) {
    try {
      const decoded = JSON.parse(Buffer.from(adminToken, "base64").toString());
      
      if (decoded.authorized && decoded.expires > Date.now()) {
        // Return a mock admin user for browser sessions
        return {
          ok: true,
          user: {
            id: 0,
            telegramId: "browser-admin",
            username: "admin",
            firstName: "Admin",
            lastName: null,
          },
        };
      }
    } catch {
      // Invalid token format - ignore
    }
  }
  
  // No valid auth
  return {
    ok: false,
    error: "ADMIN_AUTH_REQUIRED",
    status: 401,
  };
}
