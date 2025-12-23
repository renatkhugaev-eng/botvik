/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL BY ID API — Получение, принятие, отклонение дуэли
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/duels/[id] — Получить дуэль по ID
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const userId = auth.user.id;

    const duel = await prisma.duel.findUnique({
      where: { id },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            xp: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            questions: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "DUEL_NOT_FOUND" }, { status: 404 });
    }

    // Проверяем что пользователь — участник
    if (duel.challengerId !== userId && duel.opponentId !== userId) {
      return NextResponse.json({ ok: false, error: "NOT_PARTICIPANT" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      duel: {
        ...duel,
        quiz: {
          ...duel.quiz,
          questionsCount: duel.quiz.questions.length,
          questions: undefined, // Не показываем вопросы до игры
        },
      },
    });
  } catch (error) {
    console.error("[Duel GET] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/duels/[id] — Принять/Отклонить/Отменить дуэль
// ═══════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const userId = auth.user.id;
    const body = await request.json();
    const { action } = body as { action?: "accept" | "decline" | "cancel" };

    if (!action || !["accept", "decline", "cancel"].includes(action)) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    }

    const duel = await prisma.duel.findUnique({
      where: { id },
    });

    if (!duel) {
      return NextResponse.json({ ok: false, error: "DUEL_NOT_FOUND" }, { status: 404 });
    }

    // Проверяем права
    if (action === "accept" || action === "decline") {
      // Только оппонент может принять/отклонить
      if (duel.opponentId !== userId) {
        return NextResponse.json({ ok: false, error: "NOT_OPPONENT" }, { status: 403 });
      }
    } else if (action === "cancel") {
      // Только создатель может отменить
      if (duel.challengerId !== userId) {
        return NextResponse.json({ ok: false, error: "NOT_CHALLENGER" }, { status: 403 });
      }
    }

    // Проверяем статус
    if (duel.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "INVALID_STATUS", currentStatus: duel.status },
        { status: 400 }
      );
    }

    // Проверяем не истекла ли
    if (new Date() > duel.expiresAt) {
      await prisma.duel.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ ok: false, error: "DUEL_EXPIRED" }, { status: 400 });
    }

    // Выполняем действие
    let newStatus: "ACCEPTED" | "DECLINED" | "CANCELLED";
    let roomId: string | null = null;

    if (action === "accept") {
      newStatus = "ACCEPTED";
      roomId = `duel:${id}`; // Room ID для Liveblocks
    } else if (action === "decline") {
      newStatus = "DECLINED";
    } else {
      newStatus = "CANCELLED";
    }

    const updatedDuel = await prisma.duel.update({
      where: { id },
      data: {
        status: newStatus,
        roomId,
        acceptedAt: action === "accept" ? new Date() : undefined,
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // TODO: Отправить push-уведомление создателю

    return NextResponse.json({
      ok: true,
      duel: updatedDuel,
      roomId,
    });
  } catch (error) {
    console.error("[Duel PATCH] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
