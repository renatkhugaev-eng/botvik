"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE CHECKLIST COMPONENT
 * Список найденных улик (скрытые показываются как "???")
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { motion, AnimatePresence } from "framer-motion";
import type { PanoramaClue } from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClueChecklistProps {
  clues: PanoramaClue[];
  foundClueIds: string[];
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE ITEM
// ═══════════════════════════════════════════════════════════════════════════

function ClueItem({
  clue,
  isFound,
  index,
}: {
  clue: PanoramaClue;
  isFound: boolean;
  index: number;
}) {
  // Скрытые улики показываем как "???"
  if (!isFound) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0 bg-white/10 text-white/30">
          ?
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white/40">
            Улика #{index + 1}
          </span>
          <p className="text-xs text-white/30 mt-0.5">
            Ещё не найдена...
          </p>
        </div>
        <div className="text-xs font-medium px-2 py-1 rounded-full shrink-0 bg-white/10 text-white/40">
          ???
        </div>
      </div>
    );
  }
  
  // Найденные улики показываем полностью
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-green-500/20 border border-green-500/30"
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0 bg-green-500/30 text-green-400">
        ✓
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-green-400">
          {clue.name}
        </span>
        {clue.description && (
          <p className="text-xs text-green-400/70 truncate mt-0.5">
            {clue.description}
          </p>
        )}
      </div>
      {clue.xpReward && (
        <div className="text-xs font-medium px-2 py-1 rounded-full shrink-0 bg-green-500/20 text-green-400">
          +{clue.xpReward} XP
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ClueChecklist({
  clues,
  foundClueIds,
  className = "",
  collapsed = false,
  onToggleCollapse,
}: ClueChecklistProps) {
  const foundCount = foundClueIds.length;
  const totalCount = clues.length;
  const progress = totalCount > 0 ? (foundCount / totalCount) * 100 : 0;
  
  return (
    <div className={`bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">📋</div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">Улики</h3>
            <p className="text-xs text-white/60">
              Найдено: {foundCount} / {totalCount}
            </p>
          </div>
        </div>
        
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
          className="text-white/60"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      
      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
      
      {/* Clue list */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-2 max-h-[40vh] overflow-y-auto">
              {clues.map((clue, index) => {
                const isFound = foundClueIds.includes(clue.id);
                
                return (
                  <ClueItem
                    key={clue.id}
                    clue={clue}
                    isFound={isFound}
                    index={index}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

