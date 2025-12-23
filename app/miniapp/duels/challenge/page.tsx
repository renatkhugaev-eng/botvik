/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CHALLENGE FRIEND — Выбор друга и квиза для дуэли
 * ══════════════════════════════════════════════════════════════════════════════
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import { levelFromXp, getLevelTitle } from "@/lib/xp";

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
        const data = await api.get<{ friends: Friend[]; incomingRequests: unknown[]; outgoingRequests: unknown[] }>(
          `/api/friends?userId=${userId}`
        );
        if (data.friends) {
          setFriends(data.friends);
        }
      } catch (err) {
        console.error("[Challenge] Failed to load friends:", err);
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
        const data = await api.get<Quiz[]>(`/api/quiz?userId=${userId}`);
        // API возвращает массив напрямую
        if (Array.isArray(data)) {
          setQuizzes(data);
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
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
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
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">
            {step === "friend" ? "Выбери соперника" : "Выбери квиз"}
          </h1>
          <p className="text-sm text-white/50">
            {step === "friend"
              ? "Вызови друга на дуэль"
              : `Дуэль с ${selectedFriend?.firstName || selectedFriend?.username}`}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex-1 h-1 rounded-full ${step === "friend" ? "bg-violet-500" : "bg-violet-500"}`} />
        <div className={`flex-1 h-1 rounded-full ${step === "quiz" ? "bg-violet-500" : "bg-white/10"}`} />
      </div>

      <AnimatePresence mode="wait">
        {step === "friend" && (
          <motion.div
            key="friends"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-3"
          >
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👥</div>
                <div className="text-white/50 mb-4">У тебя пока нет друзей</div>
                <button
                  onClick={() => router.push("/miniapp/profile")}
                  className="px-6 py-2 rounded-xl bg-violet-600 text-white font-medium"
                >
                  Добавить друзей
                </button>
              </div>
            ) : (
              friends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onSelect={() => handleSelectFriend(friend)}
                />
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
            className="space-y-3"
          >
            {quizzes.length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
              </div>
            ) : (
              quizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  selected={selectedQuiz?.id === quiz.id}
                  onSelect={() => {
                    haptic.light();
                    setSelectedQuiz(quiz);
                  }}
                />
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
            className="fixed bottom-24 left-4 right-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm text-center"
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
          className="fixed bottom-6 left-4 right-4 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-center shadow-lg disabled:opacity-50"
          style={{ boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)" }}
        >
          {sending ? "Отправляем..." : "⚔️ Отправить вызов"}
        </motion.button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// КАРТОЧКА ДРУГА
// ═══════════════════════════════════════════════════════════════════════════

function FriendCard({ friend, onSelect }: { friend: Friend; onSelect: () => void }) {
  // Приблизительный расчёт уровня из totalScore (если нет XP)
  const estimatedXp = friend.stats?.totalScore ?? 0;
  const level = levelFromXp(estimatedXp);
  const { icon: levelIcon } = getLevelTitle(level);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
    >
      {/* Аватар */}
      <div className="relative">
        {friend.photoUrl ? (
          <img
            src={friend.photoUrl}
            alt=""
            className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-500/50"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {(friend.firstName?.[0] || friend.username?.[0] || "?").toUpperCase()}
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 text-sm">{levelIcon}</span>
      </div>

      {/* Инфо */}
      <div className="flex-1">
        <div className="font-semibold text-white">
          {friend.firstName || friend.username || "Игрок"}
        </div>
        <div className="text-sm text-white/50">
          {friend.stats ? `${friend.stats.gamesPlayed} игр` : "Уровень 1"}
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// КАРТОЧКА КВИЗА
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
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
        selected
          ? "bg-violet-600/20 border-violet-500"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl">
        🎯
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{quiz.title}</div>
        <div className="text-sm text-white/50">
          {quiz.questionsCount} вопросов
        </div>
      </div>

      {/* Check */}
      {selected && (
        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
