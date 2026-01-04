/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUEL ROOM — True Crime Detective Board
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Атмосфера детективной доски расследований:
 * - Тёмный фон с тонкой текстурой
 * - Карточки как улики / фото с мест преступлений
 * - Красные акценты и нити связей
 * - Глубокие тени, объём
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { RoomProvider, initialPresence } from "@/liveblocks.config";
import { useDuelRoom, DuelStatus } from "@/lib/useDuelRoom";
import { haptic } from "@/lib/haptic";
import { api } from "@/lib/api";

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const session = useMiniAppSession();
  const duelId = params.id as string;

  if (session.status !== "ready") {
    return <LoadingScreen />;
  }

  const userId = session.user.id;
  const userName = session.user.firstName || session.user.username || "Игрок";
  const userPhoto = session.user.photoUrl;

  const emptyStorage = {
    duelId,
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
      initialPresence={{ ...initialPresence, odId: userId, odName: userName, odPhotoUrl: userPhoto }}
      initialStorage={emptyStorage}
    >
      <DuelGameContent
        duelId={duelId}
        userId={userId}
        userName={userName}
        userPhoto={userPhoto}
        onExit={() => {
          // Используем replace чтобы нельзя было вернуться назад в завершённую дуэль
          router.replace("/miniapp/duels");
        }}
      />
    </RoomProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME CONTENT
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
    questions,
    currentQuestion,
    quizId,
    myPlayer,
    opponentPlayer,
    revealedAnswers,
    isOpponentConnected,
    isOpponentReady,
    isOpponentAnswered,
    isAIMode,
    isMyTurn,
    hasAnswered,
    isSubmitting,
    setReady,
    submitAnswer,
    forfeit,
  } = useDuelRoom(duelId, userId, userName, userPhoto);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showForfeit, setShowForfeit] = useState(false);

  useEffect(() => {
    setSelectedOption(null);
  }, [gameState.currentQuestionIndex]);

  const handleAnswer = async (optionId: number) => {
    if (!isMyTurn || isSubmitting) return;
    haptic.light();
    setSelectedOption(optionId);
    const result = await submitAnswer(optionId);
    if (result?.isCorrect) haptic.success();
    else if (result) haptic.error();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      {/* Background texture */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Red ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-950/20 rounded-full blur-[120px]" />
      </div>

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

      {/* Header */}
      <Header
        myPlayer={myPlayer}
        opponentPlayer={opponentPlayer}
        myScore={gameState.myScore}
        opponentScore={gameState.opponentScore}
        isOpponentConnected={isOpponentConnected}
        isOpponentAnswered={isOpponentAnswered}
        hasAnswered={hasAnswered}
        status={gameState.status}
      />

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-5 relative z-10">
        <AnimatePresence mode="wait">
          {gameState.status === "connecting" && (
            <StatusScreen key="c" type="loading" text="Подключение к делу..." />
          )}
          {gameState.status === "waiting_opponent" && (
            <StatusScreen key="w" type="waiting" text="Ожидание подозреваемого" />
          )}
          {gameState.status === "waiting_ready" && (
            <LobbyScreen
              key="l"
              myPlayer={myPlayer}
              opponentPlayer={opponentPlayer}
              isOpponentReady={isOpponentReady}
              onReady={() => { haptic.medium(); setReady(); }}
            />
          )}
          {gameState.status === "countdown" && (
            <CountdownScreen key="cd" count={gameState.timeLeft} />
          )}
          {(gameState.status === "playing" || gameState.status === "revealing") && currentQuestion && (
            <QuestionScreen
              key={`q${gameState.currentQuestionIndex}`}
              index={gameState.currentQuestionIndex}
              total={questions.length}
              question={currentQuestion}
              timeLeft={gameState.timeLeft}
              selected={selectedOption}
              correctId={revealedAnswers[gameState.currentQuestionIndex]}
              isRevealing={gameState.status === "revealing"}
              hasAnswered={hasAnswered}
              oppAnswered={isOpponentAnswered}
              submitting={isSubmitting}
              onSelect={handleAnswer}
            />
          )}
          {gameState.status === "finished" && (
            <FinishScreen
              key="f"
              isWinner={gameState.winnerId === userId}
              isDraw={gameState.winnerId === null}
              myScore={gameState.myScore}
              oppScore={gameState.opponentScore}
              myPlayer={myPlayer}
              oppPlayer={opponentPlayer}
              duelId={duelId}
              quizId={quizId}
              isAIMode={isAIMode}
              onExit={onExit}
            />
          )}
          {gameState.status === "opponent_left" && (
            <StatusScreen key="ol" type="error" text="Подозреваемый сбежал" action={{ label: "Закрыть дело", fn: onExit }} />
          )}
          {gameState.status === "error" && (
            <StatusScreen key="e" type="error" text="Ошибка связи" action={{ label: "Назад", fn: onExit }} />
          )}
        </AnimatePresence>
      </div>

      {/* Forfeit */}
      {(gameState.status === "playing" || gameState.status === "revealing") && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowForfeit(true)}
          className="fixed bottom-5 left-5 px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 bg-black/50 hover:bg-red-950/50 border border-zinc-800 hover:border-red-900/50 rounded-lg transition-all z-20"
        >
          🏳️ Сдаться
        </motion.button>
      )}

      {/* Forfeit Modal */}
      <AnimatePresence>
        {showForfeit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForfeit(false)}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                    <span className="text-3xl">🏳️</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">Признать поражение?</h3>
                  <p className="text-sm text-zinc-500">Противник автоматически победит</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForfeit(false)}
                    className="flex-1 py-3 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => { haptic.error(); setShowForfeit(false); forfeit(); }}
                    className="flex-1 py-3 text-sm text-white bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 rounded-xl transition-all shadow-lg shadow-red-900/30"
                  >
                    Сдаться
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Lost */}
      {!isConnected && gameState.status !== "connecting" && (
        <motion.div
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className="fixed top-0 inset-x-0 py-2 text-center text-xs text-yellow-400 bg-yellow-950/80 backdrop-blur-sm border-b border-yellow-900/50 z-50"
        >
          ⚡ Переподключение...
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════════

function Header({
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
  const showScore = ["playing", "revealing", "finished"].includes(status);

  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative z-20"
    >
      {/* Glass header */}
      <div className="mx-3 mt-3 p-4 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl border border-zinc-800/50 shadow-xl">
        <div className="flex items-center">
          {/* Me */}
          <div className="flex-1 flex items-center gap-3">
            <PlayerCard
              name={myPlayer?.odName || "Я"}
              photo={myPlayer?.odPhotoUrl}
              score={showScore ? myScore : undefined}
              answered={hasAnswered}
              isMe
            />
          </div>

          {/* VS Badge */}
          <div className="flex-shrink-0 mx-3">
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="relative"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-900 to-red-950 border border-red-800/50 flex items-center justify-center shadow-lg shadow-red-900/30">
                <span className="text-sm font-black text-red-300">VS</span>
              </div>
              {/* Pulse effect */}
              <div className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            </motion.div>
          </div>

          {/* Opponent */}
          <div className="flex-1 flex items-center gap-3 justify-end">
            <PlayerCard
              name={opponentPlayer?.odName || "?"}
              photo={opponentPlayer?.odPhotoUrl}
              score={showScore ? opponentScore : undefined}
              answered={isOpponentAnswered}
              offline={!isOpponentConnected}
              reverse
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER CARD
// ═══════════════════════════════════════════════════════════════════════════

function PlayerCard({
  name,
  photo,
  score,
  answered,
  offline,
  isMe,
  reverse,
}: {
  name: string;
  photo?: string | null;
  score?: number;
  answered?: boolean;
  offline?: boolean;
  isMe?: boolean;
  reverse?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${reverse ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className="relative">
        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${answered ? 'border-emerald-500' : 'border-zinc-700'} shadow-lg`}>
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-lg">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        {/* Status indicator */}
        {answered && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center shadow-lg"
          >
            <span className="text-[10px] text-white">✓</span>
          </motion.div>
        )}
        {offline && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-md flex items-center justify-center animate-pulse shadow-lg">
            <span className="text-[10px] text-white">!</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={reverse ? 'text-right' : ''}>
        <p className="text-xs text-zinc-400 truncate max-w-[70px]">{name}</p>
        {score !== undefined && (
          <motion.p
            key={score}
            initial={{ scale: 1.2, color: '#fbbf24' }}
            animate={{ scale: 1, color: '#ffffff' }}
            className="text-2xl font-bold tabular-nums"
          >
            {score}
          </motion.p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING
// ═══════════════════════════════════════════════════════════════════════════

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-2 border-zinc-800 border-t-red-600 animate-spin" />
        <div className="absolute inset-0 w-16 h-16 rounded-xl border-2 border-transparent border-b-red-900/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function StatusScreen({
  type,
  text,
  action,
}: {
  type: "loading" | "waiting" | "error";
  text: string;
  action?: { label: string; fn: () => void };
}) {
  const icons = {
    loading: "🔍",
    waiting: "👤",
    error: "⚠️",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      <div className="relative inline-block mb-6">
        {/* Spinner ring for loading */}
        {type === "loading" && (
          <div className="absolute -inset-2">
            <div className="w-full h-full rounded-full border-2 border-zinc-800 border-t-red-500 animate-spin" />
          </div>
        )}
        
        {/* Pulse for waiting */}
        {type === "waiting" && (
          <motion.div
            animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -inset-2 rounded-full bg-red-500/30"
          />
        )}
        
        {/* Icon box */}
        <motion.div 
          animate={type === "waiting" ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className="relative w-20 h-20 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center shadow-xl"
        >
          <span className="text-3xl">{icons[type]}</span>
        </motion.div>
      </div>
      <p className="text-zinc-400 mb-6">{text}</p>
      {action && (
        <button
          onClick={action.fn}
          className="px-8 py-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-xl font-medium shadow-lg shadow-red-900/30 transition-all"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOBBY
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
  const [ready, setReady] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-sm"
    >
      {/* Case file card */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8 pb-4 border-b border-zinc-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/50 border border-red-900/30 rounded-lg mb-3">
            <span className="text-red-400 text-xs">📁</span>
            <span className="text-[10px] tracking-[0.2em] text-red-400 uppercase">Дело открыто</span>
          </div>
          <h2 className="text-lg font-semibold text-white">Допрос подозреваемых</h2>
        </div>

        {/* Players */}
        <div className="flex items-center justify-between mb-8">
          <LobbyPlayer
            name={myPlayer?.odName || "Я"}
            photo={myPlayer?.odPhotoUrl}
            ready={ready}
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-900 to-red-950 border border-red-800/50 flex items-center justify-center">
              <span className="text-xs font-bold text-red-300">VS</span>
            </div>
            {/* Connection line */}
            <div className="flex gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              <div className={`w-1.5 h-1.5 rounded-full ${ready && isOpponentReady ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              <div className={`w-1.5 h-1.5 rounded-full ${isOpponentReady ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
            </div>
          </div>

          <LobbyPlayer
            name={opponentPlayer?.odName || "?"}
            photo={opponentPlayer?.odPhotoUrl}
            ready={isOpponentReady}
          />
        </div>

        {/* Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { setReady(true); onReady(); }}
          disabled={ready}
          className={`w-full py-4 rounded-xl font-medium transition-all ${
            ready
              ? "bg-zinc-800 text-zinc-500 border border-zinc-700"
              : "bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-900/30"
          }`}
        >
          {ready ? (isOpponentReady ? "⏳ Начинаем..." : "⏳ Ожидание соперника") : "🎯 Готов к допросу"}
        </motion.button>
      </div>
    </motion.div>
  );
}

function LobbyPlayer({
  name,
  photo,
  ready,
}: {
  name: string;
  photo?: string | null;
  ready: boolean;
}) {
  return (
    <div className="flex flex-col items-center w-24">
      {/* Avatar with glow effect when ready */}
      <div className="relative w-16 h-16">
        {ready && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -inset-1 rounded-full bg-emerald-500/30 blur-sm"
          />
        )}
        <div className={`relative w-16 h-16 rounded-full overflow-hidden border-2 ${ready ? 'border-emerald-500' : 'border-zinc-700'} shadow-lg`}>
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xl">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-400 truncate w-full text-center">{name}</p>
      <p className={`mt-1 text-[10px] uppercase tracking-wider text-center ${ready ? 'text-emerald-400' : 'text-zinc-600'}`}>
        {ready ? "✓ Готов" : "Ожидание"}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTDOWN
// ═══════════════════════════════════════════════════════════════════════════

function CountdownScreen({ count }: { count: number }) {
  return (
    <motion.div
      key={count}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="text-center"
    >
      <div className="relative inline-block">
        {/* Outer pulse ring */}
        <motion.div
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border-2 border-red-500"
        />
        
        {/* Second pulse ring */}
        <motion.div
          initial={{ scale: 1, opacity: 0.4 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border border-red-600"
        />
        
        {/* Main circle */}
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-red-800 to-red-950 border-2 border-red-600 flex items-center justify-center shadow-2xl shadow-red-900/50">
          <span className={`font-bold text-white ${count > 0 ? 'text-6xl' : 'text-4xl'}`}>
            {count > 0 ? count : "GO!"}
          </span>
        </div>
      </div>
      
      {/* Label */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-zinc-500 text-sm"
      >
        {count > 0 ? "Приготовься..." : "Начали!"}
      </motion.p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION
// ═══════════════════════════════════════════════════════════════════════════

function QuestionScreen({
  index,
  total,
  question,
  timeLeft,
  selected,
  correctId,
  isRevealing,
  hasAnswered,
  oppAnswered,
  submitting,
  onSelect,
}: {
  index: number;
  total: number;
  question: { text: string; options: { id: number; text: string }[]; timeLimitSeconds: number };
  timeLeft: number;
  selected: number | null;
  correctId?: number;
  isRevealing: boolean;
  hasAnswered: boolean;
  oppAnswered: boolean;
  submitting: boolean;
  onSelect: (id: number) => void;
}) {
  const pct = (timeLeft / question.timeLimitSeconds) * 100;
  const critical = timeLeft <= 5;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full max-w-md"
    >
      {/* Timer bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800">
          <span className="text-xs text-zinc-500">Вопрос</span>
          <span className="text-sm font-bold text-white">{index + 1}/{total}</span>
        </div>
        <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <motion.div
            className={`h-full rounded-full ${critical ? 'bg-gradient-to-r from-red-600 to-red-500' : 'bg-gradient-to-r from-red-700 to-red-600'}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className={`px-3 py-1 rounded-lg font-mono font-bold ${critical ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Question card */}
      <motion.div 
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        className="mb-4 p-5 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl"
      >
        <p className="text-white text-lg leading-relaxed">{question.text}</p>
      </motion.div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((opt, i) => {
          const isSel = selected === opt.id;
          const isCorrect = correctId === opt.id;
          const isWrong = isRevealing && isSel && !isCorrect;

          let bgClass = "bg-gradient-to-r from-zinc-900 to-zinc-900/50";
          let borderClass = "border-zinc-800 hover:border-zinc-600";
          let textClass = "text-zinc-300";

          if (isRevealing && isCorrect) {
            bgClass = "bg-gradient-to-r from-emerald-950 to-emerald-900/50";
            borderClass = "border-emerald-600";
            textClass = "text-emerald-300";
          } else if (isWrong) {
            bgClass = "bg-gradient-to-r from-red-950 to-red-900/50";
            borderClass = "border-red-600";
            textClass = "text-red-300";
          } else if (isSel) {
            bgClass = "bg-gradient-to-r from-zinc-800 to-zinc-800/50";
            borderClass = "border-zinc-500";
            textClass = "text-white";
          }

          const faded = hasAnswered && !isSel && !isCorrect;

          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: faded ? 0.4 : 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(opt.id)}
              disabled={hasAnswered || submitting}
              className={`w-full p-4 rounded-xl border text-left transition-all ${bgClass} ${borderClass} shadow-lg`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  isRevealing && isCorrect ? 'bg-emerald-600 text-white' :
                  isWrong ? 'bg-red-600 text-white' :
                  isSel ? 'bg-zinc-600 text-white' :
                  'bg-zinc-800 text-zinc-500'
                }`}>
                  {isRevealing && isCorrect ? "✓" : isWrong ? "✗" : String.fromCharCode(65 + i)}
                </div>
                <span className={`flex-1 ${textClass}`}>{opt.text}</span>
                {submitting && isSel && (
                  <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Status */}
      {!isRevealing && hasAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex justify-center"
        >
          <div className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl ${oppAnswered ? 'bg-emerald-950/50 border border-emerald-900/50' : 'bg-zinc-900 border border-zinc-800'}`}>
            <span className={`text-sm ${oppAnswered ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {oppAnswered ? "✓ Оба ответили" : "⏳ Ожидание соперника..."}
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FINISH
// ═══════════════════════════════════════════════════════════════════════════

function FinishScreen({
  isWinner,
  isDraw,
  myScore,
  oppScore,
  myPlayer,
  oppPlayer,
  duelId,
  quizId,
  isAIMode,
  onExit,
}: {
  isWinner: boolean;
  isDraw: boolean;
  myScore: number;
  oppScore: number;
  myPlayer?: { odId: number; odName: string; odPhotoUrl: string | null };
  oppPlayer?: { odId: number; odName: string; odPhotoUrl: string | null };
  duelId: string;
  quizId: number | null;
  isAIMode: boolean;
  onExit: () => void;
}) {
  const router = useRouter();
  const xp = isWinner ? 50 : isDraw ? 30 : 10;
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "friend" | "loading">("loading");
  const [addingFriend, setAddingFriend] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);

  // Проверяем статус дружбы при загрузке
  useEffect(() => {
    if (!oppPlayer?.odId) {
      setFriendStatus("none");
      return;
    }

    const checkFriendship = async () => {
      try {
        const response = await api.get<{
          ok: boolean;
          isFriend: boolean;
          friendshipStatus: string | null;
        }>(`/api/me/summary?userId=${oppPlayer.odId}`);
        
        if (response.ok) {
          if (response.isFriend) {
            setFriendStatus("friend");
          } else if (response.friendshipStatus === "PENDING") {
            setFriendStatus("pending");
          } else {
            setFriendStatus("none");
          }
        } else {
          setFriendStatus("none");
        }
      } catch {
        setFriendStatus("none");
      }
    };

    checkFriendship();
  }, [oppPlayer?.odId]);

  const handleAddFriend = async () => {
    if (!oppPlayer?.odId || addingFriend) return;
    
    setAddingFriend(true);
    haptic.medium();
    
    try {
      const response = await api.post<{ ok: boolean }>("/api/friends", {
        friendId: oppPlayer.odId,
      });
      
      if (response.ok) {
        setFriendStatus("pending");
        haptic.success();
      }
    } catch {
      haptic.error();
    } finally {
      setAddingFriend(false);
    }
  };

  // Реванш — создаём новую дуэль с тем же квизом
  const handleRematch = async () => {
    if (!quizId || rematchLoading) return;
    
    setRematchLoading(true);
    haptic.medium();
    
    try {
      if (isAIMode) {
        // Для AI-бота создаём новую дуэль в режиме AI
        const response = await api.post<{
          ok: boolean;
          duel?: { id: string };
          error?: string;
        }>("/api/duels", {
          mode: "ai",
          quizId,
        });
        
        if (response.ok && response.duel) {
          haptic.success();
          router.replace(`/miniapp/duels/${response.duel.id}`);
        } else {
          console.error("[Rematch] AI duel failed:", response.error);
          haptic.error();
          setRematchLoading(false);
        }
      } else if (oppPlayer?.odId && friendStatus === "friend") {
        // Для друга создаём дуэль напрямую
        const response = await api.post<{
          ok: boolean;
          duel?: { id: string };
          error?: string;
        }>("/api/duels", {
          opponentId: oppPlayer.odId,
          quizId,
        });
        
        if (response.ok && response.duel) {
          haptic.success();
          router.replace(`/miniapp/duels/${response.duel.id}`);
        } else if (response.error === "DUEL_ALREADY_EXISTS") {
          // Уже есть активная дуэль
          haptic.warning();
          setRematchLoading(false);
        } else {
          console.error("[Rematch] Friend duel failed:", response.error);
          haptic.error();
          setRematchLoading(false);
        }
      } else {
        // Не друг и не AI — переходим в быстрый поиск
        router.push("/miniapp/duels/quick");
      }
    } catch (error) {
      console.error("[Rematch] Error:", error);
      haptic.error();
      setRematchLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-sm"
    >
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        {/* Result icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="text-center mb-6"
        >
          <div className={`w-24 h-24 mx-auto rounded-2xl flex items-center justify-center shadow-xl ${
            isWinner 
              ? 'bg-gradient-to-br from-yellow-600 to-yellow-700 border-2 border-yellow-500' 
              : isDraw 
                ? 'bg-gradient-to-br from-zinc-600 to-zinc-700 border-2 border-zinc-500'
                : 'bg-gradient-to-br from-red-900 to-red-950 border-2 border-red-800'
          }`}>
            <span className="text-5xl">{isWinner ? "🏆" : isDraw ? "🤝" : "💀"}</span>
          </div>
        </motion.div>

        {/* Verdict */}
        <div className="text-center mb-6">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`text-2xl font-bold mb-1 ${
              isWinner ? 'text-yellow-400' : isDraw ? 'text-zinc-300' : 'text-red-400'
            }`}
          >
            {isWinner ? "ПОБЕДА!" : isDraw ? "НИЧЬЯ" : "ПОРАЖЕНИЕ"}
          </motion.h2>
          <p className="text-zinc-500 text-sm">
            {isWinner ? "Подозреваемый изобличён" : isDraw ? "Недостаточно улик" : "Преступник ушёл от правосудия"}
          </p>
        </div>

        {/* Scores */}
        <div className="flex items-center justify-center gap-6 py-6 mb-6 border-y border-zinc-800">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-700 mx-auto mb-2">
              {myPlayer?.odPhotoUrl ? (
                <img src={myPlayer.odPhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold">
                  {myPlayer?.odName?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.4 }}
              className="text-3xl font-bold text-white"
            >
              {myScore}
            </motion.p>
          </div>

          <div className="text-2xl text-zinc-700">:</div>

          <div className="text-center">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-700 mx-auto mb-2">
              {oppPlayer?.odPhotoUrl ? (
                <img src={oppPlayer.odPhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold">
                  {oppPlayer?.odName?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.5 }}
              className="text-3xl font-bold text-white"
            >
              {oppScore}
            </motion.p>
          </div>
        </div>

        {/* XP */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center mb-4"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-800/50">
            <span className="text-lg">⭐</span>
            <span className="text-emerald-400 font-bold">+{xp} XP</span>
          </div>
        </motion.div>

        {/* Add Friend Button */}
        {oppPlayer && friendStatus !== "loading" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-4"
          >
            {friendStatus === "none" && (
              <button
                onClick={handleAddFriend}
                disabled={addingFriend}
                className="w-full py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingFriend ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    <span>Отправка...</span>
                  </>
                ) : (
                  <>
                    <span>👥</span>
                    <span>Добавить {oppPlayer.odName} в друзья</span>
                  </>
                )}
              </button>
            )}
            {friendStatus === "pending" && (
              <div className="w-full py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-400 font-medium text-center">
                ✓ Заявка отправлена
              </div>
            )}
            {friendStatus === "friend" && (
              <div className="w-full py-3 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 font-medium text-center">
                ✓ Уже в друзьях
              </div>
            )}
          </motion.div>
        )}

        {/* Buttons */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3"
        >
          <button
            onClick={handleRematch}
            disabled={rematchLoading || !quizId}
            className="flex-1 py-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rematchLoading ? "⏳ Создаём..." : "🔄 Реванш"}
          </button>
          <button
            onClick={() => {
              haptic.medium();
              onExit();
            }}
            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-medium shadow-lg shadow-red-900/30 transition-all active:scale-95"
          >
            📁 Выйти
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
