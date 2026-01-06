import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, leaderboardLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { getWeeklyLeaderboard } from "@/lib/leaderboard-cache";

export const runtime = "nodejs";

/**
 * GET /api/leaderboard/weekly
 * 
 * Unified scoring system: TotalScore = BestScore + ActivityBonus
 * 
 * Redis-cached for high performance:
 * - Leaderboard data: 30s TTL + 5min stale-while-revalidate
 * - User position: Always fresh (not cached)
 * 
 * Returns:
 * - Current week's leaderboard (top 50)
 * - Time remaining until week end
 * - Last week's winners (if any)
 * - User's current position
 */
export async function GET(req: NextRequest) {
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const rateLimit = await checkRateLimit(leaderboardLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const userIdParam = req.nextUrl.searchParams.get("userId");
  const parsedUserId = userIdParam ? Number(userIdParam) : NaN;
  const userId = Number.isNaN(parsedUserId) ? undefined : parsedUserId;

  // ═══ WEEKLY LEADERBOARD (Redis-cached) ═══
  const { data, myPosition, fromCache } = await getWeeklyLeaderboard(userId);

  return NextResponse.json({
    week: data.week,
    leaderboard: data.leaderboard,
    myPosition,
    totalParticipants: data.totalParticipants,
    lastWeekWinners: data.lastWeekWinners,
    scoringInfo: data.scoringInfo,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      "X-Cache": fromCache ? "HIT" : "MISS",
      ...(data.cachedAt && { "X-Cache-Age": String(Math.floor((Date.now() - data.cachedAt) / 1000)) }),
    },
  });
}
