"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptic";
import { StoryPlayer } from "@/components/StoryPlayer";
import { lesopolosaStory } from "@/content/investigations/lesopolosa-story";
import type { StoryOutput } from "@/lib/story-engine";

export default function StoryDemoPage() {
  const router = useRouter();
  const [isEnded, setIsEnded] = useState(false);
  const [finalOutput, setFinalOutput] = useState<StoryOutput | null>(null);
  const [cluesFound, setCluesFound] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  const handleEnd = useCallback((output: StoryOutput) => {
    setIsEnded(true);
    setFinalOutput(output);
    haptic.success();
  }, []);

  const handleClueFound = useCallback((clueId: string) => {
    setCluesFound((prev) => {
      if (prev.includes(clueId)) return prev;
      return [...prev, clueId];
    });
  }, []);

  const handleScoreChange = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      {/* Хедер */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex items-center gap-2 text-white/60 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm">Назад</span>
        </button>

        <div className="text-center">
          <div className="text-xs text-white/40">Simple Engine</div>
          <div className="text-sm font-bold">Дело Лесополоса</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Счёт */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            score >= 0 
              ? "bg-violet-500/20 text-violet-300" 
              : "bg-red-500/20 text-red-300"
          }`}>
            {score > 0 ? `+${score}` : score} очков
          </div>
        </div>
      </div>

      {/* Улики найдены */}
      {cluesFound.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20"
        >
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-emerald-400 text-xs font-medium whitespace-nowrap">
              🔍 Улики:
            </span>
            {cluesFound.map((clue) => (
              <span
                key={clue}
                className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs whitespace-nowrap"
              >
                {formatClueName(clue)}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* История */}
      <div className="flex-1 overflow-hidden">
        <StoryPlayer
          story={lesopolosaStory}
          onEnd={handleEnd}
          onClueFound={handleClueFound}
          onScoreChange={handleScoreChange}
        />
      </div>

      {/* Экран завершения */}
      {isEnded && finalOutput && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 border-t border-white/10 bg-gradient-to-t from-[#1a1a2e] to-transparent"
        >
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">
              {score >= 50 ? "🏆" : score >= 0 ? "📝" : "💀"}
            </div>
            <h2 className="text-xl font-bold">
              {score >= 50 ? "Отличная работа!" : score >= 0 ? "Эпизод завершён" : "Трагический исход"}
            </h2>
            <p className="text-white/50 text-sm mt-1">
              {score >= 50
                ? "Вы сохранили объективность и нашли важные улики"
                : score >= 0
                ? "История завершена"
                : "Невиновный человек пострадал из-за ваших решений"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-3 rounded-xl bg-white/5">
              <div className={`text-2xl font-bold ${score >= 0 ? "text-violet-400" : "text-red-400"}`}>
                {score}
              </div>
              <div className="text-xs text-white/50">Очков</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/5">
              <div className="text-2xl font-bold text-emerald-400">{cluesFound.length}</div>
              <div className="text-xs text-white/50">Улик найдено</div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              haptic.medium();
              router.push("/miniapp");
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold"
          >
            Вернуться в меню
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

// Форматирование названия улики
function formatClueName(clueId: string): string {
  const names: Record<string, string> = {
    organized_killer: "Организованный убийца",
    blood_type_ab: "Группа крови AB",
    railway_connection: "Связь с ж/д",
    alibi_confirmed: "Алиби подтверждено",
    suspect_spotted: "Подозреваемый замечен",
    paradoxical_secretion: "Парадокс крови",
    witness_description: "Описание свидетеля",
  };
  return names[clueId] || clueId;
}
