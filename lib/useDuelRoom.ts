/**
 * ══════════════════════════════════════════════════════════════════════════════
 * USE DUEL ROOM — React hook для real-time дуэли
 * ══════════════════════════════════════════════════════════════════════════════
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useBroadcastEvent,
  useEventListener,
  useStorage,
  useMutation,
  DuelPresence,
  DuelStorage,
  DuelRoomEvent,
} from "@/liveblocks.config";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type DuelGameState = {
  status: "loading" | "waiting" | "countdown" | "playing" | "question_result" | "finished";
  currentQuestionIndex: number;
  timeLeft: number;
  myScore: number;
  opponentScore: number;
  winnerId: number | null;
};

export type DuelQuestion = {
  id: number;
  text: string;
  options: { id: number; text: string }[];
  timeLimitSeconds: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useDuelRoom(duelId: string, userId: number) {
  const room = useRoom();
  const [myPresence, updateMyPresence] = useMyPresence();
  const others = useOthers();
  const broadcast = useBroadcastEvent();

  // Локальное состояние
  const [gameState, setGameState] = useState<DuelGameState>({
    status: "loading",
    currentQuestionIndex: 0,
    timeLeft: 0,
    myScore: 0,
    opponentScore: 0,
    winnerId: null,
  });
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, number>>({});
  const [myAnswers, setMyAnswers] = useState<Record<number, number>>({});
  const [opponentAnswers, setOpponentAnswers] = useState<Record<number, number>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Storage hooks
  const storage = useStorage((root) => root);

  // ═══ Инициализация при входе в комнату ═══
  useEffect(() => {
    async function loadDuelData() {
      try {
        const data = await api.post<{
          ok: boolean;
          duelId: string;
          quizTitle: string;
          players: { odId: number; odName: string; odPhotoUrl: string | null }[];
          questions: DuelQuestion[];
          correctAnswers: Record<number, number>;
        }>(`/api/duels/${duelId}/start`, {});

        if (data.ok) {
          setQuestions(data.questions);
          setCorrectAnswers(data.correctAnswers);

          // Обновляем presence
          const me = data.players.find((p) => p.odId === userId);
          if (me) {
            updateMyPresence({
              odId: me.odId,
              odName: me.odName,
              odPhotoUrl: me.odPhotoUrl,
              isReady: false,
              currentQuestion: 0,
              hasAnswered: false,
            });
          }

          setGameState((prev) => ({
            ...prev,
            status: "waiting",
          }));
        }
      } catch (error) {
        console.error("[Duel] Failed to load data:", error);
      }
    }

    loadDuelData();
  }, [duelId, userId, updateMyPresence]);

  // ═══ Слушаем события ═══
  useEventListener((event) => {
    const { type } = event.event as DuelRoomEvent;

    switch (type) {
      case "GAME_START":
        startCountdown();
        break;

      case "QUESTION_REVEAL":
        const { questionIndex } = event.event as { type: "QUESTION_REVEAL"; questionIndex: number };
        showQuestion(questionIndex);
        break;

      case "ANSWER_REVEAL":
        const revealEvent = event.event as {
          type: "ANSWER_REVEAL";
          questionIndex: number;
          correctOptionId: number;
        };
        revealAnswer(revealEvent.questionIndex, revealEvent.correctOptionId);
        break;

      case "GAME_END":
        const endEvent = event.event as {
          type: "GAME_END";
          winnerId: number | null;
          scores: Record<number, number>;
        };
        endGame(endEvent.winnerId, endEvent.scores);
        break;

      case "PLAYER_ANSWERED":
        const answerEvent = event.event as {
          type: "PLAYER_ANSWERED";
          odId: number;
          questionIndex: number;
        };
        if (answerEvent.odId !== userId) {
          setOpponentAnswers((prev) => ({
            ...prev,
            [answerEvent.questionIndex]: -1, // Отвечено, но не знаем что
          }));
        }
        break;
    }
  });

  // ═══ Обратный отсчёт перед игрой ═══
  const startCountdown = useCallback(() => {
    setGameState((prev) => ({ ...prev, status: "countdown", timeLeft: 3 }));

    let count = 3;
    countdownRef.current = setInterval(() => {
      count--;
      setGameState((prev) => ({ ...prev, timeLeft: count }));

      if (count <= 0) {
        clearInterval(countdownRef.current!);
        showQuestion(0);
      }
    }, 1000);
  }, []);

  // ═══ Показать вопрос ═══
  const showQuestion = useCallback(
    (index: number) => {
      const question = questions[index];
      if (!question) return;

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

      // Запускаем таймер
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setGameState((prev) => {
          const newTime = prev.timeLeft - 1;
          if (newTime <= 0) {
            clearInterval(timerRef.current!);
            // Время вышло — автоматически раскрываем ответ
            broadcast({ type: "TIME_UP", questionIndex: index });
          }
          return { ...prev, timeLeft: Math.max(0, newTime) };
        });
      }, 1000);
    },
    [questions, updateMyPresence, broadcast]
  );

  // ═══ Ответить на вопрос ═══
  const submitAnswer = useCallback(
    (optionId: number) => {
      const questionIndex = gameState.currentQuestionIndex;

      // Сохраняем ответ
      setMyAnswers((prev) => ({
        ...prev,
        [questionIndex]: optionId,
      }));

      // Обновляем presence
      updateMyPresence({ hasAnswered: true });

      // Broadcast что ответили
      broadcast({
        type: "PLAYER_ANSWERED",
        odId: userId,
        questionIndex,
      });

      // Проверяем, ответили ли оба
      const opponentAnswered = others.some(
        (other) => (other.presence as DuelPresence)?.hasAnswered
      );

      if (opponentAnswered) {
        // Оба ответили — раскрываем
        const correctOptionId = correctAnswers[questionIndex];
        broadcast({
          type: "ANSWER_REVEAL",
          questionIndex,
          correctOptionId,
        });
      }
    },
    [gameState.currentQuestionIndex, updateMyPresence, broadcast, userId, others, correctAnswers]
  );

  // ═══ Раскрытие ответа ═══
  const revealAnswer = useCallback(
    (questionIndex: number, correctOptionId: number) => {
      clearInterval(timerRef.current!);

      setGameState((prev) => ({ ...prev, status: "question_result" }));

      // Подсчитываем очки
      const myAnswer = myAnswers[questionIndex];
      const isCorrect = myAnswer === correctOptionId;

      if (isCorrect) {
        setGameState((prev) => ({
          ...prev,
          myScore: prev.myScore + 100,
        }));
      }

      // Через 2 секунды — следующий вопрос или конец
      setTimeout(() => {
        const nextIndex = questionIndex + 1;

        if (nextIndex >= questions.length) {
          // Конец игры
          finishGame();
        } else {
          showQuestion(nextIndex);
        }
      }, 2000);
    },
    [myAnswers, questions.length, showQuestion]
  );

  // ═══ Завершение игры ═══
  const finishGame = useCallback(async () => {
    try {
      // Подсчитываем финальные очки
      let myScore = 0;
      let opponentScore = 0;

      for (let i = 0; i < questions.length; i++) {
        const correct = correctAnswers[i];
        if (myAnswers[i] === correct) myScore += 100;
        // Очки оппонента получим из storage или broadcast
      }

      // Сохраняем результат через API
      const result = await api.post<{
        ok: boolean;
        duel: { winnerId: number | null };
      }>(`/api/duels/${duelId}/finish`, {
        challengerScore: myScore, // Упрощённо, нужно определить кто challenger
        opponentScore: opponentScore,
      });

      if (result.ok) {
        broadcast({
          type: "GAME_END",
          winnerId: result.duel.winnerId,
          scores: { [userId]: myScore },
        });
      }
    } catch (error) {
      console.error("[Duel] Failed to finish:", error);
    }
  }, [questions, correctAnswers, myAnswers, duelId, userId, broadcast]);

  // ═══ Конец игры (событие) ═══
  const endGame = useCallback(
    (winnerId: number | null, scores: Record<number, number>) => {
      setGameState((prev) => ({
        ...prev,
        status: "finished",
        winnerId,
        myScore: scores[userId] || prev.myScore,
      }));
    },
    [userId]
  );

  // ═══ Готовность ═══
  const setReady = useCallback(() => {
    updateMyPresence({ isReady: true });

    // Проверяем готовность обоих
    const allReady = others.every((other) => (other.presence as DuelPresence)?.isReady);

    if (allReady) {
      broadcast({ type: "GAME_START", startsAt: Date.now() + 3000 });
      startCountdown();
    }
  }, [updateMyPresence, others, broadcast, startCountdown]);

  // ═══ Cleanup ═══
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ═══ Оппонент ═══
  const opponent = others[0]?.presence as DuelPresence | undefined;

  return {
    gameState,
    questions,
    currentQuestion: questions[gameState.currentQuestionIndex],
    myPresence: myPresence as DuelPresence,
    opponent,
    myAnswers,
    correctAnswers,
    setReady,
    submitAnswer,
    isOpponentReady: opponent?.isReady || false,
    isOpponentAnswered: opponent?.hasAnswered || false,
  };
}
