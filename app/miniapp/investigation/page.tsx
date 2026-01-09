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
import { getBackgroundMusic } from "@/lib/background-music";


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
  
  // Music state
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const musicInitializedRef = useRef(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (evidenceTimeoutRef.current) {
        clearTimeout(evidenceTimeoutRef.current);
      }
      if (playtimeIntervalRef.current) {
        clearInterval(playtimeIntervalRef.current);
      }
      // Останавливаем музыку при размонтировании
      const music = getBackgroundMusic();
      music.stop();
    };
  }, []);
  
  // ══════════════════════════════════════════════════════════════════════════
  // MUSIC CONTROL
  // ══════════════════════════════════════════════════════════════════════════
  
  // Запуск музыки при начале игры
  useEffect(() => {
    if (gameScreen === "playing" && selectedEpisode && !musicInitializedRef.current) {
      // Музыка запустится при первом взаимодействии пользователя
      musicInitializedRef.current = true;
    }
    
    // Остановка музыки при выходе из игры
    if (gameScreen !== "playing" && musicInitializedRef.current) {
      const music = getBackgroundMusic();
      music.stop();
      setIsMusicPlaying(false);
      musicInitializedRef.current = false;
    }
  }, [gameScreen, selectedEpisode]);
  
  // Остановка музыки при завершении истории
  useEffect(() => {
    if (isStoryEnded) {
      const music = getBackgroundMusic();
      music.pause();
      setIsMusicPlaying(false);
    }
  }, [isStoryEnded]);
  
  // Функция запуска музыки (вызывается при первом клике)
  const startMusic = useCallback(async () => {
    if (isMusicMuted) return;
    
    const music = getBackgroundMusic();
    music.updateConfig({ masterVolume: musicVolume });
    
    const success = await music.play("red-forest-ambient");
    if (success) {
      setIsMusicPlaying(true);
    }
  }, [musicVolume, isMusicMuted]);
  
  // Toggle music
  const toggleMusic = useCallback(async () => {
    const music = getBackgroundMusic();
    
    if (isMusicPlaying) {
      await music.pause();
      setIsMusicPlaying(false);
      setIsMusicMuted(true);
    } else {
      setIsMusicMuted(false);
      const success = await music.play();
      setIsMusicPlaying(success);
    }
  }, [isMusicPlaying]);
  
  // Изменение громкости (для будущего UI слайдера)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleVolumeChange = useCallback((volume: number) => {
    setMusicVolume(volume);
    const music = getBackgroundMusic();
    music.setVolume(volume);
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
    setShowEndingButton(false);
    setEndingType(undefined);
    setStoryScore(0);
    setFinalStats(null);
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

  // Состояние для показа кнопки "Показать результаты"
  const [showEndingButton, setShowEndingButton] = useState(false);
  // Финальная статистика из Ink
  const [finalStats, setFinalStats] = useState<{
    sanity: number;
    cluesFound: number;
    cultAwareness: number;
    loreDepth: number;
    humanity: number;
    theoriesDebunked: number;
    endingName: string;
  } | null>(null);
  
  const handleStoryEnd = useCallback((state: InkState) => {
    // Извлекаем тип концовки из тегов
    const endingTag = state.tags.find(t => t.startsWith("ending:"));
    let endingName = "unknown";
    if (endingTag) {
      const ending = endingTag.split(":")[1]?.trim();
      setEndingType(ending);
      endingName = ending || "unknown";
    }
    
    // Извлекаем статистику из переменных Ink
    const vars = state.variables || {};
    setFinalStats({
      sanity: (vars.sanity as number) || 0,
      cluesFound: (vars.evidence_collected as number) || 0,
      cultAwareness: (vars.cult_awareness as number) || 0,
      loreDepth: (vars.lore_depth as number) || 0,
      humanity: (vars.humanity as number) || 50,
      theoriesDebunked: (vars.theories_debunked as number) || 0,
      endingName,
    });
    
    // НЕ показываем финальный экран сразу — даём прочитать текст концовки
    // Вместо этого показываем кнопку "Показать результаты"
    setShowEndingButton(true);
    
    // Финальное сохранение
    performAutosave();
  }, [performAutosave]);
  
  // Показать финальный экран по нажатию кнопки
  const handleShowResults = useCallback(() => {
    setShowEndingButton(false);
    setIsStoryEnded(true);
    investigationHaptic.sceneTransition();
  }, []);
  
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
        isMusicPlaying={isMusicPlaying}
        onMusicToggle={toggleMusic}
      />

      {/* Контент — только История */}
      <div 
        className="flex-1 overflow-hidden"
        onClick={() => {
          // Запускаем музыку при первом взаимодействии (требуется user gesture)
          if (!isMusicPlaying && !isMusicMuted) {
            startMusic();
          }
        }}
      >
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

      {/* Кнопка "Показать результаты" — появляется после концовки */}
      <AnimatePresence>
        {showEndingButton && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/95 to-transparent z-40"
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleShowResults}
              className="w-full py-4 rounded-xl font-bold text-lg text-white flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
              }}
            >
              <span>📊</span>
              <span>Показать результаты</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Финальный экран */}
      <AnimatePresence>
        {isStoryEnded && (
          <FinalScreen
            endingType={endingType}
            episodeTitle={selectedEpisode?.title}
            playtime={playtime}
            finalStats={finalStats}
            hasNextEpisode={(() => {
              const currentIdx = EPISODES.findIndex(e => e.id === selectedEpisode?.id);
              const nextEpisode = EPISODES[currentIdx + 1];
              return nextEpisode?.isAvailable ?? false;
            })()}
            onRestart={() => {
              // Сброс всех состояний
              setIsStoryEnded(false);
              setShowEndingButton(false);
              setEndingType(undefined);
              setStoryScore(0);
              setFinalStats(null);
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
                setShowEndingButton(false);
                setEndingType(undefined);
                setStoryScore(0);
                setFinalStats(null);
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
  isMusicPlaying,
  onMusicToggle,
}: {
  storyScore: number;
  playtime: number;
  episodeTitle: string;
  onBack: () => void;
  onSaveClick: () => void;
  isMusicPlaying: boolean;
  onMusicToggle: () => void;
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
          {/* Music toggle button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              investigationHaptic.evidenceSelect();
              onMusicToggle();
            }}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
              isMusicPlaying 
                ? "bg-violet-500/20 border-violet-400/30 text-violet-300" 
                : "bg-white/5 border-white/10 text-white/40"
            }`}
            title={isMusicPlaying ? "Выключить музыку" : "Включить музыку"}
          >
            {isMusicPlaying ? "🔊" : "🔇"}
          </motion.button>
          
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

// Тип для статистики финала
type FinalStats = {
  sanity: number;
  cluesFound: number;
  cultAwareness: number;
  loreDepth: number;
  humanity: number;
  theoriesDebunked: number;
  endingName: string;
} | null;

// Данные о всех возможных концовках для мотивации перепрохождения
const ALL_ENDINGS = [
  { id: "escape_tanya", name: "Побег с Таней", icon: "💕", rarity: "Редкая" },
  { id: "escape_alone", name: "Одинокое спасение", icon: "🏃", rarity: "Обычная" },
  { id: "ritual_stop", name: "Остановить ритуал", icon: "🛑", rarity: "Героическая" },
  { id: "ritual_join", name: "Принять Красную луну", icon: "🌑", rarity: "Тёмная" },
  { id: "sacrifice", name: "Жертва ради других", icon: "⚰️", rarity: "Трагическая" },
  { id: "madness", name: "Безумие", icon: "🌀", rarity: "Скрытая" },
  { id: "betrayal", name: "Предательство", icon: "🗡️", rarity: "Тёмная" },
  { id: "truth", name: "Раскрыть правду", icon: "📜", rarity: "Истинная" },
];

function FinalScreen({
  endingType,
  onRestart,
  onBack,
  onNextEpisode,
  hasNextEpisode,
  episodeTitle,
  playtime,
  finalStats,
}: {
  endingType?: string;
  onRestart: () => void;
  onBack: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  episodeTitle?: string;
  playtime?: number;
  finalStats: FinalStats;
}) {
  const [showStats, setShowStats] = useState(false);
  const [showEndings, setShowEndings] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  
  // Форматирование времени игры
  const formatPlaytime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes} мин`;
  };
  
  // Определяем текст и стиль концовки на основе endingType
  const getEndingInfo = () => {
    const endingMap: Record<string, {
      icon: string;
      title: string;
      subtitle: string;
      gradient: string;
      glow: string;
      textColor: string;
    }> = {
      escape_tanya: {
        icon: "💕",
        title: "Побег с Таней",
        subtitle: "Вы спасли друг друга из тьмы Красного леса.",
        gradient: "from-pink-500 to-rose-600",
        glow: "rgba(236, 72, 153, 0.4)",
        textColor: "text-pink-400",
      },
      escape_alone: {
        icon: "🏃",
        title: "Одинокое спасение",
        subtitle: "Вы выбрались, но какой ценой?",
        gradient: "from-slate-500 to-gray-600",
        glow: "rgba(100, 116, 139, 0.4)",
        textColor: "text-slate-400",
      },
      ritual_stop: {
        icon: "🛑",
        title: "Ритуал остановлен",
        subtitle: "Вы предотвратили пробуждение древнего зла.",
        gradient: "from-emerald-500 to-green-600",
        glow: "rgba(16, 185, 129, 0.4)",
        textColor: "text-emerald-400",
      },
      ritual_join: {
        icon: "🌑",
        title: "Красная луна",
        subtitle: "Тьма приняла вас. Вы стали частью леса навсегда.",
        gradient: "from-red-700 to-rose-900",
        glow: "rgba(127, 29, 29, 0.5)",
        textColor: "text-red-500",
      },
      sacrifice: {
        icon: "⚰️",
        title: "Последняя жертва",
        subtitle: "Ваша смерть спасла других. Герои не забываются.",
        gradient: "from-amber-500 to-orange-600",
        glow: "rgba(245, 158, 11, 0.4)",
        textColor: "text-amber-400",
      },
      madness: {
        icon: "🌀",
        title: "Безумие",
        subtitle: "Рассудок покинул вас. Лес победил.",
        gradient: "from-purple-700 to-violet-900",
        glow: "rgba(109, 40, 217, 0.5)",
        textColor: "text-purple-400",
      },
      betrayal: {
        icon: "🗡️",
        title: "Предательство",
        subtitle: "Вы выбрали тёмный путь ради выживания.",
        gradient: "from-zinc-600 to-neutral-800",
        glow: "rgba(82, 82, 91, 0.5)",
        textColor: "text-zinc-400",
      },
      truth: {
        icon: "📜",
        title: "Правда раскрыта",
        subtitle: "Мир узнал о том, что скрывалось в лесу.",
        gradient: "from-cyan-500 to-blue-600",
        glow: "rgba(6, 182, 212, 0.4)",
        textColor: "text-cyan-400",
      },
    };
    
    if (endingType && endingMap[endingType]) {
      return endingMap[endingType];
    }
    
    // Fallback для неизвестных концовок
    return {
      icon: "📋",
      title: "Расследование завершено",
      subtitle: episodeTitle || "Эпизод пройден.",
      gradient: "from-violet-500 to-indigo-600",
      glow: "rgba(139, 92, 246, 0.4)",
      textColor: "text-violet-400",
    };
  };
  
  const ending = getEndingInfo();
  
  // Определяем статус показателей
  const getStatStatus = (value: number, max: number) => {
    const percent = (value / max) * 100;
    if (percent >= 80) return { color: "text-emerald-400", bg: "bg-emerald-500", label: "Отлично" };
    if (percent >= 50) return { color: "text-amber-400", bg: "bg-amber-500", label: "Хорошо" };
    if (percent >= 25) return { color: "text-orange-400", bg: "bg-orange-500", label: "Средне" };
    return { color: "text-red-400", bg: "bg-red-500", label: "Низко" };
  };
  
  // Получаем открытые концовки (в будущем можно хранить в localStorage)
  const unlockedEndings = endingType ? [endingType] : [];
  
  // Последовательное появление элементов
  useEffect(() => {
    const timers = [
      setTimeout(() => setShowStats(true), 600),
      setTimeout(() => setShowEndings(true), 1200),
      setTimeout(() => setShowButtons(true), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 z-50"
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
        
        <div className="relative rounded-[27px] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] p-5 max-h-[90vh] overflow-auto custom-scrollbar">
          {/* Header with animated icon */}
          <motion.div 
            className="text-center mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Icon with glow */}
            <div className="relative inline-block mb-3">
              <div 
                className="absolute inset-0 rounded-2xl blur-2xl scale-150"
                style={{ backgroundColor: ending.glow }}
              />
              <motion.div 
                className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-4xl bg-gradient-to-br ${ending.gradient}`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: "spring", damping: 10 }}
                style={{ boxShadow: `0 0 30px ${ending.glow}` }}
              >
                {ending.icon}
              </motion.div>
            </div>
            
            <h2 className={`text-xl font-bold mb-1 ${ending.textColor}`}>
              {ending.title}
            </h2>
            <p className="text-xs text-white/50 px-4">
              {ending.subtitle}
            </p>
            
            {/* Время прохождения */}
            {playtime !== undefined && playtime > 0 && (
              <div className="mt-2 text-xs text-white/30">
                ⏱️ Время прохождения: {formatPlaytime(playtime)}
              </div>
            )}
          </motion.div>

          {/* Статистика расследования */}
          <AnimatePresence>
            {showStats && finalStats && (
              <motion.div 
                className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h3 className="text-xs uppercase tracking-wider text-white/40 mb-3 text-center">
                  Итоги расследования
                </h3>
                
                <div className="space-y-3">
                  {/* Рассудок */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/60 flex items-center gap-1">
                        🧠 Рассудок
                      </span>
                      <span className={`text-xs font-medium ${getStatStatus(finalStats.sanity, 100).color}`}>
                        {finalStats.sanity}/100
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${getStatStatus(finalStats.sanity, 100).bg}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(finalStats.sanity, 100)}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                      />
                    </div>
                  </div>
                  
                  {/* Человечность */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/60 flex items-center gap-1">
                        ❤️ Человечность
                      </span>
                      <span className={`text-xs font-medium ${getStatStatus(finalStats.humanity, 100).color}`}>
                        {finalStats.humanity}/100
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${getStatStatus(finalStats.humanity, 100).bg}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(finalStats.humanity, 100)}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                    </div>
                  </div>
                  
                  {/* Улики */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="text-center p-2 rounded-lg bg-white/5">
                      <div className="text-lg font-bold text-violet-400">
                        {finalStats.cluesFound}
                      </div>
                      <div className="text-[10px] text-white/40">Улик найдено</div>
                    </div>
                    
                    <div className="text-center p-2 rounded-lg bg-white/5">
                      <div className="text-lg font-bold text-amber-400">
                        {finalStats.loreDepth}
                      </div>
                      <div className="text-[10px] text-white/40">Глубина лора</div>
                    </div>
                    
                    <div className="text-center p-2 rounded-lg bg-white/5">
                      <div className="text-lg font-bold text-red-400">
                        {finalStats.cultAwareness}%
                      </div>
                      <div className="text-[10px] text-white/40">Знание о культе</div>
                    </div>
                    
                    <div className="text-center p-2 rounded-lg bg-white/5">
                      <div className="text-lg font-bold text-cyan-400">
                        {finalStats.theoriesDebunked}
                      </div>
                      <div className="text-[10px] text-white/40">Теорий опровергнуто</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Концовки — мотивация к перепрохождению */}
          <AnimatePresence>
            {showEndings && (
              <motion.div 
                className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h3 className="text-xs uppercase tracking-wider text-white/40 mb-3 text-center">
                  Концовки — {unlockedEndings.length}/{ALL_ENDINGS.length}
                </h3>
                
                <div className="grid grid-cols-4 gap-2">
                  {ALL_ENDINGS.map((e) => {
                    const isUnlocked = unlockedEndings.includes(e.id);
                    const isCurrent = endingType === e.id;
                    
                    return (
                      <motion.div
                        key={e.id}
                        className={`relative aspect-square rounded-lg flex flex-col items-center justify-center p-1 ${
                          isCurrent 
                            ? "bg-gradient-to-br from-violet-500/30 to-purple-600/30 border border-violet-400/50" 
                            : isUnlocked 
                              ? "bg-white/10 border border-white/20" 
                              : "bg-black/30 border border-white/5"
                        }`}
                        initial={isCurrent ? { scale: 0.8 } : {}}
                        animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <span className={`text-xl ${!isUnlocked && !isCurrent ? "grayscale opacity-30" : ""}`}>
                          {isUnlocked || isCurrent ? e.icon : "❓"}
                        </span>
                        <span className={`text-[8px] text-center mt-0.5 leading-tight ${
                          isCurrent ? "text-violet-300" : isUnlocked ? "text-white/60" : "text-white/20"
                        }`}>
                          {isUnlocked || isCurrent ? e.name : "???"}
                        </span>
                        
                        {/* Текущая концовка маркер */}
                        {isCurrent && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px]">✓</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                
                <p className="text-[10px] text-white/30 text-center mt-3">
                  Пройдите снова, чтобы открыть другие концовки
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <AnimatePresence>
            {showButtons && (
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Primary button */}
                {hasNextEpisode && onNextEpisode ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onNextEpisode}
                    className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 text-white"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span>Следующий эпизод</span>
                    <span className="text-lg">→</span>
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onBack}
                    className="w-full py-3.5 rounded-xl font-bold text-base text-white"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    К эпизодам
                  </motion.button>
                )}
                
                {/* Secondary button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onRestart}
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-white/70 text-sm"
                >
                  <span>🔄</span>
                  <span>Пройти заново</span>
                </motion.button>
                
                {/* Back to episodes if there's next episode */}
                {hasNextEpisode && (
                  <button
                    onClick={onBack}
                    className="w-full py-2 rounded-xl text-white/40 text-xs hover:text-white/60 transition-colors"
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
