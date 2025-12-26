"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HIDDEN CLUE MISSIONS PAGE
 * Список миссий со скрытыми уликами
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptic";
import { HiddenClueMission as MissionComponent } from "@/components/panorama";
import { getAllHiddenClueMissions } from "@/lib/panorama-missions";
import type { HiddenClueMission } from "@/types/hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const DIFFICULTY_CONFIG: Record<HiddenClueMission["difficulty"], { label: string; color: string }> = {
  easy: { label: "Лёгкая", color: "#22c55e" },
  medium: { label: "Средняя", color: "#f59e0b" },
  hard: { label: "Сложная", color: "#ef4444" },
  extreme: { label: "Экстрим", color: "#7c3aed" },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function HiddenClueMissionsPage() {
  const router = useRouter();
  const [activeMission, setActiveMission] = useState<HiddenClueMission | null>(null);
  
  const missions = getAllHiddenClueMissions();
  
  const handleMissionComplete = (result: {
    missionId: string;
    cluesCollected: number;
    cluesTotal: number;
    timeSpent: number;
    earnedXp: number;
    completed: boolean;
  }) => {
    console.log("[HiddenClueMission] Complete:", result);
    
    // TODO: Отправить результат на сервер
    
    haptic.success();
    setActiveMission(null);
  };
  
  const handleExit = () => {
    setActiveMission(null);
  };
  
  // ─── Если миссия активна — показываем её ───
  if (activeMission) {
    return (
      <MissionComponent
        mission={activeMission}
        onComplete={handleMissionComplete}
        onExit={handleExit}
      />
    );
  }
  
  // ─── Список миссий ───
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
            <span className="text-xs text-red-400 font-medium">NEW!</span>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
        </div>

        <div className="px-4 mt-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            🔍 Скрытые улики
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Улики появляются только когда ты их найдёшь!
          </p>
        </div>
      </div>
      
      {/* Warning banner */}
      <div className="px-4 mb-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-amber-400 text-sm font-medium mb-1">
                Новая механика!
              </p>
              <p className="text-white/60 text-xs leading-relaxed">
                Здесь улики НЕ показываются сразу. Исследуй переулки, 
                поворачивай камеру — и только тогда улики появятся.
              </p>
            </div>
          </div>
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
              transition={{ delay: index * 0.1 }}
              onClick={() => {
                haptic.heavy();
                setActiveMission(mission);
              }}
              className="relative w-full p-4 rounded-2xl text-left transition-all
                bg-gradient-to-br from-white/5 to-white/[0.02] 
                border border-white/10 hover:border-red-500/30
                hover:shadow-[0_0_30px_rgba(239,68,68,0.1)]"
            >
              {/* NEW badge */}
              <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-bold">
                NEW
              </div>
              
              <div className="flex gap-4">
                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ 
                    backgroundColor: `${mission.color}20`,
                    boxShadow: `0 0 20px ${mission.color}20`,
                  }}
                >
                  {mission.icon}
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
                  <div className="flex items-center gap-3 mt-2">
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
                      🔍 {mission.requiredClues}/{mission.clues.length} улик
                    </span>
                    {mission.timeLimit && (
                      <span className="text-xs text-white/40">
                        ⏱️ {Math.floor(mission.timeLimit / 60)}:{(mission.timeLimit % 60).toString().padStart(2, "0")}
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
        
        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl"
        >
          <h4 className="font-medium text-cyan-400 mb-3">💡 Как это работает?</h4>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-lg">1️⃣</span>
              <p className="text-sm text-white/60">
                <strong className="text-white/80">Исследуй панораму</strong> — ходи по стрелкам, сворачивай в переулки
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">2️⃣</span>
              <p className="text-sm text-white/60">
                <strong className="text-white/80">Смотри внимательно</strong> — поворачивай камеру во все стороны
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">3️⃣</span>
              <p className="text-sm text-white/60">
                <strong className="text-white/80">Обнаружь улику</strong> — удерживай взгляд ~1-2 секунды
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg">4️⃣</span>
              <p className="text-sm text-white/60">
                <strong className="text-white/80">Собери</strong> — нажми на появившийся маркер
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

