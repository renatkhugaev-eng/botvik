/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN LOGIN API — Secure JWT-based authentication
 * Best practices 2025: JWT tokens, timing-safe comparison, rate limiting
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, authLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { 
  createAdminToken, 
  createAdminTokenResponse, 
  createLogoutResponse 
} from "@/lib/admin-auth";
import { auditLog } from "@/lib/audit-log";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timing-safe password comparison to prevent timing attacks
 */
function verifyPassword(input: string, expected: string): boolean {
  try {
    const inputBuffer = Buffer.from(input);
    const expectedBuffer = Buffer.from(expected);
    
    // Lengths must match for timingSafeEqual
    if (inputBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(inputBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/admin/login — Password-based admin login
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // ═══ RATE LIMITING (prevent brute force) ═══
  const identifier = getClientIdentifier(req);
  const rateLimit = await checkRateLimit(authLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ VALIDATE CONFIGURATION ═══
  if (!ADMIN_PASSWORD) {
    console.error("[admin/login] ADMIN_PASSWORD not configured");
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 }
    );
  }

  // ═══ PARSE BODY ═══
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { password } = body;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  // ═══ VERIFY PASSWORD (timing-safe) ═══
  const isValid = verifyPassword(password, ADMIN_PASSWORD);

  if (!isValid) {
    // Log failed attempt
    console.warn(`[admin/login] Failed login attempt from ${identifier}`);
    
    await auditLog({
      action: "ADMIN_LOGIN_FAILED",
      details: { 
        identifier,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      },
    });

    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  // ═══ CREATE JWT TOKEN ═══
  try {
    const token = await createAdminToken("password-admin");
    
    // Log successful login
    await auditLog({
      action: "ADMIN_LOGIN_SUCCESS",
      details: {
        method: "password",
        identifier,
      },
    });

    console.log(`[admin/login] Successful login from ${identifier}`);
    
    return createAdminTokenResponse(token, { 
      success: true,
      message: "Logged in successfully",
    });
    
  } catch (error) {
    console.error("[admin/login] Failed to create token:", error);
    return NextResponse.json(
      { error: "token_creation_failed" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/login — Logout (clear cookie)
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE() {
  return createLogoutResponse();
}
