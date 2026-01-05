import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health Check Endpoint
 * 
 * Quick check: GET /api/health
 * Detailed check: GET /api/health?detailed=true
 */
export async function GET(request: NextRequest) {
  const detailed = request.nextUrl.searchParams.get("detailed") === "true";
  
  // Basic health (always fast)
  const response: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION || "unknown",
  };
  
  // Add Cloudflare/network info from headers
  const cfRay = request.headers.get("cf-ray");
  const cfCountry = request.headers.get("cf-ipcountry");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  
  response.network = {
    cloudflare: !!cfRay,
    cfRay: cfRay || null,
    country: cfCountry || null,
    clientIp: cfConnectingIp || request.headers.get("x-forwarded-for")?.split(",")[0] || null,
  };
  
  // Detailed checks (only if requested)
  if (detailed) {
    const checks: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};
    
    // Database check
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = { 
        ok: false, 
        latencyMs: Date.now() - dbStart, 
        error: err instanceof Error ? err.message : "Unknown error" 
      };
    }
    
    // Redis check (if configured)
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const redisStart = Date.now();
      try {
        const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        });
        checks.redis = { ok: res.ok, latencyMs: Date.now() - redisStart };
      } catch (err) {
        checks.redis = { 
          ok: false, 
          latencyMs: Date.now() - redisStart,
          error: err instanceof Error ? err.message : "Unknown error"
        };
      }
    }
    
    response.checks = checks;
    response.ok = Object.values(checks).every(c => c.ok);
  }
  
  return NextResponse.json(response, {
    status: response.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Response-Time": `${Date.now()}ms`,
    },
  });
}

