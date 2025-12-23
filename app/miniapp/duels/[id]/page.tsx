/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL ROOM — Real-time дуэль с Liveblocks
 * ══════════════════════════════════════════════════════════════════════════════
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { RoomProvider, initialPresence } from "@/liveblocks.config";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type DuelData = {
  duelId: string;
  roomId: string;
  quizId: number;
  quizTitle: string;
  players: { odId: number; odName: string; odPhotoUrl: string | null }[];
  questions: {
    id: number;
    text: string;
    options: { id: number; text: string }[];
    timeLimitSeconds: number;
  }[];
  correctAnswers: Record<number, number>;
};

// ═══════════════════════════════════════════════════════════════════════════
// СТРАНИЦА ДУЭЛИ
// ═══════════════════════════════════════════════════════════════════════════

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const session = useMiniAppSession();
  const duelId = params.id as string;

  const [duelData, setDuelData] = useState<DuelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка данных дуэли
  useEffect(() => {
    async function loadDuel() {
      try {
        const data = await api.post<DuelData & { ok: boolean; error?: string }>(
          `/api/duels/${duelId}/start`,
          {}
        );

        if (data.ok) {
          setDuelData(data);
        } else {
          setError(data.error || "Не удалось загрузить дуэль");
        }
      } catch (err) {
        setError("Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    }

    if (session.status === "ready") {
      loadDuel();
    }
  }, [duelId, session.status]);

  if (session.status !== "ready") return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
        <p className="mt-4 text-white/50">Загрузка дуэли...</p>
      </div>
    );
  }

  if (error || !duelData) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center px-6">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-white mb-2">Ошибка</h2>
        <p className="text-white/50 text-center mb-6">{error}</p>
        <button
          onClick={() => router.push("/miniapp/duels")}
          className="px-6 py-3 rounded-xl bg-violet-600 text-white font-medium"
        >
          Назад к дуэлям
        </button>
      </div>
    );
  }

  const userId = session.user.id;

  return (
    <RoomProvider
      id={duelData.roomId}
      initialPresence={{
        ...initialPresence,
        odId: userId,
        odName: session.user.firstName || session.user.username || "Игрок",
        odPhotoUrl: session.user.photoUrl,
      }}
      initialStorage={{
        duelId: duelData.duelId,
        quizId: duelData.quizId,
        quizTitle: duelData.quizTitle,
        players: duelData.players,
        questions: duelData.questions,
        status: "waiting",
        currentQuestionIndex: 0,
        questionStartedAt: null,
        answers: {},
        correctAnswers: duelData.correctAnswers,
        scores: {},
        winnerId: null,
        finished: false,
      }}
    >
      <DuelGame
        duelData={duelData}
        userId={userId}
        onExit={() => router.push("/miniapp/duels")}
      />
    </RoomProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ИГРОВОЙ КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

function DuelGame({
  duelData,
  userId,
  onExit,
}: {
  duelData: DuelData;
  userId: number;
  onExit: () => void;
}) {
  const router = useRouter();

  // Состояние игры
  const [status, setStatus] = useState<"waiting" | "countdown" | "playing" | "result" | "finished">("waiting");
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myAnswers, setMyAnswers] = useState<Record<number, number>>({});
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const me = duelData.players.find((p) => p.odId === userId);
  const opponent = duelData.players.find((p) => p.odId !== userId);
  const currentQuestion = duelData.questions[currentQ];
  const correctAnswer = duelData.correctAnswers[currentQ];

  // Симуляция готовности оппонента (в реальной игре через Liveblocks)
  useEffect(() => {
    if (status === "waiting") {
      // Симулируем ожидание оппонента
      const timer = setTimeout(() => {
        setOpponentReady(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Обратный отсчёт
  useEffect(() => {
    if (status === "countdown") {
      let count = 3;
      setTimeLeft(count);

      const interval = setInterval(() => {
        count--;
        setTimeLeft(count);
        if (count <= 0) {
          clearInterval(interval);
          startQuestion();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);

  // Таймер вопроса
  useEffect(() => {
    if (status === "playing" && currentQuestion) {
      let time = currentQuestion.timeLimitSeconds;
      setTimeLeft(time);

      const interval = setInterval(() => {
        time--;
        setTimeLeft(time);
        if (time <= 0) {
          clearInterval(interval);
          handleTimeUp();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, currentQ]);

  // Старт игры
  const handleReady = () => {
    haptic.medium();
    if (opponentReady) {
      setStatus("countdown");
    }
  };

  // Показать вопрос
  const startQuestion = () => {
    setStatus("playing");
    setSelectedOption(null);
    setShowCorrect(false);
    setOpponentAnswered(false);
  };

  // Ответ
  const handleAnswer = (optionId: number) => {
    if (selectedOption !== null) return;
    
    haptic.light();
    setSelectedOption(optionId);
    setMyAnswers((prev) => ({ ...prev, [currentQ]: optionId }));

    // Симуляция ответа оппонента
    setTimeout(() => {
      setOpponentAnswered(true);
      revealAnswer(optionId);
    }, 1000);
  };

  // Время вышло
  const handleTimeUp = () => {
    if (selectedOption === null) {
      setMyAnswers((prev) => ({ ...prev, [currentQ]: -1 }));
    }
    revealAnswer(selectedOption ?? -1);
  };

  // Показать правильный ответ
  const revealAnswer = (myOption: number) => {
    setShowCorrect(true);
    setStatus("result");

    // Подсчёт очков
    if (myOption === correctAnswer) {
      setMyScore((prev) => prev + 100);
      haptic.success();
    } else {
      haptic.error();
    }

    // Симуляция очков оппонента
    if (Math.random() > 0.4) {
      setOpponentScore((prev) => prev + 100);
    }

    // Следующий вопрос или конец
    setTimeout(() => {
      if (currentQ + 1 >= duelData.questions.length) {
        finishGame();
      } else {
        setCurrentQ((prev) => prev + 1);
        startQuestion();
      }
    }, 2000);
  };

  // Завершение игры
  const finishGame = async () => {
    setStatus("finished");

    // Определяем победителя
    let winner: number | null = null;
    if (myScore > opponentScore) {
      winner = userId;
    } else if (opponentScore > myScore) {
      winner = opponent?.odId ?? null;
    }
    setWinnerId(winner);

    // Сохраняем результат
    try {
      await api.post(`/api/duels/${duelData.duelId}/finish`, {
        challengerScore: myScore,
        opponentScore: opponentScore,
      });
    } catch (err) {
      console.error("[Duel] Failed to save result:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {/* Me */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {me?.odPhotoUrl ? (
              <img src={me.odPhotoUrl} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold">
                {me?.odName?.[0] || "?"}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{me?.odName}</div>
            <div className="text-lg font-bold text-amber-400">{myScore}</div>
          </div>
        </div>

        {/* VS */}
        <div className="text-2xl font-black text-white/30">VS</div>

        {/* Opponent */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-medium text-white">{opponent?.odName}</div>
            <div className="text-lg font-bold text-amber-400">{opponentScore}</div>
          </div>
          <div className="relative">
            {opponent?.odPhotoUrl ? (
              <img src={opponent.odPhotoUrl} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                {opponent?.odName?.[0] || "?"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {/* Ожидание */}
          {status === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <div className="text-5xl mb-4">⚔️</div>
              <h2 className="text-2xl font-bold text-white mb-2">{duelData.quizTitle}</h2>
              <p className="text-white/50 mb-6">
                {opponentReady ? "Соперник готов!" : "Ожидаем соперника..."}
              </p>
              <button
                onClick={handleReady}
                disabled={!opponentReady}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-lg disabled:opacity-50"
              >
                {opponentReady ? "Начать!" : "Ожидание..."}
              </button>
            </motion.div>
          )}

          {/* Обратный отсчёт */}
          {status === "countdown" && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="text-center"
            >
              <div className="text-8xl font-black text-white">{timeLeft}</div>
            </motion.div>
          )}

          {/* Вопрос */}
          {(status === "playing" || status === "result") && currentQuestion && (
            <motion.div
              key={`question-${currentQ}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              {/* Таймер */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-white/50 text-sm">
                  Вопрос {currentQ + 1}/{duelData.questions.length}
                </span>
                <span className={`text-lg font-bold ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>
                  ⏱ {timeLeft}с
                </span>
              </div>

              {/* Вопрос */}
              <div className="bg-white/5 rounded-2xl p-5 mb-6 border border-white/10">
                <p className="text-lg text-white font-medium">{currentQuestion.text}</p>
              </div>

              {/* Варианты */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedOption === option.id;
                  const isCorrect = option.id === correctAnswer;
                  const showResult = showCorrect;

                  let bgClass = "bg-white/5 border-white/10";
                  if (showResult) {
                    if (isCorrect) {
                      bgClass = "bg-emerald-500/20 border-emerald-500";
                    } else if (isSelected && !isCorrect) {
                      bgClass = "bg-red-500/20 border-red-500";
                    }
                  } else if (isSelected) {
                    bgClass = "bg-violet-600/30 border-violet-500";
                  }

                  return (
                    <motion.button
                      key={option.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswer(option.id)}
                      disabled={selectedOption !== null}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${bgClass} disabled:cursor-default`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          showResult && isCorrect ? "bg-emerald-500 text-white" :
                          showResult && isSelected && !isCorrect ? "bg-red-500 text-white" :
                          isSelected ? "bg-violet-600 text-white" : "bg-white/10 text-white/60"
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-white font-medium">{option.text}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Статус оппонента */}
              {!showCorrect && (
                <div className="mt-4 text-center text-sm text-white/40">
                  {opponentAnswered ? "✅ Соперник ответил" : "⏳ Соперник думает..."}
                </div>
              )}
            </motion.div>
          )}

          {/* Финал */}
          {status === "finished" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">
                {winnerId === userId ? "🏆" : winnerId === null ? "🤝" : "😔"}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {winnerId === userId ? "Победа!" : winnerId === null ? "Ничья!" : "Поражение"}
              </h2>
              <div className="flex justify-center gap-8 my-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-400">{myScore}</div>
                  <div className="text-sm text-white/50">Ты</div>
                </div>
                <div className="text-2xl text-white/30">:</div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-400">{opponentScore}</div>
                  <div className="text-sm text-white/50">{opponent?.odName}</div>
                </div>
              </div>
              <div className="text-emerald-400 font-medium mb-6">
                +{winnerId === userId ? 50 : winnerId === null ? 30 : 10} XP
              </div>
              <button
                onClick={onExit}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold"
              >
                Готово
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
