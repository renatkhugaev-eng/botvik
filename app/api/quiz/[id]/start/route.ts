import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, quizStartLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { getCachedQuestions, cacheQuestions } from "@/lib/quiz-cache";
import { scheduleEnergyNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Child logger with route context
const log = logger.child({ route: "quiz/start" });

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
  log.debug("New request");
  
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;
  log.debug("Authenticated", { userId });

  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(quizStartLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

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
  console.log(`[quiz/start] 📝 Creating NEW SESSION for quiz ${quizId}, user ${userId}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT QUIZ DETECTION (with race condition handling)
  // 
  // ВАЖНО: Принимаем и ACTIVE и FINISHED турниры!
  // Причина: CRON может финализировать турнир ПОКА пользователь проходит квиз.
  // Для FINISHED турниров проверяем что сессия начинается ДО окончания турнира.
  // 
  // Энергия НЕ тратится если:
  // 1. Квиз является частью турнира (ACTIVE или недавно FINISHED)
  // 2. Пользователь зарегистрирован в турнире (REGISTERED, ACTIVE или FINISHED)
  // 3. Для FINISHED турниров: текущее время < endsAt (турнир только что закончился)
  // 4. Предыдущие этапы пройдены с passed: true
  // ═══════════════════════════════════════════════════════════════════════════
  
  const activeTournamentStage = await prisma.tournamentStage.findFirst({
    where: {
      quizId,
      tournament: {
        // Принимаем ACTIVE и FINISHED турниры (race condition handling)
        status: { in: ["ACTIVE", "FINISHED"] },
      },
    },
    select: { 
      id: true, 
      order: true,
      tournamentId: true,
      tournament: {
        select: {
          id: true,
          status: true,
          endsAt: true,
          participants: {
            where: { userId },
            select: { id: true, status: true, currentStage: true },
          },
          // Нужно для проверки предыдущих этапов
          stages: {
            orderBy: { order: "asc" },
            select: { id: true, order: true, title: true },
          },
        },
      },
    },
  });
  
  // Начинаем проверку условий для турнирного квиза
  let isTournamentQuiz = false;
  let tournamentDebugInfo: Record<string, unknown> = {};
  
  console.log(`[quiz/start] 🔍 Tournament stage query result:`, activeTournamentStage ? {
    stageId: activeTournamentStage.id,
    stageOrder: activeTournamentStage.order,
    tournamentId: activeTournamentStage.tournamentId,
    tournamentStatus: activeTournamentStage.tournament?.status,
    participantCount: activeTournamentStage.tournament?.participants?.length ?? 0,
  } : "NO STAGE FOUND");
  
  if (activeTournamentStage) {
    const tournament = activeTournamentStage.tournament;
    const participantInfo = tournament.participants?.[0];
    
    // Условие 1: Пользователь участник турнира
    // Принимаем REGISTERED, ACTIVE и FINISHED (статус меняется при финализации)
    const isValidParticipant = participantInfo && 
      ["REGISTERED", "ACTIVE", "FINISHED"].includes(participantInfo.status);
    
    // Условие 2: Для FINISHED турниров — только если ещё не прошло время
    // Это даёт grace period для тех, кто начал играть до финализации
    const isWithinTimeWindow = tournament.status === "ACTIVE" || 
      (tournament.status === "FINISHED" && tournament.endsAt && now <= tournament.endsAt);
    
    // Условие 3: Предыдущие этапы ЗАВЕРШЕНЫ (для этапов > 1)
    // ВАЖНО: Не требуем passed=true строго — достаточно что этап был завершён
    // Это нужно для backwards compatibility и для случаев когда passed не был установлен
    let previousStagesPassed = true;
    
    if (activeTournamentStage.order > 1 && isValidParticipant) {
      const previousStages = tournament.stages.filter(s => s.order < activeTournamentStage.order);
      
      if (previousStages.length > 0) {
        // Находим ВСЕ результаты предыдущих этапов (независимо от passed)
        const previousResults = await prisma.tournamentStageResult.findMany({
          where: {
            userId,
            stageId: { in: previousStages.map(s => s.id) },
            completedAt: { not: null }, // Только завершённые
          },
          select: { stageId: true, passed: true, rank: true, score: true },
        });
        
        const completedStageIds = new Set(previousResults.map(r => r.stageId));
        previousStagesPassed = previousStages.every(s => completedStageIds.has(s.id));
        
        if (!previousStagesPassed) {
          const missingStages = previousStages.filter(s => !completedStageIds.has(s.id));
          console.log(
            `[quiz/start] ⚠️ User ${userId} hasn't COMPLETED previous stages for stage ${activeTournamentStage.order}. ` +
            `Missing: ${missingStages.map(s => `${s.order}. ${s.title}`).join(", ")}. ` +
            `Completed results: ${JSON.stringify(previousResults)}`
          );
        } else {
          // Все этапы завершены - логируем для диагностики
          console.log(
            `[quiz/start] ✅ User ${userId} completed all previous stages: ${JSON.stringify(previousResults)}`
          );
        }
      }
    }
    
    // Финальное решение
    isTournamentQuiz = isValidParticipant && isWithinTimeWindow && previousStagesPassed;
    
    // Debug info для логирования
    tournamentDebugInfo = {
      tournamentId: tournament.id,
      tournamentStatus: tournament.status,
      stageId: activeTournamentStage.id,
      stageOrder: activeTournamentStage.order,
      participantStatus: participantInfo?.status ?? "NOT_JOINED",
      isValidParticipant,
      isWithinTimeWindow,
      previousStagesPassed,
      currentStage: participantInfo?.currentStage,
      endsAt: tournament.endsAt?.toISOString(),
    };
    
    // Детальное логирование
    if (!isTournamentQuiz) {
      console.log(
        `[quiz/start] ❌ Quiz ${quizId} NOT counted as tournament quiz for user ${userId}:`,
        JSON.stringify(tournamentDebugInfo, null, 2)
      );
    }
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
  console.log(`[quiz/start] ⚡ Energy check: isTournamentQuiz=${isTournamentQuiz}, usedAttempts=${usedAttempts}/${MAX_ATTEMPTS}, bypassLimits=${bypassLimits}`);
  
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

  // ═══ SCHEDULE ENERGY NOTIFICATION ═══
  // Если пользователь потратил энергию (не турнирный квиз), планируем уведомление
  if (!isTournamentQuiz && !bypassLimits) {
    // После создания сессии, текущая сессия = самая новая
    // Уведомление придёт когда ВСЯ энергия восстановится (последняя сессия истечёт)
    const newestSessionStartedAt = now; // Только что созданная сессия
    
    // Планируем уведомление на время полного восстановления энергии
    scheduleEnergyNotification(userId, newestSessionStartedAt)
      .catch(err => console.error("[quiz/start] Failed to schedule energy notification:", err));
  }

  // Логирование для турнирных квизов
  if (isTournamentQuiz) {
    console.log(
      `[quiz/start] 🏆 Tournament quiz! User ${userId} starting quiz ${quizId} ` +
      `(tournament ${activeTournamentStage?.tournamentId}, stage ${activeTournamentStage?.order}/${activeTournamentStage?.tournament?.stages?.length ?? "?"}) ` +
      `— energy NOT consumed. Debug:`, JSON.stringify(tournamentDebugInfo)
    );
  } else if (activeTournamentStage) {
    console.log(
      `[quiz/start] ⚠️ User ${userId} playing quiz ${quizId} as REGULAR quiz ` +
      `(tournament exists but conditions not met) — energy consumed. Debug:`, JSON.stringify(tournamentDebugInfo)
    );
  }

  // ═══ PROFILE 2.0: Update "currently playing" status ═══
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentQuizId: quizId,
        currentSessionStart: now,
        status: "PLAYING",
        lastSeenAt: now,
      },
    });
  } catch {
    // Non-critical, don't fail the request
    log.warn("Failed to update playing status", { userId, quizId });
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
    tournamentInfo: isTournamentQuiz && activeTournamentStage
      ? { 
          stageId: activeTournamentStage.id, 
          stageOrder: activeTournamentStage.order,
          totalStages: activeTournamentStage.tournament?.stages?.length ?? 0,
          tournamentId: activeTournamentStage.tournamentId,
          tournamentStatus: activeTournamentStage.tournament?.status,
        }
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
