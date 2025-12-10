"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "./layout";

type Tab = "participant" | "creator";

type QuizSummary = {
  id: number;
  title: string;
  description: string | null;
  prizeTitle: string;
};

export default function MiniAppPage() {
  const session = useMiniAppSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("participant");
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState<boolean>(false);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const [startingQuizId, setStartingQuizId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuizzes = async () => {
      setQuizzesLoading(true);
      setQuizzesError(null);
      try {
        const res = await fetch("/api/quiz");
        if (!res.ok) {
          throw new Error("failed_to_load_quizzes");
        }
        const data = (await res.json()) as QuizSummary[];
        setQuizzes(data);
      } catch (err) {
        console.error("Failed to load quizzes", err);
        setQuizzesError("Не удалось загрузить викторины");
      } finally {
        setQuizzesLoading(false);
      }
    };

    loadQuizzes();
  }, []);

  const handleStartQuiz = useCallback(
    async (quizId: number) => {
      if (session.status !== "ready") return;
      setStartError(null);
      setStartingQuizId(quizId);
      try {
        const res = await fetch(`/api/quiz/${quizId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        });

        if (!res.ok) {
          throw new Error("failed_to_start");
        }

        const data = (await res.json()) as { sessionId: number };
        router.push(`/miniapp/quiz/${quizId}?sessionId=${data.sessionId}`);
      } catch (err) {
        console.error("Failed to start quiz", err);
        setStartError("Не удалось начать игру");
      } finally {
        setStartingQuizId(null);
      }
    },
    [router, session],
  );

  if (session.status === "loading") {
    return (
      <div className="p-4 text-sm text-gray-600">
        Загрузка профиля…
      </div>
    );
  }

  if (session.status === "error") {
    return (
      <div className="p-4 text-sm text-red-600">
        Ошибка авторизации. Попробуйте открыть мини-приложение из Telegram.
      </div>
    );
  }

  const user = session.user;
  const greeting = user.firstName ?? user.username ?? "друг";

  return (
    <div className="min-h-screen bg-[#F4F5FB] p-4 pb-24">
      <div className="mb-4 flex items-center justify-between text-sm font-medium text-gray-600">
        <button className="text-gray-500">Закрыть</button>
        <div className="flex items-center gap-2 rounded-full bg-white p-1 shadow-sm">
          <button
            className={`rounded-full px-3 py-1 text-sm ${
              tab === "participant" ? "bg-[#1669FF] text-white" : "text-gray-700"
            }`}
            onClick={() => setTab("participant")}
          >
            Участник
          </button>
          <button
            className={`rounded-full px-3 py-1 text-sm ${
              tab === "creator" ? "bg-[#1669FF] text-white" : "text-gray-700"
            }`}
            onClick={() => setTab("creator")}
          >
            Создатель
          </button>
        </div>
        <div className="w-12" />
      </div>

      <div className="mb-4 text-xl font-semibold text-gray-900">
        Привет, {greeting}!
      </div>

      {tab === "creator" ? (
        <CreatorView />
      ) : (
        <ParticipantView
          quizzes={quizzes}
          loading={quizzesLoading}
          error={quizzesError}
          onStart={handleStartQuiz}
          startingQuizId={startingQuizId}
          startError={startError}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 flex justify-center bg-transparent pb-4">
        <div className="w-full max-w-[600px] px-4">
          <button className="w-full rounded-2xl bg-[#1669FF] py-3 text-center text-white font-semibold shadow-md">
            Вперёд
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatorView() {
  return (
    <div className="flex flex-col gap-4">
      <button className="w-full rounded-2xl bg-[#1669FF] py-3 text-center text-white font-semibold shadow-md">
        🧠 Создать викторину
      </button>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-semibold text-gray-900">Активные викторины</div>
        <div className="text-sm text-gray-600">Пока что нет активных викторин</div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-semibold text-gray-900">Мои каналы</div>
        <div className="text-sm text-gray-600">Пример канала: @my_channel</div>
      </div>
    </div>
  );
}

type ParticipantViewProps = {
  quizzes: QuizSummary[];
  loading: boolean;
  error: string | null;
  startingQuizId: number | null;
  startError: string | null;
  onStart: (quizId: number) => Promise<void> | void;
};

function ParticipantView({ quizzes, loading, error, onStart, startingQuizId, startError }: ParticipantViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-semibold text-gray-900">Викторины</div>
        {loading ? (
          <div className="text-sm text-gray-600">Загружаем викторины…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : quizzes.length === 0 ? (
          <div className="text-sm text-gray-600">Пока нет активных викторин</div>
        ) : (
          <div className="flex flex-col gap-3">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">{quiz.title}</div>
                <div className="text-sm text-gray-600">{quiz.description}</div>
                <div className="text-xs text-gray-500">Приз: {quiz.prizeTitle}</div>
                <div className="mt-2">
                  <button
                    className="w-full rounded-2xl bg-[#1669FF] px-3 py-2 text-white text-sm font-semibold disabled:opacity-60"
                    onClick={() => onStart(quiz.id)}
                    disabled={Boolean(startingQuizId && startingQuizId !== quiz.id)}
                  >
                    {startingQuizId === quiz.id ? "Запуск…" : "Играть"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {startError ? <div className="mt-2 text-sm text-red-600">{startError}</div> : null}
      </div>
    </div>
  );
}

