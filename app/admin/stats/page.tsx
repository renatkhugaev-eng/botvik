"use client";

import { useEffect, useState } from "react";

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Статистика</h1>
        <p className="text-slate-400">Детальная аналитика приложения</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-1/3 mb-4" />
              <div className="h-40 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily Activity Chart Placeholder */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span>📅</span> Активность за 7 дней
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {stats?.dailyStats.map((day, index) => (
                <div key={index} className="text-center">
                  <div className="text-xs text-slate-400 mb-2">
                    {new Date(day.date).toLocaleDateString("ru-RU", { weekday: "short" })}
                  </div>
                  <div 
                    className="bg-gradient-to-t from-violet-600 to-violet-400 rounded-lg mx-auto"
                    style={{ 
                      width: "100%",
                      height: Math.max(20, (day.sessions / Math.max(...stats.dailyStats.map(d => d.sessions || 1))) * 100),
                    }}
                  />
                  <div className="text-sm text-white mt-2 font-semibold">{day.sessions}</div>
                  <div className="text-xs text-slate-400">игр</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Players */}
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>🏆</span> Топ игроки
              </h2>
              <div className="space-y-3">
                {stats?.topPlayers.slice(0, 10).map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-xl"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      index === 0 ? "bg-amber-500 text-white" :
                      index === 1 ? "bg-slate-400 text-white" :
                      index === 2 ? "bg-amber-700 text-white" :
                      "bg-slate-600 text-slate-300"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {player.firstName || player.username || "Аноним"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {player.gamesPlayed} игр
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-violet-400 font-bold">
                        {player.totalScore.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">очков</div>
                    </div>
                  </div>
                ))}
                {(!stats?.topPlayers || stats.topPlayers.length === 0) && (
                  <div className="text-center py-8 text-slate-400">
                    Нет данных
                  </div>
                )}
              </div>
            </div>

            {/* Quiz Performance */}
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>🎮</span> Популярность квизов
              </h2>
              <div className="space-y-3">
                {stats?.quizStats.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-4 bg-slate-700/50 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-medium">{quiz.title}</div>
                      <div className="text-sm text-slate-400">{quiz.sessions} игр</div>
                    </div>
                    <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                        style={{
                          width: `${(quiz.sessions / Math.max(...(stats?.quizStats.map(q => q.sessions) || [1]))) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Средний результат: {Math.round(quiz.avgScore).toLocaleString()} очков
                    </div>
                  </div>
                ))}
                {(!stats?.quizStats || stats.quizStats.length === 0) && (
                  <div className="text-center py-8 text-slate-400">
                    Нет данных
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

