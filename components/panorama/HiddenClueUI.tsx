"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HIDDEN CLUE UI COMPONENTS
 * Компоненты для системы скрытых улик
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptic";
import type { HiddenClue, ClueRuntimeState } from "@/types/hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// REVEAL PROGRESS INDICATOR
// Показывает прогресс обнаружения когда игрок смотрит в нужную сторону
// ═══════════════════════════════════════════════════════════════════════════

interface RevealProgressProps {
  clue: HiddenClue | null;
  progress: number; // 0-1
}

export function RevealProgress({ clue, progress }: RevealProgressProps) {
  if (!clue || progress === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
    >
      {/* Круговой прогресс */}
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Фоновый круг */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="6"
          />
          {/* Прогресс */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${progress * 283} 283`}
            className="transition-all duration-100"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Иконка в центре */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span 
            className="text-3xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            👁️
          </motion.span>
        </div>
      </div>
      
      {/* Текст */}
      <p className="text-center text-white/80 text-sm mt-2 font-medium">
        Обнаружение...
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVEALED CLUE MARKER
// Маркер обнаруженной улики (показывается только после reveal)
// ═══════════════════════════════════════════════════════════════════════════

interface RevealedClueMarkerProps {
  clue: HiddenClue;
  state: ClueRuntimeState;
  onCollect: () => void;
}

export function RevealedClueMarker({ clue, state, onCollect }: RevealedClueMarkerProps) {
  if (state.state !== "revealed") return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0 }}
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-30"
    >
      <motion.button
        onClick={() => {
          haptic.medium();
          onCollect();
        }}
        className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl shadow-lg shadow-emerald-500/30 border border-white/20"
        whileTap={{ scale: 0.95 }}
        animate={{
          boxShadow: [
            "0 10px 40px rgba(16, 185, 129, 0.3)",
            "0 10px 60px rgba(16, 185, 129, 0.5)",
            "0 10px 40px rgba(16, 185, 129, 0.3)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-3xl">{clue.icon}</span>
        <div className="text-left">
          <p className="text-white font-bold">{clue.name}</p>
          <p className="text-white/70 text-sm">Нажми чтобы собрать</p>
        </div>
        <div className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
          +{clue.xpReward} XP
        </div>
      </motion.button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE COLLECTION MODAL
// Модальное окно после сбора улики
// ═══════════════════════════════════════════════════════════════════════════

interface ClueCollectionModalProps {
  clue: HiddenClue | null;
  onClose: () => void;
}

export function ClueCollectionModal({ clue, onClose }: ClueCollectionModalProps) {
  if (!clue) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-4xl shadow-lg">
            {clue.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-lg">✓</span>
              <h3 className="text-lg font-bold text-white">{clue.name}</h3>
            </div>
            <p className="text-sm text-white/60 mt-1">{clue.description}</p>
          </div>
        </div>
        
        {/* Story context */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
            📋 Заметка детектива
          </p>
          <p className="text-white/90 text-sm leading-relaxed">
            {clue.storyContext}
          </p>
        </div>
        
        {/* XP */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-2xl">⭐</span>
          <span className="text-xl font-bold text-yellow-400">+{clue.xpReward} XP</span>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
        >
          Продолжить расследование
        </button>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOFT HINT FLASH
// Мягкая подсказка — блик на экране
// ═══════════════════════════════════════════════════════════════════════════

interface SoftHintFlashProps {
  visible: boolean;
}

export function SoftHintFlash({ visible }: SoftHintFlashProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 pointer-events-none z-20"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.3), transparent 70%)",
          }}
        />
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCANNER HINT POPUP
// Подсказка сканера
// ═══════════════════════════════════════════════════════════════════════════

interface ScannerHintProps {
  text: string | null;
  onDismiss: () => void;
}

export function ScannerHint({ text, onDismiss }: ScannerHintProps) {
  useEffect(() => {
    if (text) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [text, onDismiss]);
  
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-24 left-4 right-4 z-50 pointer-events-none"
        >
          <div className="bg-cyan-500/20 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📡</span>
              <div className="flex-1">
                <p className="text-xs text-cyan-400 uppercase tracking-wider mb-1">
                  Сканер
                </p>
                <p className="text-white/90 text-sm">{text}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE COUNTER
// Счётчик найденных улик
// ═══════════════════════════════════════════════════════════════════════════

interface ClueCounterProps {
  found: number;
  total: number;
  required: number;
}

export function ClueCounter({ found, total, required }: ClueCounterProps) {
  const isComplete = found >= required;
  
  return (
    <div className={`
      h-11 px-4 rounded-2xl backdrop-blur-md border flex items-center gap-2
      ${isComplete 
        ? "bg-green-500/15 border-green-500/30" 
        : "bg-white/10 border-white/20"}
    `}>
      <span className="text-lg">{isComplete ? "✅" : "🔍"}</span>
      <span className={`text-sm font-bold ${isComplete ? "text-green-400" : "text-white"}`}>
        {found}/{required}
      </span>
      {found < total && !isComplete && (
        <span className="text-xs text-white/50">
          (ещё {total - found} скрыто)
        </span>
      )}
    </div>
  );
}

