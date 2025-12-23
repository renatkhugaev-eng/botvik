/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL ROOM — Professional Real-time Duel with Liveblocks
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Полноценная реализация real-time дуэли:
 * - Использует useDuelRoom hook для всей логики
 * - Real-time синхронизация через Liveblocks
 * - Серверная валидация ответов
 * - Обработка отключений и reconnection
 * - Профессиональный UI с анимациями
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { RoomProvider, initialPresence } from "@/liveblocks.config";
import { useDuelRoom, DuelStatus } from "@/lib/useDuelRoom";
import { haptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════
// СТРАНИЦА ДУЭЛИ
// ═══════════════════════════════════════════════════════════════════════════

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const session = useMiniAppSession();
  const duelId = params.id as string;

  if (session.status !== "ready") {
    return <LoadingScreen message="Загрузка..." />;
  }

  const userId = session.user.id;
  const userName = session.user.firstName || session.user.username || "Игрок";
  const userPhoto = session.user.photoUrl;

  // Минимальный initialStorage - реальные данные загружаются в useDuelRoom
  const emptyStorage = {
    duelId: duelId,
    quizId: 0,
    quizTitle: "",
    players: [],
    questions: [],
    status: "waiting" as const,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    answers: {},
    revealedAnswers: {},
    scores: {},
    winnerId: null,
    finished: false,
  };

  return (
    <RoomProvider
      id={`duel:${duelId}`}
      initialPresence={{
        ...initialPresence,
        odId: userId,
        odName: userName,
        odPhotoUrl: userPhoto,
      }}
      initialStorage={emptyStorage}
    >
      <DuelGameContent
        duelId={duelId}
        userId={userId}
        userName={userName}
        userPhoto={userPhoto}
        onExit={() => router.push("/miniapp/duels")}
      />
    </RoomProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ИГРОВОЙ КОНТЕНТ
// ═══════════════════════════════════════════════════════════════════════════

function DuelGameContent({
  duelId,
  userId,
  userName,
  userPhoto,
  onExit,
}: {
  duelId: string;
  userId: number;
  userName: string;
  userPhoto: string | null;
  onExit: () => void;
}) {
  const {
    gameState,
    connectionStatus,
    isConnected,
    currentQuestion,
    myPlayer,
    opponentPlayer,
    myAnswers,
    revealedAnswers,
    opponent,
    isOpponentConnected,
    isOpponentReady,
    isOpponentAnswered,
    isMyTurn,
    hasAnswered,
    isSubmitting,
    setReady,
    submitAnswer,
    forfeit,
  } = useDuelRoom(duelId, userId, userName, userPhoto);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  // Сброс выбора при переходе к новому вопросу
  useEffect(() => {
    setSelectedOption(null);
  }, [gameState.currentQuestionIndex]);

  // Обработка выбора ответа
  const handleSelectOption = async (optionId: number) => {
    if (!isMyTurn || isSubmitting) return;

    haptic.light();
    setSelectedOption(optionId);

    const result = await submitAnswer(optionId);
    if (result?.isCorrect) {
      haptic.success();
    } else if (result) {
      haptic.error();
    }
  };

  // Обработка готовности
  const handleReady = () => {
    haptic.medium();
    setReady();
  };

  // Обработка сдачи
  const handleForfeit = async () => {
    haptic.error();
    setShowForfeitConfirm(false);
    await forfeit();
  };

  // ═══ РЕНДЕР В ЗАВИСИМОСТИ ОТ СТАТУСА ═══
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] via-[#12122a] to-[#1a1a2e] flex flex-col">
      {/* Header с игроками */}
      <DuelHeader
        myPlayer={myPlayer}
        opponentPlayer={opponentPlayer}
        myScore={gameState.myScore}
        opponentScore={gameState.opponentScore}
        isOpponentConnected={isOpponentConnected}
        isOpponentAnswered={isOpponentAnswered}
        hasAnswered={hasAnswered}
        status={gameState.status}
      />

      {/* Основной контент */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {/* Подключение */}
          {gameState.status === "connecting" && (
            <StatusScreen key="connecting" icon="🔌" title="Подключение..." subtitle="Устанавливаем соединение" />
          )}

          {/* Ожидание оппонента */}
          {gameState.status === "waiting_opponent" && (
            <StatusScreen
              key="waiting_opponent"
              icon="⏳"
              title="Ожидание соперника"
              subtitle="Соперник ещё не подключился"
              showSpinner
            />
          )}

          {/* Лобби — ожидание готовности */}
          {gameState.status === "waiting_ready" && (
            <LobbyScreen
              key="waiting_ready"
              myPlayer={myPlayer}
              opponentPlayer={opponentPlayer}
              opponent={opponent}
              isOpponentReady={isOpponentReady}
              onReady={handleReady}
            />
          )}

          {/* Обратный отсчёт */}
          {gameState.status === "countdown" && (
            <CountdownScreen key="countdown" timeLeft={gameState.timeLeft} />
          )}

          {/* Вопрос */}
          {(gameState.status === "playing" || gameState.status === "revealing") && currentQuestion && (
            <QuestionScreen
              key={`question-${gameState.currentQuestionIndex}`}
              questionIndex={gameState.currentQuestionIndex}
              totalQuestions={revealedAnswers ? Object.keys(revealedAnswers).length + (currentQuestion ? 1 : 0) : 1}
              question={currentQuestion}
              timeLeft={gameState.timeLeft}
              selectedOption={selectedOption}
              correctOption={revealedAnswers[gameState.currentQuestionIndex]}
              isRevealing={gameState.status === "revealing"}
              hasAnswered={hasAnswered}
              isOpponentAnswered={isOpponentAnswered}
              isSubmitting={isSubmitting}
              onSelectOption={handleSelectOption}
            />
          )}

          {/* Финал */}
          {gameState.status === "finished" && (
            <FinishScreen
              key="finished"
              userId={userId}
              winnerId={gameState.winnerId}
              myScore={gameState.myScore}
              opponentScore={gameState.opponentScore}
              myPlayer={myPlayer}
              opponentPlayer={opponentPlayer}
              onExit={onExit}
            />
          )}

          {/* Оппонент отключился */}
          {gameState.status === "opponent_left" && (
            <StatusScreen
              key="opponent_left"
              icon="😔"
              title="Соперник отключился"
              subtitle="Дуэль прервана"
              action={{ label: "Назад", onClick: onExit }}
            />
          )}

          {/* Ошибка */}
          {gameState.status === "error" && (
            <StatusScreen
              key="error"
              icon="❌"
              title="Ошибка"
              subtitle={gameState.error || "Что-то пошло не так"}
              action={{ label: "Назад", onClick: onExit }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Кнопка сдачи (показывается во время игры) */}
      {(gameState.status === "playing" || gameState.status === "revealing") && (
        <button
          onClick={() => {
            haptic.warning();
            setShowForfeitConfirm(true);
          }}
          className="fixed bottom-6 left-4 px-4 py-2 rounded-xl bg-white/10 text-white/60 text-sm font-medium hover:bg-white/15 transition-colors"
        >
          🏳️ Сдаться
        </button>
      )}

      {/* Модал подтверждения сдачи */}
      <AnimatePresence>
        {showForfeitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForfeitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a2e] rounded-2xl p-6 max-w-sm w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-5xl mb-4">🏳️</div>
                <h3 className="text-xl font-bold text-white mb-2">Сдаться?</h3>
                <p className="text-white/60 mb-6">
                  Ты проиграешь эту дуэль и не получишь XP. Соперник победит автоматически.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForfeitConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleForfeit}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                  >
                    Сдаться
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Индикатор соединения */}
      {!isConnected && gameState.status !== "connecting" && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 text-white text-center py-2 text-sm font-medium">
          🔄 Переподключение...
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТЫ
// ═══════════════════════════════════════════════════════════════════════════

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
      <p className="mt-4 text-white/50">{message}</p>
    </div>
  );
}

function DuelHeader({
  myPlayer,
  opponentPlayer,
  myScore,
  opponentScore,
  isOpponentConnected,
  isOpponentAnswered,
  hasAnswered,
  status,
}: {
  myPlayer?: { odId: number; odName: string; odPhotoUrl: string | null };
  opponentPlayer?: { odId: number; odName: string; odPhotoUrl: string | null };
  myScore: number;
  opponentScore: number;
  isOpponentConnected: boolean;
  isOpponentAnswered: boolean;
  hasAnswered: boolean;
  status: DuelStatus;
}) {
  const showScores = status === "playing" || status === "revealing" || status === "finished";

  return (
    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 backdrop-blur-sm">
      {/* Я */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <PlayerAvatar
            name={myPlayer?.odName || "Я"}
            photo={myPlayer?.odPhotoUrl}
            size="sm"
          />
          {hasAnswered && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-[10px]">✓</span>
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-white truncate max-w-[80px]">
            {myPlayer?.odName || "Я"}
          </div>
          {showScores && (
            <div className="text-lg font-bold text-amber-400">{myScore}</div>
          )}
        </div>
      </div>

      {/* VS */}
      <div className="flex flex-col items-center">
        <div className="text-2xl font-black text-white/30">VS</div>
        {status === "playing" && (
          <div className="text-xs text-white/40">
            {hasAnswered && isOpponentAnswered ? "Оба ответили" :
              hasAnswered ? "Ждём соперника" :
              isOpponentAnswered ? "Соперник ответил" : ""}
          </div>
        )}
      </div>

      {/* Оппонент */}
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-medium text-white truncate max-w-[80px]">
            {opponentPlayer?.odName || "Соперник"}
          </div>
          {showScores && (
            <div className="text-lg font-bold text-amber-400">{opponentScore}</div>
          )}
        </div>
        <div className="relative">
          <PlayerAvatar
            name={opponentPlayer?.odName || "?"}
            photo={opponentPlayer?.odPhotoUrl}
            size="sm"
          />
          {!isOpponentConnected && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-[10px]">!</span>
            </div>
          )}
          {isOpponentAnswered && isOpponentConnected && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-[10px]">✓</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerAvatar({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-14 h-14 text-lg",
    lg: "w-20 h-20 text-2xl",
  };

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-violet-500/50`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold`}
    >
      {name[0]?.toUpperCase() || "?"}
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  subtitle,
  showSpinner,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  showSpinner?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center"
    >
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      {subtitle && <p className="text-white/50 mb-6">{subtitle}</p>}
      {showSpinner && (
        <div className="flex justify-center mb-6">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 rounded-xl bg-violet-600 text-white font-medium"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

function LobbyScreen({
  myPlayer,
  opponentPlayer,
  opponent,
  isOpponentReady,
  onReady,
}: {
  myPlayer?: { odName: string; odPhotoUrl: string | null };
  opponentPlayer?: { odName: string; odPhotoUrl: string | null };
  opponent?: { isReady?: boolean };
  isOpponentReady: boolean;
  onReady: () => void;
}) {
  const [isReady, setIsReady] = useState(false);

  const handleReady = () => {
    setIsReady(true);
    onReady();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center w-full max-w-md"
    >
      <div className="text-5xl mb-6">⚔️</div>

      {/* Игроки */}
      <div className="flex items-center justify-center gap-8 mb-8">
        <div className="text-center">
          <PlayerAvatar
            name={myPlayer?.odName || "Я"}
            photo={myPlayer?.odPhotoUrl}
            size="lg"
          />
          <div className="mt-2 text-white font-medium">{myPlayer?.odName || "Я"}</div>
          <div className={`mt-1 text-sm ${isReady ? "text-emerald-400" : "text-white/40"}`}>
            {isReady ? "✓ Готов" : "Не готов"}
          </div>
        </div>

        <div className="text-3xl font-black text-white/20">VS</div>

        <div className="text-center">
          <PlayerAvatar
            name={opponentPlayer?.odName || "Соперник"}
            photo={opponentPlayer?.odPhotoUrl}
            size="lg"
          />
          <div className="mt-2 text-white font-medium">{opponentPlayer?.odName || "Соперник"}</div>
          <div className={`mt-1 text-sm ${isOpponentReady ? "text-emerald-400" : "text-white/40"}`}>
            {isOpponentReady ? "✓ Готов" : "Ожидание..."}
          </div>
        </div>
      </div>

      {/* Кнопка */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleReady}
        disabled={isReady}
        className={`
          w-full py-4 rounded-2xl font-bold text-lg transition-all
          ${isReady
            ? "bg-emerald-600/50 text-white/70"
            : "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
          }
        `}
        style={!isReady ? { boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)" } : undefined}
      >
        {isReady
          ? isOpponentReady
            ? "Начинаем!"
            : "Ждём соперника..."
          : "Я готов! 🎮"}
      </motion.button>
    </motion.div>
  );
}

function CountdownScreen({ timeLeft }: { timeLeft: number }) {
  return (
    <motion.div
      key={timeLeft}
      initial={{ opacity: 0, scale: 2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5 }}
        className="text-9xl font-black text-white"
        style={{ textShadow: "0 0 60px rgba(139, 92, 246, 0.8)" }}
      >
        {timeLeft > 0 ? timeLeft : "GO!"}
      </motion.div>
    </motion.div>
  );
}

function QuestionScreen({
  questionIndex,
  totalQuestions,
  question,
  timeLeft,
  selectedOption,
  correctOption,
  isRevealing,
  hasAnswered,
  isOpponentAnswered,
  isSubmitting,
  onSelectOption,
}: {
  questionIndex: number;
  totalQuestions: number;
  question: { text: string; options: { id: number; text: string }[]; timeLimitSeconds: number };
  timeLeft: number;
  selectedOption: number | null;
  correctOption?: number;
  isRevealing: boolean;
  hasAnswered: boolean;
  isOpponentAnswered: boolean;
  isSubmitting: boolean;
  onSelectOption: (optionId: number) => void;
}) {
  const timePercentage = (timeLeft / question.timeLimitSeconds) * 100;
  const isUrgent = timeLeft <= 5;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-lg"
    >
      {/* Прогресс и таймер */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-white/50 text-sm font-medium">
          Вопрос {questionIndex + 1}
        </span>
        <motion.span
          animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: isUrgent ? Infinity : 0, duration: 0.5 }}
          className={`text-lg font-bold ${isUrgent ? "text-red-400" : "text-white"}`}
        >
          ⏱ {timeLeft}с
        </motion.span>
      </div>

      {/* Прогресс-бар */}
      <div className="h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
        <motion.div
          className={`h-full ${isUrgent ? "bg-red-500" : "bg-violet-500"}`}
          initial={{ width: "100%" }}
          animate={{ width: `${timePercentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Вопрос */}
      <div className="bg-white/5 rounded-2xl p-5 mb-6 border border-white/10 backdrop-blur-sm">
        <p className="text-lg text-white font-medium leading-relaxed">{question.text}</p>
      </div>

      {/* Варианты ответов */}
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isSelected = selectedOption === option.id;
          const isCorrect = correctOption === option.id;
          const isWrong = isRevealing && isSelected && !isCorrect;

          let bgClass = "bg-white/5 border-white/10 hover:bg-white/10";
          let textClass = "text-white";

          if (isRevealing) {
            if (isCorrect) {
              bgClass = "bg-emerald-500/20 border-emerald-500";
              textClass = "text-emerald-100";
            } else if (isWrong) {
              bgClass = "bg-red-500/20 border-red-500";
              textClass = "text-red-100";
            } else {
              bgClass = "bg-white/5 border-white/10 opacity-50";
            }
          } else if (isSelected) {
            bgClass = "bg-violet-600/30 border-violet-500";
          }

          return (
            <motion.button
              key={option.id}
              whileTap={!hasAnswered ? { scale: 0.98 } : undefined}
              onClick={() => onSelectOption(option.id)}
              disabled={hasAnswered || isSubmitting}
              className={`
                w-full p-4 rounded-xl border text-left transition-all
                ${bgClass} ${textClass}
                ${hasAnswered ? "cursor-default" : "cursor-pointer"}
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${isRevealing && isCorrect
                      ? "bg-emerald-500 text-white"
                      : isWrong
                      ? "bg-red-500 text-white"
                      : isSelected
                      ? "bg-violet-600 text-white"
                      : "bg-white/10 text-white/60"
                    }
                  `}
                >
                  {isRevealing && isCorrect ? "✓" : isWrong ? "✗" : String.fromCharCode(65 + idx)}
                </div>
                <span className="font-medium flex-1">{option.text}</span>
                {isSubmitting && isSelected && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Статус */}
      {!isRevealing && (
        <div className="mt-4 text-center text-sm text-white/40">
          {hasAnswered && isOpponentAnswered
            ? "✅ Оба ответили — показываем результат..."
            : hasAnswered
            ? "⏳ Ждём ответа соперника..."
            : isOpponentAnswered
            ? "⚡ Соперник уже ответил!"
            : ""}
        </div>
      )}
    </motion.div>
  );
}

function FinishScreen({
  userId,
  winnerId,
  myScore,
  opponentScore,
  myPlayer,
  opponentPlayer,
  onExit,
}: {
  userId: number;
  winnerId: number | null;
  myScore: number;
  opponentScore: number;
  myPlayer?: { odName: string; odPhotoUrl: string | null };
  opponentPlayer?: { odName: string; odPhotoUrl: string | null };
  onExit: () => void;
}) {
  const isWinner = winnerId === userId;
  const isDraw = winnerId === null;

  // XP награды (примерные, реальные приходят от сервера)
  const xpEarned = isWinner ? 50 : isDraw ? 30 : 10;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", duration: 0.6 }}
      className="text-center w-full max-w-md"
    >
      {/* Иконка результата */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-7xl mb-4"
      >
        {isWinner ? "🏆" : isDraw ? "🤝" : "😔"}
      </motion.div>

      {/* Заголовок */}
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`text-4xl font-black mb-6 ${
          isWinner ? "text-amber-400" : isDraw ? "text-white" : "text-white/70"
        }`}
      >
        {isWinner ? "Победа!" : isDraw ? "Ничья!" : "Поражение"}
      </motion.h2>

      {/* Счёт */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-8 mb-8"
      >
        <div className="text-center">
          <PlayerAvatar
            name={myPlayer?.odName || "Я"}
            photo={myPlayer?.odPhotoUrl}
            size="md"
          />
          <div className="mt-2 text-4xl font-bold text-amber-400">{myScore}</div>
          <div className="text-sm text-white/50">Ты</div>
        </div>

        <div className="text-3xl font-black text-white/20">:</div>

        <div className="text-center">
          <PlayerAvatar
            name={opponentPlayer?.odName || "Соперник"}
            photo={opponentPlayer?.odPhotoUrl}
            size="md"
          />
          <div className="mt-2 text-4xl font-bold text-amber-400">{opponentScore}</div>
          <div className="text-sm text-white/50">{opponentPlayer?.odName}</div>
        </div>
      </motion.div>

      {/* XP награда */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-8"
      >
        <span className="text-emerald-400 font-bold">+{xpEarned} XP</span>
        <span className="text-emerald-300/70">получено</span>
      </motion.div>

      {/* Кнопка */}
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        whileTap={{ scale: 0.95 }}
        onClick={onExit}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-lg shadow-lg"
        style={{ boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)" }}
      >
        Готово
      </motion.button>
    </motion.div>
  );
}
