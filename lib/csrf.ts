/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CSRF PROTECTION — Best Practices 2025
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Защита от Cross-Site Request Forgery.
 * 
 * Стратегия:
 * 1. Проверка Origin/Referer header
 * 2. Whitelist для Telegram domains
 * 3. Пропуск GET/HEAD/OPTIONS запросов
 * 4. Пропуск webhook endpoints
 * 
 * ВАЖНО: Telegram Mini Apps уже защищены initData подписью,
 * но CSRF добавляет дополнительный слой защиты.
 */

import { NextRequest } from "next/server";
import { SECURITY_CONFIG } from "./config";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type CsrfResult =
  | { valid: true }
  | { valid: false; reason: string };

// ═══════════════════════════════════════════════════════════════════════════
// ALLOWED ORIGINS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Telegram domains that are always allowed
 */
const TELEGRAM_ORIGINS = [
  "https://web.telegram.org",
  "https://desktop.telegram.org", 
  "https://macos.telegram.org",
  "https://telegram.org",
  // Telegram iOS/Android WebView doesn't send Origin
];

/**
 * Paths that bypass CSRF check (webhooks, public endpoints)
 */
const BYPASS_PATHS = [
  "/api/telegram/webhook",
  "/api/health",
  "/api/og/",
  "/api/cron/",
];

/**
 * Methods that don't require CSRF check
 */
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// ═══════════════════════════════════════════════════════════════════════════
// CSRF VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract origin from request
 */
function getRequestOrigin(req: NextRequest): string | null {
  // Try Origin header first (most reliable)
  const origin = req.headers.get("origin");
  if (origin) return origin;
  
  // Fallback to Referer header
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
  // Telegram origins are always allowed
  for (const allowed of TELEGRAM_ORIGINS) {
    if (origin === allowed || origin.endsWith(".telegram.org")) {
      return true;
    }
  }
  
  // Check custom allowed origins from config
  for (const allowed of SECURITY_CONFIG.ALLOWED_ORIGINS) {
    if (origin === allowed) {
      return true;
    }
  }
  
  // In development, allow localhost
  if (process.env.NODE_ENV === "development") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if path bypasses CSRF
 */
function shouldBypassCsrf(pathname: string): boolean {
  for (const bypass of BYPASS_PATHS) {
    if (pathname.startsWith(bypass)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate CSRF for request
 * 
 * @param req - NextRequest
 * @returns CsrfResult
 */
export function validateCsrf(req: NextRequest): CsrfResult {
  // Skip if CSRF is disabled
  if (!SECURITY_CONFIG.CSRF_ENABLED) {
    return { valid: true };
  }
  
  // Skip safe methods
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.includes(method)) {
    return { valid: true };
  }
  
  // Skip bypass paths
  const pathname = req.nextUrl.pathname;
  if (shouldBypassCsrf(pathname)) {
    return { valid: true };
  }
  
  // Get origin
  const origin = getRequestOrigin(req);
  
  // Telegram mobile apps don't send Origin header
  // In this case, we rely on initData validation in auth layer
  if (!origin) {
    // Check if request has Telegram initData header
    const hasTelegramAuth = req.headers.has("x-telegram-init-data");
    if (hasTelegramAuth) {
      return { valid: true };
    }
    
    // Allow in development without origin
    if (process.env.NODE_ENV === "development") {
      return { valid: true };
    }
    
    // In production, missing origin without Telegram auth is suspicious
    console.warn(`[CSRF] No origin header for ${method} ${pathname}`);
    return { valid: false, reason: "Missing origin header" };
  }
  
  // Validate origin
  if (!isOriginAllowed(origin)) {
    console.warn(`[CSRF] Blocked request from origin: ${origin} to ${pathname}`);
    return { valid: false, reason: `Origin not allowed: ${origin}` };
  }
  
  return { valid: true };
}

/**
 * Middleware-compatible CSRF check
 * Returns null if valid, error message if invalid
 */
export function csrfCheck(req: NextRequest): string | null {
  const result = validateCsrf(req);
  return result.valid ? null : result.reason;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { TELEGRAM_ORIGINS, BYPASS_PATHS, SAFE_METHODS };

