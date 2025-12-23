"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StoryRunner, type Story, type StoryOutput } from "@/lib/story-engine";
import { haptic } from "@/lib/haptic";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

type StoryPlayerProps = {
  story: Story;
  onEnd?: (output: StoryOutput) => void;
  onClueFound?: (clueId: string) => void;
  onScoreChange?: (newScore: number) => void;
};

// ══════════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function StoryPlayer({
  story,
  onEnd,
  onClueFound,
  onScoreChange,
}: StoryPlayerProps) {
  const [runner] = useState(() => new StoryRunner(story));
  const [output, setOutput] = useState<StoryOutput | null>(null);
  const [visibleParagraphs, setVisibleParagraphs] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [prevClues, setPrevClues] = useState<string[]>([]);
  const [prevScore, setPrevScore] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Инициализация
  useEffect(() => {
    const initialOutput = runner.getCurrentOutput();
    setOutput(initialOutput);
    setVisibleParagraphs(0);
    setIsTyping(true);
  }, [runner]);

  // Анимация появления параграфов
  useEffect(() => {
    if (!output) return;

    if (visibleParagraphs >= output.scene.paragraphs.length) {
      setIsTyping(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisibleParagraphs((prev) => prev + 1);
    }, 400);

    return () => clearTimeout(timer);
  }, [output, visibleParagraphs]);

  // Автоскролл
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [visibleParagraphs]);

  // Отслеживание улик и очков
  useEffect(() => {
    if (!output) return;

    // Новые улики
    const newClues = output.state.collectedClues.filter(
      (c) => !prevClues.includes(c)
    );
    newClues.forEach((clue) => {
      onClueFound?.(clue);
      haptic.light();
    });
    setPrevClues(output.state.collectedClues);

    // Изменение очков
    if (output.state.score !== prevScore) {
      onScoreChange?.(output.state.score);
      setPrevScore(output.state.score);
    }
  }, [output, onClueFound, onScoreChange, prevClues, prevScore]);

  // Проверка конца истории
  useEffect(() => {
    if (output?.isEnd) {
      onEnd?.(output);
    }
  }, [output, onEnd]);

  const handleChoice = useCallback(
    (choiceId: string) => {
      if (isTyping) return;
      haptic.medium();
      const newOutput = runner.choose(choiceId);
      setOutput(newOutput);
      setVisibleParagraphs(0);
      setIsTyping(true);
    },
    [runner, isTyping]
  );

  const handleContinue = useCallback(() => {
    if (isTyping || !output?.scene.next) return;
    haptic.light();
    const newOutput = runner.continue();
    setOutput(newOutput);
    setVisibleParagraphs(0);
    setIsTyping(true);
  }, [runner, isTyping, output]);

  if (!output) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
      </div>
    );
  }

  const { scene, choices, isEnd } = output;
  const showChoices = !isTyping && visibleParagraphs >= scene.paragraphs.length;
  const showContinue = showChoices && choices.length === 0 && scene.next && !isEnd;

  return (
    <div className="flex flex-col h-full bg-[#0a0a12]">
      {/* Контент истории */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {/* Спикер */}
        {scene.speaker && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-violet-400 font-semibold uppercase tracking-wide mb-2"
          >
            💬 {scene.speaker}
          </motion.div>
        )}

        {/* Параграфы */}
        <AnimatePresence mode="popLayout">
          {scene.paragraphs.slice(0, visibleParagraphs).map((text, index) => (
            <motion.div
              key={`${scene.id}-${index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <ParagraphRenderer 
                text={text} 
                mood={scene.mood}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Индикатор печати */}
        {isTyping && visibleParagraphs < scene.paragraphs.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-1 py-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-white/40 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Выборы */}
      <AnimatePresence>
        {showChoices && choices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 space-y-2 border-t border-white/10 bg-gradient-to-t from-[#0a0a12] to-transparent"
          >
            {choices.map((choice, index) => (
              <motion.button
                key={choice.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice(choice.id)}
                className="w-full text-left p-4 rounded-xl bg-gradient-to-r from-violet-600/20 to-purple-600/20 
                  border border-violet-500/30 hover:border-violet-500/60 transition-all"
              >
                <span className="text-violet-300 mr-2 font-bold">
                  {String.fromCharCode(65 + index)}.
                </span>
                <span className="text-white/90">{choice.text}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопка продолжения */}
      <AnimatePresence>
        {showContinue && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 border-t border-white/10"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleContinue}
              className="w-full py-4 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
            >
              Далее →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Конец истории */}
      {isEnd && showChoices && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 text-center border-t border-white/10"
        >
          <div className="text-4xl mb-2">
            {scene.tags?.includes("ending:good") ? "✅" :
             scene.tags?.includes("ending:bad") ? "💀" : "🔚"}
          </div>
          <p className="text-white/60 text-sm">История завершена</p>
        </motion.div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// РЕНДЕРЕР ПАРАГРАФОВ
// ══════════════════════════════════════════════════════════════════════════════

function ParagraphRenderer({ 
  text, 
  mood 
}: { 
  text: string; 
  mood?: string;
}) {
  // Пустые строки = пробел
  if (!text.trim()) {
    return <div className="h-2" />;
  }

  // Определяем тип параграфа
  const isClue = text.startsWith("📝");
  const isWarning = text.startsWith("⚠️");
  const isConsequence = text.startsWith("✅") || text.startsWith("💀");
  const isHeader = text.startsWith("═");
  const isList = text.startsWith("•");

  let containerClass = "rounded-xl p-4 ";
  let textClass = "text-white/90 leading-relaxed ";

  if (isClue) {
    containerClass += "bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30";
    textClass += "text-emerald-300 font-medium";
  } else if (isWarning) {
    containerClass += "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30";
    textClass += "text-amber-300";
  } else if (isConsequence) {
    const isPositive = text.startsWith("✅");
    if (isPositive) {
      containerClass += "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30";
      textClass += "text-green-300 font-semibold";
    } else {
      containerClass += "bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30";
      textClass += "text-red-300 font-semibold";
    }
  } else if (isHeader) {
    containerClass += "bg-transparent text-center";
    textClass = "text-white/50 font-mono text-sm";
  } else if (isList) {
    containerClass += "bg-white/5 py-2";
    textClass += "text-white/80";
  } else if (mood === "horror" || mood === "dark") {
    containerClass += "bg-red-950/20 border border-red-900/20";
    textClass += "text-red-200/80";
  } else if (mood === "hope") {
    containerClass += "bg-emerald-950/20 border border-emerald-900/20";
    textClass += "text-emerald-200/90";
  } else {
    containerClass += "bg-white/5";
  }

  return (
    <div className={containerClass}>
      <p className={textClass}>{text}</p>
    </div>
  );
}

export default StoryPlayer;
