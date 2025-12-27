"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchWithAuth } from "@/lib/api";

type EnergyDiagnostics = {
  ok: boolean;
  user: {
    id: number;
    telegramId: number;
    username: string | null;
  };
  energy: {
    used: number;
    remaining: number;
    max: number;
    bonus: number;
    nextEnergyAt: string | null;
    hoursPerSlot: number;
  };
  recentSessions: Array<{
    id: number;
    quizId: number;
    startedAt: string;
    finishedAt: string | null;
    finished: boolean;
    score: number;
    isTournamentQuiz: boolean;
  }>;
  unfinishedSessions: Array<{
    id: number;
    quizId: number;
    quizTitle: string;
    startedAt: string;
    ageMinutes: number;
    currentQuestion: number;
  }>;
  tournaments: {
    active: Array<{
      id: number;
      title: string;
      quizIds: number[];
    }>;
    participating: Array<{
      tournamentId: number;
      title: string;
      status: string;
      currentStage: number;
    }>;
  };
  issues: string[];
  diagnosis: string;
};

export default function EnergyDebugPage() {
  const [data, setData] = useState<EnergyDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth("/api/debug/energy")
      .then(res => res.json())
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e] p-4">
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300">
          Ошибка: {error ?? "Не удалось загрузить данные"}
        </div>
      </div>
    );
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e] p-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">🔍 Диагностика энергии</h1>
          <p className="text-white/50 text-sm mt-1">User ID: {data.user.id}</p>
        </div>

        {/* Diagnosis */}
        <div className={`rounded-xl p-4 ${
          data.issues.length > 0 
            ? "bg-amber-500/20 border border-amber-500/50" 
            : "bg-emerald-500/20 border border-emerald-500/50"
        }`}>
          <p className="font-bold text-white">{data.diagnosis}</p>
          {data.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.issues.map((issue, i) => (
                <li key={i} className="text-amber-200 text-sm">{issue}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Energy Status */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-3">⚡ Статус энергии</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-amber-400">
                {data.energy.remaining}/{data.energy.max}
              </div>
              <div className="text-xs text-white/50">Осталось</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-violet-400">
                +{data.energy.bonus}
              </div>
              <div className="text-xs text-white/50">Бонусная</div>
            </div>
          </div>
          {data.energy.nextEnergyAt && (
            <p className="text-sm text-white/50 mt-3 text-center">
              Следующее восстановление: {formatDate(data.energy.nextEnergyAt)}
            </p>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-3">
            📊 Сессии за 4ч ({data.recentSessions.length})
          </h2>
          {data.recentSessions.length === 0 ? (
            <p className="text-white/50 text-sm">Нет сессий за последние 4 часа</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.recentSessions.map(s => (
                <div key={s.id} className="bg-white/5 rounded-lg p-2 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-white">Quiz #{s.quizId}</span>
                    {s.isTournamentQuiz && (
                      <span className="ml-2 px-1.5 py-0.5 bg-violet-500/30 text-violet-300 rounded text-xs">
                        🏆 Турнир
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-white/70">{formatTime(s.startedAt)}</div>
                    <div className={s.finished ? "text-emerald-400" : "text-amber-400"}>
                      {s.finished ? `✓ ${s.score} очков` : "⏳ Не завершён"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unfinished Sessions */}
        {data.unfinishedSessions.length > 0 && (
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
            <h2 className="text-lg font-bold text-amber-300 mb-3">
              ⚠️ Незавершённые сессии ({data.unfinishedSessions.length})
            </h2>
            <p className="text-amber-200/70 text-sm mb-3">
              Эти сессии продолжаются вместо создания новых — энергия не тратится!
            </p>
            <div className="space-y-2">
              {data.unfinishedSessions.map(s => (
                <div key={s.id} className="bg-white/5 rounded-lg p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white">{s.quizTitle}</span>
                    <span className="text-amber-300">{s.ageMinutes} мин назад</span>
                  </div>
                  <div className="text-white/50 text-xs">
                    Вопрос {s.currentQuestion + 1} • ID: {s.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tournament Status */}
        {data.tournaments.participating.length > 0 && (
          <div className="bg-violet-500/10 rounded-xl p-4 border border-violet-500/30">
            <h2 className="text-lg font-bold text-violet-300 mb-3">
              🏆 Активные турниры
            </h2>
            <p className="text-violet-200/70 text-sm mb-3">
              Турнирные квизы не тратят энергию!
            </p>
            <div className="space-y-2">
              {data.tournaments.participating.map(t => (
                <div key={t.tournamentId} className="bg-white/5 rounded-lg p-2 text-sm">
                  <div className="text-white">{t.title}</div>
                  <div className="text-white/50 text-xs">
                    Этап {t.currentStage} • Статус: {t.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw JSON (collapsible) */}
        <details className="bg-white/5 rounded-xl p-4 border border-white/10">
          <summary className="text-white/70 cursor-pointer">📋 Raw JSON</summary>
          <pre className="mt-3 text-xs text-white/50 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </motion.div>
    </div>
  );
}

