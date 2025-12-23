"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { investigationHaptic } from "@/lib/haptic";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

export type TimelineEvent = {
  id: string;
  title: string;
  description: string;
  date?: string;           // Формат: "DD.MM.YYYY" или "HH:MM DD.MM.YYYY"
  time?: string;           // Время события (если известно)
  icon: string;
  category: "victim" | "suspect" | "witness" | "evidence" | "investigation";
  isLocked?: boolean;      // Нельзя перемещать
  correctPosition?: number; // Правильная позиция (0-based)
  clueId?: string;         // ID улики, раскрываемой при правильном размещении
};

export type TimelineState = {
  events: TimelineEvent[];
  correctPlacements: number;
  totalEvents: number;
  isComplete: boolean;
  revealedInsights: string[];
};

type TimelineBuilderProps = {
  events: TimelineEvent[];
  onEventOrderChange?: (events: TimelineEvent[]) => void;
  onCorrectPlacement?: (event: TimelineEvent, insight: string) => void;
  onTimelineComplete?: (state: TimelineState) => void;
  readOnly?: boolean;
};

// ══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ══════════════════════════════════════════════════════════════════════════════

const CATEGORY_STYLES: Record<TimelineEvent["category"], { 
  bg: string; 
  border: string; 
  text: string;
  label: string;
}> = {
  victim: { 
    bg: "bg-red-900/30", 
    border: "border-red-500/50", 
    text: "text-red-300",
    label: "Жертва",
  },
  suspect: { 
    bg: "bg-amber-900/30", 
    border: "border-amber-500/50", 
    text: "text-amber-300",
    label: "Подозреваемый",
  },
  witness: { 
    bg: "bg-blue-900/30", 
    border: "border-blue-500/50", 
    text: "text-blue-300",
    label: "Свидетель",
  },
  evidence: { 
    bg: "bg-emerald-900/30", 
    border: "border-emerald-500/50", 
    text: "text-emerald-300",
    label: "Улика",
  },
  investigation: { 
    bg: "bg-purple-900/30", 
    border: "border-purple-500/50", 
    text: "text-purple-300",
    label: "Следствие",
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function TimelineBuilder({
  events: initialEvents,
  onEventOrderChange,
  onCorrectPlacement,
  onTimelineComplete,
  readOnly = false,
}: TimelineBuilderProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [correctPlacements, setCorrectPlacements] = useState<Set<string>>(new Set());
  const [showInsight, setShowInsight] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Вычисляем прогресс
  const eventsWithCorrectPosition = useMemo(
    () => events.filter((e) => e.correctPosition !== undefined),
    [events]
  );
  
  const progress = useMemo(() => {
    if (eventsWithCorrectPosition.length === 0) return 100;
    return Math.round((correctPlacements.size / eventsWithCorrectPosition.length) * 100);
  }, [correctPlacements.size, eventsWithCorrectPosition.length]);

  const isComplete = progress === 100 && eventsWithCorrectPosition.length > 0;

  // ══════════════════════════════════════════════════════════════════════════
  // ПРОВЕРКА ПРАВИЛЬНОСТИ ПОРЯДКА
  // ══════════════════════════════════════════════════════════════════════════

  const checkCorrectness = useCallback((newEvents: TimelineEvent[]) => {
    const newCorrectPlacements = new Set<string>();
    
    newEvents.forEach((event, index) => {
      if (event.correctPosition !== undefined && event.correctPosition === index) {
        newCorrectPlacements.add(event.id);
        
        // Если это новое правильное размещение
        if (!correctPlacements.has(event.id)) {
          investigationHaptic.connectionMade();
          
          const insight = getInsightForEvent(event);
          if (insight) {
            setShowInsight(insight);
            onCorrectPlacement?.(event, insight);
            
            setTimeout(() => setShowInsight(null), 3000);
          }
        }
      }
    });
    
    setCorrectPlacements(newCorrectPlacements);
    
    // Проверяем завершение
    if (newCorrectPlacements.size === eventsWithCorrectPosition.length && 
        eventsWithCorrectPosition.length > 0) {
      investigationHaptic.caseSolved();
      onTimelineComplete?.({
        events: newEvents,
        correctPlacements: newCorrectPlacements.size,
        totalEvents: eventsWithCorrectPosition.length,
        isComplete: true,
        revealedInsights: Array.from(newCorrectPlacements).map(id => {
          const event = newEvents.find(e => e.id === id);
          return event ? getInsightForEvent(event) || "" : "";
        }).filter(Boolean),
      });
    }
  }, [correctPlacements, eventsWithCorrectPosition.length, onCorrectPlacement, onTimelineComplete]);

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТЧИКИ
  // ══════════════════════════════════════════════════════════════════════════

  const handleReorder = useCallback((newOrder: TimelineEvent[]) => {
    if (readOnly) return;
    
    investigationHaptic.evidenceSelect();
    setEvents(newOrder);
    onEventOrderChange?.(newOrder);
    checkCorrectness(newOrder);
  }, [readOnly, onEventOrderChange, checkCorrectness]);

  const handleEventClick = useCallback((event: TimelineEvent) => {
    investigationHaptic.evidenceInspect();
    setSelectedEvent(event);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-[#0d0d14]">
      {/* Хедер */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h2 className="text-lg font-bold">Хронология событий</h2>
              <p className="text-xs text-white/50">Расставьте события в правильном порядке</p>
            </div>
          </div>
          
          {/* Прогресс */}
          <div className={`px-3 py-1.5 rounded-lg ${
            isComplete ? "bg-emerald-500/20" : "bg-white/10"
          }`}>
            <span className={`text-sm font-bold ${
              isComplete ? "text-emerald-400" : "text-white/70"
            }`}>
              {progress}%
            </span>
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${isComplete ? "bg-emerald-500" : "bg-violet-500"}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Временная шкала */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative">
          {/* Вертикальная линия */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/20" />

          {/* События */}
          <Reorder.Group
            axis="y"
            values={events}
            onReorder={handleReorder}
            className="space-y-3"
          >
            {events.map((event, index) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                index={index}
                isCorrect={correctPlacements.has(event.id)}
                isLocked={event.isLocked || readOnly}
                onClick={() => handleEventClick(event)}
              />
            ))}
          </Reorder.Group>
        </div>

        {/* Пустой state */}
        {events.length === 0 && (
          <div className="text-center py-12 text-white/40">
            <div className="text-4xl mb-3">📅</div>
            <p>Нет событий для отображения</p>
          </div>
        )}

        {/* Завершение */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-center"
          >
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="font-bold text-emerald-300">Хронология восстановлена!</h3>
            <p className="text-sm text-white/60 mt-1">
              Все события расположены в правильном порядке
            </p>
          </motion.div>
        )}
      </div>

      {/* Инсайт при правильном размещении */}
      <AnimatePresence>
        {showInsight && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-4 right-4 p-4 bg-emerald-600/90 rounded-xl shadow-lg z-50"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <div className="text-sm font-medium text-white">Связь обнаружена!</div>
                <div className="text-xs text-white/80 mt-1">{showInsight}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Детали события */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            isCorrect={correctPlacements.has(selectedEvent.id)}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>

      {/* Подсказка */}
      {!readOnly && events.length > 1 && (
        <div className="p-4 border-t border-white/10 text-center">
          <p className="text-xs text-white/40">
            Перетащите события вверх или вниз, чтобы изменить порядок
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// КАРТОЧКА СОБЫТИЯ
// ══════════════════════════════════════════════════════════════════════════════

function TimelineEventCard({
  event,
  index,
  isCorrect,
  isLocked,
  onClick,
}: {
  event: TimelineEvent;
  index: number;
  isCorrect: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  const style = CATEGORY_STYLES[event.category];

  return (
    <Reorder.Item
      value={event}
      dragListener={!isLocked}
      className="relative"
    >
      <motion.div
        whileHover={!isLocked ? { scale: 1.01 } : {}}
        whileTap={!isLocked ? { scale: 0.99 } : {}}
        onClick={onClick}
        className={`
          relative ml-10 p-4 rounded-xl border-2 transition-all cursor-pointer
          ${style.bg} ${style.border}
          ${isCorrect ? "ring-2 ring-emerald-500/50" : ""}
          ${isLocked ? "opacity-70" : ""}
        `}
      >
        {/* Точка на линии */}
        <div className={`
          absolute left-[-26px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2
          ${isCorrect ? "bg-emerald-500 border-emerald-400" : "bg-white/20 border-white/40"}
        `}>
          {isCorrect && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute inset-0 flex items-center justify-center text-[10px]"
            >
              ✓
            </motion.div>
          )}
        </div>

        {/* Контент */}
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">{event.icon}</div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              {event.date && (
                <span className="text-xs text-white/40">{event.date}</span>
              )}
              {event.time && (
                <span className="text-xs text-white/50">{event.time}</span>
              )}
            </div>
            
            <h4 className={`font-medium ${style.text}`}>{event.title}</h4>
            <p className="text-sm text-white/60 mt-1 line-clamp-2">
              {event.description}
            </p>
          </div>

          {/* Иконки статуса */}
          <div className="flex flex-col gap-1">
            {isLocked && (
              <span className="text-white/30" title="Заблокировано">🔒</span>
            )}
            {!isLocked && (
              <span className="text-white/30" title="Перетащите">⋮⋮</span>
            )}
          </div>
        </div>

        {/* Номер позиции */}
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50">
          {index + 1}
        </div>
      </motion.div>
    </Reorder.Item>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДАЛКА ДЕТАЛЕЙ СОБЫТИЯ
// ══════════════════════════════════════════════════════════════════════════════

function EventDetailModal({
  event,
  isCorrect,
  onClose,
}: {
  event: TimelineEvent;
  isCorrect: boolean;
  onClose: () => void;
}) {
  const style = CATEGORY_STYLES[event.category];

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
        className={`${style.bg} rounded-t-3xl p-6 w-full max-w-lg border-t-2 ${style.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Хендл */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Заголовок */}
        <div className="flex items-start gap-4 mb-4">
          <div className="text-4xl">{event.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${style.text} bg-white/10`}>
                {style.label}
              </span>
              {isCorrect && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  ✓ Верная позиция
                </span>
              )}
            </div>
            <h3 className={`text-xl font-bold ${style.text}`}>{event.title}</h3>
          </div>
        </div>

        {/* Дата/время */}
        {(event.date || event.time) && (
          <div className="flex items-center gap-2 mb-4 text-white/50">
            <span>📅</span>
            <span>{event.date}</span>
            {event.time && (
              <>
                <span>•</span>
                <span>🕐</span>
                <span>{event.time}</span>
              </>
            )}
          </div>
        )}

        {/* Описание */}
        <p className="text-white/70 mb-6">{event.description}</p>

        {/* Инсайт */}
        {isCorrect && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-4">
            <div className="text-xs text-emerald-400 font-medium mb-1">💡 Обнаруженная связь:</div>
            <p className="text-sm text-emerald-300">{getInsightForEvent(event)}</p>
          </div>
        )}

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 font-medium"
        >
          Закрыть
        </button>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ══════════════════════════════════════════════════════════════════════════════

function getInsightForEvent(event: TimelineEvent): string | null {
  // Можно расширить для разных событий
  const insights: Record<string, string> = {
    victim_disappearance: "Время исчезновения жертвы — ключ к установлению алиби подозреваемых.",
    suspect_sighting: "Подозреваемый был замечен вблизи места преступления во время, совместимое с убийством.",
    witness_testimony: "Показания свидетеля подтверждают присутствие неизвестного мужчины.",
    body_discovery: "Тело обнаружено через 2 дня — это объясняет состояние улик.",
    kravchenko_alibi: "Алиби Кравченко подтверждено — он не мог совершить убийство.",
    grey_coat_sighting: "Человек в сером пальто видели уходящим от лесополосы после предполагаемого времени убийства.",
  };

  return insights[event.id] || null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ПРЕДУСТАНОВЛЕННЫЕ СОБЫТИЯ ДЛЯ ДЕЛА ЛЕСОПОЛОСА
// ══════════════════════════════════════════════════════════════════════════════

export const LESOPOLOSA_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "victim_school",
    title: "Лена выходит из школы",
    description: "Лена Закотнова выходит из школы после уроков. Её видят одноклассники.",
    date: "22.12.1978",
    time: "14:00",
    icon: "🏫",
    category: "victim",
    correctPosition: 0,
    clueId: "timeline_start",
  },
  {
    id: "victim_disappearance",
    title: "Последний раз видели живой",
    description: "Свидетельница видит Лену у автобусной остановки. Девочка разговаривает с неизвестным мужчиной.",
    date: "22.12.1978",
    time: "14:15",
    icon: "👁️",
    category: "witness",
    correctPosition: 1,
    clueId: "witness_description",
  },
  {
    id: "presumed_murder",
    title: "Предполагаемое время убийства",
    description: "По заключению экспертов, смерть наступила между 14:30 и 15:30.",
    date: "22.12.1978",
    time: "~14:30-15:30",
    icon: "💀",
    category: "evidence",
    correctPosition: 2,
    isLocked: true,
  },
  {
    id: "kravchenko_alibi",
    title: "Кравченко в магазине",
    description: "Соседка видит Кравченко у продуктового магазина. Он покупает водку юбилейными монетами.",
    date: "22.12.1978",
    time: "15:00-15:15",
    icon: "🛒",
    category: "suspect",
    correctPosition: 3,
    clueId: "coin_alibi",
  },
  {
    id: "grey_coat_sighting",
    title: "Человек в сером пальто",
    description: "Свидетельница видит неизвестного мужчину в сером пальто, идущего от лесополосы к станции.",
    date: "22.12.1978",
    time: "~16:00",
    icon: "🧥",
    category: "witness",
    correctPosition: 4,
    clueId: "grey_coat_man",
  },
  {
    id: "body_discovery",
    title: "Обнаружение тела",
    description: "Рыбак находит тело девочки в лесополосе у реки Грушевка.",
    date: "24.12.1978",
    time: "09:00",
    icon: "🔍",
    category: "investigation",
    correctPosition: 5,
    isLocked: true,
  },
  {
    id: "kravchenko_arrest",
    title: "Задержание Кравченко",
    description: "По наводке соседей задерживают Александра Кравченко, ранее судимого.",
    date: "Январь 1979",
    icon: "⚖️",
    category: "suspect",
    correctPosition: 6,
    clueId: "prior_conviction",
  },
];

export default TimelineBuilder;
