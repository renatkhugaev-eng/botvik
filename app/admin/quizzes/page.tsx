"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Button, Spinner, Badge } from "flowbite-react";
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiPlay,
  HiPause,
  HiQuestionMarkCircle,
  HiCursorClick,
  HiGift,
  HiExclamation,
} from "react-icons/hi";

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
  const [deleteModal, setDeleteModal] = useState<Quiz | null>(null);

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
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
        setDeleteModal(null);
      }
    } catch (error) {
      console.error("Failed to delete quiz:", error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Квизы</h1>
          <p className="text-gray-400">Управление квизами и вопросами</p>
        </div>
        <Link href="/admin/quizzes/new">
          <Button color="success" size="lg">
            <HiPlus className="w-5 h-5 mr-2" />
            Создать квиз
          </Button>
        </Link>
      </div>

      {/* Quizzes List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" color="purple" />
        </div>
      ) : quizzes.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700 text-center py-12">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-xl font-bold text-white mb-2">Нет квизов</h2>
          <p className="text-gray-400 mb-6">Создайте первый квиз для начала</p>
          <Link href="/admin/quizzes/new">
            <Button color="purple">
              Создать квиз
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-white">{quiz.title}</h2>
                    <Badge color={quiz.isActive ? "success" : "gray"}>
                      {quiz.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </div>
                  {quiz.description && (
                    <p className="text-gray-400 mb-4">{quiz.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <HiQuestionMarkCircle className="w-4 h-4" />
                      <span>{quiz._count.questions} вопросов</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <HiCursorClick className="w-4 h-4" />
                      <span>{quiz._count.sessions} игр</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <HiGift className="w-4 h-4" />
                      <span>{quiz.prizeTitle}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    color={quiz.isActive ? "warning" : "success"}
                    onClick={() => toggleActive(quiz.id, quiz.isActive)}
                  >
                    {quiz.isActive ? (
                      <HiPause className="w-4 h-4" />
                    ) : (
                      <HiPlay className="w-4 h-4" />
                    )}
                  </Button>
                  <Link href={`/admin/quizzes/${quiz.id}`}>
                    <Button size="sm" color="purple">
                      <HiPencil className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    color="failure"
                    onClick={() => setDeleteModal(quiz)}
                  >
                    <HiTrash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="text-center">
              <HiExclamation className="mx-auto mb-4 h-14 w-14 text-red-500" />
              <h3 className="mb-5 text-lg font-normal text-gray-400">
                Удалить квиз &quot;{deleteModal.title}&quot;?
                <br />
                <span className="text-sm">Это действие нельзя отменить.</span>
              </h3>
              <div className="flex justify-center gap-4">
                <Button color="failure" onClick={() => deleteQuiz(deleteModal.id)}>
                  Да, удалить
                </Button>
                <Button color="gray" onClick={() => setDeleteModal(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
