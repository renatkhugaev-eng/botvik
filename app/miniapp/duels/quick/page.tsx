/**
 * ══════════════════════════════════════════════════════════════════════════════
 * QUICK DUEL PAGE — Быстрая игра (поиск соперника)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Позволяет игроку быстро найти соперника для дуэли.
 * Система матчмейкинга подбирает соперника по уровню.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type Quiz = {
  id: number;
  title: string;
  description: string | null;
};

type MatchmakingResponse = {
  ok: boolean;
  status: "searching" | "found" | "timeout";
  duel?: {
    id: string;
  };
  roomId?: string;
  opponent?: {
    firstName: string;
    photoUrl: string | null;
  };
  error?: string;
};

type SearchState = "idle" | "selecting" | "searching" | "found" | "starting";

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export default function QuickDuelPage() {
  const session = useMiniAppSession();
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchTime, setSearchTime] = useState(0);
  const [foundOpponent, setFoundOpponent] = useState<{ firstName: string; photoUrl: string | null } | null>(null);
  
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка квизов
  const loadQuizzes = useCallback(async () => {
    try {
      setError(null);
      console.log("[QuickDuel] Loading quizzes...");
      
      const data = await api.get<{ quizzes: Quiz[] }>("/api/quiz");
      console.log("[QuickDuel] Response:", data);
      
      if (data.quizzes && data.quizzes.length > 0) {
        setQuizzes(data.quizzes);
        setSelectedQuiz(data.quizzes[0]);
        setSearchState("selecting");
        console.log("[QuickDuel] Loaded", data.quizzes.length, "quizzes");
      } else {
        console.warn("[QuickDuel] No quizzes available");
        setError("Нет доступных квизов");
        setSearchState("selecting"); // Всё равно переключаем, чтобы показать сообщение
      }
    } catch (err) {
      console.error("[QuickDuel] Failed to load quizzes:", err);
      setError("Ошибка загрузки квизов");
      setSearchState("selecting"); // Показываем ошибку вместо бесконечной загрузки
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    };
  }, []);

  // Старт поиска соперника
  const startSearch = async () => {
    if (!selectedQuiz || searchState === "searching") return;
    
    haptic.medium();
    setSearchState("searching");
    setSearchTime(0);

    // Таймер для отображения времени поиска
    searchIntervalRef.current = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);

    try {
      // Запрос на matchmaking (сервер сам решает — реальный игрок или AI)
      const result = await api.post<MatchmakingResponse>("/api/duels/matchmaking", {
        quizId: selectedQuiz.id,
      });

      if (searchIntervalRef.current) {
        clearInterval(searchIntervalRef.current);
      }

      if (result.ok && result.duel) {
        // Нашли соперника
        setSearchState("found");
        setFoundOpponent(result.opponent || { firstName: "Соперник", photoUrl: null });
        
        haptic.success();

        // Небольшая пауза для показа "Соперник найден!"
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setSearchState("starting");
        
        // Переход в игру
        router.push(`/miniapp/duels/${result.duel.id}`);
      } else {
        // Ошибка
        haptic.error();
        setSearchState("selecting");
        console.error("[QuickDuel] Matchmaking failed:", result.error);
      }
    } catch (error) {
      if (searchIntervalRef.current) {
        clearInterval(searchIntervalRef.current);
      }
      haptic.error();
      setSearchState("selecting");
      console.error("[QuickDuel] Error:", error);
    }
  };

  // Отмена поиска
  const cancelSearch = () => {
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
    }
    haptic.light();
    setSearchState("selecting");
    setSearchTime(0);
  };

  if (session.status !== "ready") return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-950/15 rounded-full blur-[120px]" />
      </div>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />

      {/* Content */}
      <div className="relative z-10 px-4 py-6 pb-28">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              haptic.light();
              if (searchState === "searching") {
                cancelSearch();
              } else {
                router.back();
              }
            }}
            className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Быстрая игра</h1>
            <p className="text-sm text-zinc-500">Найди соперника за секунды</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Выбор квиза */}
          {(searchState === "idle" || searchState === "selecting") && (
            <motion.div
              key="selecting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-6">
                <h2 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Выбери квиз</h2>
                
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-500 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                      onClick={loadQuizzes}
                      className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                    >
                      Повторить
                    </button>
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-zinc-500">Нет доступных квизов</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quizzes.map((quiz) => (
                      <motion.button
                        key={quiz.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          haptic.light();
                          setSelectedQuiz(quiz);
                        }}
                        className={`w-full p-4 rounded-xl text-left transition-all ${
                          selectedQuiz?.id === quiz.id
                            ? "bg-gradient-to-r from-red-900/50 to-red-950/50 border border-red-700"
                            : "bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedQuiz?.id === quiz.id
                              ? "border-red-500 bg-red-500"
                              : "border-zinc-600"
                          }`}>
                            {selectedQuiz?.id === quiz.id && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{quiz.title}</p>
                            {quiz.description && (
                              <p className="text-xs text-zinc-500 truncate">{quiz.description}</p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Поиск соперника */}
          {searchState === "searching" && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-16"
            >
              {/* Animated search indicator */}
              <div className="relative w-32 h-32 mb-8">
                {/* Outer pulse rings */}
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-red-500"
                />
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut", delay: 0.5 }}
                  className="absolute inset-0 rounded-full border-2 border-red-500"
                />
                
                {/* Rotating ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-2 rounded-full border-4 border-zinc-800 border-t-red-500"
                />
                
                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-red-800 to-red-950 flex items-center justify-center shadow-xl"
                  >
                    <span className="text-3xl">🔍</span>
                  </motion.div>
                </div>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Поиск соперника...</h2>
              <p className="text-zinc-500 mb-4">
                {searchTime < 3 
                  ? "Ищем игроков поблизости" 
                  : searchTime < 6 
                    ? "Расширяем поиск..." 
                    : "Почти нашли!"}
              </p>
              
              <div className="flex items-center gap-2 text-zinc-600">
                <span className="font-mono">{searchTime}с</span>
              </div>

              <button
                onClick={cancelSearch}
                className="mt-8 px-6 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Отменить
              </button>
            </motion.div>
          )}

          {/* Соперник найден */}
          {(searchState === "found" || searchState === "starting") && foundOpponent && (
            <motion.div
              key="found"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="relative mb-8"
              >
                {/* Success glow */}
                <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-xl" />
                
                {/* Avatar */}
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-500 shadow-xl shadow-emerald-900/30">
                  {foundOpponent.photoUrl ? (
                    <img 
                      src={foundOpponent.photoUrl} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-400">
                      {foundOpponent.firstName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                
                {/* Check mark */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </motion.div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold text-emerald-400 mb-2"
              >
                Соперник найден!
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-white font-medium mb-4"
              >
                {foundOpponent.firstName}
              </motion.p>

              {searchState === "starting" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-zinc-400"
                >
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                  <span>Подключение...</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Start Button */}
      {searchState === "selecting" && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={startSearch}
            disabled={!selectedQuiz}
            className={`w-full py-4 rounded-xl font-bold text-center shadow-xl transition-all ${
              selectedQuiz
                ? "bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-red-900/30"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            🔍 Найти соперника
          </motion.button>
        </div>
      )}
    </div>
  );
}
