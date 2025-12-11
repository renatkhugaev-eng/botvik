"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "../layout";

type SummaryResponse = {
  user: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  stats: {
    totalSessions: number;
    totalQuizzesPlayed: number;
    totalCorrectAnswers: number;
    totalScore: number;
    bestScoreByQuiz: { quizId: number; title: string; bestScore: number }[];
    lastSession: { quizId: number; quizTitle: string; score: number; finishedAt: string | Date } | null;
  };
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}

function getBadge(totalScore: number) {
  if (totalScore > 2000) return { label: "Профайлер", color: "bg-indigo-50 text-indigo-700" };
  if (totalScore >= 500) return { label: "Детектив", color: "bg-blue-50 text-blue-700" };
  return { label: "Новичок", color: "bg-gray-100 text-gray-700" };
}

export default function ProfilePage() {
  const router = useRouter();
  const session = useMiniAppSession();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    if (session.status !== "ready") return "";
    return session.user.firstName ?? session.user.username ?? "Друг";
  }, [session]);

  const avatarLetter = displayName ? displayName.slice(0, 1).toUpperCase() : "U";

  useEffect(() => {
    const load = async () => {
      if (session.status !== "ready") {
        setError("Пользователь не авторизован");
        setLoading(false);
        return;
      }
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(`/api/me/summary?userId=${session.user.id}`);
        if (!res.ok) throw new Error("summary_load_failed");
        const json = (await res.json()) as SummaryResponse;
        setData(json);
      } catch (err) {
        console.error("Failed to load profile summary", err);
        setError("Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-28 rounded-full bg-brand-borderSubtle/50" />
        <div className="h-20 w-full rounded-2xl bg-brand-borderSubtle/50" />
        <div className="h-24 w-full rounded-2xl bg-brand-borderSubtle/50" />
        <div className="h-14 w-full rounded-2xl bg-brand-borderSubtle/50" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-brand-borderSubtle bg-white p-4 text-sm text-brand-danger shadow-card-soft">
        {error ?? "Не удалось загрузить профиль"}
      </div>
    );
  }

  const badge = getBadge(data.stats.totalScore);

  return (
    <div className="space-y-5 text-brand-textMain">
      <div className="mb-1 flex items-center justify-between text-sm text-brand-textMuted">
        <button
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-brand-textMuted transition-colors duration-150 hover:bg-slate-50 hover:text-brand-textMain"
          onClick={() => router.back()}
        >
          <span className="text-lg leading-none">←</span>
          Назад
        </button>
        <div className="text-base font-semibold text-brand-textMain">Профиль</div>
        <div className="w-12" />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-lg font-semibold text-white">
            {avatarLetter}
          </div>
          <div>
            <div className="text-lg font-semibold text-brand-textMain">
              {data.user.firstName ?? data.user.username ?? "Без имени"}
            </div>
            {data.user.username ? <div className="text-sm text-brand-textMuted">@{data.user.username}</div> : null}
            <div className="mt-2 inline-flex rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
              {badge.label}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-brand-textMain">Моя статистика</div>
          <div className="text-xs uppercase tracking-[0.12em] text-brand-textMuted">progress</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-brand-textMain">
          <StatCard title="Викторин сыграно" value={data.stats.totalQuizzesPlayed} />
          <StatCard title="Попыток" value={data.stats.totalSessions} />
          <StatCard title="Правильных ответов" value={data.stats.totalCorrectAnswers} />
          <StatCard title="Всего очков" value={data.stats.totalScore} accent />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-brand-textMain">Лучшие результаты</div>
          <div className="text-xs uppercase tracking-[0.12em] text-brand-textMuted">top</div>
        </div>
        {data.stats.bestScoreByQuiz.length === 0 ? (
          <div className="text-sm text-brand-textMuted">Пока нет сыгранных викторин</div>
        ) : (
          <div className="space-y-2">
            {data.stats.bestScoreByQuiz.map((item) => (
              <div
                key={item.quizId}
                className="flex items-center justify-between rounded-2xl border border-brand-borderSubtle bg-slate-50 px-3 py-2 text-sm text-brand-textMain shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors duration-150 hover:bg-white"
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">🥇</span>
                  {item.title}
                </span>
                <span className="font-semibold text-brand-textMain">{item.bestScore}</span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-brand-textMain">Последняя игра</div>
          <div className="text-xs uppercase tracking-[0.12em] text-brand-textMuted">replay</div>
        </div>
        {data.stats.lastSession ? (
          <div className="space-y-3 text-sm text-brand-textMain">
            <div className="font-semibold text-brand-textMain">{data.stats.lastSession.quizTitle}</div>
            <div className="text-brand-textMuted">Очки: {data.stats.lastSession.score}</div>
            <div className="text-brand-textMuted">Когда: {formatDate(data.stats.lastSession.finishedAt)}</div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="mt-2 flex h-[54px] w-full items-center justify-center rounded-full bg-brand-green px-4 py-3 text-white font-semibold shadow-card-md transition-colors duration-200 hover:bg-brand-greenDark"
              onClick={() => router.push(`/miniapp/quiz/${data.stats.lastSession?.quizId}`)}
            >
              Играть ещё раз
            </motion.button>
          </div>
        ) : (
          <div className="text-sm text-brand-textMuted">Ты ещё не проходил ни одной викторины</div>
        )}
      </motion.section>
    </div>
  );
}

function StatCard({ title, value, accent }: { title: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-[#E5E7EB] bg-slate-50 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${
        accent ? "ring-1 ring-brand-primary/40" : ""
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.12em] text-brand-textMuted">{title}</div>
      <div className="text-xl font-semibold text-brand-textMain">{value}</div>
    </div>
  );
}


