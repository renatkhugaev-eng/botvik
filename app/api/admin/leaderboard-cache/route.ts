/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN: Leaderboard Cache Management API
 * 
 * Provides cache statistics and manual invalidation for admins.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { 
  getLeaderboardCacheStats, 
  invalidateAllLeaderboardCaches,
  invalidateLeaderboardCache,
} from "@/lib/leaderboard-cache";
import { getWeekStart } from "@/lib/week";

export const runtime = "nodejs";

/**
 * GET /api/admin/leaderboard-cache
 * Get cache statistics
 */
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const stats = await getLeaderboardCacheStats();
  
  return NextResponse.json({
    ok: true,
    cache: {
      ...stats,
      globalAgeFormatted: stats.globalAge !== null 
        ? `${Math.floor(stats.globalAge / 1000)}s ago` 
        : null,
      weeklyAgeFormatted: stats.weeklyAge !== null 
        ? `${Math.floor(stats.weeklyAge / 1000)}s ago` 
        : null,
    },
  });
}

/**
 * POST /api/admin/leaderboard-cache
 * Invalidate cache(s)
 * 
 * Body:
 * - invalidateAll: boolean - Invalidate all caches
 * - quizId: number - Invalidate specific quiz cache
 * - invalidateGlobal: boolean - Invalidate global cache
 * - invalidateWeekly: boolean - Invalidate weekly cache
 */
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  let body: {
    invalidateAll?: boolean;
    quizId?: number;
    invalidateGlobal?: boolean;
    invalidateWeekly?: boolean;
  };
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.invalidateAll) {
    await invalidateAllLeaderboardCaches();
    return NextResponse.json({ 
      ok: true, 
      message: "All leaderboard caches invalidated",
    });
  }

  // Selective invalidation
  await invalidateLeaderboardCache({
    quizId: body.quizId,
    weekStart: body.invalidateWeekly ? getWeekStart() : undefined,
    invalidateGlobal: body.invalidateGlobal ?? false,
  });

  return NextResponse.json({ 
    ok: true, 
    message: "Selected caches invalidated",
    invalidated: {
      quizId: body.quizId ?? null,
      global: body.invalidateGlobal ?? false,
      weekly: body.invalidateWeekly ?? false,
    },
  });
}

