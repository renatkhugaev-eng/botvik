/**
 * ══════════════════════════════════════════════════════════════════════════════
 * USE DUEL ROOM — Professional Real-time Duel Hook with Liveblocks
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Полноценная реализация real-time дуэли:
 * - Синхронизация состояния через Liveblocks Presence
 * - Серверная валидация ответов
 * - Обработка отключений и reconnection
 * - Timeout для неактивных игроков
 * - Координированный старт игры
 *
 * SECURITY:
 * - Правильные ответы приходят ТОЛЬКО от сервера после ответа
 * - Очки вычисляются на сервере из DuelAnswer
 * - Клиент не может подделать результат
 *
 * ARCHITECTURE:
 * - Используем refs для функций с циклическими зависимостями
 * - Это предотвращает stale closures и позволяет избежать ошибок TS2448
 */

"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  useRoom,
  useMyPresence,
  useOthers,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  useLostConnectionListener,
  DuelPresence,
  DuelRoomEvent,
} from "@/liveblocks.config";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type DuelStatus =
  | "connecting"      // Подключение к комнате
  | "waiting_opponent" // Ожидание подключения оппонента
  | "waiting_ready"   // Оба в комнате, ждём нажатия "Готов"
  | "countdown"       // Обратный отсчёт перед стартом
  | "playing"         // Идёт вопрос
  | "revealing"       // Показ правильного ответа
  | "finished"        // Игра завершена
  | "opponent_left"   // Оппонент отключился
  | "error";          // Ошибка

export type DuelGameState = {
  status: DuelStatus;
  currentQuestionIndex: number;
  timeLeft: number;
  myScore: number;
  opponentScore: number;
  winnerId: number | null;
  error: string | null;
};

export type DuelQuestion = {
  id: number;
  text: string;
  options: { id: number; text: string }[];
  timeLimitSeconds: number;
};

export type DuelPlayer = {
  odId: number;
  odName: string;
  odPhotoUrl: string | null;
};

