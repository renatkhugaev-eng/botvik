"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../../layout";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import { haptic } from "@/lib/haptic";
import { useNotify } from "@/components/InAppNotification";
import { usePerformance } from "@/lib/usePerformance";
import { fetchWithAuth } from "@/lib/api";
import Lottie from "lottie-react";
import confettiAnimation from "@/public/animations/confetti.json";

type StartResponse = {
  sessionId: number;
  quizId: number;
  totalQuestions: number;
  totalScore: number;
  attemptNumber: number;           // Номер попытки
  remainingAttempts?: number;      // Оставшиеся попытки
  currentQuestionIndex?: number;   // Текущий индекс вопроса (для возобновления)
  currentStreak?: number;          // Текущий streak (server-side)
  serverTime?: string;             // Текущее время сервера
  questionStartedAt?: string;      // Когда начался текущий вопрос (для расчёта оставшегося времени)
  questions: {
    id: number;
    text: string;
    order: number;
    difficulty: number;            // 1 = легкий, 2 = средний, 3 = сложный
    options: { id: number; text: string }[];
  }[];
};

type AnswerResponse = {
  correct: boolean;
  scoreDelta: number;
  totalScore: number;
  breakdown?: {
    base: number;
    difficultyMultiplier: number;  // Множитель сложности
    attemptMultiplier: number;     // Decay множитель попытки
    timeBonus: number;
    streakBonus: number;
    penalty: number;               // Штраф за неправильный ответ
    timeSpentMs: number;
    isSuspicious: boolean;         // Подозрительно быстрый ответ
  };
};

type RateLimitError = {
  error: "rate_limited" | "energy_depleted";
  message: string;
  waitSeconds?: number;
  waitMs?: number;           // Для энергетической системы
  waitMessage?: string;      // "2ч 30м" формат
  usedAttempts?: number;     // Использовано попыток
  maxAttempts?: number;      // Максимум попыток
  nextSlotAt?: string;       // ISO timestamp когда освободится слот
  hoursPerAttempt?: number;  // Часов на восстановление 1 попытки
};

type FinishResponse = {
  totalScore: number;
  bestScore: number;
  leaderboardScore: number;
  correctCount: number;       // Server-side accurate count
  totalQuestions: number;     // Server-side total questions
  xp: {
    earned: number;
    total: number;
    level: number;
    progress: number;
    xpToNextLevel: number;
    levelUp: boolean;
    newLevel?: number;
  };
};

const spring = { type: "spring", stiffness: 500, damping: 30 };
const QUESTION_TIME = 15; // seconds per question

// Level titles for notifications
const getLevelTitle = (level: number): string => {
  if (level >= 50) return "Легенда";
  if (level >= 40) return "Грандмастер";
  if (level >= 30) return "Мастер";
  if (level >= 20) return "Эксперт";
  if (level >= 15) return "Детектив";
  if (level >= 10) return "Следователь";
  if (level >= 5) return "Агент";
  return "Новичок";
};

