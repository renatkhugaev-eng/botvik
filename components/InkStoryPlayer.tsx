"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  InkRunner,
  type InkState,
  getTagValue,
  hasTag,
} from "@/lib/ink-runtime";
import { investigationHaptic } from "@/lib/haptic";
import { 
  InterrogationView, 
  createInterrogationState, 
  updateInterrogationFromTags,
  getTacticalHint,
  type InterrogationState,
} from "@/components/InterrogationView";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

type StoryMode = "normal" | "interrogation";

type InkStoryPlayerProps = {
  storyJson: object;
  onEnd?: (state: InkState) => void;
  onVariableChange?: (name: string, value: unknown) => void;
  onTagFound?: (tag: string, value: string | boolean) => void;
  onInkStateChange?: (stateJson: string) => void;
  initialState?: string;
  className?: string;
};

type MoodType = "normal" | "dark" | "tense" | "horror" | "hope" | "mystery" | "investigation" | "conflict" | "stakeout" | "pressure" | "discovery" | "crossroads" | "professional";

type ImagePosition = "top" | "background" | "inline";

// ══════════════════════════════════════════════════════════════════════════════
// ПОРТРЕТЫ ПЕРСОНАЖЕЙ
// ══════════════════════════════════════════════════════════════════════════════

const CHARACTER_PORTRAITS: Record<string, { name: string; image: string; color: string }> = {
  fetisov: { name: "Следователь Фетисов", image: "/investigations/portraits/fetisov.webp", color: "blue" },
  expert: { name: "Эксперт Ольга Николаевна", image: "/investigations/portraits/expert.webp", color: "purple" },
  kravchenko: { name: "Александр Кравченко", image: "/investigations/portraits/kravchenko.webp", color: "orange" },
  prosecutor: { name: "Прокурор", image: "/investigations/portraits/prosecutor.webp", color: "red" },
  witness: { name: "Свидетель", image: "/investigations/portraits/witness.webp", color: "green" },
  suspect: { name: "Подозреваемый", image: "/investigations/portraits/suspect.webp", color: "amber" },
  operator: { name: "Оперативник", image: "/investigations/portraits/operator.webp", color: "cyan" },
};

