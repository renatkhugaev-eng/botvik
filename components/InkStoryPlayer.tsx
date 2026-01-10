"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  InkRunner,
  type InkState,
  type ExternalFunctionCallbacks,
  getTagValue,
  hasTag,
} from "@/lib/ink-runtime";
import { investigationHaptic } from "@/lib/haptic";
import { getBackgroundMusic } from "@/lib/background-music";
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

/** Параграф для сохранения */
type SaveableParagraph = {
  text: string;
  tags: string[];
};

type InkStoryPlayerProps = {
  storyJson: object;
  onEnd?: (state: InkState) => void;
  onVariableChange?: (name: string, value: unknown) => void;
  onTagFound?: (tag: string, value: string | boolean) => void;
  /** Вызывается при изменении состояния (для сохранения) */
  onInkStateChange?: (stateJson: string, paragraphs: SaveableParagraph[]) => void;
  initialState?: string;
  /** Начальные параграфы (для восстановления из сохранения) */
  initialParagraphs?: SaveableParagraph[];
  className?: string;
};

type MoodType = "normal" | "dark" | "tense" | "horror" | "hope" | "mystery" | "investigation" | "conflict" | "stakeout" | "pressure" | "discovery" | "crossroads" | "professional" | "suspicion" | "revelation" | "shock" | "tension" | "cosmic_horror" | "neutral" | "emotional" | "action" | "bittersweet";

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
  initialParagraphs,
  className = "",
}: InkStoryPlayerProps) {
  // ══════════════════════════════════════════════════════════════════════════
  // EXTERNAL FUNCTION CALLBACKS — Связь Ink с JavaScript
  // ══════════════════════════════════════════════════════════════════════════
  const externalCallbacks: ExternalFunctionCallbacks = {
    onPlaySound: (soundId: string) => {
      const music = getBackgroundMusic();
      music.play(soundId);
    },
    onStopSound: (soundId: string) => {
      const music = getBackgroundMusic();
      music.stop();
    },
    onTriggerHaptic: (hapticType: string) => {
      // Маппинг типов haptic из Ink на реальные функции
      switch (hapticType) {
        case "heavy_impact":
        case "dramatic_collapse":
          investigationHaptic.dramaticMoment();
          break;
        case "medium_impact":
        case "sacrifice_moment":
          investigationHaptic.suspense();
          break;
        case "soft_success":
        case "clue_found":
          investigationHaptic.clueDiscovered();
          break;
        case "scene_transition":
        case "day_transition":
          investigationHaptic.sceneTransition();
          break;
        case "dramatic_choice":
        case "hero_stance":
          investigationHaptic.choiceMade();
          break;
        case "dark_choice":
          investigationHaptic.suspense();
          break;
        case "romantic_escape":
        case "escape_moment":
          investigationHaptic.insight();
          break;
        case "redemption_moment":
        case "secret_ending":
          investigationHaptic.dramaticMoment();
          break;
        default:
          investigationHaptic.textReveal();
      }
    },
    onShowNotification: (message: string, type: string) => {
      console.log(`[Ink Notification] ${type}: ${message}`);
    },
    onSaveCheckpoint: (checkpointName: string) => {
      console.log(`[Ink Checkpoint] ${checkpointName}`);
    },
    onTriggerGameOver: (reason: string) => {
      console.log(`[Ink Game Over] ${reason}`);
      investigationHaptic.dramaticMoment();
    },
  };

  const [runner] = useState(() => new InkRunner(storyJson, externalCallbacks));
  const [state, setState] = useState<InkState | null>(null);
  const [displayedParagraphs, setDisplayedParagraphs] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [animationsSkipped, setAnimationsSkipped] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodType>("normal");
  const [currentChapter, setCurrentChapter] = useState(1);
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<ImagePosition>("top");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [storyMode, setStoryMode] = useState<StoryMode>("normal");
  const [interrogationState, setInterrogationState] = useState<InterrogationState | null>(null);
  const [tacticalHint, setTacticalHint] = useState<string>("");
  const [isVisionActive, setIsVisionActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevVarsRef = useRef<Record<string, unknown>>({});
  const visionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Мемоизированные стили по настроению
  const moodStyles = useMemo(() => getMoodStyles(currentMood), [currentMood]);

  // Очистка таймера видений при размонтировании
  useEffect(() => {
    return () => {
      if (visionTimerRef.current) {
        clearTimeout(visionTimerRef.current);
      }
    };
  }, []);

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
      
      // Если есть сохранённые параграфы — используем их вместо пустых
      if (initialParagraphs && initialParagraphs.length > 0 && initialOutput.paragraphs.length === 0) {
        initialOutput = {
          ...initialOutput,
          paragraphs: initialParagraphs.map(p => ({ text: p.text, tags: p.tags })),
        };
      }
    } else {
      // reset() уже вызывает continue() внутри, поэтому используем getState()
      runner.reset();
      initialOutput = runner.getState();
    }
    
    setState(initialOutput);
    setDisplayedParagraphs(0);
    setIsTyping(true);
    setAnimationsSkipped(false);

    // Обрабатываем начальные теги
    processGlobalTags(initialOutput.tags);
    
    // Notify parent about initial state for saving
    const paragraphsToSave = initialOutput.paragraphs.map(p => ({ text: p.text, tags: p.tags }));
    onInkStateChange?.(runner.saveState(), paragraphsToSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, initialState]); // processGlobalTags, onInkStateChange, initialParagraphs намеренно исключены — вызываются только при инициализации

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
      
      // ═══ ВИДЕНИЯ / HORROR СОБЫТИЯ ═══
      const eventType = getTagValue(tags, "type");
      if (eventType === "vision") {
        setIsVisionActive(true);
        investigationHaptic.dramaticMoment();
        // Очищаем предыдущий таймер если есть
        if (visionTimerRef.current) {
          clearTimeout(visionTimerRef.current);
        }
        // Автоматически скрываем индикатор через 8 секунд
        visionTimerRef.current = setTimeout(() => {
          setIsVisionActive(false);
          visionTimerRef.current = null;
        }, 8000);
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

    // ВАЖНО: Вычисляем задержку на основе ТЕКУЩЕГО показанного параграфа
    // (того, который только что появился), а не следующего
    const lastShownIndex = displayedParagraphs - 1;
    const nextParagraph = state.paragraphs[displayedParagraphs];
    
    let delay: number;
    
    if (displayedParagraphs === 0) {
      // Первый параграф — небольшая начальная задержка для плавности
      delay = 300;
    } else {
      // Вычисляем задержку на основе ТОЛЬКО ЧТО ПОКАЗАННОГО параграфа
      const lastShownParagraph = state.paragraphs[lastShownIndex];
      const text = lastShownParagraph.text;
      const tags = lastShownParagraph.tags;
      
      // Используем getTagValue для надёжного определения speaker
      const speakerValue = getTagValue(tags, "speaker");
      const hasSpeakerTag = speakerValue !== null && speakerValue !== false;
      const isDialogue = text.startsWith("—") || text.startsWith("–") || text.startsWith("- ");
      const isChatMessage = hasSpeakerTag; // speaker tag = это чат-сообщение
      
      if (isChatMessage) {
        // Для чат-сообщений: typing indicator + печать текста
        // Формула должна совпадать с ChatMessage и TypewriterText!
        const typingTime = Math.min(800 + text.length * 8, 1500);
        // Speed в TypewriterText: Math.max(12, Math.min(25, 1500 / text.length))
        const charSpeed = Math.max(12, Math.min(25, 1500 / text.length));
        const printingTime = text.length * charSpeed;
        delay = typingTime + printingTime + 500; // +500ms буфер
      } else if (text.length < 30) {
        // Короткие строки — быстро, но не мгновенно
        delay = 600;
      } else if (text.length < 100) {
        // Средние — время на прочтение
        delay = 800 + text.length * 5;
      } else {
        // Длинные — больше времени
        delay = Math.min(1200 + text.length * 6, 3000);
      }
    }

    const timer = setTimeout(() => {
      setDisplayedParagraphs((prev) => prev + 1);

      // Обрабатываем теги СЛЕДУЮЩЕГО параграфа (который будет показан)
      if (nextParagraph.tags.length > 0) {
        processGlobalTags(nextParagraph.tags);
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
      setAnimationsSkipped(false); // Сбрасываем флаг для новых параграфов
      processGlobalTags(newState.tags);
      
      // Notify parent about state change for saving (with paragraphs)
      const paragraphsToSave = newState.paragraphs.map(p => ({ text: p.text, tags: p.tags }));
      onInkStateChange?.(runner.saveState(), paragraphsToSave);
    },
    [runner, isTyping, state, processGlobalTags, onInkStateChange]
  );

  const handleTapToContinue = useCallback(() => {
    if (!state) return;

    if (isTyping) {
      // Skip to end of current text — отключаем все анимации
      setAnimationsSkipped(true);
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
      
      {/* Индикатор ВИДЕНИЯ — horror события */}
      <AnimatePresence>
        {isVisionActive && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full 
                       bg-red-900/80 border border-red-500/50 backdrop-blur-sm
                       flex items-center gap-2 shadow-lg shadow-red-900/50"
          >
            <span className="text-lg animate-pulse">👁️</span>
            <span className="text-red-200 text-sm font-medium tracking-wider uppercase">
              Видение
            </span>
            <span className="text-lg animate-pulse">👁️</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      
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
          {state.paragraphs.slice(0, displayedParagraphs).map((paragraph, index) => {
            // Анимируем только последний параграф, и только если анимации не пропущены
            const isLastParagraph = index === displayedParagraphs - 1;
            const shouldAnimate = isLastParagraph && !animationsSkipped;
            return (
              <motion.div
                key={`p-${index}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: animationsSkipped ? 0.1 : 0.3 }}
              >
                <ParagraphRenderer
                  text={paragraph.text}
                  tags={paragraph.tags}
                  mood={currentMood}
                  isAnimated={shouldAnimate}
                />
              </motion.div>
            );
          })}
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
  tension: { icon: "⚡", label: "Напряжение", color: "text-amber-400" },
  horror: { icon: "💀", label: "Ужас", color: "text-red-400" },
  cosmic_horror: { icon: "🌀", label: "Космический ужас", color: "text-violet-500" },
  hope: { icon: "✨", label: "Надежда", color: "text-emerald-400" },
  mystery: { icon: "🔮", label: "Тайна", color: "text-purple-400" },
  investigation: { icon: "🔍", label: "Расследование", color: "text-blue-400" },
  conflict: { icon: "⚔️", label: "Конфликт", color: "text-orange-400" },
  stakeout: { icon: "👁️", label: "Слежка", color: "text-cyan-400" },
  pressure: { icon: "🎯", label: "Давление", color: "text-rose-400" },
  discovery: { icon: "💡", label: "Открытие", color: "text-lime-400" },
  crossroads: { icon: "🔀", label: "Развилка", color: "text-indigo-400" },
  professional: { icon: "📋", label: "Работа", color: "text-zinc-400" },
  suspicion: { icon: "🤔", label: "Подозрение", color: "text-amber-500" },
  revelation: { icon: "💥", label: "Откровение", color: "text-yellow-400" },
  shock: { icon: "😱", label: "Шок", color: "text-red-500" },
  neutral: { icon: "📖", label: "", color: "text-white/40" },
  emotional: { icon: "💔", label: "Эмоции", color: "text-pink-400" },
  action: { icon: "🏃", label: "Действие", color: "text-orange-500" },
  bittersweet: { icon: "🥀", label: "Горечь", color: "text-rose-300" },
};

function MoodIndicator({ mood, show = true }: { mood: MoodType; show?: boolean }) {
  const indicator = MOOD_INDICATORS[mood];
  
  // Защита от неизвестных mood тегов
  if (!indicator || !show || mood === "normal" || mood === "neutral") return null;
  
  const dotColor = 
    mood === "horror" || mood === "dark" || mood === "shock" ? "bg-red-400 shadow-red-400/50" :
    mood === "cosmic_horror" ? "bg-violet-500 shadow-violet-500/50" :
    mood === "tense" || mood === "tension" || mood === "pressure" || mood === "suspicion" ? "bg-amber-400 shadow-amber-400/50" :
    mood === "mystery" ? "bg-violet-400 shadow-violet-400/50" :
    mood === "discovery" || mood === "hope" ? "bg-emerald-400 shadow-emerald-400/50" :
    mood === "investigation" ? "bg-blue-400 shadow-blue-400/50" :
    mood === "revelation" ? "bg-yellow-400 shadow-yellow-400/50" :
    mood === "emotional" || mood === "bittersweet" ? "bg-pink-400 shadow-pink-400/50" :
    mood === "action" || mood === "conflict" ? "bg-orange-400 shadow-orange-400/50" :
    "bg-white/40";
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed top-20 right-4 z-40"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/[0.05]">
        {/* Пульсирующая точка */}
        <div className="relative">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor} shadow-sm`} />
          <motion.div 
            className={`absolute inset-0 rounded-full ${dotColor} opacity-50`}
            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">
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
    emoji: string;           // Emoji или инициалы (например "МГ" для Майора Громова)
    bgGradient: string;
    ringColor: string;
    shadowColor: string;
    isInitials?: boolean;    // true = показывать как инициалы, false = как emoji
    imageSrc?: string;       // Путь к изображению (если есть)
  };
  bubble: {
    bgGradient: string;
    borderColor: string;
    textColor: string;
  };
  nameColor: string;
  isProtagonist?: boolean;
  statusIndicator?: "online" | "typing" | "away" | "none" | "offline";
  gender?: "male" | "female";
};

// ══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ПЕРСОНАЖЕЙ — Полная конфигурация для "Красный лес"
// ══════════════════════════════════════════════════════════════════════════════

const SPEAKER_CONFIG: Record<string, CharacterConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ГЛАВНЫЙ ГЕРОЙ
  // ═══════════════════════════════════════════════════════════════════════════
  
  sorokin: {
    name: "Виктор Сорокин",
    shortName: "Сорокин",
    role: "Следователь из Москвы",
    avatar: {
      emoji: "ВС",
      bgGradient: "from-slate-600 via-slate-700 to-slate-800",
      ringColor: "ring-slate-400/50",
      shadowColor: "shadow-slate-500/30",
      isInitials: true,
      imageSrc: "/avatars/sorokin.webp",
    },
    bubble: {
      bgGradient: "from-slate-700/80 via-slate-800/80 to-slate-900/80",
      borderColor: "border-slate-500/30",
      textColor: "text-white",
    },
    nameColor: "text-slate-300",
    isProtagonist: true,
    statusIndicator: "online",
    gender: "male",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // КЛЮЧЕВЫЕ ПЕРСОНАЖИ
  // ═══════════════════════════════════════════════════════════════════════════
  
  gromov: {
    name: "Майор Громов",
    shortName: "Громов",
    role: "Начальник милиции",
    avatar: {
      emoji: "МГ",
      bgGradient: "from-red-700 via-red-800 to-red-900",
      ringColor: "ring-red-500/50",
      shadowColor: "shadow-red-600/40",
      isInitials: true,
      imageSrc: "/avatars/gromov.webp",
    },
    bubble: {
      bgGradient: "from-red-900/70 to-red-950/70",
      borderColor: "border-red-600/40",
      textColor: "text-red-100",
    },
    nameColor: "text-red-400",
    statusIndicator: "online",
    gender: "male",
  },
  
  vera: {
    name: "Вера Холодова",
    shortName: "Вера",
    role: "Психиатр",
    avatar: {
      emoji: "ВХ",
      bgGradient: "from-violet-500 via-purple-600 to-violet-700",
      ringColor: "ring-violet-400/50",
      shadowColor: "shadow-violet-500/40",
      isInitials: true,
      imageSrc: "/avatars/vera.webp",
    },
    bubble: {
      bgGradient: "from-violet-900/70 to-purple-900/70",
      borderColor: "border-violet-500/40",
      textColor: "text-violet-100",
    },
    nameColor: "text-violet-400",
    statusIndicator: "online",
    gender: "female",
  },
  
  serafim: {
    name: "Отец Серафим",
    shortName: "Серафим",
    role: "Настоятель церкви",
    avatar: {
      emoji: "ОС",
      bgGradient: "from-amber-600 via-yellow-700 to-amber-800",
      ringColor: "ring-amber-400/50",
      shadowColor: "shadow-amber-500/40",
      isInitials: true,
      imageSrc: "/avatars/serafim.webp",
    },
    bubble: {
      bgGradient: "from-amber-900/60 to-yellow-900/60",
      borderColor: "border-amber-500/40",
      textColor: "text-amber-100",
    },
    nameColor: "text-amber-400",
    statusIndicator: "none",
    gender: "male",
  },
  
  tanya: {
    name: "Таня Зорина",
    shortName: "Таня",
    role: "Инженер, дочь Зорина",
    avatar: {
      emoji: "ТВ",
      bgGradient: "from-emerald-500 via-teal-600 to-emerald-700",
      ringColor: "ring-emerald-400/50",
      shadowColor: "shadow-emerald-500/40",
      isInitials: true,
      imageSrc: "/avatars/tanya.webp",
    },
    bubble: {
      bgGradient: "from-emerald-900/60 to-teal-900/60",
      borderColor: "border-emerald-500/40",
      textColor: "text-emerald-100",
    },
    nameColor: "text-emerald-400",
    statusIndicator: "online",
    gender: "female",
  },
  
  astahov: {
    name: "Полковник Астахов",
    shortName: "Астахов",
    role: "Куратор КГБ",
    avatar: {
      emoji: "ПА",
      bgGradient: "from-gray-600 via-gray-700 to-gray-800",
      ringColor: "ring-gray-500/50",
      shadowColor: "shadow-gray-600/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-gray-800/80 to-gray-900/80",
      borderColor: "border-gray-600/40",
      textColor: "text-gray-200",
    },
    nameColor: "text-gray-400",
    statusIndicator: "online",
    gender: "male",
  },
  
  klava: {
    name: "Клавдия Петровна",
    shortName: "Клава",
    role: "Хозяйка столовой",
    avatar: {
      emoji: "КП",
      bgGradient: "from-pink-500 via-rose-600 to-pink-700",
      ringColor: "ring-pink-400/50",
      shadowColor: "shadow-pink-500/40",
      isInitials: true,
      imageSrc: "/avatars/klava.webp",
    },
    bubble: {
      bgGradient: "from-pink-900/60 to-rose-900/60",
      borderColor: "border-pink-500/40",
      textColor: "text-pink-100",
    },
    nameColor: "text-pink-400",
    statusIndicator: "none",
    gender: "female",
  },
  
  chernov: {
    name: "Академик Чернов",
    shortName: "Чернов",
    role: "Глава «Проекта Эхо»",
    avatar: {
      emoji: "АЧ",
      bgGradient: "from-indigo-600 via-blue-700 to-indigo-800",
      ringColor: "ring-indigo-400/50",
      shadowColor: "shadow-indigo-500/40",
      isInitials: true,
      imageSrc: "/avatars/chernov.webp",
    },
    bubble: {
      bgGradient: "from-indigo-900/70 to-blue-900/70",
      borderColor: "border-indigo-500/40",
      textColor: "text-indigo-100",
    },
    nameColor: "text-indigo-400",
    statusIndicator: "away",
    gender: "male",
  },
  
  fyodor: {
    name: "Фёдор Кузьмич",
    shortName: "Фёдор",
    role: "Бывший геолог, сторож",
    avatar: {
      emoji: "ФК",
      bgGradient: "from-orange-600 via-amber-700 to-orange-800",
      ringColor: "ring-orange-400/50",
      shadowColor: "shadow-orange-500/40",
      isInitials: true,
      imageSrc: "/avatars/fyodor.webp",
    },
    bubble: {
      bgGradient: "from-orange-900/60 to-amber-900/60",
      borderColor: "border-orange-500/40",
      textColor: "text-orange-100",
    },
    nameColor: "text-orange-400",
    statusIndicator: "none",
    gender: "male",
  },
  
  zorin: {
    name: "Алексей Зорин",
    shortName: "Зорин",
    role: "Пропавший инженер",
    avatar: {
      emoji: "СЗ",
      bgGradient: "from-cyan-600 via-sky-700 to-cyan-800",
      ringColor: "ring-cyan-400/50",
      shadowColor: "shadow-cyan-500/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-cyan-900/60 to-sky-900/60",
      borderColor: "border-cyan-500/40",
      textColor: "text-cyan-100",
    },
    nameColor: "text-cyan-400",
    statusIndicator: "offline",
    gender: "male",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ВТОРОСТЕПЕННЫЕ ПЕРСОНАЖИ
  // ═══════════════════════════════════════════════════════════════════════════
  
  goryunov: {
    name: "Оперативник Горюнов",
    shortName: "Горюнов",
    role: "Оперуполномоченный",
    avatar: {
      emoji: "ОГ",
      bgGradient: "from-cyan-500 via-teal-600 to-cyan-700",
      ringColor: "ring-cyan-400/50",
      shadowColor: "shadow-cyan-500/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-cyan-900/60 to-teal-900/60",
      borderColor: "border-cyan-500/40",
      textColor: "text-cyan-100",
    },
    nameColor: "text-cyan-400",
    statusIndicator: "online",
    gender: "male",
  },
  
  expert: {
    name: "Ольга Николаевна",
    shortName: "Эксперт",
    role: "Судмедэксперт",
    avatar: {
      emoji: "ОН",
      bgGradient: "from-purple-500 via-violet-600 to-purple-700",
      ringColor: "ring-purple-400/50",
      shadowColor: "shadow-purple-500/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-purple-900/60 to-violet-900/60",
      borderColor: "border-purple-500/40",
      textColor: "text-purple-100",
    },
    nameColor: "text-purple-400",
    statusIndicator: "online",
    gender: "female",
  },
  
  prokuror: {
    name: "Прокурор Носов",
    shortName: "Прокурор",
    role: "Городской прокурор",
    avatar: {
      emoji: "ПН",
      bgGradient: "from-red-500 via-rose-600 to-red-700",
      ringColor: "ring-red-400/50",
      shadowColor: "shadow-red-500/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-red-900/60 to-rose-900/60",
      borderColor: "border-red-500/40",
      textColor: "text-red-100",
    },
    nameColor: "text-red-400",
    statusIndicator: "online",
    gender: "male",
  },
  
  uchastkoviy: {
    name: "Участковый Петров",
    shortName: "Участковый",
    role: "Местный участковый",
    avatar: {
      emoji: "УП",
      bgGradient: "from-blue-500 via-blue-600 to-indigo-700",
      ringColor: "ring-blue-400/50",
      shadowColor: "shadow-blue-500/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-blue-900/60 to-indigo-900/60",
      borderColor: "border-blue-500/40",
      textColor: "text-blue-100",
    },
    nameColor: "text-blue-400",
    statusIndicator: "online",
    gender: "male",
  },
  
  witness: {
    name: "Свидетельница",
    shortName: "Свидетель",
    role: "Местная жительница",
    avatar: {
      emoji: "СВ",
      bgGradient: "from-emerald-500 via-green-600 to-emerald-700",
      ringColor: "ring-emerald-400/50",
      shadowColor: "shadow-emerald-500/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-emerald-900/60 to-green-900/60",
      borderColor: "border-emerald-500/40",
      textColor: "text-emerald-100",
    },
    nameColor: "text-emerald-400",
    statusIndicator: "none",
    gender: "female",
  },
  
  cultist: {
    name: "Член культа",
    shortName: "Культист",
    role: "Последователь",
    avatar: {
      emoji: "КУ",
      bgGradient: "from-red-800 via-red-900 to-black",
      ringColor: "ring-red-600/50",
      shadowColor: "shadow-red-700/40",
      isInitials: true,
    },
    bubble: {
      bgGradient: "from-red-950/80 to-black/80",
      borderColor: "border-red-700/40",
      textColor: "text-red-200",
    },
    nameColor: "text-red-500",
    statusIndicator: "none",
    gender: "male",
  },
  
  narrator: {
    name: "Рассказчик",
    shortName: "",
    role: "",
    avatar: {
      emoji: "📖",
      bgGradient: "from-slate-700 via-slate-800 to-slate-900",
      ringColor: "ring-slate-500/30",
      shadowColor: "shadow-slate-600/30",
      isInitials: false,
    },
    bubble: {
      bgGradient: "from-slate-800/50 to-slate-900/50",
      borderColor: "border-slate-600/30",
      textColor: "text-slate-300",
    },
    nameColor: "text-slate-500",
    statusIndicator: "none",
    gender: "male",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЭПИЗОДИЧЕСКИЕ ПЕРСОНАЖИ
  // ═══════════════════════════════════════════════════════════════════════════
  
  driver: {
    name: "Водитель",
    shortName: "Водитель",
    role: "Водитель автобуса",
    avatar: {
      emoji: "ВД",
      bgGradient: "from-stone-600 via-stone-700 to-stone-800",
      ringColor: "ring-stone-500/50",
      shadowColor: "shadow-stone-600/40",
      isInitials: true,
      imageSrc: "/avatars/driver.webp",
    },
    bubble: {
      bgGradient: "from-stone-800/70 to-stone-900/70",
      borderColor: "border-stone-600/40",
      textColor: "text-stone-200",
    },
    nameColor: "text-stone-400",
    statusIndicator: "none",
    gender: "male",
  },
  
  soldier: {
    name: "Солдат",
    shortName: "Солдат",
    role: "Охранник КПП",
    avatar: {
      emoji: "СЛ",
      bgGradient: "from-green-700 via-green-800 to-green-900",
      ringColor: "ring-green-500/50",
      shadowColor: "shadow-green-600/40",
      isInitials: true,
      imageSrc: "/avatars/soldier.webp",
    },
    bubble: {
      bgGradient: "from-green-900/70 to-green-950/70",
      borderColor: "border-green-600/40",
      textColor: "text-green-100",
    },
    nameColor: "text-green-400",
    statusIndicator: "none",
    gender: "male",
  },
  
  officer: {
    name: "Офицер",
    shortName: "Офицер",
    role: "Старший лейтенант",
    avatar: {
      emoji: "ОФ",
      bgGradient: "from-olive-600 via-olive-700 to-olive-800",
      ringColor: "ring-lime-500/50",
      shadowColor: "shadow-lime-600/40",
      isInitials: true,
      imageSrc: "/avatars/officer.webp",
    },
    bubble: {
      bgGradient: "from-lime-900/70 to-green-900/70",
      borderColor: "border-lime-600/40",
      textColor: "text-lime-100",
    },
    nameColor: "text-lime-400",
    statusIndicator: "online",
    gender: "male",
  },
  
  stranger: {
    name: "Незнакомец",
    shortName: "",
    role: "",
    avatar: {
      emoji: "👤",
      bgGradient: "from-slate-600 via-slate-700 to-slate-800",
      ringColor: "ring-slate-500/50",
      shadowColor: "shadow-slate-600/40",
      isInitials: false,
    },
    bubble: {
      bgGradient: "from-slate-800/70 to-slate-900/70",
      borderColor: "border-slate-600/40",
      textColor: "text-slate-100",
    },
    nameColor: "text-slate-400",
    statusIndicator: "none",
    gender: "male",
  },
};

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

// ══════════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ АВАТАРА ПЕРСОНАЖА — Профессиональный дизайн
// ══════════════════════════════════════════════════════════════════════════════

function CharacterAvatar({ 
  config, 
  size = "md" 
}: { 
  config: CharacterConfig; 
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };
  
  const ringSize = {
    sm: "ring-[1.5px]",
    md: "ring-2",
    lg: "ring-[2.5px]",
  };

  // SVG силуэт для мужского персонажа
  const MaleSilhouette = () => (
    <svg viewBox="0 0 24 24" className="w-full h-full p-1.5 opacity-30">
      <path
        fill="currentColor"
        d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"
      />
    </svg>
  );

  // SVG силуэт для женского персонажа
  const FemaleSilhouette = () => (
    <svg viewBox="0 0 24 24" className="w-full h-full p-1.5 opacity-30">
      <path
        fill="currentColor"
        d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 8c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"
      />
    </svg>
  );

  return (
    <div className="relative">
      {/* Внешнее свечение */}
      <div className={`
        absolute inset-0 rounded-full blur-md opacity-40
        bg-gradient-to-br ${config.avatar.bgGradient}
      `} />
      
      {/* Основной аватар */}
      <div className={`
        relative ${sizeClasses[size]} rounded-full 
        bg-gradient-to-br ${config.avatar.bgGradient}
        ${ringSize[size]} ${config.avatar.ringColor}
        flex items-center justify-center
        shadow-lg ${config.avatar.shadowColor}
        overflow-hidden
      `}>
        {/* Если есть изображение — показываем его */}
        {config.avatar.imageSrc ? (
          <img 
            src={config.avatar.imageSrc} 
            alt={config.shortName}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <>
            {/* Силуэт на фоне */}
            <div className="absolute inset-0 text-white">
              {config.gender === "female" ? <FemaleSilhouette /> : <MaleSilhouette />}
            </div>
            
            {/* Инициалы или emoji */}
            <span className={`
              relative z-10 font-bold tracking-tight
              ${config.avatar.isInitials 
                ? "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" 
                : "text-current"
              }
            `}>
              {config.avatar.emoji}
            </span>
          </>
        )}
      </div>
      
      {/* Индикатор статуса */}
      {config.statusIndicator && config.statusIndicator !== "none" && (
        <div className={`
          absolute -bottom-0.5 -right-0.5 w-3 h-3 
          rounded-full border-2 border-[#0a0a12]
          ${config.statusIndicator === "online" ? "bg-emerald-500" : ""}
          ${config.statusIndicator === "typing" ? "bg-blue-500 animate-pulse" : ""}
          ${config.statusIndicator === "away" ? "bg-amber-500" : ""}
          ${config.statusIndicator === "offline" ? "bg-gray-500" : ""}
        `} />
      )}
    </div>
  );
}

function ChatMessage({ 
  text, 
  config, 
  isProtagonist,
  isAnimated = false,
}: { 
  text: string; 
  config: CharacterConfig; 
  isProtagonist: boolean;
  isAnimated?: boolean;
}) {
  // Запоминаем начальное значение isAnimated (при первом рендере)
  // Это важно, потому что isAnimated может измениться когда появится новый параграф
  const shouldAnimate = useRef(isAnimated).current;
  
  // Фаза анимации: typing -> printing -> done
  const [phase, setPhase] = useState<'typing' | 'printing' | 'done'>(() => {
    if (!shouldAnimate) return 'done';
    if (isProtagonist) return 'printing';
    return 'typing';
  });
  
  const messageTime = useRef(getNextMessageTime()).current;
  
  useEffect(() => {
    // Если не нужна анимация — выходим
    if (!shouldAnimate) return;
    
    // Протагонист уже в фазе printing, ждём завершения typewriter
    if (isProtagonist) return;
    
    // Для NPC — после typing indicator переходим к printing
    const typingDuration = Math.min(800 + text.length * 8, 1500);
    
    const timer = setTimeout(() => {
      setPhase('printing');
    }, typingDuration);
    
    return () => clearTimeout(timer);
  }, [isProtagonist, text.length, shouldAnimate]);
  
  return (
    <div className={`flex items-end gap-3 mb-4 px-3 ${isProtagonist ? "flex-row-reverse" : "flex-row"}`}>
      {/* Аватар — только для не-протагониста */}
      {!isProtagonist && (
        <div className="flex-shrink-0 mb-5">
          <CharacterAvatar config={config} size="md" />
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
          {/* Typing indicator — показывается пока NPC "печатает" */}
          {phase === 'typing' && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              className="px-4 py-3 rounded-2xl rounded-bl-md bg-[#1c1c1e]"
            >
              <div className="flex items-center gap-[5px]">
                <motion.span
                  className="w-[6px] h-[6px] bg-white/40 rounded-full"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.span
                  className="w-[6px] h-[6px] bg-white/40 rounded-full"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                />
                <motion.span
                  className="w-[6px] h-[6px] bg-white/40 rounded-full"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                />
              </div>
            </motion.div>
          )}
          
          {/* Сообщение с эффектом печатания (для printing) или готовое (для done) */}
          {(phase === 'printing' || phase === 'done') && (
            <motion.div
              key="message"
              initial={phase === 'done' && !shouldAnimate ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`
                px-3.5 py-2.5 max-w-full
                ${isProtagonist 
                  ? "bg-[#0a84ff] rounded-[18px] rounded-br-[4px]" 
                  : "bg-[#1c1c1e] rounded-[18px] rounded-bl-[4px]"
                }
              `}
            >
              <p className="text-[15px] text-white leading-[1.4] whitespace-pre-line">
                {/* Если анимация и печатаем — TypewriterText, иначе просто текст */}
                {shouldAnimate && phase === 'printing' ? (
                  <TypewriterText 
                    text={text}
                    speed={Math.max(12, Math.min(25, 1500 / text.length))}
                    onComplete={() => setPhase('done')}
                  />
                ) : (
                  text
                )}
              </p>
              
              {/* Время — всегда видно для готовых, появляется после печати для анимированных */}
              <div className={`flex items-center justify-end gap-1 mt-1 ${phase === 'done' ? 'opacity-100' : 'opacity-30'}`}>
                <span className="text-[10px] text-white/35">
                  {messageTime}
                </span>
                {isProtagonist && (
                  <span className={`text-[9px] text-white/50 ${phase === 'done' ? 'opacity-100' : 'opacity-0'}`}>
                    ✓✓
                  </span>
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
  isAnimated = false,
}: {
  text: string;
  tags: string[];
  mood: MoodType;
  isAnimated?: boolean;
}) {
  // ═══════════════════════════════════════════════════════════════════════════
  // ОПРЕДЕЛЕНИЕ ТИПА КОНТЕНТА
  // ═══════════════════════════════════════════════════════════════════════════
  
  const speakerTag = getTagValue(tags, "speaker");
  const speaker = typeof speakerTag === "string" ? speakerTag : null;
  const config = speaker ? SPEAKER_CONFIG[speaker] : null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЧАТ-СООБЩЕНИЯ — ПРИОРИТЕТ НАД ВСЕМ! (должно быть в самом начале)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Если есть тег speaker — ВСЕГДА показываем как чат, игнорируя другие условия
  if (speaker && config) {
    const cleanText = text.replace(/^[—–-]\s*/, "").trim();
    const isProtagonist = speaker === "sorokin";
    
    return (
      <ChatMessage 
        text={cleanText} 
        config={config} 
        isProtagonist={isProtagonist}
        isAnimated={isAnimated}
      />
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 ПРОФЕССИОНАЛЬНАЯ СИСТЕМА СТИЛЕЙ ПОВЕСТВОВАНИЯ
  // Поддержка: style, intensity, effect, color
  // Пример: # style:horror # intensity:high # effect:shake
  // ═══════════════════════════════════════════════════════════════════════════
  
  const styleTag = getTagValue(tags, "style");
  const narrativeStyle = typeof styleTag === "string" ? styleTag : null;
  
  // Дополнительные параметры
  const intensityTag = getTagValue(tags, "intensity");
  const intensity = typeof intensityTag === "string" ? intensityTag : "medium";
  
  const effectTag = getTagValue(tags, "effect");
  const effect = typeof effectTag === "string" ? effectTag : null;
  
  const colorTag = getTagValue(tags, "color");
  const accentColor = typeof colorTag === "string" ? colorTag : null;
  
  // Интенсивность влияет на прозрачность и размер
  const intensityConfig = {
    low: { opacity: 0.5, scale: 0.98, duration: 0.4 },
    medium: { opacity: 0.75, scale: 1, duration: 0.6 },
    high: { opacity: 1, scale: 1.02, duration: 0.8 },
  };
  const intensityValues = intensityConfig[intensity as keyof typeof intensityConfig] || intensityConfig.medium;

  // ═══════════════════════════════════════════════════════════════════════════
  // ✏️ ФУНКЦИЯ ВЫДЕЛЕНИЯ ВАЖНЫХ СЛОВ
  // Синтаксис: <<важный текст>> — подчёркнуто карандашом
  // ═══════════════════════════════════════════════════════════════════════════
  const renderHighlightedText = (inputText: string) => {
    const parts = inputText.split(/(<<[^>]+>>)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith("<<") && part.endsWith(">>")) {
        const highlightedText = part.slice(2, -2);
        return (
          <span 
            key={i}
            className="relative inline-block mx-0.5"
          >
            {/* Текст */}
            <span className="relative z-10 text-amber-200/90 font-medium">
              {highlightedText}
            </span>
            {/* Подчёркивание карандашом */}
            <span 
              className="absolute left-0 right-0 -bottom-0.5 h-[3px] rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.5) 10%, rgba(251, 191, 36, 0.6) 50%, rgba(251, 191, 36, 0.5) 90%, transparent 100%)",
                transform: "rotate(-0.5deg)",
              }}
            />
            {/* Лёгкое свечение */}
            <span 
              className="absolute inset-0 -m-1 rounded bg-amber-500/5 blur-sm"
            />
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 💭 МЫСЛИ — внутренний голос героя
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "thought") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: intensityValues.opacity * 0.75, y: 0 }}
        transition={{ duration: intensityValues.duration, ease: "easeOut" }}
        className="py-4 px-6"
      >
        <p className="text-[15px] text-white/50 leading-[2.1] text-center italic font-light tracking-wide">
          {renderHighlightedText(text)}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌫️ АТМОСФЕРА — описание обстановки
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "atmosphere") {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: intensityValues.opacity * 0.7 }}
        transition={{ duration: intensityValues.duration + 0.3 }}
        className="py-6 px-5"
      >
        <div className="relative">
          {/* Туманный фон */}
          <motion.div 
            className="absolute inset-0 -mx-6 -my-4 rounded-3xl"
            style={{
              background: "radial-gradient(ellipse at center, rgba(100, 116, 139, 0.08) 0%, transparent 70%)",
            }}
            animate={{ 
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.02, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <p className="relative text-[14px] text-slate-300/50 leading-[2.3] text-center font-light tracking-wider">
            {renderHighlightedText(text)}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 👁️ ХОРРОР — жуткий момент с эффектами
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "horror") {
    const isHighIntensity = intensity === "high";
    const hasShake = effect === "shake" || isHighIntensity;
    const hasGlitch = effect === "glitch";
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, intensityValues.opacity, intensityValues.opacity * 0.7, intensityValues.opacity * 0.9],
          x: hasShake ? [0, -2, 2, -1, 1, 0] : 0,
        }}
        transition={{ 
          duration: intensityValues.duration + 0.5,
          x: hasShake ? { duration: 0.4, repeat: 2, repeatDelay: 0.5 } : {},
        }}
        className="py-6 px-4"
      >
        <div className="relative overflow-hidden">
          {/* Пульсирующий кровавый фон */}
          <motion.div 
            className="absolute inset-0 -mx-2 -my-2 rounded-xl"
            style={{
              background: isHighIntensity 
                ? "linear-gradient(135deg, rgba(127, 29, 29, 0.3) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(127, 29, 29, 0.2) 100%)"
                : "linear-gradient(135deg, rgba(127, 29, 29, 0.15) 0%, transparent 50%, rgba(127, 29, 29, 0.1) 100%)",
              boxShadow: isHighIntensity ? "inset 0 0 30px rgba(220, 38, 38, 0.2)" : "none",
            }}
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Красная рамка */}
          <div className={`absolute inset-0 -mx-2 -my-2 rounded-xl border ${
            isHighIntensity ? "border-red-700/40" : "border-red-900/20"
          }`} />
          
          {/* Глитч-эффект для high intensity */}
          {hasGlitch && (
            <motion.div
              className="absolute inset-0 -mx-2 -my-2 rounded-xl overflow-hidden"
              animate={{
                clipPath: [
                  "inset(0 0 0 0)",
                  "inset(10% 0 85% 0)",
                  "inset(0 0 0 0)",
                  "inset(40% 0 50% 0)",
                  "inset(0 0 0 0)",
                ],
              }}
              transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 2 }}
            >
              <div className="absolute inset-0 bg-red-500/10 translate-x-1" />
            </motion.div>
          )}
          
          <p className={`relative text-[15px] leading-[2] text-center font-light ${
            isHighIntensity ? "text-red-100/90" : "text-red-200/70"
          }`}>
            {renderHighlightedText(text)}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ ВАЖНЫЙ МОМЕНТ — выделенный текст
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "important") {
    const colorClass = accentColor === "red" ? "amber" : accentColor || "amber";
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
        className="py-5 px-4"
      >
        <div className="relative overflow-hidden rounded-2xl">
          {/* Градиентный фон */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/25 via-orange-950/15 to-amber-900/20" />
          
          {/* Светящаяся верхняя линия */}
          <motion.div 
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.6), transparent)",
            }}
            animate={{ 
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Рамка */}
          <div className="absolute inset-0 rounded-2xl border border-amber-500/25" />
          
          {/* Свечение в углу */}
          <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl" />
          
          <div className="relative px-5 py-4">
            <p className="text-[15px] text-amber-50/95 leading-[2] font-light text-center">
              {renderHighlightedText(text)}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 👻 ШЁПОТ — голоса, потусторонние звуки
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "whisper") {
    const isHighIntensity = intensity === "high";
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ 
          opacity: [0, 0.4, 0.25, 0.5, 0.35, 0.45],
          scale: [0.98, 1, 0.99, 1.01, 1],
        }}
        transition={{ duration: 2.5, ease: "easeInOut" }}
        className="py-7 px-6"
      >
        <div className="relative">
          {/* Пульсирующий фон */}
          <motion.div 
            className="absolute inset-0 -mx-6 -my-4 rounded-2xl"
            style={{
              background: isHighIntensity 
                ? "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15) 0%, rgba(76, 29, 149, 0.1) 50%, transparent 70%)"
                : "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
            }}
            animate={{ 
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          
          {/* Мерцающие частицы */}
          {isHighIntensity && (
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-violet-400/40 rounded-full"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${30 + (i % 3) * 20}%`,
                  }}
                  animate={{
                    opacity: [0, 0.8, 0],
                    y: [-5, 5, -5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>
          )}
          
          <p className={`relative text-[14px] leading-[2.4] text-center italic font-light tracking-[0.05em] ${
            isHighIntensity ? "text-violet-200/60" : "text-violet-300/45"
          }`}>
            {renderHighlightedText(text)}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ ДРАМАТИЧНЫЙ МОМЕНТ — акцент
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "dramatic") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="py-8"
      >
        <p className="text-[17px] text-white/95 leading-[1.9] font-light tracking-wide text-center px-4">
          {renderHighlightedText(text)}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 ДЕЙСТВИЕ — активное действие персонажа
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "action") {
    return (
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: intensityValues.opacity, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="py-4 px-6"
      >
        <p className="text-[15px] text-cyan-50/80 leading-[2] text-center font-light">
          {renderHighlightedText(text)}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🏷️ ЗАГОЛОВОК — крупный текст без блока
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "title") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: intensityValues.opacity, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="py-6 px-4"
      >
        <h1 className="text-center text-2xl md:text-3xl font-bold tracking-[0.15em] text-white/90 uppercase">
          <span className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent drop-shadow-lg">
            {text}
          </span>
        </h1>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🏷️ ПОДЗАГОЛОВОК — меньший текст под заголовком
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "subtitle") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: intensityValues.opacity * 0.8, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="py-2 px-4 -mt-4"
      >
        <p className="text-center text-base md:text-lg font-light tracking-[0.08em] text-white/60 italic">
          {text}
        </p>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📜 ДОКУМЕНТ — официальный текст
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "document") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 0.9, y: 0 }}
        transition={{ duration: 0.5 }}
        className="py-4 px-6"
      >
        <p className="text-[13px] text-slate-300/80 leading-[2] text-center font-mono tracking-wide">
          {renderHighlightedText(text)}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🕰️ ФЛЭШБЕК — воспоминание
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "flashback") {
    return (
      <motion.div 
        initial={{ opacity: 0, filter: "blur(4px) sepia(0.3)" }}
        animate={{ opacity: 0.8, filter: "blur(0px) sepia(0.1)" }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="py-5 px-6"
      >
        <p className="text-[14px] text-amber-100/55 leading-[2.2] text-center italic font-light tracking-wide">
          {renderHighlightedText(text)}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔮 ВИДЕНИЕ — сверхъестественный момент
  // ═══════════════════════════════════════════════════════════════════════════
  if (narrativeStyle === "vision") {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ 
          opacity: [0, 0.7, 0.5, 0.8],
          scale: [1.02, 1, 1.01, 1],
        }}
        transition={{ duration: 1.5 }}
        className="py-5 px-6"
      >
        <p className="text-[15px] text-violet-200/70 leading-[2.1] text-center font-light">
          {renderHighlightedText(text)}
        </p>
      </motion.div>
    );
  }
  
  // Типы контента
  const isClue = text.includes("Улика найдена") || text.includes("Улики найдены") || hasTag(tags, "clue");
  const isWarning = text.includes("⚠️") || hasTag(tags, "warning");
  const isConsequence = text.includes("ПОСЛЕДСТВИЕ") || text.includes("✅") || text.includes("💀");
  const isImportant = hasTag(tags, "important");
  const isEnding = (text.includes("ЭПИЗОД") && text.includes("ЗАВЕРШЁН")) || text.includes("КОНЕЦ ЭПИЗОДА");
  const isEpisodeStat = text.includes("Ваш рассудок:") || text.includes("Дней осталось:") || text.includes("Собрано улик:");
  const isStats = (text.includes("Ваш счёт:") || text.includes("Объективность:")) && !isEnding && !isEpisodeStat;
  
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
  
  // Многоточие (пауза)
  const isPause = text.trim() === "..." || text.trim() === "…";

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 КИНЕМАТОГРАФИЧЕСКИЙ СТИЛЬ — Первый экран
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ДАТА — появляется как в начале фильма
  if (isDate) {
    return (
      <motion.div 
        initial={{ opacity: 0, letterSpacing: "0.5em" }}
        animate={{ opacity: 1, letterSpacing: "0.25em" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="py-10 text-center"
      >
        <span className="
          text-xs font-light text-white/60 uppercase tracking-[0.25em]
          drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]
        ">
          {text}
        </span>
      </motion.div>
    );
  }
  
  // ГОД — минималистичный
  if (isYear) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-6 text-center"
      >
        <span className="text-xs text-white/40 tracking-[0.3em] font-light">
          {text}
        </span>
      </motion.div>
    );
  }
  
  // ЛОКАЦИЯ — элегантный подзаголовок
  if (isLocation) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="pb-8 text-center"
      >
        <span className="text-sm text-white/50 tracking-wider font-light">
          {text}
        </span>
      </motion.div>
    );
  }
  
  // ПАУЗА (многоточие) — три точки с анимацией
  if (isPause) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-8 flex justify-center gap-3"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/20"
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ДОКУМЕНТ В КАВЫЧКАХ — стиль машинописи
  // ═══════════════════════════════════════════════════════════════════════════
  
  const isDocument = text.startsWith('"') && text.endsWith('"') && text.length > 50;
  if (isDocument) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="px-8 py-6"
      >
        <div className="
          relative pl-4 
          border-l border-amber-500/30
        ">
          <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
          <p className="
            text-[13px] text-amber-100/70 leading-[1.9] 
            font-mono
          ">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // СТАРЫЙ ПАУЗА код для совместимости
  if (false && isPause) {
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
  // ЗАВЕРШЕНИЕ ЭПИЗОДА — Драматичный экран
  // ═══════════════════════════════════════════════════════════════════════════
  
  const isEpisodeEnd = text.includes("КОНЕЦ ЭПИЗОДА") || (text.includes("ЭПИЗОД") && text.includes("ЗАВЕРШЁН"));
  
  if (isEpisodeEnd) {
    // Извлекаем номер эпизода
    const episodeMatch = text.match(/ЭПИЗОДА?\s*(\d+)/i);
    const episodeNum = episodeMatch ? episodeMatch[1] : "1";
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="mx-4 my-10"
      >
        {/* Основной контейнер с градиентом */}
        <div className="relative overflow-hidden rounded-3xl">
          {/* Анимированный фон */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-black to-red-950/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
          
          {/* Мерцающие частицы — фиксированные позиции для SSR */}
          <div className="absolute inset-0 overflow-hidden">
            {[15, 25, 35, 45, 55, 65, 75, 85, 20, 40, 60, 80].map((pos, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-red-500/60 rounded-full"
                style={{
                  left: `${pos}%`,
                  top: `${10 + (i * 7) % 80}%`,
                }}
                animate={{
                  opacity: [0.2, 0.8, 0.2],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
          
          {/* Контент */}
          <div className="relative z-10 px-6 py-10 text-center">
            {/* Декоративная линия сверху */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="h-[1px] w-24 mx-auto mb-8 bg-gradient-to-r from-transparent via-red-500/60 to-transparent"
            />
            
            {/* Заголовок */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <span className="text-[10px] font-medium tracking-[0.3em] text-red-400/60 uppercase">
                Расследование продолжается
              </span>
              
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                Конец эпизода
              </h2>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.8, delay: 0.8 }}
                className="mt-3 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-900/50"
              >
                <span className="text-4xl font-black text-white">{episodeNum}</span>
              </motion.div>
            </motion.div>
            
            {/* Декоративная линия снизу */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="h-[1px] w-32 mx-auto mt-8 bg-gradient-to-r from-transparent via-red-500/40 to-transparent"
            />
          </div>
        </div>
      </motion.div>
    );
  }
  
  if (isEnding) {
    return null; // Старый код не нужен
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // СТАТИСТИКА ЭПИЗОДА — Карточки с данными
  // ═══════════════════════════════════════════════════════════════════════════
  
  const isStatLine = text.includes("Ваш рассудок:") || 
                     text.includes("Дней осталось:") || 
                     text.includes("Собрано улик:");
  
  if (isStatLine) {
    // Парсим значение
    const match = text.match(/:\s*(\d+)/);
    const value = match ? match[1] : "0";
    
    // Определяем тип статистики
    let icon = "📊";
    let label = "";
    let color = "from-slate-600 to-slate-700";
    let textColor = "text-slate-300";
    let maxValue = "";
    
    if (text.includes("рассудок")) {
      icon = "🧠";
      label = "Рассудок";
      maxValue = "/100";
      const sanityNum = parseInt(value);
      if (sanityNum >= 70) {
        color = "from-emerald-600 to-emerald-700";
        textColor = "text-emerald-400";
      } else if (sanityNum >= 40) {
        color = "from-amber-600 to-amber-700";
        textColor = "text-amber-400";
      } else {
        color = "from-red-600 to-red-700";
        textColor = "text-red-400";
      }
    } else if (text.includes("Дней")) {
      icon = "📅";
      label = "Дней осталось";
      const daysNum = parseInt(value);
      if (daysNum >= 3) {
        color = "from-sky-600 to-sky-700";
        textColor = "text-sky-400";
      } else if (daysNum >= 2) {
        color = "from-amber-600 to-amber-700";
        textColor = "text-amber-400";
      } else {
        color = "from-red-600 to-red-700";
        textColor = "text-red-400";
      }
    } else if (text.includes("улик")) {
      icon = "🔍";
      label = "Собрано улик";
      color = "from-violet-600 to-violet-700";
      textColor = "text-violet-400";
    }
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-6 my-2"
      >
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06]">
          {/* Градиентный акцент слева */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${color}`} />
          
          <div className="flex items-center gap-4 px-5 py-4">
            {/* Иконка */}
            <div className={`
              w-12 h-12 rounded-xl bg-gradient-to-br ${color}
              flex items-center justify-center text-2xl
              shadow-lg
            `}>
              {icon}
            </div>
            
            {/* Текст */}
            <div className="flex-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
                {label}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-2xl font-bold ${textColor}`}>
                  {value}
                </span>
                {maxValue && (
                  <span className="text-sm text-white/30">{maxValue}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  
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
  // ДИАЛОГИ БЕЗ ТЕГА SPEAKER — показываем как красивый текст
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isDialogue) {
    const dialogueText = text.replace(/^[—–-]\s*/, "").trim();
    
    // Нет тега speaker — показываем как повествование
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="px-6 py-4"
      >
        <p className="text-[15px] text-white/80 leading-[1.9] text-center">
          {dialogueText}
        </p>
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
  // ПОСЛЕДСТВИЯ — с тонким акцентом слева
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isConsequence) {
    const isPositive = text.includes("✅");
    const isNegative = text.includes("💀") || text.includes("казнён");
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-6 py-4"
      >
        <div className={`
          pl-4 border-l-2
          ${isPositive ? "border-emerald-500/60" : isNegative ? "border-red-500/60" : "border-amber-500/60"}
        `}>
          <p className={`
            text-[14px] leading-[1.8]
            ${isPositive ? "text-emerald-200/90" : isNegative ? "text-red-200/90" : "text-amber-200/90"}
          `}>
            {text.replace("ПОСЛЕДСТВИЕ:", "").replace("✅", "").replace("💀", "").trim()}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // Важный текст — без рамки, просто выделенный
  if (isImportant) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-6 py-4"
      >
        <p className="text-[15px] text-white leading-[1.9] text-center font-medium">
          {text}
        </p>
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
  // 💭 ВНУТРЕННИЙ ГОЛОС — Единый стиль для всего нарратива
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Текст в кавычках «» или "" — прямые мысли
  const isDirectThought = (text.startsWith("«") && text.endsWith("»")) || 
                          (text.startsWith('"') && text.endsWith('"') && text.length < 200);
  
  // Голоса/шёпот (особый хоррор-элемент)
  const isWhisper = text.startsWith("«...") || text.includes("...»") || 
                    (text.includes("«") && text.includes("»") && lowerText.includes("голос"));
  
  // Длинный нарратив
  const isLongNarrative = text.length > 180;
  
  // Короткая драматичная фраза
  const isShortDramatic = text.length < 50 && !text.includes(",") && !isDialogueIntro;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 👁️ ШЁПОТ / ГОЛОСА — хоррор-элемент
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isWhisper) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.5, 0.8, 0.6] }}
        transition={{ duration: 2, ease: "easeInOut" }}
        className="py-6 px-8"
      >
        <div className="relative">
          {/* Мерцающий фон */}
          <motion.div 
            className="absolute inset-0 -mx-4 -my-2 rounded-xl bg-red-950/20"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <p className="relative text-[14px] text-red-300/70 leading-[2.2] text-center italic tracking-wide">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 💭 ПРЯМЫЕ МЫСЛИ — в кавычках
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isDirectThought) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="py-5 px-6"
      >
        <div className="relative text-center">
          {/* Декоративные кавычки */}
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl text-white/10 font-serif">"</span>
          <p className="text-[15px] text-white/60 leading-[2] italic font-light px-8">
            {text.replace(/^[«"]|[»"]$/g, "")}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ КОРОТКАЯ ДРАМАТИЧНАЯ ФРАЗА
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isShortDramatic) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-6"
      >
        <p className="text-[15px] text-white/80 text-center font-light tracking-wide">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 ДЕЙСТВИЯ ГЕРОЯ (начинается с "Вы")
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isPlayerAction) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="py-4 px-5"
      >
        <div className="relative">
          {/* Тонкий индикатор слева */}
          <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-gradient-to-b from-slate-400/40 via-slate-500/20 to-transparent" />
          <p className="text-[15px] text-white/85 leading-[1.9] pl-4 font-light">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📍 ВВОДНАЯ ФРАЗА К ДИАЛОГУ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isDialogueIntro) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="pt-6 pb-2 px-4"
      >
        <p className="text-[13px] text-white/40 text-center italic tracking-wide">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 ОПИСАНИЕ НАХОДКИ / УЛИКИ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isEvidence && !isPlayerAction) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-4 my-4"
      >
        <div className="relative overflow-hidden rounded-xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/30">
          {/* Акцентная линия */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500/50 via-cyan-600/30 to-transparent" />
          <div className="flex gap-3 px-5 py-4">
            <span className="text-cyan-400/60 text-sm mt-0.5">◈</span>
            <p className="text-[14px] text-slate-200/80 leading-[1.8] font-light">
              {text}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌫️ АТМОСФЕРНОЕ ОПИСАНИЕ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isAtmosphere && !isPlayerAction && !isEvidence) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="py-5 px-8"
      >
        <p className="text-[14px] text-white/50 leading-[2.1] text-center italic font-light">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 👁️ ПРОФЕССИОНАЛЬНОЕ НАБЛЮДЕНИЕ
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
          <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-gradient-to-b from-amber-500/50 to-transparent" />
          <p className="text-[14px] text-amber-100/70 leading-[1.9] pl-4 font-light">
            {text}
          </p>
        </div>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📖 ДЛИННЫЙ НАРРАТИВ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (isLongNarrative) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-5 px-5"
      >
        <p className="text-[15px] text-white/70 leading-[2] font-light">
          {text}
        </p>
      </motion.div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 💫 ОБЫЧНЫЙ НАРРАТИВ — Внутренний голос
  // ═══════════════════════════════════════════════════════════════════════════
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="py-4 px-6"
    >
      <p className="text-[15px] text-white/70 leading-[2] text-center font-light">
        {renderHighlightedText(text)}
      </p>
    </motion.div>
  );
}


