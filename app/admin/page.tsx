"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
      icon: "👥",
      color: "from-blue-500 to-cyan-500",
      href: "/admin/users",
    },
    {
      label: "Квизов",
      value: stats?.totalQuizzes ?? 0,
      icon: "🎮",
      color: "from-violet-500 to-purple-500",
      href: "/admin/quizzes",
    },
    {
      label: "Всего игр",
      value: stats?.totalSessions ?? 0,
      icon: "🎯",
      color: "from-pink-500 to-rose-500",
      href: "/admin/stats",
    },
    {
      label: "Игр сегодня",
      value: stats?.todaySessions ?? 0,
      icon: "📅",
      color: "from-amber-500 to-orange-500",
      href: "/admin/stats",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Обзор статистики приложения</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-2xl shadow-lg`}>
                {card.icon}
              </div>
              <svg
                className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? (
                <div className="h-9 w-20 bg-slate-700 rounded animate-pulse" />
              ) : (
                card.value.toLocaleString()
              )}
            </div>
            <div className="text-slate-400">{card.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚡</span> Быстрые действия
          </h2>
          <div className="space-y-3">
            <Link
              href="/admin/quizzes/new"
              className="flex items-center gap-4 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-xl">
                ➕
              </div>
              <div className="flex-1">
                <div className="text-white font-medium group-hover:text-green-400 transition-colors">
                  Создать новый квиз
                </div>
                <div className="text-sm text-slate-400">Добавить квиз с вопросами</div>
              </div>
            </Link>
            <Link
              href="/admin/quizzes"
              className="flex items-center gap-4 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center text-xl">
                ✏️
              </div>
              <div className="flex-1">
                <div className="text-white font-medium group-hover:text-violet-400 transition-colors">
                  Редактировать квизы
                </div>
                <div className="text-sm text-slate-400">Изменить существующие квизы</div>
              </div>
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-4 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-xl">
                👥
              </div>
              <div className="flex-1">
                <div className="text-white font-medium group-hover:text-blue-400 transition-colors">
                  Управление пользователями
                </div>
                <div className="text-sm text-slate-400">Просмотр и модерация</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Top Quiz */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>🏆</span> Популярный квиз
          </h2>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-slate-700 rounded w-3/4" />
              <div className="h-4 bg-slate-700 rounded w-1/2" />
            </div>
          ) : stats?.topQuiz ? (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
              <div className="text-2xl font-bold text-white mb-2">
                {stats.topQuiz.title}
              </div>
              <div className="text-amber-400">
                {stats.topQuiz.sessions.toLocaleString()} игр
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-center py-8">
              Нет данных о квизах
            </div>
          )}

          {/* Average Score */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="text-slate-400 mb-2">Средний результат</div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <div className="h-9 w-24 bg-slate-700 rounded animate-pulse" />
              ) : (
                <>{Math.round(stats?.avgScore ?? 0).toLocaleString()} очков</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

