import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Reset user's energy (delete today's quiz sessions to allow new attempts)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  try {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Delete all sessions started today for this user
    // This effectively resets their daily attempts
    const deleted = await prisma.quizSession.deleteMany({
      where: {
        userId,
        startedAt: { gte: today },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Удалено ${deleted.count} сессий. Энергия восстановлена.`,
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error("Failed to reset energy:", error);
    return NextResponse.json({ error: "Failed to reset energy" }, { status: 500 });
  }
}