// Стили нарратива по настроению
function getMoodNarrativeStyle(mood: MoodType): string {
  switch (mood) {
    case "dark":
    case "horror":
    case "shock":
      return "bg-gradient-to-br from-red-950/40 to-black/60 border border-red-900/30";
    case "cosmic_horror":
      return "bg-gradient-to-br from-violet-950/50 to-black/70 border border-violet-900/40";
    case "tense":
    case "tension":
    case "pressure":
    case "suspicion":
      return "bg-gradient-to-br from-amber-950/30 to-black/50 border border-amber-900/20";
    case "mystery":
      return "bg-gradient-to-br from-purple-950/40 to-black/60 border border-purple-900/30";
    case "investigation":
      return "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30";
    case "hope":
    case "discovery":
      return "bg-gradient-to-br from-emerald-950/30 to-black/50 border border-emerald-900/20";
    case "conflict":
    case "action":
      return "bg-gradient-to-br from-orange-950/30 to-black/50 border border-orange-900/20";
    case "revelation":
      return "bg-gradient-to-br from-yellow-950/30 to-black/50 border border-yellow-900/20";
    case "emotional":
    case "bittersweet":
      return "bg-gradient-to-br from-pink-950/30 to-black/50 border border-pink-900/20";
    default:
      return "bg-white/5 border border-white/10";
  }
}

