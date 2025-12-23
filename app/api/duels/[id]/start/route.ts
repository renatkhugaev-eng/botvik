/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL START API — Начало дуэли (загрузка вопросов)
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
// POST /api/duels/[id]/start — Получить данные для старта дуэли
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest, context: RouteContext) {
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
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: {
                answers: {
                  select: {
                    id: true,
                    text: true,
                    isCorrect: true,
                  },
                },
              },
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

    // Проверяем статус
    if (duel.status !== "ACCEPTED" && duel.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { ok: false, error: "DUEL_NOT_READY", status: duel.status },
        { status: 400 }
      );
    }

    // Подготавливаем вопросы (без правильных ответов для клиента)
    const questions = duel.quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      timeLimitSeconds: q.timeLimitSeconds || 15,
      options: q.answers.map((a) => ({
        id: a.id,
        text: a.text,
      })),
    }));

    // Правильные ответы (для Storage, будут раскрыты после ответа обоих)
    const correctAnswers: Record<number, number> = {};
    duel.quiz.questions.forEach((q, index) => {
      const correct = q.answers.find((a) => a.isCorrect);
      if (correct) {
        correctAnswers[index] = correct.id;
      }
    });

    // Игроки
    const players = [
      {
        odId: duel.challenger.id,
        odName: duel.challenger.firstName || duel.challenger.username || "Игрок 1",
        odPhotoUrl: duel.challenger.photoUrl,
      },
      {
        odId: duel.opponent.id,
        odName: duel.opponent.firstName || duel.opponent.username || "Игрок 2",
        odPhotoUrl: duel.opponent.photoUrl,
      },
    ];

    // Обновляем статус на IN_PROGRESS если ещё не обновлён
    if (duel.status === "ACCEPTED") {
      await prisma.duel.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      duelId: duel.id,
      roomId: duel.roomId || `duel:${duel.id}`,
      quizId: duel.quiz.id,
      quizTitle: duel.quiz.title,
      players,
      questions,
      correctAnswers, // Отправляем на клиент для Liveblocks Storage
    });
  } catch (error) {
    console.error("[Duel Start] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
