"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { investigationHaptic } from "@/lib/haptic";
import { InkStoryPlayer, type InkStoryPlayerHandle } from "@/components/InkStoryPlayer";
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
  type SavedParagraph,
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
    title: "Красный лес",
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
// СИСТЕМА УЛИК — Описания и категории
// ══════════════════════════════════════════════════════════════════════════════

interface ClueInfo {
  name: string;
  description: string;
  category: "lore" | "event" | "artifact" | "evidence";
  icon: string;
  importance: "minor" | "major" | "critical";
}

// CultLore — знания о культе
const CULT_LORE_INFO: Record<string, ClueInfo> = {
  lore_ancient_tribe: {
    name: "Древнее племя",
    description: "Легенды о племени, населявшем эти леса тысячи лет назад. Они поклонялись чему-то в глубине земли — существу, говорящему через корни деревьев.",
    category: "lore",
    icon: "📜",
    importance: "major",
  },
  lore_first_contact: {
    name: "Первый контакт",
    description: "Записи о первых встречах переселенцев с культом в 1780-х годах. Странные огни в лесу, пропадающий скот, шёпот из-под земли.",
    category: "lore",
    icon: "👁️",
    importance: "major",
  },
  lore_expedition_1890: {
    name: "Экспедиция 1890 года",
    description: "Научная экспедиция Императорского географического общества. Из 12 человек вернулись трое. Их записи засекречены до сих пор.",
    category: "lore",
    icon: "🗺️",
    importance: "critical",
  },
  lore_soviet_discovery: {
    name: "Советское открытие",
    description: "В 1953 году геологи обнаружили систему пещер. То, что они нашли внутри, заставило Москву закрыть город и создать 'Проект Эхо'.",
    category: "lore",
    icon: "☭",
    importance: "critical",
  },
  lore_project_echo_start: {
    name: "Проект 'Эхо'",
    description: "Секретная программа по изучению аномалии. Официально — исследование редких минералов. На самом деле — попытка установить контакт с Тем, Кто Ждёт.",
    category: "lore",
    icon: "🔬",
    importance: "critical",
  },
  lore_first_sacrifice: {
    name: "Первая жертва",
    description: "1967 год. Первое задокументированное жертвоприношение после советского периода. Дверь открылась на 3 секунды. Этого хватило.",
    category: "lore",
    icon: "🩸",
    importance: "critical",
  },
  // lore_chernov_rise — не используется в истории, зарезервирован для будущего контента
  lore_door_nature: {
    name: "Природа Двери",
    description: "Дверь — не просто проход. Это мембрана между мирами, истончённая тысячелетиями ритуалов. Каждая жертва делает её тоньше.",
    category: "lore",
    icon: "🚪",
    importance: "critical",
  },
  lore_entity_truth: {
    name: "Истина о Сущности",
    description: "То, Что Ждёт за Дверью — не бог и не демон. Это нечто настолько чуждое, что человеческий разум ломается от одного взгляда. Оно голодно. Оно терпеливо. Оно почти свободно.",
    category: "lore",
    icon: "🌀",
    importance: "critical",
  },
};

// KeyEvents — ключевые события расследования
const KEY_EVENTS_INFO: Record<string, ClueInfo> = {
  saw_symbol: {
    name: "Символ культа",
    description: "Вы впервые увидели символ — спираль с тремя лучами, уходящими в центр. Он выжжен на деревьях, нацарапан на стенах, вырезан на телах.",
    category: "event",
    icon: "⚡",
    importance: "minor",
  },
  heard_voices: {
    name: "Голоса из леса",
    description: "Шёпот между деревьями. Не ветер — слова. На языке, который вы не знаете, но почему-то понимаете. Они зовут вас по имени.",
    category: "event",
    icon: "👂",
    importance: "major",
  },
  found_notebook: {
    name: "Блокнот Сорокина",
    description: "Записи предыдущего следователя. Он был близок к разгадке. Последняя запись: 'Они знают, что я знаю. Дверь зовёт. Не открывать.'",
    category: "event",
    icon: "📓",
    importance: "critical",
  },
  found_photos: {
    name: "Фотографии ритуалов",
    description: "Снимки, сделанные скрытой камерой. Люди в масках вокруг каменного алтаря. На алтаре — человек. Живой. Пока ещё живой.",
    category: "event",
    icon: "📷",
    importance: "critical",
  },
  entered_caves: {
    name: "Вход в пещеры",
    description: "Вы спустились в систему пещер под городом. Воздух здесь густой и сладкий, как гниющие фрукты. Стены покрыты символами.",
    category: "event",
    icon: "🕳️",
    importance: "major",
  },
  witnessed_ritual: {
    name: "Свидетель ритуала",
    description: "Вы видели это своими глазами. Пение, кровь, свет из ниоткуда. И на мгновение — щель в реальности, за которой что-то шевелилось.",
    category: "event",
    icon: "🕯️",
    importance: "critical",
  },
  confronted_cult: {
    name: "Противостояние культу",
    description: "Вы встретились лицом к лицу с лидерами культа. Они не злодеи в классическом смысле. Они верят, что спасают мир. По-своему.",
    category: "event",
    icon: "⚔️",
    importance: "critical",
  },
  serafim_kidnapped: {
    name: "Похищение Серафима",
    description: "Старый священник исчез. Его церковь осквернена. На полу — символ культа, нарисованный его кровью.",
    category: "event",
    icon: "⛪",
    importance: "major",
  },
  vera_captured: {
    name: "Вера в плену",
    description: "Они схватили её. Вера — следующая жертва. Осталось меньше суток до полнолуния.",
    category: "event",
    icon: "👩",
    importance: "critical",
  },
  zorin_found: {
    name: "Находка Зорина",
    description: "Тело бывшего следователя найдено в лесу. Официально — сердечный приступ. Но вы видели его лицо. Такой ужас нельзя подделать.",
    category: "event",
    icon: "💀",
    importance: "major",
  },
  tanya_invited: {
    name: "Приглашение Тани",
    description: "Инженер Таня Зорина приглашает вас на встречу. У неё есть информация об отце. Возможно, ключ к разгадке.",
    category: "event",
    icon: "💌",
    importance: "minor",
  },
  met_klava_restaurant: {
    name: "Встреча с Клавой",
    description: "Администратор гостиницы знает больше, чем говорит. Её семья жила здесь поколениями. Её муж и сын погибли от рук культа.",
    category: "event",
    icon: "🍽️",
    importance: "minor",
  },
  fyodor_warned: {
    name: "Предупреждение Фёдора",
    description: "Местный краевед Фёдор предупредил вас: 'Уезжайте. Пока можете. Пока вы ещё свой.'",
    category: "event",
    icon: "⚠️",
    importance: "minor",
  },
  fyodor_ally: {
    name: "Союзник Фёдор",
    description: "Фёдор согласился помочь. Он знает входы в пещеры, расположение алтарей, имена жрецов. Но можно ли ему верить?",
    category: "event",
    icon: "🤝",
    importance: "major",
  },
  found_fyodor_body: {
    name: "Тело Фёдора",
    description: "Они убили его. Фёдор лежит у входа в пещеру, глаза вырезаны, на груди — спираль. Записка в кармане: 'Предатели умирают первыми.'",
    category: "event",
    icon: "⚰️",
    importance: "critical",
  },
  tanya_injured: {
    name: "Ранение Тани",
    description: "Таня ранена. Нападение произошло у её дома. Она успела увидеть лицо под маской — это был кто-то из городской администрации.",
    category: "event",
    icon: "🩹",
    importance: "major",
  },
  gromov_killed: {
    name: "Смерть Громова",
    description: "Глава местной полиции мёртв. Самоубийство, говорят. Но пистолет был в левой руке, а Громов был правшой.",
    category: "event",
    icon: "🔫",
    importance: "critical",
  },
  vera_sacrifice: {
    name: "Жертва Веры",
    description: "Вы не успели. Или успели, но сделали другой выбор. Вера стала последней жертвой. Дверь открылась.",
    category: "event",
    icon: "💔",
    importance: "critical",
  },
};

// AncientArtifacts — древние артефакты
const ARTIFACTS_INFO: Record<string, ClueInfo> = {
  artifact_stone_tablet: {
    name: "Каменная скрижаль",
    description: "Плита из чёрного камня, испещрённая символами. При прикосновении руки начинают дрожать. Текст описывает ритуал открытия Двери.",
    category: "artifact",
    icon: "🪨",
    importance: "critical",
  },
  // artifact_shaman_mask, artifact_bone_knife, artifact_ritual_robe — не используются в истории
  artifact_expedition_journal: {
    name: "Журнал экспедиции",
    description: "Дневник руководителя экспедиции 1890 года. Последние страницы написаны кровью. Почерк становится всё более нечитаемым к концу.",
    category: "artifact",
    icon: "📖",
    importance: "critical",
  },
  // artifact_original_map — не используется в истории
};

// PhysicalClues — вещественные улики из CluesA-E (Ink LIST)
const PHYSICAL_CLUES_INFO: Record<string, ClueInfo> = {
  // CluesA
  missing_list: {
    name: "Список пропавших",
    description: "Официальный список пропавших жителей. Имена вычеркнуты, но можно разобрать даты исчезновений.",
    category: "evidence",
    icon: "📋",
    importance: "major",
  },
  false_reports: {
    name: "Ложные рапорты",
    description: "Документы с фальсифицированными данными о расследованиях. Кто-то системно скрывает правду.",
    category: "evidence",
    icon: "📝",
    importance: "major",
  },
  witness_conflict: {
    name: "Противоречия свидетелей",
    description: "Показания свидетелей не сходятся. Либо они лгут, либо что-то влияет на их память.",
    category: "evidence",
    icon: "❓",
    importance: "minor",
  },
  // CluesB
  echo_docs: {
    name: "Документы Проекта Эхо",
    description: "Секретные документы о советских экспериментах. Упоминания 'контакта' и 'открытия двери'.",
    category: "evidence",
    icon: "📂",
    importance: "critical",
  },
  experiment_records: {
    name: "Записи экспериментов",
    description: "Лабораторные журналы с результатами опытов. Многие страницы вырваны или зачёркнуты.",
    category: "evidence",
    icon: "🧪",
    importance: "major",
  },
  underground_map: {
    name: "Карта подземелий",
    description: "Схема туннелей под городом. Некоторые проходы отмечены красным — 'не входить'.",
    category: "evidence",
    icon: "🗺️",
    importance: "critical",
  },
  access_pass: {
    name: "Пропуск доступа",
    description: "Старый служебный пропуск. Открывает двери, которые официально не существуют.",
    category: "evidence",
    icon: "🔑",
    importance: "major",
  },
  // CluesC
  cult_symbol: {
    name: "Символ культа",
    description: "Спираль с тремя лучами. Древний знак, который встречается повсюду.",
    category: "evidence",
    icon: "⭕",
    importance: "major",
  },
  chernov_diary: {
    name: "Дневник Чернова",
    description: "Личные записи главы культа. Безумие или откровение? Грань размыта.",
    category: "evidence",
    icon: "📖",
    importance: "critical",
  },
  ritual_photos: {
    name: "Фото ритуалов",
    description: "Снимки тайных церемоний. Лица участников скрыты масками.",
    category: "evidence",
    icon: "📷",
    importance: "critical",
  },
  insider_testimony: {
    name: "Показания инсайдера",
    description: "Записанные показания бывшего члена культа. Он знает слишком много.",
    category: "evidence",
    icon: "🗣️",
    importance: "critical",
  },
  // CluesD
  expedition_1890: {
    name: "Экспедиция 1890",
    description: "Материалы о первой научной экспедиции. Они что-то нашли в лесу.",
    category: "evidence",
    icon: "📜",
    importance: "major",
  },
  serafim_legends: {
    name: "Легенды Серафима",
    description: "Записи старого священника о местных преданиях. Правда скрыта в мифах.",
    category: "evidence",
    icon: "⛪",
    importance: "major",
  },
  church_symbols: {
    name: "Символы в церкви",
    description: "Древние знаки, скрытые под слоем краски в старой церкви.",
    category: "evidence",
    icon: "✝️",
    importance: "minor",
  },
  // CluesE
  klava_testimony: {
    name: "Показания Клавы",
    description: "Буфетчица видела и слышала многое. Её память — кладезь информации.",
    category: "evidence",
    icon: "👩‍🍳",
    importance: "major",
  },
  fyodor_map: {
    name: "Карта Фёдора",
    description: "Охотник знает лес лучше всех. Его карта показывает тайные тропы.",
    category: "evidence",
    icon: "🗺️",
    importance: "major",
  },
  gromov_confession: {
    name: "Признание Громова",
    description: "Майор наконец заговорил. Его показания меняют всё.",
    category: "evidence",
    icon: "👮",
    importance: "critical",
  },
  vera_research: {
    name: "Исследования Веры",
    description: "Научные записи молодого врача. Она близка к разгадке болезни.",
    category: "evidence",
    icon: "🔬",
    importance: "major",
  },
  old_photos: {
    name: "Старые фотографии",
    description: "Снимки 50-летней давности. На них — знакомые лица в непривычных обстоятельствах.",
    category: "evidence",
    icon: "📷",
    importance: "minor",
  },
};