function EndScreen({ state }: { state: InkState }) {
  // Переменные из Ink истории "Красный лес"
  const sanity = (state.variables.sanity as number) ?? 100;
  const daysRemaining = (state.variables.days_remaining as number) ?? 5;
  const currentDay = (state.variables.current_day as number) ?? 1;
  const evidenceCollected = (state.variables.evidence_collected as number) ?? 0;
  
  // Дни прошло = current_day
  const daysPassed = currentDay;
  
  // Улики найдены = evidence_collected
  const evidenceFor = evidenceCollected;
  
  // Определяем тип концовки по тегам или статистике
  const endingType = getTagValue(state.tags, "ending");
  const hasGoodEnding = endingType === "good" || (!endingType && sanity >= 60 && evidenceCollected >= 8);
  const hasBadEnding = endingType === "bad" || endingType === "tragedy" || (!endingType && sanity < 30);
  const hasConscienceEnding = endingType === "conscience";
  const hasNeutralEnding = endingType === "neutral" || (!endingType && !hasGoodEnding && !hasBadEnding);
  
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
          {/* Дней осталось */}
          <div className={`
            relative overflow-hidden p-4 rounded-2xl 
            bg-gradient-to-br from-violet-900/40 to-purple-900/40 
            border ${config.borderColor}
          `}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/10 rounded-full blur-xl" />
            <div className="relative">
              <div className={`text-3xl font-bold mb-1 ${
                daysRemaining >= 3 ? "text-emerald-400" : 
                daysRemaining >= 1 ? "text-amber-400" : 
                "text-red-400"
              }`}>
                {daysRemaining}
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Дней осталось
              </div>
            </div>
          </div>
          
          {/* Рассудок */}
          <div className={`
            relative overflow-hidden p-4 rounded-2xl 
            bg-gradient-to-br from-blue-900/40 to-indigo-900/40 
            border ${config.borderColor}
          `}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl" />
            <div className="relative">
              <div className={`text-3xl font-bold mb-1 ${
                sanity >= 70 ? "text-emerald-400" : 
                sanity >= 40 ? "text-amber-400" : 
                "text-red-400"
              }`}>
                {sanity}%
              </div>
              <div className="text-xs text-white/50 uppercase tracking-wider">
                Рассудок
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
                {daysPassed}
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
    // Новые типы настроений из истории
    suspicion: {
      background: "bg-[#0c0a08]",
      accent: "bg-amber-600/20 text-amber-300",
      border: "border-amber-800/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0a08] to-transparent",
      choiceButton: "bg-amber-950/30 border border-amber-700/30 hover:border-amber-500/50",
      choiceLetter: "text-amber-500",
    },
    revelation: {
      background: "bg-[#0c0a06]",
      accent: "bg-yellow-500/20 text-yellow-300",
      border: "border-yellow-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0a06] to-transparent",
      choiceButton: "bg-yellow-950/30 border border-yellow-800/30 hover:border-yellow-500/50",
      choiceLetter: "text-yellow-400",
    },
    shock: {
      background: "bg-[#0a0606]",
      accent: "bg-red-600/30 text-red-300",
      border: "border-red-800/40",
      choicesBackground: "bg-gradient-to-t from-[#0a0606] to-transparent",
      choiceButton: "bg-red-950/40 border border-red-800/40 hover:border-red-400/50",
      choiceLetter: "text-red-500",
    },
    tension: {
      background: "bg-[#0c0a10]",
      accent: "bg-amber-500/20 text-amber-300",
      border: "border-amber-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0a10] to-transparent",
      choiceButton: "bg-amber-950/30 border border-amber-800/30 hover:border-amber-500/50",
      choiceLetter: "text-amber-400",
    },
    cosmic_horror: {
      background: "bg-[#08060c]",
      accent: "bg-violet-600/30 text-violet-300",
      border: "border-violet-900/40",
      choicesBackground: "bg-gradient-to-t from-[#08060c] to-transparent",
      choiceButton: "bg-violet-950/40 border border-violet-800/40 hover:border-violet-400/50",
      choiceLetter: "text-violet-500",
    },
    neutral: {
      background: "bg-[#0a0a12]",
      accent: "bg-white/10 text-white/70",
      border: "border-white/10",
      choicesBackground: "bg-gradient-to-t from-[#0a0a12] to-transparent",
      choiceButton: "bg-white/5 border border-white/10 hover:border-white/30",
      choiceLetter: "text-white/50",
    },
    emotional: {
      background: "bg-[#0c080a]",
      accent: "bg-pink-500/20 text-pink-300",
      border: "border-pink-900/30",
      choicesBackground: "bg-gradient-to-t from-[#0c080a] to-transparent",
      choiceButton: "bg-pink-950/30 border border-pink-800/30 hover:border-pink-500/50",
      choiceLetter: "text-pink-400",
    },
    action: {
      background: "bg-[#0c0806]",
      accent: "bg-orange-600/20 text-orange-300",
      border: "border-orange-800/30",
      choicesBackground: "bg-gradient-to-t from-[#0c0806] to-transparent",
      choiceButton: "bg-orange-950/30 border border-orange-700/30 hover:border-orange-500/50",
      choiceLetter: "text-orange-500",
    },
    bittersweet: {
      background: "bg-[#0a080a]",
      accent: "bg-rose-400/20 text-rose-300",
      border: "border-rose-900/20",
      choicesBackground: "bg-gradient-to-t from-[#0a080a] to-transparent",
      choiceButton: "bg-rose-950/20 border border-rose-800/20 hover:border-rose-500/40",
      choiceLetter: "text-rose-300",
    },
  };

  return styles[mood] || styles.normal;
}

export default InkStoryPlayer;
