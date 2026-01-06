/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL START API — Начало дуэли (загрузка вопросов)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Поддерживает дуэли с AI:
 * - Автоматически определяет если оппонент — AI-бот
 * - Запускает AI-воркер для асинхронных ответов
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { levelFromXp } from "@/lib/xp";
import { seededShuffle } from "@/lib/seeded-shuffle";
import {
  runAIWorker,
  getDifficultyForPlayer,
  type QuestionWithAnswers,
} from "@/lib/ai-duel-bot";

export const runtime = "nodejs";
// Увеличиваем timeout для AI worker (60 секунд)
export const maxDuration = 60;

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
            isBot: true, // Для определения AI-противника
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
                    isCorrect: true, // Нужно для AI-воркера
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
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ANTI-CHEAT: Рандомизация порядка вопросов и вариантов ответа
    // Используем duelId как seed для детерминированного shuffle
    // Это предотвращает запоминание ответов при реванше
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Shuffle вопросов и вариантов ответа
    const shuffledQuestions = seededShuffle(duel.quiz.questions, id);
    
    // SECURITY: Убираем isCorrect из ответа клиенту
    const questions = shuffledQuestions.map((q, qIndex) => ({
      id: q.id,
      text: q.text,
      timeLimitSeconds: DUEL_TIME_LIMIT_SECONDS,
      // Shuffle вариантов ответа тоже (разный seed для каждого вопроса)
      options: seededShuffle(q.answers, id + "-q" + qIndex).map((a) => ({
        id: a.id,
        text: a.text,
        // isCorrect НЕ отправляется клиенту!
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

    // ═══════════════════════════════════════════════════════════════════════════
    // AI OPPONENT — Запускаем AI-воркер если оппонент бот
    // ═══════════════════════════════════════════════════════════════════════════
    const isOpponentAI = duel.opponent.isBot === true;
    
    // Проверяем не запущен ли уже AI worker (есть ответы от бота)
    let aiAlreadyStarted = false;
    if (isOpponentAI) {
      const existingAIAnswers = await prisma.duelAnswer.findFirst({
        where: {
          duelId: id,
          userId: duel.opponent.id,
        },
        select: { id: true },
      });
      aiAlreadyStarted = !!existingAIAnswers;
    }
    
    if (isOpponentAI && !aiAlreadyStarted) {
      console.log(`[Duel Start] Opponent is AI bot (id=${duel.opponent.id}), starting AI worker`);
      
      // Получаем сложность на основе уровня игрока
      const playerXp = duel.challenger.id === userId 
        ? duel.challenger.xp 
        : duel.opponent.xp;
      const playerLevel = levelFromXp(playerXp ?? 0);
      const aiDifficulty = getDifficultyForPlayer(playerLevel);
      
      // Подготавливаем вопросы с правильными ответами для AI
      // ВАЖНО: используем те же shuffled вопросы что и для игрока!
      const questionsForAI: QuestionWithAnswers[] = shuffledQuestions.map((q, qIndex) => ({
        id: q.id,
        text: q.text,
        order: qIndex, // Новый порядок после shuffle
        timeLimitSeconds: DUEL_TIME_LIMIT_SECONDS,
        answers: seededShuffle(q.answers, id + "-q" + qIndex).map((a) => ({
          id: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      }));
      
      // Определяем ID реального игрока (не бота)
      const humanUserId = duel.challenger.id;
      
      // Запускаем AI-воркер в background через after()
      // after() гарантирует что код выполнится после отправки ответа клиенту
      // и функция не "умрёт" до завершения AI worker
      after(async () => {
        try {
          console.log(`[Duel Start] AI Worker starting in background for duel ${id}`);
          await runAIWorker({
            duelId: id,
            botUserId: duel.opponent.id,
            humanUserId: humanUserId,
            difficulty: aiDifficulty,
            questions: questionsForAI,
            questionTimeLimitSeconds: DUEL_TIME_LIMIT_SECONDS,
          });
          console.log(`[Duel Start] AI Worker completed for duel ${id}`);
        } catch (err) {
          console.error(`[Duel Start] AI Worker error for duel ${id}:`, err);
        }
      });
    } else if (isOpponentAI && aiAlreadyStarted) {
      console.log(`[Duel Start] AI Worker already started for duel ${id}, skipping`);
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
      // Флаг для внутреннего использования (не показывается пользователю)
      _internal: isOpponentAI ? { aiMode: true, opponentId: duel.opponent.id } : undefined,
    });
  } catch (error) {
    console.error("[Duel Start] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
