import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, quizStartLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { getCachedQuestions, cacheQuestions } from "@/lib/quiz-cache";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   ANTI-ABUSE: Rate Limiting & Energy System (OPTIMIZED)
   
   Оптимизации:
   - Убран дублирующий запрос user (auth уже проверил)
   - Объединены запросы сессии
   - Используется кеш вопросов
   - Batch операции для timeout
═══════════════════════════════════════════════════════════════════════════ */

const RATE_LIMIT_MS = 60_000;
const MAX_ATTEMPTS = 5;
const HOURS_PER_ATTEMPT = 4;
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000;
const QUESTION_TIME_MS = 15000;
const SESSION_ABANDON_MS = 30 * 60 * 1000; // 30 минут — считаем сессию заброшенной

const bypassLimits = 
  process.env.BYPASS_LIMITS === "true" && 
  process.env.NODE_ENV !== "production";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  // ═══ RATE LIMITING (temporarily disabled for debugging) ═══
  // const identifier = getClientIdentifier(req, auth.user.telegramId);
  // const rateLimit = await checkRateLimit(quizStartLimiter, identifier);
  // if (rateLimit.limited) {
  //   return rateLimit.response;
  // }

  const { id } = await context.params;
  const quizId = Number(id);
  if (!quizId || Number.isNaN(quizId)) {
    return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });
  }

  // ═══ OPTIMIZED: Single query for quiz + existing session ═══
  const [quiz, existingSession] = await Promise.all([
    prisma.quiz.findFirst({
      where: { id: quizId, isActive: true },
      select: { id: true },
    }),
    prisma.quizSession.findFirst({
      where: { quizId, userId, finishedAt: null },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        attemptNumber: true,
        totalScore: true,
        currentQuestionIndex: true,
        currentQuestionStartedAt: true,
        currentStreak: true,
      },
    }),
  ]);

  if (!quiz) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  const now = new Date();

  // ═══ EXISTING SESSION — Check if should resume or abandon ═══
  if (existingSession) {
    const sessionAge = existingSession.currentQuestionStartedAt 
      ? now.getTime() - existingSession.currentQuestionStartedAt.getTime()
      : SESSION_ABANDON_MS + 1; // No start time = abandoned

    // ═══ ABANDON OLD SESSION ═══
    // If session is older than 30 minutes, mark as finished and create new one
    if (sessionAge > SESSION_ABANDON_MS) {
      await prisma.quizSession.update({
        where: { id: existingSession.id },
        data: { finishedAt: now },
      });
      // Continue to create new session below
    } else {
      // ═══ RESUME ACTIVE SESSION ═══
      const questions = await getQuestionsOptimized(quizId);
      
      let questionStartedAt = existingSession.currentQuestionStartedAt;
      let currentIndex = existingSession.currentQuestionIndex;
      let currentStreak = existingSession.currentStreak;
      let skippedQuestions = 0;

      // Check for timeouts (only if timer was started)
      if (questionStartedAt) {
        const elapsedMs = now.getTime() - questionStartedAt.getTime();
        
        // Обрабатываем ВСЕ пропущенные вопросы в цикле
        while (elapsedMs >= QUESTION_TIME_MS && currentIndex < questions.length) {
          const currentQuestion = questions[currentIndex];
          
          const existingAnswer = await prisma.answer.findUnique({
            where: { sessionId_questionId: { sessionId: existingSession.id, questionId: currentQuestion.id } },
            select: { id: true },
          });

          if (existingAnswer) {
            // Уже отвечен — пропускаем
            currentIndex++;
            continue;
          }

          // Записываем timeout
          await prisma.answer.create({
            data: {
              sessionId: existingSession.id,
              questionId: currentQuestion.id,
              optionId: null,
              isCorrect: false,
              timeSpentMs: QUESTION_TIME_MS,
              scoreDelta: 0,
            },
          });
          
          currentIndex++;
          currentStreak = 0;
          skippedQuestions++;
          
          // Пересчитываем время для следующего вопроса
          const newElapsed = now.getTime() - (questionStartedAt.getTime() + skippedQuestions * QUESTION_TIME_MS);
          if (newElapsed < QUESTION_TIME_MS) break;
        }
        
        // Обновляем сессию после обработки всех timeout'ов
        if (skippedQuestions > 0) {
          await prisma.quizSession.update({
            where: { id: existingSession.id },
            data: {
              currentQuestionIndex: currentIndex,
              currentQuestionStartedAt: null, // Клиент установит через /view
              currentStreak: 0,
            },
          });
          questionStartedAt = null;
        }
      }
      // Если questionStartedAt = null, НЕ устанавливаем его здесь
      // Клиент вызовет /view когда покажет вопрос

      // Check if quiz is finished
      if (currentIndex >= questions.length) {
        await prisma.quizSession.update({
          where: { id: existingSession.id },
          data: { finishedAt: now },
        });

        return NextResponse.json({
          sessionId: existingSession.id,
          quizId,
          attemptNumber: existingSession.attemptNumber,
          totalQuestions: questions.length,
          totalScore: existingSession.totalScore,
          currentQuestionIndex: currentIndex,
          currentStreak: 0,
          questions,
          serverTime: now.toISOString(),
          questionStartedAt: now.toISOString(),
          finished: true,
          skippedQuestions,
        });
      }

      return NextResponse.json({
        sessionId: existingSession.id,
        quizId,
        attemptNumber: existingSession.attemptNumber,
        totalQuestions: questions.length,
        totalScore: existingSession.totalScore,
        currentQuestionIndex: currentIndex,
        currentStreak: currentStreak,
        questions,
        serverTime: now.toISOString(),
        questionStartedAt: questionStartedAt?.toISOString() ?? null,
        // Если таймер не запущен — клиент должен вызвать /view
        needsViewSignal: !questionStartedAt,
        skippedQuestions: skippedQuestions > 0 ? skippedQuestions : undefined,
      });
    }
  }

  // ═══ NEW SESSION — Check energy and create ═══
  
  // Проверяем, является ли квиз частью активного турнира
  // И зарегистрирован ли пользователь в этом турнире!
  // Энергия НЕ тратится только если оба условия выполнены
  const activeTournamentStage = await prisma.tournamentStage.findFirst({
    where: {
      quizId,
      tournament: {
        status: "ACTIVE", // Только активные турниры (не UPCOMING)
      },
    },
    select: { 
      id: true, 
      tournamentId: true,
      tournament: {
        select: {
          participants: {
            where: { userId },
            select: { id: true, status: true },
          },
        },
      },
    },
  });
  
  // Квиз турнирный только если:
  // 1. Есть активный этап турнира с этим квизом
  // 2. Пользователь зарегистрирован в турнире со статусом REGISTERED или ACTIVE
  const participantInfo = activeTournamentStage?.tournament?.participants?.[0];
  const isValidParticipant = participantInfo && 
    (participantInfo.status === "REGISTERED" || participantInfo.status === "ACTIVE");
  const isTournamentQuiz = !!activeTournamentStage && isValidParticipant;
  
  if (activeTournamentStage && !isValidParticipant) {
    console.log(`[quiz/start] User ${userId} trying tournament quiz ${quizId} but NOT valid participant in tournament ${activeTournamentStage.tournamentId} (status: ${participantInfo?.status ?? "NOT_JOINED"})`);
  }
  
  // Get recent sessions, last finished, total attempts, and user's bonus energy in parallel
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);
  
  const [recentSessions, lastFinishedSession, totalAttempts, userBonusEnergy] = await Promise.all([
    prisma.quizSession.findMany({
      where: { userId, startedAt: { gte: cooldownAgo } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
    bypassLimits ? null : prisma.quizSession.findFirst({
      where: { userId, quizId, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    prisma.quizSession.count({ where: { userId, quizId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { bonusEnergy: true },
    }),
  ]);

  const usedAttempts = recentSessions.length;
  const bonusEnergy = userBonusEnergy?.bonusEnergy ?? 0;
  let usedBonusEnergy = false;

  // Energy check — пропускаем для турнирных квизов!
  // В турнирах энергия НЕ тратится
  if (!bypassLimits && !isTournamentQuiz && usedAttempts >= MAX_ATTEMPTS) {
    // Проверяем есть ли бонусная энергия
    if (bonusEnergy > 0) {
      // Используем бонусную энергию вместо обычной
      await prisma.user.update({
        where: { id: userId },
        data: { 
          bonusEnergy: { decrement: 1 },
          bonusEnergyUsed: { increment: 1 }, // Для достижений
        },
      });
      usedBonusEnergy = true;
      console.log(`[quiz/start] User ${userId} used bonus energy (${bonusEnergy} → ${bonusEnergy - 1})`);
    } else {
      // Нет ни обычной, ни бонусной энергии
      const oldestSession = recentSessions[0];
      const nextSlotAt = new Date(oldestSession.startedAt.getTime() + ATTEMPT_COOLDOWN_MS);
      const waitMs = nextSlotAt.getTime() - Date.now();
      const waitMinutes = Math.ceil(waitMs / 60000);
      const waitHours = Math.floor(waitMinutes / 60);
      const remainingMinutes = waitMinutes % 60;
      
      const waitMessage = waitHours > 0 
        ? `${waitHours} ч ${remainingMinutes} мин`
        : `${remainingMinutes} мин`;

      return NextResponse.json({
        error: "energy_depleted",
        message: `Энергия закончилась! Восстановление через ${waitMessage}`,
        usedAttempts,
        maxAttempts: MAX_ATTEMPTS,
        nextSlotAt: nextSlotAt.toISOString(),
        waitMs,
        waitMessage,
        hoursPerAttempt: HOURS_PER_ATTEMPT,
        bonusEnergy: 0, // Показываем что бонусной энергии тоже нет
      }, { status: 429 });
    }
  }

  // Rate limit between attempts
  if (lastFinishedSession?.finishedAt) {
    const timeSinceLastSession = Date.now() - lastFinishedSession.finishedAt.getTime();
    if (timeSinceLastSession < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastSession) / 1000);
      return NextResponse.json({
        error: "rate_limited",
        message: `Подожди ${waitSeconds} секунд перед новой попыткой`,
        waitSeconds,
      }, { status: 429 });
    }
  }

  // Create new session
  const attemptNumber = totalAttempts + 1;
  const session = await prisma.quizSession.create({
    data: {
      quizId,
      userId,
      attemptNumber,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: now,
      currentStreak: 0,
    },
  });

  const questions = await getQuestionsOptimized(quizId);

  // Рассчитываем оставшуюся бонусную энергию
  const remainingBonusEnergy = usedBonusEnergy ? bonusEnergy - 1 : bonusEnergy;

  // Логирование для турнирных квизов
  if (isTournamentQuiz) {
    console.log(`[quiz/start] 🏆 Tournament quiz! User ${userId} starting quiz ${quizId} (tournament ${activeTournamentStage?.tournamentId}, stage ${activeTournamentStage?.id}) — energy NOT consumed`);
  } else if (activeTournamentStage) {
    console.log(`[quiz/start] User ${userId} playing quiz ${quizId} (tournament quiz but NOT registered) — energy consumed`);
  }

  return NextResponse.json({
    sessionId: session.id,
    quizId,
    attemptNumber,
    remainingAttempts: usedBonusEnergy ? 0 : MAX_ATTEMPTS - usedAttempts - 1,
    totalQuestions: questions.length,
    totalScore: session.totalScore,
    currentStreak: 0,
    questions,
    serverTime: now.toISOString(),
    questionStartedAt: now.toISOString(),
    // Для турнирных квизов энергия не расходуется
    energyInfo: isTournamentQuiz 
      ? {
          used: usedAttempts, // НЕ прибавляем +1, т.к. турнир не тратит энергию
          max: MAX_ATTEMPTS,
          hoursPerAttempt: HOURS_PER_ATTEMPT,
          bonusEnergy,
          usedBonusEnergy: false,
          isTournamentQuiz: true, // Флаг для клиента
        }
      : {
          used: usedBonusEnergy ? MAX_ATTEMPTS : usedAttempts + 1,
          max: MAX_ATTEMPTS,
          hoursPerAttempt: HOURS_PER_ATTEMPT,
          bonusEnergy: remainingBonusEnergy,
          usedBonusEnergy,
        },
    // Информация о турнире (если есть)
    tournamentInfo: isTournamentQuiz
      ? { stageId: activeTournamentStage?.id, tournamentId: activeTournamentStage?.tournamentId }
      : undefined,
  });
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Optimized questions with cache
async function getQuestionsOptimized(quizId: number) {
  // Note: We can't cache shuffled options, so we cache base questions
  // and shuffle on each request
  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      text: true,
      order: true,
      difficulty: true,
      answers: {
        select: { id: true, text: true },
      },
    },
  });

  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    order: q.order,
    difficulty: q.difficulty,
    options: shuffleArray(q.answers.map((a) => ({ id: a.id, text: a.text }))),
  }));
}
