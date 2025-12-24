/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN: RESET USER ENERGY
 * Deletes today's quiz sessions to restore user's energy
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/auth";
import { checkRateLimit, adminLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { auditLog } from "@/lib/audit-log";

export const runtime = "nodejs";

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
    // ═══ VERIFY USER EXISTS ═══
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, telegramId: true, username: true, firstName: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ═══ GET TODAY'S SESSIONS ═══
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessionsToDelete = await prisma.quizSession.findMany({
      where: {
        userId,
        startedAt: { gte: today },
      },
      select: { id: true, quizId: true, totalScore: true },
    });

    const sessionIds = sessionsToDelete.map((s) => s.id);

    if (sessionIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Нет сессий для удаления. Энергия уже полная!",
        deletedCount: 0,
      });
    }

    // ═══ DELETE IN TRANSACTION ═══
    await prisma.$transaction(async (tx) => {
      // Delete all answers for these sessions
      await tx.answer.deleteMany({
        where: {
          sessionId: { in: sessionIds },
        },
      });

      // Delete the sessions
      await tx.quizSession.deleteMany({
        where: {
          id: { in: sessionIds },
        },
      });
    });

    // ═══ AUDIT LOG ═══
    await auditLog({
      action: "user.reset_energy",
      adminId: auth.user.id,
      adminTelegramId: auth.user.telegramId,
      targetType: "user",
      targetId: userId.toString(),
      details: {
        targetUser: {
          id: targetUser.id,
          telegramId: targetUser.telegramId,
          username: targetUser.username,
          firstName: targetUser.firstName,
        },
        deletedSessions: sessionsToDelete.map(s => ({
          id: s.id,
          quizId: s.quizId,
          totalScore: s.totalScore,
        })),
        deletedCount: sessionIds.length,
      },
    });

    console.log(
      `[Admin] ${auth.user.telegramId} reset energy for user ${userId} ` +
      `(${sessionIds.length} sessions deleted)`
    );

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
