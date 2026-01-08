/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN AUTHENTICATION — JWT-based secure admin tokens
 * Best practices 2025: jose library, HS256, short-lived tokens
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
const TOKEN_EXPIRY = "24h";
const COOKIE_NAME = "admin_token";
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

// Admin Telegram IDs — loaded from environment variable
// SECURITY: Never hardcode admin IDs, always use env variables
export const ADMIN_TELEGRAM_IDS = (() => {
  const ids = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").filter(Boolean);
  
  // In development, allow dev-mock user if no admins configured
  if (process.env.NODE_ENV === "development" && ids.length === 0) {
    return ["dev-mock"];
  }
  
  return ids;
})();

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AdminTokenPayload extends JWTPayload {
  sub: string; // admin identifier (telegramId or "password")
  type: "admin";
  iat: number;
}

export interface AdminSession {
  valid: boolean;
  adminId?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getSecretKey(): Uint8Array {
  if (!JWT_SECRET) {
    throw new Error("ADMIN_JWT_SECRET or JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a signed JWT token for admin session
 */
export async function createAdminToken(adminId: string): Promise<string> {
  const secret = getSecretKey();
  
  const token = await new SignJWT({
    sub: adminId,
    type: "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
  
  return token;
}

/**
 * Create response with admin token cookie set
 */
export function createAdminTokenResponse(
  token: string,
  body: object = { success: true }
): NextResponse {
  const response = NextResponse.json(body);
  
  // Secure cookie settings (2025 best practices)
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify admin token from request (cookie or header)
 */
export async function verifyAdminToken(req: NextRequest): Promise<AdminSession> {
  try {
    // Try cookie first, then Authorization header
    const tokenFromCookie = req.cookies.get(COOKIE_NAME)?.value;
    const authHeader = req.headers.get("authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ") 
      ? authHeader.slice(7) 
      : null;
    
    const token = tokenFromCookie || tokenFromHeader;
    
    if (!token) {
      return { valid: false, error: "NO_TOKEN" };
    }
    
    const secret = getSecretKey();
    
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    
    // Validate payload structure
    if (payload.type !== "admin" || !payload.sub) {
      return { valid: false, error: "INVALID_TOKEN_TYPE" };
    }
    
    return {
      valid: true,
      adminId: payload.sub,
    };
    
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof Error) {
      if (error.name === "JWTExpired") {
        return { valid: false, error: "TOKEN_EXPIRED" };
      }
      if (error.name === "JWTClaimValidationFailed") {
        return { valid: false, error: "TOKEN_INVALID" };
      }
    }
    
    console.error("[admin-auth] Token verification failed:", error);
    return { valid: false, error: "TOKEN_VERIFICATION_FAILED" };
  }
}

/**
 * Verify admin token from cookies (for server components)
 */
export async function verifyAdminSession(): Promise<AdminSession> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!token) {
      return { valid: false, error: "NO_TOKEN" };
    }
    
    const secret = getSecretKey();
    
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    
    if (payload.type !== "admin" || !payload.sub) {
      return { valid: false, error: "INVALID_TOKEN_TYPE" };
    }
    
    return {
      valid: true,
      adminId: payload.sub,
    };
    
  } catch (error) {
    console.error("[admin-auth] Session verification failed:", error);
    return { valid: false, error: "SESSION_INVALID" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create response that clears admin cookie
 */
export function createLogoutResponse(): NextResponse {
  const response = NextResponse.json({ success: true });
  
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Require admin authentication for API route
 * Returns error response if not authenticated
 */
export async function requireAdmin(req: NextRequest): Promise<
  | { ok: true; adminId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await verifyAdminToken(req);
  
  if (!session.valid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: session.error || "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }
  
  return {
    ok: true,
    adminId: session.adminId!,
  };
}

