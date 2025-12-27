"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USE AUDIO HINTS HOOK
 * React хук для управления аудио-подсказками в детективных миссиях
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getAudioHints, AudioHintSystem } from "./audio-hints";
import type { AudioConfig, IntensityLevel, SoundType } from "@/types/audio-hints";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UseAudioHintsProps {
  /** Включены ли звуки */
  enabled?: boolean;
  
  /** Кастомная конфигурация */
  config?: Partial<AudioConfig>;
  
  /** Автоинициализация при монтировании */
  autoInit?: boolean;
}

interface UseAudioHintsResult {
  /** Инициализирован ли AudioContext */
  isReady: boolean;
  
  /** Поддерживается ли Web Audio API */
  isSupported: boolean;
  
  /** Включены ли звуки */
  isEnabled: boolean;
  
  /** Текущая интенсивность */
  intensity: IntensityLevel;
  
  /** Инициализация (требует user gesture) */
  init: () => Promise<boolean>;
  
  /** Включить/выключить звуки */
  setEnabled: (enabled: boolean) => void;
  
  /** Установить интенсивность (управляет heartbeat/static) */
  setIntensity: (level: IntensityLevel) => void;
  
  /** Обновить прогресс обнаружения (0-1) */
  updateRevealProgress: (progress: number) => void;
  
  /** Отмена обнаружения */
  cancelReveal: () => void;
  
  /** Воспроизвести разовый звук */
  playSound: (type: SoundType) => void;
  
  /** Остановить все звуки */
  stopAll: () => void;
  
  /** Обновить конфигурацию */
  updateConfig: (config: Partial<AudioConfig>) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useAudioHints({
  enabled = true,
  config,
  autoInit = false,
}: UseAudioHintsProps = {}): UseAudioHintsResult {
  
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabledState] = useState(enabled);
  const [intensity, setIntensityState] = useState<IntensityLevel>("cold");
  
  const audioRef = useRef<AudioHintSystem | null>(null);
  const isSupported = typeof window !== "undefined" && AudioHintSystem.isSupported();
  
  // ─── Get audio instance ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    audioRef.current = getAudioHints();
    
    if (config) {
      audioRef.current.updateConfig(config);
    }
    
    return () => {
      // Don't destroy singleton, just stop sounds
      audioRef.current?.stopAll();
    };
  }, []);
  
  // ─── Update config when props change ───
  useEffect(() => {
    if (config && audioRef.current) {
      audioRef.current.updateConfig(config);
    }
  }, [config]);
  
  // ─── Sync enabled state ───
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setEnabled(enabled);
      setIsEnabledState(enabled);
    }
  }, [enabled]);
  
  // ─── Auto init ───
  useEffect(() => {
    if (autoInit && isSupported && !isReady) {
      // Auto-init on first user interaction
      const handleInteraction = async () => {
        if (audioRef.current) {
          const success = await audioRef.current.init();
          setIsReady(success);
        }
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("touchstart", handleInteraction);
      };
      
      document.addEventListener("click", handleInteraction, { once: true });
      document.addEventListener("touchstart", handleInteraction, { once: true });
      
      return () => {
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("touchstart", handleInteraction);
      };
    }
  }, [autoInit, isSupported, isReady]);
  
  // ─── Init ───
  const init = useCallback(async (): Promise<boolean> => {
    if (!audioRef.current) return false;
    
    const success = await audioRef.current.init();
    setIsReady(success);
    return success;
  }, []);
  
  // ─── Set enabled ───
  const setEnabled = useCallback((value: boolean) => {
    if (audioRef.current) {
      audioRef.current.setEnabled(value);
      setIsEnabledState(value);
    }
  }, []);
  
  // ─── Set intensity ───
  const setIntensity = useCallback((level: IntensityLevel) => {
    if (audioRef.current && isReady) {
      audioRef.current.setIntensity(level);
      setIntensityState(level);
    }
  }, [isReady]);
  
  // ─── Update reveal progress ───
  const updateRevealProgress = useCallback((progress: number) => {
    if (audioRef.current && isReady) {
      audioRef.current.updateRevealProgress(progress);
    }
  }, [isReady]);
  
  // ─── Cancel reveal ───
  const cancelReveal = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.cancelReveal();
    }
  }, []);
  
  // ─── Play sound ───
  const playSound = useCallback((type: SoundType) => {
    if (!audioRef.current || !isReady) return;
    
    switch (type) {
      case "discovery":
        audioRef.current.playDiscovery();
        break;
      case "collect":
        audioRef.current.playCollect();
        break;
      case "scanner":
        audioRef.current.playScanner();
        break;
      case "hint":
        audioRef.current.playHint();
        break;
      case "tension":
        audioRef.current.playTension();
        break;
      case "whisper":
        audioRef.current.playWhisper();
        break;
      case "heartbeat":
        audioRef.current.startHeartbeat();
        break;
      case "static":
        audioRef.current.startStatic();
        break;
      case "ambient":
        // Ambient handled via intensity system
        break;
    }
  }, [isReady]);
  
  // ─── Stop all ───
  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.stopAll();
    }
  }, []);
  
  // ─── Update config ───
  const updateConfig = useCallback((newConfig: Partial<AudioConfig>) => {
    if (audioRef.current) {
      audioRef.current.updateConfig(newConfig);
    }
  }, []);
  
  return {
    isReady,
    isSupported,
    isEnabled,
    intensity,
    init,
    setEnabled,
    setIntensity,
    updateRevealProgress,
    cancelReveal,
    playSound,
    stopAll,
    updateConfig,
  };
}

export default useAudioHints;

