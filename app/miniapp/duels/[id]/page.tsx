/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL ROOM — Modern Real-time Duel with Liveblocks
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Современный UI дуэлей:
 * - Glassmorphism эффекты
 * - Плавные анимации и переходы
 * - Круговой таймер
 * - Эффектные экраны результатов
 */

"use client";

import { useState, useEffect, useMemo } from "react";
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
    isConnected,
    currentQuestion,
    myPlayer,
    opponentPlayer,
    revealedAnswers,
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

  useEffect(() => {
    setSelectedOption(null);
  }, [gameState.currentQuestionIndex]);

  const handleSelectOption = async (optionId: number) => {
    if (!isMyTurn || isSubmitting) return;
    haptic.light();
    setSelectedOption(optionId);
    const result = await submitAnswer(optionId);
    if (result?.isCorrect) haptic.success();
    else if (result) haptic.error();
  };

  const handleReady = () => {
    haptic.medium();
    setReady();
  };

  const handleForfeit = async () => {
    haptic.error();
    setShowForfeitConfirm(false);
    await forfeit();
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] flex flex-col relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-fuchsia-600/10 blur-[150px]" />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      {/* Header */}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        <AnimatePresence mode="wait">
          {gameState.status === "connecting" && (
            <StatusScreen key="connecting" icon="connecting" title="Подключение" subtitle="Устанавливаем соединение..." />
          )}

          {gameState.status === "waiting_opponent" && (
            <StatusScreen key="waiting" icon="waiting" title="Ожидание" subtitle="Соперник подключается..." showPulse />
          )}

          {gameState.status === "waiting_ready" && (
            <LobbyScreen
              key="lobby"
              myPlayer={myPlayer}
              opponentPlayer={opponentPlayer}
              isOpponentReady={isOpponentReady}
              onReady={handleReady}
            />
          )}

          {gameState.status === "countdown" && (
            <CountdownScreen key="countdown" timeLeft={gameState.timeLeft} />
          )}

          {(gameState.status === "playing" || gameState.status === "revealing") && currentQuestion && (
            <QuestionScreen
              key={`q-${gameState.currentQuestionIndex}`}
              questionIndex={gameState.currentQuestionIndex}
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

          {gameState.status === "opponent_left" && (
            <StatusScreen key="left" icon="disconnected" title="Соперник ушёл" subtitle="Дуэль прервана" action={{ label: "Выйти", onClick: onExit }} />
          )}

          {gameState.status === "error" && (
            <StatusScreen key="error" icon="error" title="Ошибка" subtitle={gameState.error || "Что-то пошло не так"} action={{ label: "Назад", onClick: onExit }} />
          )}
        </AnimatePresence>
      </div>

      {/* Forfeit button */}
      {(gameState.status === "playing" || gameState.status === "revealing") && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => { haptic.warning(); setShowForfeitConfirm(true); }}
          className="fixed bottom-6 left-4 px-4 py-2.5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/50 text-sm font-medium hover:bg-white/10 hover:text-white/70 transition-all"
        >
          🏳️ Сдаться
        </motion.button>
      )}

      {/* Forfeit modal */}
      <AnimatePresence>
        {showForfeitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowForfeitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gradient-to-b from-[#1a1a2e] to-[#12121f] rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                  <span className="text-3xl">🏳️</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Сдаться?</h3>
                <p className="text-white/50 text-sm mb-6 leading-relaxed">
                  Ты проиграешь эту дуэль и не получишь XP. Соперник победит автоматически.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForfeitConfirm(false)}
                    className="flex-1 py-3 rounded-2xl bg-white/5 text-white font-medium hover:bg-white/10 transition-all border border-white/5"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleForfeit}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-medium hover:from-red-500 hover:to-rose-500 transition-all shadow-lg shadow-red-500/20"
                  >
                    Сдаться
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnecting indicator */}
      {!isConnected && gameState.status !== "connecting" && (
        <motion.div
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2.5 text-sm font-medium flex items-center justify-center gap-2"
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Переподключение...
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════════

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
    <div className="relative z-10 p-4 pb-6">
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          {/* Me */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PlayerAvatar
              name={myPlayer?.odName || "Я"}
              photo={myPlayer?.odPhotoUrl}
              size="md"
              isActive={hasAnswered}
              glowColor="emerald"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {myPlayer?.odName || "Я"}
              </div>
              {showScores && (
                <motion.div
                  key={myScore}
                  initial={{ scale: 1.3, color: "#fbbf24" }}
                  animate={{ scale: 1, color: "#ffffff" }}
                  className="text-2xl font-black"
                >
                  {myScore}
                </motion.div>
              )}
            </div>
          </div>

          {/* VS Badge */}
          <div className="flex flex-col items-center justify-center mx-4 flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-white/10 flex items-center justify-center">
              <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">VS</span>
            </div>
            {status === "playing" && (
              <div className="text-[10px] text-white/40 mt-1 font-medium text-center whitespace-nowrap">
                {hasAnswered && isOpponentAnswered ? "Оба ✓" :
                  hasAnswered ? "Ждём..." :
                  isOpponentAnswered ? "Ответил!" : ""}
              </div>
            )}
          </div>

          {/* Opponent */}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <div className="text-right min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {opponentPlayer?.odName || "?"}
              </div>
              {showScores && (
                <motion.div
                  key={opponentScore}
                  initial={{ scale: 1.3, color: "#fbbf24" }}
                  animate={{ scale: 1, color: "#ffffff" }}
                  className="text-2xl font-black"
                >
                  {opponentScore}
                </motion.div>
              )}
            </div>
            <PlayerAvatar
              name={opponentPlayer?.odName || "?"}
              photo={opponentPlayer?.odPhotoUrl}
              size="md"
              isActive={isOpponentAnswered}
              isDisconnected={!isOpponentConnected}
              glowColor="violet"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AVATAR
// ═══════════════════════════════════════════════════════════════════════════

function PlayerAvatar({
  name,
  photo,
  size = "md",
  isActive,
  isDisconnected,
  glowColor = "violet",
}: {
  name: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  isActive?: boolean;
  isDisconnected?: boolean;
  glowColor?: "violet" | "emerald" | "amber";
}) {
  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-20 h-20 text-2xl",
    xl: "w-24 h-24 text-3xl",
  };

  const glowColors = {
    violet: "shadow-violet-500/50 ring-violet-500/50",
    emerald: "shadow-emerald-500/50 ring-emerald-500/50",
    amber: "shadow-amber-500/50 ring-amber-500/50",
  };

  return (
    <div className="relative">
      {photo ? (
        <img
          src={photo}
          alt={name}
          className={`${sizeClasses[size]} rounded-2xl object-cover ring-2 ${isActive ? glowColors[glowColor] : "ring-white/20"} transition-all duration-300 ${isActive ? "shadow-lg " + glowColors[glowColor] : ""}`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold ring-2 ${isActive ? glowColors[glowColor] : "ring-white/20"} transition-all duration-300`}
        >
          {name[0]?.toUpperCase() || "?"}
        </div>
      )}
      
      {/* Status indicator */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/50"
        >
          <span className="text-[10px] text-white font-bold">✓</span>
        </motion.div>
      )}
      
      {isDisconnected && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/50"
        >
          <span className="text-[10px] text-white font-bold">!</span>
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a12] flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-[3px] border-white/10 border-t-violet-500 animate-spin" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500/20 to-transparent blur-xl" />
      </div>
      <p className="mt-6 text-white/40 font-medium">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function StatusScreen({
  icon,
  title,
  subtitle,
  showPulse,
  action,
}: {
  icon: "connecting" | "waiting" | "disconnected" | "error";
  title: string;
  subtitle?: string;
  showPulse?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  const icons = {
    connecting: (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-[3px] border-white/20 border-t-violet-400 animate-spin" />
      </div>
    ),
    waiting: (
      <div className="relative inline-flex items-center justify-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center">
          <span className="text-4xl">⏳</span>
        </div>
        {showPulse && (
          <motion.div
            animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 rounded-3xl border-2 border-amber-400/50"
          />
        )}
      </div>
    ),
    disconnected: (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-white/10 flex items-center justify-center">
        <span className="text-4xl">😔</span>
      </div>
    ),
    error: (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-white/10 flex items-center justify-center">
        <span className="text-4xl">❌</span>
      </div>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center justify-center text-center"
    >
      <div className="mb-6 flex items-center justify-center">{icons[icon]}</div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      {subtitle && <p className="text-white/40 mb-8 font-medium">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOBBY SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function LobbyScreen({
  myPlayer,
  opponentPlayer,
  isOpponentReady,
  onReady,
}: {
  myPlayer?: { odName: string; odPhotoUrl: string | null };
  opponentPlayer?: { odName: string; odPhotoUrl: string | null };
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
      className="text-center w-full max-w-md px-4"
    >
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-2xl font-bold text-white mb-2">Приготовься к бою!</h2>
        <p className="text-white/40 text-sm">Нажми "Готов" когда будешь готов начать</p>
      </motion.div>

      {/* Players */}
      <div className="flex items-center justify-center gap-6 mb-10">
        {/* Me */}
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="relative mb-3">
            <PlayerAvatar
              name={myPlayer?.odName || "Я"}
              photo={myPlayer?.odPhotoUrl}
              size="xl"
              isActive={isReady}
              glowColor="emerald"
            />
          </div>
          <div className="text-white font-semibold mb-1">{myPlayer?.odName || "Я"}</div>
          <div className={`text-xs font-medium px-3 py-1 rounded-full inline-flex items-center gap-1 ${isReady ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"}`}>
            {isReady ? <>✓ Готов</> : "Не готов"}
          </div>
        </motion.div>

        {/* VS */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="relative"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 border border-white/10 flex items-center justify-center">
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">VS</span>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="absolute -inset-2 rounded-3xl border border-dashed border-white/10"
          />
        </motion.div>

        {/* Opponent */}
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="relative mb-3">
            <PlayerAvatar
              name={opponentPlayer?.odName || "Соперник"}
              photo={opponentPlayer?.odPhotoUrl}
              size="xl"
              isActive={isOpponentReady}
              glowColor="violet"
            />
          </div>
          <div className="text-white font-semibold mb-1">{opponentPlayer?.odName || "Соперник"}</div>
          <div className={`text-xs font-medium px-3 py-1 rounded-full inline-flex items-center gap-1 ${isOpponentReady ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"}`}>
            {isOpponentReady ? <>✓ Готов</> : "Ожидание..."}
          </div>
        </motion.div>
      </div>

      {/* Ready button */}
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleReady}
        disabled={isReady}
        className={`
          w-full py-4 rounded-2xl font-bold text-lg transition-all relative overflow-hidden
          ${isReady
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25"
          }
        `}
      >
        {!isReady && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        )}
        <span className="relative z-10">
          {isReady
            ? isOpponentReady
              ? "🚀 Начинаем!"
              : "⏳ Ждём соперника..."
            : "Я готов! 🎮"}
        </span>
      </motion.button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTDOWN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function CountdownScreen({ timeLeft }: { timeLeft: number }) {
  return (
    <motion.div
      key={timeLeft}
      initial={{ opacity: 0, scale: 2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="text-center"
    >
      <div className="relative">
        {/* Outer ring */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="absolute inset-0 w-40 h-40 mx-auto rounded-full border-4 border-violet-500/50"
        />
        
        {/* Main number */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5 }}
          className="w-40 h-40 mx-auto rounded-full bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-white/10 flex items-center justify-center backdrop-blur-xl"
        >
          <span
            className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70"
            style={{ textShadow: "0 0 60px rgba(139, 92, 246, 0.8)" }}
          >
            {timeLeft > 0 ? timeLeft : "GO!"}
          </span>
        </motion.div>
      </div>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-6 text-white/40 font-medium"
      >
        {timeLeft > 0 ? "Приготовься..." : "Вперёд!"}
      </motion.p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function QuestionScreen({
  questionIndex,
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
  
  // Circular timer
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (timePercentage / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-lg px-4"
    >
      {/* Header with timer */}
      <div className="flex items-center justify-between mb-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/10">
          <span className="text-white/40 text-xs font-medium">Вопрос</span>
          <span className="text-white font-bold ml-2">{questionIndex + 1}</span>
        </div>
        
        {/* Circular timer */}
        <motion.div
          animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: isUrgent ? Infinity : 0, duration: 0.5 }}
          className="relative"
        >
          <svg width="80" height="80" className="-rotate-90">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="4"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke={isUrgent ? "#ef4444" : "#8b5cf6"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${isUrgent ? "text-red-400" : "text-white"}`}>
              {timeLeft}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Question card */}
      <motion.div
        layout
        className="bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/10 shadow-xl"
      >
        <p className="text-lg text-white font-medium leading-relaxed">{question.text}</p>
      </motion.div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isSelected = selectedOption === option.id;
          const isCorrect = correctOption === option.id;
          const isWrong = isRevealing && isSelected && !isCorrect;

          return (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileTap={!hasAnswered ? { scale: 0.98 } : undefined}
              onClick={() => onSelectOption(option.id)}
              disabled={hasAnswered || isSubmitting}
              className={`
                w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden
                ${isRevealing && isCorrect
                  ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500 shadow-lg shadow-emerald-500/20"
                  : isWrong
                  ? "bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500 shadow-lg shadow-red-500/20"
                  : isSelected
                  ? "bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border-violet-500"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                }
                ${hasAnswered && !isSelected && !isCorrect ? "opacity-40" : ""}
              `}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all
                    ${isRevealing && isCorrect
                      ? "bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg"
                      : isWrong
                      ? "bg-gradient-to-br from-red-400 to-rose-500 text-white shadow-lg"
                      : isSelected
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg"
                      : "bg-white/5 text-white/50"
                    }
                  `}
                >
                  {isRevealing && isCorrect ? "✓" : isWrong ? "✗" : String.fromCharCode(65 + idx)}
                </div>
                <span className="font-medium text-white flex-1">{option.text}</span>
                {isSubmitting && isSelected && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
              </div>
              
              {/* Selection shimmer effect */}
              {isSelected && !isRevealing && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Status */}
      {!isRevealing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            {hasAnswered && isOpponentAnswered ? (
              <><span className="text-emerald-400">✓</span><span className="text-white/50 text-sm">Оба ответили</span></>
            ) : hasAnswered ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-violet-400 animate-spin" /><span className="text-white/50 text-sm">Ждём соперника</span></>
            ) : isOpponentAnswered ? (
              <><span className="text-amber-400">⚡</span><span className="text-white/50 text-sm">Соперник ответил!</span></>
            ) : null}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FINISH SCREEN
// ═══════════════════════════════════════════════════════════════════════════

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
  myPlayer?: { odId: number; odName: string; odPhotoUrl: string | null };
  opponentPlayer?: { odId: number; odName: string; odPhotoUrl: string | null };
  onExit: () => void;
}) {
  const isWinner = winnerId === userId;
  const isDraw = winnerId === null;
  const xpEarned = isWinner ? 50 : isDraw ? 30 : 10;

  // Confetti particles
  const particles = useMemo(() => 
    Array.from({ length: isWinner ? 20 : 0 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: ['#8b5cf6', '#d946ef', '#f59e0b', '#22c55e'][Math.floor(Math.random() * 4)],
    })),
  [isWinner]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center w-full max-w-md px-4 relative"
    >
      {/* Confetti */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}%`, opacity: 1 }}
          animate={{ y: "100vh", opacity: 0 }}
          transition={{ delay: p.delay, duration: p.duration, ease: "linear" }}
          className="fixed top-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: p.color, left: `${p.x}%` }}
        />
      ))}

      {/* Result icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="mb-6"
      >
        <div className={`
          w-28 h-28 mx-auto rounded-3xl flex items-center justify-center relative
          ${isWinner
            ? "bg-gradient-to-br from-amber-400/20 to-yellow-500/20 border border-amber-400/30 shadow-xl shadow-amber-500/20"
            : isDraw
            ? "bg-gradient-to-br from-white/10 to-white/5 border border-white/20"
            : "bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10"
          }
        `}>
          <span className="text-5xl">{isWinner ? "🏆" : isDraw ? "🤝" : "😔"}</span>
          {isWinner && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              className="absolute -inset-4 rounded-[2rem] border border-dashed border-amber-400/30"
            />
          )}
        </div>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`text-4xl font-black mb-2 ${
          isWinner ? "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500" : isDraw ? "text-white" : "text-white/60"
        }`}
      >
        {isWinner ? "Победа!" : isDraw ? "Ничья!" : "Поражение"}
      </motion.h2>
      
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-white/40 mb-8"
      >
        {isWinner ? "Отличная игра! Ты победил!" : isDraw ? "Достойный соперник!" : "В следующий раз повезёт больше"}
      </motion.p>

      {/* Score comparison */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl rounded-3xl p-6 mb-8 border border-white/10"
      >
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <PlayerAvatar
              name={myPlayer?.odName || "Я"}
              photo={myPlayer?.odPhotoUrl}
              size="lg"
              isActive={isWinner}
              glowColor="amber"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: "spring" }}
              className="mt-3 text-4xl font-black text-white"
            >
              {myScore}
            </motion.div>
            <div className="text-xs text-white/40 mt-1">Ты</div>
          </div>

          <div className="text-3xl font-black text-white/20">:</div>

          <div className="text-center">
            <PlayerAvatar
              name={opponentPlayer?.odName || "?"}
              photo={opponentPlayer?.odPhotoUrl}
              size="lg"
              isActive={winnerId === opponentPlayer?.odId}
              glowColor="amber"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
              className="mt-3 text-4xl font-black text-white"
            >
              {opponentScore}
            </motion.div>
            <div className="text-xs text-white/40 mt-1">{opponentPlayer?.odName}</div>
          </div>
        </div>
      </motion.div>

      {/* XP reward */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-8"
      >
        <span className="text-emerald-400 font-bold text-lg">+{xpEarned} XP</span>
        <span className="text-emerald-400/60">получено</span>
      </motion.div>

      {/* Exit button */}
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        whileTap={{ scale: 0.97 }}
        onClick={onExit}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        />
        <span className="relative z-10">Готово</span>
      </motion.button>
    </motion.div>
  );
}
