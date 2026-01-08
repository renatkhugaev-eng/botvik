"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * YANDEX PANORAMA PLAYER COMPONENT
 * Компонент для отображения панорам Яндекс.Карт
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { GeoCoordinates, CameraDirection, YandexPanoramaPlayer } from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface YandexPanoramaProps {
  /** Координаты панорамы [широта, долгота] */
  coordinates: GeoCoordinates;
  
  /** Начальное направление камеры [yaw, pitch] */
  direction?: CameraDirection;
  
  /** CSS классы контейнера */
  className?: string;
  
  /** Разрешить навигацию (стрелки перехода) */
  allowNavigation?: boolean;
  
  /** Callback когда панорама загружена */
  onReady?: (player: YandexPanoramaPlayer) => void;
  
  /** Callback при ошибке загрузки */
  onError?: (error: Error) => void;
  
  /** Callback при клике на панораму */
  onClick?: (direction: CameraDirection) => void;
  
  /** Callback при изменении направления камеры */
  onDirectionChange?: (direction: CameraDirection) => void;
  
  /** Callback при смене панорамы (навигация) */
  onPanoramaChange?: (coordinates: GeoCoordinates) => void;
}

export interface YandexPanoramaRef {
  /** Получить текущее направление камеры */
  getDirection: () => CameraDirection | null;
  
  /** Установить направление камеры */
  setDirection: (direction: CameraDirection) => void;
  
  /** Получить плеер */
  getPlayer: () => YandexPanoramaPlayer | null;
  