// ══════════════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export function InkStoryPlayer({
  storyJson,
  onEnd,
  onVariableChange,
  onTagFound,
  onInkStateChange,
  initialState,
  className = "",
}: InkStoryPlayerProps) {
  const [runner] = useState(() => new InkRunner(storyJson));
  const [state, setState] = useState<InkState | null>(null);
  const [displayedParagraphs, setDisplayedParagraphs] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodType>("normal");
  const [currentChapter, setCurrentChapter] = useState(1);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<ImagePosition>("top");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [storyMode, setStoryMode] = useState<StoryMode>("normal");
  const [interrogationState, setInterrogationState] = useState<InterrogationState | null>(null);
  const [tacticalHint, setTacticalHint] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevVarsRef = useRef<Record<string, unknown>>({});

  // Мемоизированные стили по настроению
  const moodStyles = useMemo(() => getMoodStyles(currentMood), [currentMood]);

  // ══════════════════════════════════════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Загружаем состояние если есть или сбрасываем для чистого старта
    if (initialState) {
      runner.loadState(initialState);
    } else {
      runner.reset(); // Сбрасываем историю для чистого старта
    }

    // Получаем текущее состояние (reset уже вызывает continue внутри)
    const initialOutput = initialState ? runner.continue() : runner.getState();
    
    setState(initialOutput);
    setDisplayedParagraphs(0);
    setIsTyping(true);

    // Обрабатываем начальные теги
    processGlobalTags(initialOutput.tags);
    
    // Notify parent about initial state for saving
    onInkStateChange?.(runner.saveState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, initialState]); // processGlobalTags, onInkStateChange намеренно исключены — вызываются только при инициализации

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТКА ТЕГОВ
  // ══════════════════════════════════════════════════════════════════════════

  const processGlobalTags = useCallback(
    (tags: string[]) => {
      // Mood - с haptic feedback для драматических моментов
      const mood = getTagValue(tags, "mood");
      if (mood && typeof mood === "string") {
        const prevMood = currentMood;
        setCurrentMood(mood as MoodType);
        
        // Haptic feedback при смене настроения
        if (prevMood !== mood) {
          if (mood === "horror" || mood === "pressure") {
            investigationHaptic.suspense();
          } else if (mood === "tense" || mood === "conflict") {
            investigationHaptic.dramaticMoment();
          } else if (mood === "discovery" || mood === "hope") {
            investigationHaptic.insight();
          }
        }
      }

      // Chapter - haptic при смене главы
      const chapter = getTagValue(tags, "chapter");
      if (chapter && typeof chapter === "string") {
        const newChapter = parseInt(chapter, 10) || 1;
        if (newChapter !== currentChapter) {
          setCurrentChapter(newChapter);
          investigationHaptic.sceneTransition();
        }
      }

      // Title
      const title = getTagValue(tags, "title");
      if (title && typeof title === "string") {
        setCurrentTitle(title);
      }

      // Scene Image - haptic при смене сцены
      const image = getTagValue(tags, "image");
      if (image && typeof image === "string") {
        setCurrentImage(`/investigations/${image}`);
        setImageLoaded(false);
        investigationHaptic.sceneTransition();
      }

      // Image Position
      const imgPos = getTagValue(tags, "image_position");
      if (imgPos && typeof imgPos === "string") {
        setImagePosition(imgPos as ImagePosition);
      }

      // Clear image
      if (hasTag(tags, "clear_image")) {
        setCurrentImage(null);
      }

      // ═══ HAPTIC для специальных тегов ═══
      
      // Clue discovered
      if (hasTag(tags, "clue")) {
        investigationHaptic.clueDiscovered();
      }
      
      // Suspect revealed
      if (hasTag(tags, "suspect_revealed") || hasTag(tags, "new_suspect")) {
        investigationHaptic.suspectRevealed();
      }
      
      // Important moment
      if (hasTag(tags, "important") || hasTag(tags, "revelation")) {
        investigationHaptic.dramaticMoment();
      }
      
      // Warning/danger
      if (hasTag(tags, "warning") || hasTag(tags, "danger")) {
        investigationHaptic.timerWarning();
      }
      
      // ═══ РЕЖИМ ДОПРОСА ═══
      const mode = getTagValue(tags, "mode");
      if (mode === "interrogation") {
        if (storyMode !== "interrogation") {
          setStoryMode("interrogation");
          investigationHaptic.dramaticMoment();
          
          // Создаём состояние допроса
          const suspectId = getTagValue(tags, "suspect");
          const suspectName = typeof suspectId === "string" 
            ? CHARACTER_PORTRAITS[suspectId]?.name || suspectId 
            : "Подозреваемый";
          const timer = getTagValue(tags, "timer");
          const maxTime = typeof timer === "string" ? parseInt(timer, 10) || 300 : 300;
          
          const newInterrogationState = createInterrogationState(
            typeof suspectId === "string" ? suspectId : "unknown",
            suspectName,
            maxTime
          );
          setInterrogationState(newInterrogationState);
          setTacticalHint(getTacticalHint(newInterrogationState));
        }
      } else if (mode === "normal" || hasTag(tags, "end_interrogation")) {
        if (storyMode === "interrogation") {
          setStoryMode("normal");
          setInterrogationState(null);
          setTacticalHint("");
        }
      }
      
      // Обновление состояния допроса
      if (storyMode === "interrogation" && interrogationState) {
        const updatedState = updateInterrogationFromTags(interrogationState, tags);
        if (updatedState !== interrogationState) {
          setInterrogationState(updatedState);
          setTacticalHint(getTacticalHint(updatedState));
        }
      }

      // Notify about all tags
      tags.forEach((tag) => {
        const colonIndex = tag.indexOf(":");
        if (colonIndex !== -1) {
          const key = tag.slice(0, colonIndex).trim();
          const value = tag.slice(colonIndex + 1).trim();
          onTagFound?.(key, value);
        } else {
          onTagFound?.(tag, true);
        }
      });
    },
    [onTagFound, currentMood, currentChapter, storyMode, interrogationState]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // АНИМАЦИЯ ПЕЧАТИ
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!state || !isTyping) return;

    if (displayedParagraphs >= state.paragraphs.length) {
      setIsTyping(false);
      return;
    }

    // Скорость зависит от длины параграфа
    const currentParagraph = state.paragraphs[displayedParagraphs];
    const delay = Math.min(100 + currentParagraph.text.length * 2, 500);

    const timer = setTimeout(() => {
      setDisplayedParagraphs((prev) => prev + 1);

      // Обрабатываем теги параграфа
      if (currentParagraph.tags.length > 0) {
        processGlobalTags(currentParagraph.tags);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [state, displayedParagraphs, isTyping, processGlobalTags]);

  // ══════════════════════════════════════════════════════════════════════════
  // АВТОСКРОЛЛ
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [displayedParagraphs]);

  // ══════════════════════════════════════════════════════════════════════════
  // ОТСЛЕЖИВАНИЕ ПЕРЕМЕННЫХ
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!state) return;

    Object.entries(state.variables).forEach(([name, value]) => {
      if (prevVarsRef.current[name] !== value) {
        onVariableChange?.(name, value);
      }
    });

    prevVarsRef.current = { ...state.variables };
  }, [state, onVariableChange]);

  // ══════════════════════════════════════════════════════════════════════════
  // ПРОВЕРКА КОНЦА
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (state?.isEnd && !isTyping) {
      onEnd?.(state);
    }
  }, [state, isTyping, onEnd]);

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТЧИКИ
  // ══════════════════════════════════════════════════════════════════════════

  const handleChoice = useCallback(
    (choiceIndex: number) => {
      if (isTyping) {
        // Skip typing animation
        if (state) {
          setDisplayedParagraphs(state.paragraphs.length);
          setIsTyping(false);
        }
        return;
      }

      investigationHaptic.choiceMade();
      const newState = runner.choose(choiceIndex);
      setState(newState);
      setDisplayedParagraphs(0);
      setIsTyping(true);
      processGlobalTags(newState.tags);
      
      // Notify parent about state change for saving
      onInkStateChange?.(runner.saveState());
    },
    [runner, isTyping, state, processGlobalTags, onInkStateChange]
  );

  const handleTapToContinue = useCallback(() => {
    if (!state) return;

    if (isTyping) {
      // Skip to end of current text
      setDisplayedParagraphs(state.paragraphs.length);
      setIsTyping(false);
      investigationHaptic.textReveal();
    }
  }, [state, isTyping]);

  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          className="h-10 w-10 rounded-full border-[3px] border-white/20 border-t-violet-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  const showChoices =
    !isTyping &&
    displayedParagraphs >= state.paragraphs.length &&
    state.choices.length > 0;

  const score = (state.variables.score as number) ?? 0;
  const objectivity = (state.variables.objectivity as number) ?? 50;

  return (
    <div className={`flex flex-col h-full ${moodStyles.background} ${className}`}>
      {/* Хедер с главой и статистикой */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`px-2 py-1 rounded text-xs font-bold ${moodStyles.accent}`}>
            Глава {currentChapter}
          </div>
          {currentTitle && (
            <span className="text-white/60 text-sm">{currentTitle}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Объективность */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">🎯</span>
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${objectivity >= 50 ? "bg-emerald-500" : "bg-amber-500"}`}
                initial={{ width: "50%" }}
                animate={{ width: `${objectivity}%` }}
              />
            </div>
          </div>

          {/* Очки */}
          <div
            className={`px-2 py-1 rounded text-xs font-bold ${
              score >= 0 ? "bg-violet-500/20 text-violet-300" : "bg-red-500/20 text-red-300"
            }`}
          >
            {score > 0 ? `+${score}` : score}
          </div>
        </div>
      </div>
      
      {/* Панель допроса */}
      <AnimatePresence>
        {storyMode === "interrogation" && interrogationState && (
          <InterrogationView
            state={interrogationState}
            isActive={storyMode === "interrogation"}
            onTimeUp={() => {
              // Допрос истёк — можно обработать в Ink
              setStoryMode("normal");
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Тактическая подсказка */}
      <AnimatePresence>
        {tacticalHint && storyMode === "interrogation" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20"
          >
            <p className="text-xs text-amber-300 text-center italic">
              💡 {tacticalHint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Изображение сцены (если position: top) */}
      <AnimatePresence>
        {currentImage && imagePosition === "top" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden"
          >
            <div className="relative w-full h-48 md:h-64">
              <Image
                src={currentImage}
                alt="Сцена"
                fill
                className={`object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImageLoaded(true)}
                priority
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a12]" />
              {/* Vignette effect for horror mood */}
              {currentMood === "horror" && (
                <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
              )}
              {/* Loading skeleton */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-white/5 animate-pulse" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Контент истории */}
      <div
        ref={scrollRef}
        onClick={handleTapToContinue}
        className={`flex-1 overflow-y-auto p-4 space-y-3 cursor-pointer ${
          imagePosition === "background" && currentImage ? "relative" : ""
        }`}
        style={
          imagePosition === "background" && currentImage
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(10,10,18,0.7), rgba(10,10,18,0.95)), url(${currentImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <AnimatePresence mode="popLayout">
          {state.paragraphs.slice(0, displayedParagraphs).map((paragraph, index) => (
            <motion.div
              key={`p-${index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ParagraphRenderer
                text={paragraph.text}
                tags={paragraph.tags}
                mood={currentMood}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Индикатор печати */}
        {isTyping && displayedParagraphs < state.paragraphs.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 py-2"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-white/40 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className="text-xs text-white/30">Нажмите, чтобы пропустить</span>
          </motion.div>
        )}
      </div>

      {/* Выборы */}
      <AnimatePresence>
        {showChoices && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className={`p-4 space-y-2 border-t ${moodStyles.border} ${moodStyles.choicesBackground}`}
          >
            <div className="text-center mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">
                Выберите действие
              </span>
            </div>
            {state.choices.map((choice, index) => (
              <motion.button
                key={choice.index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, type: "spring", stiffness: 400 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice(choice.index)}
                className="
                  group w-full text-left p-4 rounded-2xl 
                  bg-gradient-to-r from-white/5 to-white/10
                  hover:from-violet-600/30 hover:to-purple-600/30
                  border border-white/10 hover:border-violet-500/50
                  transition-all duration-200
                  shadow-sm hover:shadow-lg hover:shadow-violet-500/10
                "
              >
                <div className="flex items-center gap-3">
                  <div className="
                    w-8 h-8 rounded-full 
                    bg-gradient-to-br from-violet-500/20 to-purple-500/20
                    group-hover:from-violet-500 group-hover:to-purple-500
                    flex items-center justify-center
                    border border-violet-500/30 group-hover:border-violet-400
                    transition-all duration-200
                    text-sm font-bold text-violet-400 group-hover:text-white
                  ">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-white/90 group-hover:text-white transition-colors flex-1">
                    {choice.text}
                  </span>
                  <span className="text-violet-400/0 group-hover:text-violet-400 transition-all transform translate-x-2 group-hover:translate-x-0">
                    →
                  </span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Конец истории */}
      {state.isEnd && !isTyping && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 text-center border-t border-white/10"
        >
          <EndScreen state={state} />
        </motion.div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ДЕТАЛЬНАЯ КОНФИГУРАЦИЯ ПЕРСОНАЖЕЙ
// ══════════════════════════════════════════════════════════════════════════════

type CharacterConfig = {
  name: string;
  shortName: string;
  role: string;
  avatar: {
    emoji: string;
    bgGradient: string;
    ringColor: string;
    shadowColor: string;
  };
  bubble: {
    bgGradient: string;
    borderColor: string;
    textColor: string;
  };
  nameColor: string;
  isProtagonist?: boolean;
  statusIndicator?: "online" | "typing" | "away" | "none";
};

const SPEAKER_CONFIG: Record<string, CharacterConfig> = {
  fetisov: {
    name: "Виктор Фетисов",
    shortName: "Вы",
    role: "Следователь",
    avatar: {
      emoji: "👤",
      bgGradient: "from-blue-500 via-blue-600 to-indigo-700",
      ringColor: "ring-blue-400/50",
      shadowColor: "shadow-blue-500/30",
    },
    bubble: {
      bgGradient: "from-blue-600 via-blue-700 to-indigo-800",
      borderColor: "border-blue-400/30",
      textColor: "text-white",
    },
    nameColor: "text-blue-400",
    isProtagonist: true,
    statusIndicator: "online",
  },
  expert: {
    name: "Ольга Николаевна",
    shortName: "Эксперт",
    role: "Криминалист",
    avatar: {
      emoji: "🔬",
      bgGradient: "from-purple-500 via-violet-600 to-purple-700",
      ringColor: "ring-purple-400/50",
      shadowColor: "shadow-purple-500/30",
    },
    bubble: {
      bgGradient: "from-purple-900/60 to-violet-900/60",
      borderColor: "border-purple-500/30",
      textColor: "text-purple-100",
    },
    nameColor: "text-purple-400",
    statusIndicator: "online",
  },
  kravchenko: {
    name: "Александр Кравченко",
    shortName: "Кравченко",
    role: "Подозреваемый",
    avatar: {
      emoji: "😰",
      bgGradient: "from-orange-500 via-amber-600 to-orange-700",
      ringColor: "ring-orange-400/50",
      shadowColor: "shadow-orange-500/30",
    },
    bubble: {
      bgGradient: "from-orange-900/50 to-amber-900/50",
      borderColor: "border-orange-500/30",
      textColor: "text-orange-100",
    },
    nameColor: "text-orange-400",
    statusIndicator: "away",
  },
  prosecutor: {
    name: "Прокурор Коржов",
    shortName: "Коржов",
    role: "Прокурор",
    avatar: {
      emoji: "⚖️",
      bgGradient: "from-red-500 via-rose-600 to-red-700",
      ringColor: "ring-red-400/50",
      shadowColor: "shadow-red-500/30",
    },
    bubble: {
      bgGradient: "from-red-900/60 to-rose-900/60",
      borderColor: "border-red-500/30",
      textColor: "text-red-100",
    },
    nameColor: "text-red-400",
    statusIndicator: "online",
  },
  witness: {
    name: "Свидетель",
    shortName: "Свидетель",
    role: "Очевидец",
    avatar: {
      emoji: "👁️",
      bgGradient: "from-emerald-500 via-green-600 to-emerald-700",
      ringColor: "ring-emerald-400/50",
      shadowColor: "shadow-emerald-500/30",
    },
    bubble: {
      bgGradient: "from-emerald-900/50 to-green-900/50",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-100",
    },
    nameColor: "text-emerald-400",
    statusIndicator: "none",
  },
  suspect: {
    name: "Подозреваемый",
    shortName: "Подозреваемый",
    role: "Под следствием",
    avatar: {
      emoji: "🎭",
      bgGradient: "from-amber-500 via-yellow-600 to-amber-700",
      ringColor: "ring-amber-400/50",
      shadowColor: "shadow-amber-500/30",
    },
    bubble: {
      bgGradient: "from-amber-900/50 to-yellow-900/50",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-100",
    },
    nameColor: "text-amber-400",
    statusIndicator: "away",
  },
  operator: {
    name: "Оперативник",
    shortName: "Оперативник",
    role: "МВД СССР",
    avatar: {
      emoji: "👮",
      bgGradient: "from-cyan-500 via-teal-600 to-cyan-700",
      ringColor: "ring-cyan-400/50",
      shadowColor: "shadow-cyan-500/30",
    },
    bubble: {
      bgGradient: "from-cyan-900/50 to-teal-900/50",
      borderColor: "border-cyan-500/30",
      textColor: "text-cyan-100",
    },
    nameColor: "text-cyan-400",
    statusIndicator: "online",
  },
};

// Компонент аватара персонажа
function CharacterAvatar({ config, size = "md" }: { config: CharacterConfig; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-base",
    md: "w-11 h-11 text-xl",
    lg: "w-14 h-14 text-2xl",
  };
  
  return (
    <div className="relative flex-shrink-0">
      <div className={`
        ${sizeClasses[size]}
        rounded-full 
        bg-gradient-to-br ${config.avatar.bgGradient}
        flex items-center justify-center
        ring-2 ${config.avatar.ringColor}
        shadow-lg ${config.avatar.shadowColor}
        transition-transform hover:scale-105
      `}>
        <span className="drop-shadow-sm">{config.avatar.emoji}</span>
      </div>
      
      {/* Статус индикатор */}
      {config.statusIndicator && config.statusIndicator !== "none" && (
        <div className={`
          absolute -bottom-0.5 -right-0.5 
          w-3.5 h-3.5 rounded-full 
          border-2 border-[#0f0f1a]
          ${config.statusIndicator === "online" ? "bg-green-500" : ""}
          ${config.statusIndicator === "typing" ? "bg-blue-500 animate-pulse" : ""}
          ${config.statusIndicator === "away" ? "bg-amber-500" : ""}
        `} />
      )}
    </div>
  );
}

function ParagraphRenderer({
  text,
  tags,
  mood,
}: {
  text: string;
  tags: string[];
  mood: MoodType;
}) {
  const isClue = text.includes("📝") || text.includes("Улика найдена") || hasTag(tags, "clue");
  const isWarning = text.includes("⚠️") || hasTag(tags, "warning");
  const isConsequence = text.includes("✅") || text.includes("💀");
  const isImportant = hasTag(tags, "important");
  const isHeader = text.startsWith("═") || text.startsWith("─") || text.startsWith("ЯНВАРЬ") || text.startsWith("МАРТ") || text.startsWith("СЕНТЯБРЬ");
  const isStats = text.includes("Очки:") || text.includes("Объективность:") || text.includes("ЭПИЗОД") || text.includes("ЗАВЕРШЁН");
  const speakerTag = getTagValue(tags, "speaker");
  const speaker = typeof speakerTag === "string" ? speakerTag : null;
  
  const config = speaker ? SPEAKER_CONFIG[speaker] : null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // СИСТЕМНЫЕ СООБЩЕНИЯ
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Заголовки (даты, локации)
  if (isHeader) {
    return (
      <div className="flex justify-center my-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          {/* Декоративные линии */}
          <div className="absolute inset-y-0 left-0 w-8 border-t border-white/10 top-1/2" />
          <div className="absolute inset-y-0 right-0 w-8 border-t border-white/10 top-1/2" />
          
          <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-white/5 via-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-amber-400 text-sm">📅</span>
            <span className="text-sm font-semibold text-white/80 uppercase tracking-widest">
              {text}
            </span>
          </div>
        </motion.div>
      </div>
    );
  }
  
  // Статистика и итоги
  if (isStats) {
    const lines = text.split("\n");
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 my-6"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-black/90 border border-white/10 shadow-2xl">
          {/* Декоративный фон */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative p-5 space-y-3">
            {lines.map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              
              // Заголовок секции
              if (trimmed.startsWith("═")) {
                return null;
              }
              
              // Название эпизода
              if (trimmed.includes("ЭПИЗОД") || trimmed.includes("ЗАВЕРШЁН")) {
                return (
                  <div key={i} className="text-center pb-3 border-b border-white/10">
                    <span className="text-lg font-bold text-white tracking-wide">{trimmed}</span>
                  </div>
                );
              }
              
              // Метрики с цифрами
              const metricMatch = trimmed.match(/^(.+?):\s*(.+)$/);
              if (metricMatch) {
                const [, label, value] = metricMatch;
                const isScore = label.includes("Очки");
                const isObjectivity = label.includes("Объективность");
                const isKravchenko = label.includes("Кравченко");
                const isAchievement = trimmed.startsWith("✓");
                
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
                    <span className="text-sm text-white/60">{label}</span>
                    <span className={`text-sm font-bold ${
                      isScore ? "text-violet-400" :
                      isObjectivity ? "text-blue-400" :
                      isKravchenko ? "text-emerald-400" :
                      isAchievement ? "text-green-400" :
                      "text-white"
                    }`}>
                      {value}
                    </span>
                  </div>
                );
              }
              
              // Достижения
              if (trimmed.startsWith("✓")) {
                return (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <span className="text-green-400">✓</span>
                    <span className="text-sm text-white/70">{trimmed.replace("✓", "").trim()}</span>
                  </div>
                );
              }
              
              // Заголовки секций
              if (trimmed.endsWith(":")) {
                return (
                  <div key={i} className="text-xs text-white/40 uppercase tracking-wider pt-2 mt-2 border-t border-white/5">
                    {trimmed}
                  </div>
                );
              }
              
              return (
                <div key={i} className="text-sm text-white/70">{trimmed}</div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  }
  
  // Улики
  if (isClue) {
    return (
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, x: -20 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="mx-3 my-4"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900/40 via-green-900/30 to-emerald-900/40 border border-emerald-500/40 shadow-xl shadow-emerald-500/10">
          {/* Анимированная полоса */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400" />
          
          <div className="flex items-center gap-4 p-4">
            {/* Иконка */}
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="text-2xl">🔍</span>
              </div>
              {/* Пульсация */}
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/30 animate-ping" />
            </div>
            
            {/* Контент */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Улика обнаружена
                </span>
                <span className="text-emerald-400/60 text-xs">•</span>
                <span className="text-xs text-emerald-400/60">Добавлено на доску</span>
              </div>
              <p className="text-emerald-100 font-medium leading-snug">
                {text.replace("Улика найдена:", "").trim()}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // Предупреждения
  if (isWarning) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/40 shadow-lg">
          <span className="text-xl animate-pulse">⚠️</span>
          <span className="text-sm font-medium text-amber-200">{text}</span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЧАТ-СООБЩЕНИЯ ОТ ПЕРСОНАЖЕЙ (улучшенный дизайн)
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (speaker && config) {
    const isProtagonist = config.isProtagonist;
    const messageTime = useMemo(() => getRandomTime(), []);
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10, x: isProtagonist ? 20 : -20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`flex gap-3 mb-4 px-2 ${isProtagonist ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Аватар */}
        <CharacterAvatar config={config} size="md" />
        
        {/* Контейнер сообщения */}
        <div className={`flex flex-col max-w-[78%] ${isProtagonist ? "items-end" : "items-start"}`}>
          {/* Имя и роль */}
          <div className={`flex items-center gap-2 mb-1.5 ${isProtagonist ? "flex-row-reverse" : "flex-row"}`}>
            <span className={`text-sm font-semibold ${config.nameColor}`}>
              {config.name}
            </span>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              {config.role}
            </span>
          </div>
          
          {/* Бабл сообщения */}
          <div className={`
            relative overflow-hidden
            px-4 py-3 
            ${isProtagonist 
              ? `rounded-2xl rounded-tr-md bg-gradient-to-br ${config.bubble.bgGradient}` 
              : `rounded-2xl rounded-tl-md bg-gradient-to-br ${config.bubble.bgGradient}`
            }
            border ${config.bubble.borderColor}
            shadow-lg
          `}>
            {/* Текст сообщения */}
            <p className={`text-[15px] leading-relaxed whitespace-pre-line ${config.bubble.textColor}`}>
              {text}
            </p>
            
            {/* Время и статус */}
            <div className={`
              flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/5
              ${isProtagonist ? "justify-end" : "justify-start"}
            `}>
              <span className="text-[10px] text-white/30 font-medium">
                {messageTime}
              </span>
              {isProtagonist && (
                <span className="text-blue-400 text-[10px] font-bold">✓✓</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // НАРРАТИВ (обычный текст без говорящего)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Проверяем на особые форматы
  // ═══════════════════════════════════════════════════════════════════════════
  // ДОКУМЕНТЫ И ДОСЬЕ
  // ═══════════════════════════════════════════════════════════════════════════
  
  const isDOSSIER = text.includes("ДОСЬЕ") || text.includes("ЛИЦА В РАЙОНЕ") || text.includes("НЕРАСКРЫТЫЕ ДЕЛА") || text.includes("ХРОНОЛОГИЯ") || text.includes("ВО ВСЕХ СЛУЧАЯХ");
  
  if (isDOSSIER) {
    const lines = text.split("\n");
    const title = lines.find(l => l.includes("ДОСЬЕ") || l.includes("ЛИЦА") || l.includes("НЕРАСКРЫТЫЕ") || l.includes("ХРОНОЛОГИЯ"));
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-3 my-5"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border border-slate-600/40 shadow-2xl">
          {/* Декоративный элемент "папка" */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />
          
          {/* Заголовок документа */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-600/30 bg-slate-800/50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-xl">📂</span>
            </div>
            <div>
              <div className="text-xs text-amber-400/80 uppercase tracking-wider font-medium">
                Служебный документ
              </div>
              <div className="text-sm font-bold text-white">
                {title || "Материалы дела"}
              </div>
            </div>
            <div className="ml-auto text-xs text-slate-500">
              СССР • 1979
            </div>
          </div>
          
          {/* Контент документа */}
          <div className="p-5">
            <div className="font-mono text-sm text-slate-300 leading-relaxed space-y-1">
              {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed === title) return null;
                
                // Разделители
                if (trimmed.startsWith("═") || trimmed.startsWith("─")) {
                  return <div key={i} className="border-b border-slate-600/30 my-3" />;
                }
                
                // Заголовки секций
                if (trimmed.endsWith(":") && !trimmed.includes("—")) {
                  return (
                    <div key={i} className="text-amber-400 font-semibold mt-3 mb-2 text-xs uppercase tracking-wider">
                      {trimmed}
                    </div>
                  );
                }
                
                // Списки с •
                if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
                  return (
                    <div key={i} className="flex items-start gap-2 pl-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-slate-300">{trimmed.replace(/^[•-]\s*/, "")}</span>
                    </div>
                  );
                }
                
                // Нумерованные списки
                const numMatch = trimmed.match(/^(\d+)[.)]\s*(.+)/);
                if (numMatch) {
                  return (
                    <div key={i} className="flex items-start gap-3 py-1.5 px-2 rounded-lg bg-slate-700/30 mb-1">
                      <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                        {numMatch[1]}
                      </span>
                      <span className="text-slate-200 flex-1">{numMatch[2]}</span>
                    </div>
                  );
                }
                
                return (
                  <div key={i} className="text-slate-300 py-0.5">{trimmed}</div>
                );
              })}
            </div>
          </div>
          
          {/* Штамп */}
          <div className="absolute bottom-4 right-4 opacity-10 rotate-[-15deg]">
            <div className="text-6xl font-bold text-red-500">СЕКРЕТНО</div>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ВАЖНЫЙ ТЕКСТ И ПОСЛЕДСТВИЯ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isImportant || isConsequence) {
    const isPositive = text.includes("✅") || (isConsequence && !text.includes("💀"));
    const isNegative = text.includes("💀") || text.includes("казнён") || text.includes("трагич");
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-3 my-4"
      >
        <div className={`
          relative overflow-hidden p-5 rounded-2xl border shadow-xl
          ${isPositive
            ? "bg-gradient-to-br from-green-900/50 via-emerald-900/40 to-green-900/50 border-green-500/40 shadow-green-500/10"
            : isNegative
              ? "bg-gradient-to-br from-red-900/50 via-rose-900/40 to-red-900/50 border-red-500/40 shadow-red-500/10"
              : "bg-gradient-to-br from-violet-900/50 via-purple-900/40 to-violet-900/50 border-violet-500/40 shadow-violet-500/10"
          }
        `}>
          {/* Иконка */}
          <div className="absolute -top-2 -right-2 text-6xl opacity-10">
            {isPositive ? "✓" : isNegative ? "✗" : "!"}
          </div>
          
          <p className={`
            text-base leading-relaxed whitespace-pre-line relative z-10
            ${isPositive ? "text-green-100" : isNegative ? "text-red-100" : "text-violet-100"}
          `}>
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ОБЫЧНЫЙ НАРРАТИВ
  // ═══════════════════════════════════════════════════════════════════════════
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 my-3"
    >
      <div className={`
        p-4 rounded-2xl 
        ${getMoodNarrativeStyle(mood)}
        shadow-md backdrop-blur-sm
      `}>
        <p className="text-[15px] text-white/90 leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>
    </motion.div>
  );
}

// Генерация случайного времени для сообщений
function getRandomTime(): string {
  const hours = 14 + Math.floor(Math.random() * 6);
  const minutes = Math.floor(Math.random() * 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

// Стили нарратива по настроению
function getMoodNarrativeStyle(mood: MoodType): string {
  switch (mood) {
    case "dark":
    case "horror":
      return "bg-gradient-to-br from-red-950/40 to-black/60 border border-red-900/30";
    case "tense":
    case "pressure":
      return "bg-gradient-to-br from-amber-950/30 to-black/50 border border-amber-900/20";
    case "mystery":
      return "bg-gradient-to-br from-purple-950/40 to-black/60 border border-purple-900/30";
    case "investigation":
      return "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30";
    case "hope":
    case "discovery":
      return "bg-gradient-to-br from-emerald-950/30 to-black/50 border border-emerald-900/20";
    case "conflict":
      return "bg-gradient-to-br from-orange-950/30 to-black/50 border border-orange-900/20";
    default:
      return "bg-white/5 border border-white/10";
  }
}

function EndScreen({ state }: { state: InkState }) {
  const score = (state.variables.score as number) ?? 0;
  const objectivity = (state.variables.objectivity as number) ?? 50;
  const daysRemaining = (state.variables.days_remaining as number) ?? 0;
  const evidenceFor = (state.variables.evidence_for_kravchenko as number) ?? 0;
  
  // Правильная проверка тегов — ищем значение, а не полный текст
  const endingType = getTagValue(state.tags, "ending");
  const hasGoodEnding = endingType === "good" || (!endingType && score >= 50);
  const hasBadEnding = endingType === "bad" || endingType === "tragedy";
  const hasConscienceEnding = endingType === "conscience";
  const hasNeutralEnding = endingType === "neutral";
  
  // Haptic feedback при показе экрана завершения
  useEffect(() => {
    if (hasGoodEnding || hasConscienceEnding) {
      investigationHaptic.caseSolved();
    } else if (hasBadEnding) {
      investigationHaptic.gameOver();
    } else {
      investigationHaptic.sceneTransition();
    }
  }, [hasGoodEnding, hasBadEnding, hasConscienceEnding]);

  // Конфигурация по типу концовки
  const endingConfig = {
    good: {
      icon: "🏆",
      title: "Блестящее расследование!",
      subtitle: "Справедливость восторжествовала",
      gradient: "from-emerald-600 via-green-600 to-emerald-700",
      bgGlow: "bg-emerald-500/20",
      borderColor: "border-emerald-500/40",
    },
    conscience: {
      icon: "⚖️",
      title: "Чистая совесть",
      subtitle: "Вы потеряли карьеру, но сохранили честь",
      gradient: "from-amber-600 via-yellow-600 to-amber-700",
      bgGlow: "bg-amber-500/20",
      borderColor: "border-amber-500/40",
    },
    neutral: {
      icon: "❓",
      title: "Неопределённость",
      subtitle: "История ещё не закончена...",
      gradient: "from-blue-600 via-indigo-600 to-blue-700",
      bgGlow: "bg-blue-500/20",
      borderColor: "border-blue-500/40",
    },
    bad: {
      icon: "💀",
      title: "Судебная ошибка",
      subtitle: "Невиновный казнён. Убийца на свободе.",
      gradient: "from-red-600 via-rose-600 to-red-700",
      bgGlow: "bg-red-500/20",
      borderColor: "border-red-500/40",
    },
  };
  
  const config = hasGoodEnding ? endingConfig.good 
    : hasConscienceEnding ? endingConfig.conscience
    : hasNeutralEnding ? endingConfig.neutral
    : hasBadEnding ? endingConfig.bad
    : endingConfig.neutral;

  return (
    <div className="relative">
      {/* Фоновое свечение */}
      <div className={`absolute inset-0 ${config.bgGlow} blur-3xl opacity-50`} />
      
      <div className="relative space-y-6">
        {/* Главная иконка */}
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex justify-center"
        >
          <div className={`
            w-24 h-24 rounded-full 
            bg-gradient-to-br ${config.gradient}
            flex items-center justify-center
            shadow-2xl ring-4 ring-white/10
          `}>
            <span className="text-5xl">{config.icon}</span>
          </div>
        </motion.div>
        
        {/* Заголовок */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            {config.title}
          </h2>
          <p className="text-white/60 text-sm">
            {config.subtitle}
          </p>
        </motion.div>
        
        {/* Статистика */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-3"
        >
          {/* Очки */}
          <div className={`
            relative overflow-hidden p-4 rounded-2xl 
            bg-gradient-to-br from-violet-900/40 to-purple-900/40 
            border ${config.borderColor}
          `}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/10 rounded-full blur-xl" />
            <div className="relative">
              <div className="text-3xl font-bold text-violet-400 mb-1">
                {score}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Очков
              </div>
            </div>
          </div>
          
          {/* Объективность */}
          <div className={`
            relative overflow-hidden p-4 rounded-2xl 
            bg-gradient-to-br from-blue-900/40 to-indigo-900/40 
            border ${config.borderColor}
          `}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl" />
            <div className="relative">
              <div className={`text-3xl font-bold mb-1 ${
                objectivity >= 70 ? "text-emerald-400" : 
                objectivity >= 40 ? "text-amber-400" : 
                "text-red-400"
              }`}>
                {objectivity}%
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Объективность
              </div>
            </div>
          </div>
          
          {/* Улики в защиту */}
          <div className={`
            relative overflow-hidden p-4 rounded-2xl 
            bg-gradient-to-br from-emerald-900/40 to-green-900/40 
            border ${config.borderColor}
          `}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl" />
            <div className="relative">
              <div className="text-3xl font-bold text-emerald-400 mb-1">
                {evidenceFor}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Улик найдено
              </div>
            </div>
          </div>
          
          {/* Дни */}
          <div className={`
            relative overflow-hidden p-4 rounded-2xl 
            bg-gradient-to-br from-amber-900/40 to-orange-900/40 
            border ${config.borderColor}
          `}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />
            <div className="relative">
              <div className="text-3xl font-bold text-amber-400 mb-1">
                {3 - daysRemaining}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Дней прошло
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Рейтинг */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.span
              key={star}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + star * 0.1 }}
              className={`text-2xl ${
                (hasGoodEnding && star <= 5) ||
                (hasConscienceEnding && star <= 4) ||
                (hasNeutralEnding && star <= 3) ||
                (hasBadEnding && star <= 1)
                  ? "text-amber-400"
                  : "text-white/20"
              }`}
            >
              ★
            </motion.span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// СТИЛИ ПО НАСТРОЕНИЮ
// ══════════════════════════════════════════════════════════════════════════════

function getMoodStyles(mood: MoodType) {
  const styles: Record<
    MoodType,
    {
      background: string;
      accent: string;
      border: string;
      choicesBackground: string;
      choiceButton: string;
      choiceLetter: string;
    }
  > = {
    normal: {
      background: "bg-[#0a0a12]",
      accent: "bg-violet-500/20 text-violet-300",
      border: "border-white/10",
      choicesBackground: "bg-gradient-to-t from-[#0a0a12] to-transparent",
      choiceButton: "bg-white/5 border border-white/10 hover:border-violet-500/50",
      choiceLetter: "text-violet-400",
    },
    dark: {
      background: "bg-[#080810]",
      accent: "bg-slate-700/50 text-slate-300",
      border: "border-slate-800",
      choicesBackground: "bg-gradient-to-t from-[#080810] to-transparent",
      choiceButton: "bg-slate-900/50 border border-slate-700/50 hover:border-slate-500/50",
      choiceLetter: "text-slate-400",
    },
    tense: {
      background: "bg-[#0c0a10]",
      accent: "bg-amber-500/20 text-amber-300",
      border: "border-amber-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0a10] to-transparent",
      choiceButton: "bg-amber-950/30 border border-amber-800/30 hover:border-amber-500/50",
      choiceLetter: "text-amber-400",
    },
    horror: {
      background: "bg-[#0a0608]",
      accent: "bg-red-900/50 text-red-300",
      border: "border-red-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0a0608] to-transparent",
      choiceButton: "bg-red-950/30 border border-red-900/40 hover:border-red-500/50",
      choiceLetter: "text-red-400",
    },
    hope: {
      background: "bg-[#080a0c]",
      accent: "bg-emerald-500/20 text-emerald-300",
      border: "border-emerald-900/30",
      choicesBackground: "bg-gradient-to-t from-[#080a0c] to-transparent",
      choiceButton: "bg-emerald-950/30 border border-emerald-800/30 hover:border-emerald-500/50",
      choiceLetter: "text-emerald-400",
    },
    mystery: {
      background: "bg-[#0a080c]",
      accent: "bg-purple-500/20 text-purple-300",
      border: "border-purple-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0a080c] to-transparent",
      choiceButton: "bg-purple-950/30 border border-purple-800/30 hover:border-purple-500/50",
      choiceLetter: "text-purple-400",
    },
    investigation: {
      background: "bg-[#0a0a0e]",
      accent: "bg-blue-500/20 text-blue-300",
      border: "border-blue-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0a0a0e] to-transparent",
      choiceButton: "bg-blue-950/30 border border-blue-800/30 hover:border-blue-500/50",
      choiceLetter: "text-blue-400",
    },
    conflict: {
      background: "bg-[#0c0808]",
      accent: "bg-orange-500/20 text-orange-300",
      border: "border-orange-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0808] to-transparent",
      choiceButton: "bg-orange-950/30 border border-orange-800/30 hover:border-orange-500/50",
      choiceLetter: "text-orange-400",
    },
    stakeout: {
      background: "bg-[#08090a]",
      accent: "bg-cyan-500/20 text-cyan-300",
      border: "border-cyan-900/30",
      choicesBackground: "bg-gradient-to-t from-[#08090a] to-transparent",
      choiceButton: "bg-cyan-950/30 border border-cyan-800/30 hover:border-cyan-500/50",
      choiceLetter: "text-cyan-400",
    },
    pressure: {
      background: "bg-[#0c0a08]",
      accent: "bg-rose-500/20 text-rose-300",
      border: "border-rose-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0a08] to-transparent",
      choiceButton: "bg-rose-950/30 border border-rose-800/30 hover:border-rose-500/50",
      choiceLetter: "text-rose-400",
    },
    discovery: {
      background: "bg-[#0a0c0a]",
      accent: "bg-lime-500/20 text-lime-300",
      border: "border-lime-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0a0c0a] to-transparent",
      choiceButton: "bg-lime-950/30 border border-lime-800/30 hover:border-lime-500/50",
      choiceLetter: "text-lime-400",
    },
    crossroads: {
      background: "bg-[#0a0a0c]",
      accent: "bg-indigo-500/20 text-indigo-300",
      border: "border-indigo-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0a0a0c] to-transparent",
      choiceButton: "bg-indigo-950/30 border border-indigo-800/30 hover:border-indigo-500/50",
      choiceLetter: "text-indigo-400",
    },
    professional: {
      background: "bg-[#0a0a0a]",
      accent: "bg-zinc-500/20 text-zinc-300",
      border: "border-zinc-800",
      choicesBackground: "bg-gradient-to-t from-[#0a0a0a] to-transparent",
      choiceButton: "bg-zinc-900/50 border border-zinc-700/50 hover:border-zinc-500/50",
      choiceLetter: "text-zinc-400",
    },
  };

  return styles[mood] || styles.normal;
}

function getMoodParagraphStyle(mood: MoodType): string {
  const styles: Record<MoodType, string> = {
    normal: "bg-white/5",
    dark: "bg-slate-900/30 border border-slate-800/50",
    tense: "bg-amber-950/20 border border-amber-900/30",
    horror: "bg-red-950/20 border border-red-900/30",
    hope: "bg-emerald-950/20 border border-emerald-900/30",
    mystery: "bg-purple-950/20 border border-purple-900/30",
    investigation: "bg-blue-950/20 border border-blue-900/30",
    conflict: "bg-orange-950/20 border border-orange-900/30",
    stakeout: "bg-cyan-950/20 border border-cyan-900/30",
    pressure: "bg-rose-950/20 border border-rose-900/30",
    discovery: "bg-lime-950/20 border border-lime-900/30",
    crossroads: "bg-indigo-950/20 border border-indigo-900/30",
    professional: "bg-zinc-900/30 border border-zinc-800/50",
  };

  return styles[mood] || styles.normal;
}

export default InkStoryPlayer;
