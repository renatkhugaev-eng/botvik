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
                    // SECURITY: isCorrect НЕ запрашиваем — проверка на сервере
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

    // Проверяем не истекла ли дуэль
    if (new Date() > duel.expiresAt) {
      await prisma.duel.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { ok: false, error: "DUEL_EXPIRED" },
        { status: 400 }
      );
    }

    // Подготавливаем вопросы (без правильных ответов для клиента)
    // Для дуэлей используем фиксированные 15 секунд на вопрос
    const DUEL_TIME_LIMIT_SECONDS = 15;
    
    const questions = duel.quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      timeLimitSeconds: DUEL_TIME_LIMIT_SECONDS,
      options: q.answers.map((a) => ({
        id: a.id,
        text: a.text,
      })),
    }));

    // SECURITY: Правильные ответы НЕ отправляются на клиент
    // Проверка правильности происходит на сервере в /api/duels/[id]/answer

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

    // Атомарно обновляем статус на IN_PROGRESS (защита от race condition)
    if (duel.status === "ACCEPTED") {
      const updateResult = await prisma.duel.updateMany({
        where: { 
          id,
          status: "ACCEPTED", // Только если статус всё ещё ACCEPTED
        },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        console.log(`[Duel Start] Race condition detected for duel ${id}, status already changed`);
      }
    }

    // SECURITY: НЕ отправляем correctAnswers на клиент!
    // Правильные ответы проверяются на сервере в /api/duels/[id]/answer
    return NextResponse.json({
      ok: true,
      duelId: duel.id,
      roomId: duel.roomId || `duel:${duel.id}`,
      quizId: duel.quiz.id,
      quizTitle: duel.quiz.title,
      players,
      questions,
      totalQuestions: questions.length,
    });
  } catch (error) {
    console.error("[Duel Start] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
