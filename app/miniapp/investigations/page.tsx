"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptic";
import { api } from "@/lib/api";

type Investigation = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  city: string;
  years: string;
  coordinates: { x: number; y: number };
  icon: string;
  color: string;
  coverImage: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXTREME";
  xpReward: number;
  unlockType: string;
  unlockValue: number | null;
  isFeatured: boolean;
  episodesCount: number;
  isUnlocked: boolean;
  unlockReason: string | null;
  progress: {
    status: string;
    currentEpisode: number;
    totalScore: number;
    completedAt: string | null;
    isCorrectChoice: boolean | null;
  } | null;
};

type Stats = {
  total: number;
  unlocked: number;
  completed: number;
  inProgress: number;
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  EASY: { label: "Лёгкое", color: "#22c55e" },
  MEDIUM: { label: "Среднее", color: "#f59e0b" },
  HARD: { label: "Сложное", color: "#ef4444" },
  EXTREME: { label: "Экстрим", color: "#7c3aed" },
};

export default function InvestigationsPage() {
  const router = useRouter();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
  const [starting, setStarting] = useState(false);

  // Загрузка данных
  useEffect(() => {
    async function fetchInvestigations() {
      try {
        const data = await api.get<{ investigations: Investigation[]; stats: Stats }>("/api/investigations");
        setInvestigations(data.investigations);
        setStats(data.stats);
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить расследования");
      } finally {
        setLoading(false);
      }
    }
    fetchInvestigations();
  }, []);

  const handlePinClick = (inv: Investigation) => {
    haptic.medium();
    setSelectedCase(inv);
  };

  const handleStartInvestigation = async () => {
    if (!selectedCase || !selectedCase.isUnlocked) return;
    
    setStarting(true);
    haptic.heavy();
    
    try {
      const data = await api.post(`/api/investigations/${selectedCase.slug}/start`);
      console.log("Started investigation:", data);
      
      // Переходим на страницу расследования
      router.push(`/miniapp/investigations/${selectedCase.slug}`);
    } catch (err) {
      console.error(err);
      alert("Не удалось начать расследование");
    } finally {
      setStarting(false);
    }
  };

  const handleContinueInvestigation = () => {
    if (!selectedCase) return;
    haptic.medium();
    router.push(`/miniapp/investigations/${selectedCase.slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-red-500 mx-auto" />
          <p className="mt-4 text-sm text-white/50">Загрузка расследований...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-white/70">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-white/70"
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
            <span className="text-xs text-white/40">BETA</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>

        <div className="px-4 mt-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            🗺️ Карта Преступлений
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Выбери локацию и начни расследование
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative mx-4 mt-2 rounded-2xl overflow-hidden border border-white/10 bg-[#12121a]">
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a]">
          {/* Grid overlay */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />

          {/* Stylized map paths */}
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M20,25 Q35,20 50,25 T80,30 Q90,35 85,45 T75,60 Q65,70 50,65 T25,55 Q15,45 20,25"
              fill="none"
              stroke="url(#mapGradient)"
              strokeWidth="0.5"
            />
            <path
              d="M35,40 Q45,38 50,45 T45,55 Q38,58 35,50 T35,40"
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.3"
            />
            <defs>
              <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Crime Location Pins */}
          {investigations.map((inv) => {
            const coords = inv.coordinates as { x: number; y: number };
            return (
              <motion.button
                key={inv.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: Math.random() * 0.3, type: "spring" }}
                onClick={() => handlePinClick(inv)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`,
                }}
              >
                {/* Pulse ring for unlocked */}
                {inv.isUnlocked && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: inv.color }}
                    animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                
                {/* Pin */}
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center text-lg
                    ${inv.isUnlocked 
                      ? 'bg-gradient-to-br from-white/20 to-white/5 border-2 shadow-lg' 
                      : 'bg-white/5 border border-white/20 opacity-50'
                    }`}
                  style={{ 
                    borderColor: inv.isUnlocked ? inv.color : undefined,
                    boxShadow: inv.isUnlocked ? `0 0 20px ${inv.color}40` : undefined,
                  }}
                >
                  {inv.isUnlocked ? inv.icon : "🔒"}
                </div>

                {/* Progress indicator */}
                {inv.progress && inv.progress.status === "IN_PROGRESS" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-black">
                      {inv.progress.currentEpisode}
                    </span>
                  </div>
                )}

                {/* Completed badge */}
                {inv.progress?.status === "COMPLETED" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-[10px]">✓</span>
                  </div>
                )}

                {/* City label */}
                <div className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap
                  text-[10px] font-medium px-2 py-0.5 rounded-full
                  ${inv.isUnlocked ? 'bg-white/10 text-white/80' : 'bg-white/5 text-white/40'}`}>
                  {inv.city}
                </div>
              </motion.button>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm rounded-lg p-2 text-[10px]">
            <div className="flex items-center gap-1 text-white/60">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Доступно</span>
            </div>
            <div className="flex items-center gap-1 text-white/40 mt-1">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span>Скоро</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex justify-center gap-6 mt-6 px-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.unlocked}</div>
            <div className="text-xs text-white/50">Доступно</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-white/40">
              {stats.total - stats.unlocked}
            </div>
            <div className="text-xs text-white/50">Скоро</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.completed}</div>
            <div className="text-xs text-white/50">Раскрыто</div>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      <AnimatePresence>
        {selectedCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedCase(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-gradient-to-b from-[#1a1a2e] to-[#12121a] rounded-t-3xl p-6 pb-10"
            >
              {/* Handle */}
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

              {/* Case Header */}
              <div className="flex items-start gap-4">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2"
                  style={{ 
                    borderColor: selectedCase.color,
                    backgroundColor: `${selectedCase.color}20`,
                    boxShadow: `0 0 30px ${selectedCase.color}30`,
                  }}
                >
                  {selectedCase.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{selectedCase.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-white/60">{selectedCase.city}</span>
                    <span className="text-white/30">•</span>
                    <span className="text-sm text-white/60">{selectedCase.years}</span>
                  </div>
                </div>
              </div>

              {/* Subtitle */}
              {selectedCase.subtitle && (
                <p className="text-white/50 text-sm mt-2 italic">{selectedCase.subtitle}</p>
              )}

              {/* Description */}
              <p className="text-white/70 text-sm mt-4 leading-relaxed line-clamp-4">
                {selectedCase.description}
              </p>

              {/* Meta info */}
              <div className="flex items-center gap-4 mt-4">
                <div 
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${DIFFICULTY_LABELS[selectedCase.difficulty].color}20`,
                    color: DIFFICULTY_LABELS[selectedCase.difficulty].color,
                  }}
                >
                  {DIFFICULTY_LABELS[selectedCase.difficulty].label}
                </div>
                <div className="flex items-center gap-1 text-white/50 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>{selectedCase.episodesCount} эпизодов</span>
                </div>
                <div className="flex items-center gap-1 text-amber-500 text-sm">
                  <span>+{selectedCase.xpReward} XP</span>
                </div>
              </div>

              {/* Progress */}
              {selectedCase.progress && selectedCase.isUnlocked && (
                <div className="mt-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-white/50">Прогресс расследования</span>
                    <span className="text-white/70">
                      {selectedCase.progress.status === "COMPLETED" 
                        ? "100%" 
                        : `${Math.round((selectedCase.progress.currentEpisode - 1) / selectedCase.episodesCount * 100)}%`
                      }
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: selectedCase.progress.status === "COMPLETED"
                          ? '100%' 
                          : `${(selectedCase.progress.currentEpisode - 1) / selectedCase.episodesCount * 100}%`,
                        backgroundColor: selectedCase.color,
                      }}
                    />
                  </div>
                  {selectedCase.progress.status === "IN_PROGRESS" && (
                    <p className="text-xs text-white/40 mt-2">
                      Эпизод {selectedCase.progress.currentEpisode} из {selectedCase.episodesCount}
                    </p>
                  )}
                </div>
              )}

              {/* Action Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={
                  selectedCase.progress?.status === "IN_PROGRESS" 
                    ? handleContinueInvestigation 
                    : handleStartInvestigation
                }
                disabled={!selectedCase.isUnlocked || starting}
                className={`w-full mt-6 py-4 rounded-2xl font-semibold text-white
                  ${selectedCase.isUnlocked 
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 shadow-lg' 
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
                style={selectedCase.isUnlocked ? { boxShadow: `0 10px 40px ${selectedCase.color}40` } : undefined}
              >
                {starting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Загрузка...
                  </span>
                ) : selectedCase.progress?.status === "COMPLETED" ? (
                  <span className="flex items-center justify-center gap-2">
                    ✅ Раскрыто
                  </span>
                ) : selectedCase.progress?.status === "IN_PROGRESS" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Продолжить
                  </span>
                ) : selectedCase.isUnlocked ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Начать расследование
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {selectedCase.unlockReason || "Скоро откроется"}
                  </span>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom padding */}
      <div className="h-24" />
    </div>
  );
}
