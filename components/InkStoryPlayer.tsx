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

// Портреты персонажей — будут использоваться если добавить изображения
const CHARACTER_PORTRAITS: Record<string, { name: string; image: string; color: string }> = {};

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
    let initialOutput: InkState;
    
    if (initialState) {
      runner.loadState(initialState);
      // После loadState нужно continue() чтобы получить текущие параграфы
      initialOutput = runner.continue();
    } else {
      // reset() уже вызывает continue() внутри, поэтому используем getState()
      runner.reset();
      initialOutput = runner.getState();
    }
    
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
    <div className={`flex flex-col h-full ${moodStyles.background} ${className} relative`}>
      {/* Атмосферные эффекты */}
      <AtmosphericOverlay mood={currentMood} />
      
      {/* Индикатор настроения */}
      <AnimatePresence>
        <MoodIndicator mood={currentMood} />
      </AnimatePresence>
      
      {/* Хедер с главой и статистикой */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 relative z-10">
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
        <AnimatePresence>
          {isTyping && displayedParagraphs < state.paragraphs.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-center py-5"
            >
              <div className="flex items-center gap-3">
                {/* Анимированные точки */}
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 bg-white/30 rounded-full"
                      animate={{ 
                        y: [0, -4, 0],
                        opacity: [0.3, 0.7, 0.3]
                      }}
                      transition={{ 
                        duration: 0.8, 
                        repeat: Infinity, 
                        delay: i * 0.15,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
                
                {/* Подсказка */}
                <span className="text-[10px] text-white/25 tracking-wide">
                  tap to skip
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Выборы — Elegant Interactive Style */}
      <AnimatePresence>
        {showChoices && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative px-4 pt-4 pb-6"
          >
            {/* Тонкий разделитель */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Кнопки выборов */}
            <div className="relative space-y-2.5 pt-2">
              {state.choices.map((choice, index) => (
                <motion.button
                  key={choice.index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    delay: 0.1 + index * 0.06, 
                    duration: 0.3,
                    ease: "easeOut"
                  }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => handleChoice(choice.index)}
                  className="
                    group w-full text-left
                    px-4 py-3.5 rounded-xl 
                    bg-white/[0.03] hover:bg-white/[0.06]
                    border border-white/[0.05] hover:border-white/[0.1]
                    transition-all duration-200 ease-out
                  "
                >
                  <div className="flex items-center gap-3.5">
                    {/* Индикатор с мягким градиентом */}
                    <div className="
                      relative w-7 h-7 rounded-lg
                      bg-gradient-to-br from-white/[0.08] to-white/[0.03]
                      group-hover:from-violet-500/20 group-hover:to-purple-500/10
                      flex items-center justify-center
                      transition-all duration-200
                    ">
                      <span className="text-[11px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">
                        {String.fromCharCode(65 + index)}
                      </span>
                    </div>
                    
                    {/* Текст выбора */}
                    <span className="flex-1 text-[14px] text-white/70 group-hover:text-white/90 transition-colors duration-200 leading-snug">
                      {choice.text}
                    </span>
                    
                    {/* Стрелка */}
                    <svg 
                      className="w-4 h-4 text-white/0 group-hover:text-white/40 transition-all duration-200 transform group-hover:translate-x-0.5" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              ))}
            </div>
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

// ═══════════════════════════════════════════════════════════════════════════════
// TYPEWRITER ЭФФЕКТ — посимвольная анимация как в Disco Elysium
// ═══════════════════════════════════════════════════════════════════════════════

function TypewriterText({ 
  text, 
  speed = 25, 
  onComplete,
  className = "",
  skipAnimation = false,
}: { 
  text: string; 
  speed?: number; 
  onComplete?: () => void;
  className?: string;
  skipAnimation?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(skipAnimation);
  
  useEffect(() => {
    if (skipAnimation) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }
    
    setDisplayedText("");
    setIsComplete(false);
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed, skipAnimation, onComplete]);
  
  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <motion.span
          className="inline-block w-0.5 h-[1.1em] bg-current ml-0.5 align-middle"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// АТМОСФЕРНЫЕ ЭФФЕКТЫ — Scan Lines, Vignette, Noise
// ═══════════════════════════════════════════════════════════════════════════════

function AtmosphericOverlay({ mood, intensity = 0.5 }: { mood: MoodType; intensity?: number }) {
  const showScanLines = mood === "horror" || mood === "tense" || mood === "pressure";
  const showVignette = mood !== "normal" && mood !== "hope";
  const showNoise = mood === "horror" || mood === "dark";
  const vignetteColor = 
    mood === "horror" ? "rgba(80, 0, 0, 0.4)" :
    mood === "tense" ? "rgba(60, 40, 0, 0.3)" :
    mood === "mystery" ? "rgba(40, 0, 60, 0.3)" :
    "rgba(0, 0, 0, 0.3)";
  
  return (
    <>
      {/* Scan Lines - ретро эффект */}
      {showScanLines && (
        <div 
          className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, ${intensity}) 2px,
              rgba(0, 0, 0, ${intensity}) 4px
            )`,
          }}
        />
      )}
      
      {/* Vignette - затемнение по краям */}
      {showVignette && (
        <div 
          className="pointer-events-none fixed inset-0 z-[99]"
          style={{
            background: `radial-gradient(ellipse at center, transparent 40%, ${vignetteColor} 100%)`,
          }}
        />
      )}
      
      {/* Film Grain / Noise - для horror */}
      {showNoise && (
        <motion.div 
          className="pointer-events-none fixed inset-0 z-[98] opacity-[0.08]"
          animate={{ 
            backgroundPosition: ["0% 0%", "100% 100%", "0% 100%", "100% 0%", "0% 0%"] 
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOOD INDICATOR — визуальный индикатор настроения сцены
// ═══════════════════════════════════════════════════════════════════════════════

const MOOD_INDICATORS: Record<MoodType, { icon: string; label: string; color: string }> = {
  normal: { icon: "📖", label: "", color: "text-white/40" },
  dark: { icon: "🌑", label: "Мрак", color: "text-slate-400" },
  tense: { icon: "⚡", label: "Напряжение", color: "text-amber-400" },
  horror: { icon: "💀", label: "Ужас", color: "text-red-400" },
  hope: { icon: "✨", label: "Надежда", color: "text-emerald-400" },
  mystery: { icon: "🔮", label: "Тайна", color: "text-purple-400" },
  investigation: { icon: "🔍", label: "Расследование", color: "text-blue-400" },
  conflict: { icon: "⚔️", label: "Конфликт", color: "text-orange-400" },
  stakeout: { icon: "👁️", label: "Слежка", color: "text-cyan-400" },
  pressure: { icon: "🎯", label: "Давление", color: "text-rose-400" },
  discovery: { icon: "💡", label: "Открытие", color: "text-lime-400" },
  crossroads: { icon: "🔀", label: "Развилка", color: "text-indigo-400" },
  professional: { icon: "📋", label: "Работа", color: "text-zinc-400" },
};

function MoodIndicator({ mood, show = true }: { mood: MoodType; show?: boolean }) {
  const indicator = MOOD_INDICATORS[mood];
  
  if (!show || mood === "normal") return null;
  
  const dotColor = 
    mood === "horror" || mood === "dark" ? "bg-red-400 shadow-red-400/50" :
    mood === "tense" || mood === "pressure" ? "bg-amber-400 shadow-amber-400/50" :
    mood === "mystery" ? "bg-violet-400 shadow-violet-400/50" :
    mood === "discovery" || mood === "hope" ? "bg-emerald-400 shadow-emerald-400/50" :
    mood === "investigation" ? "bg-blue-400 shadow-blue-400/50" :
    "bg-white/40";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed bottom-24 left-4 z-50"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/[0.06]">
        {/* Пульсирующая точка */}
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${dotColor} shadow-sm`} />
          <motion.div 
            className={`absolute inset-0 rounded-full ${dotColor} opacity-50`}
            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <span className="text-[10px] font-medium text-white/60 uppercase tracking-widest">
          {indicator.label}
        </span>
      </div>
    </motion.div>
  );
}

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
  // ═══════════════════════════════════════════════════════════════════════════
  // КРАСНЫЙ ЛЕС — Персонажи
  // ═══════════════════════════════════════════════════════════════════════════
  
  ssorokin: {
    name: "Виктор Сорокин",
    shortName: "Вы",
    role: "Следователь",
    avatar: {
      emoji: "🔍",
      bgGradient: "from-slate-500 via-slate-600 to-slate-700",
      ringColor: "ring-slate-400/50",
      shadowColor: "shadow-slate-500/30",
    },
    bubble: {
      bgGradient: "from-slate-700 via-slate-800 to-slate-900",
      borderColor: "border-slate-500/30",
      textColor: "text-white",
    },
    nameColor: "text-slate-300",
    isProtagonist: true,
    statusIndicator: "online",
  },
  gromov: {
    name: "Майор Громов",
    shortName: "Громов",
    role: "Начальник милиции",
    avatar: {
      emoji: "👮‍♂️",
      bgGradient: "from-red-700 via-red-800 to-red-900",
      ringColor: "ring-red-500/50",
      shadowColor: "shadow-red-600/30",
    },
    bubble: {
      bgGradient: "from-red-900/60 to-red-950/60",
      borderColor: "border-red-600/30",
      textColor: "text-red-100",
    },
    nameColor: "text-red-400",
    statusIndicator: "away",
  },
  vera: {
    name: "Вера Холодова",
    shortName: "Вера",
    role: "Психиатр",
    avatar: {
      emoji: "👩‍⚕️",
      bgGradient: "from-violet-500 via-purple-600 to-violet-700",
      ringColor: "ring-violet-400/50",
      shadowColor: "shadow-violet-500/30",
    },
    bubble: {
      bgGradient: "from-violet-900/60 to-purple-900/60",
      borderColor: "border-violet-500/30",
      textColor: "text-violet-100",
    },
    nameColor: "text-violet-400",
    statusIndicator: "online",
  },
  serafim: {
    name: "Отец Серафим",
    shortName: "Серафим",
    role: "Священник",
    avatar: {
      emoji: "✝️",
      bgGradient: "from-amber-600 via-yellow-700 to-amber-800",
      ringColor: "ring-amber-400/50",
      shadowColor: "shadow-amber-500/30",
    },
    bubble: {
      bgGradient: "from-amber-900/50 to-yellow-900/50",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-100",
    },
    nameColor: "text-amber-400",
    statusIndicator: "none",
  },
  tanya: {
    name: "Таня Зорина",
    shortName: "Таня",
    role: "Инженер",
    avatar: {
      emoji: "👩‍🔧",
      bgGradient: "from-emerald-500 via-teal-600 to-emerald-700",
      ringColor: "ring-emerald-400/50",
      shadowColor: "shadow-emerald-500/30",
    },
    bubble: {
      bgGradient: "from-emerald-900/50 to-teal-900/50",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-100",
    },
    nameColor: "text-emerald-400",
    statusIndicator: "online",
  },
  astahov: {
    name: "Полковник Астахов",
    shortName: "Астахов",
    role: "КГБ",
    avatar: {
      emoji: "🕴️",
      bgGradient: "from-gray-600 via-gray-700 to-gray-800",
      ringColor: "ring-gray-500/50",
      shadowColor: "shadow-gray-600/30",
    },
    bubble: {
      bgGradient: "from-gray-800/70 to-gray-900/70",
      borderColor: "border-gray-600/30",
      textColor: "text-gray-200",
    },
    nameColor: "text-gray-400",
    statusIndicator: "online",
  },
  klava: {
    name: "Клавдия Петровна",
    shortName: "Клава",
    role: "Администратор",
    avatar: {
      emoji: "👵",
      bgGradient: "from-pink-500 via-rose-600 to-pink-700",
      ringColor: "ring-pink-400/50",
      shadowColor: "shadow-pink-500/30",
    },
    bubble: {
      bgGradient: "from-pink-900/50 to-rose-900/50",
      borderColor: "border-pink-500/30",
      textColor: "text-pink-100",
    },
    nameColor: "text-pink-400",
    statusIndicator: "none",
  },
  chernov: {
    name: "Академик Чернов",
    shortName: "Чернов",
    role: "Учёный",
    avatar: {
      emoji: "🧪",
      bgGradient: "from-indigo-600 via-blue-700 to-indigo-800",
      ringColor: "ring-indigo-400/50",
      shadowColor: "shadow-indigo-500/30",
    },
    bubble: {
      bgGradient: "from-indigo-900/60 to-blue-900/60",
      borderColor: "border-indigo-500/30",
      textColor: "text-indigo-100",
    },
    nameColor: "text-indigo-400",
    statusIndicator: "away",
  },
  cultist: {
    name: "Голос из тьмы",
    shortName: "???",
    role: "",
    avatar: {
      emoji: "👁️",
      bgGradient: "from-red-900 via-black to-red-950",
      ringColor: "ring-red-700/50",
      shadowColor: "shadow-red-900/30",
    },
    bubble: {
      bgGradient: "from-black/80 to-red-950/80",
      borderColor: "border-red-800/30",
      textColor: "text-red-200",
    },
    nameColor: "text-red-600",
    statusIndicator: "none",
  },
};

// Компонент аватара персонажа — Simple Circle Style
function CharacterAvatar({ config, size = "md" }: { config: CharacterConfig; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };
  
  return (
    <div className={`
      ${sizeClasses[size]}
      rounded-full 
      bg-gradient-to-br ${config.avatar.bgGradient}
      flex items-center justify-center
      flex-shrink-0
    `}>
      {config.avatar.emoji}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ГЛОБАЛЬНЫЙ СЧЁТЧИК ВРЕМЕНИ ДЛЯ СООБЩЕНИЙ
// ═══════════════════════════════════════════════════════════════════════════════

let globalMessageTime = { hours: 16, minutes: 42 }; // Начало: 16:42

function getNextMessageTime(): string {
  // Добавляем 1-3 минуты к каждому сообщению
  globalMessageTime.minutes += 1 + Math.floor(Math.random() * 3);
  
  if (globalMessageTime.minutes >= 60) {
    globalMessageTime.hours += 1;
    globalMessageTime.minutes -= 60;
  }
  
  if (globalMessageTime.hours >= 24) {
    globalMessageTime.hours = 0;
  }
  
  return `${globalMessageTime.hours}:${globalMessageTime.minutes.toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ЧАТ-СООБЩЕНИЕ С TYPING INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function ChatMessage({ 
  text, 
  config, 
  isProtagonist 
}: { 
  text: string; 
  config: CharacterConfig; 
  isProtagonist: boolean;
}) {
  const [phase, setPhase] = useState<'typing' | 'message'>('typing');
  const messageTime = useRef(getNextMessageTime()).current;
  
  useEffect(() => {
    // Протагонист — сразу показываем сообщение
    if (isProtagonist) {
      setPhase('message');
      return;
    }
    
    // Для других — сначала typing, потом сообщение
    const typingDuration = Math.min(500 + text.length * 10, 1500);
    
    const timer = setTimeout(() => {
      setPhase('message');
    }, typingDuration);
    
    return () => clearTimeout(timer);
  }, [isProtagonist, text.length]);
  
  return (
    <div className={`flex items-end gap-2.5 mb-4 px-3 ${isProtagonist ? "flex-row-reverse" : "flex-row"}`}>
      {/* Аватар — только для не-протагониста */}
      {!isProtagonist && (
        <div className="flex-shrink-0 mb-5">
          <div className={`
            w-9 h-9 rounded-full 
            bg-gradient-to-br ${config.avatar.bgGradient}
            flex items-center justify-center
            text-base shadow-lg
          `}>
            {config.avatar.emoji}
          </div>
        </div>
      )}
      
      {/* Контейнер сообщения */}
      <div className={`flex flex-col max-w-[80%] ${isProtagonist ? "items-end" : "items-start"}`}>
        {/* Имя и роль — только для не-протагониста */}
        {!isProtagonist && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <span className={`text-[12px] font-semibold ${config.nameColor}`}>
              {config.name}
            </span>
            {config.role && (
              <span className="text-[10px] text-white/30">
                {config.role}
              </span>
            )}
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {/* Typing indicator */}
          {phase === 'typing' && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
              className="px-4 py-3 rounded-2xl rounded-bl-md bg-[#1c1c1e]"
            >
              <div className="flex items-center gap-[5px]">
                <motion.span
                  className="w-[6px] h-[6px] bg-white/40 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                />
                <motion.span
                  className="w-[6px] h-[6px] bg-white/40 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.12 }}
                />
                <motion.span
                  className="w-[6px] h-[6px] bg-white/40 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.24 }}
                />
              </div>
            </motion.div>
          )}
          
          {/* Сообщение */}
          {phase === 'message' && (
            <motion.div
              key="message"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className={`
                px-3.5 py-2.5 max-w-full
                ${isProtagonist 
                  ? "bg-[#0a84ff] rounded-[18px] rounded-br-[4px]" 
                  : "bg-[#1c1c1e] rounded-[18px] rounded-bl-[4px]"
                }
              `}
            >
              <p className="text-[15px] text-white leading-[1.4] whitespace-pre-line">
                {text}
              </p>
              
              {/* Время */}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-white/35">
                  {messageTime}
                </span>
                {isProtagonist && (
                  <span className="text-[9px] text-white/50">✓✓</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Пустое место для баланса если протагонист */}
      {isProtagonist && <div className="w-9" />}
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
  // ═══════════════════════════════════════════════════════════════════════════
  // ОПРЕДЕЛЕНИЕ ТИПА КОНТЕНТА
  // ═══════════════════════════════════════════════════════════════════════════
  
  const speakerTag = getTagValue(tags, "speaker");
  const speaker = typeof speakerTag === "string" ? speakerTag : null;
  const config = speaker ? SPEAKER_CONFIG[speaker] : null;
  
  // Типы контента
  const isClue = text.includes("Улика найдена") || text.includes("Улики найдены") || hasTag(tags, "clue");
  const isWarning = text.includes("⚠️") || hasTag(tags, "warning");
  const isConsequence = text.includes("ПОСЛЕДСТВИЕ") || text.includes("✅") || text.includes("💀");
  const isImportant = hasTag(tags, "important");
  const isEnding = text.includes("ЭПИЗОД") && text.includes("ЗАВЕРШЁН");
  const isStats = (text.includes("Ваш счёт:") || text.includes("Объективность:")) && !isEnding;
  
  // Блокнот следователя
  const isNotebookHeader = /^[А-ЯЁ]+:$/.test(text.trim()); // "КРАВЧЕНКО:", "НЕИЗВЕСТНЫЙ:"
  const isNotebookIntro = text.includes("блокнот") || text.includes("колонк");
  const isPositiveFact = text.includes("— факт") || text.includes("- факт") || 
                         text.includes("Соответствует описанию") || text.includes("Интеллигентный вид");
  const isNegativeFact = text.includes("НЕ совпадает") || text.includes("Не соответствует") || 
                         text.includes("не совпадает") || text.includes("не соответствует");
  const isQuestionFact = text.trim().endsWith("?") && text.length < 60 && 
                         !text.startsWith("—") && !text.startsWith("–") && !text.startsWith("- ");
  const isNeutralFact = (text.includes("данных") || text.includes("Никаких")) && text.length < 40;
  
  // Определение даты (например: "22 ДЕКАБРЯ 1978 ГОДА")
  const isDate = /^\d{1,2}\s+(ЯНВАРЯ|ФЕВРАЛЯ|МАРТА|АПРЕЛЯ|МАЯ|ИЮНЯ|ИЮЛЯ|АВГУСТА|СЕНТЯБРЯ|ОКТЯБРЯ|НОЯБРЯ|ДЕКАБРЯ)\s+\d{4}/i.test(text.trim());
  
  // Определение локации (короткий текст с названием места)
  const isLocation = !isDate && text.length < 60 && (
    text.includes("Город") || 
    text.includes("область") || 
    text.includes("Лесополоса") ||
    text.includes("станция") ||
    /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/.test(text.trim()) // Название места
  );
  
  // Определение года (отдельная строка с годом)
  const isYear = /^\d{4}\s*(ГОД|ГОДЫ)?$/i.test(text.trim()) || /^\d{4}-\d{4}\s*(ГОДЫ)?$/i.test(text.trim());
  
  // Определение заголовка
  const isHeader = text.startsWith("═") || text.startsWith("─") || isDate || isYear;
  
  // Диалог (начинается с тире)
  const isDialogue = text.startsWith("—") || text.startsWith("–") || text.startsWith("- ");
  
  // Списки (маркированные или нумерованные)
  const isList = text.includes("\n-") || text.includes("\n•") || /\n\d+[.)]/.test(text);
  
  // Короткий драматичный текст
  const isShortDramatic = text.length < 40 && text.trim().endsWith(".") && !isLocation && !isDate;
  
  // Многоточие (пауза)
  const isPause = text.trim() === "..." || text.trim() === "…";

  // ═══════════════════════════════════════════════════════════════════════════
  // ДАТА — крупный заголовок
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isDate) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-8 text-center"
      >
        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="text-[13px] font-bold text-white/70 uppercase tracking-[0.3em]">
            {text}
          </span>
        </motion.div>
        <motion.div 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="w-16 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent mx-auto mt-4"
        />
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ГОД — минималистичный заголовок для временных скачков
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isYear) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="py-6 text-center"
      >
        <span className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-[0.4em]">
          {text}
        </span>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЛОКАЦИЯ — подзаголовок
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isLocation) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="py-2 text-center"
      >
        <span className="text-[12px] text-white/50 tracking-wide">
          {text}
        </span>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ПАУЗА (многоточие) — драматическая пауза
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isPause) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="py-6 text-center"
      >
        <motion.span 
          className="text-2xl text-white/30 tracking-[0.5em]"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          •••
        </motion.span>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЗАГОЛОВОК (разделитель)
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isHeader && !isDate && !isYear) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-4"
      >
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // УЛИКА — минималистичный inline-тег
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isClue) {
    const clueText = text
      .replace(/Улика найдена:\s*/i, "")
      .replace(/Улики найдены:\s*/i, "")
      .trim();
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center my-3 px-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
          <span className="text-xs">🔍</span>
          <span className="text-[11px] text-emerald-400 font-medium">
            {clueText}
          </span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ПОСЛЕДСТВИЕ — драматический блок
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isConsequence) {
    const isNegative = text.includes("казнён") || text.includes("Невиновный") || text.includes("💀");
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-4 my-6"
      >
        <div className={`
          px-4 py-4 rounded-xl border
          ${isNegative 
            ? "bg-red-500/10 border-red-500/30" 
            : "bg-amber-500/10 border-amber-500/30"
          }
        `}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            isNegative ? "text-red-400" : "text-amber-400"
          }`}>
            Последствие
          </span>
          <p className={`text-[14px] mt-2 leading-relaxed ${
            isNegative ? "text-red-100" : "text-amber-100"
          }`}>
            {text.replace("ПОСЛЕДСТВИЕ:", "").trim()}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЗАВЕРШЕНИЕ ЭПИЗОДА
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isEnding) {
    const isBad = text.includes("ПЛОХАЯ");
    const isGood = text.includes("ХОРОШИЙ") || !isBad;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-4 my-8 text-center"
      >
        <div className={`
          py-6 px-4 rounded-2xl border
          ${isBad 
            ? "bg-red-500/5 border-red-500/20" 
            : "bg-emerald-500/5 border-emerald-500/20"
          }
        `}>
          <div className="text-3xl mb-3">{isBad ? "💀" : "✓"}</div>
          <p className={`text-[13px] font-bold uppercase tracking-wider ${
            isBad ? "text-red-400" : "text-emerald-400"
          }`}>
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // СТАТИСТИКА
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isStats) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-4 my-4"
      >
        <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[13px] text-white/60 leading-relaxed whitespace-pre-line">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ПРЕДУПРЕЖДЕНИЯ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isWarning) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-4 my-4"
      >
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <span className="text-lg">⚠️</span>
          <span className="text-[13px] text-amber-200">{text}</span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЧАТ-СООБЩЕНИЯ ОТ ПЕРСОНАЖЕЙ
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Если есть тег speaker — используем его
  if (speaker && config) {
    return (
      <ChatMessage 
        text={text} 
        config={config} 
        isProtagonist={config.isProtagonist || false} 
      />
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // АВТООПРЕДЕЛЕНИЕ ДИАЛОГОВ (текст начинается с тире)
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isDialogue) {
    const dialogueText = text.replace(/^[—–-]\s*/, "").trim();
    
    // Умное определение персонажа по контексту
    const detectCharacter = (txt: string): CharacterConfig | null => {
      const lowerText = txt.toLowerCase();
      
      // Эксперт / Судмедэксперт Ольга Николаевна
      if (lowerText.includes("эксперт") || lowerText.includes("ольга") || 
          lowerText.includes("николаевн") || lowerText.includes("судмед") ||
          lowerText.includes("группа крови") || lowerText.includes("ранени") ||
          lowerText.includes("жертва") || lowerText.includes("смерть наступила") ||
          lowerText.includes("михаил сергеевич") || lowerText.includes("не договаривает") ||
          lowerText.includes("за 20 лет") || lowerText.includes("причина смерти") ||
          lowerText.includes("орудие") || lowerText.includes("следы насилия") ||
          lowerText.includes("тело") || lowerText.includes("труп") ||
          lowerText.includes("вскрытие") || lowerText.includes("сантиметр")) {
        return {
          name: "Ольга Николаевна",
          shortName: "Эксперт",
          role: "Судмедэксперт",
          avatar: {
            emoji: "👩‍⚕️",
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
        };
      }
      
      // Оперативник / Дежурный
      if (lowerText.includes("дежурн") || lowerText.includes("рации") || 
          lowerText.includes("товарищ следователь") || lowerText.includes("опер") ||
          lowerText.includes("там страшно") || lowerText.includes("зацепка")) {
        return {
          name: "Оперативник Горюнов",
          shortName: "Горюнов",
          role: "Оперуполномоченный",
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
        };
      }
      
      // Прокурор
      if (lowerText.includes("прокурор") || lowerText.includes("политическ") ||
          lowerText.includes("народ требует") || lowerText.includes("обком")) {
        return {
          name: "Прокурор города",
          shortName: "Прокурор",
          role: "Надзор",
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
        };
      }
      
      // Свидетель / Бабушка
      if (lowerText.includes("свидетел") || lowerText.includes("видела") || 
          lowerText.includes("бабушка") || lowerText.includes("соседка") ||
          lowerText.includes("мужчина") || lowerText.includes("плащ")) {
        return {
          name: "Свидетельница",
          shortName: "Свидетель",
          role: "Местная жительница",
          avatar: {
            emoji: "👵",
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
        };
      }
      
      // Участковый
      if (lowerText.includes("участков") || lowerText.includes("станция") ||
          lowerText.includes("электрички")) {
        return {
          name: "Участковый",
          shortName: "Участковый",
          role: "Местный отдел",
          avatar: {
            emoji: "👮‍♂️",
            bgGradient: "from-blue-500 via-blue-600 to-indigo-700",
            ringColor: "ring-blue-400/50",
            shadowColor: "shadow-blue-500/30",
          },
          bubble: {
            bgGradient: "from-blue-900/50 to-indigo-900/50",
            borderColor: "border-blue-500/30",
            textColor: "text-blue-100",
          },
          nameColor: "text-blue-400",
          statusIndicator: "online",
        };
      }
      
      // Подозреваемый Кравченко
      if (lowerText.includes("не убивал") || lowerText.includes("исправился") ||
          lowerText.includes("кравченко") || lowerText.includes("сидел")) {
        return {
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
        };
      }
      
      // Дефолтный — внутренние мысли протагониста
      return null; // null = мысли, не NPC
    };
    
    const dialogueConfig = detectCharacter(dialogueText);
    
    // Если config === null — это внутренние мысли
    if (dialogueConfig === null) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="py-3 px-5"
        >
          <div className="relative max-w-[85%] mx-auto">
            {/* Внутренний голос — курсивом, с эффектом мысли */}
            <p className="text-[14px] text-white/60 leading-[1.8] text-center italic">
              <span className="text-white/30 mr-1">«</span>
              {dialogueText}
              <span className="text-white/30 ml-1">»</span>
            </p>
          </div>
        </motion.div>
      );
    }
    
    return (
      <ChatMessage 
        text={dialogueText} 
        config={dialogueConfig} 
        isProtagonist={false} 
      />
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
  // БЛОКНОТ СЛЕДОВАТЕЛЯ — Заголовок персонажа
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isNotebookHeader) {
    const name = text.trim().replace(":", "");
    const isKnown = name === "КРАВЧЕНКО";
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mt-6 mb-2 px-4"
      >
        <div className="flex items-center gap-2">
          <div className={`
            w-7 h-7 rounded-lg flex items-center justify-center text-sm
            ${isKnown 
              ? "bg-orange-500/20 text-orange-400" 
              : "bg-slate-500/20 text-slate-400"}
          `}>
            {isKnown ? "👤" : "❓"}
          </div>
          <span className={`
            text-[13px] font-bold tracking-wide
            ${isKnown ? "text-orange-400" : "text-slate-400"}
          `}>
            {name}
          </span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОКНОТ — Вступление
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isNotebookIntro) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-4 px-4"
      >
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-sm">📓</span>
          <span className="text-[13px] italic">{text}</span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОКНОТ — Положительный факт
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isPositiveFact) {
    const hasFact = text.includes("— факт") || text.includes("- факт");
    const factText = hasFact 
      ? text.replace(/—\s*факт/i, "").replace(/-\s*факт/i, "").trim()
      : text.trim();
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-4 py-1.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 text-xs">✓</span>
          <span className="text-[13px] text-emerald-300/90">{factText}</span>
          {hasFact && <span className="text-[10px] text-emerald-500/60 ml-auto">факт</span>}
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОКНОТ — Негативный факт
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isNegativeFact) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-4 py-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-xs">✗</span>
          <span className="text-[13px] text-red-300/90">{text}</span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОКНОТ — Вопрос/Неизвестный факт
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isQuestionFact) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-4 py-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-xs">?</span>
          <span className="text-[13px] text-amber-300/80">{text}</span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОКНОТ — Нет данных
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isNeutralFact) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-4 py-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">○</span>
          <span className="text-[13px] text-slate-400">{text}</span>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // УМНОЕ ОПРЕДЕЛЕНИЕ ТИПА НАРРАТИВА
  // ═══════════════════════════════════════════════════════════════════════════
  
  const lowerText = text.toLowerCase();
  
  // Действия игрока (начинается с "Вы")
  const isPlayerAction = text.startsWith("Вы ") || text.startsWith("Ваш ");
  
  // Описание находки/улики (конкретные детали)
  const isEvidence = lowerText.includes("следы") || lowerText.includes("отпечатк") || 
                     lowerText.includes("газет") || lowerText.includes("размер") ||
                     lowerText.includes("ботинок") || lowerText.includes("подошв") ||
                     lowerText.includes("метр") || lowerText.includes("ветка") ||
                     lowerText.includes("найден") || lowerText.includes("обнаружен");
  
  // Вводная фраза перед диалогом ("Участковый подходит:", "Эксперт говорит:")
  const isDialogueIntro = text.trim().endsWith(":") && text.length < 80;
  
  // Атмосферное описание (природа, обстановка)
  const isAtmosphere = lowerText.includes("снег") || lowerText.includes("холод") ||
                       lowerText.includes("тишин") || lowerText.includes("молч") ||
                       lowerText.includes("курит") || lowerText.includes("ветер") ||
                       lowerText.includes("темн") || lowerText.includes("свет");
  
  // Профессиональное наблюдение
  const isProfessional = lowerText.includes("профессиональн") || lowerText.includes("замечает") ||
                         lowerText.includes("глаз") || lowerText.includes("внимание");
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ДЕЙСТВИЯ ИГРОКА — акцентированный текст
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isPlayerAction) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="py-4 px-5"
      >
        <p className="text-[15px] text-white/90 leading-[1.8] text-center font-light tracking-wide">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ВВОДНАЯ ФРАЗА К ДИАЛОГУ — минималистичная
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isDialogueIntro) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="pt-5 pb-2 px-4"
      >
        <p className="text-[13px] text-white/50 text-center italic">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ОПИСАНИЕ НАХОДКИ — карточка с иконкой
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isEvidence && !isPlayerAction) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-4 my-3"
      >
        <div className="flex gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border-l-2 border-slate-500/50">
          <span className="text-slate-400 text-sm mt-0.5">📋</span>
          <p className="text-[14px] text-slate-200 leading-[1.7]">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // АТМОСФЕРНОЕ ОПИСАНИЕ — курсивом, тонкое
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isAtmosphere && !isPlayerAction && !isEvidence) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="py-4 px-6"
      >
        <p className="text-[14px] text-white/60 leading-[1.9] text-center italic">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ПРОФЕССИОНАЛЬНОЕ НАБЛЮДЕНИЕ — с акцентом
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isProfessional) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="py-4 px-5"
      >
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/60 to-transparent rounded-full" />
          <p className="text-[14px] text-amber-100/80 leading-[1.8] pl-4">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // КОРОТКИЙ ТЕКСТ — элегантно по центру
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (text.length < 100 && !isList) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="py-4 px-5"
      >
        <p className="text-[15px] text-white/75 leading-[1.8] text-center">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ДЛИННЫЙ ТЕКСТ — блок с фоном
  // ═══════════════════════════════════════════════════════════════════════════
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-4 my-4"
    >
      <div className="px-5 py-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06]">
        <p className="text-[14px] text-white/80 leading-[1.85] whitespace-pre-line">
          {text}
        </p>
      </div>
    </motion.div>
  );
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

export default InkStoryPlayer;
