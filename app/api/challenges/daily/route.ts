/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DAILY CHALLENGES API
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * GET  /api/challenges/daily — Получить задания на сегодня с прогрессом
 * POST /api/challenges/daily — Получить награду за задание
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, generalLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { 
  getUserDailyChallenges, 
  claimChallengeReward, 
  claimDailyBonus 
} from "@/lib/daily-challenges";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/challenges/daily — Получить задания на сегодня
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const identifier = getClientIdentifier(request, auth.user.telegramId);
    const rateLimit = await checkRateLimit(generalLimiter, identifier);
    if (rateLimit.limited) {
      return rateLimit.response;
    }

    const data = await getUserDailyChallenges(auth.user.id);

    return NextResponse.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    console.error("[DailyChallenges] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/challenges/daily — Получить награду
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const identifier = getClientIdentifier(request, auth.user.telegramId);
    const rateLimit = await checkRateLimit(generalLimiter, identifier);
    if (rateLimit.limited) {
      return rateLimit.response;
    }

    const body = await request.json().catch(() => ({}));
    const { challengeId, claimBonus } = body as { 
      challengeId?: number; 
      claimBonus?: boolean;
    };

    let result;

    if (claimBonus) {
      // Получить бонус за все задания
      result = await claimDailyBonus(auth.user.id);
    } else if (challengeId) {
      // Получить награду за конкретное задание
      result = await claimChallengeReward(auth.user.id, challengeId);
    } else {
      return NextResponse.json(
        { ok: false, error: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    // Получаем обновлённые данные
    const updatedData = await getUserDailyChallenges(auth.user.id);

    return NextResponse.json({
      ok: true,
      xpEarned: result.xpEarned,
      energyEarned: result.energyEarned,
      bonusEarned: result.bonusEarned,
      ...updatedData,
    });
  } catch (error) {
    console.error("[DailyChallenges] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

