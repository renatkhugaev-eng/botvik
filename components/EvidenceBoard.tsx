"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { investigationHaptic } from "@/lib/haptic";
import type {
  Evidence,
  EvidenceConnection,
  BoardState,
  EvidenceCategory,
  Suspect,
} from "@/lib/evidence-system";
import {
  tryConnection,
  calculateProgress,
  getEvidenceByCategory,
  getSuspectGuiltScore,
} from "@/lib/evidence-system";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

type EvidenceBoardProps = {
  state: BoardState;
  onStateChange: (newState: BoardState) => void;
  onInsightDiscovered?: (insight: string) => void;
  readOnly?: boolean;
};

type ViewMode = "board" | "list" | "suspects";

// ══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<EvidenceCategory, { label: string; color: string }> = {
  physical: { label: "Физические", color: "bg-red-500" },
  witness: { label: "Свидетели", color: "bg-blue-500" },
  document: { label: "Документы", color: "bg-amber-500" },
  suspect: { label: "Подозреваемые", color: "bg-purple-500" },
  location: { label: "Места", color: "bg-green-500" },
  timeline: { label: "Хронология", color: "bg-cyan-500" },
  forensic: { label: "Криминалистика", color: "bg-pink-500" },
  profile: { label: "Профиль", color: "bg-orange-500" },
};

