/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN: Quiz Cache Management API
 * 
 * Provides cache statistics and manual invalidation for admins.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { 
  getQuizCacheStats, 
  invalidateAllQuizCaches,
  invalidateQuizCache,
  invalidateTournamentCache,
} from "@/lib/quiz-edge-cache";

export const runtime = "nodejs";

/**
 * GET /api/admin/quiz-cache
 * Get cache statistics
 */
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const stats = await getQuizCacheStats();
  
  return NextResponse.json({
    ok: true,
    cache: stats,
  });
}

/**
 * POST /api/admin/quiz-cache
 * Invalidate cache(s)
 * 
 * Body:
 * - invalidateAll: boolean - Invalidate all quiz caches
 * - quizId: number - Invalidate specific quiz cache
 * - invalidateTournament: boolean - Invalidate tournament-related caches
 */
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  let body: {
    invalidateAll?: boolean;
    quizId?: number;
    invalidateTournament?: boolean;
  };
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.invalidateAll) {
    await invalidateAllQuizCaches();
    return NextResponse.json({ 
      ok: true, 
      message: "All quiz caches invalidated",
    });
  }

  if (body.quizId) {
    await invalidateQuizCache(body.quizId);
    return NextResponse.json({ 
      ok: true, 
      message: `Quiz ${body.quizId} cache invalidated`,
    });
  }

  if (body.invalidateTournament) {
    await invalidateTournamentCache();
    return NextResponse.json({ 
      ok: true, 
      message: "Tournament cache invalidated",
    });
  }

  return NextResponse.json({ 
    error: "No invalidation action specified",
  }, { status: 400 });
}

