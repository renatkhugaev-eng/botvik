"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-[#6B7280]">
        <button className="inline-flex items-center gap-2 text-[#6B7280] transition-colors duration-150 hover:text-[#111827]" onClick={() => router.back()}>
          <span className="text-lg leading-none">←</span>
          Назад
        </button>
        <div className="text-base font-semibold text-[#111827] text-center flex-1">{title}</div>
        <div className="w-10" />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#E5E7EB] bg-white p-5 text-[#111827] shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold text-[#111827]">Лидерборд</div>
          {quizzes.length > 0 ? (
            <select
              className="rounded-xl border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-sm text-[#111827] outline-none transition-colors duration-150 hover:border-[#22C55E]"
              value={quizId ?? ""}
              onChange={(e) => setQuizId(Number(e.target.value))}
            >
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id} className="bg-white text-[#111827]">
                  {quiz.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-[#EF4444]/40 bg-white px-3 py-2 text-sm text-[#EF4444] shadow-[0_8px_20px_rgba(0,0,0,0.05)]">{error}</div>
        ) : loading ? (
          <div className="text-sm text-[#6B7280]">Загружаем таблицу лидеров…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-[#6B7280]">Пока нет результатов</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const isTop = entry.place <= 3;
              const medal = entry.place === 1 ? "🥇" : entry.place === 2 ? "🥈" : entry.place === 3 ? "🥉" : entry.place;
              const name = entry.user.username ?? entry.user.firstName ?? `ID ${entry.user.id}`;
              return (
                <div
                  key={`${entry.place}-${entry.user.id}`}
                  className={`flex items-center justify-between py-3 text-sm ${
                    isTop ? "font-semibold text-[#111827]" : "text-[#111827]"
                  } ${isTop ? "bg-amber-50 rounded-2xl px-2" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 text-center ${isTop ? "text-[#22C55E]" : "text-[#6B7280]"}`}>{medal}</span>
                    <span>{name}</span>
                  </div>
                  <div className="text-right font-semibold text-[#111827]">{entry.score}</div>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>
    </div>
  );
}

