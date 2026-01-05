"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION PREVIEW PAGE
 * Страница для тестирования сгенерированных миссий перед публикацией
 * 
 * Миссия загружается из sessionStorage (установленной админ-панелью)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiddenClueMission } from "@/components/panorama/HiddenClueMission";
import type { HiddenClueMission as HiddenClueMissionType } from "@/types/hidden-clue";
import type { GeneratedMission } from "@/types/panorama-graph";

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Конвертировать GeneratedMission в HiddenClueMission
 */
function convertToHiddenClueMission(generated: GeneratedMission): HiddenClueMissionType {
  return {
    id: generated.id,
    title: generated.title,
    description: generated.description,
    briefing: generated.briefing,
    startCoordinates: generated.startCoordinates,
    startPanoId: generated.startPanoId,
    startHeading: generated.startHeading,
    allowNavigation: generated.allowNavigation,
    clues: generated.clues.map(clue => ({
      id: clue.id,
      panoId: clue.panoId,
      revealHeading: clue.revealHeading,
      coneDegrees: clue.coneDegrees,
      dwellTime: clue.dwellTime,
      name: clue.name,
      description: clue.description,
      icon: clue.icon,
      storyContext: clue.storyContext,
      xpReward: clue.xpReward,
      hintText: clue.hintText,
      scannerHint: clue.scannerHint,
    })),
    requiredClues: generated.requiredClues,
    timeLimit: generated.timeLimit,
    xpReward: generated.xpReward,
    speedBonusPerSecond: generated.speedBonusPerSecond,
    location: generated.location,
    difficulty: generated.difficulty,
    icon: generated.icon,
    color: generated.color,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PanoramaPreviewPage() {
  const router = useRouter();
  const [mission, setMission] = useState<HiddenClueMissionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // ─── Load mission from sessionStorage ───
  useEffect(() => {
    try {
      const storedMission = sessionStorage.getItem("previewMission");
      
      if (!storedMission) {
        setError("Миссия не найдена. Вернитесь в генератор и создайте новую миссию.");
        setLoading(false);
        return;
      }
      
      const parsed: GeneratedMission = JSON.parse(storedMission);
      const converted = convertToHiddenClueMission(parsed);
      
      setMission(converted);
      setLoading(false);
      
      // Очищаем sessionStorage после загрузки
      // (чтобы при обновлении страницы нужно было снова генерировать)
      // sessionStorage.removeItem("previewMission");
      
    } catch (e) {
      console.error("[Preview] Failed to load mission:", e);
      setError("Ошибка загрузки миссии. Попробуйте сгенерировать заново.");
      setLoading(false);
    }
  }, []);
  
  // ─── Handle mission complete ───
  const handleComplete = (result: {
    success: boolean;
    cluesFound: number;
    totalClues: number;
    timeSpent: number;
    xpEarned: number;
  }) => {
    console.log("[Preview] Mission completed:", result);
    
    // Показываем результат и возвращаем в генератор
    alert(
      `🎉 Миссия завершена!\n\n` +
      `Успех: ${result.success ? "Да" : "Нет"}\n` +
      `Улик найдено: ${result.cluesFound}/${result.totalClues}\n` +
      `Время: ${Math.floor(result.timeSpent / 60)}:${(result.timeSpent % 60).toString().padStart(2, "0")}\n` +
      `XP: ${result.xpEarned}`
    );
    
    window.close();
  };
  
  // ─── Handle exit ───
  const handleExit = () => {
    if (confirm("Выйти из тестирования миссии?")) {
      window.close();
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🗺️</div>
          <p className="text-white text-lg">Загрузка миссии...</p>
        </div>
      </div>
    );
  }
  
  // Error
  if (error || !mission) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-white text-xl font-bold mb-4">Ошибка</h1>
          <p className="text-slate-400 mb-6">{error || "Миссия не найдена"}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }
  
  // Preview banner
  return (
    <div className="relative">
      {/* Preview banner */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-black text-center py-2 px-4 text-sm font-medium">
        ⚠️ РЕЖИМ ПРЕВЬЮ — Эта миссия ещё не опубликована
      </div>
      
      {/* Mission */}
      <div className="pt-10">
        <HiddenClueMission
          mission={mission}
          onComplete={handleComplete}
          onExit={handleExit}
          disableAudio={true}
        />
      </div>
    </div>
  );
}

