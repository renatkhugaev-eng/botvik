"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION PLAY PAGE
 * Все миссии используют систему скрытых улик
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { HiddenClueMission } from "@/components/panorama";
import { getMissionById } from "@/lib/panorama-missions";
import type { HiddenClueMission as MissionType } from "@/types/hidden-clue";
import { haptic } from "@/lib/haptic";
import { fetchWithAuth } from "@/lib/api";

export default function PanoramaMissionPage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params.id as string;
  
  const [mission, setMission] = useState<MissionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Загрузка миссии
  useEffect(() => {
    const loadMission = async () => {
      try {
        const foundMission = getMissionById(missionId);
        
        if (!foundMission) {
          setError("Миссия не найдена");
          return;
        }
        
        setMission(foundMission);
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
    try {
      // Вызываем API для начисления XP
      const response = await fetchWithAuth(`/api/panorama/${missionId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          cluesFound: result.cluesCollected,
          cluesTotal: result.cluesTotal,
          timeSpent: result.timeSpent,
          status: result.completed ? "completed" : "failed",
          // Новый формат для Hidden Clue системы
          cluesProgress: Array.from({ length: result.cluesCollected }, (_, i) => ({
            clueId: `clue_${i}`,
            isCorrect: true,
          })),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("[Panorama] Mission completed:", data);
        
        if (data.levelUp) {
          haptic.success();
          // TODO: показать анимацию level up
        }
      } else {
        console.error("[Panorama] Failed to save progress:", await response.text());
      }
    } catch (error) {
      console.error("[Panorama] Error saving progress:", error);
    }
    
    haptic.success();
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
  
  return (
    <HiddenClueMission
      mission={mission}
      onComplete={handleComplete}
      onExit={handleExit}
    />
  );
}