export default function QuizPlayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useMiniAppSession();
  const notify = useNotify();

  const quizId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<StartResponse["questions"]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("Викторина");
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [showConfetti, setShowConfetti] = useState(false);
  const [timeoutHandled, setTimeoutHandled] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitError | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeRestoredRef = useRef(false); // Ref вместо state — обновляется мгновенно
  const initialTimeLeftRef = useRef<number | null>(null); // Сохраняем восстановленное время
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animated score
  const animatedScore = useMotionValue(0);
  const displayScore = useTransform(animatedScore, (v) => Math.round(v));

  // Performance optimization - detect device capabilities
  const perf = usePerformance();

  const currentQuestion = useMemo(
    () => (questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null),
    [currentIndex, questions],
  );

  const progress = questions.length > 0 ? ((currentIndex) / questions.length) * 100 : 0;

  // Timer effect - reset on new question
  useEffect(() => {
    if (loading || finished || answerResult || !currentQuestion) return;
    
    // НЕ сбрасываем время если оно было восстановлено с сервера (проверяем ref)
    if (timeRestoredRef.current && initialTimeLeftRef.current !== null) {
      console.log("[Timer] Using restored time:", initialTimeLeftRef.current);
      setTimeLeft(initialTimeLeftRef.current);
      // Сбрасываем флаги, следующий вопрос будет с полным временем
      timeRestoredRef.current = false;
      initialTimeLeftRef.current = null;
    } else {
    // Reset for new question
    setTimeLeft(QUESTION_TIME);
    }
    setTimeoutHandled(false);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, loading, finished, currentQuestion]);

  // Handle timeout - when timer reaches 0
  useEffect(() => {
    // Skip if already handled, or if user answered, or other conditions
    if (timeLeft !== 0 || timeoutHandled || loading || finished || answerResult || !currentQuestion) return;
    
    // Mark as handled immediately
    setTimeoutHandled(true);
    
    // Time's up!
    haptic.error();
    setStreak(0);
    
    // Show timeout feedback
    setAnswerResult({ correct: false, scoreDelta: 0, totalScore });
    setSelectedOption(-1); // -1 = timeout marker
    
    // Sync timeout with server (so page refresh works correctly)
    if (sessionId && currentQuestion) {
      fetchWithAuth(`/api/quiz/${quizId}/timeout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: currentQuestion.id }),
      }).catch(console.error);
    }
    
    // Auto-advance after 2 seconds - use ref to prevent cleanup from cancelling
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      const nextIndex = currentIndex + 1;
      
      // Reset states
      setAnswerResult(null);
      setSelectedOption(null);
      
      if (nextIndex >= questions.length) {
        // Finish quiz
        if (sessionId) {
          fetchWithAuth(`/api/quiz/${quizId}/finish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          })
            .then((res) => res.json())
            .then((data: FinishResponse) => {
              setTotalScore(data.totalScore);
              // Use server-side accurate count for star calculation
              if (data.correctCount !== undefined) {
                setCorrectCount(data.correctCount);
              }
              setFinished(true);
              haptic.heavy();
            })
            .catch(console.error);
        } else {
          setFinished(true);
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    }, 2000);
    
    // Don't clear on cleanup - let it run
  }, [timeLeft, timeoutHandled, loading, finished, answerResult, currentQuestion, currentIndex, questions.length, sessionId, quizId, totalScore]);
  
  // Cleanup auto-advance on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  // Animate score changes
  useEffect(() => {
    animate(animatedScore, totalScore, { duration: 0.5 });
  }, [totalScore, animatedScore]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    
    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  useEffect(() => {
    const preload = async () => {
      if (!quizId || Number.isNaN(quizId)) {
        setError("Некорректный quizId");
        setLoading(false);
        return;
      }

      if (session.status !== "ready") {
        setError("Пользователь не авторизован");
        setLoading(false);
        return;
      }

      try {
        const quizRes = await fetchWithAuth(`/api/quiz/${quizId}`);
        if (quizRes.ok) {
          const quizData = await quizRes.json();
          setQuizTitle(quizData.title ?? "Викторина");
        }

        const res = await fetchWithAuth(`/api/quiz/${quizId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        });

        // Обработка rate limiting
        if (res.status === 429) {
          const rateLimitData = (await res.json()) as RateLimitError;
          setRateLimitInfo(rateLimitData);
          // Запускаем countdown timer
          if (rateLimitData.waitSeconds) {
            // Rate limit — секунды
            setRateLimitCountdown(rateLimitData.waitSeconds);
          } else if (rateLimitData.waitMs) {
            // Daily limit (sliding window) — миллисекунды в секунды
            setRateLimitCountdown(Math.ceil(rateLimitData.waitMs / 1000));
          }
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error("failed_to_start");

        const data = (await res.json()) as StartResponse & { 
          finished?: boolean; 
          skippedQuestions?: number;
        };
        
        // Если сервер уже завершил квиз (все вопросы пропущены по timeout)
        if (data.finished) {
          setQuestions(data.questions);
          setSessionId(data.sessionId);
          setTotalScore(data.totalScore ?? 0);
          setFinished(true);
          if (data.skippedQuestions && data.skippedQuestions > 0) {
            notify.error("Timeout", `Пропущено вопросов: ${data.skippedQuestions}`);
          }
          setLoading(false);
          return;
        }
        
        setQuestions(data.questions);
        setSessionId(data.sessionId);
        setTotalScore(data.totalScore ?? 0);
        setAttemptNumber(data.attemptNumber ?? 1);
        setRemainingAttempts(data.remainingAttempts ?? null);
        
        // Восстанавливаем позицию (сервер уже обработал timeout'ы)
        if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > 0) {
          setCurrentIndex(data.currentQuestionIndex);
          // Показываем уведомление если были пропущены вопросы
          if (data.skippedQuestions && data.skippedQuestions > 0) {
            notify.error("Timeout", `Пропущено вопросов: ${data.skippedQuestions}`);
          }
        }
        
        // Восстанавливаем streak с сервера
        if (data.currentStreak !== undefined) {
          setStreak(data.currentStreak);
          setMaxStreak((m) => Math.max(m, data.currentStreak ?? 0));
        }
        
        // Рассчитываем оставшееся время (сервер гарантирует, что время не истекло)
        if (data.questionStartedAt && data.serverTime) {
          const serverNow = new Date(data.serverTime).getTime();
          const questionStart = new Date(data.questionStartedAt).getTime();
          const elapsedSeconds = Math.floor((serverNow - questionStart) / 1000);
          const remaining = Math.max(1, QUESTION_TIME - elapsedSeconds); // Минимум 1 секунда
          
          console.log("[Timer] Restored from server:", { elapsedSeconds, remaining });
          
          if (remaining < QUESTION_TIME) {
            timeRestoredRef.current = true;
            initialTimeLeftRef.current = remaining;
            setTimeLeft(remaining);
          }
        }
      } catch (err) {
        console.error("Failed to start quiz session", err);
        setError("Не удалось начать викторину");
      } finally {
        setLoading(false);
      }
    };

    preload();
  }, [quizId, searchParams, session]);

  const sendAnswer = useCallback(
    async (optionId: number) => {
      if (!currentQuestion || !sessionId || timeoutHandled) return;
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Prevent timeout from triggering
      setTimeoutHandled(true);
      setSubmitting(true);
      setAnswerResult(null);
      setSelectedOption(optionId);

      try {
        const res = await fetchWithAuth(`/api/quiz/${quizId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: currentQuestion.id,
            optionId,
            timeSpentMs: (QUESTION_TIME - timeLeft) * 1000,
            streak, // Send current streak for bonus calculation
          }),
        });

        if (!res.ok) throw new Error("failed_to_answer");

        const data = (await res.json()) as AnswerResponse & { timeout?: boolean };
        
        // Если сервер определил timeout (время истекло на сервере)
        if (data.timeout) {
          haptic.error();
          setStreak(0);
          setAnswerResult({ correct: false, scoreDelta: 0, totalScore: data.totalScore });
          setSelectedOption(-1); // -1 = timeout marker
          notify.error("Timeout", "Время истекло на сервере");
          return;
        }
        
        setAnswerResult(data);
        setTotalScore(data.totalScore);
        
        if (data.correct) {
          haptic.success();
          setCorrectCount((c) => c + 1);
          setStreak((s) => {
            const newStreak = s + 1;
            setMaxStreak((m) => Math.max(m, newStreak));
            return newStreak;
          });
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000); // Lottie animation duration
        } else {
          haptic.error();
          setStreak(0);
        }
      } catch (err) {
        console.error("Failed to send answer", err);
        setError("Не удалось отправить ответ");
      } finally {
        setSubmitting(false);
      }
    },
    [currentQuestion, quizId, sessionId, timeLeft],
  );

  const goNext = useCallback(async () => {
    haptic.medium();
    setAnswerResult(null);
    setSelectedOption(null);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= questions.length) {
      if (!sessionId) return;
      try {
        setSubmitting(true);
        const res = await fetchWithAuth(`/api/quiz/${quizId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) throw new Error("failed_to_finish");

        const data = (await res.json()) as FinishResponse;
        setTotalScore(data.totalScore);
        // Use server-side accurate count for star calculation
        if (data.correctCount !== undefined) {
          setCorrectCount(data.correctCount);
        }
        setFinished(true);
        haptic.heavy();
        
        // Show level up notification
        if (data.xp?.levelUp && data.xp?.newLevel) {
          setTimeout(() => {
            notify.levelUp(data.xp.newLevel!, getLevelTitle(data.xp.newLevel!));
          }, 1000);
        }
        
        // Show XP earned notification
        if (data.xp?.earned > 0) {
          setTimeout(() => {
            notify.custom({
              type: "success",
              icon: "✨",
              title: `+${data.xp.earned} XP`,
              message: `Уровень ${data.xp.level} • ${data.xp.progress}%`,
              duration: 3000,
            });
          }, 500);
        }
      } catch (err) {
        console.error("Failed to finish quiz", err);
        setError("Не удалось завершить викторину");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setCurrentIndex(nextIndex);
  }, [currentIndex, questions.length, quizId, sessionId]);

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-20 rounded-3xl bg-gradient-to-r from-violet-900/50 to-indigo-900/50" />
        <div className="h-[400px] rounded-3xl bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e]" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="relative p-8 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-white mb-2">Упс!</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/miniapp")}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold"
          >
            На главную
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Rate Limit Screen
  if (rateLimitInfo) {
    const isRateLimited = rateLimitInfo.error === "rate_limited";
    const isEnergyDepleted = rateLimitInfo.error === "energy_depleted";
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] p-8 text-center max-w-sm mx-auto">
          {/* Background glow - optimized for mobile */}
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full glow-amber" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full glow-violet" />
          
          <div className="relative">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-7xl mb-6"
            >
              {isRateLimited ? <img src="/icons/52.PNG" alt="" className="h-16 w-16 object-contain" /> : <img src="/icons/53.PNG" alt="" className="h-16 w-16 object-contain" />}
            </motion.div>
            
            <h2 className="text-2xl font-bold text-white mb-3">
              {isRateLimited ? "Подожди немного" : "Энергия закончилась"}
            </h2>
            
            <p className="text-white/60 mb-6 leading-relaxed">
              {rateLimitInfo.message}
            </p>
            
            {isRateLimited && rateLimitCountdown !== null && rateLimitCountdown > 0 && (
              <div className="mb-6">
                <div className="inline-flex items-center gap-3 rounded-full bg-amber-500/20 px-5 py-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </motion.div>
                  <span className="text-amber-400 font-bold text-xl tabular-nums">
                    {rateLimitCountdown} сек
                  </span>
                </div>
              </div>
            )}
            
            {isRateLimited && rateLimitCountdown === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-green-500/20 px-4 py-2">
                  <span className="text-green-400 font-bold">✓ Можно играть!</span>
                </div>
              </motion.div>
            )}
            
            {isEnergyDepleted && (
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                  <img src="/icons/11.PNG" alt="" className="h-8 w-8 object-contain" />
                  <span>Энергия:</span>
                  <span className="font-bold text-white">{rateLimitInfo.usedAttempts}/{rateLimitInfo.maxAttempts}</span>
                  <span className="text-white/30">• +1 каждые {rateLimitInfo.hoursPerAttempt ?? 4}ч</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                    style={{ width: "100%" }}
                  />
                </div>
                
                {/* Countdown до следующего слота */}
                {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
                  <div className="flex items-center justify-center gap-3 rounded-full bg-amber-500/20 px-5 py-3 mt-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </motion.div>
                    <span className="text-amber-300 text-sm">+1 энергия через:</span>
                    <span className="text-amber-400 font-bold tabular-nums">
                      {(() => {
                        const hours = Math.floor(rateLimitCountdown / 3600);
                        const mins = Math.floor((rateLimitCountdown % 3600) / 60);
                        const secs = rateLimitCountdown % 60;
                        if (hours > 0) return `${hours}ч ${mins}м`;
                        if (mins > 0) return `${mins}м ${secs}с`;
                        return `${secs}с`;
                      })()}
                    </span>
                  </div>
                )}
                
                {rateLimitCountdown === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 rounded-full bg-green-500/20 px-4 py-2"
                  >
                    <span className="text-green-400 font-bold">✓ Слот освободился!</span>
                  </motion.div>
                )}
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              {/* Кнопка "Играть снова" — показываем когда countdown закончился */}
              {(rateLimitCountdown === null || rateLimitCountdown === 0) && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setRateLimitInfo(null);
                    setRateLimitCountdown(null);
                    setLoading(true);
                    window.location.reload();
                  }}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-lg shadow-violet-500/30"
                >
                  🎮 Играть снова
                </motion.button>
              )}
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/miniapp/leaderboard?quizId=" + quizId)}
                className="px-8 py-4 rounded-2xl bg-white/10 text-white font-semibold"
              >
                🏆 Посмотреть лидерборд
              </motion.button>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/miniapp")}
                className="px-8 py-4 rounded-2xl text-white/60 font-medium"
              >
                ← На главную
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // No questions
  if (!currentQuestion && !finished) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-white/60">Вопросы не найдены</p>
        </div>
      </div>
    );
  }

  // Finished
  if (finished) {
    const accuracy = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    // Star rating: 5 stars for 90%+, 4 for 70%+, 3 for 50%+, 2 for 30%+, 1 for 10%+, 0 for less
    const starCount = accuracy >= 90 ? 5 : accuracy >= 70 ? 4 : accuracy >= 50 ? 3 : accuracy >= 30 ? 2 : accuracy >= 10 ? 1 : 0;
    const ratingText = starCount === 5 ? "Идеально!" : starCount === 4 ? "Превосходно!" : starCount === 3 ? "Хорошо!" : starCount === 2 ? "Неплохо!" : starCount === 1 ? "Слабовато..." : "Попробуй ещё!";
    
    return (
      <div className="flex flex-col gap-5 min-h-[80vh] justify-center">
        {/* Victory Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="relative overflow-hidden rounded-[32px]"
        >
          {/* Animated rainbow border - CSS optimized */}
          <div className="absolute -inset-[2px] rounded-[32px] bg-[conic-gradient(from_0deg,#f43f5e,#8b5cf6,#3b82f6,#22c55e,#eab308,#f43f5e)] animate-spin-slow gpu-accelerated" />
          
          <div className="relative m-[2px] rounded-[30px] bg-[#0a0a0f] overflow-hidden">
            {/* Celebratory background - reduced blur for mobile */}
            {/* Background glow - GPU optimized, no blur */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full glow-violet" />
              <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full glow-pink" />
            </div>
            
            {/* Floating sparkles - performance optimized */}
            {perf.enableParticles && [...Array(perf.particleCount)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                  y: [0, -20, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: perf.enableInfiniteAnimations ? Infinity : 3,
                  delay: i * 0.2,
                }}
                className="absolute text-lg gpu-accelerated"
                style={{
                  left: `${10 + i * 11}%`,
                  top: `${25 + (i % 3) * 20}%`,
                }}
              >
                ✨
              </motion.div>
            ))}
            
            <div className="relative p-8 text-center">
              {/* 5-Star Rating */}
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
              <motion.div
                    key={star}
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    animate={{ 
                      opacity: 1, 
                      scale: star <= starCount ? 1 : 0.6,
                      rotate: 0,
                    }}
                    transition={{ 
                      delay: 0.2 + star * 0.1,
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                    }}
                    className="relative"
              >
                    {/* Diffused glow effect */}
                    {star <= starCount && (
                      <motion.div
                        animate={{ 
                          opacity: [0.5, 0.9, 0.5],
                          scale: [1.2, 1.5, 1.2],
                        }}
                        transition={{ duration: 2, repeat: Infinity, delay: star * 0.1, ease: "easeInOut" }}
                        className="absolute inset-0"
                        style={{ filter: "blur(8px) brightness(1.8) saturate(2)" }}
                      >
                        <img src="/icons/5.PNG" alt="" className="h-12 w-12 object-contain" />
              </motion.div>
                    )}
                    <img 
                      src="/icons/5.PNG" 
                      alt="" 
                      className={`relative h-12 w-12 object-contain ${
                        star <= starCount 
                          ? "" 
                          : "opacity-30 grayscale"
                      }`}
                    />
                  </motion.div>
                ))}
              </div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="font-display text-3xl font-black text-white mb-2"
              >
                {ratingText}
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-white/50 mb-8"
              >
                Викторина завершена
              </motion.p>
              
              {/* Score display */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, ...spring }}
                className="relative mb-8"
              >
                {/* Soft glow without blur - GPU optimized */}
                <div className="absolute inset-0 rounded-3xl soft-glow opacity-60" />
                <div className="relative inline-block rounded-3xl bg-[#15151f]/90 border border-white/10 px-12 py-6">
                  <p className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                    <img src="/icons/26.PNG" alt="" className="h-6 w-6 object-contain" />
                    Твой результат
                  </p>
                  <motion.p
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1, type: "spring", stiffness: 200 }}
                    className="text-6xl font-black leading-tight tracking-tighter bg-gradient-to-r from-white via-violet-200 to-pink-200 bg-clip-text text-transparent pb-1 tabular-nums"
                  >
                    {totalScore}
                  </motion.p>
                  <p className="text-white/40 mt-2">очков</p>
                </div>
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="flex justify-center gap-6 mb-8"
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-white leading-tight pb-1">{correctCount}/{questions.length}</p>
                  <p className="text-xs text-white/40">верных</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400 leading-tight pb-1">{questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0}%</p>
                  <p className="text-xs text-white/40">точность</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400 leading-tight pb-1">🔥 {maxStreak}</p>
                  <p className="text-xs text-white/40">макс. серия</p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col gap-3"
        >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptic.heavy();
                router.push(`/miniapp/leaderboard?quizId=${quizId}`);
              }}
              className="relative overflow-hidden h-16 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold text-lg shadow-2xl shadow-violet-500/30"
            >
              <motion.div
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              />
              <span className="relative flex items-center justify-center gap-3">
                <img src="/icons/54.PNG" alt="" className="h-12 w-12 object-contain" />
                Таблица лидеров
              </span>
            </motion.button>

          {/* Share Buttons Row */}
          <div className="flex gap-3">
            {/* Share Image Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                haptic.heavy();
                
                try {
                  // Генерируем картинку через htmlcsstoimage API
                  const response = await fetch("/api/share-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      quizTitle,
                      score: totalScore,
                      correct: correctCount,
                      total: questions.length,
                      streak: maxStreak,
                      stars: starCount,
                      player: session.status === "ready" ? (session.user?.firstName || session.user?.username || "") : "",
                    }),
                  });
                  
                  if (!response.ok) {
                    throw new Error("Failed to generate image");
                  }
                  
                  const { url: imageUrl } = await response.json();
                  
                  // 1. Пробуем Telegram shareToStory (нативный метод)
                  const tgWebApp = window.Telegram?.WebApp;
                  if (tgWebApp?.shareToStory) {
                    tgWebApp.shareToStory(imageUrl, {
                      text: `🎮 Мой результат: ${totalScore} очков!`,
                      widget_link: {
                        url: "https://t.me/truecrimetg_bot/app",
                        name: "Играть",
                      },
                    });
                    haptic.success();
                    return;
                  }
                  
                  // 2. Загружаем картинку и пробуем Web Share API
                  const imgResponse = await fetch(imageUrl);
                  const blob = await imgResponse.blob();
                  const file = new File([blob], "quiz-result.png", { type: "image/png" });
                  
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        files: [file],
                        title: quizTitle,
                        text: `🎮 Мой результат: ${totalScore} очков!\n👉 https://t.me/truecrimetg_bot/app`,
                      });
                      haptic.success();
                      return;
                    } catch (shareError) {
                      console.log("Share with files failed:", shareError);
                    }
                  }
                  
                  // 3. Fallback: открываем картинку в новой вкладке
                  window.open(imageUrl, "_blank");
                  haptic.success();
                } catch (err) {
                  console.error("Share error:", err);
                  alert("Ошибка: " + (err instanceof Error ? err.message : String(err)));
                  haptic.error();
                }
              }}
              className="relative overflow-hidden flex-1 h-14 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white font-bold shadow-xl shadow-violet-500/20"
            >
              <motion.div
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
              />
              <span className="relative flex items-center justify-center gap-2 text-base">
                📤 В сторис
              </span>
            </motion.button>
            
            {/* Share Text Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                haptic.heavy();
                
                const starEmoji = "⭐".repeat(starCount) + "☆".repeat(5 - starCount);
                const accuracyPercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
                
                const shareText = [
                  `🎮 ${quizTitle}`,
                  ``,
                  starEmoji,
                  ``,
                  `📊 Мой результат:`,
                  `✅ ${correctCount}/${questions.length} правильных`,
                  `🎯 ${accuracyPercent}% точность`,
                  `🏆 ${totalScore.toLocaleString()} очков`,
                  `🔥 Серия: ${maxStreak}`,
                  ``,
                  `💀 Попробуй побить мой рекорд!`,
                  ``,
                  `👉 https://t.me/truecrimetg_bot/app`,
                ].join("\n");
                
                const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/truecrimetg_bot/app")}&text=${encodeURIComponent(shareText)}`;
                
                const tgWebApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
                
                if (tgWebApp?.openTelegramLink) {
                  tgWebApp.openTelegramLink(telegramShareUrl);
                } else {
                  window.open(telegramShareUrl, "_blank");
                }
              }}
              className="relative overflow-hidden flex-1 h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white font-bold shadow-xl shadow-emerald-500/20"
            >
              <motion.div
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
              />
              <span className="relative flex items-center justify-center gap-2 text-base">
                📤 Текст
              </span>
            </motion.button>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              haptic.medium();
              router.push("/miniapp");
            }}
            className="h-14 rounded-2xl bg-[#1a1a2e] border-2 border-violet-500/50 text-white font-bold text-lg active:bg-[#252545] transition-colors shadow-lg"
          >
            ← На главную
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Main Quiz UI
  const timerProgress = (timeLeft / QUESTION_TIME) * 100;
  const isUrgent = timeLeft <= 5;
  const isWarning = timeLeft <= 10 && timeLeft > 5;

  return (
    <div className="flex flex-col gap-4">
{/* Confetti Effect - Lottie Animation */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            <Lottie
              animationData={confettiAnimation}
              loop={false}
              autoplay={true}
              className="w-full h-full absolute inset-0"
              style={{ maxWidth: '100vw', maxHeight: '100vh' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-[#0a0a0f] p-4"
      >
        {/* Background glow - GPU optimized, no blur */}
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full glow-violet opacity-60" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 rounded-full glow-violet opacity-50" />
        
        <div className="relative flex items-center justify-between">
          {/* Score */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/50 to-yellow-600/50 rounded-xl" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500">
                <img src="/icons/7.PNG" alt="" className="h-11 w-11 object-contain" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Очки</p>
              <motion.p className="text-xl font-black text-white tabular-nums leading-tight">
                {displayScore}
              </motion.p>
            </div>
          </div>
          
          {/* Question Counter */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Вопрос</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-black text-white">{currentIndex + 1}</span>
              <span className="text-sm text-white/30">/</span>
              <span className="text-sm text-white/50">{questions.length}</span>
            </div>
          </div>
          
          {/* Timer */}
          <div className="flex items-center gap-2">
            <div className="text-right min-w-[45px]">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Время</p>
              <p className={`text-xl font-black tabular-nums leading-tight ${
                isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
              }`}>
                {timeLeft}s
              </p>
            </div>
            <div className={`relative flex-shrink-0 ${isUrgent ? "animate-pulse" : ""}`}>
              {/* Timer box with ring */}
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 ${
                isUrgent 
                  ? "bg-gradient-to-br from-red-500 to-rose-600" 
                  : isWarning 
                    ? "bg-gradient-to-br from-amber-500 to-orange-600"
                    : "bg-gradient-to-br from-emerald-500 to-green-600"
              }`}>
                {/* Progress ring - centered */}
                <svg className="absolute w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${timerProgress * 0.94} 100`}
                    className="gpu-accelerated"
                    style={{ transition: "stroke-dasharray 1s linear" }}
                  />
                </svg>
                <img 
                  src={isUrgent ? "/icons/alarm.png" : "/icons/hourglass.png"} 
                  alt="" 
                  className="relative w-8 h-8 object-contain z-10" 
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Progress bar - CSS optimized */}
        <div className="relative mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out gpu-accelerated"
            style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          />
          {/* Shimmer - CSS animation */}
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer gpu-accelerated" />
        </div>
      </motion.div>

      {/* Streak indicator - CSS optimized */}
      <AnimatePresence>
        {streak >= 2 && !answerResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-center -mt-2"
          >
            <div className="relative flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 shadow-lg shadow-orange-500/30">
              <span className="text-xl animate-bounce-subtle">🔥</span>
              <span className="font-black text-white">{streak} подряд!</span>
              <span className="text-xl animate-bounce-subtle" style={{ animationDelay: "0.15s" }}>🔥</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative gpu-accelerated"
          >
            {/* Card glow - GPU optimized shadow */}
            <div className="absolute -inset-1 rounded-[28px] soft-glow opacity-30" />
            
            {/* Animated border - CSS optimized */}
            <div className="absolute -inset-[1px] rounded-[28px] bg-[conic-gradient(from_0deg,#8b5cf6,#ec4899,#8b5cf6)] opacity-60 animate-spin-slow gpu-accelerated" />
            
            <div className="relative overflow-hidden rounded-[27px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1025]">
              {/* Background effects - GPU optimized, no blur */}
              <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full glow-violet opacity-60" />
              <div className="absolute -right-16 -bottom-16 h-32 w-32 rounded-full glow-pink opacity-50" />
              
              <div className="relative p-6 pt-5">
                {/* ═══ TOP ROW: Quiz Info ═══ */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="flex items-center justify-between mb-4"
                >
                  {/* Left side: Quiz title */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-violet-600/20 shadow-lg shadow-violet-500/10">
                      <span className="text-sm">🔍</span>
                    </div>
                    <span className="text-sm font-semibold text-white/80">{quizTitle}</span>
                  </div>
                  
                  {/* Right side: Question counter */}
                  <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
                    <span className="text-sm font-bold text-white">{currentIndex + 1}</span>
                    <span className="text-white/30">/</span>
                    <span className="text-sm text-white/40">{questions.length}</span>
                  </div>
                </motion.div>
                
                {/* ═══ BADGES ROW: Difficulty + Attempt ═══ */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-2 mb-5"
                >
                  {/* Difficulty badge with stars */}
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                    currentQuestion.difficulty === 3 
                      ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 shadow-lg shadow-red-500/10" 
                      : currentQuestion.difficulty === 2 
                        ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 shadow-lg shadow-amber-500/10" 
                        : "bg-gradient-to-r from-emerald-500/20 to-green-500/20 shadow-lg shadow-emerald-500/10"
                  }`}>
                    {[1, 2, 3].map((d) => (
                      <motion.span 
                        key={d}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15 + d * 0.05, type: "spring", stiffness: 400 }}
                        className={`text-sm ${
                          d <= (currentQuestion.difficulty ?? 1) 
                            ? currentQuestion.difficulty === 3 
                              ? "text-red-400 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]" 
                              : currentQuestion.difficulty === 2 
                                ? "text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" 
                                : "text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                            : "text-white/15"
                        }`}
                      >
                        ★
                      </motion.span>
                    ))}
                    <span className={`text-xs font-bold ml-0.5 ${
                      currentQuestion.difficulty === 3 
                        ? "text-red-300" 
                        : currentQuestion.difficulty === 2 
                          ? "text-amber-300" 
                          : "text-emerald-300"
                    }`}>
                      {currentQuestion.difficulty === 3 ? "Сложный" : currentQuestion.difficulty === 2 ? "Средний" : "Лёгкий"}
                    </span>
                  </div>
                  
                  {/* Attempt badge (if > 1) */}
                  {attemptNumber > 1 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-500/20 to-slate-600/20 px-3 py-1.5"
                    >
                      <span className="text-xs text-white/50">×{attemptNumber}</span>
                    </motion.div>
                  )}
                </motion.div>

                {/* Question */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="font-display text-2xl font-bold text-white leading-tight mb-8"
                >
                  {currentQuestion.text}
                </motion.h2>

                {/* Options */}
                <div className="space-y-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt.id;
                    const isAnswered = Boolean(answerResult);
                    const isCorrect = answerResult?.correct;
                    const letter = String.fromCharCode(65 + idx);
                    const colors = [
                      "from-violet-600 to-purple-600",
                      "from-blue-600 to-cyan-600", 
                      "from-pink-600 to-rose-600",
                      "from-amber-600 to-orange-600",
                    ];

                    return (
                      <motion.button
                        key={opt.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          delay: 0.1 + idx * 0.05,
                          duration: 0.2,
                          ease: "easeOut"
                        }}
                        whileTap={!isAnswered ? { scale: 0.98 } : undefined}
                        onClick={() => {
                          if (!isAnswered && !submitting) {
                            haptic.medium();
                            sendAnswer(opt.id);
                          }
                        }}
                        disabled={isAnswered || submitting}
                        className={`relative w-full overflow-hidden rounded-2xl p-4 text-left transition-colors duration-200 ${
                          isAnswered && isSelected
                            ? isCorrect
                              ? "ring-2 ring-green-400 bg-green-500/20"
                              : "ring-2 ring-red-400 bg-red-500/20"
                            : isAnswered
                              ? "opacity-40 bg-white/5"
                              : "bg-white/5 active:bg-white/10"
                        }`}
                      >
                        
                        {/* Result icon */}
                        <AnimatePresence>
                          {isAnswered && isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                              className={`absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center ${
                                isCorrect 
                                  ? "bg-gradient-to-r from-green-500 to-emerald-500" 
                                  : "bg-gradient-to-r from-red-500 to-rose-500"
                              }`}
                            >
                              <span className="text-white text-xl font-bold">
                                {isCorrect ? "✓" : "✕"}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        <div className="relative flex items-center gap-4 pr-14">
                          {/* Letter */}
                          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl font-black text-lg transition-all ${
                            isAnswered && isSelected
                              ? isCorrect
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                              : `bg-gradient-to-br ${colors[idx]} text-white shadow-lg`
                          }`}>
                            {letter}
                          </div>
                          
                          {/* Text */}
                          <span className={`text-[16px] font-medium leading-snug ${
                            isAnswered && isSelected
                              ? isCorrect ? "text-green-300" : "text-red-300"
                              : "text-white"
                          }`}>
                            {opt.text}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Result & Next */}
                <AnimatePresence>
                  {answerResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="mt-6"
                    >
                      {/* Feedback */}
                      <div
                        className={`rounded-2xl p-5 mb-4 ${
                          selectedOption === -1
                            ? "bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30"
                            : answerResult.correct
                              ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
                              : "bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-4xl">
                              {selectedOption === -1 ? "⏰" : answerResult.correct ? "🎉" : "💡"}
                            </span>
                            <div>
                              <p className={`text-lg font-bold ${
                                selectedOption === -1 
                                  ? "text-orange-400" 
                                  : answerResult.correct 
                                    ? "text-green-400" 
                                    : "text-red-400"
                              }`}>
                                {selectedOption === -1 ? "Время вышло!" : answerResult.correct ? "Верно!" : "Неверно"}
                              </p>
                              <p className="text-sm text-white/50">
                                {selectedOption === -1 
                                  ? "Переход к следующему..." 
                                  : answerResult.correct 
                                    ? "Отличная работа!" 
                                    : "Не сдавайся!"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-black ${
                                selectedOption === -1
                                  ? "text-orange-400"
                                  : answerResult.correct 
                                    ? "text-green-400" 
                                    : "text-white/30"
                              }`}
                            >
                              {selectedOption === -1 ? "0" : answerResult.scoreDelta > 0 ? `+${answerResult.scoreDelta}` : answerResult.scoreDelta}
                            </p>
                          </div>
                        </div>
                        
                        {/* Score Breakdown - only for correct answers */}
                        {answerResult.correct && answerResult.breakdown && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 pt-3 border-t border-white/10"
                          >
                            <div className="grid grid-cols-3 gap-1 text-xs text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-white/40 text-[10px]">Базовые</span>
                                <span className="text-white font-bold">+{answerResult.breakdown.base}</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-white/40 text-[10px]">⚡ Скорость</span>
                                <span className={`font-bold ${answerResult.breakdown.timeBonus > 30 ? "text-green-400" : answerResult.breakdown.timeBonus > 0 ? "text-yellow-400" : "text-white/30"}`}>
                                  +{answerResult.breakdown.timeBonus}
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-white/40 text-[10px]">🔥 Серия</span>
                                <span className={`font-bold ${answerResult.breakdown.streakBonus > 0 ? "text-orange-400" : "text-white/30"}`}>
                                  +{answerResult.breakdown.streakBonus}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Next button - hidden on timeout (auto-advance) */}
                      {selectedOption !== -1 && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={goNext}
                          disabled={submitting}
                          className="relative w-full h-16 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold text-lg overflow-hidden shadow-lg disabled:opacity-50"
                        >
                          {/* Shimmer - CSS */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer" />
                          <span className="relative flex items-center justify-center gap-2">
                            {currentIndex + 1 >= questions.length ? (
                              <>🏁 Завершить викторину</>
                            ) : (
                              <>Следующий вопрос →</>
                            )}
                          </span>
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
