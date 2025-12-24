"use client";

import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptic";
import { api } from "@/lib/api";

type Episode = {
  id: number;
  order: number;
  title: string;
  description: string | null;
  type: "STORY" | "QUIZ" | "EVIDENCE" | "INTERROGATION" | "DEDUCTION";
  minScore: number | null;
  timeLimit: number | null;
  xpReward: number;
  unlocksClue: string | null;
  isAvailable: boolean;
  progress: {
    status: string;
    score: number;
    completedAt: string | null;
  } | null;
};

type Suspect = {
  id: number;
  name: string;
  description: string;
  photoUrl: string | null;
};

type InvestigationData = {
  investigation: {
    id: number;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
    city: string;
    years: string;
    icon: string;
    color: string;
    coverImage: string | null;
    difficulty: string;
    xpReward: number;
  };
  episodes: Episode[];
  suspects: Suspect[];
  progress: {
    status: string;
    currentEpisode: number;
    totalScore: number;
    collectedClues: string[];
    suspectChoiceId: number | null;
    isCorrectChoice: boolean | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

const EPISODE_TYPE_ICONS: Record<string, string> = {
  STORY: "📖",
  QUIZ: "❓",
  EVIDENCE: "🔍",
  INTERROGATION: "🎙️",
  DEDUCTION: "🧠",
};

const EPISODE_TYPE_LABELS: Record<string, string> = {
  STORY: "История",
  QUIZ: "Вопросы",
  EVIDENCE: "Улики",
  INTERROGATION: "Допрос",
  DEDUCTION: "Дедукция",
};

export default function InvestigationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  
  const [data, setData] = useState<InvestigationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api.get<InvestigationData>(`/api/investigations/${slug}`);
        setData(result);
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить расследование");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  const handleStartEpisode = (episode: Episode) => {
    if (!episode.isAvailable) return;
    haptic.medium();
    setSelectedEpisode(episode);
  };

  const handlePlayEpisode = () => {
    if (!selectedEpisode || !data) return;
    haptic.heavy();
    // Navigate to episode player (implemented)
    router.push(`/miniapp/investigations/${slug}/episode/${selectedEpisode.order}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-red-500 mx-auto" />
          <p className="mt-4 text-sm text-white/50">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-white/70">{error || "Расследование не найдено"}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-white/70"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  const { investigation, episodes, progress } = data;
  const completedEpisodes = episodes.filter(e => e.progress?.status === "COMPLETED").length;
  const progressPercent = Math.round((completedEpisodes / episodes.length) * 100);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Header */}
      <div 
        className="relative h-48 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a12]"
        style={{
          backgroundImage: investigation.coverImage ? `url(${investigation.coverImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a12]/50 to-[#0a0a12]" />
        
        {/* Back button */}
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 text-white/80 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Назад</span>
        </button>

        {/* Title overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl border-2"
              style={{ 
                borderColor: investigation.color,
                backgroundColor: `${investigation.color}20`,
              }}
            >
              {investigation.icon}
            </div>
            <div>
              <h1 className="text-xl font-bold">{investigation.title}</h1>
              <p className="text-sm text-white/60">{investigation.city} • {investigation.years}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-4">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/50">Прогресс расследования</span>
          <span className="text-white/70">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full rounded-full"
            style={{ backgroundColor: investigation.color }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-white/40">
          <span>{completedEpisodes} из {episodes.length} эпизодов</span>
          <span>+{investigation.xpReward} XP</span>
        </div>
      </div>

      {/* Episodes list */}
      <div className="px-4 pb-8">
        <h2 className="text-lg font-semibold mb-4">Эпизоды</h2>
        
        <div className="space-y-3">
          {episodes.map((episode, index) => {
            const isCompleted = episode.progress?.status === "COMPLETED";
            const isCurrent = episode.isAvailable && !isCompleted;
            const isLocked = !episode.isAvailable;
            
            return (
              <motion.button
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleStartEpisode(episode)}
                disabled={isLocked}
                className={`w-full text-left rounded-xl p-4 transition-all
                  ${isCompleted 
                    ? 'bg-green-900/20 border border-green-500/30' 
                    : isCurrent 
                      ? 'bg-white/10 border border-white/20' 
                      : 'bg-white/5 border border-white/10 opacity-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  {/* Episode number / status */}
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                      ${isCompleted 
                        ? 'bg-green-500 text-white' 
                        : isCurrent 
                          ? 'bg-white/20 text-white' 
                          : 'bg-white/10 text-white/40'
                      }`}
                  >
                    {isCompleted ? "✓" : isLocked ? "🔒" : episode.order}
                  </div>
                  
                  {/* Episode info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{episode.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                        {EPISODE_TYPE_ICONS[episode.type]} {EPISODE_TYPE_LABELS[episode.type]}
                      </span>
                    </div>
                    {episode.description && (
                      <p className="text-xs text-white/50 mt-1 line-clamp-1">
                        {episode.description}
                      </p>
                    )}
                  </div>
                  
                  {/* XP reward */}
                  <div className="text-xs text-amber-500">
                    +{episode.xpReward} XP
                  </div>
                </div>
                
                {/* Score for completed episodes */}
                {isCompleted && episode.progress && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-white/50">Результат</span>
                    <span className="text-green-400">{episode.progress.score} очков</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Episode detail modal */}
      <AnimatePresence>
        {selectedEpisode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedEpisode(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-gradient-to-b from-[#1a1a2e] to-[#12121a] rounded-t-3xl p-6 pb-10"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                  {EPISODE_TYPE_ICONS[selectedEpisode.type]}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedEpisode.title}</h3>
                  <p className="text-sm text-white/50">
                    Эпизод {selectedEpisode.order} • {EPISODE_TYPE_LABELS[selectedEpisode.type]}
                  </p>
                </div>
              </div>

              {selectedEpisode.description && (
                <p className="text-white/70 text-sm mb-4">{selectedEpisode.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-white/50 mb-6">
                {selectedEpisode.timeLimit && (
                  <div className="flex items-center gap-1">
                    <span>⏱️</span>
                    <span>{Math.floor(selectedEpisode.timeLimit / 60)} мин</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span>⭐</span>
                  <span>+{selectedEpisode.xpReward} XP</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePlayEpisode}
                className="w-full py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-red-600 to-orange-600"
                style={{ boxShadow: `0 10px 40px ${investigation.color}40` }}
              >
                {selectedEpisode.progress?.status === "COMPLETED" 
                  ? "Пройти снова" 
                  : "Начать эпизод"
                }
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
