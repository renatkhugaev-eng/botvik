"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { investigationHaptic } from "@/lib/haptic";
import { InkStoryPlayer } from "@/components/InkStoryPlayer";
import { EvidenceBoard } from "@/components/EvidenceBoard";
import { DocumentViewer, LESOPOLOSA_DOCUMENTS, type InvestigationDocument, type DocumentHighlight } from "@/components/DocumentViewer";
import type { InkState } from "@/lib/ink-runtime";
import type { BoardState } from "@/lib/evidence-system";
import {
  createInitialBoardState,
  addEvidence,
  LESOPOLOSA_EVIDENCE,
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

// Импортируем TimelineBuilder
import { TimelineBuilder, LESOPOLOSA_TIMELINE_EVENTS, type TimelineEvent } from "@/components/TimelineBuilder";

// Импортируем скомпилированные истории
const STORY_FILES: Record<string, object | null> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  STORY_FILES["lesopolosa"] = require("@/content/investigations/lesopolosa.ink.json");
} catch {
  STORY_FILES["lesopolosa"] = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  STORY_FILES["episode2"] = require("@/content/investigations/episode2-false-trail.ink.json");
} catch {
  STORY_FILES["episode2"] = null;
}

// Конфигурация эпизодов
const EPISODES = [
  {
    id: "lesopolosa",
    episodeNum: 1,
    title: "Лесополоса",
    subtitle: "Первое убийство. Декабрь 1978.",
    description: "Тело 9-летней девочки найдено в лесополосе. Начало расследования.",
    icon: "🌲",
    difficulty: "Средняя",
    duration: "25-40 мин",
    isAvailable: true,
  },
  {
    id: "episode2",
    episodeNum: 2,
    title: "Ложный след",
    subtitle: "Судебная ошибка. Январь 1979.",
    description: "Арест Александра Кравченко. Правда или давление системы?",
    icon: "⚖️",
    difficulty: "Сложная",
    duration: "30-50 мин",
    isAvailable: true,
  },
  {
    id: "episode3",
    episodeNum: 3,
    title: "Тень",
    subtitle: "Скоро...",
    description: "Настоящий убийца продолжает действовать.",
    icon: "👤",
    difficulty: "—",
    duration: "—",
    isAvailable: false,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

type ViewMode = "story" | "board" | "timeline" | "split";
type GameScreen = "episode_select" | "playing";

// ══════════════════════════════════════════════════════════════════════════════
// МАППИНГ ТЕГ -> ID УЛИКИ
// ══════════════════════════════════════════════════════════════════════════════

const CLUE_TAG_TO_EVIDENCE_ID: Record<string, string> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ЭПИЗОД 1: ЛЕСОПОЛОСА
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Криминалистика
  organized_killer: "organized_killer",
  blood_paradox: "blood_ab",
  forensic_anomaly: "paradox_secretion",
  wounds_analysis: "wounds_pattern",
  signature_found: "signature",
  victim_pattern: "signature",
  
  // Местоположение
  railway_link: "railway_connection",
  newspaper_found: "newspaper_molot",
  coat_fibers: "grey_coat_fibers",
  
  // Свидетели
  witness_desc: "witness_description",
  alibi_kravchenko: "alibi_kravchenko",
  
  // Подозреваемые
  suspect_spotted: "suspect_chikatilo",
  kravchenko_info: "suspect_kravchenko",
  blood_mismatch: "blood_mismatch_k",
  job_info: "job_snabzhenets",
  
  // Профиль
  psycho_profile: "psycho_profile",
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ЭПИЗОД 2: ЛОЖНЫЙ СЛЕД
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Кравченко
  prior_conviction: "prior_conviction",
  neighbor_alibi: "neighbor_alibi",
  timeline_inconsistency: "timeline_gap",
  coin_alibi: "coin_alibi",
  
  // Судебная ошибка
  blood_mismatch_ep2: "blood_mismatch_ep2",
  forced_methods: "forced_confession",
  missing_detail: "missing_detail",
  
  // Альтернативные версии
  grey_coat_man: "grey_coat_man",
  serial_pattern: "serial_pattern",
  suspicious_records: "suspicious_records",
};

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
  const [viewMode, setViewMode] = useState<ViewMode>("story");
  const [boardState, setBoardState] = useState<BoardState>(createInitialBoardState);
  const [isStoryEnded, setIsStoryEnded] = useState(false);
  const [showBoardAfterEnding, setShowBoardAfterEnding] = useState(false);
  const [endingType, setEndingType] = useState<string | undefined>(undefined);
  const [storyScore, setStoryScore] = useState(0);
  const [storyKey, setStoryKey] = useState(0); // Ключ для перезагрузки истории
  const [newEvidenceCount, setNewEvidenceCount] = useState(0);
  const [showNewEvidence, setShowNewEvidence] = useState<string | null>(null);
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
  
  // Check for saved game on mount
  useEffect(() => {
    if (hasAutosave(INVESTIGATION_ID)) {
      setHasSavedGame(true);
      setShowContinuePrompt(true);
    }
  }, []);
  
  // Track playtime
  useEffect(() => {
    playtimeIntervalRef.current = setInterval(() => {
      setPlaytime((prev) => prev + 1);
    }, 1000);
    
    return () => {
      if (playtimeIntervalRef.current) {
        clearInterval(playtimeIntervalRef.current);
      }
    };
  }, []);
  
  // Auto-save every 30 seconds if changes were made
  useEffect(() => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current >= 30000 && inkStateJson) {
      performAutosave();
      lastSaveTimeRef.current = now;
    }
  }, [boardState, storyScore, inkStateJson]);
  
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
    setNewEvidenceCount(0);
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
      // Обрабатываем теги улик
      if (tag === "clue" && typeof value === "string") {
        const evidenceId = CLUE_TAG_TO_EVIDENCE_ID[value];

        if (evidenceId) {
          const evidence = LESOPOLOSA_EVIDENCE.find((e) => e.id === evidenceId);

          if (evidence && !boardState.evidence.some((e) => e.id === evidenceId)) {
            investigationHaptic.clueDiscovered();

            setBoardState((prev) => addEvidence(prev, evidenceId));
            setNewEvidenceCount((prev) => prev + 1);
            setShowNewEvidence(evidence.title);

            // Автоматически скрываем уведомление (с cleanup)
            if (evidenceTimeoutRef.current) {
              clearTimeout(evidenceTimeoutRef.current);
            }
            evidenceTimeoutRef.current = setTimeout(() => {
              setShowNewEvidence(null);
              evidenceTimeoutRef.current = null;
            }, 3000);
          }
        }
      }
      
      // Обрабатываем теги документов
      if (tag === "document" && typeof value === "string") {
        const doc = LESOPOLOSA_DOCUMENTS[value];
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
    [boardState.evidence]
  );
  
  // Обработчик обнаружения улики через документ
  const handleDocumentClueDiscovered = useCallback(
    (clueId: string) => {
      const evidence = LESOPOLOSA_EVIDENCE.find((e) => e.id === clueId);
      
      if (evidence && !boardState.evidence.some((e) => e.id === clueId)) {
        investigationHaptic.clueDiscovered();
        
        setBoardState((prev) => addEvidence(prev, clueId));
        setNewEvidenceCount((prev) => prev + 1);
        setShowNewEvidence(evidence.title);
        
        if (evidenceTimeoutRef.current) {
          clearTimeout(evidenceTimeoutRef.current);
        }
        evidenceTimeoutRef.current = setTimeout(() => {
          setShowNewEvidence(null);
          evidenceTimeoutRef.current = null;
        }, 3000);
      }
    },
    [boardState.evidence]
  );
  
  // Обработчик клика на highlight документа
  const handleDocumentHighlightClick = useCallback((highlight: DocumentHighlight) => {
    // Можно добавить дополнительную логику, например показать подсказку
    console.log("Highlight clicked:", highlight.label);
  }, []);

  const handleInsightDiscovered = useCallback((insight: string) => {
    // TODO: Можно показать уведомление об инсайте
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        storyScore={storyScore}
        boardScore={boardState.totalScore}
        evidenceCount={boardState.evidence.length}
        newEvidenceCount={newEvidenceCount}
        playtime={playtime}
        episodeTitle={selectedEpisode?.title || "Расследование"}
        onBack={handleBackToEpisodes}
        onSaveClick={() => setShowSaveMenu(true)}
      />

      {/* Уведомление о новой улике */}
      <AnimatePresence>
        {showNewEvidence && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-4 py-3 bg-emerald-500/20 border-b border-emerald-500/30"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-emerald-400">📝</span>
              <span className="text-sm text-emerald-300">
                Новая улика: {showNewEvidence}
              </span>
              <button
                onClick={() => {
                  setViewMode("board");
                  setShowNewEvidence(null);
                  setNewEvidenceCount(0);
                }}
                className="ml-2 px-2 py-1 rounded bg-emerald-500/30 text-xs"
              >
                Открыть доску →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Контент */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* История — всегда монтирована, скрывается через CSS */}
        <div
          className={`h-full overflow-hidden transition-all duration-300 ${
            viewMode === "board" || viewMode === "timeline"
              ? "w-0 opacity-0 pointer-events-none absolute"
              : viewMode === "split"
              ? "w-1/2 border-r border-white/10"
              : "w-full"
          }`}
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
        </div>

        {/* Доска улик — всегда монтирована, скрывается через CSS */}
        <div
          className={`h-full overflow-hidden transition-all duration-300 ${
            viewMode === "story" || viewMode === "timeline"
              ? "w-0 opacity-0 pointer-events-none absolute right-0"
              : viewMode === "split"
              ? "w-1/2"
              : "w-full"
          }`}
        >
          <EvidenceBoard
            state={boardState}
            onStateChange={setBoardState}
            onInsightDiscovered={handleInsightDiscovered}
          />
        </div>
        
        {/* Timeline — показывается только в режиме timeline */}
        <div
          className={`h-full overflow-hidden transition-all duration-300 ${
            viewMode === "timeline"
              ? "w-full"
              : "w-0 opacity-0 pointer-events-none absolute"
          }`}
        >
          <TimelineBuilder
            events={LESOPOLOSA_TIMELINE_EVENTS}
            onCorrectPlacement={(event, insight) => {
              handleInsightDiscovered(insight);
            }}
            onTimelineComplete={(state) => {
              investigationHaptic.caseSolved();
            }}
          />
        </div>
      </div>

      {/* Финальный экран */}
      <AnimatePresence>
        {isStoryEnded && (
          <FinalScreen
            storyScore={storyScore}
            boardScore={boardState.totalScore}
            evidenceCount={boardState.evidence.length}
            connectionsCount={boardState.correctConnections}
            insights={boardState.insights}
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
              setShowBoardAfterEnding(false);
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
            onViewBoard={() => {
              setShowBoardAfterEnding(true);
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Просмотр доски улик после концовки */}
      <AnimatePresence>
        {showBoardAfterEnding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 overflow-auto"
          >
            <div className="min-h-screen p-4">
              {/* Кнопка назад */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowBoardAfterEnding(false)}
                  className="px-4 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 transition-colors flex items-center gap-2 font-medium"
                >
                  <span>←</span>
                  <span>К результатам</span>
                </button>
              </div>
              
              {/* Доска */}
              <EvidenceBoard
                state={boardState}
                onStateChange={() => {
                  // Только просмотр, изменения не сохраняются
                }}
                readOnly={true}
              />
            </div>
          </motion.div>
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
// ХЕДЕР
// ══════════════════════════════════════════════════════════════════════════════

function Header({
  viewMode,
  onViewModeChange,
  storyScore,
  boardScore,
  evidenceCount,
  newEvidenceCount,
  playtime,
  episodeTitle,
  onBack,
  onSaveClick,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  storyScore: number;
  boardScore: number;
  evidenceCount: number;
  newEvidenceCount: number;
  playtime: number;
  episodeTitle: string;
  onBack: () => void;
  onSaveClick: () => void;
}) {
  return (
    <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-10">
      {/* Верхняя строка */}
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => {
            investigationHaptic.sceneTransition();
            onBack();
          }}
          className="flex items-center gap-1 text-white/60 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <div className="text-xs text-white/40">Расследование • {formatPlaytime(playtime)}</div>
          <div className="text-sm font-bold">{episodeTitle}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Кнопка сохранения */}
          <button
            onClick={() => {
              investigationHaptic.evidenceSelect();
              onSaveClick();
            }}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20"
            title="Сохранения"
          >
            💾
          </button>
          
          {/* Общий счёт */}
          <div className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold">
            {storyScore + boardScore}
          </div>
        </div>
      </div>

      {/* Переключатель режимов */}
      <div className="flex border-t border-white/10">
        <button
          onClick={() => {
            investigationHaptic.boardTabSwitch();
            onViewModeChange("story");
          }}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 ${
            viewMode === "story"
              ? "text-violet-400 bg-violet-500/10"
              : "text-white/50"
          }`}
        >
          📖 История
        </button>
        <button
          onClick={() => {
            investigationHaptic.boardTabSwitch();
            onViewModeChange("board");
          }}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 relative ${
            viewMode === "board"
              ? "text-violet-400 bg-violet-500/10"
              : "text-white/50"
          }`}
        >
          📋 Доска
          {newEvidenceCount > 0 && (
            <span className="absolute top-1 right-[calc(50%-20px)] w-4 h-4 bg-emerald-500 rounded-full text-[10px] flex items-center justify-center">
              {newEvidenceCount}
            </span>
          )}
          <span className="text-white/30 ml-1">({evidenceCount})</span>
        </button>
        <button
          onClick={() => {
            investigationHaptic.boardTabSwitch();
            onViewModeChange("timeline");
          }}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 ${
            viewMode === "timeline"
              ? "text-violet-400 bg-violet-500/10"
              : "text-white/50"
          }`}
        >
          📅 Хронология
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ФИНАЛЬНЫЙ ЭКРАН
// ══════════════════════════════════════════════════════════════════════════════

function FinalScreen({
  storyScore,
  boardScore,
  evidenceCount,
  connectionsCount,
  insights,
  endingType,
  onRestart,
  onBack,
  onNextEpisode,
  onViewBoard,
  hasNextEpisode,
  episodeTitle,
}: {
  storyScore: number;
  boardScore: number;
  evidenceCount: number;
  connectionsCount: number;
  insights: string[];
  endingType?: string;
  onRestart: () => void;
  onBack: () => void;
  onNextEpisode?: () => void;
  onViewBoard?: () => void;
  hasNextEpisode?: boolean;
  episodeTitle?: string;
}) {
  const [showStats, setShowStats] = useState(false);
  const [showTotal, setShowTotal] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  
  const totalScore = storyScore + boardScore;
  
  // Определяем текст концовки
  const getEndingInfo = () => {
    if (endingType === "good" || totalScore >= 200) {
      return {
        icon: "🏆",
        title: "Блестящее расследование!",
        subtitle: "Вы сохранили объективность и нашли ключевые улики.",
        color: "text-emerald-400",
      };
    } else if (endingType === "bad" || endingType === "tragedy" || totalScore < 0) {
      return {
        icon: "💀",
        title: "Трагический исход",
        subtitle: "Ваш выбор привёл к непоправимым последствиям.",
        color: "text-red-400",
      };
    } else if (endingType === "conscience") {
      return {
        icon: "⚖️",
        title: "Чистая совесть",
        subtitle: "Вы потеряли карьеру, но сохранили честь.",
        color: "text-amber-400",
      };
    } else if (endingType === "neutral") {
      return {
        icon: "❓",
        title: "Неопределённость",
        subtitle: "Дело осталось незавершённым. История продолжится...",
        color: "text-blue-400",
      };
    } else if (totalScore >= 100) {
      return {
        icon: "✅",
        title: "Хорошая работа!",
        subtitle: "Вы провели добросовестное расследование.",
        color: "text-violet-400",
      };
    }
    return {
      icon: "📋",
      title: "Расследование завершено",
      subtitle: "Эпизод пройден.",
      color: "text-white/70",
    };
  };
  
  const ending = getEndingInfo();
  
  // Последовательное появление элементов
  useEffect(() => {
    const timers = [
      setTimeout(() => setShowStats(true), 800),
      setTimeout(() => setShowTotal(true), 1500),
      setTimeout(() => setShowInsights(true), 2200),
      setTimeout(() => setShowButtons(true), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", damping: 20 }}
        className="bg-gradient-to-b from-[#1a1a2e] to-[#12121f] rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto border border-white/10"
      >
        {/* Заголовок с анимацией */}
        <motion.div 
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div 
            className="text-6xl mb-3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", damping: 10 }}
          >
            {ending.icon}
          </motion.div>
          <h2 className={`text-2xl font-bold mb-2 ${ending.color}`}>
            {ending.title}
          </h2>
          <p className="text-sm text-white/50">
            {ending.subtitle}
          </p>
        </motion.div>

        {/* Статистика с последовательной анимацией */}
        <AnimatePresence>
          {showStats && (
            <motion.div 
              className="grid grid-cols-2 gap-3 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {[
                { value: storyScore, label: "За историю", color: "text-violet-400", delay: 0 },
                { value: boardScore, label: "За связи", color: "text-emerald-400", delay: 0.1 },
                { value: evidenceCount, label: "Улик найдено", color: "text-blue-400", delay: 0.2 },
                { value: connectionsCount, label: "Связей", color: "text-amber-400", delay: 0.3 },
              ].map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  className="text-center p-3 rounded-xl bg-white/5"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: stat.delay }}
                >
                  <motion.div 
                    className={`text-2xl font-bold ${stat.color}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: stat.delay + 0.2 }}
                  >
                    {stat.value}
                  </motion.div>
                  <div className="text-xs text-white/40">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Общий счёт с эффектом */}
        <AnimatePresence>
          {showTotal && (
            <motion.div 
              className="text-center p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-sm text-white/50 mb-1">Общий счёт</div>
              <motion.div 
                className="text-4xl font-bold text-violet-400"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {totalScore}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Инсайты */}
        <AnimatePresence>
          {showInsights && insights.length > 0 && (
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h4 className="text-sm font-medium text-white/50 mb-2">
                💡 Открытые инсайты ({insights.length})
              </h4>
              <div className="space-y-2 max-h-32 overflow-auto">
                {insights.map((insight, i) => (
                  <motion.div
                    key={i}
                    className="text-xs text-white/70 p-2 rounded bg-emerald-500/10 border border-emerald-500/20"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {insight}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Кнопки */}
        <AnimatePresence>
          {showButtons && (
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Главная кнопка — следующий эпизод или в меню */}
              {hasNextEpisode && onNextEpisode ? (
                <button
                  onClick={onNextEpisode}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 font-bold text-lg hover:from-emerald-500 hover:to-green-500 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Следующий эпизод</span>
                  <span className="text-xl">→</span>
                </button>
              ) : (
                <button
                  onClick={onBack}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-bold text-lg hover:from-violet-500 hover:to-purple-500 transition-colors"
                >
                  Выбрать эпизод
                </button>
              )}
              
              {/* Дополнительные кнопки */}
              <div className="flex gap-3">
                {onViewBoard && (
                  <button
                    onClick={onViewBoard}
                    className="flex-1 py-3 rounded-xl bg-white/10 font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📋</span>
                    <span>Доска улик</span>
                  </button>
                )}
                <button
                  onClick={onRestart}
                  className="flex-1 py-3 rounded-xl bg-white/10 font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  <span>Заново</span>
                </button>
              </div>
              
              {/* Кнопка "В меню" если есть следующий эпизод */}
              {hasNextEpisode && (
                <button
                  onClick={onBack}
                  className="w-full py-2 rounded-xl text-white/50 text-sm hover:text-white/70 transition-colors"
                >
                  ← К списку эпизодов
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ПРОДОЛЖИТЬ ИГРУ
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
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#1a1a2e] rounded-2xl p-6 max-w-sm w-full"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">📂</div>
          <h2 className="text-xl font-bold mb-2">Найдено сохранение</h2>
          <p className="text-white/60 text-sm">
            У вас есть незавершённое расследование. Продолжить?
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onContinue}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-medium"
          >
            Продолжить
          </button>
          <button
            onClick={onNewGame}
            className="w-full py-3 rounded-xl bg-white/10 font-medium text-white/70"
          >
            Начать заново
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// МЕНЮ СОХРАНЕНИЙ
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
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#1a1a2e] rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">💾 Сохранения</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60"
          >
            ✕
          </button>
        </div>

        {/* Новое сохранение */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-medium mb-4 flex items-center justify-center gap-2 disabled:opacity-50"
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
              ➕ Новое сохранение
            </>
          )}
        </button>

        {/* Список сохранений */}
        {saves.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm text-white/50 mb-2">Ваши сохранения:</h3>
            {saves.map((save) => (
              <button
                key={save.id}
                onClick={() => onLoad(save.id)}
                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Глава {save.currentChapter}</span>
                  <span className="text-xs text-white/40">
                    {formatPlaytime(save.playtime)}
                  </span>
                </div>
                <div className="text-xs text-white/50">
                  {save.evidenceCount} улик • {save.connectionsCount} связей • {save.storyScore} очков
                </div>
                <div className="text-xs text-white/30 mt-1">
                  {new Date(save.savedAt).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm">Нет сохранений</p>
            <p className="text-xs mt-1">Нажмите кнопку выше, чтобы сохранить прогресс</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЭКРАН ВЫБОРА ЭПИЗОДА
// ══════════════════════════════════════════════════════════════════════════════

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
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Хедер */}
      <div className="sticky top-0 z-10 bg-black/50 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/60 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Назад</span>
          </button>
          
          <h1 className="text-lg font-bold">Расследования</h1>
          
          <div className="w-16" /> {/* Spacer */}
        </div>
      </div>
      
      {/* Intro */}
      <div className="p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold mb-2">Дело Лесополоса</h2>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            Интерактивное расследование серии убийств 1978-1990 годов. 
            Вы — следователь, расследующий самое сложное дело в истории СССР.
          </p>
        </motion.div>
      </div>
      
      {/* Эпизоды */}
      <div className="p-4 space-y-4">
        {episodes.map((episode, index) => (
          <motion.button
            key={episode.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(episode)}
            disabled={!episode.isAvailable}
            className={`w-full text-left p-5 rounded-2xl border transition-all ${
              episode.isAvailable
                ? "bg-gradient-to-r from-white/5 to-white/10 border-white/10 hover:border-violet-500/50 hover:bg-white/10"
                : "bg-white/5 border-white/5 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Иконка */}
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${
                episode.isAvailable ? "bg-violet-500/20" : "bg-white/10"
              }`}>
                {episode.icon}
              </div>
              
              {/* Контент */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                    Эпизод {episode.episodeNum}
                  </span>
                  {!episode.isAvailable && (
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/40">
                      🔒 Скоро
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-bold mb-1">{episode.title}</h3>
                <p className="text-sm text-white/60 mb-2">{episode.subtitle}</p>
                <p className="text-xs text-white/40 line-clamp-2">{episode.description}</p>
                
                {/* Мета */}
                {episode.isAvailable && (
                  <div className="flex items-center gap-3 mt-3 text-xs text-white/40">
                    <span>⏱️ {episode.duration}</span>
                    <span>•</span>
                    <span>📊 {episode.difficulty}</span>
                  </div>
                )}
              </div>
              
              {/* Стрелка */}
              {episode.isAvailable && (
                <svg className="w-5 h-5 text-white/30 mt-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </motion.button>
        ))}
      </div>
      
      {/* Нижняя инфо */}
      <div className="p-6 text-center">
        <p className="text-xs text-white/30">
          Основано на реальных событиях. <br />
          Некоторые детали изменены в интересах повествования.
        </p>
      </div>
    </div>
  );
}
