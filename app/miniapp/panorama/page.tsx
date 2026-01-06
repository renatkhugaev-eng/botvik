"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSIONS LIST PAGE
 * Все миссии используют систему скрытых улик
 * Загружает миссии из API (БД или демо)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptic";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MissionListItem {
  id: string;
  title: string;
  description: string;
  location: string;
  icon: string;
  color?: string;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  cluesCount: number;
  timeLimit: number;
  xpReward: number;
  isFeatured: boolean;
  source: "db" | "demo";
  progress: {
    isCompleted: boolean;
    bestCluesFound: number;
    bestXpEarned: number;
    attempts: number;
    lastPlayedAt: string | null;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const DIFFICULTY_CONFIG: Record<MissionListItem["difficulty"], { label: string; color: string }> = {
  easy: { label: "Лёгкая", color: "#22c55e" },
  medium: { label: "Средняя", color: "#f59e0b" },
  hard: { label: "Сложная", color: "#ef4444" },
  extreme: { label: "Экстрим", color: "#7c3aed" },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PanoramaMissionsPage() {
  const router = useRouter();
  const [selectedMission, setSelectedMission] = useState<MissionListItem | null>(null);
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ─── Fetch missions from API ───
  useEffect(() => {
    async function fetchMissions() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await api.get<{ missions: MissionListItem[] }>("/api/panorama");
        
        if (data.missions) {
          setMissions(data.missions);
        } else {
          throw new Error("No missions in response");
        }
      } catch (e) {
        console.error("[panorama] Failed to fetch missions:", e);
        setError("Не удалось загрузить миссии");
      } finally {
        setLoading(false);
      }
    }
    
    fetchMissions();
  }, []);
  
  const handleMissionClick = (mission: MissionListItem) => {
    haptic.medium();
    setSelectedMission(mission);
  };
  
  const handleStartMission = () => {
    if (!selectedMission) return;
    haptic.heavy();
    router.push(`/miniapp/panorama/${selectedMission.id}`);
  };
  
  // ─── Loading state ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Загрузка миссий...</p>
        </div>
      </div>
    );
  }
  
  // ─── Error state ───
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/10 rounded-lg text-white"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-[#0a0a12] via-[#0a0a12] to-transparent pb-4">
        <div className="flex items-center justify-between px-4 pt-4">
          <button
            onClick={() => {
              haptic.light();
              router.back();
            }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Назад</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-400 font-medium">{missions.length} миссий</span>
          </div>
        </div>

        <div className="px-4 mt-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
            🔍 Расследования
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Улики скрыты — ищи внимательно!
          </p>
        </div>
      </div>
      
      {/* Missions Grid */}
      <div className="px-4 pb-24">
        <div className="grid gap-4">
          {missions.map((mission, index) => (
            <motion.button
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleMissionClick(mission)}
              className={`relative w-full p-4 rounded-2xl text-left transition-all
                ${selectedMission?.id === mission.id 
                  ? "bg-white/10 border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]" 
                  : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
            >
              {/* Featured badge */}
              {mission.isFeatured && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-xs font-bold shadow-lg">
                  ⭐ NEW
                </div>
              )}
              
              {/* Completed badge */}
              {mission.progress?.isCompleted && (
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              
              <div className="flex gap-4">
                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ 
                    backgroundColor: `${mission.color || "#06b6d4"}20`,
                    boxShadow: `0 0 20px ${mission.color || "#06b6d4"}20`,
                  }}
                >
                  {mission.icon || "🔍"}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {mission.title}
                  </h3>
                  <p className="text-sm text-white/50 mt-0.5">
                    📍 {mission.location}
                  </p>
                  
                  {/* Meta */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: `${DIFFICULTY_CONFIG[mission.difficulty].color}20`,
                        color: DIFFICULTY_CONFIG[mission.difficulty].color,
                      }}
                    >
                      {DIFFICULTY_CONFIG[mission.difficulty].label}
                    </span>
                    <span className="text-xs text-white/40">
                      🔍 {mission.cluesCount} улик
                    </span>
                    {mission.timeLimit && (
                      <span className="text-xs text-white/40">
                        ⏱️ {Math.floor(mission.timeLimit / 60)} мин
                      </span>
                    )}
                  </div>
                </div>
                
                {/* XP Badge */}
                <div className="flex flex-col items-end justify-center">
                  <span className="text-lg font-bold text-green-400">
                    +{mission.xpReward}
                  </span>
                  <span className="text-xs text-white/40">XP</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
        
        {/* Empty state */}
        {missions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/50">Нет доступных миссий</p>
          </div>
        )}
        
        {/* Info card */}
        {missions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl"
          >
            <div className="flex gap-3">
              <span className="text-2xl">👁️</span>
              <div>
                <h4 className="font-medium text-cyan-400 mb-1">Как найти улики?</h4>
                <p className="text-sm text-white/60">
                  Улики скрыты! Вращай камеру, смотри по сторонам. 
                  Когда смотришь в нужную сторону — улика появится. 
                  Сворачивай в переулки для секретных находок!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Bottom action bar */}
      {selectedMission && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12] to-transparent pt-8"
        >
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-4 mb-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: `${selectedMission.color || "#06b6d4"}20` }}
              >
                {selectedMission.icon || "🔍"}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{selectedMission.title}</h3>
                <p className="text-sm text-white/50">{selectedMission.location}</p>
              </div>
            </div>
            
            <button
              onClick={handleStartMission}
              className="w-full py-3.5 rounded-xl font-semibold text-white
                bg-gradient-to-r from-cyan-500 to-blue-500
                shadow-[0_10px_40px_rgba(6,182,212,0.3)]"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {selectedMission.progress?.isCompleted ? "Пройти снова" : "Начать расследование"}
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
