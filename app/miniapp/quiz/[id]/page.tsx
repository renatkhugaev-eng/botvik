"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../../layout";

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

  const currentQuestion = useMemo(
    () => (questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null),
    [currentIndex, questions],
  );

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
      <div className="min-h-screen bg-[#F4F5FB] p-4 text-sm text-gray-600">
        Загружаем вопросы…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F5FB] p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!currentQuestion && !finished) {
    return (
      <div className="min-h-screen bg-[#F4F5FB] p-4 text-sm text-gray-600">
        Нет вопросов для этой викторины
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-[#F4F5FB] p-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Викторина завершена</div>
          <div className="mt-2 text-sm text-gray-700">Вы набрали {totalScore} очков</div>
          <div className="mt-4 flex gap-2">
            <button
              className="flex-1 rounded-2xl bg-[#1669FF] px-4 py-3 text-white font-semibold"
              onClick={() => router.push(`/miniapp/leaderboard?quizId=${quizId}`)}
            >
              Посмотреть лидерборд
            </button>
            <button
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-gray-800 font-semibold"
              onClick={() => router.push("/miniapp")}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5FB] p-4 pb-24">
      <div className="mb-4 text-sm text-gray-600">
        Вопрос {currentIndex + 1} из {questions.length}
      </div>

      {currentQuestion ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-base font-semibold text-gray-900">{currentQuestion.text}</div>

          <div className="mt-4 flex flex-col gap-3">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt.id}
                className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm font-medium text-gray-900 shadow-sm transition hover:border-[#1669FF] disabled:opacity-70"
                onClick={() => sendAnswer(opt.id)}
                disabled={Boolean(answerResult) || submitting}
              >
                {opt.text}
              </button>
            ))}
          </div>

          {answerResult ? (
            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
              <div className={`font-semibold ${answerResult.correct ? "text-green-600" : "text-red-600"}`}>
                {answerResult.correct ? "Правильно" : "Неправильно"}
              </div>
              <div>+{answerResult.scoreDelta} очков</div>
              <div>Всего: {answerResult.totalScore}</div>
              <div className="mt-3">
                <button
                  className="w-full rounded-2xl bg-[#1669FF] px-3 py-2 text-white font-semibold"
                  onClick={goNext}
                >
                  Дальше
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

