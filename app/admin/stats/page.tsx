"use client";

import { useEffect, useState } from "react";
import { Card, Spinner, Progress, Avatar, Badge } from "flowbite-react";
import {
  HiCalendar,
  HiStar,
  HiChartBar,
} from "react-icons/hi";

type StatsData = {
  dailyStats: { date: string; sessions: number; users: number }[];
  topPlayers: { 
    id: number; 
    firstName: string | null; 
    username: string | null; 
    totalScore: number;
    gamesPlayed: number;
  }[];
  quizStats: {
    id: number;
    title: string;
    sessions: number;
    avgScore: number;
  }[];
};

export default function AdminStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats/detailed");
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

  const maxSessions = Math.max(...(stats?.dailyStats.map(d => d.sessions) || [1]));
  const maxQuizSessions = Math.max(...(stats?.quizStats.map(q => q.sessions) || [1]));

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Статистика</h1>
        <p className="text-gray-400">Детальная аналитика приложения</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" color="purple" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily Activity Chart */}
          <Card className="bg-gray-800 border-gray-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <HiCalendar className="w-5 h-5 text-purple-400" />
              Активность за 7 дней
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {stats?.dailyStats.map((day, index) => (
                <div key={index} className="text-center">
                  <div className="text-xs text-gray-400 mb-2">
                    {new Date(day.date).toLocaleDateString("ru-RU", { weekday: "short" })}
                  </div>
                  <div 
                    className="bg-gradient-to-t from-purple-600 to-purple-400 rounded-lg mx-auto transition-all"
                    style={{ 
                      width: "100%",
                      height: Math.max(20, (day.sessions / maxSessions) * 100),
                    }}
                  />
                  <div className="text-sm text-white mt-2 font-semibold">{day.sessions}</div>
                  <div className="text-xs text-gray-400">игр</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Players */}
            <Card className="bg-gray-800 border-gray-700">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <HiStar className="w-5 h-5 text-amber-400" />
                Топ игроки
              </h2>
              <div className="space-y-3">
                {stats?.topPlayers.slice(0, 10).map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-xl"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      index === 0 ? "bg-amber-500 text-white" :
                      index === 1 ? "bg-gray-400 text-white" :
                      index === 2 ? "bg-amber-700 text-white" :
                      "bg-gray-600 text-gray-300"
                    }`}>
                      {index + 1}
                    </div>
                    <Avatar
                      placeholderInitials={(player.firstName?.[0] || player.username?.[0] || "?").toUpperCase()}
                      rounded
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {player.firstName || player.username || "Аноним"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.gamesPlayed} игр
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge color="purple" size="sm">
                        {player.totalScore.toLocaleString()} очков
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!stats?.topPlayers || stats.topPlayers.length === 0) && (
                  <div className="text-center py-8 text-gray-400">
                    Нет данных
                  </div>
                )}
              </div>
            </Card>

            {/* Quiz Performance */}
            <Card className="bg-gray-800 border-gray-700">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <HiChartBar className="w-5 h-5 text-pink-400" />
                Популярность квизов
              </h2>
              <div className="space-y-4">
                {stats?.quizStats.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-4 bg-gray-700/50 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-medium">{quiz.title}</div>
                      <Badge color="gray">{quiz.sessions} игр</Badge>
                    </div>
                    <Progress
                      progress={(quiz.sessions / maxQuizSessions) * 100}
                      color="purple"
                      size="sm"
                    />
                    <div className="text-xs text-gray-400 mt-2">
                      Средний результат: {Math.round(quiz.avgScore).toLocaleString()} очков
                    </div>
                  </div>
                ))}
                {(!stats?.quizStats || stats.quizStats.length === 0) && (
                  <div className="text-center py-8 text-gray-400">
                    Нет данных
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
