"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION PLAY PAGE
 * Страница прохождения панорамной миссии с системой скрытых улик
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { HiddenClueMission } from "@/components/panorama";
import { getMissionById } from "@/lib/panorama-missions";
import { convertToHiddenClueMission } from "@/lib/convert-to-hidden-clue";
import type { HiddenClueMission as HiddenMissionType } from "@/types/hidden-clue";
import { haptic } from "@/lib/haptic";

export default function PanoramaMissionPage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params.id as string;
  
  const [mission, setMission] = useState<HiddenMissionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Загрузка миссии
  useEffect(() => {
    const loadMission = async () => {
      try {
        // Загружаем старый формат миссии
        const foundMission = getMissionById(missionId);
        
        if (!foundMission) {
          setError("Миссия не найдена");
          return;
        }
        
        // Конвертируем в новый формат со скрытыми уликами
        const hiddenMission = convertToHiddenClueMission(foundMission);
        setMission(hiddenMission);
      } catch (err) {
        console.error("Failed to load mission:", err);
        setError("Не удалось загрузить миссию");
      } finally {
        setLoading(false);
      }
    };
    
    loadMission();
  }, [missionId]);
  
  // Обработчик завершения миссии
  const handleComplete = async (result: {
    missionId: string;
    cluesCollected: number;
    cluesTotal: number;
    timeSpent: number;
    earnedXp: number;
    completed: boolean;
  }) => {
    console.log("Mission completed:", result);
    
    // TODO: Отправить результат на сервер
    // await api.post(`/api/panorama/${missionId}/complete`, result);
    
    haptic.success();
    
    // Возвращаемся к списку миссий
    router.push("/miniapp/panorama");
  };
  
  // Обработчик выхода
  const handleExit = () => {
    haptic.light();
    router.back();
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-cyan-500 mx-auto" />
          <p className="mt-4 text-sm text-white/50">Загрузка миссии...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !mission) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-white/70 mb-4">{error || "Миссия не найдена"}</p>
          <button
            onClick={() => router.push("/miniapp/panorama")}
            className="px-6 py-2 bg-white/10 rounded-xl text-white/70 hover:bg-white/20 transition-colors"
          >
            К списку миссий
          </button>
        </div>
      </div>
    );
  }
  
  // Mission component with hidden clues
  return (
    <HiddenClueMission
      mission={mission}
      onComplete={handleComplete}
      onExit={handleExit}
    />
  );
}
