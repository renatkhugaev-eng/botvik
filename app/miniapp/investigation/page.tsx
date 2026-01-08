"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { investigationHaptic } from "@/lib/haptic";
import { InkStoryPlayer } from "@/components/InkStoryPlayer";
import { DocumentViewer, DOCUMENTS, type InvestigationDocument, type DocumentHighlight } from "@/components/DocumentViewer";
import type { InkState } from "@/lib/ink-runtime";
import type { BoardState } from "@/lib/evidence-system";
import {
  createInitialBoardState,
  addEvidence,
} from "@/lib/evidence-system";
import {
  autosave,
  loadAutosave,
  hasAutosave,
  clearAutosave,
  createManualSave,
  getManualSaves,
  loadFromLocalStorage,
  formatPlaytime,
  type SaveMetadata,
  type InvestigationSave,
} from "@/lib/investigation-save";


// Импортируем Error Boundary
import { InkErrorBoundary } from "@/components/InkErrorBoundary";

// Импортируем скомпилированные истории
const STORY_FILES: Record<string, object | null> = {};

// Красный лес — ПОЛНАЯ история
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  STORY_FILES["red-forest-complete"] = require("@/content/investigations/red-forest/red-forest-complete.ink.json");
} catch {
  STORY_FILES["red-forest-complete"] = null;
}

