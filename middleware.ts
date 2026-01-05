/**
 * ══════════════════════════════════════════════════════════════════════════════
 * MIDDLEWARE — Network & Security enhancements
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Улучшает работу приложения в нестабильных сетях:
 * - CORS для API эндпоинтов
 * - Retry-After headers при ошибках
 * - Connection keep-alive
 * - Telegram WebView compatibility
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // API ROUTES — CORS & Network Headers
  // ═══════════════════════════════════════════════════════════════════════════
  if (pathname.startsWith("/api/")) {
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Init-Data",
          "Access-Control-Max-Age": "86400", // Cache preflight for 24h
        },
      });
    }

    // Clone the response to add headers
    const response = NextResponse.next();

    // CORS headers for API
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Telegram-Init-Data");

    // Connection optimization
    response.headers.set("Connection", "keep-alive");
    response.headers.set("Keep-Alive", "timeout=30, max=100");

    // Retry hints for mobile networks
    response.headers.set("Retry-After", "1");

    return response;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MINIAPP ROUTES — Telegram WebView compatibility
  // ═══════════════════════════════════════════════════════════════════════════
  if (pathname.startsWith("/miniapp")) {
    const response = NextResponse.next();

    // Allow embedding in Telegram WebView
    // Don't set X-Frame-Options (deprecated), rely on CSP frame-ancestors
    
    // Optimize for mobile
    response.headers.set("Connection", "keep-alive");
    
    // Disable unnecessary security headers that can cause issues
    response.headers.delete("X-Frame-Options"); // Ensure it's not set
    
    // Preconnect hints for faster resource loading
    response.headers.append("Link", "<https://api.telegram.org>; rel=preconnect");
    response.headers.append("Link", "<https://fonts.googleapis.com>; rel=preconnect");
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match API routes
    "/api/:path*",
    // Match miniapp routes
    "/miniapp/:path*",
  ],
};

