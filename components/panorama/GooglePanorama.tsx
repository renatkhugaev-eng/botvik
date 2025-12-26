"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GOOGLE STREET VIEW PANORAMA COMPONENT
 * Компонент для отображения панорам Google Street View
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { GeoCoordinates, CameraDirection } from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface GooglePanoramaProps {
  /** Координаты панорамы [широта, долгота] */
  coordinates: GeoCoordinates;
  
  /** Начальное направление камеры [heading (0-360), pitch (-90 to 90)] */
  direction?: CameraDirection;
  
  /** CSS классы контейнера */
  className?: string;
  
  /** Разрешить навигацию (стрелки перехода) */
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

export interface GooglePanoramaRef {
  /** Получить текущее направление камеры */
  getDirection: () => CameraDirection | null;
  
  /** Установить направление камеры */
  setDirection: (direction: CameraDirection) => void;
  
  /** Перейти к координатам */
  moveTo: (coordinates: GeoCoordinates) => void;
  
  /** Получить текущий panoId */
  getPanoId: () => string | null;
  
  /** Получить доступ к нативному объекту панорамы (google.maps.StreetViewPanorama) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPlayer: () => any | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE MAPS TYPES
// ═══════════════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: {
      maps: {
        StreetViewPanorama: new (container: HTMLElement, options: any) => any;
        StreetViewService: new () => any;
        StreetViewStatus: {
          OK: string;
          ZERO_RESULTS: string;
        };
        LatLng: new (lat: number, lng: number) => any;
      };
    };
    initGoogleMaps?: () => void;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT LOADER
// ═══════════════════════════════════════════════════════════════════════════

let googleMapsLoadPromise: Promise<void> | null = null;

function loadGoogleMapsAPI(): Promise<void> {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    // Уже загружен
    if (window.google?.maps) {
      resolve();
      return;
    }
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    console.log("[GooglePanorama] API Key present:", !!apiKey);
    
    if (!apiKey) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY not configured"));
      return;
    }
    
    // Callback для загрузки
    window.initGoogleMaps = () => {
      console.log("[GooglePanorama] Google Maps loaded!");
      resolve();
    };
    
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    
    script.onerror = () => {
      console.error("[GooglePanorama] Failed to load script");
      googleMapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    
    document.head.appendChild(script);
  });
  
  return googleMapsLoadPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const GooglePanorama = forwardRef<GooglePanoramaRef, GooglePanoramaProps>(
  function GooglePanorama(
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
    const panoramaRef = useRef<any>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notAvailable, setNotAvailable] = useState(false);
    
    // ─── Expose methods via ref ───
    useImperativeHandle(ref, () => ({
      getDirection: () => {
        if (!panoramaRef.current) return null;
        const pov = panoramaRef.current.getPov();
        return [pov.heading, pov.pitch];
      },
      
      setDirection: (dir: CameraDirection) => {
        if (panoramaRef.current) {
          panoramaRef.current.setPov({ heading: dir[0], pitch: dir[1] });
        }
      },
      
      moveTo: (coords: GeoCoordinates) => {
        if (panoramaRef.current && window.google) {
          panoramaRef.current.setPosition(
            new window.google.maps.LatLng(coords[0], coords[1])
          );
        }
      },
      
      getPanoId: () => {
        if (!panoramaRef.current) return null;
        return panoramaRef.current.getPano() || null;
      },
      
      getPlayer: () => {
        return panoramaRef.current;
      },
    }));
    
    // ─── Initialize panorama ───
    useEffect(() => {
      let mounted = true;
      
      async function init() {
        if (!containerRef.current) return;
        
        try {
          setLoading(true);
          setError(null);
          setNotAvailable(false);
          
          console.log("[GooglePanorama] Loading API...");
          await loadGoogleMapsAPI();
          
          if (!mounted || !window.google) return;
          
          const google = window.google;
          
          // Проверяем доступность панорамы
          console.log("[GooglePanorama] Checking panorama at:", coordinates);
          const streetViewService = new google.maps.StreetViewService();
          const location = new google.maps.LatLng(coordinates[0], coordinates[1]);
          
          streetViewService.getPanorama(
            { location, radius: 50 },
            (data: any, status: string) => {
              if (!mounted) return;
              
              console.log("[GooglePanorama] Service status:", status);
              
              if (status !== google.maps.StreetViewStatus.OK) {
                setNotAvailable(true);
                setLoading(false);
                return;
              }
              
              // Создаём панораму
              console.log("[GooglePanorama] Creating panorama...");
              const panorama = new google.maps.StreetViewPanorama(
                containerRef.current!,
                {
                  position: location,
                  pov: {
                    heading: direction?.[0] || 0,
                    pitch: direction?.[1] || 0,
                  },
                  zoom: 1,
                  // UI controls
                  addressControl: false,
                  showRoadLabels: false,
                  linksControl: allowNavigation,
                  panControl: false, // Убираем кнопки - используем touch/drag
                  zoomControl: true,
                  fullscreenControl: false,
                  // Interaction
                  clickToGo: allowNavigation,
                  scrollwheel: true,
                  disableDefaultUI: false,
                  disableDoubleClickZoom: false,
                  // Motion
                  motionTracking: false,
                  motionTrackingControl: false,
                  // Enable all interaction
                  enableCloseButton: false,
                }
              );
              
              panoramaRef.current = panorama;
              
              // События
              if (onDirectionChange) {
                panorama.addListener("pov_changed", () => {
                  const pov = panorama.getPov();
                  onDirectionChange([pov.heading, pov.pitch]);
                });
              }
              
              if (onPositionChange) {
                panorama.addListener("position_changed", () => {
                  const pos = panorama.getPosition();
                  if (pos) {
                    onPositionChange([pos.lat(), pos.lng()]);
                  }
                });
              }
              
              setLoading(false);
              console.log("[GooglePanorama] Ready!");
              onReady?.();
            }
          );
          
        } catch (err) {
          if (!mounted) return;
          
          const error = err instanceof Error ? err : new Error("Unknown error");
          console.error("[GooglePanorama] Error:", error);
          setError(error.message);
          setLoading(false);
          onError?.(error);
        }
      }
      
      init();
      
      return () => {
        mounted = false;
        panoramaRef.current = null;
      };
    }, [coordinates[0], coordinates[1], allowNavigation]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // Direction is only set on initial load, not on prop changes
    // This prevents the panorama from resetting when user rotates it
    
    // ─── Render ───
    return (
      <div 
        className={`relative bg-[#0a0a12] ${className}`}
        style={{ minHeight: "100%", minWidth: "100%" }}
      >
        {/* Panorama container - needs explicit sizing */}
        <div 
          ref={containerRef} 
          className="absolute inset-0"
          style={{ 
            visibility: loading || error || notAvailable ? "hidden" : "visible",
            width: "100%",
            height: "100%",
          }}
        />
        
        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12]">
            <div className="text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-blue-500 mx-auto" />
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

GooglePanorama.displayName = "GooglePanorama";

