"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Answer = {
  text: string;
  isCorrect: boolean;
};

type Question = {
  text: string;
  difficulty: number;
  answers: Answer[];
};

export default function NewQuizPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [quiz, setQuiz] = useState({
    title: "",
    description: "",
    prizeTitle: "",
    prizeDescription: "",
    isActive: true,
  });

  const [questions, setQuestions] = useState<Question[]>([]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: "",
        difficulty: 1,
        answers: [
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
      },
    ]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const updateAnswer = (qIndex: number, aIndex: number, field: string, value: any) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              answers: q.answers.map((a, j) => {
                if (field === "isCorrect" && value === true) {
                  // Only one correct answer
                  return j === aIndex ? { ...a, isCorrect: true } : { ...a, isCorrect: false };
                }
                return j === aIndex ? { ...a, [field]: value } : a;
              }),
            }
          : q
      )
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quiz.title || !quiz.prizeTitle) {
      alert("Заполните название и приз");
      return;
    }

    if (questions.length === 0) {
      alert("Добавьте хотя бы один вопрос");
      return;
    }

    for (const q of questions) {
      if (!q.text) {
        alert("Заполните текст всех вопросов");
        return;
      }
      const hasCorrect = q.answers.some((a) => a.isCorrect);
      if (!hasCorrect) {
        alert("Каждый вопрос должен иметь правильный ответ");
        return;
      }
      const filledAnswers = q.answers.filter((a) => a.text.trim());
      if (filledAnswers.length < 2) {
        alert("Каждый вопрос должен иметь минимум 2 варианта ответа");
        return;
      }
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quiz,
          questions: questions.map((q) => ({
            ...q,
            answers: q.answers.filter((a) => a.text.trim()),
          })),
        }),
      });

      if (res.ok) {
        router.push("/admin/quizzes");
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка создания квиза");
      }
    } catch (error) {
      console.error("Failed to create quiz:", error);
      alert("Ошибка создания квиза");
    } finally {
      setSaving(false);
    }
  };

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
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Новый квиз</h1>
          <p className="text-slate-400">Создайте квиз с вопросами</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Quiz Info */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-6">Основная информация</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Название квиза *
              </label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                placeholder="Например: Серийные убийцы США"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Название приза *
              </label>
              <input
                type="text"
                value={quiz.prizeTitle}
                onChange={(e) => setQuiz({ ...quiz, prizeTitle: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                placeholder="Например: Мастер профайлинга"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Описание
              </label>
              <textarea
                value={quiz.description}
                onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 resize-none"
                rows={3}
                placeholder="Краткое описание квиза..."
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

        {/* Questions */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              Вопросы ({questions.length})
            </h2>
            <button
              type="button"
              onClick={addQuestion}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <span>➕</span> Добавить вопрос
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-4">❓</div>
              <p>Нажмите "Добавить вопрос" чтобы начать</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, qIndex) => (
                <div
                  key={qIndex}
                  className="bg-slate-700/50 rounded-xl p-5 border border-slate-600"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-sm font-medium text-violet-400">
                      Вопрос {qIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Удалить
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                          placeholder="Текст вопроса..."
                        />
                      </div>
                      <select
                        value={question.difficulty}
                        onChange={(e) => updateQuestion(qIndex, "difficulty", Number(e.target.value))}
                        className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value={1}>🟢 Легкий</option>
                        <option value={2}>🟡 Средний</option>
                        <option value={3}>🔴 Сложный</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {question.answers.map((answer, aIndex) => (
                        <div key={aIndex} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateAnswer(qIndex, aIndex, "isCorrect", true)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              answer.isCorrect
                                ? "bg-green-500 text-white"
                                : "bg-slate-600 text-slate-400 hover:bg-slate-500"
                            }`}
                            title={answer.isCorrect ? "Правильный ответ" : "Сделать правильным"}
                          >
                            ✓
                          </button>
                          <input
                            type="text"
                            value={answer.text}
                            onChange={(e) => updateAnswer(qIndex, aIndex, "text", e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 text-sm"
                            placeholder={`Вариант ${aIndex + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/quizzes"
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <span>💾</span> Создать квиз
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

