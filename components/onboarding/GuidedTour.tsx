"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TOUR_STEPS, markTourCompleted, type TourStep } from "./tourSteps";
import { haptic } from "@/lib/haptic";

type GuidedTourProps = {
  onComplete?: () => void;
  onSkip?: () => void;
};

export function GuidedTour({ onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  // Отслеживаем размер окна
  useEffect(() => {
    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Найти и отследить целевой элемент
  const updateTargetPosition = useCallback(() => {
    if (!step) return;
    
    const target = document.querySelector(step.target);
    if (target && step.spotlight) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    // Первоначальное обновление
    updateTargetPosition();
    
    // Периодическое обновление для динамических элементов
    const intervalId = setInterval(updateTargetPosition, 200);

    // Следим за изменениями размера
    observerRef.current = new ResizeObserver(updateTargetPosition);
    const target = document.querySelector(step?.target || '');
    if (target) {
      observerRef.current.observe(target);
    }

    // Также следим за скроллом
    window.addEventListener('scroll', updateTargetPosition, true);
    window.addEventListener('resize', updateTargetPosition);

    return () => {
      clearInterval(intervalId);
      observerRef.current?.disconnect();
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.removeEventListener('resize', updateTargetPosition);
    };
  }, [step, updateTargetPosition]);

  // Умный скролл к элементу с учётом tooltip
  useEffect(() => {
    if (!step?.spotlight) return;
    
    const target = document.querySelector(step.target) as HTMLElement;
    if (!target) return;

    const scrollToElement = () => {
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const bottomNavHeight = 80;
      const tooltipHeight = 380; // Примерная высота tooltip
      const padding = 20;
      
      // Проверяем, виден ли элемент
      const isVisible = rect.top >= padding && rect.bottom <= viewportHeight - bottomNavHeight - padding;
      
      if (!isVisible) {
        // Вычисляем оптимальную позицию скролла
        let scrollTarget: ScrollLogicalPosition = 'center';
        
        // Если tooltip будет сверху — скроллим так, чтобы элемент был внизу видимой области
        if (step.position === 'top') {
          scrollTarget = 'end';
        } 
        // Если tooltip будет снизу — скроллим так, чтобы элемент был вверху
        else if (step.position === 'bottom') {
          scrollTarget = 'start';
        }
        
        target.scrollIntoView({ 
          behavior: 'smooth', 
          block: scrollTarget,
          inline: 'nearest'
        });
      }
      
      // Обновляем позицию после скролла
      setTimeout(updateTargetPosition, 400);
    };

    // Небольшая задержка чтобы DOM успел обновиться
    const timeoutId = setTimeout(scrollToElement, 150);
    
    return () => clearTimeout(timeoutId);
  }, [step, updateTargetPosition]);

  const handleNext = useCallback(() => {
    haptic.light();
    if (isLast) {
      markTourCompleted();
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 300);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLast, onComplete]);

  const handlePrev = useCallback(() => {
    haptic.light();
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirst]);

  const handleSkip = useCallback(() => {
    haptic.medium();
    markTourCompleted();
    setIsVisible(false);
    setTimeout(() => onSkip?.(), 300);
  }, [onSkip]);

  if (!step) return null;

  // Безопасные отступы
  const PADDING = 16;
  const BOTTOM_NAV_HEIGHT = 80; // Высота нижней навигации + safe area
  const TOOLTIP_WIDTH = Math.min(300, windowSize.width - PADDING * 2);
  const ARROW_SIZE = 12;
  const GAP = 24; // Увеличенный отступ между элементом и tooltip

  // Позиция tooltip с учётом границ экрана
  const getTooltipStyle = (): React.CSSProperties => {
    // Центрированный tooltip (для welcome/finish)
    if (!targetRect || step.position === 'center') {
      const centeredLeft = Math.max(PADDING, (windowSize.width - TOOLTIP_WIDTH) / 2);
      return {
        position: 'fixed',
        top: '50%',
        left: centeredLeft,
        transform: 'translateY(-50%)',
        width: TOOLTIP_WIDTH,
      };
    }

    const viewportHeight = windowSize.height;
    const viewportWidth = windowSize.width;
    
    // Доступная высота с учётом нижней навигации
    const safeViewportHeight = viewportHeight - BOTTOM_NAV_HEIGHT;
    
    // Компактная высота tooltip
    const estimatedTooltipHeight = Math.min(280, safeViewportHeight * 0.45);

    let top: number;
    let left: number;
    let actualPosition = step.position;

    // Вычисляем позицию слева (центрируем относительно элемента)
    left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
    
    // Корректируем чтобы не выходило за границы по горизонтали
    left = Math.max(PADDING, Math.min(viewportWidth - TOOLTIP_WIDTH - PADDING, left));

    // Свободное место сверху и снизу от элемента
    const spaceAbove = targetRect.top - PADDING;
    const spaceBelow = safeViewportHeight - targetRect.bottom - PADDING;
    
    // Выбираем оптимальную позицию (там где больше места)
    const preferTop = spaceAbove > spaceBelow;
    
    // Если предпочтительная позиция - сверху и там достаточно места
    if (preferTop && spaceAbove >= estimatedTooltipHeight + GAP) {
      top = targetRect.top - estimatedTooltipHeight - GAP;
      actualPosition = 'top';
    }
    // Если снизу достаточно места
    else if (!preferTop && spaceBelow >= estimatedTooltipHeight + GAP) {
      top = targetRect.bottom + GAP;
      actualPosition = 'bottom';
    }
    // Если сверху есть хоть какое-то место
    else if (spaceAbove > spaceBelow) {
      top = Math.max(PADDING, targetRect.top - estimatedTooltipHeight - GAP);
      actualPosition = 'top';
    }
    // Иначе снизу
    else {
      top = targetRect.bottom + GAP;
      actualPosition = 'bottom';
    }

    // Финальная корректировка — tooltip не должен перекрывать элемент
    if (actualPosition === 'top' && top + estimatedTooltipHeight > targetRect.top - 8) {
      top = Math.max(PADDING, targetRect.top - estimatedTooltipHeight - GAP);
    }
    if (actualPosition === 'bottom' && top < targetRect.bottom + 8) {
      top = targetRect.bottom + GAP;
    }
    
    // Гарантируем что не выходит за границы
    top = Math.max(PADDING, Math.min(safeViewportHeight - estimatedTooltipHeight - PADDING, top));

    return {
      position: 'fixed',
      top,
      left,
      width: TOOLTIP_WIDTH,
      maxWidth: `calc(100vw - ${PADDING * 2}px)`,
    };
  };

  // Позиция стрелки
  const getArrowStyle = (): React.CSSProperties | null => {
    if (!targetRect || step.position === 'center') return null;

    const tooltipStyle = getTooltipStyle();
    const tooltipLeft = typeof tooltipStyle.left === 'number' ? tooltipStyle.left : 0;
    const tooltipTop = typeof tooltipStyle.top === 'number' ? tooltipStyle.top : 0;
    
    // Центр элемента
    const elementCenterX = targetRect.left + targetRect.width / 2;
    
    // Позиция стрелки относительно tooltip
    const arrowLeft = Math.max(20, Math.min(TOOLTIP_WIDTH - 20, elementCenterX - tooltipLeft));
    
    // Определяем направление стрелки
    const isAbove = tooltipTop < targetRect.top;

    if (isAbove) {
      // Tooltip сверху — стрелка внизу указывает вниз
      return {
        position: 'absolute',
        bottom: -ARROW_SIZE + 2,
        left: arrowLeft,
        transform: 'translateX(-50%) rotate(45deg)',
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        background: 'linear-gradient(135deg, transparent 50%, #1a0a0a 50%)',
        borderRight: '1px solid rgba(127, 29, 29, 0.3)',
        borderBottom: '1px solid rgba(127, 29, 29, 0.3)',
      };
    } else {
      // Tooltip снизу — стрелка сверху указывает вверх
      return {
        position: 'absolute',
        top: -ARROW_SIZE + 2,
        left: arrowLeft,
        transform: 'translateX(-50%) rotate(-135deg)',
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        background: 'linear-gradient(135deg, transparent 50%, #1a0a0a 50%)',
        borderRight: '1px solid rgba(127, 29, 29, 0.3)',
        borderBottom: '1px solid rgba(127, 29, 29, 0.3)',
      };
    }
  };

  const arrowStyle = getArrowStyle();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999]"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Overlay с вырезом под spotlight */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && step.spotlight && (
                  <motion.rect
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
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
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.9)"
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Spotlight border glow with pulse animation */}
          {targetRect && step.spotlight && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                boxShadow: [
                  '0 0 20px rgba(220, 38, 38, 0.4), inset 0 0 15px rgba(220, 38, 38, 0.1)',
                  '0 0 40px rgba(220, 38, 38, 0.6), inset 0 0 25px rgba(220, 38, 38, 0.2)',
                  '0 0 20px rgba(220, 38, 38, 0.4), inset 0 0 15px rgba(220, 38, 38, 0.1)'
                ]
              }}
              transition={{
                boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              }}
              className="absolute pointer-events-none"
              style={{
                left: targetRect.left - 10,
                top: targetRect.top - 10,
                width: targetRect.width + 20,
                height: targetRect.height + 20,
                borderRadius: 18,
                border: '2px solid rgba(220, 38, 38, 0.6)',
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            key={step.id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={getTooltipStyle()}
          >
            {/* Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a0a0a] via-[#1a1a2e] to-[#0a0a12] border border-red-900/30 shadow-2xl">
              {/* Blood drip effect top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-900 via-red-600 to-red-900" />
              
              {/* Progress bar */}
              <div className="h-1 bg-black/50">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Content */}
              <div className="p-3">
                {/* Step indicator */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-red-500/80 uppercase tracking-wider">
                    Шаг {currentStep + 1} из {TOUR_STEPS.length}
                  </span>
                  <div className="flex gap-0.5">
                    {TOUR_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 rounded-full transition-colors ${
                          i === currentStep
                            ? 'bg-red-500'
                            : i < currentStep
                              ? 'bg-red-900'
                              : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-[13px] font-black text-white mb-1.5 leading-tight">
                  {step.title}
                </h3>

                {/* Content with scroll if needed */}
                <div className="max-h-[25vh] overflow-y-auto scrollbar-thin scrollbar-thumb-red-900/50 scrollbar-track-transparent pr-1">
                  <p className="text-[10px] text-white/70 leading-relaxed whitespace-pre-line">
                    {step.content}
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  {!isFirst && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePrev}
                      className="flex-1 h-8 rounded-lg bg-white/10 border border-white/10 text-white/70 text-[11px] font-semibold hover:bg-white/15 transition-colors"
                    >
                      ← Назад
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNext}
                    className="flex-1 h-8 rounded-lg bg-gradient-to-r from-red-700 to-red-600 text-white text-[11px] font-bold shadow-lg shadow-red-900/30 hover:from-red-600 hover:to-red-500 transition-colors"
                  >
                    {isLast ? 'Погнали! 🔪' : 'Далее →'}
                  </motion.button>
                </div>

                {/* Skip button */}
                {!isLast && (
                  <button
                    onClick={handleSkip}
                    className="w-full mt-1.5 text-center text-[9px] text-white/40 hover:text-white/60 transition-colors py-0.5"
                  >
                    Пропустить обучение
                  </button>
                )}
              </div>
            </div>

            {/* Arrow pointer */}
            {arrowStyle && <div style={arrowStyle} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GuidedTour;
