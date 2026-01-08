"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
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
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Уникальный ID для SVG mask (избегаем конфликтов)
  const maskId = useId();

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  // Адаптивные константы
  const PADDING = Math.max(12, Math.min(16, viewport.width * 0.04));
  const NAV_HEIGHT = 90; // Высота нижней навигации + отступ
  const GAP = 16;
  const SAFE_AREA_TOP = 44; // iPhone notch

  // Отслеживаем размеры viewport (для всех устройств)
  useEffect(() => {
    const updateViewport = () => {
      // visualViewport даёт точные размеры с учётом клавиатуры и UI браузера
      const vv = window.visualViewport;
      setViewport({
        width: vv?.width || window.innerWidth,
        height: vv?.height || window.innerHeight,
      });
    };
    
    updateViewport();
    
    // Слушаем все возможные изменения размера
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

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

  // Найти scroll-контейнер (в layout это div с overflow-y-auto)
  const getScrollContainer = useCallback((): HTMLElement => {
    // Ищем контейнер с overflow-y-auto внутри app-container
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      const scrollable = appContainer.querySelector('[class*="overflow-y-auto"]') as HTMLElement;
      if (scrollable) return scrollable;
    }
    // Fallback на documentElement
    return document.documentElement;
  }, []);

  // Проскроллить к элементу и показать tooltip
  const scrollAndShow = useCallback(() => {
    setIsReady(false);
    
    const scrollContainer = getScrollContainer();
    
    // Для центральных шагов (welcome/finish) — скроллим вверх и показываем
    if (!step?.spotlight || step.position === 'center') {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setIsReady(true), 400);
      return;
    }

    // Ждём немного чтобы DOM обновился
    setTimeout(() => {
      const el = getTargetElement();
      if (!el) {
        // Элемент не найден — пробуем ещё раз
        setTimeout(() => {
          const retryEl = getTargetElement();
          if (retryEl) {
            doScrollToElement(retryEl);
          } else {
            console.warn(`[Tour] Skipping step ${step.id}: element not found`);
            setCurrentStep(prev => Math.min(prev + 1, TOUR_STEPS.length - 1));
          }
        }, 300);
        return;
      }

      doScrollToElement(el);
    }, 100);
    
    function doScrollToElement(el: HTMLElement) {
      // Используем scrollIntoView — работает с любым scroll-контейнером!
      const isNavigation = step?.id === 'navigation';
      
      // scrollIntoView с block: 'start' или 'end' в зависимости от элемента
      el.scrollIntoView({
        behavior: 'smooth',
        block: isNavigation ? 'end' : 'start',
        inline: 'nearest'
      });
      
      // После скролла корректируем позицию и показываем tooltip
      setTimeout(() => {
        // Для не-навигации делаем небольшую корректировку вверх
        // чтобы было место для tooltip снизу
        if (!isNavigation) {
          const rect = el.getBoundingClientRect();
          // Если элемент слишком близко к верху — корректируем
          if (rect.top < 60) {
            scrollContainer.scrollBy({ top: rect.top - 80, behavior: 'smooth' });
          }
        }
        
        setTimeout(() => {
          updateRect();
          setIsReady(true);
        }, 100);
      }, 400);
    }
  }, [step, getTargetElement, updateRect, getScrollContainer]);

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
    const vh = viewport.height || window.innerHeight;
    const vw = viewport.width || window.innerWidth;
    
    // Адаптивная ширина tooltip
    const tooltipWidth = Math.min(320, Math.max(280, vw - PADDING * 2));
    const tooltipEstimatedHeight = 300;

    // Центральный tooltip (welcome/finish)
    if (step.position === 'center') {
      const safeHeight = vh - NAV_HEIGHT - SAFE_AREA_TOP;
      const centerY = SAFE_AREA_TOP + safeHeight / 2;
      
      return {
        top: Math.max(SAFE_AREA_TOP + PADDING, centerY - tooltipEstimatedHeight / 2),
        left: Math.max(PADDING, (vw - tooltipWidth) / 2),
        width: tooltipWidth,
        position: 'center' as const,
      };
    }
    
    // Если нет targetRect — центрируем
    if (!targetRect) {
      const safeHeight = vh - NAV_HEIGHT - SAFE_AREA_TOP;
      const centerY = SAFE_AREA_TOP + safeHeight / 2;
      
      return {
        top: Math.max(SAFE_AREA_TOP + PADDING, centerY - tooltipEstimatedHeight / 2),
        left: Math.max(PADDING, (vw - tooltipWidth) / 2),
        width: tooltipWidth,
        position: 'center' as const,
      };
    }

    // Центрируем по горизонтали относительно элемента
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    left = Math.max(PADDING, Math.min(vw - tooltipWidth - PADDING, left));

    // Вычисляем доступное пространство сверху и снизу
    const spaceAbove = targetRect.top - SAFE_AREA_TOP - GAP;
    const spaceBelow = vh - targetRect.bottom - NAV_HEIGHT - GAP;
    
    // Для навигации или если мало места снизу — tooltip СВЕРХУ
    const isNavigation = step.id === 'navigation';
    const preferAbove = isNavigation || spaceBelow < 200 || targetRect.bottom > vh - NAV_HEIGHT - 120;
    
    if (preferAbove && spaceAbove > 150) {
      // Tooltip сверху от элемента
      // Для навигации — больше отступ чтобы не перекрывать кнопки
      const extraGap = isNavigation ? 120 : 0;
      const maxHeight = Math.min(spaceAbove - PADDING - extraGap, 380);
      const top = Math.max(SAFE_AREA_TOP + PADDING, targetRect.top - GAP - extraGap - Math.min(maxHeight, tooltipEstimatedHeight));
      
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
    const maxHeight = Math.min(vh - top - NAV_HEIGHT - PADDING, 400);
    
    // Проверка что tooltip не вылезет за экран снизу
    if (maxHeight < 150) {
      // Мало места — центрируем
      const safeHeight = vh - NAV_HEIGHT - SAFE_AREA_TOP;
      const centerY = SAFE_AREA_TOP + safeHeight / 2;
      
      return {
        top: Math.max(SAFE_AREA_TOP + PADDING, centerY - tooltipEstimatedHeight / 2),
        left: Math.max(PADDING, (vw - tooltipWidth) / 2),
        width: tooltipWidth,
        position: 'center' as const,
      };
    }
    
    return {
      top,
      left,
      width: tooltipWidth,
      maxHeight,
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

  const vh = viewport.height || '100vh';
  const vw = viewport.width || '100vw';

  return (
    <AnimatePresence>
      {isVisible && isReady && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999]"
          style={{ 
            height: vh,
            width: vw,
            // Блокируем взаимодействие с фоном
            touchAction: 'none',
          }}
        >
          {/* Затемнение с вырезом */}
          <svg 
            className="absolute inset-0 pointer-events-none" 
            style={{ width: '100%', height: '100%' }}
            viewBox={`0 0 ${viewport.width || window.innerWidth} ${viewport.height || window.innerHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <mask id={maskId}>
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
              fill="rgba(0, 0, 0, 0.9)"
              mask={`url(#${maskId})`}
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
              WebkitOverflowScrolling: 'touch',
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
