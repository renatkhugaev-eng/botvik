"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLUE CHECKLIST COMPONENT
 * Интерактивный чек-лист улик для панорамной миссии
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { motion, AnimatePresence } from "framer-motion";
import type { PanoramaClue, CameraDirection } from "@/types/panorama";
import { getClueDirection } from "@/lib/panorama-utils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClueChecklistProps {
  clues: PanoramaClue[];
  foundClueIds: string[];
  cameraDirection: CameraDirection;
  activeClueId?: string | null;
  onClueSelect?: (clueId: string) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

function DirectionIndicator({ 
  direction 
}: { 
  direction: "left" | "right" | "behind" | "ahead" | null 
}) {
  if (!direction || direction === "ahead") return null;
  
  const arrows = {
    left: "←",
    right: "→",
    behind: "↩",
  };
  
  return (
    <span className="text-xs text-blue-400 ml-1">
      {arrows[direction]}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE ITEM
// ═══════════════════════════════════════════════════════════════════════════

function ClueItem({
  clue,
  isFound,
  isActive,
  direction,
  onClick,
}: {
  clue: PanoramaClue;
  isFound: boolean;
  isActive: boolean;
  direction: "left" | "right" | "behind" | "ahead" | null;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
        ${isFound 
          ? "bg-green-500/20 border-green-500/30" 
          : isActive
            ? "bg-blue-500/20 border-blue-500/40 ring-2 ring-blue-500/30"
            : "bg-white/5 border-white/10 hover:bg-white/10"
        }
        border
      `}
      whileTap={{ scale: 0.98 }}
    >
      {/* Status icon */}
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0
        ${isFound 
          ? "bg-green-500/30 text-green-400" 
          : "bg-white/10 text-white/60"
        }
      `}>
        {isFound ? "✓" : clue.icon || "🔍"}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`
            text-sm font-medium truncate
            ${isFound ? "text-green-400 line-through" : "text-white"}
          `}>
            {clue.name}
          </span>
          {!isFound && <DirectionIndicator direction={direction} />}
        </div>
        
        {clue.hint && !isFound && (
          <p className="text-xs text-white/50 truncate mt-0.5">
            {clue.hint}
          </p>
        )}
        
        {isFound && clue.description && (
          <p className="text-xs text-green-400/70 truncate mt-0.5">
            {clue.description}
          </p>
        )}
      </div>
      
      {/* XP reward */}
      {clue.xpReward && (
        <div className={`
          text-xs font-medium px-2 py-1 rounded-full shrink-0
          ${isFound 
            ? "bg-green-500/20 text-green-400" 
            : "bg-yellow-500/20 text-yellow-400"
          }
        `}>
          +{clue.xpReward} XP
        </div>
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ClueChecklist({
  clues,
  foundClueIds,
  cameraDirection,
  activeClueId,
  onClueSelect,
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
              {clues.map((clue) => {
                const isFound = foundClueIds.includes(clue.id);
                const isActive = activeClueId === clue.id;
                const direction = isFound ? null : getClueDirection(clue, cameraDirection[0]);
                
                return (
                  <ClueItem
                    key={clue.id}
                    clue={clue}
                    isFound={isFound}
                    isActive={isActive}
                    direction={direction}
                    onClick={() => onClueSelect?.(clue.id)}
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

