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
  const observerRef = useRef<ResizeObserver | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

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
    updateTargetPosition();

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
      observerRef.current?.disconnect();
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.removeEventListener('resize', updateTargetPosition);
    };
  }, [step, updateTargetPosition]);

  // Скролл к элементу
  useEffect(() => {
    if (!step?.spotlight) return;
    
    const target = document.querySelector(step.target);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step]);

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

  // Позиция tooltip
  const getTooltipPosition = () => {
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const tooltipHeight = 280;
    const tooltipWidth = 320;

    switch (step.position) {
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))}px`,
        };
      case 'top':
        return {
          top: `${Math.max(padding, targetRect.top - tooltipHeight - padding)}px`,
          left: `${Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))}px`,
        };
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`,
          left: `${Math.max(padding, targetRect.left - tooltipWidth - padding)}px`,
        };
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`,
          left: `${targetRect.right + padding}px`,
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

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
              fill="rgba(0, 0, 0, 0.85)"
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Spotlight border glow */}
          {targetRect && step.spotlight && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute pointer-events-none"
              style={{
                left: targetRect.left - 10,
                top: targetRect.top - 10,
                width: targetRect.width + 20,
                height: targetRect.height + 20,
                borderRadius: 18,
                border: '2px solid rgba(220, 38, 38, 0.6)',
                boxShadow: '0 0 30px rgba(220, 38, 38, 0.4), inset 0 0 20px rgba(220, 38, 38, 0.1)',
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            key={step.id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute w-[320px] max-w-[calc(100vw-32px)]"
            style={getTooltipPosition()}
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
              <div className="p-5">
                {/* Step indicator */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-red-500/80 uppercase tracking-wider">
                    Шаг {currentStep + 1} из {TOUR_STEPS.length}
                  </span>
                  <div className="flex gap-1">
                    {TOUR_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
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
                <h3 className="text-[17px] font-black text-white mb-3 leading-tight">
                  {step.title}
                </h3>

                {/* Content */}
                <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-line">
                  {step.content}
                </p>

                {/* Buttons */}
                <div className="flex items-center gap-2 mt-5">
                  {!isFirst && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePrev}
                      className="flex-1 h-11 rounded-xl bg-white/10 border border-white/10 text-white/70 text-[13px] font-semibold hover:bg-white/15 transition-colors"
                    >
                      ← Назад
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNext}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white text-[13px] font-bold shadow-lg shadow-red-900/30 hover:from-red-600 hover:to-red-500 transition-colors"
                  >
                    {isLast ? 'Погнали! 🔪' : 'Далее →'}
                  </motion.button>
                </div>

                {/* Skip button */}
                {!isLast && (
                  <button
                    onClick={handleSkip}
                    className="w-full mt-3 text-center text-[11px] text-white/40 hover:text-white/60 transition-colors"
                  >
                    Пропустить обучение
                  </button>
                )}
              </div>

              {/* Decorative skull watermark */}
              <div className="absolute -bottom-4 -right-4 text-6xl opacity-5 pointer-events-none select-none">
                💀
              </div>
            </div>

            {/* Arrow pointer */}
            {targetRect && step.spotlight && step.position !== 'center' && (
              <div
                className="absolute w-4 h-4 bg-[#1a0a0a] border-l border-t border-red-900/30 rotate-45"
                style={{
                  ...(step.position === 'bottom' && { top: -8, left: '50%', marginLeft: -8 }),
                  ...(step.position === 'top' && { bottom: -8, left: '50%', marginLeft: -8, transform: 'rotate(-135deg)' }),
                  ...(step.position === 'left' && { right: -8, top: '50%', marginTop: -8, transform: 'rotate(135deg)' }),
                  ...(step.position === 'right' && { left: -8, top: '50%', marginTop: -8, transform: 'rotate(-45deg)' }),
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GuidedTour;

