"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Button,
  TextInput,
  Textarea,
  ToggleSwitch,
  Select,
  Spinner,
  Badge,
} from "flowbite-react";
import {
  HiArrowLeft,
  HiPlus,
  HiTrash,
  HiCheck,
  HiSave,
} from "react-icons/hi";

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

  const updateQuestion = (index: number, field: string, value: string | number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const updateAnswer = (qIndex: number, aIndex: number, field: string, value: string | boolean) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              answers: q.answers.map((a, j) => {
                if (field === "isCorrect" && value === true) {
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
        <Link href="/admin/quizzes">
          <Button color="gray" size="sm">
            <HiArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Новый квиз</h1>
          <p className="text-gray-400">Создайте квиз с вопросами</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Quiz Info */}
        <Card className="bg-gray-800 border-gray-700">
          <h2 className="text-xl font-bold text-white mb-6">Основная информация</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">Название квиза *</label>
              <TextInput
                id="title"
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                placeholder="Например: Серийные убийцы США"
                color="gray"
              />
            </div>
            <div>
              <label htmlFor="prizeTitle" className="block text-sm font-medium text-gray-300 mb-2">Название приза *</label>
              <TextInput
                id="prizeTitle"
                value={quiz.prizeTitle}
                onChange={(e) => setQuiz({ ...quiz, prizeTitle: e.target.value })}
                placeholder="Например: Мастер профайлинга"
                color="gray"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">Описание</label>
              <Textarea
                id="description"
                value={quiz.description}
                onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                placeholder="Краткое описание квиза..."
                rows={3}
                color="gray"
              />
            </div>
            <div className="flex items-center gap-3">
              <ToggleSwitch
                checked={quiz.isActive}
                label="Активен (виден пользователям)"
                onChange={(checked) => setQuiz({ ...quiz, isActive: checked })}
              />
            </div>
          </div>
        </Card>

        {/* Questions */}
        <Card className="bg-gray-800 border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              Вопросы ({questions.length})
            </h2>
            <Button color="purple" onClick={addQuestion} type="button">
              <HiPlus className="w-5 h-5 mr-2" />
              Добавить вопрос
            </Button>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-4">❓</div>
              <p>Нажмите &quot;Добавить вопрос&quot; чтобы начать</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, qIndex) => (
                <div
                  key={qIndex}
                  className="bg-gray-700/50 rounded-xl p-5 border border-gray-600"
                >
                  <div className="flex items-start justify-between mb-4">
                    <Badge color="purple">Вопрос {qIndex + 1}</Badge>
                    <Button
                      size="xs"
                      color="failure"
                      onClick={() => removeQuestion(qIndex)}
                      type="button"
                    >
                      <HiTrash className="w-4 h-4 mr-1" />
                      Удалить
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <TextInput
                          value={question.text}
                          onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                          placeholder="Текст вопроса..."
                          color="gray"
                        />
                      </div>
                      <Select
                        value={question.difficulty}
                        onChange={(e) => updateQuestion(qIndex, "difficulty", Number(e.target.value))}
                        color="gray"
                      >
                        <option value={1}>🟢 Легкий</option>
                        <option value={2}>🟡 Средний</option>
                        <option value={3}>🔴 Сложный</option>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {question.answers.map((answer, aIndex) => (
                        <div key={aIndex} className="flex items-center gap-2">
                          <Button
                            size="sm"
                            color={answer.isCorrect ? "success" : "gray"}
                            onClick={() => updateAnswer(qIndex, aIndex, "isCorrect", true)}
                            type="button"
                          >
                            <HiCheck className="w-4 h-4" />
                          </Button>
                          <TextInput
                            value={answer.text}
                            onChange={(e) => updateAnswer(qIndex, aIndex, "text", e.target.value)}
                            placeholder={`Вариант ${aIndex + 1}`}
                            color="gray"
                            sizing="sm"
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/admin/quizzes">
            <Button color="gray">Отмена</Button>
          </Link>
          <Button
            type="submit"
            disabled={saving}
            color="success"
            size="lg"
          >
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Сохранение...
              </>
            ) : (
              <>
                <HiSave className="w-5 h-5 mr-2" />
                Создать квиз
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
