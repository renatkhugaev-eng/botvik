/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CHALLENGE FRIEND — Выбор друга и квиза для дуэли (True Crime Style)
 * ══════════════════════════════════════════════════════════════════════════════
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type Friend = {
  id: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  stats?: {
    totalScore: number;
    gamesPlayed: number;
    bestScore: number;
  };
};

type Quiz = {
  id: number;
  title: string;
  description: string | null;
  questionsCount: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export default function ChallengePage() {
  const session = useMiniAppSession();
  const router = useRouter();

  const [step, setStep] = useState<"friend" | "quiz">("friend");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ID пользователя (с проверкой)
  const userId = session.status === "ready" ? session.user.id : null;

  // Загрузка друзей
  useEffect(() => {
    if (session.status !== "ready" || !userId) return;
    
    async function loadFriends() {
      try {
        const data = await api.get<{ 
          friends?: Friend[]; 
          incomingRequests?: unknown[]; 
          outgoingRequests?: unknown[];
          error?: string;
        }>(
          `/api/friends?userId=${userId}`
        );
        
        if (data.error) {
          console.error("[Challenge] API error:", data.error);
          setError("Не удалось загрузить друзей");
          return;
        }
        
        if (data.friends && Array.isArray(data.friends)) {
          setFriends(data.friends);
        } else {
          setFriends([]);
        }
      } catch (err) {
        console.error("[Challenge] Failed to load friends:", err);
        setError("Ошибка загрузки друзей");
      } finally {
        setLoading(false);
      }
    }

    loadFriends();
  }, [session.status, userId]);

  // Загрузка квизов
  useEffect(() => {
    if (session.status !== "ready" || !userId) return;
    
    async function loadQuizzes() {
      try {
        const data = await api.get<{ quizzes: Quiz[] }>("/api/quiz");
        if (data.quizzes && Array.isArray(data.quizzes)) {
          setQuizzes(data.quizzes);
        }
      } catch (err) {
        console.error("[Challenge] Failed to load quizzes:", err);
      }
    }

    if (step === "quiz") {
      loadQuizzes();
    }
  }, [step, session.status, userId]);

  // Выбор друга
  const handleSelectFriend = (friend: Friend) => {
    haptic.light();
    setSelectedFriend(friend);
    setStep("quiz");
  };

  // Отправка вызова
  const handleChallenge = async () => {
    if (!selectedFriend || !selectedQuiz) return;

    setSending(true);
    setError(null);
    haptic.medium();

    try {
      const result = await api.post<{ ok: boolean; duel?: { id: string }; error?: string }>(
        "/api/duels",
        {
          opponentId: selectedFriend.id,
          quizId: selectedQuiz.id,
        }
      );

      if (result.ok && result.duel) {
        haptic.success();
        router.push("/miniapp/duels");
      } else {
        setError(result.error || "Не удалось отправить вызов");
        haptic.error();
      }
    } catch (err) {
      setError("Ошибка сети");
      haptic.error();
    } finally {
      setSending(false);
    }
  };

  if (session.status !== "ready") return null;

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] px-4 py-6 pb-28">
      {/* Background texture */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-red-900/10 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            haptic.light();
            if (step === "quiz") {
              setStep("friend");
              setSelectedQuiz(null);
            } else {
              router.back();
            }
          }}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">
            {step === "friend" ? "Выбери подозреваемого" : "Выбери дело"}
          </h1>
          <p className="text-sm text-white/40">
            {step === "friend"
              ? "Вызови на допрос"
              : `Допрос: ${selectedFriend?.firstName || selectedFriend?.username}`}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="relative z-10 flex items-center gap-2 mb-6">
        <div className={`flex-1 h-1 rounded-full transition-colors ${step === "friend" ? "bg-red-600" : "bg-red-600"}`} />
        <div className={`flex-1 h-1 rounded-full transition-colors ${step === "quiz" ? "bg-red-600" : "bg-white/10"}`} />
      </div>

      <AnimatePresence mode="wait">
        {step === "friend" && (
          <motion.div
            key="friends"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="relative z-10 space-y-3"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-red-900/30 border-t-red-600" />
                <p className="mt-4 text-sm text-white/40">Поиск подозреваемых...</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔍</div>
                <div className="text-lg font-semibold text-white mb-2">Нет подозреваемых</div>
                <div className="text-white/40 mb-6">Добавь друзей, чтобы вызвать их на допрос</div>
                <button
                  onClick={() => router.push("/miniapp/profile")}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white font-semibold shadow-lg shadow-red-900/30"
                >
                  Найти подозреваемых
                </button>
              </div>
            ) : (
              friends.map((friend, idx) => (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <FriendCard
                    friend={friend}
                    onSelect={() => handleSelectFriend(friend)}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {step === "quiz" && (
          <motion.div
            key="quizzes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 space-y-3"
          >
            {quizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-red-900/30 border-t-red-600" />
                <p className="mt-4 text-sm text-white/40">Загрузка дел...</p>
              </div>
            ) : (
              quizzes.map((quiz, idx) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <QuizCard
                    quiz={quiz}
                    selected={selectedQuiz?.id === quiz.id}
                    onSelect={() => {
                      haptic.light();
                      setSelectedQuiz(quiz);
                    }}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-4 right-4 px-4 py-3 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-sm text-center backdrop-blur-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      {step === "quiz" && selectedQuiz && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleChallenge}
          disabled={sending}
          className="fixed bottom-6 left-4 right-4 py-4 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 text-white font-bold text-center shadow-xl shadow-red-900/40 disabled:opacity-50"
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Отправляем...
            </span>
          ) : (
            "🔍 Начать допрос"
          )}
        </motion.button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// КАРТОЧКА ДРУГА (True Crime Style)
// ═══════════════════════════════════════════════════════════════════════════

function FriendCard({ friend, onSelect }: { friend: Friend; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-red-900/30 transition-all text-left group"
    >
      {/* Аватар */}
      <div className="relative">
        {friend.photoUrl ? (
          <img
            src={friend.photoUrl}
            alt=""
            className="w-14 h-14 rounded-full object-cover ring-2 ring-red-900/30 grayscale-[30%] group-hover:grayscale-0 transition-all"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-900 to-red-800 flex items-center justify-center text-white font-bold text-xl">
            {(friend.firstName?.[0] || friend.username?.[0] || "?").toUpperCase()}
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-xs">
          🔍
        </span>
      </div>

      {/* Инфо */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">
          {friend.firstName || friend.username || "Подозреваемый"}
        </div>
        <div className="text-sm text-white/40">
          {friend.stats 
            ? `${friend.stats.gamesPlayed} игр • ${friend.stats.totalScore} очков` 
            : "0 игр • 0 очков"}
        </div>
      </div>

      {/* Arrow */}
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-900/30 transition-colors">
        <svg className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// КАРТОЧКА КВИЗА (True Crime Style)
// ═══════════════════════════════════════════════════════════════════════════

function QuizCard({
  quiz,
  selected,
  onSelect,
}: {
  quiz: Quiz;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
        selected
          ? "bg-red-900/20 border-red-700/50 shadow-lg shadow-red-900/20"
          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-red-900/30"
      }`}
    >
      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
        selected 
          ? "bg-gradient-to-br from-red-700 to-red-600" 
          : "bg-white/5"
      }`}>
        📁
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{quiz.title}</div>
        <div className="text-sm text-white/40">
          {quiz.questionsCount} вопросов • Дело #{quiz.id}
        </div>
      </div>

      {/* Check */}
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
        selected 
          ? "bg-red-600 border-red-600" 
          : "border-white/20"
      }`}>
        {selected && (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}
