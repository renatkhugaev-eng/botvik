/**
 * Unified Cron Job Authentication
 * 
 * Обеспечивает единообразную авторизацию для всех cron endpoints.
 * В production требует CRON_SECRET, в dev разрешает без него.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Verify cron job authorization
 * @returns true if authorized, false otherwise
 */
export function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // В production ВСЕГДА требуем секрет
  if (process.env.NODE_ENV === "production") {
    if (!cronSecret) {
      console.error("[CRON] CRITICAL: CRON_SECRET not configured in production!");
      return false;
    }
    return authHeader === `Bearer ${cronSecret}`;
  }
  
  // В dev разрешаем без секрета для тестирования
  // но если секрет настроен — проверяем
  if (cronSecret && authHeader) {
    return authHeader === `Bearer ${cronSecret}`;
  }
  
  return true;
}

/**
 * Middleware для cron endpoints
 * Возвращает NextResponse с ошибкой или null если авторизация успешна
 */
export function requireCronAuth(req: NextRequest): NextResponse | null {
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      { error: "unauthorized", message: "Invalid or missing CRON_SECRET" },
      { status: 401 }
    );
  }
  return null;
}

