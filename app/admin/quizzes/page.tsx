"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Quiz = {
  id: number;
  title: string;
  description: string | null;
  isActive: boolean;
  prizeTitle: string;
  _count: {
    questions: number;
    sessions: number;
  };
};

export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const res = await fetch("/api/admin/quizzes");
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data.quizzes || []);
        }
      } catch (error) {
        console.error("Failed to fetch quizzes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

  const toggleActive = async (quizId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quizId ? { ...q, isActive: !currentStatus } : q))
        );
      }
    } catch (error) {
      console.error("Failed to toggle quiz:", error);
    }
  };

  const deleteQuiz = async (quizId: number) => {
    if (!confirm("Удалить этот квиз? Это действие нельзя отменить.")) return;

    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      }
    } catch (error) {
      console.error("Failed to delete quiz:", error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Квизы</h1>
          <p className="text-slate-400">Управление квизами и вопросами</p>
        </div>
        <Link
          href="/admin/quizzes/new"
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 flex items-center gap-2"
        >
          <span className="text-xl">➕</span>
          Создать квиз
        </Link>
      </div>

      {/* Quizzes List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-1/3 mb-4" />
              <div className="h-4 bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl p-12 border border-slate-700 text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-xl font-bold text-white mb-2">Нет квизов</h2>
          <p className="text-slate-400 mb-6">Создайте первый квиз для начала</p>
          <Link
            href="/admin/quizzes/new"
            className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
          >
            Создать квиз
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-white">{quiz.title}</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        quiz.isActive
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-slate-600/50 text-slate-400 border border-slate-500/30"
                      }`}
                    >
                      {quiz.isActive ? "Активен" : "Неактивен"}
                    </span>
                  </div>
                  {quiz.description && (
                    <p className="text-slate-400 mb-4">{quiz.description}</p>
                  )}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>❓</span>
                      <span>{quiz._count.questions} вопросов</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>🎯</span>
                      <span>{quiz._count.sessions} игр</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>🏆</span>
                      <span>{quiz.prizeTitle}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-6">
                  <button
                    onClick={() => toggleActive(quiz.id, quiz.isActive)}
                    className={`p-2 rounded-lg transition-colors ${
                      quiz.isActive
                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    }`}
                    title={quiz.isActive ? "Деактивировать" : "Активировать"}
                  >
                    {quiz.isActive ? "⏸️" : "▶️"}
                  </button>
                  <Link
                    href={`/admin/quizzes/${quiz.id}`}
                    className="p-2 bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    ✏️
                  </Link>
                  <button
                    onClick={() => deleteQuiz(quiz.id)}
                    className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

