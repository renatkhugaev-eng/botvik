"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA CLUE COMPONENT
 * Интерактивная улика на панораме
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanoramaClue as ClueType, CameraDirection, CluePosition } from "@/types/panorama";
import { haptic } from "@/lib/haptic";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PanoramaClueProps {
  clue: ClueType;
  
  /** Текущее направление камеры */
  cameraDirection: CameraDirection;
  
  /** Размер контейнера панорамы */
  containerSize: { width: number; height: number };
  
  /** Поле зрения камеры (градусы) */
  fieldOfView?: number;
  
  /** Улика уже найдена */
  found?: boolean;
  
  /** Callback при клике на улику */
  onFind?: (clue: ClueType) => void;
  
  /** Callback при ответе на вопрос */
  onAnswer?: (clue: ClueType, answer: string | number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Преобразует позицию улики (yaw, pitch) в позицию на экране
 */
function clueToScreenPosition(
  cluePos: CluePosition,
  cameraDir: CameraDirection,
  containerSize: { width: number; height: number },
  fov: number
): { x: number; y: number; visible: boolean; distance: number } {
  const [cameraYaw, cameraPitch] = cameraDir;
  
  // Разница углов
  let deltaYaw = cluePos.yaw - cameraYaw;
  
  // Нормализуем deltaYaw в диапазон [-180, 180]
  while (deltaYaw > 180) deltaYaw -= 360;
  while (deltaYaw < -180) deltaYaw += 360;
  
  const deltaPitch = cluePos.pitch - cameraPitch;
  
  // Видимость (в пределах поля зрения)
  const halfFov = fov / 2;
  const visible = Math.abs(deltaYaw) < halfFov && Math.abs(deltaPitch) < halfFov * 0.75;
  
  // Позиция на экране (центр = камера)
  const x = (deltaYaw / halfFov) * (containerSize.width / 2) + containerSize.width / 2;
  const y = (-deltaPitch / (halfFov * 0.75)) * (containerSize.height / 2) + containerSize.height / 2;
  
  // Расстояние от центра (для эффектов)
  const distance = Math.sqrt(deltaYaw ** 2 + deltaPitch ** 2);
  
  return { x, y, visible, distance };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE ICONS BY TYPE
// ═══════════════════════════════════════════════════════════════════════════

const CLUE_ICONS: Record<ClueType["type"], string> = {
  visual: "🔍",
  text: "📝",
  count: "🔢",
  identify: "❓",
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PanoramaClue({
  clue,
  cameraDirection,
  containerSize,
  fieldOfView = 120,
  found = false,
  onFind,
  onAnswer,
}: PanoramaClueProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  
  // Вычисляем позицию на экране (только если есть position)
  const screenPos = useMemo(() => {
    // Если нет точной позиции — возвращаем "невидимую" позицию
    if (!clue.position) {
      return { x: 0, y: 0, visible: false, distance: 999 };
    }
    return clueToScreenPosition(clue.position, cameraDirection, containerSize, fieldOfView);
  }, [clue.position, cameraDirection, containerSize, fieldOfView]);
  
  // Размер улики (уменьшается с расстоянием)
  const size = useMemo(() => {
    const baseSize = 48;
    const scale = Math.max(0.5, 1 - screenPos.distance / 100);
    return baseSize * scale;
  }, [screenPos.distance]);
  
  // Если уже найдена и не нужен ответ — не показываем
  if (found && clue.type === "visual") {
    return null;
  }
  
  // Если не видна — не рендерим
  if (!screenPos.visible) {
    return null;
  }
  
  // Обработчик клика
  const handleClick = () => {
    haptic.medium();
    
    if (found) return;
    
    if (clue.type === "visual") {
      // Простая улика — сразу найдена
      onFind?.(clue);
    } else {
      // Нужен ответ — показываем попап
      setShowPopup(true);
    }
  };
  
  // Обработчик ответа
  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) return;
    
    haptic.heavy();
    setAnswered(true);
    onAnswer?.(clue, clue.type === "count" ? parseInt(userAnswer, 10) : userAnswer);
    
    setTimeout(() => {
      setShowPopup(false);
    }, 500);
  };
  
  return (
    <>
      {/* Маркер улики */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: found ? 0.8 : 1, 
          opacity: found ? 0.5 : 1,
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        disabled={found}
        className="absolute z-10 flex items-center justify-center"
        style={{
          left: screenPos.x,
          top: screenPos.y,
          width: size,
          height: size,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Пульсирующий фон */}
        {!found && (
          <motion.div
            className="absolute inset-0 rounded-full bg-cyan-500/30"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        
        {/* Основной круг */}
        <div 
          className={`
            relative w-full h-full rounded-full flex items-center justify-center
            border-2 backdrop-blur-sm transition-all duration-300
            ${found 
              ? "bg-green-500/30 border-green-500/50" 
              : "bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
            }
          `}
        >
          <span className="text-lg" style={{ fontSize: size * 0.4 }}>
            {found ? "✓" : (clue.icon || CLUE_ICONS[clue.type])}
          </span>
        </div>
        
        {/* Подсказка при наведении (если есть) */}
        {clue.hint && !found && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap
            bg-black/80 text-white/80 text-xs px-2 py-1 rounded-lg opacity-0 
            group-hover:opacity-100 transition-opacity pointer-events-none">
            {clue.hint}
          </div>
        )}
      </motion.button>
      
      {/* Попап с вопросом */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-gradient-to-b from-[#1a1a2e] to-[#12121a] 
                rounded-2xl p-6 border border-white/10"
            >
              {/* Иконка */}
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border-2 border-cyan-500/40
                flex items-center justify-center text-3xl mx-auto mb-4">
                {clue.icon || CLUE_ICONS[clue.type]}
              </div>
              
              {/* Название */}
              <h3 className="text-lg font-bold text-white text-center mb-2">
                {clue.name}
              </h3>
              
              {/* Описание */}
              {clue.description && (
                <p className="text-sm text-white/60 text-center mb-4">
                  {clue.description}
                </p>
              )}
              
              {/* Вопрос */}
              {clue.question && (
                <p className="text-white/80 text-center mb-4">
                  {clue.question}
                </p>
              )}
              
              {/* Ввод ответа (для text и count) */}
              {(clue.type === "text" || clue.type === "count") && (
                <div className="mb-4">
                  <input
                    type={clue.type === "count" ? "number" : "text"}
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder={clue.type === "count" ? "Введите число" : "Введите ответ"}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl
                      text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>
              )}
              
              {/* Варианты ответа (для identify) */}
              {clue.type === "identify" && clue.options && (
                <div className="space-y-2 mb-4">
                  {clue.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setUserAnswer(String(index));
                        haptic.light();
                      }}
                      className={`w-full px-4 py-3 rounded-xl text-left transition-all
                        ${userAnswer === String(index)
                          ? "bg-cyan-500/30 border-cyan-500 border-2"
                          : "bg-white/10 border border-white/20 hover:bg-white/15"
                        }`}
                    >
                      <span className="text-white">{option}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Кнопки */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPopup(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!userAnswer.trim() || answered}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500
                    text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {answered ? "✓" : "Ответить"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE OVERLAY CONTAINER
// Контейнер для всех улик с отслеживанием камеры
// ═══════════════════════════════════════════════════════════════════════════

interface ClueOverlayProps {
  clues: ClueType[];
  cameraDirection: CameraDirection;
  containerRef: React.RefObject<HTMLDivElement>;
  foundClueIds: string[];
  onFind?: (clue: ClueType) => void;
  onAnswer?: (clue: ClueType, answer: string | number) => void;
}

export function ClueOverlay({
  clues,
  cameraDirection,
  containerRef,
  foundClueIds,
  onFind,
  onAnswer,
}: ClueOverlayProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Отслеживаем размер контейнера
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateSize();
    
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [containerRef]);
  
  if (containerSize.width === 0) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {clues.map((clue) => (
        <div key={clue.id} className="pointer-events-auto">
          <PanoramaClue
            clue={clue}
            cameraDirection={cameraDirection}
            containerSize={containerSize}
            found={foundClueIds.includes(clue.id)}
            onFind={onFind}
            onAnswer={onAnswer}
          />
        </div>
      ))}
    </div>
  );
}