  /** Перейти к координатам */
  moveTo: (coordinates: GeoCoordinates) => Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════
// YANDEX API TYPES (internal)
// ═══════════════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
interface YmapsAPI {
  ready: (callback: () => void) => void;
  panorama: {
    isSupported: () => boolean;
    locate: (coords: number[]) => Promise<any[]>;
    Player: new (container: HTMLElement, panorama: any, options?: any) => any;
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    ymaps?: YmapsAPI;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT LOADER
// ═══════════════════════════════════════════════════════════════════════════

let ymapsLoadPromise: Promise<YmapsAPI> | null = null;

function loadYandexMapsAPI(): Promise<YmapsAPI> {
  if (ymapsLoadPromise) return ymapsLoadPromise;
  
  ymapsLoadPromise = new Promise((resolve, reject) => {
    // Уже загружен
    if (window.ymaps) {
      console.log("[YandexPanorama] ymaps already loaded");
      window.ymaps.ready(() => resolve(window.ymaps!));
      return;
    }
    
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY;
    console.log("[YandexPanorama] API Key present:", !!apiKey, apiKey?.substring(0, 8));
    
    // Яндекс разрешает ограниченное использование без ключа
    const scriptUrl = apiKey 
      ? `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
      : `https://api-maps.yandex.ru/2.1/?lang=ru_RU`;
    console.log("[YandexPanorama] Loading script:", scriptUrl.substring(0, 60) + "...");
    
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    
    script.onload = () => {
      console.log("[YandexPanorama] Script loaded, ymaps:", !!window.ymaps);
      if (window.ymaps) {
        window.ymaps.ready(() => {
          console.log("[YandexPanorama] ymaps ready!");
          resolve(window.ymaps!);
        });
      } else {
        reject(new Error("Yandex Maps API failed to initialize"));
      }
    };
    
    script.onerror = (e) => {
      console.error("[YandexPanorama] Script load error:", e);
      ymapsLoadPromise = null;
      reject(new Error("Failed to load Yandex Maps script"));
    };
    
    document.head.appendChild(script);
  });
  
  return ymapsLoadPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const YandexPanorama = forwardRef<YandexPanoramaRef, YandexPanoramaProps>(
  function YandexPanorama(
    {
      coordinates,
      direction,
      className = "",
      allowNavigation = true,
      onReady,
      onError,
      onClick,
      onDirectionChange,
      onPanoramaChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YandexPanoramaPlayer | null>(null);
    const ymapsRef = useRef<YmapsAPI | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notAvailable, setNotAvailable] = useState(false);
    
    // ─── Expose methods via ref ───
    useImperativeHandle(ref, () => ({
      getDirection: () => {
        if (!playerRef.current) return null;
        return playerRef.current.getDirection();
      },
      
      setDirection: (dir: CameraDirection) => {
        if (playerRef.current) {
          playerRef.current.setDirection(dir);
        }
      },
      
      getPlayer: () => playerRef.current,
      
      moveTo: async (coords: GeoCoordinates): Promise<boolean> => {
        if (!ymapsRef.current || !playerRef.current) return false;
        
        try {
          const panoramas = await ymapsRef.current.panorama.locate(coords);
          if (panoramas.length > 0) {
            playerRef.current.setPanorama(panoramas[0]);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }));
    
    // ─── Direction change tracking ───
    const handleDirectionChange = useCallback(() => {
      if (playerRef.current && onDirectionChange) {
        const dir = playerRef.current.getDirection();
        onDirectionChange(dir);
      }
    }, [onDirectionChange]);
    
    // ─── Click handler ───
    const handleContainerClick = useCallback((e: React.MouseEvent) => {
      if (!playerRef.current || !onClick) return;
      
      // Получаем текущее направление камеры как приближение
      const dir = playerRef.current.getDirection();
      onClick(dir);
    }, [onClick]);
    
    // ─── Initialize panorama ───
    useEffect(() => {
      let mounted = true;
      let player: YandexPanoramaPlayer | null = null;
      
      async function init() {
        if (!containerRef.current) {
          console.log("[YandexPanorama] No container ref");
          return;
        }
        
        try {
          setLoading(true);
          setError(null);
          setNotAvailable(false);
          
          console.log("[YandexPanorama] Loading API...");
          const ymaps = await loadYandexMapsAPI();
          console.log("[YandexPanorama] API loaded, checking support...");
          ymapsRef.current = ymaps;
          
          if (!mounted) return;
          
          // Проверяем поддержку панорам
          const isSupported = ymaps.panorama.isSupported();
          console.log("[YandexPanorama] Panorama supported:", isSupported);
          
          if (!isSupported) {
            setError("Ваш браузер не поддерживает панорамы");
            setLoading(false);
            return;
          }
          
          // Ищем панораму по координатам
          console.log("[YandexPanorama] Locating panorama at:", coordinates);
          const panoramas = await ymaps.panorama.locate(coordinates);
          console.log("[YandexPanorama] Found panoramas:", panoramas.length);
          
          if (!mounted) return;
          
          if (panoramas.length === 0) {
            setNotAvailable(true);
            setLoading(false);
            return;
          }
          
          // Создаём плеер
          console.log("[YandexPanorama] Creating player...");
          player = new ymaps.panorama.Player(
            containerRef.current!,
            panoramas[0],
            {
              direction: direction || [0, 0],
              controls: allowNavigation ? ["zoomControl"] : [],
              suppressMapOpenBlock: true,
            }
          ) as YandexPanoramaPlayer;
          
          playerRef.current = player;
          console.log("[YandexPanorama] Player created!");
          
          // Подписываемся на события
          if (onDirectionChange) {
            player.events.add("directionchange", handleDirectionChange);
          }
          
          if (onPanoramaChange) {
            player.events.add("panoramachange", () => {
              // Note: Yandex Panorama API limitation - coordinates are not
              // directly accessible from the panoramachange event.
              // The player position can be retrieved via player.getPanorama()
              // but coordinate extraction requires additional API calls.
              onPanoramaChange();
            });
          }
          
          setLoading(false);
          console.log("[YandexPanorama] Ready!");
          onReady?.(player);
          
        } catch (err) {
          if (!mounted) return;
          
          const error = err instanceof Error ? err : new Error("Unknown error");
          setError(error.message);
          setLoading(false);
          onError?.(error);
        }
      }
      
      init();
      
      return () => {
        mounted = false;
        if (player) {
          try {
            if (onDirectionChange) {
              player.events.remove("directionchange", handleDirectionChange);
            }
            player.destroy();
          } catch {
            // Ignore cleanup errors
          }
        }
        playerRef.current = null;
      };
    }, [coordinates[0], coordinates[1], allowNavigation]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // ─── Update direction when prop changes ───
    useEffect(() => {
      if (playerRef.current && direction) {
        playerRef.current.setDirection(direction);
      }
    }, [direction]);
    
    // ─── Render ───
    return (
      <div 
        className={`relative bg-[#0a0a12] ${className}`}
        onClick={handleContainerClick}
      >
        {/* Panorama container */}
        <div 
          ref={containerRef} 
          className="absolute inset-0"
          style={{ 
            visibility: loading || error || notAvailable ? "hidden" : "visible" 
          }}
        />
        
        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12]">
            <div className="text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-cyan-500 mx-auto" />
              <p className="mt-4 text-sm text-white/50">Загрузка панорамы...</p>
            </div>
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12] px-4">
            <div className="text-center">
              <div className="text-4xl mb-4">😔</div>
              <p className="text-white/70 text-sm">{error}</p>
            </div>
          </div>
        )}
        
        {/* No panorama available */}
        {notAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12] px-4">
            <div className="text-center">
              <div className="text-4xl mb-4">📍</div>
              <p className="text-white/70 text-sm">Панорама недоступна для этой локации</p>
              <p className="text-white/40 text-xs mt-2">
                [{coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}]
              </p>
            </div>
          </div>
        )}
        
        {/* Crosshair (optional, for aiming) */}
        {!loading && !error && !notAvailable && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-white/50 rounded-full" />
            </div>
          </div>
        )}
      </div>
    );
  }
);

YandexPanorama.displayName = "YandexPanorama";

