"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE DISCOVERY MODAL
 * Модальное окно при обнаружении улики с вопросами
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptic";
import type { PanoramaClue } from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClueDiscoveryModalProps {
  clue: PanoramaClue | null;
  onComplete: (clueId: string, isCorrect: boolean, answer?: string | number) => void;
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ClueDiscoveryModal({
  clue,
  onComplete,
  onClose,
}: ClueDiscoveryModalProps) {
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [countAnswer, setCountAnswer] = useState("");
  const [showResult, setShowResult] = useState<"correct" | "wrong" | null>(null);
  
  const resetState = useCallback(() => {
    setAnswer("");
    setSelectedOption(null);
    setCountAnswer("");
    setShowResult(null);
  }, []);
  
  const handleSubmit = useCallback(() => {
    if (!clue) return;
    
    let isCorrect = true;
    let userAnswer: string | number | undefined;
    
    switch (clue.type) {
      case "visual":
        // Просто нашёл — всегда правильно
        isCorrect = true;
        break;
        
      case "text":
        userAnswer = answer.trim().toLowerCase();
        if (Array.isArray(clue.answer)) {
          isCorrect = clue.answer.some(a => 
            a.toLowerCase() === userAnswer
          );
        } else if (clue.answer) {
          isCorrect = clue.answer.toLowerCase() === userAnswer;
        }
        break;
        
      case "count":
        userAnswer = parseInt(countAnswer);
        isCorrect = userAnswer === clue.correctCount;
        break;
        
      case "identify":
        userAnswer = selectedOption ?? -1;
        isCorrect = selectedOption === clue.correctOptionIndex;
        break;
    }
    
    // Показываем результат
    setShowResult(isCorrect ? "correct" : "wrong");
    haptic[isCorrect ? "success" : "error"]();
    
    // Закрываем через 1.5 секунды
    setTimeout(() => {
      onComplete(clue.id, isCorrect, userAnswer);
      resetState();
    }, 1500);
  }, [clue, answer, countAnswer, selectedOption, onComplete, resetState]);
  
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);
  
  if (!clue) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Result overlay */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 rounded-3xl flex items-center justify-center z-10 ${
                  showResult === "correct" 
                    ? "bg-green-500/90" 
                    : "bg-red-500/90"
                }`}
              >
                <div className="text-center text-white">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10 }}
                    className="text-6xl mb-2"
                  >
                    {showResult === "correct" ? "✅" : "❌"}
                  </motion.div>
                  <p className="text-xl font-bold">
                    {showResult === "correct" ? "Верно!" : "Неверно..."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg">
              {clue.icon || "🔍"}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{clue.name}</h3>
              {clue.description && (
                <p className="text-sm text-white/60 mt-1">{clue.description}</p>
              )}
            </div>
          </div>
          
          {/* Content based on type */}
          <div className="space-y-4">
            {/* Visual — just confirm */}
            {clue.type === "visual" && (
              <div className="text-center py-4">
                <p className="text-white/80">Улика найдена!</p>
                <p className="text-sm text-white/50 mt-1">
                  {clue.hint || "Это может пригодиться в расследовании"}
                </p>
              </div>
            )}
            
            {/* Text — free input */}
            {clue.type === "text" && clue.question && (
              <div>
                <p className="text-white font-medium mb-3">{clue.question}</p>
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Введи ответ..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  autoFocus
                />
              </div>
            )}
            
            {/* Count — number input */}
            {clue.type === "count" && clue.question && (
              <div>
                <p className="text-white font-medium mb-3">{clue.question}</p>
                <input
                  type="number"
                  value={countAnswer}
                  onChange={(e) => setCountAnswer(e.target.value)}
                  placeholder="Введи число..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 text-center text-2xl font-bold"
                  autoFocus
                />
              </div>
            )}
            
            {/* Identify — multiple choice */}
            {clue.type === "identify" && clue.options && (
              <div>
                <p className="text-white font-medium mb-3">{clue.question}</p>
                <div className="grid grid-cols-2 gap-2">
                  {clue.options.map((option, index) => (
                    <motion.button
                      key={index}
                      onClick={() => {
                        setSelectedOption(index);
                        haptic.light();
                      }}
                      className={`
                        p-3 rounded-xl text-sm font-medium transition-all border
                        ${selectedOption === index
                          ? "bg-blue-500 border-blue-400 text-white"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                        }
                      `}
                      whileTap={{ scale: 0.95 }}
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* XP reward */}
          {clue.xpReward && (
            <div className="mt-4 text-center">
              <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium">
                ⭐ +{clue.xpReward} XP за правильный ответ
              </span>
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 font-medium hover:bg-white/20 transition-colors"
            >
              Закрыть
            </button>
            <motion.button
              onClick={handleSubmit}
              disabled={
                (clue.type === "text" && !answer.trim()) ||
                (clue.type === "count" && !countAnswer) ||
                (clue.type === "identify" && selectedOption === null)
              }
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{ scale: 0.98 }}
            >
              {clue.type === "visual" ? "Отлично!" : "Ответить"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

