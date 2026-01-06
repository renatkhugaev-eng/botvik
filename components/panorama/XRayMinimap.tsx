"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * X-RAY MINIMAP COMPONENT
 * Платная подсказка "Рентген" — миникарта с позицией игрока и ближайшей улики
 * 
 * Функции:
 * - Показывает карту Google Maps с реальными координатами
 * - Маркер игрока (красная стрелка, вращается по направлению взгляда)
 * - Маркер улики (зелёный пульсирующий круг)
 * - Автоматически скрывается через 15 секунд
 * - XP штраф -20% за использование
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Declare google maps types
declare const google: {
  maps: {
    Map: new (element: HTMLElement, options: unknown) => unknown;
    Marker: new (options: unknown) => unknown;
    Polyline: new (options: unknown) => unknown;
    SymbolPath: {
      CIRCLE: unknown;
      FORWARD_CLOSED_ARROW: unknown;
      BACKWARD_CLOSED_ARROW: unknown;
    };
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface XRayMinimapProps {
  /** Координаты игрока [lat, lng] */
  playerPosition: [number, number];
  /** Направление взгляда игрока (0-360 градусов) */
  playerHeading?: number;
  /** Координаты ближайшей улики [lat, lng] */
  cluePosition: [number, number];
  /** Название улики для tooltip */
  clueName?: string;
  /** Иконка улики */
  clueIcon?: string;
  /** Время показа в секундах (по умолчанию 15) */
  duration?: number;
  /** Callback при закрытии */
  onClose?: () => void;
  /** Callback при истечении времени */
  onExpire?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_DURATION = 15; // секунд
const XRAY_COST = 0; // БЕСПЛАТНО
const XP_PENALTY = 0.2; // 20% штраф к XP

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function XRayMinimap({
  playerPosition,
  playerHeading = 0,
  cluePosition,
  clueName = "Улика",
  clueIcon = "🔍",
  duration = DEFAULT_DURATION,
  onClose,
  onExpire,
}: XRayMinimapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clueMarkerRef = useRef<any>(null);
  const pulseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isLoaded, setIsLoaded] = useState(false);

  // ─── Инициализация карты (только при изменении позиции улики!) ───
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    
    // Если карта уже создана, не пересоздаём
    if (googleMapRef.current) return;

    // Рассчитываем центр между игроком и уликой
    const centerLat = (playerPosition[0] + cluePosition[0]) / 2;
    const centerLng = (playerPosition[1] + cluePosition[1]) / 2;

    // Рассчитываем расстояние для zoom
    const latDiff = Math.abs(playerPosition[0] - cluePosition[0]);
    const lngDiff = Math.abs(playerPosition[1] - cluePosition[1]);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Адаптивный zoom: чем дальше улика, тем меньше zoom
    let zoom = 18;
    if (maxDiff > 0.001) zoom = 17;
    if (maxDiff > 0.002) zoom = 16;
    if (maxDiff > 0.004) zoom = 15;
    if (maxDiff > 0.008) zoom = 14;

    // Создаём карту
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom,
      disableDefaultUI: true,
      gestureHandling: "none",
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        // Тёмная тема для детективной атмосферы
        { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });

    googleMapRef.current = map;

    // ─── Маркер игрока (красная стрелка, вращается по направлению взгляда) ───
    const playerMarker = new google.maps.Marker({
      position: { lat: playerPosition[0], lng: playerPosition[1] },
      map,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 7,
        fillColor: "#ef4444",
        fillOpacity: 1,
        strokeColor: "#b91c1c",
        strokeWeight: 2,
        rotation: playerHeading, // Поворот по направлению взгляда
      },
      title: "Вы здесь",
      zIndex: 100,
    });
    playerMarkerRef.current = playerMarker;

    // ─── Маркер улики (зелёный пульсирующий круг) ───
    const clueMarker = new google.maps.Marker({
      position: { lat: cluePosition[0], lng: cluePosition[1] },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#22c55e",
        fillOpacity: 1,
        strokeColor: "#15803d",
        strokeWeight: 3,
      },
      title: clueName,
      zIndex: 99,
    });
    clueMarkerRef.current = clueMarker;

    // ─── Пульсация маркера улики ───
    let pulseState = true;
    pulseIntervalRef.current = setInterval(() => {
      if (clueMarker) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (clueMarker as any).setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: pulseState ? 12 : 9,
          fillColor: pulseState ? "#4ade80" : "#22c55e",
          fillOpacity: pulseState ? 0.9 : 1,
          strokeColor: "#15803d",
          strokeWeight: 3,
        });
        pulseState = !pulseState;
      }
    }, 500);

    // ─── Линия между игроком и уликой ───
    new google.maps.Polyline({
      path: [
        { lat: playerPosition[0], lng: playerPosition[1] },
        { lat: cluePosition[0], lng: cluePosition[1] },
      ],
      geodesic: true,
      strokeColor: "#f59e0b",
      strokeOpacity: 0.6,
      strokeWeight: 2,
      icons: [{
        icon: {
          path: "M 0,-1 0,1",
          strokeOpacity: 1,
          scale: 3,
        },
        offset: "0",
        repeat: "15px",
      }],
      map,
    });

    setIsLoaded(true);

    return () => {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
      }
      if (playerMarkerRef.current) {
        playerMarkerRef.current.setMap(null);
        playerMarkerRef.current = null;
      }
      if (clueMarkerRef.current) {
        clueMarkerRef.current.setMap(null);
        clueMarkerRef.current = null;
      }
      googleMapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluePosition, clueName]); // НЕ зависим от playerPosition/playerHeading — они обновляются отдельно

  // ─── Обновление позиции и направления игрока в реальном времени ───
  useEffect(() => {
    if (playerMarkerRef.current && googleMapRef.current) {
      playerMarkerRef.current.setPosition({
        lat: playerPosition[0],
        lng: playerPosition[1],
      });
      // Обновляем поворот стрелки по направлению взгляда
      const currentIcon = playerMarkerRef.current.getIcon();
      if (currentIcon) {
        playerMarkerRef.current.setIcon({
          ...currentIcon,
          rotation: playerHeading,
        });
      }
    }
  }, [playerPosition, playerHeading]);

  // ─── Таймер обратного отсчёта ───
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpire]);

  // ─── Расчёт расстояния ───
  const distance = useCallback(() => {
    const R = 6371e3; // радиус Земли в метрах
    const φ1 = playerPosition[0] * Math.PI / 180;
    const φ2 = cluePosition[0] * Math.PI / 180;
    const Δφ = (cluePosition[0] - playerPosition[0]) * Math.PI / 180;
    const Δλ = (cluePosition[1] - playerPosition[1]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return Math.round(R * c);
  }, [playerPosition, cluePosition]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-slate-900 rounded-2xl overflow-hidden border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20"
        >
          {/* ─── Header ─── */}
          <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-gradient-to-b from-slate-900 via-slate-900/90 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔬</span>
                <div>
                  <h3 className="text-cyan-400 font-bold text-sm">РЕНТГЕН</h3>
                  <p className="text-slate-400 text-xs">Сканирование местности</p>
                </div>
              </div>
              
              {/* Таймер */}
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-sm font-mono font-bold ${
                  timeLeft <= 5 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-cyan-500/20 text-cyan-400"
                }`}>
                  {timeLeft}с
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* ─── Map ─── */}
          <div 
            ref={mapRef}
            className="w-full h-80 bg-slate-800"
            style={{ minHeight: "320px" }}
          />

          {/* ─── Scan overlay effect ─── */}
          {isLoaded && (
            <motion.div
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 pointer-events-none"
            />
          )}

          {/* ─── Footer with info ─── */}
          <div className="p-4 bg-slate-900 border-t border-slate-700">
            {/* Легенда */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-red-500 text-lg">➤</span>
                  <span className="text-slate-400">Вы</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-slate-400">Улика</span>
                </div>
              </div>
              
              <div className="text-xs text-amber-400">
                ⚠️ XP -20%
              </div>
            </div>

            {/* Информация об улике */}
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{clueIcon}</span>
                <div>
                  <p className="text-white font-medium text-sm">{clueName}</p>
                  <p className="text-slate-400 text-xs">Ближайшая нераскрытая улика</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-cyan-400 font-bold">~{distance()} м</p>
                <p className="text-slate-500 text-xs">расстояние</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface XRayPurchaseButtonProps {
  /** Доступная энергия */
  energy: number;
  /** Есть ли нераскрытые улики */
  hasAvailableClues: boolean;
  /** Осталось использований */
  usesRemaining?: number;
  /** Максимум использований */
  maxUses?: number;
  /** Callback при покупке */
  onPurchase: () => void;
  /** Загрузка */
  loading?: boolean;
}

export function XRayPurchaseButton({
  energy,
  hasAvailableClues,
  usesRemaining = 7,
  maxUses = 7,
  onPurchase,
  loading = false,
}: XRayPurchaseButtonProps) {
  const canAfford = energy >= XRAY_COST;
  const noUsesLeft = usesRemaining <= 0;
  const isDisabled = !canAfford || !hasAvailableClues || noUsesLeft || loading;

  const isFree = XRAY_COST === 0;
  
  let buttonText = isFree ? `🔬 ${usesRemaining}/${maxUses}` : `🔬 ${XRAY_COST} 💎`;
  let tooltipText = isFree 
    ? `Показать карту с ближайшей уликой (${usesRemaining} из ${maxUses}, XP -20%)` 
    : `Показать карту с уликой (${XRAY_COST} 💎, XP -20%)`;
  
  if (noUsesLeft) {
    buttonText = "🔬 Лимит";
    tooltipText = `Использовано ${maxUses} из ${maxUses} раз за миссию`;
  } else if (!hasAvailableClues) {
    buttonText = "🔬 Нет улик";
    tooltipText = "Все улики уже найдены";
  } else if (!canAfford && !isFree) {
    buttonText = `🔬 ${XRAY_COST} 💎`;
    tooltipText = `Недостаточно энергии (нужно ${XRAY_COST})`;
  }

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
      onClick={onPurchase}
      disabled={isDisabled}
      title={tooltipText}
      className={`
        relative px-5 py-2.5 rounded-2xl font-medium text-sm backdrop-blur-md border
        transition-all duration-200
        ${isDisabled
          ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
          : "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 shadow-lg shadow-cyan-500/10"
        }
      `}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Сканирование...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {buttonText}
          {!noUsesLeft && hasAvailableClues && !isFree && canAfford && (
            <span className="text-cyan-200 text-xs">(-20% XP)</span>
          )}
          {!noUsesLeft && hasAvailableClues && isFree && (
            <span className="text-amber-300 text-xs">-20% XP</span>
          )}
        </span>
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const XRAY_CONFIG = {
  cost: XRAY_COST,
  duration: DEFAULT_DURATION,
  xpPenalty: XP_PENALTY,
} as const;

