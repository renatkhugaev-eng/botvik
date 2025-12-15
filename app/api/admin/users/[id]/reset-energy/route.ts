import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/auth";
import { checkRateLimit, adminLimiter, getClientIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Reset user's energy (delete today's quiz sessions to allow new attempts)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ═══ ADMIN AUTHENTICATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(adminLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const { id } = await params;
  const userId = Number(id);

  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  try {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First, find all sessions to delete
    const sessionsToDelete = await prisma.quizSession.findMany({
      where: {
        userId,
        startedAt: { gte: today },
      },
      select: { id: true },
    });

    const sessionIds = sessionsToDelete.map((s) => s.id);

    if (sessionIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Нет сессий для удаления. Энергия уже полная!",
        deletedCount: 0,
      });
    }

    // Delete in transaction: first answers, then sessions
    await prisma.$transaction(async (tx) => {
      // Delete all answers for these sessions
      await tx.answer.deleteMany({
        where: {
          sessionId: { in: sessionIds },
        },
      });

      // Now delete the sessions
      await tx.quizSession.deleteMany({
        where: {
          id: { in: sessionIds },
        },
      });
    });

    console.log(`[Admin] ${auth.user.telegramId} reset energy for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Удалено ${sessionIds.length} сессий. Энергия восстановлена!`,
      deletedCount: sessionIds.length,
    });
  } catch (error) {
    console.error("Failed to reset energy:", error);
    return NextResponse.json(
      { error: "Failed to reset energy", details: String(error) },
      { status: 500 }
    );
  }
}
