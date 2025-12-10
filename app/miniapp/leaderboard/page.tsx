"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LeaderboardEntry = {
  place: number;
  user: { id: number; username: string | null; firstName: string | null };
  score: number;
};

type QuizSummary = {
  id: number;
  title: string;
};

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = searchParams.get("quizId");
    if (initial) {
      setQuizId(Number(initial));
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const res = await fetch("/api/quiz");
        if (!res.ok) throw new Error("quiz_load_error");
        const data = (await res.json()) as QuizSummary[];
        setQuizzes(data);
        if (!quizId && data.length > 0) {
          setQuizId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load quizzes", err);
        setError("Не удалось загрузить список викторин");
      }
    };

    fetchQuizzes();
  }, [quizId]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!quizId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/leaderboard?quizId=${quizId}`);
        if (!res.ok) {
          throw new Error("leaderboard_load_error");
        }
        const data = (await res.json()) as LeaderboardEntry[];
        setEntries(data);
      } catch (err) {
        console.error("Failed to load leaderboard", err);
        setError("Не удалось загрузить лидерборд");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [quizId]);

  const title = useMemo(() => {
    const found = quizzes.find((q) => q.id === quizId);
    return found?.title ?? "Лидерборд";
  }, [quizId, quizzes]);

  return (
    <div className="min-h-screen bg-[#F4F5FB] p-4 pb-16">
      <div className="mb-4 flex items-center justify-between">
        <button className="text-sm text-gray-600" onClick={() => router.push("/miniapp")}>
          ← Назад
        </button>
        <div className="text-base font-semibold text-gray-900">{title}</div>
        <div className="w-12" />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-base font-semibold text-gray-900">Лидерборд</div>
          {quizzes.length > 0 ? (
            <select
              className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700"
              value={quizId ?? ""}
              onChange={(e) => setQuizId(Number(e.target.value))}
            >
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="text-sm text-gray-600">Загружаем таблицу лидеров…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-gray-600">Пока нет результатов</div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => {
              const isTop = entry.place <= 3;
              const name = entry.user.username ?? entry.user.firstName ?? `ID ${entry.user.id}`;
              return (
                <div
                  key={`${entry.place}-${entry.user.id}`}
                  className={`flex items-center justify-between border-b border-gray-100 py-3 text-sm last:border-b-0 ${
                    isTop ? "font-semibold text-gray-900" : "text-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center ${isTop ? "text-[#1669FF]" : "text-gray-600"}`}>
                      {entry.place}
                    </span>
                    <span>{name}</span>
                  </div>
                  <div className="text-right font-semibold text-gray-900">{entry.score}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