// Объединённый справочник всех улик
const ALL_CLUES_INFO: Record<string, ClueInfo> = {
  ...CULT_LORE_INFO,
  ...KEY_EVENTS_INFO,
  ...ARTIFACTS_INFO,
  ...PHYSICAL_CLUES_INFO,
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
  const [boardState, setBoardState] = useState<BoardState>(createInitialBoardState);
  const [isStoryEnded, setIsStoryEnded] = useState(false);
  const [endingType, setEndingType] = useState<string | undefined>(undefined);
  const [storyScore, setStoryScore] = useState(0);
  const [storyKey, setStoryKey] = useState(0); // Ключ для перезагрузки истории
  const [foundClues, setFoundClues] = useState<Set<string>>(new Set()); // Найденные улики
  const [currentSanity, setCurrentSanity] = useState(100); // Текущий рассудок
  const [currentInfection, setCurrentInfection] = useState(0); // Текущее заражение
  const [currentReputation, setCurrentReputation] = useState(0); // Репутация города
  const [showJournalModal, setShowJournalModal] = useState(false); // Модальное окно журнала
  // Дополнительные переменные для журнала
  const [currentDay, setCurrentDay] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState(0); // 0=Утро, 1=День, 2=Вечер, 3=Ночь
  const [cultAwareness, setCultAwareness] = useState(0);
  const [investigationStyle, setInvestigationStyle] = useState("balanced"); // aggressive, diplomatic, balanced
  // Побочные квесты
  const [activeSidequests, setActiveSidequests] = useState<Set<string>>(new Set());
  const [lettersReceived, setLettersReceived] = useState(0);
  const [letterAuthorKnown, setLetterAuthorKnown] = useState(false);
  const [nightmaresWon, setNightmaresWon] = useState(0);
  const [nightmaresLost, setNightmaresLost] = useState(0);
  const [interludeNightmare1Played, setInterludeNightmare1Played] = useState(false);
  // Квесты рынка
  const [questMashaDocuments, setQuestMashaDocuments] = useState(false);
  const [questMashaDocumentsDone, setQuestMashaDocumentsDone] = useState(false);
  const [questLyudaMedicine, setQuestLyudaMedicine] = useState(false);
  const [questLyudaMedicineDone, setQuestLyudaMedicineDone] = useState(false);
  const [questGrishaViolin, setQuestGrishaViolin] = useState(false);
  const [questGrishaViolinDone, setQuestGrishaViolinDone] = useState(false);
  const [questKolkaWarning, setQuestKolkaWarning] = useState(false);
  const [metCharacters, setMetCharacters] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<Set<string>>(new Set(["item_flashlight", "item_gun", "item_notebook"])); // Начальный инвентарь
  const [currentDocument, setCurrentDocument] = useState<InvestigationDocument | null>(null);
  const [itemUseNotification, setItemUseNotification] = useState<{ message: string; icon: string } | null>(null);
  const evidenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Derived values
  const INVESTIGATION_ID = selectedEpisode?.id || "lesopolosa";
  const EPISODE_ID = selectedEpisode?.episodeNum || 1;
  
  // Save system state
  const [inkStateJson, setInkStateJson] = useState<string>("");
  const [lastParagraphs, setLastParagraphs] = useState<SavedParagraph[]>([]);
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
  const inkStoryRef = useRef<InkStoryPlayerHandle>(null);

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
      playtime,
      [], // achievements
      Array.from(foundClues), // foundClues
      lastParagraphs // параграфы для восстановления при загрузке
    );
    
    if (result.success) {
      setHasSavedGame(true);
    }
    
    // Brief saving indicator
    setTimeout(() => setIsSaving(false), 500);
  }, [INVESTIGATION_ID, EPISODE_ID, inkStateJson, boardState, currentChapter, storyScore, playtime, isStoryEnded, foundClues, lastParagraphs]);
  
  // Auto-save every 30 seconds with proper interval (fixes race condition)
  useEffect(() => {
    if (!inkStateJson || isStoryEnded) return;
    
    const intervalId = setInterval(() => {
      performAutosave();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [inkStateJson, isStoryEnded, performAutosave]);
  
  const handleManualSave = useCallback((): boolean => {
    if (!inkStateJson) return false;
    
    setIsSaving(true);
    investigationHaptic.insight();
    
    const result = createManualSave(
      INVESTIGATION_ID,
      EPISODE_ID,
      inkStateJson,
      boardState,
      currentChapter,
      storyScore,
      playtime,
      [], // achievements
      Array.from(foundClues), // foundClues
      lastParagraphs // параграфы для восстановления при загрузке
    );
    
    // Убираем индикатор через 500ms, но меню НЕ закрываем — 
    // пользователь увидит новое сохранение в списке
    setTimeout(() => {
      setIsSaving(false);
    }, 500);
    
    return result.success;
  }, [INVESTIGATION_ID, EPISODE_ID, inkStateJson, boardState, currentChapter, storyScore, playtime, foundClues, lastParagraphs]);
  
  const handleLoadSave = useCallback((saveId: string) => {
    const result = loadFromLocalStorage(INVESTIGATION_ID, saveId);
    
    if (result.success) {
      // Сначала сбрасываем состояние истории
      setIsStoryEnded(false);
      setShowEndingButton(false);
      
      // Восстанавливаем все данные из сохранения (с защитой от undefined)
      setLoadedSave(result.data);
      setBoardState(result.data.boardState || createInitialBoardState());
      setStoryScore(result.data.storyScore || 0);
      setCurrentChapter(result.data.currentChapter || 1);
      setPlaytime(result.data.playtime || 0);
      setFoundClues(new Set(result.data.foundClues || []));
      
      // ВАЖНО: Перезагружаем историю через storyKey для применения inkState
      setStoryKey(prev => prev + 1);
      
      setShowSaveMenu(false);
      setShowContinuePrompt(false);
      investigationHaptic.sceneTransition();
    } else {
      // Ошибка загрузки — уведомляем через haptic и console
      console.error("[Investigation] Failed to load save:", result.error);
      investigationHaptic.timerWarning();
    }
  }, [INVESTIGATION_ID]);
  
  const handleContinueSave = useCallback(() => {
    const result = loadAutosave(INVESTIGATION_ID);
    
    if (result.success) {
      // Сначала сбрасываем состояние истории
      setIsStoryEnded(false);
      setShowEndingButton(false);
      
      // Восстанавливаем все данные из автосохранения (с защитой от undefined)
      setLoadedSave(result.data);
      setBoardState(result.data.boardState || createInitialBoardState());
      setStoryScore(result.data.storyScore || 0);
      setCurrentChapter(result.data.currentChapter || 1);
      setPlaytime(result.data.playtime || 0);
      setFoundClues(new Set(result.data.foundClues || []));
      
      // ВАЖНО: Перезагружаем историю через storyKey для применения inkState
      setStoryKey(prev => prev + 1);
      
      setShowContinuePrompt(false);
      investigationHaptic.sceneTransition();
    } else {
      // Ошибка загрузки автосохранения — начинаем новую игру
      console.error("[Investigation] Failed to load autosave:", result.error);
      setShowContinuePrompt(false);
      setHasSavedGame(false);
    }
  }, [INVESTIGATION_ID]);
  
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
    setFoundClues(new Set());
    setFinalStats(null);
    setPlaytime(0);
    setCurrentChapter(1);
    setLoadedSave(null);
    setInkStateJson("");
    setLastParagraphs([]);

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
    cityReputation: number;
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
      cityReputation: (vars.city_reputation as number) || 0,
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
  const handleInkStateChange = useCallback((stateJson: string, paragraphs: SavedParagraph[]) => {
    setInkStateJson(stateJson);
    setLastParagraphs(paragraphs);
    // Автосохранение после каждого значимого действия
    lastSaveTimeRef.current = Date.now() - 25000; // Trigger save on next tick
  }, []);

  const handleVariableChange = useCallback((name: string, value: unknown) => {
    if (name === "score" && typeof value === "number") {
      setStoryScore(value);
    }
    
    // Отслеживаем sanity, infection и reputation для индикаторов в хедере
    if (name === "sanity" && typeof value === "number") {
      setCurrentSanity(value);
    }
    if (name === "infection_level" && typeof value === "number") {
      setCurrentInfection(value);
    }
    if (name === "city_reputation" && typeof value === "number") {
      setCurrentReputation(value);
    }
    
    // Дополнительные переменные для журнала
    if (name === "current_day" && typeof value === "number") {
      setCurrentDay(value);
    }
    if (name === "time_of_day" && typeof value === "number") {
      setTimeOfDay(value);
    }
    if (name === "cult_awareness" && typeof value === "number") {
      setCultAwareness(value);
    }
    if (name === "investigation_style" && typeof value === "number") {
      // Положительные = aggressive, отрицательные = diplomatic, около 0 = balanced
      if (value >= 10) {
        setInvestigationStyle("aggressive");
      } else if (value <= -10) {
        setInvestigationStyle("diplomatic");
      } else {
        setInvestigationStyle("balanced");
      }
    }
    
    // Отслеживаем встреченных персонажей через LIST MetCharacters
    if (name === "MetCharacters") {
      let items: string[] = [];
      if (typeof value === "string") {
        items = value.split(",").map(s => s.trim()).filter(s => s.length > 0);
      } else if (value && typeof value === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inkList = value as any;
        if (typeof inkList.toString === "function") {
          const str = String(inkList);
          if (str && str !== "[object Object]") {
            items = str.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
        }
        // Способ 2: проверяем _items
        if (items.length === 0 && inkList._items && typeof inkList._items === "object") {
          items = Object.keys(inkList._items).map(key => {
            const parts = key.split(".");
            return parts[parts.length - 1];
          });
        }
      }
      if (items.length > 0) {
        setMetCharacters(new Set(items.map(item => item.includes(".") ? item.split(".").pop()! : item)));
      }
    }
    
    // Fallback: отслеживаем отдельные флаги met_* (на случай если LIST не работает)
    if (name.startsWith("met_") && value === true) {
      const charName = name.replace("met_", "");
      setMetCharacters(prev => {
        const newSet = new Set(prev);
        newSet.add(charName);
        return newSet;
      });
    }

    // Отслеживаем инвентарь
    if (name === "inventory") {
      let items: string[] = [];
      if (typeof value === "string") {
        items = value.split(",").map(s => s.trim()).filter(s => s.length > 0);
      } else if (value && typeof value === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inkList = value as any;
        if (typeof inkList.toString === "function") {
          const str = String(inkList);
          if (str && str !== "[object Object]") {
            items = str.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
        }
        // Также проверяем keys для InkList
        if (items.length === 0 && inkList.entries) {
          try {
            for (const [key] of inkList.entries()) {
              if (typeof key === "string") items.push(key);
            }
          } catch { /* ignore */ }
        }
      }
      if (items.length > 0) {
        setInventory(new Set(items.map(item => item.includes(".") ? item.split(".").pop()! : item)));
      } else {
        // Пустой инвентарь
        setInventory(new Set());
      }
    }

    // Отслеживаем улики из Ink LIST переменных
    if (name === "CultLore" || name === "KeyEvents" || name === "AncientArtifacts" || 
        name === "CluesA" || name === "CluesB" || name === "CluesC" || name === "CluesD" || name === "CluesE") {
      let items: string[] = [];
      
      // InkList может приходить в разных форматах
      if (typeof value === "string") {
        // Как строка: "lore_ancient_tribe, lore_first_contact"
        items = value.split(",").map(s => s.trim()).filter(s => s.length > 0);
      } else if (value && typeof value === "object") {
        // InkList object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inkList = value as any;
        
        // Способ 1: toString() даёт строку с именами
        if (typeof inkList.toString === "function") {
          const str = String(inkList);
          if (str && str !== "[object Object]") {
            items = str.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
        }
        
        // Способ 2: проверяем _items
        if (items.length === 0 && inkList._items && typeof inkList._items === "object") {
          items = Object.keys(inkList._items).map(key => {
            // Ключ может быть в формате "listName.itemName"
            const parts = key.split(".");
            return parts[parts.length - 1];
          });
        }
      }
      
      if (items.length > 0) {
        setFoundClues(prev => {
          const newClues = new Set(prev);
          let hasNew = false;
          
          items.forEach(item => {
            // Убираем префикс списка если есть
            const cleanItem = item.includes(".") ? item.split(".").pop()! : item;
            
            if (!newClues.has(cleanItem) && ALL_CLUES_INFO[cleanItem]) {
              newClues.add(cleanItem);
              hasNew = true;
            }
          });
          
          // Haptic feedback при новой улике
          if (hasNew) {
            investigationHaptic.clueDiscovered();
          }
          
          return newClues;
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Отслеживаем побочные квесты
    // ═══════════════════════════════════════════════════════════════════════════
    if (name === "active_sidequests") {
      let items: string[] = [];
      if (typeof value === "string") {
        items = value.split(",").map(s => s.trim()).filter(s => s.length > 0);
      } else if (value && typeof value === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inkList = value as any;
        if (typeof inkList.toString === "function") {
          const str = String(inkList);
          if (str && str !== "[object Object]") {
            items = str.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
        }
        if (items.length === 0 && inkList._items && typeof inkList._items === "object") {
          items = Object.keys(inkList._items).map(key => {
            const parts = key.split(".");
            return parts[parts.length - 1];
          });
        }
      }
      setActiveSidequests(new Set(items.map(item => item.includes(".") ? item.split(".").pop()! : item)));
    }
    
    if (name === "letters_received" && typeof value === "number") {
      setLettersReceived(value);
    }
    if (name === "letter_author_known" && typeof value === "boolean") {
      setLetterAuthorKnown(value);
    }
    if (name === "nightmares_won" && typeof value === "number") {
      setNightmaresWon(value);
    }
    if (name === "nightmares_lost" && typeof value === "number") {
      setNightmaresLost(value);
    }
    if (name === "interlude_nightmare_1_played" && typeof value === "boolean") {
      setInterludeNightmare1Played(value);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Отслеживаем квесты рынка
    // ═══════════════════════════════════════════════════════════════════════════
    if (name === "quest_masha_documents" && typeof value === "boolean") {
      setQuestMashaDocuments(value);
    }
    if (name === "quest_masha_documents_done" && typeof value === "boolean") {
      setQuestMashaDocumentsDone(value);
    }
    if (name === "quest_lyuda_medicine" && typeof value === "boolean") {
      setQuestLyudaMedicine(value);
    }
    if (name === "quest_lyuda_medicine_done" && typeof value === "boolean") {
      setQuestLyudaMedicineDone(value);
    }
    if (name === "quest_grisha_violin" && typeof value === "boolean") {
      setQuestGrishaViolin(value);
    }
    if (name === "quest_grisha_violin_done" && typeof value === "boolean") {
      setQuestGrishaViolinDone(value);
    }
    if (name === "quest_kolka_warning" && typeof value === "boolean") {
      setQuestKolkaWarning(value);
    }
  }, []);

  // Обработчик использования предметов из инвентаря
  const handleUseItem = useCallback((itemId: string) => {
    if (!inventory.has(itemId)) return;
    
    // Эффекты использования предметов
    if (itemId === "item_vodka") {
      // Водка: +10 к репутации
      const newReputation = Math.min(currentReputation + 10, 100);
      setCurrentReputation(newReputation);
      
      // Полная синхронизация с ink story
      if (inkStoryRef.current) {
        inkStoryRef.current.setVariable("city_reputation", newReputation);
        // Устанавливаем флаг что самогон выпит (для синхронизации с Ink)
        inkStoryRef.current.setVariable("samogon_consumed", true);
      }
      
      setInventory(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setItemUseNotification({
        message: "Выпито за здоровье местных. Репутация +10",
        icon: "🍾"
      });
      setTimeout(() => setItemUseNotification(null), 3000);
    } else if (itemId === "item_medicine") {
      // Лекарство: +15 рассудка
      const newSanity = Math.min(currentSanity + 15, 100);
      setCurrentSanity(newSanity);
      
      // Полная синхронизация с ink story
      if (inkStoryRef.current) {
        inkStoryRef.current.setVariable("sanity", newSanity);
        // Устанавливаем флаг что лекарство использовано
        inkStoryRef.current.setVariable("medicine_used", true);
      }
      
      setInventory(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setItemUseNotification({
        message: "Успокоительное подействовало. Рассудок +15",
        icon: "💊"
      });
      setTimeout(() => setItemUseNotification(null), 3000);
    }
  }, [inventory, currentReputation, currentSanity]);

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
        foundCluesCount={foundClues.size}
        playtime={playtime}
        episodeTitle={selectedEpisode?.title || "Расследование"}
        episodeNum={currentChapter}
        onBack={handleBackToEpisodes}
        onSaveClick={() => setShowSaveMenu(true)}
        onCluesClick={() => setShowJournalModal(true)}
        isMusicPlaying={isMusicPlaying}
        onMusicToggle={toggleMusic}
        sanity={currentSanity}
        infection={currentInfection}
        reputation={currentReputation}
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
            ref={inkStoryRef}
            key={`story-${selectedEpisode?.id}-${storyKey}`}
            storyJson={storyJson}
            onEnd={handleStoryEnd}
            onVariableChange={handleVariableChange}
            onTagFound={handleTagFound}
            onInkStateChange={handleInkStateChange}
            initialState={loadedSave?.inkState}
            initialParagraphs={loadedSave?.lastParagraphs}
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
              setFoundClues(new Set());
              setFinalStats(null);
              setBoardState(createInitialBoardState());
              setInkStateJson("");
              setLastParagraphs([]);
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
                setLastParagraphs([]);
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
      
      {/* Модальное окно журнала */}
      <AnimatePresence>
        {showJournalModal && (
          <JournalModal
            foundClues={foundClues}
            metCharacters={metCharacters}
            inventory={inventory}
            sanity={currentSanity}
            infection={currentInfection}
            reputation={currentReputation}
            currentDay={currentDay}
            timeOfDay={timeOfDay}
            cultAwareness={cultAwareness}
            investigationStyle={investigationStyle}
            activeSidequests={activeSidequests}
            lettersReceived={lettersReceived}
            letterAuthorKnown={letterAuthorKnown}
            nightmaresWon={nightmaresWon}
            nightmaresLost={nightmaresLost}
            interludeNightmare1Played={interludeNightmare1Played}
            questMashaDocuments={questMashaDocuments}
            questMashaDocumentsDone={questMashaDocumentsDone}
            questLyudaMedicine={questLyudaMedicine}
            questLyudaMedicineDone={questLyudaMedicineDone}
            questGrishaViolin={questGrishaViolin}
            questGrishaViolinDone={questGrishaViolinDone}
            questKolkaWarning={questKolkaWarning}
            onClose={() => setShowJournalModal(false)}
            onUseItem={handleUseItem}
          />
        )}
      </AnimatePresence>

      {/* Уведомление об использовании предмета */}
      <AnimatePresence>
        {itemUseNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl bg-gradient-to-r from-amber-900/90 to-stone-900/90 border border-amber-700/50 shadow-xl backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{itemUseNotification.icon}</span>
              <span className="text-sm text-amber-100 font-medium">{itemUseNotification.message}</span>
            </div>
          </motion.div>
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
// ЖУРНАЛ СЛЕДОВАТЕЛЯ — Detective Dossier 2025
// ══════════════════════════════════════════════════════════════════════════════

// Информация о персонажах
const CHARACTERS_INFO: Record<string, { name: string; role: string; emoji: string }> = {
  gromov: { name: "Степан Громов", role: "Майор милиции", emoji: "👮" },
  vera: { name: "Вера Холодова", role: "Психиатр", emoji: "👩‍⚕️" },
  serafim: { name: "Отец Серафим", role: "Священник (бывший геолог)", emoji: "⛪" },
  tanya: { name: "Таня Зорина", role: "Инженер завода", emoji: "👩‍🔧" },
  astahov: { name: "Полковник Астахов", role: "КГБ", emoji: "🕵️" },
  chernov: { name: "Академик Чернов", role: "Лидер культа", emoji: "🎓" },
  klava: { name: "Клавдия Петровна", role: "Администратор гостиницы", emoji: "🏨" },
  fyodor: { name: "Фёдор", role: "Бывший геолог", emoji: "🧔" },
};

// Информация о предметах инвентаря
const INVENTORY_INFO: Record<string, { name: string; description: string; icon: string; category: "tool" | "consumable" | "document"; imageSrc?: string }> = {
  item_flashlight: {
    name: "Фонарик",
    description: "Карманный фонарик. Незаменим в тёмных местах.",
    icon: "🔦",
    category: "tool",
  },
  item_gun: {
    name: "Табельное оружие",
    description: "Пистолет Макарова. Последний аргумент следователя.",
    icon: "🔫",
    category: "tool",
  },
  item_notebook: {
    name: "Блокнот",
    description: "Записная книжка с заметками по делу.",
    icon: "📓",
    category: "document",
  },
  item_camera: {
    name: "Фотоаппарат",
    description: "Для фиксации улик и вещественных доказательств.",
    icon: "📷",
    category: "tool",
  },
  item_lockpick: {
    name: "Набор отмычек",
    description: "Старые, потёртые, но рабочие. От Фёдора.",
    icon: "🔧",
    category: "tool",
  },
  item_vodka: {
    name: "Бутылка водки",
    description: "\"Столичная\". Иногда язык развязывается только так.",
    icon: "🍾",
    category: "consumable",
    imageSrc: "/avatars/vodka.png",
  },
  item_medicine: {
    name: "Успокоительное",
    description: "Седативное от Веры. Восстанавливает рассудок.",
    icon: "💊",
    category: "consumable",
    imageSrc: "/avatars/lekarstvo.jpg",
  },
};

function JournalModal({
  foundClues,
  metCharacters,
  inventory,
  sanity,
  infection,
  reputation,
  currentDay,
  timeOfDay,
  cultAwareness,
  investigationStyle,
  activeSidequests,
  lettersReceived,
  letterAuthorKnown,
  nightmaresWon,
  nightmaresLost,
  interludeNightmare1Played,
  questMashaDocuments,
  questMashaDocumentsDone,
  questLyudaMedicine,
  questLyudaMedicineDone,
  questGrishaViolin,
  questGrishaViolinDone,
  questKolkaWarning,
  onClose,
  onUseItem,
}: {
  foundClues: Set<string>;
  metCharacters: Set<string>;
  inventory: Set<string>;
  sanity: number;
  infection: number;
  reputation: number;
  currentDay: number;
  timeOfDay: number;
  cultAwareness: number;
  investigationStyle: string;
  activeSidequests: Set<string>;
  lettersReceived: number;
  letterAuthorKnown: boolean;
  nightmaresWon: number;
  nightmaresLost: number;
  interludeNightmare1Played: boolean;
  questMashaDocuments: boolean;
  questMashaDocumentsDone: boolean;
  questLyudaMedicine: boolean;
  questLyudaMedicineDone: boolean;
  questGrishaViolin: boolean;
  questGrishaViolinDone: boolean;
  questKolkaWarning: boolean;
  onClose: () => void;
  onUseItem?: (itemId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"main" | "clues" | "contacts" | "theories" | "inventory" | "sidequests">("main");

  const timeNames = ["Утро", "День", "Вечер", "Ночь"];
  const totalDays = 5;

  // Группируем улики по категориям
  const cluesByCategory = {
    evidence: Array.from(foundClues).filter(id => ALL_CLUES_INFO[id]?.category === "evidence"),
    event: Array.from(foundClues).filter(id => ALL_CLUES_INFO[id]?.category === "event"),
    lore: Array.from(foundClues).filter(id => ALL_CLUES_INFO[id]?.category === "lore"),
    artifact: Array.from(foundClues).filter(id => ALL_CLUES_INFO[id]?.category === "artifact"),
  };

  const getReputationStatus = (val: number) => {
    if (val >= 50) return { text: "СОЮЗНИК", color: "text-emerald-400" };
    if (val >= 20) return { text: "Доверяют", color: "text-green-400" };
    if (val <= -50) return { text: "ВРАГ", color: "text-red-400" };
    if (val <= -20) return { text: "Подозревают", color: "text-orange-400" };
    return { text: "Нейтрально", color: "text-stone-400" };
  };

  const repStatus = getReputationStatus(reputation);

  const styleConfig = {
    aggressive: { emoji: "⚔️", name: "Агрессивный", color: "text-red-400" },
    diplomatic: { emoji: "🤝", name: "Дипломатичный", color: "text-blue-400" },
    balanced: { emoji: "⚖️", name: "Сбалансированный", color: "text-stone-400" },
  };

  const style = styleConfig[investigationStyle as keyof typeof styleConfig] || styleConfig.balanced;

  // Circular Progress component
  const CircularProgress = ({ value, color, label, icon }: { value: number; color: string; label: string; icon: string }) => {
    const circumference = 2 * Math.PI * 18;
    const strokeDashoffset = circumference - (value / 100) * circumference;
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-stone-800" />
            <motion.circle 
              cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" 
              className={color}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg">{icon}</span>
          </div>
        </div>
        <p className="text-[10px] text-stone-500 mt-1.5 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-stone-300">{value}%</p>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
      
      {/* Modal */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="
          relative w-full max-w-md h-[90vh] sm:h-[85vh] sm:max-h-[700px]
          rounded-t-3xl sm:rounded-3xl overflow-hidden
          bg-gradient-to-b from-stone-900 to-stone-950
          border border-stone-800
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Detective Dossier Style */}
        <div className="px-4 py-4 border-b border-stone-800 relative">
          {/* Blood splatter */}
          <div className="absolute -top-2 right-8 w-6 h-6 opacity-20">
            <svg viewBox="0 0 100 100" className="w-full h-full text-red-600">
              <circle cx="50" cy="50" r="20" fill="currentColor" />
              <circle cx="75" cy="30" r="8" fill="currentColor" />
            </svg>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Agent Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-20 rounded border border-stone-700/50 overflow-hidden bg-stone-900 shadow-lg">
                <img 
                  src="/avatars/sorokin.webp" 
                  alt="Сорокин А.В."
                  className="w-full h-full object-cover grayscale-[20%] contrast-[1.1]"
                />
              </div>
              {/* Clip effect */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-stone-600 rounded-sm shadow" />
              {/* Stamp corner */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-red-900/40 flex items-center justify-center bg-stone-950/80">
                <span className="text-[6px] text-red-700/70 font-bold">СКР</span>
              </div>
            </div>
            
            {/* Agent Info */}
            <div className="flex-1 text-left space-y-0.5">
              <p className="text-[9px] tracking-[0.3em] text-red-700/50 uppercase">
                Секретно • Дело №1991-RF
              </p>
              <h2 className="text-lg font-light text-stone-100 tracking-wide">
                СОРОКИН А.В.
              </h2>
              <p className="text-[10px] text-stone-500 font-light">
                Следователь по особо важным делам
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-px flex-1 bg-gradient-to-r from-red-900/30 to-transparent" />
                <span className="text-red-800/40 text-[8px]">◆</span>
              </div>
            </div>
          </div>
          
          {/* Close button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-stone-800/50 flex items-center justify-center text-stone-500 hover:bg-stone-800"
          >
            ✕
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800 overflow-x-auto">
          {[
            { id: "main", label: "Обзор", icon: "📋" },
            { id: "inventory", label: "Снаряжение", icon: "🎒", count: inventory.size },
            { id: "clues", label: "Улики", icon: "🔍", count: foundClues.size },
            { id: "contacts", label: "Контакты", icon: "👥", count: metCharacters.size },
            { id: "sidequests", label: "Квесты", icon: "📜", count: (() => {
              const marketQuestCount = [questMashaDocuments, questLyudaMedicine, questGrishaViolin, questKolkaWarning].filter(Boolean).length;
              const total = activeSidequests.size + marketQuestCount;
              return total > 0 ? total : undefined;
            })() },
            { id: "theories", label: "Версии", icon: "💭" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`
                flex-1 px-2 py-2.5 text-xs font-medium
                flex items-center justify-center gap-1
                transition-all border-b-2
                ${activeTab === tab.id 
                  ? "text-amber-400 border-amber-500 bg-amber-500/5" 
                  : "text-stone-500 border-transparent hover:text-stone-300"
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-stone-800 text-[10px]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ═══ MAIN TAB ═══ */}
          {activeTab === "main" && (
            <>
              {/* Day & Time */}
              <div className="relative">
                <div className="absolute -left-2 top-0 w-1 h-4 bg-gradient-to-b from-red-800/40 to-transparent rounded-full" />
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: totalDays }).map((_, i) => (
                    <motion.div 
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < currentDay ? "bg-gradient-to-r from-amber-600 to-red-700/80" : "bg-stone-800"}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.3 }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-stone-800/80 flex items-center justify-center">
                      <span className="text-base">📅</span>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 uppercase tracking-wider">День расследования</p>
                      <p className="text-lg font-semibold text-stone-200">{currentDay} <span className="text-stone-600 font-normal">из {totalDays}</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500 uppercase tracking-wider">Время</p>
                    <p className="text-sm text-stone-300">{timeNames[timeOfDay] || "День"}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div>
                <div className="flex items-center gap-2 mb-4 relative">
                  <div className="h-px flex-1 bg-gradient-to-r from-stone-800 to-red-900/30" />
                  <span className="text-[10px] text-stone-600 uppercase tracking-[0.2em]">Состояние агента</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-stone-800 to-red-900/30" />
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-2 bg-red-800/40 rounded-full" />
                </div>
                <div className="flex justify-around mb-4">
                  <CircularProgress 
                    value={sanity} 
                    color={sanity > 50 ? "text-teal-400" : sanity > 25 ? "text-yellow-400" : "text-red-400"} 
                    label="Рассудок" 
                    icon="🧠" 
                  />
                  <CircularProgress 
                    value={infection} 
                    color={infection < 30 ? "text-stone-500" : infection < 60 ? "text-violet-400" : "text-red-400"} 
                    label="Заражение" 
                    icon="☣️" 
                  />
                  <CircularProgress 
                    value={cultAwareness} 
                    color="text-purple-400" 
                    label="Осведомл." 
                    icon="👁️" 
                  />
                </div>
                <div className="flex items-center justify-center gap-3 py-2 border-t border-stone-800">
                  <span className="text-lg">🔍</span>
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Собрано улик:</span>
                  <span className="text-lg font-bold text-amber-400">{foundClues.size}</span>
                </div>
              </div>

              {/* Reputation */}
              <div className={`border rounded-lg overflow-hidden ${reputation <= -20 ? "border-red-900/50" : "border-stone-800"}`}>
                <div className={`flex items-center justify-between px-3 py-2 border-b ${reputation <= -20 ? "bg-red-950/30 border-red-900/30" : "bg-stone-900/50 border-stone-800"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏘️</span>
                    <span className="text-xs text-stone-400 uppercase tracking-wider">Репутация в городе</span>
                  </div>
                  <span className={`text-xs font-bold ${repStatus.color}`}>{repStatus.text}</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-bold tabular-nums ${repStatus.color}`}>
                      {reputation > 0 ? `+${reputation}` : reputation}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-stone-800 relative overflow-hidden">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-600 -translate-x-1/2 z-10" />
                        <motion.div 
                          className={`absolute h-full rounded-full ${reputation >= 0 ? "bg-green-500" : "bg-red-500"}`}
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${Math.min(Math.abs(reputation), 100) / 2}%`,
                            left: reputation >= 0 ? '50%' : undefined,
                            right: reputation < 0 ? '50%' : undefined,
                          }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 px-0.5">
                        <span className="text-[9px] text-red-500/50">−100</span>
                        <span className="text-[9px] text-stone-600">0</span>
                        <span className="text-[9px] text-emerald-500/50">+100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Investigation Style */}
              <div className="flex items-center justify-between px-4 py-3 border border-stone-800 rounded-lg bg-stone-900/30">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{style.emoji}</span>
                  <div>
                    <p className="text-[10px] text-stone-600 uppercase tracking-[0.15em]">Метод допроса</p>
                    <p className={`text-sm font-medium ${style.color}`}>{style.name}</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-red-800/60 animate-pulse" />
              </div>
            </>
          )}

          {/* ═══ INVENTORY TAB ═══ */}
          {activeTab === "inventory" && (
            <>
              <div className="text-center space-y-2 mb-4">
                <p className="text-[10px] tracking-[0.4em] text-red-700/60 uppercase">Личные вещи • Снаряжение</p>
                <h3 className="text-xl font-light text-stone-100 tracking-[0.15em]">ИНВЕНТАРЬ АГЕНТА</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-red-900/50" />
                  <span className="text-red-800/60 text-xs">🎒</span>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-red-900/50" />
                </div>
              </div>

              {inventory.size === 0 ? (
                <div className="py-8 text-center border border-dashed border-stone-800 rounded-lg">
                  <span className="text-2xl opacity-30">🎒</span>
                  <p className="mt-2 text-sm text-stone-600">Инвентарь пуст</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Инструменты */}
                  {Array.from(inventory).filter(id => INVENTORY_INFO[id]?.category === "tool").length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-stone-500 uppercase tracking-wider">
                        <span>🔧</span>
                        <span>Инструменты</span>
                        <div className="flex-1 h-px bg-stone-800" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from(inventory)
                          .filter(id => INVENTORY_INFO[id]?.category === "tool")
                          .map(itemId => {
                            const item = INVENTORY_INFO[itemId];
                            if (!item) return null;
                            return (
                              <div
                                key={itemId}
                                className="relative p-3 rounded-lg border border-stone-800 bg-stone-900/50 hover:bg-stone-800/50 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-xl">{item.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-stone-200 truncate">{item.name}</p>
                                    <p className="text-[10px] text-stone-500 line-clamp-2">{item.description}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Расходники */}
                  {Array.from(inventory).filter(id => INVENTORY_INFO[id]?.category === "consumable").length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-stone-500 uppercase tracking-wider">
                        <span>💊</span>
                        <span>Расходные материалы</span>
                        <div className="flex-1 h-px bg-stone-800" />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {Array.from(inventory)
                          .filter(id => INVENTORY_INFO[id]?.category === "consumable")
                          .map(itemId => {
                            const item = INVENTORY_INFO[itemId];
                            if (!item) return null;
                            return (
                              <div
                                key={itemId}
                                className="relative p-3 rounded-lg border border-amber-900/30 bg-amber-950/20"
                              >
                                <div className="flex items-start gap-3">
                                  {item.imageSrc ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-amber-900/30 flex-shrink-0">
                                      <Image
                                        src={item.imageSrc}
                                        alt={item.name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-2xl">{item.icon}</span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-amber-200">{item.name}</p>
                                    <p className="text-[10px] text-stone-500 mt-0.5">{item.description}</p>
                                  </div>
                                  {onUseItem && (
                                    <button
                                      onClick={() => onUseItem(itemId)}
                                      className="px-3 py-1.5 rounded-lg bg-amber-700/50 hover:bg-amber-600/60 border border-amber-600/40 text-amber-200 text-xs font-medium transition-all hover:scale-105 active:scale-95"
                                    >
                                      Использовать
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Документы */}
                  {Array.from(inventory).filter(id => INVENTORY_INFO[id]?.category === "document").length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-stone-500 uppercase tracking-wider">
                        <span>📄</span>
                        <span>Документы</span>
                        <div className="flex-1 h-px bg-stone-800" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from(inventory)
                          .filter(id => INVENTORY_INFO[id]?.category === "document")
                          .map(itemId => {
                            const item = INVENTORY_INFO[itemId];
                            if (!item) return null;
                            return (
                              <div
                                key={itemId}
                                className="relative p-3 rounded-lg border border-stone-700 bg-stone-900/50 hover:bg-stone-800/50 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-xl">{item.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-stone-300 truncate">{item.name}</p>
                                    <p className="text-[10px] text-stone-500 line-clamp-2">{item.description}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Подсказка */}
              <div className="mt-4 p-3 rounded-lg border border-stone-800/50 bg-stone-900/30">
                <p className="text-[10px] text-stone-500 text-center">
                  💡 Предметы можно использовать в диалогах и при исследовании локаций
                </p>
              </div>
            </>
          )}

          {/* ═══ CLUES TAB ═══ */}
          {activeTab === "clues" && (
            <>
              <div className="text-center space-y-2 mb-4">
                <p className="text-[10px] tracking-[0.4em] text-red-700/60 uppercase">Раздел дела • Вещдоки</p>
                <h3 className="text-xl font-light text-stone-100 tracking-[0.15em]">СОБРАННЫЕ УЛИКИ</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-red-900/50" />
                  <span className="text-red-800/60 text-xs">📁</span>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-red-900/50" />
                </div>
              </div>

              {foundClues.size === 0 ? (
                <div className="py-8 text-center border border-dashed border-stone-800 rounded-lg">
                  <span className="text-2xl opacity-30">🔍</span>
                  <p className="text-xs text-stone-600 mt-2">Пока ничего не найдено</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Evidence */}
                  {cluesByCategory.evidence.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="text-base">🔍</span>
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-amber-400">Вещдоки</span>
                        <div className="flex-1 h-px bg-stone-800 ml-2" />
                      </div>
                      {cluesByCategory.evidence.map(id => {
                        const info = ALL_CLUES_INFO[id];
                        if (!info) return null;
                        return (
                          <div key={id} className="pl-4 py-2 border-l-2 border-stone-700">
                            <div className="flex items-start gap-3">
                              <span className="text-base">{info.icon}</span>
                              <div>
                                <h4 className="text-sm font-medium text-stone-200">{info.name}</h4>
                                <p className="text-xs text-stone-500 mt-0.5">{info.description.slice(0, 80)}...</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Events */}
                  {cluesByCategory.event.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="text-base">⚡</span>
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-blue-400">События</span>
                        <div className="flex-1 h-px bg-stone-800 ml-2" />
                      </div>
                      {cluesByCategory.event.map(id => {
                        const info = ALL_CLUES_INFO[id];
                        if (!info) return null;
                        return (
                          <div key={id} className="pl-4 py-2 border-l-2 border-stone-700">
                            <div className="flex items-start gap-3">
                              <span className="text-base">{info.icon}</span>
                              <div>
                                <h4 className="text-sm font-medium text-stone-200">{info.name}</h4>
                                <p className="text-xs text-stone-500 mt-0.5">{info.description.slice(0, 80)}...</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Lore */}
                  {cluesByCategory.lore.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="text-base">📜</span>
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-violet-400">Знания</span>
                        <div className="flex-1 h-px bg-stone-800 ml-2" />
                      </div>
                      {cluesByCategory.lore.map(id => {
                        const info = ALL_CLUES_INFO[id];
                        if (!info) return null;
                        return (
                          <div key={id} className="pl-4 py-2 border-l-2 border-stone-700">
                            <div className="flex items-start gap-3">
                              <span className="text-base">{info.icon}</span>
                              <div>
                                <h4 className="text-sm font-medium text-stone-200">{info.name}</h4>
                                <p className="text-xs text-stone-500 mt-0.5">{info.description.slice(0, 80)}...</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══ CONTACTS TAB ═══ */}
          {activeTab === "contacts" && (
            <>
              <div className="text-center space-y-2 mb-4">
                <p className="text-[10px] tracking-[0.4em] text-red-700/60 uppercase">Раздел дела • Информаторы</p>
                <h3 className="text-xl font-light text-stone-100 tracking-[0.15em]">КОНТАКТЫ</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-red-900/50" />
                  <span className="text-red-800/60 text-xs">👥</span>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-red-900/50" />
                </div>
              </div>

              {metCharacters.size === 0 ? (
                <div className="py-8 text-center border border-dashed border-stone-800 rounded-lg">
                  <span className="text-2xl opacity-30">👤</span>
                  <p className="text-xs text-stone-600 mt-2">Контактов пока нет</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from(metCharacters).map(charId => {
                    const char = CHARACTERS_INFO[charId];
                    if (!char) return null;
                    return (
                      <div key={charId} className="border border-stone-800 rounded-lg overflow-hidden">
                        <div className="h-0.5 bg-gradient-to-r from-red-900/50 via-stone-700 to-stone-800" />
                        <div className="p-3 bg-stone-900/30">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-lg bg-stone-800 flex items-center justify-center">
                              <span className="text-2xl">{char.emoji}</span>
                            </div>
                            <div>
                              <h4 className="text-base font-medium text-stone-200">{char.name}</h4>
                              <p className="text-xs text-stone-500">{char.role}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══ THEORIES TAB ═══ */}
          {/* Вкладка побочных квестов */}
          {activeTab === "sidequests" && (
            <>
              <div className="text-center space-y-2 mb-5">
                <p className="text-[10px] tracking-[0.4em] text-amber-700/60 uppercase">Дополнительные линии</p>
                <h3 className="text-xl font-light text-stone-100 tracking-[0.15em]">ПОБОЧНЫЕ ЗАДАНИЯ</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent via-amber-900/50 to-amber-700/30" />
                  <span className="text-amber-600/80 text-xs">⚜</span>
                  <div className="h-px w-12 bg-gradient-to-l from-transparent via-amber-900/50 to-amber-700/30" />
                </div>
              </div>

              <div className="space-y-4">
                {/* ═══ АНОНИМНЫЕ ПИСЬМА — Современная карточка ═══ */}
                {(activeSidequests.has("sq_letters_started") || activeSidequests.has("sq_letters_trusted") || 
                  activeSidequests.has("sq_letters_ignored") || activeSidequests.has("sq_letters_solved")) && (() => {
                  const isSolved = activeSidequests.has("sq_letters_solved");
                  const isTrusted = activeSidequests.has("sq_letters_trusted");
                  const isIgnored = activeSidequests.has("sq_letters_ignored");
                  const isStarted = activeSidequests.has("sq_letters_started");
                  
                  // Прогресс квеста: started=1, trusted/ignored=2, solved=3
                  const progress = isSolved ? 100 : (isTrusted || isIgnored) ? 66 : isStarted ? 33 : 0;
                  const currentStep = isSolved ? 3 : (isTrusted || isIgnored) ? 2 : 1;
                  
                  return (
                    <div className={`relative rounded-xl overflow-hidden ${
                      isSolved ? "bg-gradient-to-br from-emerald-950/40 via-stone-950 to-emerald-950/20" :
                      isIgnored ? "bg-gradient-to-br from-stone-900/60 via-stone-950 to-stone-900/40" :
                      "bg-gradient-to-br from-indigo-950/40 via-stone-950 to-violet-950/20"
                    }`}>
                      {/* Свечение по краю */}
                      <div className={`absolute inset-0 rounded-xl border ${
                        isSolved ? "border-emerald-500/30" :
                        isIgnored ? "border-stone-600/30" :
                        "border-indigo-500/30"
                      }`} />
                      
                      {/* Декоративная линия сверху */}
                      <div className={`h-1 ${
                        isSolved ? "bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600" :
                        isIgnored ? "bg-gradient-to-r from-stone-600 via-stone-500 to-stone-600" :
                        "bg-gradient-to-r from-indigo-600 via-violet-400 to-indigo-600"
                      }`} />
                      
                      <div className="p-4">
                        {/* Заголовок */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isSolved ? "bg-emerald-900/50" :
                              isIgnored ? "bg-stone-800/50" :
                              "bg-indigo-900/50"
                            }`}>
                              <span className="text-xl">
                                {isSolved ? "📬" : isIgnored ? "🚫" : "✉️"}
                              </span>
                            </div>
                            <div>
                              <h4 className={`font-medium ${
                                isSolved ? "text-emerald-200" :
                                isIgnored ? "text-stone-400" :
                                "text-indigo-200"
                              }`}>Анонимные письма</h4>
                              <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                                Побочный квест • {isSolved ? "Завершён" : isIgnored ? "Отклонён" : "В процессе"}
                              </p>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
                            isSolved ? "bg-emerald-500/20 text-emerald-400" :
                            isIgnored ? "bg-stone-500/20 text-stone-400" :
                            "bg-indigo-500/20 text-indigo-400"
                          }`}>
                            {isSolved ? "✓ Раскрыт" : isIgnored ? "✗ Закрыт" : `Этап ${currentStep}/3`}
                          </div>
                        </div>
                        
                        {/* Прогресс-бар */}
                        <div className="mb-4">
                          <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSolved ? "bg-gradient-to-r from-emerald-600 to-emerald-400" :
                                isIgnored ? "bg-gradient-to-r from-stone-600 to-stone-500" :
                                "bg-gradient-to-r from-indigo-600 to-violet-500"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5 text-[9px] text-stone-600">
                            <span>Получение</span>
                            <span>Решение</span>
                            <span>Раскрытие</span>
                          </div>
                        </div>
                        
                        {/* Описание и статус */}
                        <div className={`p-3 rounded-lg mb-3 ${
                          isSolved ? "bg-emerald-950/30" :
                          isIgnored ? "bg-stone-900/30" :
                          "bg-indigo-950/30"
                        }`}>
                          <p className="text-xs text-stone-300 leading-relaxed">
                            {isSolved 
                              ? "Тайный информатор раскрыт. Николай Семёнович — бывший член культа, потерявший сына в ритуале 1983 года. Его показания бесценны для расследования."
                              : isTrusted
                              ? "Решено довериться анониму. Согласно последнему письму — вечером у старой шахты состоится встреча. Нужно быть осторожным."
                              : isIgnored
                              ? "Письма признаны провокацией. Возможно, важная информация была упущена, но безопасность прежде всего."
                              : "Получено таинственное письмо без подписи. Аноним предупреждает об опасности и обещает помочь. Доверять ли ему?"
                            }
                          </p>
                        </div>
                        
                        {/* Детали квеста */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={isSolved || lettersReceived >= 1 ? "text-emerald-400" : "text-stone-600"}>
                              {isSolved || lettersReceived >= 1 ? "●" : "○"}
                            </span>
                            <span className={isSolved || lettersReceived >= 1 ? "text-stone-300" : "text-stone-600"}>
                              Получить первое письмо
                            </span>
                            {lettersReceived >= 1 && <span className="text-[9px] text-emerald-500/70 ml-auto">✓</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={lettersReceived >= 2 ? "text-emerald-400" : "text-stone-600"}>
                              {lettersReceived >= 2 ? "●" : "○"}
                            </span>
                            <span className={lettersReceived >= 2 ? "text-stone-300" : "text-stone-600"}>
                              Получить второе письмо ({lettersReceived}/2)
                            </span>
                            {lettersReceived >= 2 && <span className="text-[9px] text-emerald-500/70 ml-auto">✓</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={isTrusted || isIgnored || isSolved ? "text-emerald-400" : "text-stone-600"}>
                              {isTrusted || isIgnored || isSolved ? "●" : "○"}
                            </span>
                            <span className={isTrusted || isIgnored || isSolved ? "text-stone-300" : "text-stone-600"}>
                              Принять решение о доверии
                            </span>
                            {(isTrusted || isIgnored || isSolved) && (
                              <span className={`text-[9px] ml-auto ${isTrusted || isSolved ? "text-emerald-500/70" : "text-red-500/70"}`}>
                                {isTrusted || isSolved ? "Доверился" : "Отказал"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={isSolved ? "text-emerald-400" : "text-stone-600"}>
                              {isSolved ? "●" : "○"}
                            </span>
                            <span className={isSolved ? "text-stone-300" : "text-stone-600"}>
                              Узнать личность информатора
                            </span>
                            {isSolved && <span className="text-[9px] text-amber-500/70 ml-auto">Н. Семёнович</span>}
                          </div>
                        </div>
                        
                        {/* Награда */}
                        {isSolved && (
                          <div className="mt-3 pt-3 border-t border-emerald-900/30 flex items-center gap-2">
                            <span className="text-amber-400">⭐</span>
                            <span className="text-[10px] text-amber-300/80">Получен эксклюзивный источник информации о культе</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ═══ НОЧНЫЕ КОШМАРЫ — Современная карточка ═══ */}
                {interludeNightmare1Played && (() => {
                  const totalNightmares = nightmaresWon + nightmaresLost;
                  const isVictorious = nightmaresWon > 0;
                  const progress = Math.min((totalNightmares / 3) * 100, 100);
                  
                  return (
                    <div className={`relative rounded-xl overflow-hidden ${
                      isVictorious 
                        ? "bg-gradient-to-br from-violet-950/40 via-stone-950 to-purple-950/20"
                        : "bg-gradient-to-br from-red-950/40 via-stone-950 to-rose-950/20"
                    }`}>
                      {/* Свечение по краю */}
                      <div className={`absolute inset-0 rounded-xl border ${
                        isVictorious ? "border-violet-500/30" : "border-red-500/30"
                      }`} />
                      
                      {/* Декоративная линия сверху */}
                      <div className={`h-1 ${
                        isVictorious 
                          ? "bg-gradient-to-r from-violet-600 via-purple-400 to-violet-600"
                          : "bg-gradient-to-r from-red-600 via-rose-400 to-red-600"
                      }`} />
                      
                      <div className="p-4">
                        {/* Заголовок */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center relative ${
                              isVictorious ? "bg-violet-900/50" : "bg-red-900/50"
                            }`}>
                              <span className="text-xl">{isVictorious ? "🌙" : "💀"}</span>
                              {/* Пульсация для активного квеста */}
                              {totalNightmares < 3 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                              )}
                            </div>
                            <div>
                              <h4 className={`font-medium ${isVictorious ? "text-violet-200" : "text-red-200"}`}>
                                Ночные кошмары
                              </h4>
                              <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                                Интерлюдия • {totalNightmares >= 3 ? "Завершено" : "Активно"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${
                              isVictorious ? "bg-violet-500/20 text-violet-400" : "bg-red-500/20 text-red-400"
                            }`}>
                              {totalNightmares}/3 ночей
                            </div>
                          </div>
                        </div>
                        
                        {/* Визуализация ночей */}
                        <div className="flex gap-2 mb-4">
                          {[1, 2, 3].map((night) => {
                            const isPlayed = night <= totalNightmares;
                            const wasWon = night <= nightmaresWon;
                            return (
                              <div 
                                key={night}
                                className={`flex-1 h-12 rounded-lg flex flex-col items-center justify-center transition-all ${
                                  isPlayed 
                                    ? wasWon 
                                      ? "bg-gradient-to-b from-violet-800/40 to-violet-900/60 border border-violet-500/30"
                                      : "bg-gradient-to-b from-red-800/40 to-red-900/60 border border-red-500/30"
                                    : "bg-stone-900/30 border border-stone-800/50 border-dashed"
                                }`}
                              >
                                <span className="text-sm">
                                  {isPlayed ? (wasWon ? "✨" : "💔") : "🌑"}
                                </span>
                                <span className={`text-[9px] mt-0.5 ${
                                  isPlayed 
                                    ? wasWon ? "text-violet-400" : "text-red-400"
                                    : "text-stone-600"
                                }`}>
                                  {isPlayed ? (wasWon ? "Победа" : "Побег") : `Ночь ${night}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Описание */}
                        <div className={`p-3 rounded-lg mb-3 ${
                          isVictorious ? "bg-violet-950/30" : "bg-red-950/30"
                        }`}>
                          <p className="text-xs text-stone-300 leading-relaxed">
                            {isVictorious 
                              ? "Вы преодолели страх и увидели сквозь завесу кошмара. Образы из прошлого — афганские воспоминания — переплелись с видениями алтаря в пещерах. Теперь вы знаете: лес показывает правду тем, кто не отворачивается."
                              : "Кошмар оказался слишком силён. Вы бежали от образов прошлого, но они преследуют вас наяву. Возможно, в следующий раз удастся посмотреть страху в глаза."
                            }
                          </p>
                        </div>
                        
                        {/* Статистика */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`p-2 rounded-lg text-center ${
                            isVictorious ? "bg-violet-900/20" : "bg-stone-900/30"
                          }`}>
                            <div className={`text-lg font-bold ${isVictorious ? "text-violet-300" : "text-stone-400"}`}>
                              {nightmaresWon}
                            </div>
                            <div className="text-[9px] text-stone-500 uppercase tracking-wider">Побед</div>
                          </div>
                          <div className={`p-2 rounded-lg text-center ${
                            nightmaresLost > 0 ? "bg-red-900/20" : "bg-stone-900/30"
                          }`}>
                            <div className={`text-lg font-bold ${nightmaresLost > 0 ? "text-red-300" : "text-stone-400"}`}>
                              {nightmaresLost}
                            </div>
                            <div className="text-[9px] text-stone-500 uppercase tracking-wider">Побегов</div>
                          </div>
                        </div>
                        
                        {/* Бонусы */}
                        {isVictorious && (
                          <div className="mt-3 pt-3 border-t border-violet-900/30 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 text-sm">⭐</span>
                              <span className="text-[10px] text-amber-300/80">Видение: алтарь в глубине пещер</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-violet-400 text-sm">👁</span>
                              <span className="text-[10px] text-violet-300/80">Записано пророческое видение</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ═══ КВЕСТЫ РЫНКА — Документы Маши ═══ */}
                {(questMashaDocuments || questMashaDocumentsDone) && (
                  <div className={`relative rounded-xl overflow-hidden ${questMashaDocumentsDone ? 'bg-gradient-to-br from-emerald-950/40 via-stone-950 to-emerald-950/20' : 'bg-gradient-to-br from-amber-950/40 via-stone-950 to-amber-950/20'}`}>
                    <div className={`absolute inset-0 rounded-xl border ${questMashaDocumentsDone ? 'border-emerald-700/30' : 'border-amber-700/30'}`} />
                    <div className="relative p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${questMashaDocumentsDone ? 'bg-emerald-900/50' : 'bg-amber-900/50'}`}>
                          <span className="text-lg">📜</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-stone-200">Документы Виктора Морозова</h4>
                            {questMashaDocumentsDone && <span className="text-emerald-400 text-xs">✓</span>}
                          </div>
                          <p className="text-xs text-stone-400 mb-2">
                            {questMashaDocumentsDone 
                              ? "Документы найдены и переданы тёте Маше" 
                              : "Найти спрятанные документы мужа тёти Маши"}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500">
                            <span>👤 Тётя Маша</span>
                            <span>•</span>
                            <span>🛒 Рынок</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ КВЕСТЫ РЫНКА — Лекарство для Люды ═══ */}
                {(questLyudaMedicine || questLyudaMedicineDone) && (
                  <div className={`relative rounded-xl overflow-hidden ${questLyudaMedicineDone ? 'bg-gradient-to-br from-emerald-950/40 via-stone-950 to-emerald-950/20' : 'bg-gradient-to-br from-pink-950/40 via-stone-950 to-pink-950/20'}`}>
                    <div className={`absolute inset-0 rounded-xl border ${questLyudaMedicineDone ? 'border-emerald-700/30' : 'border-pink-700/30'}`} />
                    <div className="relative p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${questLyudaMedicineDone ? 'bg-emerald-900/50' : 'bg-pink-900/50'}`}>
                          <span className="text-lg">💊</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-stone-200">Лекарство для мамы Люды</h4>
                            {questLyudaMedicineDone && <span className="text-emerald-400 text-xs">✓</span>}
                          </div>
                          <p className="text-xs text-stone-400 mb-2">
                            {questLyudaMedicineDone 
                              ? "Церебролизин передан Люде" 
                              : "Достать Церебролизин (больница или Вера)"}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500">
                            <span>👤 Люда</span>
                            <span>•</span>
                            <span>🛒 Рынок</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ КВЕСТЫ РЫНКА — Скрипка Гриши ═══ */}
                {(questGrishaViolin || questGrishaViolinDone) && (
                  <div className={`relative rounded-xl overflow-hidden ${questGrishaViolinDone ? 'bg-gradient-to-br from-emerald-950/40 via-stone-950 to-emerald-950/20' : 'bg-gradient-to-br from-violet-950/40 via-stone-950 to-violet-950/20'}`}>
                    <div className={`absolute inset-0 rounded-xl border ${questGrishaViolinDone ? 'border-emerald-700/30' : 'border-violet-700/30'}`} />
                    <div className="relative p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${questGrishaViolinDone ? 'bg-emerald-900/50' : 'bg-violet-900/50'}`}>
                          <span className="text-lg">🎻</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-stone-200">Скрипка Гриши</h4>
                            {questGrishaViolinDone && <span className="text-emerald-400 text-xs">✓</span>}
                          </div>
                          <p className="text-xs text-stone-400 mb-2">
                            {questGrishaViolinDone 
                              ? "Скрипка возвращена владельцу" 
                              : "Найти скрипку (комиссионка или дом Астахова)"}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500">
                            <span>👤 Гриша</span>
                            <span>•</span>
                            <span>🛒 Рынок</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ КВЕСТЫ РЫНКА — Тайна озера (Колька) ═══ */}
                {questKolkaWarning && (
                  <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-cyan-950/40 via-stone-950 to-cyan-950/20">
                    <div className="absolute inset-0 rounded-xl border border-cyan-700/30" />
                    <div className="relative p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-900/50">
                          <span className="text-lg">🌊</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-stone-200">Тайна озера</h4>
                          </div>
                          <p className="text-xs text-stone-400 mb-2">
                            Колька предупредил об опасности и предложил показать озеро ночью
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500">
                            <span>👤 Колька-рыбак</span>
                            <span>•</span>
                            <span>🛒 Рынок</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ ПУСТОЕ СОСТОЯНИЕ — Современный дизайн ═══ */}
                {!activeSidequests.has("sq_letters_started") &&
                 !activeSidequests.has("sq_letters_trusted") &&
                 !activeSidequests.has("sq_letters_ignored") &&
                 !activeSidequests.has("sq_letters_solved") &&
                 !interludeNightmare1Played &&
                 !questMashaDocuments && !questMashaDocumentsDone &&
                 !questLyudaMedicine && !questLyudaMedicineDone &&
                 !questGrishaViolin && !questGrishaViolinDone &&
                 !questKolkaWarning && (
                  <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-stone-900/40 via-stone-950 to-stone-900/20">
                    <div className="absolute inset-0 rounded-xl border border-stone-700/30 border-dashed" />
                    <div className="py-10 px-6 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-stone-800/50 flex items-center justify-center">
                        <span className="text-2xl opacity-50">🔍</span>
                      </div>
                      <h4 className="text-sm font-medium text-stone-400 mb-2">Побочных заданий пока нет</h4>
                      <p className="text-xs text-stone-600 max-w-[200px] mx-auto leading-relaxed">
                        Исследуйте Черноозёрск внимательнее — не все важные зацепки лежат на поверхности
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-stone-700">
                        <span>💡</span>
                        <span>Общайтесь с NPC на рынке</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "theories" && (
            <>
              <div className="text-center space-y-2 mb-4">
                <p className="text-[10px] tracking-[0.4em] text-red-700/60 uppercase">Раздел дела • Гипотезы</p>
                <h3 className="text-xl font-light text-stone-100 tracking-[0.15em]">ВЕРСИИ РАССЛЕДОВАНИЯ</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-red-900/50" />
                  <span className="text-red-800/60 text-xs">💭</span>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-red-900/50" />
                </div>
              </div>

              <div className="space-y-3">
                {/* Main theory based on cult awareness */}
                {cultAwareness >= 30 && (
                  <div className="border border-red-900/50 rounded-lg overflow-hidden">
                    <div className="absolute -top-1 -right-1 w-3 h-4 bg-red-800/40 rounded-full blur-[2px]" />
                    <div className="p-3 bg-stone-900/20">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">🕯️</span>
                        <div className="flex-1">
                          <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">★ Основная</span>
                          <h4 className="text-sm font-medium text-red-300 mt-1">Культ Красного Леса</h4>
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 rounded-full bg-stone-800 overflow-hidden">
                                <motion.div 
                                  className="h-full rounded-full bg-red-600"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${cultAwareness}%` }}
                                  transition={{ duration: 0.6 }}
                                />
                              </div>
                              <span className="text-xs text-stone-500 tabular-nums">{cultAwareness}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other theories */}
                <div className="border border-stone-800 rounded-lg overflow-hidden">
                  <div className="p-3 bg-stone-900/20">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">🧪</span>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-purple-300">Химическое отравление</h4>
                        <p className="text-xs text-stone-500 mt-1">Возможно, причина в загрязнении воды или воздуха</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-stone-800 rounded-lg overflow-hidden">
                  <div className="p-3 bg-stone-900/20">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">🏛️</span>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-300">Правительственный заговор</h4>
                        <p className="text-xs text-stone-500 mt-1">Власти скрывают правду о происходящем</p>
                      </div>
                    </div>
                  </div>
                </div>

                {cultAwareness < 30 && (
                  <div className="py-4 text-center text-stone-600 text-xs">
                    💡 Собирайте больше улик, чтобы раскрыть истину
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-800 bg-stone-950">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>День {currentDay} • {timeNames[timeOfDay] || "День"}</span>
            <span className="text-amber-500/60">{foundClues.size} улик найдено</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ХЕДЕР — Glassmorphism style
// ══════════════════════════════════════════════════════════════════════════════

function Header({
  foundCluesCount,
  playtime,
  episodeTitle,
  episodeNum,
  onBack,
  onSaveClick,
  onCluesClick,
  isMusicPlaying,
  onMusicToggle,
  sanity = 100,
  infection = 0,
  reputation = 0,
}: {
  foundCluesCount: number;
  playtime: number;
  episodeTitle: string;
  episodeNum: number;
  onBack: () => void;
  onSaveClick: () => void;
  onCluesClick: () => void;
  isMusicPlaying: boolean;
  onMusicToggle: () => void;
  sanity?: number;
  infection?: number;
  reputation?: number;
}) {
  // Цвета индикаторов
  const sanityColor = sanity >= 70 ? "from-cyan-400 to-blue-500" 
    : sanity >= 40 ? "from-blue-400 to-indigo-500"
    : sanity >= 20 ? "from-purple-500 to-red-500"
    : "from-red-500 to-red-700";
  
  const infectionColor = infection <= 20 ? "from-slate-400 to-slate-500"
    : infection <= 50 ? "from-violet-400 to-purple-500"
    : infection <= 70 ? "from-purple-500 to-red-500"
    : "from-red-500 to-red-700";
  
  // Цвет репутации: от красного (враг) до зелёного (доверие)
  const reputationColor = reputation >= 50 ? "from-emerald-400 to-green-500"
    : reputation >= 20 ? "from-green-400 to-emerald-500"
    : reputation >= -20 ? "from-slate-400 to-slate-500"
    : reputation >= -50 ? "from-orange-400 to-red-500"
    : "from-red-500 to-red-700";
  
  // Иконка репутации
  const reputationIcon = reputation >= 50 ? "★" 
    : reputation >= 20 ? "☆"
    : reputation >= -20 ? "◇"
    : reputation >= -50 ? "▽"
    : "✕";
  
  // Подсказка для репутации
  const reputationLabel = reputation >= 50 ? "Доверие"
    : reputation >= 20 ? "Симпатия"
    : reputation >= -20 ? "Нейтрально"
    : reputation >= -50 ? "Подозрение"
    : "Враг";

  return (
    <div className="sticky top-0 z-40 px-4 pt-2 space-y-2">
      {/* Верхняя панель — управление */}
      <div className="
        relative overflow-hidden
        rounded-3xl
        bg-white/[0.03]
        backdrop-blur-3xl
        border border-white/[0.08]
        shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.1)]
      ">
        {/* Блик преломления — верхний */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {/* Блик преломления — диагональный */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
        {/* Нижняя тень для объёма */}
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-black/20 to-transparent" />
        
        <div className="relative flex items-center justify-between px-4 py-2.5">
          
          {/* Левая часть — Назад + Глава */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                investigationHaptic.sceneTransition();
                onBack();
              }}
              className="
                relative overflow-hidden
                w-10 h-10 
                rounded-xl 
                bg-white/[0.04]
                backdrop-blur-xl
                border border-white/[0.08]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
                flex items-center justify-center 
                text-white/50 hover:text-white hover:bg-white/[0.08]
                transition-all
              "
            >
              <svg className="h-4 w-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>

            <div className="
              relative overflow-hidden
              h-10 px-4
              rounded-xl 
              bg-violet-500/[0.08]
              backdrop-blur-xl
              border border-violet-400/[0.12]
              shadow-[inset_0_1px_0_rgba(167,139,250,0.1)]
              flex items-center justify-center 
              text-xs font-semibold text-violet-300/90
            ">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-400/[0.08] via-transparent to-transparent" />
              <span className="relative">Глава {episodeNum}</span>
            </div>
          </div>

          {/* Центр — Таймер */}
          <div className="
            relative h-10 px-4
            rounded-xl 
            bg-black/[0.15]
            backdrop-blur-xl
            border border-white/[0.06]
            shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_-1px_0_rgba(255,255,255,0.05)]
            flex items-center gap-3
            overflow-hidden
          ">
            {/* Блик стекла */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
            {/* Subtle red glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/[0.06] to-red-500/0 animate-pulse" />
            
            {/* Recording indicator */}
            <div className="relative flex items-center justify-center">
              <span className="absolute w-3.5 h-3.5 rounded-full bg-red-500/20 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            </div>
            
            {/* Time display */}
            <span className="
              relative text-sm font-mono font-semibold tabular-nums
              text-white/80
              tracking-wider
            ">
              {formatPlaytime(playtime)}
            </span>
          </div>

          {/* Правая часть — Действия */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                investigationHaptic.evidenceSelect();
                onMusicToggle();
              }}
              className={`
                relative overflow-hidden
                w-10 h-10 
                rounded-xl 
                backdrop-blur-xl
                flex items-center justify-center 
                text-sm
                transition-all
                ${isMusicPlaying 
                  ? "bg-violet-500/[0.1] border border-violet-400/[0.15] text-violet-300 shadow-[inset_0_1px_0_rgba(167,139,250,0.1)]" 
                  : "bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                }
              `}
            >
              <span className="relative z-10">{isMusicPlaying ? "🔊" : "🔇"}</span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                investigationHaptic.evidenceSelect();
                onSaveClick();
              }}
              className="
                relative overflow-hidden
                w-10 h-10 
                rounded-xl 
                bg-white/[0.04]
                backdrop-blur-xl
                border border-white/[0.08]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
                flex items-center justify-center 
                text-sm
                text-white/60 hover:bg-white/[0.08]
                transition-all
              "
            >
              <span className="relative z-10">💾</span>
            </motion.button>
            
            {/* Кнопка журнала */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                investigationHaptic.evidenceSelect();
                onCluesClick();
              }}
              className="
                relative overflow-hidden
                h-10 px-3
                rounded-xl 
                bg-red-500/[0.08]
                backdrop-blur-xl
                border border-red-400/[0.15]
                shadow-[inset_0_1px_0_rgba(239,68,68,0.1)]
                flex items-center gap-2
                text-sm font-semibold text-red-200/90
                hover:bg-red-500/[0.12]
                transition-all
              "
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-400/[0.06] via-transparent to-transparent" />
              <span className="relative">📋</span>
              <span className="relative tabular-nums">{foundCluesCount}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Вторая строка — Название расследования по центру */}
      <div className="relative flex justify-center">
        {/* Индикаторы САНИТИ, ЗАРАЖЕНИЯ и РЕПУТАЦИИ — абсолютно слева */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col justify-center gap-0.5">
          {/* Санити — верхняя линия */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 text-[9px] text-center ${sanity < 30 ? "text-red-400" : "text-cyan-400/60"}`}>◆</span>
            <div className="w-12 h-1 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${sanityColor} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${sanity}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className={`w-5 text-[9px] font-mono text-right tabular-nums ${sanity < 30 ? "text-red-400" : "text-white/40"}`}>{sanity}</span>
          </div>

          {/* Заражение — средняя линия */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 text-[9px] text-center ${infection > 50 ? "text-red-400" : "text-violet-400/60"}`}>●</span>
            <div className="w-12 h-1 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${infectionColor} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${infection}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className={`w-5 text-[9px] font-mono text-right tabular-nums ${infection > 50 ? "text-red-400" : "text-white/40"}`}>{infection}</span>
          </div>

          {/* Репутация города — нижняя линия */}
          <div className="flex items-center gap-1.5" title={`Репутация: ${reputationLabel}`}>
            <span className={`w-2 text-[9px] text-center ${
              reputation >= 20 ? "text-emerald-400/60" 
              : reputation <= -20 ? "text-red-400" 
              : "text-slate-400/60"
            }`}>{reputationIcon}</span>
            <div className="w-12 h-1 rounded-full bg-black/30 overflow-hidden relative">
              {/* Центральная метка для нуля */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-1/2" />
              {/* Бар репутации — от центра */}
              <motion.div
                className={`absolute h-full bg-gradient-to-r ${reputationColor} rounded-full`}
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.abs(reputation) / 2}%`,
                  left: reputation >= 0 ? '50%' : `${50 - Math.abs(reputation) / 2}%`,
                }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className={`w-5 text-[9px] font-mono text-right tabular-nums ${
              reputation >= 20 ? "text-emerald-400" 
              : reputation <= -20 ? "text-red-400" 
              : "text-white/40"
            }`}>{reputation > 0 ? `+${reputation}` : reputation}</span>
          </div>
        </div>
        
        {/* Название расследования — glass блок по центру */}
        <div className="
          relative overflow-hidden
          px-7 py-3
          rounded-2xl
          bg-white/[0.02]
          backdrop-blur-3xl
          border border-white/[0.06]
          shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.1)]
        ">
          {/* Блик преломления — верхний */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          {/* Блик преломления — диагональный */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />
          {/* Красноватое свечение снизу */}
          <div className="absolute inset-0 bg-gradient-to-t from-red-500/[0.03] via-transparent to-transparent pointer-events-none" />
          
          <span className="
            relative
            text-base font-semibold tracking-wide
            bg-gradient-to-r from-red-400 via-red-300 to-red-400
            bg-clip-text text-transparent
            drop-shadow-[0_0_16px_rgba(239,68,68,0.5)]
          ">
            {episodeTitle}
          </span>
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
  cityReputation: number;
} | null;

// Данные о всех возможных концовках для мотивации перепрохождения
// СИНХРОНИЗИРОВАНО С INK: madness, truth, hero, sacrifice, rebirth, escape, redemption, fyodor
const ALL_ENDINGS = [
  { id: "truth", name: "Правда наружу", icon: "📜", rarity: "Истинная" },
  { id: "hero", name: "Тихий герой", icon: "🦸", rarity: "Героическая" },
  { id: "sacrifice", name: "Жертва", icon: "⚰️", rarity: "Трагическая" },
  { id: "rebirth", name: "Перерождение", icon: "🔥", rarity: "Тёмная" },
  { id: "escape", name: "Побег", icon: "🚪", rarity: "Обычная" },
  { id: "redemption", name: "Искупление", icon: "🕊️", rarity: "Редкая" },
  { id: "madness", name: "Безумие", icon: "🌀", rarity: "Скрытая" },
  { id: "fyodor", name: "Искупление Фёдора", icon: "🚷", rarity: "Секретная" },
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
      // === КОНЦОВКИ ИЗ INK (добавлены при аудите) ===
      hero: {
        icon: "🦸",
        title: "Тихий герой",
        subtitle: "Вы спасли невинных, оставшись в тени.",
        gradient: "from-blue-500 to-indigo-600",
        glow: "rgba(59, 130, 246, 0.4)",
        textColor: "text-blue-400",
      },
      rebirth: {
        icon: "🔥",
        title: "Перерождение",
        subtitle: "Из пепла рождается новое начало.",
        gradient: "from-orange-500 to-red-600",
        glow: "rgba(249, 115, 22, 0.4)",
        textColor: "text-orange-400",
      },
      escape: {
        icon: "🚪",
        title: "Побег",
        subtitle: "Вы вырвались из когтей Красного леса.",
        gradient: "from-teal-500 to-emerald-600",
        glow: "rgba(20, 184, 166, 0.4)",
        textColor: "text-teal-400",
      },
      redemption: {
        icon: "🕊️",
        title: "Искупление",
        subtitle: "Прошлые грехи искуплены ценой страданий.",
        gradient: "from-amber-400 to-yellow-500",
        glow: "rgba(251, 191, 36, 0.4)",
        textColor: "text-amber-400",
      },
      fyodor: {
        icon: "🚷",
        title: "Искупление Фёдора",
        subtitle: "Секретная концовка: охотник закрыл Дверь навсегда.",
        gradient: "from-stone-500 to-zinc-700",
        glow: "rgba(168, 162, 158, 0.4)",
        textColor: "text-stone-400",
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
                  
                  {/* Репутация города */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/60 flex items-center gap-1">
                        🏘️ Репутация в городе
                      </span>
                      <span className={`text-xs font-medium ${
                        finalStats.cityReputation >= 20 ? "text-emerald-400" 
                        : finalStats.cityReputation <= -20 ? "text-red-400" 
                        : "text-slate-400"
                      }`}>
                        {finalStats.cityReputation > 0 ? `+${finalStats.cityReputation}` : finalStats.cityReputation}
                        <span className="text-white/40 ml-1">
                          ({finalStats.cityReputation >= 50 ? "Доверие" 
                            : finalStats.cityReputation >= 20 ? "Симпатия"
                            : finalStats.cityReputation >= -20 ? "Нейтрально"
                            : finalStats.cityReputation >= -50 ? "Подозрение"
                            : "Враг"})
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                      {/* Центральная метка */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30 -translate-x-1/2 z-10" />
                      <motion.div 
                        className={`absolute h-full rounded-full ${
                          finalStats.cityReputation >= 20 ? "bg-emerald-500" 
                          : finalStats.cityReputation <= -20 ? "bg-red-500" 
                          : "bg-slate-500"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${Math.min(Math.abs(finalStats.cityReputation), 100) / 2}%`,
                          left: finalStats.cityReputation >= 0 ? '50%' : `${50 - Math.min(Math.abs(finalStats.cityReputation), 100) / 2}%`,
                        }}
                        transition={{ duration: 1, delay: 0.4 }}
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
  onSave: () => boolean;
  onLoad: (saveId: string) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  // State для списка сохранений — обновляется после каждого сохранения
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Загрузка списка сохранений при монтировании и при refreshKey
  useEffect(() => {
    setSaves(getManualSaves(investigationId));
  }, [investigationId, refreshKey]);
  
  // Обёртка для сохранения с обновлением списка
  const handleSave = useCallback(() => {
    const success = onSave();
    if (success !== false) {
      // Даём время на запись в localStorage
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 600);
    }
  }, [onSave]);

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
            onClick={handleSave}
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
        className="px-4 pt-6 pb-6 text-center"
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
      <div className="px-4 pb-6 space-y-4">
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
        className="px-4 pb-6 text-center"
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