// Конфигурация эпизодов
const EPISODES = [
  // ═══════════════════════════════════════════════════════════════════════════
  // КРАСНЫЙ ЛЕС — Полная история
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "red-forest-complete",
    episodeNum: 1,
    title: "🔴 Красный лес",
    subtitle: "Полная история. 5 эпизодов. 7 концовок.",
    description: "Закрытый город. Пропавшие люди. Древний культ. И дверь, которую лучше не открывать. Профессиональная нелинейная история с отслеживанием улик и системой рассудка.",
    icon: "🔴",
    difficulty: "Эпическая",
    duration: "2-3 часа",
    isAvailable: true,
    isNew: true,
    isComplete: true,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

type GameScreen = "episode_select" | "playing";

// Маппинг тегов улик (будет добавляться под конкретные истории)
const CLUE_TAG_TO_EVIDENCE_ID: Record<string, string> = {};

// ══════════════════════════════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════

export default function InvestigationPage() {
  const router = useRouter();
  
  // Episode selection state
  const [gameScreen, setGameScreen] = useState<GameScreen>("episode_select");
  const [selectedEpisode, setSelectedEpisode] = useState<typeof EPISODES[0] | null>(null);
  const [storyJson, setStoryJson] = useState<object | null>(null);
  
  // Game state
  const [boardState, setBoardState] = useState<BoardState>(createInitialBoardState);
  const [isStoryEnded, setIsStoryEnded] = useState(false);
  const [endingType, setEndingType] = useState<string | undefined>(undefined);
  const [storyScore, setStoryScore] = useState(0);
  const [storyKey, setStoryKey] = useState(0); // Ключ для перезагрузки истории
  const [currentDocument, setCurrentDocument] = useState<InvestigationDocument | null>(null);
  const evidenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Derived values
  const INVESTIGATION_ID = selectedEpisode?.id || "lesopolosa";
  const EPISODE_ID = selectedEpisode?.episodeNum || 1;
  
  // Save system state
  const [inkStateJson, setInkStateJson] = useState<string>("");
  const [currentChapter, setCurrentChapter] = useState(1);
  const [playtime, setPlaytime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [loadedSave, setLoadedSave] = useState<InvestigationSave | null>(null);
  const playtimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSaveTimeRef = useRef<number>(Date.now());

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (evidenceTimeoutRef.current) {
        clearTimeout(evidenceTimeoutRef.current);
      }
      if (playtimeIntervalRef.current) {
        clearInterval(playtimeIntervalRef.current);
      }
    };
  }, []);
  
  // Check for saved game on mount and when episode changes
  useEffect(() => {
    if (hasAutosave(INVESTIGATION_ID)) {
      setHasSavedGame(true);
      setShowContinuePrompt(true);
    } else {
      setHasSavedGame(false);
    }
  }, [INVESTIGATION_ID]);
  
  // Track playtime (restarts when episode changes or story ends)
  useEffect(() => {
    // Don't track if story ended
    if (isStoryEnded) return;
    
    playtimeIntervalRef.current = setInterval(() => {
      setPlaytime((prev) => prev + 1);
    }, 1000);
    
    return () => {
      if (playtimeIntervalRef.current) {
        clearInterval(playtimeIntervalRef.current);
        playtimeIntervalRef.current = null;
      }
    };
  }, [selectedEpisode?.id, isStoryEnded]);
  
  // ══════════════════════════════════════════════════════════════════════════
  // SAVE/LOAD FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════
  
  const performAutosave = useCallback(() => {
    if (!inkStateJson || isStoryEnded) return;
    
    setIsSaving(true);
    const result = autosave(
      INVESTIGATION_ID,
      EPISODE_ID,
      inkStateJson,
      boardState,
      currentChapter,
      storyScore,
      playtime
    );
    
    if (result.success) {
      setHasSavedGame(true);
    }
    
    // Brief saving indicator
    setTimeout(() => setIsSaving(false), 500);
  }, [inkStateJson, boardState, currentChapter, storyScore, playtime, isStoryEnded]);
  
  // Auto-save every 30 seconds with proper interval (fixes race condition)
  useEffect(() => {
    if (!inkStateJson || isStoryEnded) return;
    
    const intervalId = setInterval(() => {
      performAutosave();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [inkStateJson, isStoryEnded, performAutosave]);
  
  const handleManualSave = useCallback(() => {
    if (!inkStateJson) return;
    
    setIsSaving(true);
    investigationHaptic.insight();
    
    const result = createManualSave(
      INVESTIGATION_ID,
      EPISODE_ID,
      inkStateJson,
      boardState,
      currentChapter,
      storyScore,
      playtime
    );
    
    setTimeout(() => {
      setIsSaving(false);
      setShowSaveMenu(false);
    }, 500);
    
    return result.success;
  }, [inkStateJson, boardState, currentChapter, storyScore, playtime]);
  
  const handleLoadSave = useCallback((saveId: string) => {
    const result = loadFromLocalStorage(INVESTIGATION_ID, saveId);
    
    if (result.success) {
      setLoadedSave(result.data);
      setBoardState(result.data.boardState);
      setStoryScore(result.data.storyScore);
      setCurrentChapter(result.data.currentChapter);
      setPlaytime(result.data.playtime);
      setShowSaveMenu(false);
      setShowContinuePrompt(false);
      investigationHaptic.sceneTransition();
    }
  }, []);
  
  const handleContinueSave = useCallback(() => {
    const result = loadAutosave(INVESTIGATION_ID);
    
    if (result.success) {
      setLoadedSave(result.data);
      setBoardState(result.data.boardState);
      setStoryScore(result.data.storyScore);
      setCurrentChapter(result.data.currentChapter);
      setPlaytime(result.data.playtime);
      setShowContinuePrompt(false);
      investigationHaptic.sceneTransition();
    }
  }, []);
  
  const handleNewGame = useCallback(() => {
    clearAutosave(INVESTIGATION_ID);
    setShowContinuePrompt(false);
    setLoadedSave(null);
    setStoryKey(prev => prev + 1); // Принудительно пересоздать историю
    investigationHaptic.sceneTransition();
  }, [INVESTIGATION_ID]);
  
  // Обработчик выбора эпизода
  const handleEpisodeSelect = useCallback((episode: typeof EPISODES[0]) => {
    if (!episode.isAvailable) return;
    
    investigationHaptic.sceneTransition();
    setSelectedEpisode(episode);
    setStoryJson(STORY_FILES[episode.id] || null);
    
    // Сбрасываем состояние для нового эпизода
    setBoardState(createInitialBoardState());
    setIsStoryEnded(false);
    setStoryScore(0);
    setPlaytime(0);
    setCurrentChapter(1);
    setLoadedSave(null);
    setInkStateJson("");
    
    // Проверяем автосохранение для выбранного эпизода
    if (hasAutosave(episode.id)) {
      setHasSavedGame(true);
      setShowContinuePrompt(true);
    } else {
      setHasSavedGame(false);
    }
    
    setGameScreen("playing");
  }, []);
  
  // Обработчик возврата к выбору эпизода
  const handleBackToEpisodes = useCallback(() => {
    setGameScreen("episode_select");
    setSelectedEpisode(null);
    setStoryJson(null);
    investigationHaptic.sceneTransition();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // ОБРАБОТЧИКИ INK
  // ══════════════════════════════════════════════════════════════════════════

  const handleStoryEnd = useCallback((state: InkState) => {
    // Извлекаем тип концовки из тегов
    const endingTag = state.tags.find(t => t.startsWith("ending:"));
    if (endingTag) {
      const ending = endingTag.split(":")[1]?.trim();
      setEndingType(ending);
    }
    
    setIsStoryEnded(true);
    // Финальное сохранение
    performAutosave();
  }, [performAutosave]);
  
  // Обработчик изменения состояния Ink (для сохранения)
  const handleInkStateChange = useCallback((stateJson: string) => {
    setInkStateJson(stateJson);
    // Автосохранение после каждого значимого действия
    lastSaveTimeRef.current = Date.now() - 25000; // Trigger save on next tick
  }, []);

  const handleVariableChange = useCallback((name: string, value: unknown) => {
    if (name === "score" && typeof value === "number") {
      setStoryScore(value);
    }
  }, []);

  const handleTagFound = useCallback(
    (tag: string, value: string | boolean) => {
      // Обрабатываем теги улик (для будущих историй с доской улик)
      if (tag === "clue" && typeof value === "string") {
        // В "Красный лес" улики отслеживаются внутри Ink
        // Haptic feedback при нахождении улики
        investigationHaptic.clueDiscovered();
      }
      
      // Обрабатываем теги документов
      if (tag === "document" && typeof value === "string") {
        const doc = DOCUMENTS[value];
        if (doc) {
          investigationHaptic.evidenceInspect();
          setCurrentDocument(doc);
        }
      }
      
      // Отслеживаем главы для сохранения
      if (tag === "chapter" && typeof value === "string") {
        const chapter = parseInt(value, 10);
        if (!isNaN(chapter)) {
          setCurrentChapter(chapter);
        }
      }
    },
    []
  );
  
  // Обработчик обнаружения улики через документ (для будущих историй)
  const handleDocumentClueDiscovered = useCallback(
    (clueId: string) => {
      // В "Красный лес" улики отслеживаются внутри Ink
      investigationHaptic.clueDiscovered();
    },
    []
  );
  
  // Обработчик клика на highlight документа
  const handleDocumentHighlightClick = useCallback((highlight: DocumentHighlight) => {
    // Haptic feedback при клике на подсветку
    investigationHaptic.evidenceSelect();
  }, []);


  // ══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР
  // ══════════════════════════════════════════════════════════════════════════

  // Экран выбора эпизода
  if (gameScreen === "episode_select") {
    return (
      <EpisodeSelectScreen
        episodes={EPISODES}
        onSelect={handleEpisodeSelect}
        onBack={() => router.back()}
      />
    );
  }

  // Fallback если история не скомпилирована
  if (!storyJson) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-6">📖</div>
          <h1 className="text-2xl font-bold mb-4">История не найдена</h1>
          <p className="text-white/60 mb-6">
            Скомпилируйте Ink историю командой:
          </p>
          <code className="bg-white/10 px-4 py-2 rounded-lg text-violet-400">
            npm run ink:compile
          </code>
          <button
            onClick={handleBackToEpisodes}
            className="mt-6 w-full py-3 rounded-xl bg-white/10"
          >
            Назад к эпизодам
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex flex-col">
      {/* Хедер */}
      <Header
        storyScore={storyScore}
        playtime={playtime}
        episodeTitle={selectedEpisode?.title || "Расследование"}
        onBack={handleBackToEpisodes}
        onSaveClick={() => setShowSaveMenu(true)}
      />

      {/* Контент — только История */}
      <div className="flex-1 overflow-hidden">
        <InkErrorBoundary
          onRetry={() => {
            setStoryKey(prev => prev + 1);
            investigationHaptic.sceneTransition();
          }}
        >
          <InkStoryPlayer
            key={`story-${selectedEpisode?.id}-${storyKey}`}
            storyJson={storyJson}
            onEnd={handleStoryEnd}
            onVariableChange={handleVariableChange}
            onTagFound={handleTagFound}
            onInkStateChange={handleInkStateChange}
            initialState={loadedSave?.inkState}
          />
        </InkErrorBoundary>
      </div>

      {/* Финальный экран */}
      <AnimatePresence>
        {isStoryEnded && (
          <FinalScreen
            storyScore={storyScore}
            endingType={endingType}
            episodeTitle={selectedEpisode?.title}
            hasNextEpisode={(() => {
              const currentIdx = EPISODES.findIndex(e => e.id === selectedEpisode?.id);
              const nextEpisode = EPISODES[currentIdx + 1];
              return nextEpisode?.isAvailable ?? false;
            })()}
            onRestart={() => {
              // Сброс всех состояний
              setIsStoryEnded(false);
              setEndingType(undefined);
              setStoryScore(0);
              setBoardState(createInitialBoardState());
              setInkStateJson("");
              setLoadedSave(null);
              setPlaytime(0);
              
              // Очистить автосохранение
              clearAutosave(INVESTIGATION_ID);
              
              // Перезагрузка истории через ключ (принудительно пересоздаёт компонент)
              setStoryKey(prev => prev + 1);
              investigationHaptic.sceneTransition();
            }}
            onBack={handleBackToEpisodes}
            onNextEpisode={() => {
              const currentIdx = EPISODES.findIndex(e => e.id === selectedEpisode?.id);
              const nextEpisode = EPISODES[currentIdx + 1];
              if (nextEpisode?.isAvailable) {
                // Сброс состояния
                setIsStoryEnded(false);
                setEndingType(undefined);
                setStoryScore(0);
                setBoardState(createInitialBoardState());
                setInkStateJson("");
                // Запуск следующего эпизода
                handleEpisodeSelect(nextEpisode);
              }
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Просмотр документа */}
      <AnimatePresence>
        {currentDocument && (
          <DocumentViewer
            document={currentDocument}
            onClose={() => setCurrentDocument(null)}
            onHighlightClick={handleDocumentHighlightClick}
            onClueDiscovered={handleDocumentClueDiscovered}
          />
        )}
      </AnimatePresence>
      
      {/* Запрос продолжения игры */}
      <AnimatePresence>
        {showContinuePrompt && (
          <ContinuePrompt
            onContinue={handleContinueSave}
            onNewGame={handleNewGame}
          />
        )}
      </AnimatePresence>
      
      {/* Меню сохранений */}
      <AnimatePresence>
        {showSaveMenu && (
          <SaveMenu
            investigationId={INVESTIGATION_ID}
            onSave={handleManualSave}
            onLoad={handleLoadSave}
            onClose={() => setShowSaveMenu(false)}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>
      
      {/* Индикатор сохранения */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-4 px-3 py-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30 z-50"
          >
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <motion.div
                className="w-2 h-2 bg-emerald-400 rounded-full"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              Сохранение...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ХЕДЕР — Glassmorphism style
// ══════════════════════════════════════════════════════════════════════════════

function Header({
  storyScore,
  playtime,
  episodeTitle,
  onBack,
  onSaveClick,
}: {
  storyScore: number;
  playtime: number;
  episodeTitle: string;
  onBack: () => void;
  onSaveClick: () => void;
}) {

  return (
    <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a12]/80 border-b border-white/5">
      {/* Top row */}
      <div className="flex items-center justify-between px-4 py-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            investigationHaptic.sceneTransition();
            onBack();
          }}
          className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        <div className="text-center">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            Расследование • {formatPlaytime(playtime)}
          </div>
          <div className="text-sm font-bold text-white">{episodeTitle}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              investigationHaptic.evidenceSelect();
              onSaveClick();
            }}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
            title="Сохранения"
          >
            💾
          </motion.button>
          
          {/* Score badge with glow */}
          <div 
            className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.2))',
              boxShadow: '0 0 12px rgba(139, 92, 246, 0.3)',
            }}
          >
            <span className="text-violet-300">{storyScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ФИНАЛЬНЫЙ ЭКРАН — Glassmorphism style
// ══════════════════════════════════════════════════════════════════════════════

function FinalScreen({
  storyScore,
  endingType,
  onRestart,
  onBack,
  onNextEpisode,
  hasNextEpisode,
  episodeTitle,
}: {
  storyScore: number;
  endingType?: string;
  onRestart: () => void;
  onBack: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  episodeTitle?: string;
}) {
  const [showTotal, setShowTotal] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  
  const totalScore = storyScore;
  
  // Определяем текст и стиль концовки
  const getEndingInfo = () => {
    if (endingType === "good" || totalScore >= 200) {
      return {
        icon: "🏆",
        title: "Блестящее расследование!",
        subtitle: "Вы сохранили объективность и нашли ключевые улики.",
        gradient: "from-emerald-500 to-green-600",
        glow: "rgba(16, 185, 129, 0.4)",
        textColor: "text-emerald-400",
      };
    } else if (endingType === "bad" || endingType === "tragedy" || totalScore < 0) {
      return {
        icon: "💀",
        title: "Трагический исход",
        subtitle: "Ваш выбор привёл к непоправимым последствиям.",
        gradient: "from-red-500 to-rose-600",
        glow: "rgba(239, 68, 68, 0.4)",
        textColor: "text-red-400",
      };
    } else if (endingType === "conscience") {
      return {
        icon: "⚖️",
        title: "Чистая совесть",
        subtitle: "Вы потеряли карьеру, но сохранили честь.",
        gradient: "from-amber-500 to-orange-600",
        glow: "rgba(245, 158, 11, 0.4)",
        textColor: "text-amber-400",
      };
    } else if (endingType === "neutral") {
      return {
        icon: "❓",
        title: "Неопределённость",
        subtitle: "Дело осталось незавершённым. История продолжится...",
        gradient: "from-blue-500 to-cyan-600",
        glow: "rgba(59, 130, 246, 0.4)",
        textColor: "text-blue-400",
      };
    } else if (totalScore >= 100) {
      return {
        icon: "✅",
        title: "Хорошая работа!",
        subtitle: "Вы провели добросовестное расследование.",
        gradient: "from-violet-500 to-indigo-600",
        glow: "rgba(139, 92, 246, 0.4)",
        textColor: "text-violet-400",
      };
    }
    return {
      icon: "📋",
      title: "Расследование завершено",
      subtitle: "Эпизод пройден.",
      gradient: "from-slate-500 to-slate-600",
      glow: "rgba(100, 116, 139, 0.3)",
      textColor: "text-white/70",
    };
  };
  
  const ending = getEndingInfo();
  
  // Последовательное появление элементов
  useEffect(() => {
    const timers = [
      setTimeout(() => setShowTotal(true), 800),
      setTimeout(() => setShowButtons(true), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", damping: 20 }}
        className="relative max-w-md w-full max-h-[90vh]"
      >
        {/* Gradient border */}
        <div 
          className="absolute inset-0 rounded-[28px] p-[1px]"
          style={{
            background: `linear-gradient(135deg, ${ending.glow}, transparent, ${ending.glow.replace('0.4', '0.2')})`,
          }}
        />
        
        <div className="relative rounded-[27px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] p-6 max-h-[90vh] overflow-auto">
          {/* Header with animated icon */}
          <motion.div 
            className="text-center mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Icon with glow */}
            <div className="relative inline-block mb-4">
              <div 
                className="absolute inset-0 rounded-2xl blur-2xl scale-150"
                style={{ backgroundColor: ending.glow }}
              />
              <motion.div 
                className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-5xl bg-gradient-to-br ${ending.gradient}`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring", damping: 10 }}
                style={{ boxShadow: `0 0 40px ${ending.glow}` }}
              >
                {ending.icon}
              </motion.div>
            </div>
            
            <h2 className={`text-2xl font-bold mb-2 ${ending.textColor}`}>
              {ending.title}
            </h2>
            <p className="text-sm text-white/50">
              {ending.subtitle}
            </p>
          </motion.div>

          {/* Total score card */}
          <AnimatePresence>
            {showTotal && (
              <motion.div 
                className="text-center p-5 rounded-xl mb-5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.1))',
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
                }}
              >
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Общий счёт</div>
                <motion.div 
                  className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {totalScore}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* Action buttons */}
          <AnimatePresence>
            {showButtons && (
              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Primary button */}
                {hasNextEpisode && onNextEpisode ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onNextEpisode}
                    className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 text-white"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span>Следующий эпизод</span>
                    <span className="text-xl">→</span>
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onBack}
                    className="w-full py-4 rounded-xl font-bold text-lg text-white"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    Выбрать эпизод
                  </motion.button>
                )}
                
                {/* Secondary button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onRestart}
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-white/70"
                >
                  <span>🔄</span>
                  <span>Пройти заново</span>
                </motion.button>
                
                {/* Back to episodes if there's next episode */}
                {hasNextEpisode && (
                  <button
                    onClick={onBack}
                    className="w-full py-2 rounded-xl text-white/40 text-sm hover:text-white/60 transition-colors"
                  >
                    ← К списку эпизодов
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ПРОДОЛЖИТЬ ИГРУ — Glassmorphism style
// ══════════════════════════════════════════════════════════════════════════════

function ContinuePrompt({
  onContinue,
  onNewGame,
}: {
  onContinue: () => void;
  onNewGame: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative max-w-sm w-full"
      >
        {/* Gradient border */}
        <div 
          className="absolute inset-0 rounded-[24px] p-[1px]"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.3))',
          }}
        />
        
        <div className="relative rounded-[23px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] p-6">
          <div className="text-center mb-6">
            {/* Icon with glow */}
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 rounded-xl bg-violet-500/30 blur-xl scale-150" />
              <div 
                className="relative w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.2))',
                  boxShadow: '0 0 24px rgba(139, 92, 246, 0.3)',
                }}
              >
                📂
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Найдено сохранение</h2>
            <p className="text-white/50 text-sm">
              У вас есть незавершённое расследование. Продолжить?
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onContinue}
              className="w-full py-4 rounded-xl font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
              }}
            >
              Продолжить
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onNewGame}
              className="w-full py-4 rounded-xl bg-white/5 border border-white/10 font-medium text-white/60 hover:bg-white/10 transition-colors"
            >
              Начать заново
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МЕНЮ СОХРАНЕНИЙ — Glassmorphism style
// ══════════════════════════════════════════════════════════════════════════════

function SaveMenu({
  investigationId,
  onSave,
  onLoad,
  onClose,
  isSaving,
}: {
  investigationId: string;
  onSave: () => void;
  onLoad: (saveId: string) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const saves = getManualSaves(investigationId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative max-w-md w-full max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient border */}
        <div 
          className="absolute inset-0 rounded-[24px] p-[1px]"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), transparent, rgba(139, 92, 246, 0.2))',
          }}
        />
        
        <div className="relative rounded-[23px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] p-6 max-h-[80vh] overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.2))',
                }}
              >
                💾
              </div>
              <h2 className="text-xl font-bold text-white">Сохранения</h2>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
            >
              ✕
            </motion.button>
          </div>

          {/* New save button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onSave}
            disabled={isSaving}
            className="w-full py-4 rounded-xl font-bold mb-5 flex items-center justify-center gap-2 disabled:opacity-50 text-white"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
            }}
          >
            {isSaving ? (
              <>
                <motion.div
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Сохранение...
              </>
            ) : (
              <>
                <span>➕</span>
                <span>Новое сохранение</span>
              </>
            )}
          </motion.button>

          {/* Saves list */}
          {saves.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Ваши сохранения</h3>
              {saves.map((save, index) => (
                <motion.button
                  key={save.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onLoad(save.id)}
                  className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white">Глава {save.currentChapter}</span>
                    <span className="text-xs text-white/40 px-2 py-0.5 rounded-full bg-white/5">
                      {formatPlaytime(save.playtime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400">{save.evidenceCount} улик</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{save.connectionsCount} связей</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">{save.storyScore} очков</span>
                  </div>
                  <div className="text-[10px] text-white/30 mt-2">
                    {new Date(save.savedAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div 
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}
              >
                📭
              </div>
              <p className="text-sm text-white/40">Нет сохранений</p>
              <p className="text-xs text-white/25 mt-1">Нажмите кнопку выше, чтобы сохранить прогресс</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЭКРАН ВЫБОРА ЭПИЗОДА — Glassmorphism style
// ══════════════════════════════════════════════════════════════════════════════

const EPISODE_GRADIENTS: Record<number, { gradient: string; glow: string }> = {
  1: { gradient: "from-violet-500 to-indigo-600", glow: "rgba(139, 92, 246, 0.3)" },
  2: { gradient: "from-amber-500 to-orange-600", glow: "rgba(245, 158, 11, 0.3)" },
  3: { gradient: "from-slate-500 to-slate-600", glow: "rgba(100, 116, 139, 0.2)" },
};

function EpisodeSelectScreen({
  episodes,
  onSelect,
  onBack,
}: {
  episodes: typeof EPISODES;
  onSelect: (episode: typeof EPISODES[0]) => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a12] via-[#0f0f1a] to-[#0a0a12] text-white">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Glassmorphism sticky
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a12]/80 border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Назад</span>
          </motion.button>
          
          <h1 className="text-[15px] font-bold text-white">Расследования</h1>
          
          <div className="w-16" />
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
          CASE INTRO — Icon with glow + description
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="px-4 pt-8 pb-6 text-center"
      >
        {/* Icon with glow effect */}
        <div className="relative inline-block mb-5">
          <div className="absolute inset-0 rounded-2xl bg-violet-500/30 blur-2xl scale-150" />
          <div 
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border-2 border-violet-500/50"
            style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.1))',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.3)',
            }}
          >
            🔍
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Дело Лесополоса</h2>
        <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
          Интерактивное расследование серии убийств 1978-1990 годов. 
          Вы — следователь, расследующий самое сложное дело в истории СССР.
        </p>
      </motion.div>
      
      {/* ═══════════════════════════════════════════════════════════════════
          EPISODES LIST — Cards with glassmorphism
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 pb-8 space-y-4">
        {episodes.map((episode, index) => {
          const colors = EPISODE_GRADIENTS[episode.episodeNum] || EPISODE_GRADIENTS[1];
          
          return (
            <motion.div
              key={episode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.08, type: "spring", stiffness: 300, damping: 25 }}
            >
              <motion.button
                whileTap={{ scale: episode.isAvailable ? 0.98 : 1 }}
                onClick={() => episode.isAvailable && onSelect(episode)}
                disabled={!episode.isAvailable}
                className="w-full text-left"
              >
                <div 
                  className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${
                    !episode.isAvailable ? 'opacity-50' : ''
                  }`}
                  style={{
                    boxShadow: episode.isAvailable ? `0 4px 24px ${colors.glow}` : 'none',
                  }}
                >
                  {/* Gradient border effect for available episodes */}
                  {episode.isAvailable && (
                    <div 
                      className="absolute inset-0 rounded-2xl p-[1px]"
                      style={{
                        background: `linear-gradient(135deg, ${colors.glow.replace('0.3', '0.5')}, transparent, ${colors.glow.replace('0.3', '0.3')})`,
                      }}
                    />
                  )}
                  
                  {/* Card content */}
                  <div className={`
                    relative p-5 rounded-2xl border backdrop-blur-sm
                    ${episode.isAvailable 
                      ? 'bg-gradient-to-br from-[#1a1a2e]/90 to-[#0f0f1a]/90 border-white/10' 
                      : 'bg-[#0f0f1a]/60 border-white/5'
                    }
                  `}>
                    <div className="flex items-start gap-4">
                      {/* Episode icon with glow */}
                      <div className="relative flex-shrink-0">
                        {episode.isAvailable && (
                          <div 
                            className="absolute inset-0 rounded-xl blur-lg opacity-60"
                            style={{ background: `linear-gradient(135deg, ${colors.glow})` }}
                          />
                        )}
                        <div 
                          className={`relative w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                            episode.isAvailable 
                              ? `bg-gradient-to-br ${colors.gradient}` 
                              : 'bg-white/10'
                          }`}
                        >
                          {episode.isAvailable ? episode.icon : '🔒'}
                        </div>
                      </div>
                      
                      {/* Episode info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            episode.isAvailable 
                              ? 'bg-violet-500/20 text-violet-400' 
                              : 'bg-white/10 text-white/40'
                          }`}>
                            Эпизод {episode.episodeNum}
                          </span>
                          {!episode.isAvailable && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30">
                              🔒 Скоро
                            </span>
                          )}
                        </div>
                        
                        <h3 className={`text-lg font-bold mb-0.5 ${episode.isAvailable ? 'text-white' : 'text-white/40'}`}>
                          {episode.title}
                        </h3>
                        <p className="text-sm text-white/50 mb-1">{episode.subtitle}</p>
                        <p className="text-xs text-white/30 line-clamp-2">{episode.description}</p>
                        
                        {/* Meta info */}
                        {episode.isAvailable && (
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/50">
                              ⏱ {episode.duration}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/50">
                              📊 {episode.difficulty}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Chevron */}
                      {episode.isAvailable && (
                        <svg className="w-5 h-5 text-white/20 mt-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            </motion.div>
          );
        })}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER NOTE
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="px-4 pb-8 text-center"
      >
        <p className="text-xs text-white/25">
          Основано на реальных событиях.
        </p>
        <p className="text-xs text-white/15 mt-1">
          Некоторые детали изменены в интересах повествования.
        </p>
      </motion.div>
    </div>
  );
}
