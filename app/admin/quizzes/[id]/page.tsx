"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Button,
  TextInput,
  Textarea,
  ToggleSwitch,
  Spinner,
  Badge,
} from "flowbite-react";
import {
  HiArrowLeft,
  HiSave,
} from "react-icons/hi";

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
        <Spinner size="xl" color="purple" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-white mb-2">Квиз не найден</h2>
        <Link href="/admin/quizzes" className="text-purple-400 hover:text-purple-300">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <Link href="/admin/quizzes">
          <Button color="gray" size="sm">
            <HiArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Редактирование квиза</h1>
          <p className="text-gray-400">ID: {quiz.id}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          color="success"
          size="lg"
        >
          {saving ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <HiSave className="w-5 h-5 mr-2" />
          )}
          Сохранить
        </Button>
      </div>

      {/* Quiz Info */}
      <Card className="bg-gray-800 border-gray-700 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Основная информация</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">Название квиза</label>
            <TextInput
              id="title"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              color="gray"
            />
          </div>
          <div>
            <label htmlFor="prizeTitle" className="block text-sm font-medium text-gray-300 mb-2">Название приза</label>
            <TextInput
              id="prizeTitle"
              value={quiz.prizeTitle}
              onChange={(e) => setQuiz({ ...quiz, prizeTitle: e.target.value })}
              color="gray"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">Описание</label>
            <Textarea
              id="description"
              value={quiz.description || ""}
              onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
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

      {/* Questions Preview */}
      <Card className="bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            Вопросы ({quiz.questions.length})
          </h2>
          <Badge color="gray">
            Редактирование вопросов в разработке
          </Badge>
        </div>

        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <div
              key={question.id || index}
              className="bg-gray-700/50 rounded-xl p-4 border border-gray-600"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white mb-2">{question.text}</div>
                  <div className="flex flex-wrap gap-2">
                    {question.answers.map((answer, aIndex) => (
                      <Badge
                        key={aIndex}
                        color={answer.isCorrect ? "success" : "gray"}
                        size="sm"
                      >
                        {answer.isCorrect && "✓ "}
                        {answer.text}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge
                  color={
                    question.difficulty === 1 ? "success" :
                    question.difficulty === 2 ? "warning" : "failure"
                  }
                  size="sm"
                >
                  {question.difficulty === 1 ? "Легкий" : question.difficulty === 2 ? "Средний" : "Сложный"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
