"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Spinner, Badge } from "flowbite-react";
import {
  HiUsers,
  HiCollection,
  HiCursorClick,
  HiCalendar,
  HiPlus,
  HiPencil,
  HiUserGroup,
  HiTrendingUp,
  HiChevronRight,
} from "react-icons/hi";

type DashboardStats = {
  totalUsers: number;
  totalQuizzes: number;
  totalSessions: number;
  todaySessions: number;
  avgScore: number;
  topQuiz: { title: string; sessions: number } | null;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Пользователей",
      value: stats?.totalUsers ?? 0,
      icon: HiUsers,
      color: "bg-blue-600",
      href: "/admin/users",
    },
    {
      label: "Квизов",
      value: stats?.totalQuizzes ?? 0,
      icon: HiCollection,
      color: "bg-purple-600",
      href: "/admin/quizzes",
    },
    {
      label: "Всего игр",
      value: stats?.totalSessions ?? 0,
      icon: HiCursorClick,
      color: "bg-pink-600",
      href: "/admin/stats",
    },
    {
      label: "Игр сегодня",
      value: stats?.todaySessions ?? 0,
      icon: HiCalendar,
      color: "bg-amber-500",
      href: "/admin/stats",
    },
  ];

  const quickActions = [
    {
      href: "/admin/quizzes/new",
      icon: HiPlus,
      title: "Создать новый квиз",
      description: "Добавить квиз с вопросами",
      color: "bg-green-600",
    },
    {
      href: "/admin/quizzes",
      icon: HiPencil,
      title: "Редактировать квизы",
      description: "Изменить существующие квизы",
      color: "bg-purple-600",
    },
    {
      href: "/admin/users",
      icon: HiUserGroup,
      title: "Управление пользователями",
      description: "Просмотр и модерация",
      color: "bg-blue-600",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Обзор статистики приложения</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${card.color}`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <HiChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-white">
                  {loading ? (
                    <div className="h-9 w-20 bg-gray-700 rounded animate-pulse" />
                  ) : (
                    card.value.toLocaleString()
                  )}
                </div>
                <div className="text-gray-400 mt-1">{card.label}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions & Top Quiz */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="bg-gray-800 border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <HiTrendingUp className="w-5 h-5 text-purple-400" />
            Быстрые действия
          </h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-4 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-colors group"
              >
                <div className={`p-2.5 ${action.color} rounded-lg`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium group-hover:text-purple-400 transition-colors">
                    {action.title}
                  </div>
                  <div className="text-sm text-gray-400">{action.description}</div>
                </div>
                <HiChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Top Quiz & Avg Score */}
        <Card className="bg-gray-800 border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🏆 Популярный квиз
          </h2>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-700 rounded w-1/2" />
            </div>
          ) : stats?.topQuiz ? (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
              <div className="text-2xl font-bold text-white mb-2">
                {stats.topQuiz.title}
              </div>
              <Badge color="warning" size="lg">
                {stats.topQuiz.sessions.toLocaleString()} игр
              </Badge>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">
              Нет данных о квизах
            </div>
          )}

          {/* Average Score */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="text-gray-400 mb-2">Средний результат</div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <div className="h-9 w-24 bg-gray-700 rounded animate-pulse" />
              ) : (
                <>{Math.round(stats?.avgScore ?? 0).toLocaleString()} очков</>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