type AnswerResult = {
  questionIndex: number;
  isCorrect: boolean;
  optionId: number | null;
  correctOptionId: number | null;
  timeSpentMs: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════════════════════

const COUNTDOWN_SECONDS = 3;
const REVEAL_DURATION_MS = 2500;
const LOBBY_OPPONENT_DELAY_MS = 2000;
const RECONNECT_GRACE_PERIOD_MS = 10000;
const DEV_MODE_OPPONENT_DELAY_MS = 2000; // Время до автоматической симуляции оппонента в dev

// Проверяем dev-режим
function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useDuelRoom(duelId: string, userId: number, userName: string, userPhoto: string | null) {
  const room = useRoom();
  const connectionStatus = useStatus();
  const [myPresence, updateMyPresence] = useMyPresence();
  const others = useOthers();
  const broadcast = useBroadcastEvent();

  // ═══ Состояние игры ═══
  const [gameState, setGameState] = useState<DuelGameState>({
    status: "connecting",
    currentQuestionIndex: 0,
    timeLeft: 0,
    myScore: 0,
    opponentScore: 0,
    winnerId: null,
    error: null,
  });

  // ═══ Данные игры ═══
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [players, setPlayers] = useState<DuelPlayer[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, number>>({});
  const [myAnswers, setMyAnswers] = useState<Record<number, number | null>>({});
  const [pendingCorrectAnswers, setPendingCorrectAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // ═══ Dev-mode / AI симуляция оппонента ═══
  const [devModeOpponent, setDevModeOpponent] = useState<DuelPresence | null>(null);
  const devModeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ═══ AI Mode — когда оппонент AI-бот ═══
  const [isAIMode, setIsAIMode] = useState(false);
  const aiPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ═══ Refs для таймеров ═══
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const opponentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectGraceRef = useRef<NodeJS.Timeout | null>(null);
  const finishingRef = useRef(false);

  // ═══ Refs для функций (решение циклических зависимостей) ═══
  const startQuestionRef = useRef<(index: number) => void>(() => {});
  const handleTimeUpRef = useRef<(questionIndex: number) => Promise<void>>(async () => {});
  const triggerRevealRef = useRef<(questionIndex: number, correctOptionId: number) => void>(() => {});
  const handleRevealRef = useRef<(questionIndex: number, correctOptionId: number) => void>(() => {});
  const finishGameRef = useRef<() => Promise<void>>(async () => {});

  // ═══ Оппонент из Liveblocks (или симуляция в dev-режиме) ═══
  const realOpponent = useMemo(() => {
    const otherUser = others.find(
      (other) => (other.presence as DuelPresence)?.odId !== userId
    );
    return otherUser?.presence as DuelPresence | undefined;
  }, [others, userId]);

  // В dev-режиме используем симулированного оппонента если реального нет
  const opponent = realOpponent || devModeOpponent;
  const isOpponentConnected = !!opponent;
  const isOpponentReady = opponent?.isReady ?? false;
  const isOpponentAnswered = opponent?.hasAnswered ?? false;
  const isDevModeSimulation = isDevMode() && !realOpponent && !!devModeOpponent;

  // ═══════════════════════════════════════════════════════════════════════════
  // ИГРОВЫЕ ФУНКЦИИ (с использованием refs для циклических зависимостей)
  // ═══════════════════════════════════════════════════════════════════════════

  // handleGameEnd — нет циклических зависимостей
  const handleGameEnd = useCallback((winnerId: number | null, scores: Record<number, number>) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const myScore = scores[userId] ?? 0;
    const opponentId = Object.keys(scores).find((id) => Number(id) !== userId);
    const oppScore = opponentId ? scores[Number(opponentId)] : 0;

    setGameState((prev) => ({
      ...prev,
      status: "finished",
      winnerId,
      myScore,
      opponentScore: oppScore,
    }));
  }, [userId]);

  // handleForfeit — нет циклических зависимостей
  const handleForfeit = useCallback((forfeitedBy: number, winnerId: number, scores: Record<number, number>) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const isForfeitedByMe = forfeitedBy === userId;
    const myScore = scores[userId] ?? 0;
    const opponentId = Object.keys(scores).find((id) => Number(id) !== userId);
    const oppScore = opponentId ? scores[Number(opponentId)] : 0;

    setGameState((prev) => ({
      ...prev,
      status: "finished",
      winnerId,
      myScore: isForfeitedByMe ? 0 : myScore,
      opponentScore: isForfeitedByMe ? oppScore : 0,
      error: isForfeitedByMe ? null : "Соперник сдался",
    }));
  }, [userId]);

  // finishGame — использует handleGameEnd, broadcast
  const finishGame = useCallback(async () => {
    if (finishingRef.current) {
      console.log("[Duel] finishGame already in progress, skipping");
      return;
    }
    finishingRef.current = true;

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Duel] Finishing game, attempt ${attempt}/${MAX_RETRIES}`);
        
        const result = await api.post<{
          ok: boolean;
          error?: string;
          alreadyFinished?: boolean;
          duel: {
            winnerId: number | null;
            challengerScore: number;
            opponentScore: number;
            challengerId: number;
            opponentId: number;
          };
        }>(`/api/duels/${duelId}/finish`, {});

        if (result.ok) {
          const scores = {
            [result.duel.challengerId]: result.duel.challengerScore,
            [result.duel.opponentId]: result.duel.opponentScore,
          };

          if (!result.alreadyFinished) {
            broadcast({
              type: "GAME_END",
              winnerId: result.duel.winnerId,
              scores,
            });
          }

          handleGameEnd(result.duel.winnerId, scores);
          return; // Success — exit
        }

        // Если GAME_NOT_COMPLETE — подождём и попробуем снова
        if (result.error === "GAME_NOT_COMPLETE" && attempt < MAX_RETRIES) {
          console.log(`[Duel] Game not complete yet, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

        // Другие ошибки — fallback к локальному завершению
        console.error(`[Duel] Finish failed with error: ${result.error}`);
        break;

      } catch (error) {
        console.error(`[Duel] Failed to finish game (attempt ${attempt}):`, error);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        break;
      }
    }

    // Fallback: если все попытки провалились, завершаем локально с текущими очками
    console.log("[Duel] All finish attempts failed, ending game locally");
    finishingRef.current = false;
    
    // Подсчитываем локальные очки как fallback
    const myCorrectAnswers = Object.entries(myAnswers).filter(([idx, optId]) => {
      const correctId = revealedAnswers[Number(idx)];
      return correctId !== undefined && optId === correctId;
    }).length;
    
    const localMyScore = myCorrectAnswers * 100;
    
    setGameState((prev) => ({
      ...prev,
      status: "finished",
      myScore: localMyScore,
      error: "Результаты сохранены локально",
    }));
  }, [duelId, broadcast, handleGameEnd, myAnswers, revealedAnswers]);

  // Обновляем ref
  useEffect(() => {
    finishGameRef.current = finishGame;
  }, [finishGame]);

  // handleReveal — использует refs для startQuestion и finishGame
  const handleReveal = useCallback((questionIndex: number, correctOptionId: number) => {
    setRevealedAnswers((prev) => {
      // Защита от двойного reveal
      if (prev[questionIndex] !== undefined) {
        console.log(`[Duel] Reveal for Q${questionIndex} already processed, skipping`);
        return prev;
      }

      if (timerRef.current) clearInterval(timerRef.current);

      // Обновляем очки
      const myAnswer = myAnswers[questionIndex];
      const isCorrect = myAnswer === correctOptionId;

      setGameState((prevState) => ({
        ...prevState,
        status: "revealing",
        myScore: isCorrect ? prevState.myScore + 100 : prevState.myScore,
      }));

      // Переход к следующему вопросу или финиш
      setTimeout(() => {
        const nextIndex = questionIndex + 1;

        if (nextIndex >= questions.length) {
          finishGameRef.current();
        } else {
          broadcast({ type: "QUESTION_REVEAL", questionIndex: nextIndex });
          startQuestionRef.current(nextIndex);
        }
      }, REVEAL_DURATION_MS);

      return { ...prev, [questionIndex]: correctOptionId };
    });
  }, [myAnswers, questions.length, broadcast]);

  // Обновляем ref
  useEffect(() => {
    handleRevealRef.current = handleReveal;
  }, [handleReveal]);

  // triggerReveal — использует handleReveal через ref
  const triggerReveal = useCallback((questionIndex: number, correctOptionId: number) => {
    broadcast({
      type: "ANSWER_REVEAL",
      questionIndex,
      correctOptionId,
    });
    handleRevealRef.current(questionIndex, correctOptionId);
  }, [broadcast]);

  // Обновляем ref
  useEffect(() => {
    triggerRevealRef.current = triggerReveal;
  }, [triggerReveal]);

  // handleTimeUp — использует triggerReveal через ref
  const handleTimeUp = useCallback(async (questionIndex: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Идемпотентность
    const alreadyAnswered = myAnswers[questionIndex] !== undefined;
    const alreadyRevealed = revealedAnswers[questionIndex] !== undefined;

    if (alreadyAnswered) {
      console.log(`[Duel] TIME_UP for Q${questionIndex} but already answered, skipping`);
      return;
    }

    if (alreadyRevealed) {
      console.log(`[Duel] TIME_UP for Q${questionIndex} but already revealed, skipping`);
      return;
    }

    setMyAnswers((prev) => ({ ...prev, [questionIndex]: null }));

    const question = questions[questionIndex];
    if (question) {
      try {
        const response = await api.post<{ ok: boolean; answer: AnswerResult }>(
          `/api/duels/${duelId}/answer`,
          {
            questionIndex,
            optionId: null,
            timeSpentMs: question.timeLimitSeconds * 1000,
          }
        );

        if (response.ok && response.answer.correctOptionId !== null) {
          triggerRevealRef.current(questionIndex, response.answer.correctOptionId);
        }
      } catch (error) {
        console.error("[Duel] Failed to submit timeout:", error);
      }
    }
  }, [myAnswers, questions, duelId, revealedAnswers]);

  // Обновляем ref
  useEffect(() => {
    handleTimeUpRef.current = handleTimeUp;
  }, [handleTimeUp]);

  // startQuestion — использует handleTimeUp через ref
  const startQuestion = useCallback((index: number) => {
    const question = questions[index];
    if (!question) return;

    if (timerRef.current) clearInterval(timerRef.current);

    setGameState((prev) => ({
      ...prev,
      status: "playing",
      currentQuestionIndex: index,
      timeLeft: question.timeLimitSeconds,
    }));

    updateMyPresence({
      currentQuestion: index,
      hasAnswered: false,
    });

    let timeLeft = question.timeLimitSeconds;
    timerRef.current = setInterval(() => {
      timeLeft--;
      setGameState((prev) => ({ ...prev, timeLeft: Math.max(0, timeLeft) }));

      if (timeLeft <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        broadcast({ type: "TIME_UP", questionIndex: index });
        handleTimeUpRef.current(index);
      }
    }, 1000);
  }, [questions, updateMyPresence, broadcast]);

  // Обновляем ref
  useEffect(() => {
    startQuestionRef.current = startQuestion;
  }, [startQuestion]);

  // startCountdown — использует startQuestion через ref
  const startCountdown = useCallback(() => {
    setGameState((prev) => ({ ...prev, status: "countdown", timeLeft: COUNTDOWN_SECONDS }));

    let count = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      count--;
      setGameState((prev) => ({ ...prev, timeLeft: count }));

      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        broadcast({ type: "QUESTION_REVEAL", questionIndex: 0 });
        startQuestionRef.current(0);
      }
    }, 1000);
  }, [broadcast]);

  // checkBothAnswered — использует triggerReveal через ref
  const checkBothAnswered = useCallback(() => {
    const questionIndex = gameState.currentQuestionIndex;
    const myAnswer = myAnswers[questionIndex];

    if (revealedAnswers[questionIndex] !== undefined) {
      return;
    }

    if (myAnswer !== undefined && isOpponentAnswered) {
      const correctOptionId = pendingCorrectAnswers[questionIndex];
      if (correctOptionId !== undefined) {
        console.log(`[Duel] Both answered Q${questionIndex}, triggering reveal`);
        triggerRevealRef.current(questionIndex, correctOptionId);
      }
    }
  }, [gameState.currentQuestionIndex, myAnswers, isOpponentAnswered, revealedAnswers, pendingCorrectAnswers]);

  // submitAnswer — использует triggerReveal через ref
  const submitAnswer = useCallback(async (optionId: number): Promise<AnswerResult | null> => {
    if (isSubmitting || gameState.status !== "playing") return null;

    const questionIndex = gameState.currentQuestionIndex;
    const question = questions[questionIndex];
    if (!question) return null;

    setIsSubmitting(true);
    setMyAnswers((prev) => ({ ...prev, [questionIndex]: optionId }));
    updateMyPresence({ hasAnswered: true });

    broadcast({
      type: "PLAYER_ANSWERED",
      odId: userId,
      questionIndex,
    });

    const timeSpentMs = (question.timeLimitSeconds - gameState.timeLeft) * 1000;

    try {
      const response = await api.post<{
        ok: boolean;
        answer: AnswerResult;
      }>(`/api/duels/${duelId}/answer`, {
        questionIndex,
        optionId,
        timeSpentMs,
      });

      setIsSubmitting(false);

      if (response.ok && response.answer.correctOptionId !== null) {
        setPendingCorrectAnswers((prev) => ({
          ...prev,
          [questionIndex]: response.answer.correctOptionId!,
        }));

        if (isOpponentAnswered) {
          triggerRevealRef.current(questionIndex, response.answer.correctOptionId!);
        }
        return response.answer;
      }
    } catch (error) {
      console.error("[Duel] Failed to submit answer:", error);
      setIsSubmitting(false);
    }

    return null;
  }, [isSubmitting, gameState, questions, updateMyPresence, broadcast, userId, duelId, isOpponentAnswered]);

  // setReady — использует startCountdown
  const setReady = useCallback(() => {
    updateMyPresence({ isReady: true });

    if (isOpponentReady) {
      broadcast({ type: "GAME_START", startsAt: Date.now() + COUNTDOWN_SECONDS * 1000 });
      startCountdown();
    }
  }, [updateMyPresence, isOpponentReady, broadcast, startCountdown]);

  // forfeit
  const forfeit = useCallback(async () => {
    if (finishingRef.current) {
      console.log("[Duel] Already finishing, skipping forfeit");
      return;
    }
    finishingRef.current = true;

    try {
      const result = await api.post<{
        ok: boolean;
        winnerId: number;
        scores: { challengerScore: number; opponentScore: number };
        duel: { challengerId: number; opponentId: number };
      }>(`/api/duels/${duelId}/forfeit`, {});

      if (result.ok) {
        const scores = {
          [result.duel.challengerId]: result.scores.challengerScore,
          [result.duel.opponentId]: result.scores.opponentScore,
        };

        broadcast({
          type: "PLAYER_FORFEIT",
          odId: userId,
          winnerId: result.winnerId,
          scores,
        });

        handleForfeit(userId, result.winnerId, scores);
      }
    } catch (error) {
      console.error("[Duel] Failed to forfeit:", error);
      finishingRef.current = false;
    }
  }, [duelId, userId, broadcast, handleForfeit]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    console.log(`[Duel] Connection status: ${connectionStatus}, dataLoaded: ${dataLoaded}`);
    
    if (connectionStatus !== "connected") {
      console.log("[Duel] Waiting for Liveblocks connection...");
      return;
    }
    
    if (dataLoaded) {
      console.log("[Duel] Data already loaded, skipping");
      return;
    }

    async function loadDuelData() {
      console.log(`[Duel] Loading duel data for ${duelId}...`);
      
      try {
        const data = await api.post<{
          ok: boolean;
          error?: string;
          duelId: string;
          quizTitle: string;
          players: DuelPlayer[];
          questions: DuelQuestion[];
          totalQuestions: number;
          _internal?: { aiMode?: boolean }; // Внутренний флаг
        }>(`/api/duels/${duelId}/start`, {});

        console.log("[Duel] Start API response:", data);

        if (!data.ok) {
          console.error("[Duel] Start API returned error:", data.error);
          setGameState((prev) => ({
            ...prev,
            status: "error",
            error: data.error || "Не удалось загрузить дуэль",
          }));
          return;
        }

        console.log(`[Duel] Loaded ${data.questions.length} questions, ${data.players.length} players`);
        
        setQuestions(data.questions);
        setPlayers(data.players);
        setDataLoaded(true);
        
        // Проверяем внутренний флаг режима
        if (data._internal?.aiMode) {
          setIsAIMode(true);
        }

        updateMyPresence({
          odId: userId,
          odName: userName,
          odPhotoUrl: userPhoto,
          isReady: false,
          currentQuestion: 0,
          hasAnswered: false,
        });

        const newStatus = isOpponentConnected ? "waiting_ready" : "waiting_opponent";
        console.log(`[Duel] Setting status to: ${newStatus}, opponentConnected: ${isOpponentConnected}`);
        
        setGameState((prev) => ({
          ...prev,
          status: newStatus,
        }));

      } catch (error) {
        console.error("[Duel] Failed to load data:", error);
        setGameState((prev) => ({
          ...prev,
          status: "error",
          error: "Ошибка загрузки данных",
        }));
      }
    }

    loadDuelData();
  }, [connectionStatus, dataLoaded, duelId, userId, userName, userPhoto, updateMyPresence, isOpponentConnected]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ОТСЛЕЖИВАНИЕ ОППОНЕНТА
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!dataLoaded) return;

    if (isOpponentConnected) {
      if (opponentTimeoutRef.current) {
        clearTimeout(opponentTimeoutRef.current);
        opponentTimeoutRef.current = null;
      }
      if (reconnectGraceRef.current) {
        clearTimeout(reconnectGraceRef.current);
        reconnectGraceRef.current = null;
      }

      if (gameState.status === "waiting_opponent" || gameState.status === "opponent_left") {
        setGameState((prev) => ({ ...prev, status: "waiting_ready" }));
      }
    } else {
      if (gameState.status === "playing" || gameState.status === "revealing") {
        if (!reconnectGraceRef.current) {
          reconnectGraceRef.current = setTimeout(() => {
            setGameState((prev) => ({ ...prev, status: "opponent_left" }));
          }, RECONNECT_GRACE_PERIOD_MS);
        }
      } else if (gameState.status === "waiting_ready") {
        if (!opponentTimeoutRef.current) {
          opponentTimeoutRef.current = setTimeout(() => {
            setGameState((prev) => ({ ...prev, status: "waiting_opponent" }));
          }, LOBBY_OPPONENT_DELAY_MS);
        }
      }
    }
  }, [isOpponentConnected, gameState.status, dataLoaded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AI MODE: СИМУЛЯЦИЯ AI-ОППОНЕНТА В ПРОДАКШЕНЕ
  // ═══════════════════════════════════════════════════════════════════════════

  // AI mode: создаём симулированного оппонента когда ждём
  useEffect(() => {
    if (!isAIMode || realOpponent || !dataLoaded) return;

    // Если ждём оппонента — AI "подключается" мгновенно
    if (gameState.status === "waiting_opponent" && !devModeOpponent) {
      console.log("[Duel] Waiting for opponent...");
      
      const timer = setTimeout(() => {
        const opponentData = players.find(p => p.odId !== userId);
        
        const simulated: DuelPresence = {
          odId: opponentData?.odId ?? -1,
          odName: opponentData?.odName ?? "Соперник",
          odPhotoUrl: opponentData?.odPhotoUrl ?? null,
          isReady: false,
          currentQuestion: 0,
          hasAnswered: false,
        };
        
        // Логи без упоминания AI (на случай если логи видны)
        console.log("[Duel] Opponent connected:", simulated.odName);
        setDevModeOpponent(simulated);
      }, 500); // Подключается быстро
      
      return () => clearTimeout(timer);
    }
  }, [isAIMode, gameState.status, realOpponent, devModeOpponent, dataLoaded, players, userId]);

  // AI mode: AI становится готовым после игрока
  useEffect(() => {
    if (!isAIMode || !devModeOpponent || realOpponent) return;
    
    if (gameState.status === "waiting_ready" && myPresence.isReady && !devModeOpponent.isReady) {
      const timer = setTimeout(() => {
        console.log("[Duel] Opponent is ready");
        setDevModeOpponent(prev => prev ? { ...prev, isReady: true } : null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAIMode, gameState.status, myPresence.isReady, devModeOpponent, realOpponent]);

  // AI mode: проверяем ответы AI с сервера
  useEffect(() => {
    if (!isAIMode || !devModeOpponent || realOpponent) return;
    if (gameState.status !== "playing") return;
    
    // Поллим сервер на наличие ответа AI
    const checkAIAnswer = async () => {
      try {
        const opponentId = devModeOpponent.odId;
        const questionIndex = gameState.currentQuestionIndex;
        
        // Запрашиваем ответы AI с сервера
        const response = await api.get<{
          ok: boolean;
          answers: Array<{ questionIndex: number; isCorrect: boolean }>;
        }>(`/api/duels/${duelId}/answer?checkOpponent=${opponentId}`);
        
        if (response.ok && response.answers) {
          const aiAnswer = response.answers.find(a => a.questionIndex === questionIndex);
          if (aiAnswer && !devModeOpponent.hasAnswered) {
            console.log(`[Duel] Opponent answered Q${questionIndex}`);
            setDevModeOpponent(prev => prev ? { ...prev, hasAnswered: true } : null);
          }
        }
      } catch (error) {
        // Игнорируем ошибки поллинга
      }
    };
    
    // Поллим каждые 500ms
    aiPollIntervalRef.current = setInterval(checkAIAnswer, 500);
    
    return () => {
      if (aiPollIntervalRef.current) {
        clearInterval(aiPollIntervalRef.current);
      }
    };
  }, [isAIMode, devModeOpponent, realOpponent, gameState.status, gameState.currentQuestionIndex, duelId]);

  // AI mode: сбрасываем hasAnswered при новом вопросе
  // ВАЖНО: НЕ включаем devModeOpponent в зависимости — иначе бесконечный цикл!
  useEffect(() => {
    if (!isAIMode) return;
    
    setDevModeOpponent(prev => {
      if (!prev) return null;
      // Только если вопрос реально сменился
      if (prev.currentQuestion === gameState.currentQuestionIndex) return prev;
      return { ...prev, hasAnswered: false, currentQuestion: gameState.currentQuestionIndex };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIMode, gameState.currentQuestionIndex]);

  // AI mode: запускаем countdown когда оба готовы
  useEffect(() => {
    if (!isAIMode || !devModeOpponent || realOpponent) return;
    
    if (gameState.status === "waiting_ready" && myPresence.isReady && devModeOpponent.isReady) {
      console.log("[Duel] Both ready, starting countdown...");
      const timer = setTimeout(() => {
        startCountdown();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAIMode, gameState.status, myPresence.isReady, devModeOpponent, realOpponent, startCountdown]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DEV-MODE: СИМУЛЯЦИЯ ОППОНЕНТА (для локальной разработки)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Только в dev-режиме, если нет реального оппонента и не AI-режим
    if (!isDevMode() || realOpponent || !dataLoaded || isAIMode) return;

    // Если ждём оппонента — симулируем его через 2 секунды
    if (gameState.status === "waiting_opponent" && !devModeOpponent) {
      console.log("[Duel Dev] No real opponent, simulating in 2s...");
      
      devModeTimerRef.current = setTimeout(() => {
        // Находим данные оппонента из players
        const opponentData = players.find(p => p.odId !== userId);
        
        const simulated: DuelPresence = {
          odId: opponentData?.odId ?? -1,
          odName: opponentData?.odName ?? "Бот-соперник",
          odPhotoUrl: opponentData?.odPhotoUrl ?? null,
          isReady: false,
          currentQuestion: 0,
          hasAnswered: false,
        };
        
        console.log("[Duel Dev] Simulated opponent connected:", simulated.odName);
        setDevModeOpponent(simulated);
      }, DEV_MODE_OPPONENT_DELAY_MS);
      
      return () => {
        if (devModeTimerRef.current) clearTimeout(devModeTimerRef.current);
      };
    }
  }, [gameState.status, realOpponent, devModeOpponent, dataLoaded, players, userId]);

  // Dev-mode: автоматически делаем оппонента готовым после того как мы готовы
  useEffect(() => {
    if (!isDevMode() || !devModeOpponent || realOpponent || isAIMode) return;
    
    // Если мы готовы, а симулированный оппонент нет — делаем его готовым через 1с
    if (gameState.status === "waiting_ready" && myPresence.isReady && !devModeOpponent.isReady) {
      const timer = setTimeout(() => {
        console.log("[Duel Dev] Simulated opponent is ready");
        setDevModeOpponent(prev => prev ? { ...prev, isReady: true } : null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState.status, myPresence.isReady, devModeOpponent, realOpponent, isAIMode]);

  // Dev-mode: симулируем ответ оппонента после нашего ответа
  useEffect(() => {
    if (!isDevMode() || !devModeOpponent || realOpponent || isAIMode) return;
    
    // Если мы ответили, а симулированный оппонент нет — он отвечает через 0.5-2с
    if (gameState.status === "playing" && myAnswers[gameState.currentQuestionIndex] !== undefined && !devModeOpponent.hasAnswered) {
      const delay = 500 + Math.random() * 1500;
      const timer = setTimeout(() => {
        console.log("[Duel Dev] Simulated opponent answered");
        setDevModeOpponent(prev => prev ? { ...prev, hasAnswered: true } : null);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gameState.status, gameState.currentQuestionIndex, myAnswers, devModeOpponent, realOpponent, isAIMode]);

  // Dev-mode: сбрасываем hasAnswered при переходе к новому вопросу
  useEffect(() => {
    if (!isDevMode() || !devModeOpponent || isAIMode) return;
    
    setDevModeOpponent(prev => prev ? { ...prev, hasAnswered: false, currentQuestion: gameState.currentQuestionIndex } : null);
  }, [gameState.currentQuestionIndex, devModeOpponent, isAIMode]);

  // Dev-mode: запускаем countdown когда оба готовы
  useEffect(() => {
    if (!isDevMode() || !devModeOpponent || realOpponent || isAIMode) return;
    
    // Если оба готовы и мы в статусе waiting_ready — запускаем countdown
    if (gameState.status === "waiting_ready" && myPresence.isReady && devModeOpponent.isReady) {
      console.log("[Duel Dev] Both ready, starting countdown...");
      // Небольшая задержка для визуального эффекта
      const timer = setTimeout(() => {
        startCountdown();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState.status, myPresence.isReady, devModeOpponent, realOpponent, startCountdown, isAIMode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТКА СОБЫТИЙ LIVEBLOCKS
  // ═══════════════════════════════════════════════════════════════════════════

  useEventListener((event) => {
    const duelEvent = event.event as DuelRoomEvent;

    switch (duelEvent.type) {
      case "GAME_START": {
        startCountdown();
        break;
      }

      case "QUESTION_REVEAL": {
        const { questionIndex } = duelEvent as { type: "QUESTION_REVEAL"; questionIndex: number };
        startQuestionRef.current(questionIndex);
        break;
      }

      case "ANSWER_REVEAL": {
        const { questionIndex, correctOptionId } = duelEvent as {
          type: "ANSWER_REVEAL";
          questionIndex: number;
          correctOptionId: number;
        };
        handleRevealRef.current(questionIndex, correctOptionId);
        break;
      }

      case "GAME_END": {
        const { winnerId, scores } = duelEvent as {
          type: "GAME_END";
          winnerId: number | null;
          scores: Record<number, number>;
        };
        handleGameEnd(winnerId, scores);
        break;
      }

      case "PLAYER_ANSWERED": {
        checkBothAnswered();
        break;
      }

      case "TIME_UP": {
        const { questionIndex } = duelEvent as { type: "TIME_UP"; questionIndex: number };
        handleTimeUpRef.current(questionIndex);
        break;
      }

      case "PLAYER_FORFEIT": {
        const { odId, winnerId, scores } = duelEvent as {
          type: "PLAYER_FORFEIT";
          odId: number;
          winnerId: number;
          scores: Record<number, number>;
        };
        handleForfeit(odId, winnerId, scores);
        break;
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТКА ОТКЛЮЧЕНИЙ
  // ═══════════════════════════════════════════════════════════════════════════

  useLostConnectionListener((event) => {
    if (event === "lost") {
      console.warn("[Duel] Connection lost, attempting to reconnect...");
    } else if (event === "restored") {
      console.log("[Duel] Connection restored");
    } else if (event === "failed") {
      setGameState((prev) => ({
        ...prev,
        status: "error",
        error: "Потеряно соединение с сервером",
      }));
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (opponentTimeoutRef.current) clearTimeout(opponentTimeoutRef.current);
      if (reconnectGraceRef.current) clearTimeout(reconnectGraceRef.current);
      if (aiPollIntervalRef.current) clearInterval(aiPollIntervalRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════

  const currentQuestion = questions[gameState.currentQuestionIndex];
  const myPlayer = players.find((p) => p.odId === userId);
  const opponentPlayer = players.find((p) => p.odId !== userId);

  const isMyTurn = gameState.status === "playing" && myAnswers[gameState.currentQuestionIndex] === undefined;
  const hasAnswered = myAnswers[gameState.currentQuestionIndex] !== undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Состояние
    gameState,
    connectionStatus,
    isConnected: connectionStatus === "connected",

    // Данные
    questions,
    currentQuestion,
    myPlayer,
    opponentPlayer,
    myAnswers,
    revealedAnswers,

    // Оппонент
    opponent,
    isOpponentConnected,
    isOpponentReady,
    isOpponentAnswered,

    // Статусы
    isMyTurn,
    hasAnswered,
    isSubmitting,

    // Действия
    setReady,
    submitAnswer,
    forfeit,
  };
}
