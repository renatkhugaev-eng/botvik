"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSIONS LIST — ADMIN PAGE
 * Список всех панорамных миссий с управлением
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Mission {
  id: string;
  title: string;
  description: string;
  location: string;
  difficulty: string;
  theme: string;
  clueCount: number;
  requiredClues: number;
  timeLimit: number;
  xpReward: number;
  isPublished: boolean;
  isFeatured: boolean;
  playCount: number;
  avgCompletionTime: number | null;
  avgCluesFound: number | null;
  createdAt: string;
  publishedAt: string | null;
  createdBy: {
    id: number;
    firstName: string | null;
    username: string | null;
  } | null;
}

interface Stats {
  total: number;
  published: number;
  totalPlays: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  extreme: "bg-red-500/20 text-red-400 border-red-500/30",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
  extreme: "Экстрим",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PanoramaMissionsPage() {
  const router = useRouter();
  
  const [missions, setMissions] = useState<Mission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // ─── Fetch missions ───
  const fetchMissions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/panorama/missions?all=true", {
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.ok) {
        setMissions(data.missions);
        setStats(data.stats);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (e) {
      console.error("Failed to fetch missions:", e);
      setError("Не удалось загрузить миссии");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);
  
  // ─── Toggle publish ───
  const handleTogglePublish = useCallback(async (id: string, currentState: boolean) => {
    setActionLoading(id);
    
    try {
      const res = await fetch(`/api/admin/panorama/missions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublished: !currentState }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMissions(prev => prev.map(m => 
          m.id === id ? { ...m, isPublished: !currentState, publishedAt: data.mission.publishedAt } : m
        ));
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error("Failed to toggle publish:", e);
      setError("Не удалось изменить статус публикации");
    } finally {
      setActionLoading(null);
    }
  }, []);
  
  // ─── Toggle featured ───
  const handleToggleFeatured = useCallback(async (id: string, currentState: boolean) => {
    setActionLoading(id);
    
    try {
      const res = await fetch(`/api/admin/panorama/missions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isFeatured: !currentState }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMissions(prev => prev.map(m => 
          m.id === id ? { ...m, isFeatured: !currentState } : m
        ));
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error("Failed to toggle featured:", e);
      setError("Не удалось изменить статус");
    } finally {
      setActionLoading(null);
    }
  }, []);
  
  // ─── Delete mission ───
  const handleDelete = useCallback(async (id: string, title: string) => {
    if (!confirm(`Удалить миссию "${title}"? Это действие необратимо.`)) {
      return;
    }
    
    setActionLoading(id);
    
    try {
      const res = await fetch(`/api/admin/panorama/missions/${id}?force=true`, {
        method: "DELETE",
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMissions(prev => prev.filter(m => m.id !== id));
        if (stats) {
          setStats({ ...stats, total: stats.total - 1 });
        }
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error("Failed to delete:", e);
      setError("Не удалось удалить миссию");
    } finally {
      setActionLoading(null);
    }
  }, [stats]);
  
  // ─── Filtered missions ───
  const filteredMissions = missions.filter(m => {
    if (filter === "published") return m.isPublished;
    if (filter === "draft") return !m.isPublished;
    return true;
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  
  return (
    <div className="pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              📋 Список миссий
            </h1>
            <p className="text-slate-400 mt-1">
              Управление панорамными миссиями
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => router.push("/admin/panorama")}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
            >
              ➕ Создать миссию
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push("/admin")}
              className="text-slate-300 border-slate-600 hover:bg-slate-700"
            >
              ← Назад
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-white">{stats.total}</div>
                <div className="text-slate-400 text-sm">Всего миссий</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-400">{stats.published}</div>
                <div className="text-slate-400 text-sm">Опубликовано</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-cyan-400">{stats.totalPlays}</div>
                <div className="text-slate-400 text-sm">Прохождений</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-xl text-red-200 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-white">✕</button>
          </div>
        )}
        
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "published", "draft"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {f === "all" && `Все (${missions.length})`}
              {f === "published" && `Опубликованные (${missions.filter(m => m.isPublished).length})`}
              {f === "draft" && `Черновики (${missions.filter(m => !m.isPublished).length})`}
            </button>
          ))}
        </div>
        
        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3 animate-pulse">🗺️</div>
            Загрузка миссий...
          </div>
        )}
        
        {/* Empty state */}
        {!loading && filteredMissions.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-slate-400">
                {filter === "all" 
                  ? "Миссий пока нет. Создайте первую!"
                  : filter === "published"
                    ? "Нет опубликованных миссий"
                    : "Нет черновиков"
                }
              </div>
              {filter === "all" && (
                <Button
                  onClick={() => router.push("/admin/panorama")}
                  className="mt-4 bg-cyan-600 hover:bg-cyan-500"
                >
                  ➕ Создать миссию
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Missions list */}
        {!loading && filteredMissions.length > 0 && (
          <div className="space-y-4">
            {filteredMissions.map(mission => (
              <Card 
                key={mission.id} 
                className={`bg-slate-800/50 border-slate-700 transition-all ${
                  mission.isFeatured ? "ring-2 ring-amber-500/50" : ""
                }`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {/* Icon & Status */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-3xl">🗺️</div>
                      <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                        mission.isPublished 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-slate-600/50 text-slate-400"
                      }`}>
                        {mission.isPublished ? "✓ Опубл." : "Черновик"}
                      </div>
                      {mission.isFeatured && (
                        <div className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                          ⭐ Featured
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-bold text-lg truncate">{mission.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                          DIFFICULTY_COLORS[mission.difficulty] || DIFFICULTY_COLORS.medium
                        }`}>
                          {DIFFICULTY_LABELS[mission.difficulty] || mission.difficulty}
                        </span>
                      </div>
                      
                      <p className="text-slate-400 text-sm mb-2 line-clamp-1">{mission.description}</p>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>📍 {mission.location}</span>
                        <span>🔍 {mission.clueCount} улик</span>
                        <span>⏱️ {formatTime(mission.timeLimit)}</span>
                        <span>⭐ {mission.xpReward} XP</span>
                        <span>🎮 {mission.playCount} игр</span>
                        {mission.createdBy && (
                          <span>👤 {mission.createdBy.firstName || mission.createdBy.username}</span>
                        )}
                        <span>📅 {formatDate(mission.createdAt)}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleTogglePublish(mission.id, mission.isPublished)}
                        disabled={actionLoading === mission.id}
                        className={mission.isPublished 
                          ? "bg-slate-600 hover:bg-slate-500 text-white"
                          : "bg-green-600 hover:bg-green-500 text-white"
                        }
                      >
                        {actionLoading === mission.id ? "..." : mission.isPublished ? "Снять" : "Опубл."}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleFeatured(mission.id, mission.isFeatured)}
                        disabled={actionLoading === mission.id}
                        className={mission.isFeatured
                          ? "border-amber-500 text-amber-400 hover:bg-amber-500/20"
                          : "border-slate-600 text-slate-400 hover:bg-slate-700"
                        }
                      >
                        {mission.isFeatured ? "★" : "☆"}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(mission.id, mission.title)}
                        disabled={actionLoading === mission.id}
                        className="border-red-600/50 text-red-400 hover:bg-red-600/20"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

