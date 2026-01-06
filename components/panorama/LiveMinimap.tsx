"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIVE MINIMAP COMPONENT
 * Постоянная миникарта в углу экрана с реальным положением игрока
 * 
 * Функции:
 * - Показывает позицию игрока в реальном времени
 * - Стрелка вращается по направлению взгляда
 * - Карта следует за игроком (центрируется)
 * - Можно свернуть/развернуть
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LiveMinimapProps {
  /** Координаты игрока [lat, lng] */
  playerPosition: [number, number];
  /** Направление взгляда игрока (0-360 градусов) */
  playerHeading: number;
  /** Начальный zoom (по умолчанию 18) */
  initialZoom?: number;
  /** Позиция на экране */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Изначально свёрнута */
  initiallyCollapsed?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function LiveMinimap({
  playerPosition,
  playerHeading,
  initialZoom = 18,
  position = "bottom-right",
  initiallyCollapsed = false,
}: LiveMinimapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerMarkerRef = useRef<any>(null);
  
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const [isMapReady, setIsMapReady] = useState(false);
  const [zoom, setZoom] = useState(initialZoom);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // ─── Ждём загрузки Google Maps API ───
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    
    // Проверяем сразу
    if (win.google?.maps) {
      setIsGoogleLoaded(true);
      return;
    }
    
    // Ждём загрузки с интервалом
    const checkInterval = setInterval(() => {
      if (win.google?.maps) {
        setIsGoogleLoaded(true);
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Таймаут 10 секунд
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
    }, 10000);
    
    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  // Позиция на экране (bottom учитывает нижний HUD и ClueDetector ~150px)
  const positionClasses = {
    "bottom-right": "bottom-40 right-4",
    "bottom-left": "bottom-40 left-4",
    "top-right": "top-20 right-4",
    "top-left": "top-20 left-4",
  };

  // ─── Инициализация карты ───
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!mapRef.current || !isGoogleLoaded || !(window as any).google?.maps || isCollapsed) return;
    
    // Если карта уже создана, не пересоздаём
    if (googleMapRef.current) return;
    
    // Проверяем валидность координат
    if (!playerPosition || !Array.isArray(playerPosition) || playerPosition.length !== 2) return;

    try {
      // Используем window.google для безопасного доступа
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gmaps = (window as any).google?.maps;
      if (!gmaps) return;

      // Создаём карту
      const map = new gmaps.Map(mapRef.current, {
        center: { lat: playerPosition[0], lng: playerPosition[1] },
        zoom,
        disableDefaultUI: true,
        gestureHandling: "none",
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        mapTypeId: "hybrid", // Спутник + дороги
        styles: [
          // Убираем POI для чистоты
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });

      googleMapRef.current = map;

      // ─── Маркер игрока (красная стрелка) ───
      const playerMarker = new gmaps.Marker({
        position: { lat: playerPosition[0], lng: playerPosition[1] },
        map,
        icon: {
          path: gmaps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          rotation: playerHeading,
        },
        title: "Вы здесь",
        zIndex: 100,
      });
      playerMarkerRef.current = playerMarker;

      setIsMapReady(true);
    } catch (e) {
      console.error("[LiveMinimap] Error initializing map:", e);
    }

    return () => {
      try {
        if (playerMarkerRef.current) {
          playerMarkerRef.current.setMap(null);
          playerMarkerRef.current = null;
        }
        googleMapRef.current = null;
        setIsMapReady(false);
      } catch (e) {
        // Игнорируем ошибки cleanup - DOM элементы могут быть уже удалены
        console.warn("[LiveMinimap] Cleanup warning:", e);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed, isGoogleLoaded]); // При сворачивании/разворачивании или загрузке Google Maps

  // ─── Обновление позиции и направления игрока ───
  useEffect(() => {
    if (!playerMarkerRef.current || !googleMapRef.current || !isMapReady) return;

    try {
      // Обновляем позицию маркера
      playerMarkerRef.current.setPosition({
        lat: playerPosition[0],
        lng: playerPosition[1],
      });

      // Обновляем поворот стрелки
      const currentIcon = playerMarkerRef.current.getIcon();
      if (currentIcon) {
        playerMarkerRef.current.setIcon({
          ...currentIcon,
          rotation: playerHeading,
        });
      }

      // Центрируем карту на игроке
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (googleMapRef.current as any).panTo({
        lat: playerPosition[0],
        lng: playerPosition[1],
      });
    } catch (e) {
      // Игнорируем ошибки - карта может быть уже удалена
    }
  }, [playerPosition, playerHeading, isMapReady]);

  // ─── Zoom controls ───
  const handleZoomIn = useCallback(() => {
    if (googleMapRef.current) {
      const newZoom = Math.min(zoom + 1, 21);
      setZoom(newZoom);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (googleMapRef.current as any).setZoom(newZoom);
    }
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    if (googleMapRef.current) {
      const newZoom = Math.max(zoom - 1, 14);
      setZoom(newZoom);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (googleMapRef.current as any).setZoom(newZoom);
    }
  }, [zoom]);

  // Не рендерим если свёрнуто — избегаем конфликта AnimatePresence с Google Maps
  if (isCollapsed) {
    return (
      <div className={`fixed ${positionClasses[position]} z-40`}>
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 
                     flex items-center justify-center shadow-lg shadow-black/30
                     hover:bg-white/15 hover:border-white/30 transition-all active:scale-95"
          title="Показать миникарту"
        >
          <span className="text-lg">🗺️</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-40`}>
      {/* ─── Развёрнутое состояние (карта) ─── */}
      <div
        className="relative bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden 
                   border border-white/20 shadow-xl shadow-black/40"
      >
            {/* ─── Header ─── */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between 
                            px-2.5 py-2 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📍</span>
                <span className="text-[11px] text-white/70 font-medium tracking-wide">GPS</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                {/* Zoom controls */}
                <button
                  onClick={handleZoomOut}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 
                             flex items-center justify-center text-white/70 hover:text-white 
                             transition-all text-sm font-medium active:scale-90"
                  title="Уменьшить"
                >
                  −
                </button>
                <button
                  onClick={handleZoomIn}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 
                             flex items-center justify-center text-white/70 hover:text-white 
                             transition-all text-sm font-medium active:scale-90"
                  title="Увеличить"
                >
                  +
                </button>
                
                {/* Collapse button */}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 
                             flex items-center justify-center text-white/70 hover:text-white 
                             transition-all text-xs active:scale-90"
                  title="Свернуть"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ─── Map ─── */}
            <div 
              ref={mapRef}
              className="w-36 h-36 bg-slate-800/50 relative"
              style={{ minWidth: "144px", minHeight: "144px" }}
            >
              {/* Loading indicator */}
              {!isMapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* ─── Compass ─── */}
            <div className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm
                            flex items-center justify-center border border-white/10">
              <span 
                className="text-red-400 text-[10px] font-bold block transition-transform duration-200"
                style={{ transform: `rotate(${-playerHeading}deg)` }}
              >
                N
              </span>
            </div>

            {/* ─── Heading indicator ─── */}
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm
                            text-[10px] text-white/60 font-mono border border-white/10">
              {Math.round(playerHeading)}°
            </div>
          </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default LiveMinimap;

