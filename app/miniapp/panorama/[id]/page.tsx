"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION PLAY PAGE
 * Страница прохождения панорамной миссии (поддержка обоих типов)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PanoramaMission, HiddenClueMission } from "@/components/panorama";
import { getMissionById, getHiddenClueMissionById } from "@/lib/panorama-missions";
import type { PanoramaMission as MissionType, PanoramaMissionProgress } from "@/types/panorama";
import type { HiddenClueMission as HiddenMissionType } from "@/types/hidden-clue";
import { haptic } from "@/lib/haptic";

export default function PanoramaMissionPage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params.id as string;
  
  const [mission, setMission] = useState<MissionType | null>(null);
  const [hiddenMission, setHiddenMission] = useState<HiddenMissionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Загрузка миссии — проверяем оба типа
  useEffect(() => {
    const loadMission = async () => {
      try {
        // Сначала ищем в обычных миссиях
        const foundMission = getMissionById(missionId);
        if (foundMission) {
          setMission(foundMission);
          setHiddenMission(null);
          return;
        }
        
        // Потом ищем в миссиях со скрытыми уликами
        const foundHiddenMission = getHiddenClueMissionById(missionId);
        if (foundHiddenMission) {
          setHiddenMission(foundHiddenMission);
          setMission(null);
          return;
        }
        
        // Ничего не нашли
        setError("Миссия не найдена");
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
  const handleComplete = async (result: PanoramaMissionProgress) => {
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
  if (error || (!mission && !hiddenMission)) {
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
  
  // Hidden Clue Mission (новая система)
  if (hiddenMission) {
    return (
      <HiddenClueMission
        mission={hiddenMission}
        onComplete={() => {
          haptic.success();
          router.push("/miniapp/panorama");
        }}
        onExit={handleExit}
      />
    );
  }
  
  // Regular Mission (старая система)
  if (mission) {
    return (
      <PanoramaMission
        mission={mission}
        onComplete={handleComplete}
        onExit={handleExit}
      />
    );
  }
  
  return null;
}
