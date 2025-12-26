"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAPILLARY PANORAMA COMPONENT
 * Компонент для отображения панорам Mapillary (бесплатно!)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { GeoCoordinates, CameraDirection } from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MapillaryPanoramaProps {
  /** Координаты панорамы [широта, долгота] */
  coordinates: GeoCoordinates;
  
  /** Начальное направление камеры [heading (0-360), pitch (-90 to 90)] */
  direction?: CameraDirection;
  
  /** CSS классы контейнера */
  className?: string;
  
  /** Разрешить навигацию */
  allowNavigation?: boolean;
  
  /** Callback когда панорама загружена */
  onReady?: () => void;
  
  /** Callback при ошибке загрузки */
  onError?: (error: Error) => void;
  
  /** Callback при изменении направления камеры */
  onDirectionChange?: (direction: CameraDirection) => void;
  
  /** Callback при смене позиции */
  onPositionChange?: (coordinates: GeoCoordinates) => void;
}

export interface MapillaryPanoramaRef {
  /** Получить текущее направление камеры */
  getDirection: () => CameraDirection | null;
  
  /** Установить направление камеры */
  setDirection: (direction: CameraDirection) => void;
  
  /** Перейти к координатам */
  moveTo: (coordinates: GeoCoordinates) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT & STYLES LOADER
// ═══════════════════════════════════════════════════════════════════════════

let mapillaryLoadPromise: Promise<any> | null = null;

function loadMapillarySDK(): Promise<any> {
  if (mapillaryLoadPromise) return mapillaryLoadPromise;
  
  mapillaryLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).mapillary) {
      resolve((window as any).mapillary);
      return;
    }
    
    const accessToken = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN;
    console.log("[MapillaryPanorama] Token present:", !!accessToken);
    
    if (!accessToken) {
      reject(new Error("NEXT_PUBLIC_MAPILLARY_TOKEN not configured"));
      return;
    }
    
    // Load CSS
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/mapillary-js@4/dist/mapillary.css";
    document.head.appendChild(css);
    
    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/mapillary-js@4/dist/mapillary.js";
    script.async = true;
    
    script.onload = () => {
      console.log("[MapillaryPanorama] SDK loaded!");
      if ((window as any).mapillary) {
        resolve((window as any).mapillary);
      } else {
        reject(new Error("Mapillary SDK failed to initialize"));
      }
    };
    
    script.onerror = () => {
      console.error("[MapillaryPanorama] Failed to load SDK");
      mapillaryLoadPromise = null;
      reject(new Error("Failed to load Mapillary SDK"));
    };
    
    document.head.appendChild(script);
  });
  
  return mapillaryLoadPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const MapillaryPanorama = forwardRef<MapillaryPanoramaRef, MapillaryPanoramaProps>(
  function MapillaryPanorama(
    {
      coordinates,
      direction,
      className = "",
      allowNavigation = true,
      onReady,
      onError,
      onDirectionChange,
      onPositionChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notAvailable, setNotAvailable] = useState(false);
    
    // ─── Expose methods via ref ───
    useImperativeHandle(ref, () => ({
      getDirection: () => {
        if (!viewerRef.current) return null;
        try {
          // Mapillary v4 API
          const bearing = viewerRef.current.getBearing?.() ?? 0;
          const tilt = viewerRef.current.getTilt?.() ?? 0;
          return [bearing, tilt];
        } catch {
          return [0, 0];
        }
      },
      
      setDirection: (dir: CameraDirection) => {
        if (viewerRef.current) {
          try {
            // Mapillary v4: setCenter принимает [lng, lat] или bearing
            viewerRef.current.setBearing?.(dir[0]);
            viewerRef.current.setTilt?.(dir[1]);
          } catch (e) {
            console.warn("[MapillaryPanorama] Failed to set direction:", e);
          }
        }
      },
      
      moveTo: async (coords: GeoCoordinates) => {
        if (!viewerRef.current) return;
        try {
          await viewerRef.current.moveTo(coords);
        } catch (e) {
          console.warn("[MapillaryPanorama] Failed to move:", e);
        }
      },
    }));
    
    // ─── Initialize viewer ───
    useEffect(() => {
      let mounted = true;
      let viewer: any = null;
      
      async function init() {
        if (!containerRef.current) return;
        
        try {
          setLoading(true);
          setError(null);
          setNotAvailable(false);
          
          console.log("[MapillaryPanorama] Loading SDK...");
          const Mapillary = await loadMapillarySDK();
          
          if (!mounted) return;
          
          const accessToken = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN!;
          
          // Создаём viewer
          console.log("[MapillaryPanorama] Creating viewer...");
          viewer = new Mapillary.Viewer({
            accessToken,
            container: containerRef.current,
            component: {
              cover: false,
              direction: allowNavigation,
              sequence: allowNavigation,
              zoom: true,
            },
          });
          
          viewerRef.current = viewer;
          
          // Ищем ближайшее изображение по координатам
          console.log("[MapillaryPanorama] Searching for images at:", coordinates);
          
          // Mapillary API для поиска изображений
          const searchUrl = `https://graph.mapillary.com/images?access_token=${accessToken}&fields=id,geometry&bbox=${coordinates[1]-0.01},${coordinates[0]-0.01},${coordinates[1]+0.01},${coordinates[0]+0.01}&limit=1`;
          
          const response = await fetch(searchUrl);
          const data = await response.json();
          
          if (!mounted) return;
          
          if (!data.data || data.data.length === 0) {
            console.log("[MapillaryPanorama] No images found");
            setNotAvailable(true);
            setLoading(false);
            return;
          }
          
          const imageId = data.data[0].id;
          console.log("[MapillaryPanorama] Found image:", imageId);
          
          // Загружаем изображение
          await viewer.moveTo(imageId);
          
          if (!mounted) return;
          
          // Устанавливаем начальное направление (Mapillary v4 API)
          if (direction) {
            try {
              viewer.setBearing?.(direction[0]);
              viewer.setTilt?.(direction[1]);
            } catch (e) {
              console.warn("[MapillaryPanorama] Failed to set initial direction:", e);
            }
          }
          
          // События
          if (onDirectionChange) {
            viewer.on("bearing", () => {
              try {
                const bearing = viewer.getBearing?.() ?? 0;
                const tilt = viewer.getTilt?.() ?? 0;
                onDirectionChange([bearing, tilt]);
              } catch {
                // ignore
              }
            });
          }
          
          if (onPositionChange) {
            viewer.on("position", (event: any) => {
              if (event.position) {
                onPositionChange([event.position.lat, event.position.lng]);
              }
            });
          }
          
          setLoading(false);
          console.log("[MapillaryPanorama] Ready!");
          onReady?.();
          
        } catch (err) {
          if (!mounted) return;
          
          const error = err instanceof Error ? err : new Error("Unknown error");
          console.error("[MapillaryPanorama] Error:", error);
          setError(error.message);
          setLoading(false);
          onError?.(error);
        }
      }
      
      init();
      
      return () => {
        mounted = false;
        if (viewer) {
          viewer.remove();
        }
        viewerRef.current = null;
      };
    }, [coordinates[0], coordinates[1], allowNavigation]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // ─── Render ───
    return (
      <div className={`relative bg-[#0a0a12] ${className}`}>
        {/* Viewer container */}
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
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-green-500 mx-auto" />
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
      </div>
    );
  }
);

MapillaryPanorama.displayName = "MapillaryPanorama";