// ══════════════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function EvidenceBoard({
  state,
  onStateChange,
  onInsightDiscovered,
  readOnly = false,
}: EvidenceBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [showInsight, setShowInsight] = useState<string | null>(null);
  const [detailEvidence, setDetailEvidence] = useState<Evidence | null>(null);
  const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const progress = calculateProgress(state);

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТКА СВЯЗЕЙ
  // ══════════════════════════════════════════════════════════════════════════

  const handleEvidenceClick = useCallback(
    (evidenceId: string) => {
      if (readOnly) {
        const evidence = state.evidence.find((e) => e.id === evidenceId);
        if (evidence) setDetailEvidence(evidence);
        return;
      }

      investigationHaptic.evidenceSelect();

      if (connectingFrom === null) {
        // Начинаем соединение
        setConnectingFrom(evidenceId);
        setSelectedEvidence(evidenceId);
      } else if (connectingFrom === evidenceId) {
        // Отмена
        setConnectingFrom(null);
        setSelectedEvidence(null);
      } else {
        // Пытаемся соединить
        const { newState, result } = tryConnection(state, connectingFrom, evidenceId);

        if (result === "correct") {
          investigationHaptic.connectionMade();
          const conn = newState.connections[newState.connections.length - 1];
          if (conn?.insight) {
            setShowInsight(conn.insight);
            onInsightDiscovered?.(conn.insight);
            // Дополнительный haptic для инсайта
            setTimeout(() => investigationHaptic.insight(), 300);
          }
          onStateChange(newState);
        } else if (result === "wrong") {
          investigationHaptic.connectionFailed();
          onStateChange(newState);
        } else if (result === "duplicate") {
          investigationHaptic.evidenceSelect();
          setConnectionFeedback("Эта связь уже установлена");
          setTimeout(() => setConnectionFeedback(null), 2000);
        } else {
          investigationHaptic.connectionFailed();
          setConnectionFeedback("Нет очевидной связи между этими уликами");
          setTimeout(() => setConnectionFeedback(null), 2000);
        }

        setConnectingFrom(null);
        setSelectedEvidence(null);
      }
    },
    [connectingFrom, readOnly, state, onStateChange, onInsightDiscovered]
  );

  const handleEvidenceLongPress = useCallback(
    (evidence: Evidence) => {
      investigationHaptic.evidenceInspect();
      setDetailEvidence(evidence);
    },
    []
  );

  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-[#0d0d14]">
      {/* Хедер с прогрессом */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            📋 Доска улик
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Прогресс:</span>
            <span className="text-sm font-bold text-violet-400">{progress}%</span>
          </div>
        </div>

        {/* Прогресс бар */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Статистика */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-white/40">Улик:</span>
            <span className="text-white font-medium">{state.evidence.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/40">Связей:</span>
            <span className="text-emerald-400 font-medium">{state.correctConnections}</span>
            {state.wrongConnections > 0 && (
              <span className="text-red-400">/ {state.wrongConnections} ошибок</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/40">Очков:</span>
            <span className="text-violet-400 font-medium">{state.totalScore}</span>
          </div>
        </div>
      </div>

      {/* Переключатель видов */}
      <div className="flex border-b border-white/10">
        {(["board", "list", "suspects"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              investigationHaptic.boardTabSwitch();
              setViewMode(mode);
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              viewMode === mode
                ? "text-violet-400 border-b-2 border-violet-400"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            {mode === "board" && "🗂️ Доска"}
            {mode === "list" && "📝 Список"}
            {mode === "suspects" && "👥 Подозреваемые"}
          </button>
        ))}
      </div>

      {/* Инструкция для соединения */}
      <AnimatePresence>
        {connectingFrom && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 bg-violet-500/20 border-b border-violet-500/30"
          >
            <p className="text-sm text-violet-300 text-center">
              🔗 Выберите вторую улику для связи или нажмите ещё раз для отмены
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Фидбек о связи */}
      <AnimatePresence>
        {connectionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30"
          >
            <p className="text-sm text-amber-300 text-center">
              ⚠️ {connectionFeedback}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Контент */}
      <div ref={boardRef} className="flex-1 overflow-auto p-4">
        {viewMode === "board" && (
          <BoardView
            state={state}
            selectedEvidence={selectedEvidence}
            connectingFrom={connectingFrom}
            onEvidenceClick={handleEvidenceClick}
            onEvidenceLongPress={handleEvidenceLongPress}
          />
        )}

        {viewMode === "list" && (
          <ListView
            state={state}
            onEvidenceClick={handleEvidenceClick}
            onEvidenceLongPress={handleEvidenceLongPress}
          />
        )}

        {viewMode === "suspects" && (
          <SuspectsView
            state={state}
            onEvidenceClick={handleEvidenceClick}
          />
        )}
      </div>

      {/* Модалка инсайта */}
      <AnimatePresence>
        {showInsight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            onClick={() => setShowInsight(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a1a2e] rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl text-center mb-4">💡</div>
              <h3 className="text-lg font-bold text-center mb-3">Связь обнаружена!</h3>
              <p className="text-white/70 text-center mb-6">{showInsight}</p>
              <button
                onClick={() => setShowInsight(null)}
                className="w-full py-3 rounded-xl bg-violet-600 font-medium"
              >
                Понятно
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модалка детали улики */}
      <AnimatePresence>
        {detailEvidence && (
          <EvidenceDetailModal
            evidence={detailEvidence}
            connections={state.connections.filter(
              (c) => c.from === detailEvidence.id || c.to === detailEvidence.id
            )}
            onClose={() => setDetailEvidence(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ВИД: ДОСКА
// ══════════════════════════════════════════════════════════════════════════════

function BoardView({
  state,
  selectedEvidence,
  connectingFrom,
  onEvidenceClick,
  onEvidenceLongPress,
}: {
  state: BoardState;
  selectedEvidence: string | null;
  connectingFrom: string | null;
  onEvidenceClick: (id: string) => void;
  onEvidenceLongPress: (evidence: Evidence) => void;
}) {
  // Группируем по категориям
  const categories = Object.keys(CATEGORY_LABELS) as EvidenceCategory[];
  const evidenceByCategory = categories
    .map((cat) => ({
      category: cat,
      evidence: getEvidenceByCategory(state, cat),
    }))
    .filter((g) => g.evidence.length > 0);

  return (
    <div className="space-y-6">
      {/* Связи (SVG линии) */}
      <ConnectionLines state={state} />

      {/* Категории */}
      {evidenceByCategory.map(({ category, evidence }) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-3 h-3 rounded-full ${CATEGORY_LABELS[category].color}`} />
            <h3 className="text-sm font-medium text-white/70">
              {CATEGORY_LABELS[category].label}
            </h3>
            <span className="text-xs text-white/40">({evidence.length})</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {evidence.map((e) => (
              <EvidenceCard
                key={e.id}
                evidence={e}
                isSelected={selectedEvidence === e.id}
                isConnecting={connectingFrom === e.id}
                hasConnection={state.connections.some(
                  (c) => c.from === e.id || c.to === e.id
                )}
                onClick={() => onEvidenceClick(e.id)}
                onLongPress={() => onEvidenceLongPress(e)}
              />
            ))}
          </div>
        </div>
      ))}

      {state.evidence.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3">🔍</div>
          <p>Пока нет улик</p>
          <p className="text-sm">Исследуйте дело, чтобы найти улики</p>
        </div>
      )}

      {state.evidence.length >= 2 && state.connections.length === 0 && (
        <div className="mt-4 p-4 bg-violet-500/10 rounded-xl border border-violet-500/20">
          <h4 className="text-sm font-medium text-violet-300 mb-2">💡 Подсказка</h4>
          <p className="text-xs text-white/60">
            Нажмите на одну улику, затем на другую, чтобы попытаться установить связь между ними.
            Правильные связи дают очки и раскрывают инсайты!
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ВИД: СПИСОК
// ══════════════════════════════════════════════════════════════════════════════

function ListView({
  state,
  onEvidenceClick,
  onEvidenceLongPress,
}: {
  state: BoardState;
  onEvidenceClick: (id: string) => void;
  onEvidenceLongPress: (evidence: Evidence) => void;
}) {
  return (
    <div className="space-y-2">
      {state.evidence.map((evidence) => (
        <motion.div
          key={evidence.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 rounded-xl p-4 border border-white/10 cursor-pointer"
          onClick={() => onEvidenceClick(evidence.id)}
          onTapStart={() => {}}
          onTap={() => {}}
          whileTap={{ scale: 0.98 }}
          onPointerDown={(e) => {
            // Long press simulation for context menu
            const timer = setTimeout(() => {
              onEvidenceLongPress(evidence);
            }, 500);
            const cleanup = () => clearTimeout(timer);
            e.currentTarget.addEventListener('pointerup', cleanup, { once: true });
            e.currentTarget.addEventListener('pointerleave', cleanup, { once: true });
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">{evidence.icon}</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white">{evidence.title}</h4>
              <p className="text-sm text-white/60 mt-1">{evidence.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${CATEGORY_LABELS[evidence.category].color} text-white`}
                >
                  {CATEGORY_LABELS[evidence.category].label}
                </span>
                {evidence.importance === "critical" && (
                  <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                    Критично
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ВИД: ПОДОЗРЕВАЕМЫЕ
// ══════════════════════════════════════════════════════════════════════════════

function SuspectsView({
  state,
  onEvidenceClick,
}: {
  state: BoardState;
  onEvidenceClick: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {state.suspects.map((suspect) => {
        // Динамический расчёт уровня подозрений
        const dynamicGuiltScore = getSuspectGuiltScore(state, suspect.id);
        return (
          <SuspectCard
            key={suspect.id}
            suspect={{ ...suspect, guiltyScore: dynamicGuiltScore }}
            evidence={state.evidence.filter((e) => suspect.evidence.includes(e.id))}
            onEvidenceClick={onEvidenceClick}
          />
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// КАРТОЧКА УЛИКИ
// ══════════════════════════════════════════════════════════════════════════════

function EvidenceCard({
  evidence,
  isSelected,
  isConnecting,
  hasConnection,
  onClick,
  onLongPress,
}: {
  evidence: Evidence;
  isSelected: boolean;
  isConnecting: boolean;
  hasConnection: boolean;
  onClick: () => void;
  onLongPress: () => void;
}) {
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    didLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress();
    }, 500);
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    // Не вызываем onClick если был long press
    if (!didLongPressRef.current) {
      onClick();
    }
    didLongPressRef.current = false;
  }, [onClick]);

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className={`
        relative px-3 py-2 rounded-xl text-left transition-all
        ${isConnecting ? "bg-violet-500/30 border-2 border-violet-500 ring-2 ring-violet-500/50" : ""}
        ${isSelected && !isConnecting ? "bg-white/10 border-2 border-white/30" : ""}
        ${!isSelected && !isConnecting ? "bg-white/5 border border-white/10 hover:bg-white/10" : ""}
        ${hasConnection ? "ring-1 ring-emerald-500/50" : ""}
      `}
    >
      {/* Индикатор связи */}
      {hasConnection && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full" />
      )}

      <div className="flex items-center gap-2">
        <span className="text-lg">{evidence.icon}</span>
        <span className="text-sm font-medium truncate max-w-[120px]">
          {evidence.title}
        </span>
      </div>

      {/* Важность */}
      {evidence.importance === "critical" && (
        <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </motion.button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// КАРТОЧКА ПОДОЗРЕВАЕМОГО
// ══════════════════════════════════════════════════════════════════════════════

function SuspectCard({
  suspect,
  evidence,
  onEvidenceClick,
}: {
  suspect: Suspect;
  evidence: Evidence[];
  onEvidenceClick: (id: string) => void;
}) {
  const statusLabels: Record<Suspect["status"], { label: string; color: string }> = {
    unknown: { label: "Неизвестен", color: "bg-gray-500" },
    person_of_interest: { label: "Интересен", color: "bg-amber-500" },
    suspect: { label: "Подозреваемый", color: "bg-orange-500" },
    arrested: { label: "Арестован", color: "bg-red-500" },
    cleared: { label: "Снят с подозрений", color: "bg-green-500" },
    convicted: { label: "Осуждён", color: "bg-purple-500" },
  };

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-start gap-4">
        {/* Аватар */}
        <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-3xl">
          👤
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white">
              {suspect.codename || suspect.name}
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-xs text-white ${statusLabels[suspect.status].color}`}
            >
              {statusLabels[suspect.status].label}
            </span>
          </div>

          <p className="text-sm text-white/60 mt-1">
            {suspect.age} лет, {suspect.occupation}
          </p>

          <p className="text-sm text-white/40 mt-2">{suspect.description}</p>

          {/* Шкала подозрений */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/40">Уровень подозрений</span>
              <span className={suspect.guiltyScore >= 70 ? "text-red-400" : "text-white/60"}>
                {suspect.guiltyScore}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  suspect.guiltyScore >= 70
                    ? "bg-red-500"
                    : suspect.guiltyScore >= 40
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${suspect.guiltyScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Связанные улики */}
      {evidence.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40 mb-2">Связанные улики:</p>
          <div className="flex flex-wrap gap-2">
            {evidence.map((e) => (
              <button
                key={e.id}
                onClick={() => onEvidenceClick(e.id)}
                className="px-2 py-1 rounded bg-white/10 text-xs flex items-center gap-1 hover:bg-white/20"
              >
                <span>{e.icon}</span>
                <span>{e.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЛИНИИ СВЯЗЕЙ
// ══════════════════════════════════════════════════════════════════════════════

function ConnectionLines({ state }: { state: BoardState }) {
  // В реальной реализации здесь был бы SVG с линиями между уликами
  // Для упрощения показываем список связей
  if (state.connections.length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
      <h4 className="text-xs text-emerald-400 font-medium mb-2">
        🔗 Обнаруженные связи ({state.connections.length})
      </h4>
      <div className="space-y-1">
        {state.connections.map((conn) => (
          <div
            key={conn.id}
            className={`text-xs flex items-center gap-2 ${
              conn.isCorrect ? "text-emerald-300" : "text-red-300"
            }`}
          >
            <span>{conn.isCorrect ? "✅" : "❌"}</span>
            <span>{conn.label}</span>
            <span className="text-white/30">
              ({conn.points > 0 ? "+" : ""}{conn.points} очков)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА ДЕТАЛИ УЛИКИ
// ══════════════════════════════════════════════════════════════════════════════

function EvidenceDetailModal({
  evidence,
  connections,
  onClose,
}: {
  evidence: Evidence;
  connections: EvidenceConnection[];
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25 }}
        className="bg-[#1a1a2e] rounded-t-3xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Хендл */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Заголовок */}
        <div className="flex items-start gap-4 mb-4">
          <div className="text-4xl">{evidence.icon}</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{evidence.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded text-xs text-white ${CATEGORY_LABELS[evidence.category].color}`}
              >
                {CATEGORY_LABELS[evidence.category].label}
              </span>
              {evidence.importance === "critical" && (
                <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                  Критично
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Описание */}
        <p className="text-white/70 mb-4">{evidence.description}</p>

        {/* Детали */}
        {evidence.details && evidence.details.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-white/50 mb-2">Детали:</h4>
            <ul className="space-y-1">
              {evidence.details.map((detail, i) => (
                <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                  <span className="text-white/40">•</span>
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Связи */}
        {connections.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-white/50 mb-2">Связи:</h4>
            <div className="space-y-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className={`p-2 rounded-lg ${
                    conn.isCorrect ? "bg-emerald-500/10" : "bg-red-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{conn.isCorrect ? "✅" : "❌"}</span>
                    <span className={conn.isCorrect ? "text-emerald-300" : "text-red-300"}>
                      {conn.label}
                    </span>
                  </div>
                  {conn.insight && (
                    <p className="text-xs text-white/50 mt-1">{conn.insight}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 font-medium mt-4"
        >
          Закрыть
        </button>
      </motion.div>
    </motion.div>
  );
}

export default EvidenceBoard;
