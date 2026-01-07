"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TOUR_STEPS, markTourCompleted } from "./tourSteps";
import { haptic } from "@/lib/haptic";

type GuidedTourProps = {
  onComplete?: () => void;
  onSkip?: () => void;
};

export function GuidedTour({ onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  // Константы
  const PADDING = 16;
  const TOOLTIP_HEIGHT = 350;
  const NAV_HEIGHT = 100;
  const GAP = 20;

  // Получить элемент текущего шага
  const getTargetElement = useCallback(() => {
    if (!step?.spotlight) return null;
    return document.querySelector(step.target) as HTMLElement | null;
  }, [step]);

  // Обновить позицию элемента
  const updateRect = useCallback(() => {
    const el = getTargetElement();
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
      }
    } else {
      setTargetRect(null);
    }
  }, [getTargetElement]);

  // Проскроллить к элементу и показать tooltip
  const scrollAndShow = useCallback(() => {
    setIsReady(false);
    
    // Для центральных шагов (welcome/finish) — сразу показываем
    if (!step?.spotlight || step.position === 'center') {
      setTimeout(() => setIsReady(true), 100);
      return;
    }

    const el = getTargetElement();
    if (!el) {
      // Элемент не найден — пропускаем шаг
      setTimeout(() => {
        setCurrentStep(prev => Math.min(prev + 1, TOUR_STEPS.length - 1));
      }, 100);
      return;
    }

    // Определяем: это элемент внизу экрана? (навигация)
    const isBottomElement = step.id === 'navigation';
    
    if (isBottomElement) {
      // Для навигации: скроллим в самый низ страницы
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
      // Для всех остальных: скроллим элемент к началу экрана
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Дополнительный отступ сверху
      setTimeout(() => {
        window.scrollBy({ top: -100, behavior: 'smooth' });
      }, 150);
    }

    // Ждём завершения скролла
    setTimeout(() => {
      updateRect();
      setIsReady(true);
    }, 600);
  }, [step, getTargetElement, updateRect]);

  // При смене шага — скроллим
  useEffect(() => {
    scrollAndShow();
  }, [currentStep, scrollAndShow]);

  // Следим за изменениями позиции
  useEffect(() => {
    if (!isReady) return;
    
    const interval = setInterval(updateRect, 300);
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [isReady, updateRect]);

  // Навигация
  const handleNext = useCallback(() => {
    haptic.light();
    if (isLast) {
      markTourCompleted();
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 300);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLast, onComplete]);

  const handlePrev = useCallback(() => {
    haptic.light();
    if (!isFirst) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirst]);

  const handleSkip = useCallback(() => {
    haptic.medium();
    markTourCompleted();
    setIsVisible(false);
    setTimeout(() => onSkip?.(), 300);
  }, [onSkip]);

  if (!step) return null;

  // Вычисляем позицию tooltip
  const getTooltipPosition = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipWidth = Math.min(320, vw - PADDING * 2);

    // Центральный tooltip (welcome/finish) — проверяем ДО targetRect
    if (step.position === 'center') {
      // Центрируем с учётом навигации внизу
      const safeHeight = vh - NAV_HEIGHT - 40;
      const centerY = safeHeight / 2;
      
      return {
        top: Math.max(PADDING, centerY - 180), // Примерно половина высоты tooltip
        left: Math.max(PADDING, (vw - tooltipWidth) / 2),
        width: tooltipWidth,
        position: 'center' as const,
      };
    }
    
    // Если нет targetRect — тоже центрируем
    if (!targetRect) {
      const safeHeight = vh - NAV_HEIGHT - 40;
      const centerY = safeHeight / 2;
      
      return {
        top: Math.max(PADDING, centerY - 180),
        left: Math.max(PADDING, (vw - tooltipWidth) / 2),
        width: tooltipWidth,
        position: 'center' as const,
      };
    }

    // Центрируем по горизонтали относительно элемента
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    left = Math.max(PADDING, Math.min(vw - tooltipWidth - PADDING, left));

    // Для шага navigation или элементов внизу экрана — tooltip СВЕРХУ
    const isNavigation = step.id === 'navigation';
    const isBottomElement = targetRect.bottom > vh - NAV_HEIGHT - 100 || isNavigation;
    
    if (isBottomElement) {
      // Tooltip сверху от элемента, не перекрывая его
      const maxTop = targetRect.top - GAP - 10; // Нижняя граница tooltip
      let top = maxTop - TOOLTIP_HEIGHT;
      if (top < PADDING) top = PADDING;
      
      // Ограничиваем высоту чтобы не залезать на элемент
      const maxHeight = maxTop - top;
      
      return {
        top,
        left,
        width: tooltipWidth,
        maxHeight,
        position: 'above' as const,
      };
    }

    // Tooltip снизу от элемента
    const top = targetRect.bottom + GAP;
    
    return {
      top,
      left,
      width: tooltipWidth,
      position: 'below' as const,
    };
  };

  const tooltipPos = getTooltipPosition();
  
  // Стрелка
  const getArrowStyle = (): React.CSSProperties | null => {
    if (!targetRect || tooltipPos.position === 'center') return null;
    
    const elementCenterX = targetRect.left + targetRect.width / 2;
    const arrowLeft = Math.max(24, Math.min(tooltipPos.width - 24, elementCenterX - tooltipPos.left));
    
    if (tooltipPos.position === 'above') {
      return {
        position: 'absolute',
        bottom: -10,
        left: arrowLeft,
        transform: 'translateX(-50%) rotate(45deg)',
        width: 12,
        height: 12,
        background: 'linear-gradient(135deg, transparent 50%, #1a0a0a 50%)',
        borderRight: '1px solid rgba(127, 29, 29, 0.3)',
        borderBottom: '1px solid rgba(127, 29, 29, 0.3)',
      };
    }
    
    return {
      position: 'absolute',
      top: -10,
      left: arrowLeft,
      transform: 'translateX(-50%) rotate(-135deg)',
      width: 12,
      height: 12,
      background: 'linear-gradient(135deg, transparent 50%, #1a0a0a 50%)',
      borderRight: '1px solid rgba(127, 29, 29, 0.3)',
      borderBottom: '1px solid rgba(127, 29, 29, 0.3)',
    };
  };

  return (
    <AnimatePresence>
      {isVisible && isReady && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999]"
        >
          {/* Затемнение с вырезом */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="tour-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && step.spotlight && (
                  <rect
                    x={targetRect.left - 8}
                    y={targetRect.top - 8}
                    width={targetRect.width + 16}
                    height={targetRect.height + 16}
                    rx="16"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0" y="0"
              width="100%" height="100%"
              fill="rgba(0, 0, 0, 0.88)"
              mask="url(#tour-mask)"
            />
          </svg>

          {/* Подсветка элемента */}
          {targetRect && step.spotlight && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                boxShadow: [
                  '0 0 20px rgba(220, 38, 38, 0.5)',
                  '0 0 40px rgba(220, 38, 38, 0.7)',
                  '0 0 20px rgba(220, 38, 38, 0.5)'
                ]
              }}
              transition={{ boxShadow: { duration: 1.5, repeat: Infinity } }}
              className="absolute pointer-events-none rounded-2xl border-2 border-red-500/60"
              style={{
                left: targetRect.left - 10,
                top: targetRect.top - 10,
                width: targetRect.width + 20,
                height: targetRect.height + 20,
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            key={step.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              width: tooltipPos.width,
              maxHeight: tooltipPos.maxHeight,
              overflow: tooltipPos.maxHeight ? 'auto' : undefined,
            }}
          >
            <div className="relative rounded-2xl bg-gradient-to-br from-[#1a0a0a] via-[#1a1a2e] to-[#0a0a12] border border-red-900/40 shadow-2xl overflow-hidden">
              {/* Прогресс */}
              <div className="h-1 bg-black/50">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>

              <div className="p-4">
                {/* Индикатор шага */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-red-500/80 uppercase tracking-wider">
                    {currentStep + 1} / {TOUR_STEPS.length}
                  </span>
                  <div className="flex gap-1">
                    {TOUR_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i === currentStep ? 'bg-red-500' : i < currentStep ? 'bg-red-800' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Заголовок */}
                <h3 className="text-[15px] font-black text-white mb-2">
                  {step.title}
                </h3>

                {/* Контент */}
                <p className="text-[12px] text-white/75 leading-relaxed whitespace-pre-line">
                  {step.content}
                </p>

                {/* Кнопки */}
                <div className="flex gap-2 mt-4">
                  {!isFirst && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handlePrev}
                      className="flex-1 h-9 rounded-xl bg-white/10 text-white/80 text-[12px] font-semibold"
                    >
                      ← Назад
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNext}
                    className="flex-1 h-9 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white text-[12px] font-bold shadow-lg"
                  >
                    {isLast ? 'Начать! 🔪' : 'Далее →'}
                  </motion.button>
                </div>

                {!isLast && (
                  <button
                    onClick={handleSkip}
                    className="w-full mt-2 text-[10px] text-white/40 hover:text-white/60"
                  >
                    Пропустить
                  </button>
                )}
              </div>
            </div>

            {/* Стрелка */}
            {getArrowStyle() && <div style={getArrowStyle()!} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GuidedTour;
