"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { investigationHaptic } from "@/lib/haptic";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

export type SuspectMood = 
  | "calm"        // Спокоен
  | "nervous"     // Нервничает
  | "defensive"   // Защищается
  | "relaxed"     // Расслаблен
  | "aggressive"  // Агрессивен
  | "broken"      // Сломлен
  | "cooperative" // Сотрудничает
  | "silent";     // Молчит

export type InterrogationState = {
  suspectId: string;
  suspectName: string;
  suspectMood: SuspectMood;
  rapport: number;        // 0-100: уровень доверия
  pressure: number;       // 0-100: уровень давления
  timeRemaining: number;  // Секунды до конца допроса
  maxTime: number;        // Максимальное время
  questionsAsked: number;
  cluesRevealed: string[];
  isConfessionObtained: boolean;
};

type InterrogationViewProps = {
  state: InterrogationState;
  onStateChange?: (state: InterrogationState) => void;
  onTimeUp?: () => void;
  onConfession?: () => void;
  isActive: boolean;
};

// ══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ══════════════════════════════════════════════════════════════════════════════

const MOOD_INFO: Record<SuspectMood, { 
  label: string; 
  emoji: string; 
  color: string;
  description: string;
}> = {
  calm: { 
    label: "Спокоен", 
    emoji: "😐", 
    color: "text-blue-400",
    description: "Подозреваемый держится уверенно",
  },
  nervous: { 
    label: "Нервничает", 
    emoji: "😰", 
    color: "text-amber-400",
    description: "Заметно волнуется, избегает взгляда",
  },
  defensive: { 
    label: "Защищается", 
    emoji: "🛡️", 
    color: "text-orange-400",
    description: "Закрылся, односложные ответы",
  },
  relaxed: { 
    label: "Расслаблен", 
    emoji: "😌", 
    color: "text-green-400",
    description: "Чувствует себя комфортно",
  },
  aggressive: { 
    label: "Агрессивен", 
    emoji: "😠", 
    color: "text-red-400",
    description: "Повышает голос, угрожает",
  },
  broken: { 
    label: "Сломлен", 
    emoji: "😢", 
    color: "text-purple-400",
    description: "Готов признаться во всём",
  },
  cooperative: { 
    label: "Сотрудничает", 
    emoji: "🤝", 
    color: "text-emerald-400",
    description: "Охотно отвечает на вопросы",
  },
  silent: { 
    label: "Молчит", 
    emoji: "🤐", 
    color: "text-gray-400",
    description: "Отказывается говорить",
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function InterrogationView({
  state,
  onStateChange,
  onTimeUp,
  onConfession,
  isActive,
}: InterrogationViewProps) {
  const [localTime, setLocalTime] = useState(state.timeRemaining);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const moodInfo = MOOD_INFO[state.suspectMood];
  const timePercentage = (localTime / state.maxTime) * 100;
  const isTimeLow = localTime < 60; // Меньше минуты

  // ══════════════════════════════════════════════════════════════════════════
  // ТАЙМЕР
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setLocalTime((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          investigationHaptic.gameOver();
          onTimeUp?.();
          return 0;
        }
        
        // Предупреждение за 30 секунд
        if (prev === 31) {
          investigationHaptic.timerWarning();
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, onTimeUp]);

  // Синхронизация с внешним state
  useEffect(() => {
    setLocalTime(state.timeRemaining);
  }, [state.timeRemaining]);

  // ══════════════════════════════════════════════════════════════════════════
  // ФОРМАТИРОВАНИЕ
  // ══════════════════════════════════════════════════════════════════════════

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-b from-slate-900/90 to-slate-800/90 border-b border-white/10 backdrop-blur-sm"
    >
      <div className="p-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
              🎭
            </div>
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider">Допрос</div>
              <div className="text-sm font-bold">{state.suspectName}</div>
            </div>
          </div>

          {/* Таймер */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            isTimeLow ? "bg-red-500/20" : "bg-white/10"
          }`}>
            <motion.div
              animate={isTimeLow ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1, repeat: isTimeLow ? Infinity : 0 }}
              className={`text-lg ${isTimeLow ? "text-red-400" : "text-white/70"}`}
            >
              ⏱️
            </motion.div>
            <span className={`font-mono font-bold ${isTimeLow ? "text-red-400" : "text-white"}`}>
              {formatTime(localTime)}
            </span>
          </div>
        </div>

        {/* Прогресс-бар времени */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-4">
          <motion.div
            className={`h-full ${
              isTimeLow ? "bg-red-500" : timePercentage < 50 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            initial={{ width: "100%" }}
            animate={{ width: `${timePercentage}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Состояние подозреваемого */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Настроение */}
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/40 mb-1">Настроение</div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{moodInfo.emoji}</span>
              <span className={`text-sm font-medium ${moodInfo.color}`}>
                {moodInfo.label}
              </span>
            </div>
          </div>

          {/* Доверие */}
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/40 mb-1">Доверие</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                  animate={{ width: `${state.rapport}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-xs text-emerald-400 font-bold w-8 text-right">
                {state.rapport}%
              </span>
            </div>
          </div>

          {/* Давление */}
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/40 mb-1">Давление</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${
                    state.pressure > 70 
                      ? "from-red-600 to-red-400" 
                      : "from-amber-600 to-amber-400"
                  }`}
                  animate={{ width: `${state.pressure}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className={`text-xs font-bold w-8 text-right ${
                state.pressure > 70 ? "text-red-400" : "text-amber-400"
              }`}>
                {state.pressure}%
              </span>
            </div>
          </div>
        </div>

        {/* Описание состояния */}
        <div className="text-xs text-white/50 text-center italic">
          {moodInfo.description}
        </div>

        {/* Найденные улики */}
        {state.cluesRevealed.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs text-white/40 mb-2">
              Получено информации: {state.cluesRevealed.length}
            </div>
            <div className="flex flex-wrap gap-1">
              {state.cluesRevealed.map((clue, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded"
                >
                  {clue}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Статистика */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-white/40">
          <span>Вопросов: {state.questionsAsked}</span>
          <span>•</span>
          <span className={state.isConfessionObtained ? "text-emerald-400" : ""}>
            {state.isConfessionObtained ? "✓ Признание получено" : "Ожидание признания"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// СОЗДАНИЕ НАЧАЛЬНОГО СОСТОЯНИЯ
// ══════════════════════════════════════════════════════════════════════════════

export function createInterrogationState(
  suspectId: string,
  suspectName: string,
  maxTime: number = 300
): InterrogationState {
  return {
    suspectId,
    suspectName,
    suspectMood: "nervous",
    rapport: 0,
    pressure: 0,
    timeRemaining: maxTime,
    maxTime,
    questionsAsked: 0,
    cluesRevealed: [],
    isConfessionObtained: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ОБНОВЛЕНИЕ СОСТОЯНИЯ
// ══════════════════════════════════════════════════════════════════════════════

export function updateInterrogationFromTags(
  state: InterrogationState,
  tags: string[]
): InterrogationState {
  let newState = { ...state };

  for (const tag of tags) {
    const colonIndex = tag.indexOf(":");
    if (colonIndex === -1) continue;

    const key = tag.slice(0, colonIndex).trim();
    const value = tag.slice(colonIndex + 1).trim();

    switch (key) {
      case "suspect_mood":
        if (value in MOOD_INFO) {
          newState.suspectMood = value as SuspectMood;
        }
        break;
      case "rapport":
        const rapportChange = parseInt(value, 10);
        if (!isNaN(rapportChange)) {
          newState.rapport = Math.min(100, Math.max(0, newState.rapport + rapportChange));
        }
        break;
      case "pressure":
        const pressureChange = parseInt(value, 10);
        if (!isNaN(pressureChange)) {
          newState.pressure = Math.min(100, Math.max(0, newState.pressure + pressureChange));
        }
        break;
      case "question_asked":
        newState.questionsAsked += 1;
        break;
      case "clue_revealed":
        if (!newState.cluesRevealed.includes(value)) {
          newState.cluesRevealed = [...newState.cluesRevealed, value];
          investigationHaptic.clueDiscovered();
        }
        break;
      case "confession":
        if (value === "true" || value === "obtained") {
          newState.isConfessionObtained = true;
          investigationHaptic.caseSolved();
        }
        break;
    }
  }

  // Определяем настроение на основе rapport/pressure
  if (newState.pressure > 80 && newState.rapport < 20) {
    newState.suspectMood = "broken";
  } else if (newState.pressure > 60 && newState.rapport < 30) {
    newState.suspectMood = "aggressive";
  } else if (newState.rapport > 70 && newState.pressure < 30) {
    newState.suspectMood = "cooperative";
  } else if (newState.rapport > 50) {
    newState.suspectMood = "relaxed";
  } else if (newState.pressure > 50) {
    newState.suspectMood = "defensive";
  }

  return newState;
}

// ══════════════════════════════════════════════════════════════════════════════
// ПОДСКАЗКИ ПО ТАКТИКЕ
// ══════════════════════════════════════════════════════════════════════════════

export function getTacticalHint(state: InterrogationState): string {
  if (state.suspectMood === "silent") {
    return "Подозреваемый молчит. Попробуйте сменить тактику или показать улику.";
  }
  if (state.suspectMood === "aggressive") {
    return "Осторожно! Агрессия может привести к срыву допроса. Рассмотрите мягкий подход.";
  }
  if (state.suspectMood === "broken") {
    return "Подозреваемый готов признаться. Но будет ли это правдой?";
  }
  if (state.rapport > 60 && state.pressure < 30) {
    return "Хороший контакт установлен. Можно задавать сложные вопросы.";
  }
  if (state.pressure > 60 && state.rapport < 30) {
    return "Высокое давление без доверия может привести к ложным показаниям.";
  }
  return "";
}

export default InterrogationView;
