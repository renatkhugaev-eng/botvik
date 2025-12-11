"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../../layout";
import { AnimatePresence, motion } from "framer-motion";
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

  const currentQuestion = useMemo(
    () => (questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null),
    [currentIndex, questions],
  );

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

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
        const res = await fetch(`/api/quiz/${quizId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        });

        if (!res.ok) {
          throw new Error("failed_to_start");
        }

        const data = (await res.json()) as StartResponse;
        setQuestions(data.questions);
        setSessionId(data.sessionId);
        setTotalScore(data.totalScore ?? 0);

        const fromParams = searchParams.get("sessionId");
        if (fromParams && Number(fromParams) !== data.sessionId) {
          console.warn("SessionId in params differs from backend session. Using backend value.");
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
      if (!currentQuestion || !sessionId) return;
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
            timeSpentMs: 5000,
          }),
        });

        if (!res.ok) {
          throw new Error("failed_to_answer");
        }

        const data = (await res.json()) as AnswerResponse;
        setAnswerResult(data);
        setTotalScore(data.totalScore);
        // Haptic feedback based on answer correctness
        if (data.correct) {
          haptic.success();
        } else {
          haptic.error();
        }
      } catch (err) {
        console.error("Failed to send answer", err);
        setError("Не удалось отправить ответ");
      } finally {
        setSubmitting(false);
      }
    },
    [currentQuestion, quizId, sessionId],
  );

  const goNext = useCallback(async () => {
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

        if (!res.ok) {
          throw new Error("failed_to_finish");
        }

        const data = (await res.json()) as { totalScore: number };
        setTotalScore(data.totalScore);
        setFinished(true);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-3 w-24 rounded-full bg-[#E5E7EB]" />
        <div className="h-4 w-32 rounded-full bg-[#E5E7EB]" />
        <div className="h-20 w-full rounded-2xl bg-[#E5E7EB]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-sm text-[#EF4444] shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        {error}
      </div>
    );
  }

  if (!currentQuestion && !finished) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280] shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        Нет вопросов для этой викторины
      </div>
    );
  }

  if (finished) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 text-[#111827] shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <div className="text-xl font-semibold text-[#111827]">Викторина завершена</div>
          <div className="mt-2 text-sm text-[#6B7280]">Вы набрали {totalScore} очков</div>
          <div className="mt-4 flex gap-2">
            <button
              className="flex-1 rounded-full bg-[#22C55E] px-4 py-3 text-white font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all duration-200 hover:bg-[#16A34A] active:scale-95"
              onClick={() => {
                haptic.medium();
                router.push(`/miniapp/leaderboard?quizId=${quizId}`);
              }}
            >
              Посмотреть лидерборд
            </button>
            <button
              className="flex-1 rounded-full border border-[#E5E7EB] bg-white px-4 py-3 text-[#111827] font-semibold transition-all duration-200 hover:bg-slate-50 active:scale-95"
              onClick={() => {
                haptic.light();
                router.push("/miniapp");
              }}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        <div className="mb-2 flex items-center justify-between text-xs text-[#6B7280]">
          <span>
            Вопрос {currentIndex + 1} из {questions.length}
          </span>
          <span className="font-semibold text-brand-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200">
          <div
            className="h-1.5 rounded-full bg-brand-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentQuestion ? (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-[#E5E7EB] bg-white p-5 text-[#111827] shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-200"
          >
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-brand-textMuted">
              Трукрайм
            </div>
            <div className="text-xl font-semibold text-[#111827]">{currentQuestion.text}</div>

            <div className="mt-4 flex flex-col gap-3">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                const isAnswered = Boolean(answerResult);

                const baseClasses =
                  "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all duration-150";
                const defaultClasses =
                  "border-[#E5E7EB] bg-slate-50 text-[#111827] hover:bg-white hover:shadow-sm";
                const correctClasses = "border-green-400 bg-green-50 text-green-900";
                const wrongClasses = "border-red-400 bg-red-50 text-red-900";

                return (
                  <motion.button
                    key={opt.id}
                    whileHover={!isAnswered ? { y: -2 } : undefined}
                    className={`${baseClasses} ${
                      isAnswered && isSelected
                        ? answerResult?.correct
                          ? correctClasses
                          : wrongClasses
                        : defaultClasses
                    }`}
                    onClick={() => {
                      haptic.medium();
                      sendAnswer(opt.id);
                    }}
                    disabled={isAnswered || submitting}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-brand-textMuted">
                        {String.fromCharCode(65 + currentQuestion.options.findIndex((o) => o.id === opt.id))}
                      </span>
                      <div className="flex flex-col text-left">
                        <span>{opt.text}</span>
                        {isAnswered && isSelected ? (
                          <span className="text-xs font-semibold text-brand-textMuted">
                            {answerResult?.correct ? "Верно" : "Неверно"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {answerResult ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl border border-[#E5E7EB] bg-slate-50 p-3 text-sm text-[#111827] transition-all duration-200"
              >
                <div className={`font-semibold ${answerResult.correct ? "text-green-600" : "text-red-600"}`}>
                  {answerResult.correct ? "Правильно" : "Неправильно"}
                </div>
                <div className="text-brand-textMuted">
                  <span className="font-semibold text-brand-yellow">+{answerResult.scoreDelta}</span> очков, всего:{" "}
                  <span className="font-semibold text-brand-yellow">{answerResult.totalScore}</span>
                </div>
                <div className="mt-3">
                  <button
                    className="w-full rounded-full bg-[#22C55E] px-3 py-2.5 text-white font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all duration-200 hover:bg-[#16A34A] active:scale-95"
                    onClick={() => {
                      haptic.soft();
                      goNext();
                    }}
                  >
                    Дальше
                  </button>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}