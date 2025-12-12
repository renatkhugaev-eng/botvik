"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../../layout";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import { haptic } from "@/lib/haptic";

type StartResponse = {
  sessionId: number;
  quizId: number;
  totalQuestions: number;
  totalScore: number;
  questions: {
    id: number;
    text: string;
    order: number;
    options: { id: number; text: string }[];
  }[];
};

type AnswerResponse = {
  correct: boolean;
  scoreDelta: number;
  totalScore: number;
};

const spring = { type: "spring", stiffness: 500, damping: 30 };
const QUESTION_TIME = 15; // seconds per question

export default function QuizPlayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useMiniAppSession();

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animated score
  const animatedScore = useMotionValue(0);
  const displayScore = useTransform(animatedScore, (v) => Math.round(v));

  const currentQuestion = useMemo(
    () => (questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null),
    [currentIndex, questions],
  );

  const progress = questions.length > 0 ? ((currentIndex) / questions.length) * 100 : 0;

  // Timer effect - reset on new question
  useEffect(() => {
    if (loading || finished || answerResult || !currentQuestion) return;
    
    // Reset for new question
    setTimeLeft(QUESTION_TIME);
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
  }, [currentIndex, loading, finished, currentQuestion]); // removed answerResult to prevent reset

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
          fetch(`/api/quiz/${quizId}/finish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          })
            .then((res) => res.json())
            .then((data) => {
              setTotalScore(data.totalScore);
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
        const quizRes = await fetch(`/api/quiz/${quizId}`);
        if (quizRes.ok) {
          const quizData = await quizRes.json();
          setQuizTitle(quizData.title ?? "Викторина");
        }

        const res = await fetch(`/api/quiz/${quizId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        });

        if (!res.ok) throw new Error("failed_to_start");

        const data = (await res.json()) as StartResponse;
        setQuestions(data.questions);
        setSessionId(data.sessionId);
        setTotalScore(data.totalScore ?? 0);
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
        const res = await fetch(`/api/quiz/${quizId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: currentQuestion.id,
            optionId,
            timeSpentMs: (QUESTION_TIME - timeLeft) * 1000,
          }),
        });

        if (!res.ok) throw new Error("failed_to_answer");

        const data = (await res.json()) as AnswerResponse;
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
          setTimeout(() => setShowConfetti(false), 2000);
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
        const res = await fetch(`/api/quiz/${quizId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) throw new Error("failed_to_finish");

        const data = (await res.json()) as { totalScore: number };
        setTotalScore(data.totalScore);
        setFinished(true);
        haptic.heavy();
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
    const rating = accuracy >= 80 ? "🏆" : accuracy >= 50 ? "⭐" : "👍";
    const ratingText = accuracy >= 80 ? "Превосходно!" : accuracy >= 50 ? "Хорошо!" : "Неплохо!";
    
    return (
      <div className="flex flex-col gap-5 min-h-[80vh] justify-center">
        {/* Victory Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="relative overflow-hidden rounded-[32px]"
        >
          {/* Animated rainbow border */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-[2px] rounded-[32px] bg-[conic-gradient(from_0deg,#f43f5e,#8b5cf6,#3b82f6,#22c55e,#eab308,#f43f5e)]"
          />
          
          <div className="relative m-[2px] rounded-[30px] bg-[#0a0a0f] overflow-hidden">
            {/* Celebratory background */}
            <div className="absolute inset-0">
              <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-violet-600/30 blur-[80px] animate-pulse" />
              <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-pink-600/20 blur-[80px] animate-pulse" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-yellow-500/20 blur-[60px]" />
            </div>
            
            {/* Floating stars */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                  y: [0, -30, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
                className="absolute text-xl"
                style={{
                  left: `${8 + i * 8}%`,
                  top: `${20 + (i % 4) * 20}%`,
                }}
              >
                ✨
              </motion.div>
            ))}
            
            <div className="relative p-8 text-center">
              {/* Big emoji rating */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...spring, delay: 0.3 }}
                className="mb-4"
              >
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-8xl inline-block"
                >
                  {rating}
                </motion.span>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="font-display text-3xl font-black text-white mb-2"
              >
                {ratingText}
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-white/50 mb-8"
              >
                Викторина завершена
              </motion.p>
              
              {/* Score display */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, ...spring }}
                className="relative mb-8"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-pink-500/20 to-violet-500/20 blur-2xl" />
                <div className="relative inline-block rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 px-12 py-6">
                  <p className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">Твой результат</p>
                  <motion.p
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                    className="font-display text-6xl font-black leading-none bg-gradient-to-r from-white via-violet-200 to-pink-200 bg-clip-text text-transparent pb-1"
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
                transition={{ delay: 0.8 }}
                className="flex justify-center gap-6 mb-8"
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-white leading-none pb-1">{correctCount}/{questions.length}</p>
                  <p className="text-xs text-white/40">верных</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400 leading-none pb-1">{questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0}%</p>
                  <p className="text-xs text-white/40">точность</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400 leading-none pb-1">🔥 {maxStreak}</p>
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
              <span className="text-2xl">🏆</span>
              Таблица лидеров
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              haptic.medium();
              router.push("/miniapp");
            }}
            className="h-14 rounded-2xl bg-white/10 backdrop-blur-sm text-white/80 font-semibold hover:bg-white/15 transition-colors"
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
{/* Confetti Effect - Framer Motion for reliability */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(40)].map((_, i) => {
              const colors = ["#8b5cf6", "#ec4899", "#22c55e", "#eab308", "#3b82f6", "#f43f5e", "#06b6d4"];
              const startX = 10 + Math.random() * 80;
              const endX = startX + (Math.random() - 0.5) * 100;
              const size = 8 + Math.random() * 6;
              const duration = 2 + Math.random() * 1;
              const delay = Math.random() * 0.4;
              const rotateEnd = 360 + Math.random() * 720;
              
              return (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 1,
                    y: -20,
                    x: `${startX}vw`,
                    rotate: 0,
                    scale: 0,
                  }}
                  animate={{ 
                    opacity: [1, 1, 1, 0],
                    y: ["0vh", "30vh", "70vh", "110vh"],
                    x: [`${startX}vw`, `${(startX + endX) / 2}vw`, `${endX}vw`, `${endX}vw`],
                    rotate: [0, rotateEnd / 3, rotateEnd * 0.7, rotateEnd],
                    scale: [0, 1.2, 1, 0.8],
                  }}
                  transition={{ 
                    duration: duration,
                    delay: delay,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    times: [0, 0.3, 0.7, 1],
                  }}
                  style={{
                    position: 'absolute',
                    width: i % 3 === 0 ? size * 0.5 : size,
                    height: i % 4 === 0 ? size * 1.5 : size,
                    background: colors[i % colors.length],
                    borderRadius: i % 5 === 0 ? '50%' : '2px',
                    boxShadow: `0 0 6px ${colors[i % colors.length]}`,
                  }}
                />
              );
            })}
            
            {/* Sparkles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                initial={{ opacity: 0, scale: 0, y: 100 }}
                animate={{ 
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.5, 1, 0.5],
                  y: [100, 50, 0, -50],
                }}
                transition={{ 
                  duration: 1.2,
                  delay: 0.1 + i * 0.1,
                  ease: "easeOut",
                }}
                className="absolute text-2xl"
                style={{ left: `${12 + i * 11}%` }}
              >
                ✨
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Premium Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-[#0a0a0f] p-4"
      >
        {/* Background glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-indigo-600/15 blur-2xl" />
        
        <div className="relative flex items-center justify-between">
          {/* Score */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-sm opacity-50" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <span className="text-lg">💎</span>
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
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest text-right">Время</p>
              <motion.p 
                key={timeLeft}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`text-xl font-black tabular-nums leading-tight text-right ${
                  isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {timeLeft}s
              </motion.p>
            </div>
            <motion.div 
              animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.4, repeat: isUrgent ? Infinity : 0 }}
              className="relative"
            >
              {/* Timer ring background */}
              <div className={`absolute inset-0 rounded-xl blur-md transition-all duration-500 ${
                isUrgent ? "bg-red-500/40" : isWarning ? "bg-amber-500/30" : "bg-emerald-500/20"
              }`} />
              <div className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-500 ${
                isUrgent 
                  ? "bg-gradient-to-br from-red-500 to-rose-600" 
                  : isWarning 
                    ? "bg-gradient-to-br from-amber-500 to-orange-600"
                    : "bg-gradient-to-br from-emerald-500 to-green-600"
              }`}>
                {/* Progress ring */}
                <svg className="absolute inset-1 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${timerProgress} 100`}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="relative text-sm font-bold text-white">
                  {isUrgent ? "🔥" : "⏱"}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
          {/* Shimmer */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        </div>
      </motion.div>

      {/* Streak indicator */}
      <AnimatePresence>
        {streak >= 2 && !answerResult && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="flex justify-center -mt-2"
          >
            <div className="relative">
              {/* Glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 blur-lg opacity-40" />
              <div className="relative flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 shadow-lg shadow-orange-500/30">
                <motion.span
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-xl"
                >
                  🔥
                </motion.span>
                <span className="font-black text-white">{streak} подряд!</span>
                <motion.span
                  animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  className="text-xl"
                >
                  🔥
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, rotateY: 90, scale: 0.8 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: -90, scale: 0.8 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
            style={{ transformStyle: "preserve-3d", perspective: 1000 }}
            className="relative"
          >
            {/* Card glow */}
            <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-r from-violet-500/50 via-purple-500/50 to-pink-500/50 blur-xl opacity-50" />
            
            {/* Animated border */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-[1px] rounded-[28px] bg-[conic-gradient(from_0deg,#8b5cf6,#ec4899,#8b5cf6)] opacity-60"
            />
            
            <div className="relative overflow-hidden rounded-[27px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1025]">
              {/* Question number badge */}
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <span className="text-xs font-bold text-white/60">{currentIndex + 1}</span>
                  <span className="text-white/30">/</span>
                  <span className="text-xs text-white/40">{questions.length}</span>
                </div>
              </div>
              
              {/* Background effects */}
              <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-violet-600/20 blur-[80px]" />
              <div className="absolute -right-32 -bottom-32 h-64 w-64 rounded-full bg-pink-600/15 blur-[80px]" />
              
              <div className="relative p-6 pt-5">
                {/* Category */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-500/20 border border-violet-500/30 px-3 py-1.5 mb-5"
                >
                  <span>🔍</span>
                  <span className="text-sm font-semibold text-violet-300">{quizTitle}</span>
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
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + idx * 0.08, ...spring }}
                        whileHover={!isAnswered ? { scale: 1.02, x: 5 } : undefined}
                        whileTap={!isAnswered ? { scale: 0.98 } : undefined}
                        onClick={() => {
                          if (!isAnswered && !submitting) {
                            haptic.medium();
                            sendAnswer(opt.id);
                          }
                        }}
                        disabled={isAnswered || submitting}
                        className={`relative w-full overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ${
                          isAnswered && isSelected
                            ? isCorrect
                              ? "ring-2 ring-green-400 bg-green-500/20"
                              : "ring-2 ring-red-400 bg-red-500/20"
                            : isAnswered
                              ? "opacity-40 bg-white/5"
                              : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {/* Hover gradient */}
                        {!isAnswered && (
                          <div className={`absolute inset-0 opacity-0 hover:opacity-20 bg-gradient-to-r ${colors[idx]} transition-opacity`} />
                        )}
                        
                        {/* Result icon */}
                        <AnimatePresence>
                          {isAnswered && isSelected && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className={`absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center ${
                                isCorrect 
                                  ? "bg-gradient-to-r from-green-500 to-emerald-500" 
                                  : "bg-gradient-to-r from-red-500 to-rose-500"
                              } shadow-lg`}
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
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="mt-6"
                    >
                      {/* Feedback */}
                      <motion.div
                        initial={{ x: selectedOption === -1 ? 0 : answerResult.correct ? -20 : 20 }}
                        animate={{ x: 0 }}
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
                            <motion.span
                              animate={selectedOption === -1 ? { scale: [1, 1.2, 1] } : { rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 0.5, repeat: selectedOption === -1 ? 2 : 0 }}
                              className="text-4xl"
                            >
                              {selectedOption === -1 ? "⏰" : answerResult.correct ? "🎉" : "💡"}
                            </motion.span>
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
                            <motion.p
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className={`text-3xl font-black ${
                                selectedOption === -1
                                  ? "text-orange-400"
                                  : answerResult.correct 
                                    ? "text-green-400" 
                                    : "text-white/30"
                              }`}
                            >
                              {selectedOption === -1 ? "0" : `+${answerResult.scoreDelta}`}
                            </motion.p>
                          </div>
                        </div>
                      </motion.div>

                      {/* Next button - hidden on timeout (auto-advance) */}
                      {selectedOption !== -1 && (
                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={goNext}
                          disabled={submitting}
                          className="relative w-full h-16 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold text-lg overflow-hidden shadow-2xl shadow-violet-500/30 disabled:opacity-50"
                        >
                          <motion.div
                            animate={{ x: ["-200%", "200%"] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                          />
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
