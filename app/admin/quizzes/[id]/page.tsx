"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Answer = {
  id?: number;
  text: string;
  isCorrect: boolean;
};

type Question = {
  id?: number;
  text: string;
  difficulty: number;
  order: number;
  answers: Answer[];
};

type Quiz = {
  id: number;
  title: string;
  description: string | null;
  prizeTitle: string;
  prizeDescription: string | null;
  isActive: boolean;
  questions: Question[];
};

export default function EditQuizPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetch(`/api/admin/quizzes/${quizId}`);
        if (res.ok) {
          const data = await res.json();
          setQuiz(data.quiz);
        }
      } catch (error) {
        console.error("Failed to fetch quiz:", error);
      } finally {
        setLoading(false);
      }
    };

    if (quizId) fetchQuiz();
  }, [quizId]);

  const handleSave = async () => {
    if (!quiz) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quiz.title,
          description: quiz.description,
          prizeTitle: quiz.prizeTitle,
          prizeDescription: quiz.prizeDescription,
          isActive: quiz.isActive,
        }),
      });

      if (res.ok) {
        router.push("/admin/quizzes");
      } else {
        alert("Ошибка сохранения");
      }
    } catch (error) {
      console.error("Failed to save quiz:", error);
      alert("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-white mb-2">Квиз не найден</h2>
        <Link href="/admin/quizzes" className="text-violet-400 hover:text-violet-300">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/quizzes"
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white mb-1">Редактирование квиза</h1>
          <p className="text-slate-400">ID: {quiz.id}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 flex items-center gap-2"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>💾</span>
          )}
          Сохранить
        </button>
      </div>

      {/* Quiz Info */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Основная информация</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Название квиза
            </label>
            <input
              type="text"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Название приза
            </label>
            <input
              type="text"
              value={quiz.prizeTitle}
              onChange={(e) => setQuiz({ ...quiz, prizeTitle: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Описание
            </label>
            <textarea
              value={quiz.description || ""}
              onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 resize-none"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={quiz.isActive}
              onChange={(e) => setQuiz({ ...quiz, isActive: e.target.checked })}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-violet-500 focus:ring-violet-500"
            />
            <label htmlFor="isActive" className="text-slate-300">
              Активен (виден пользователям)
            </label>
          </div>
        </div>
      </div>

      {/* Questions Preview */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            Вопросы ({quiz.questions.length})
          </h2>
          <span className="text-sm text-slate-400">
            Редактирование вопросов в разработке
          </span>
        </div>

        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <div
              key={question.id || index}
              className="bg-slate-700/50 rounded-xl p-4 border border-slate-600"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-violet-500/20 text-violet-400 rounded-lg flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-white mb-2">{question.text}</div>
                  <div className="flex flex-wrap gap-2">
                    {question.answers.map((answer, aIndex) => (
                      <span
                        key={aIndex}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          answer.isCorrect
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-slate-600/50 text-slate-400"
                        }`}
                      >
                        {answer.isCorrect && "✓ "}
                        {answer.text}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    question.difficulty === 1
                      ? "bg-green-500/20 text-green-400"
                      : question.difficulty === 2
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {question.difficulty === 1 ? "Легкий" : question.difficulty === 2 ? "Средний" : "Сложный"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

