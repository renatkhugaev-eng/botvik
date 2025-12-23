"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptic";
import { InkStoryPlayer } from "@/components/InkStoryPlayer";
import type { InkState } from "@/lib/ink-runtime";

// Импортируем скомпилированную историю (после npm run ink:compile)
// Если файл не найден — используем fallback
let storyJson: object | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  storyJson = require("@/content/investigations/lesopolosa.ink.json");
} catch {
  storyJson = null;
}

export default function InkDemoPage() {
  const router = useRouter();
  const [isEnded, setIsEnded] = useState(false);
  const [finalState, setFinalState] = useState<InkState | null>(null);
  const [cluesFound, setCluesFound] = useState<string[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!storyJson) {
      setShowFallback(true);
    }
  }, []);

  const handleEnd = useCallback((state: InkState) => {
    setIsEnded(true);
    setFinalState(state);
    haptic.success();
  }, []);

  const handleVariableChange = useCallback((name: string, value: unknown) => {
    if (name === "score" && typeof value === "number") {
      setCurrentScore(value);
    }
  }, []);

  const handleTagFound = useCallback((tag: string, value: string | boolean) => {
    // Собираем улики
    if (tag === "clue" && typeof value === "string") {
      setCluesFound((prev) => {
        if (prev.includes(value)) return prev;
        haptic.light();
        return [...prev, value];
      });
    }
  }, []);

  // Fallback если история не скомпилирована
  if (showFallback) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-6">📖</div>
          <h1 className="text-2xl font-bold mb-4">История не скомпилирована</h1>
          <p className="text-white/60 mb-6">
            Для запуска Ink-истории нужно сначала скомпилировать .ink файл в JSON.
          </p>

          <div className="bg-white/5 rounded-xl p-4 text-left mb-6">
            <p className="text-sm text-white/40 mb-2">Выполните команду:</p>
            <code className="text-violet-400 text-sm">npm run ink:compile</code>
          </div>

          <p className="text-white/40 text-sm mb-6">
            Это скомпилирует файл <code className="text-violet-400">lesopolosa.ink</code> в JSON формат.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 transition-colors"
            >
              Назад
            </button>
            <button
              onClick={() => router.push("/miniapp/story-demo")}
              className="flex-1 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors font-medium"
            >
              Простой движок →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      {/* Хедер */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm">Выйти</span>
        </button>

        <div className="text-center">
          <div className="text-xs text-white/40">Ink Engine</div>
          <div className="text-sm font-bold">Дело Лесополоса</div>
        </div>

        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Панель улик */}
      <AnimatePresence>
        {cluesFound.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20"
          >
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <span className="text-emerald-400 text-xs font-medium whitespace-nowrap flex items-center gap-1">
                🔍 Улики ({cluesFound.length}):
              </span>
              {cluesFound.map((clue) => (
                <motion.span
                  key={clue}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs whitespace-nowrap"
                >
                  {formatClueName(clue)}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* История */}
      <div className="flex-1 overflow-hidden">
        {storyJson && (
          <InkStoryPlayer
            storyJson={storyJson}
            onEnd={handleEnd}
            onVariableChange={handleVariableChange}
            onTagFound={handleTagFound}
          />
        )}
      </div>

      {/* Финальный экран */}
      <AnimatePresence>
        {isEnded && finalState && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 z-20"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-[#1a1a2e] rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="text-center mb-6">
                <div className="text-6xl mb-3">
                  {currentScore >= 100 ? "🏆" : currentScore >= 50 ? "✅" : currentScore >= 0 ? "📋" : "💀"}
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {currentScore >= 100
                    ? "Превосходно!"
                    : currentScore >= 50
                    ? "Хорошая работа"
                    : currentScore >= 0
                    ? "Эпизод завершён"
                    : "Трагический исход"}
                </h2>
                <p className="text-white/50 text-sm">
                  {currentScore >= 50
                    ? "Вы проявили профессионализм и сохранили объективность"
                    : currentScore >= 0
                    ? "Дело продолжается..."
                    : "Ваш выбор привёл к необратимым последствиям"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <div className={`text-2xl font-bold ${currentScore >= 0 ? "text-violet-400" : "text-red-400"}`}>
                    {currentScore}
                  </div>
                  <div className="text-xs text-white/40">Очков</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <div className="text-2xl font-bold text-emerald-400">{cluesFound.length}</div>
                  <div className="text-xs text-white/40">Улик</div>
                </div>
              </div>

              {cluesFound.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-white/40 mb-2">Собранные улики:</p>
                  <div className="flex flex-wrap gap-1">
                    {cluesFound.map((clue) => (
                      <span
                        key={clue}
                        className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs"
                      >
                        {formatClueName(clue)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    haptic.medium();
                    window.location.reload();
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors font-medium"
                >
                  Заново
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    haptic.medium();
                    router.push("/miniapp");
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-medium"
                >
                  В меню
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ФОРМАТИРОВАНИЕ НАЗВАНИЙ УЛИК
// ══════════════════════════════════════════════════════════════════════════════

function formatClueName(clueId: string): string {
  const names: Record<string, string> = {
    railway_link: "Связь с ж/д",
    blood_paradox: "Парадокс крови",
    witness_desc: "Описание свидетеля",
    organized_killer: "Организованный убийца",
    alibi_kravchenko: "Алиби Кравченко",
    suspect_spotted: "Подозреваемый замечен",
    forensic_anomaly: "Аномалия экспертизы",
    victim_pattern: "Паттерн жертв",
    psycho_profile: "Психопрофиль",
  };
  return names[clueId] || clueId.replace(/_/g, " ");
}
