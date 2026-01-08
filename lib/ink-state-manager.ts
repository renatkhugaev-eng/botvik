/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * КРАСНЫЙ ЛЕС — Менеджер состояния Ink историй
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Решает критическую проблему: передача состояния между эпизодами.
 *
 * БЕЗ этой системы:
 * - Каждый эпизод стартует с жёстких значений
 * - Выборы игрока не влияют на следующие эпизоды
 * - Нелинейность — фиктивная
 *
 * С этой системой:
 * - Состояние сохраняется после каждого выбора
 * - При старте нового эпизода загружается состояние из предыдущего
 * - Реальная нелинейность и последствия выборов
 */

import { InkRunner, RED_FOREST_VARIABLES } from "./ink-runtime";

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════════

export interface RedForestState {
  // Мета
  storyId: string;
  episodeId: string;
  timestamp: number;

  // Основные переменные
  sanity: number;
  days_remaining: number;
  current_day: number;

  // Доверие
  trust_gromov: number;
  trust_vera: number;
  trust_serafim: number;
  trust_tanya: number;
  trust_astahov: number;

  // Прогресс
  evidence_collected: number;
  cult_awareness: number;
  chapter: number;

  // Флаги встреч
  met_gromov: boolean;
  met_vera: boolean;
  met_serafim: boolean;
  met_tanya: boolean;
  met_astahov: boolean;
  met_klava: boolean;
  met_chernov: boolean;

  // Флаги событий
  saw_symbol: boolean;
  heard_voices: boolean;
  found_notebook: boolean;
  found_photos: boolean;
  entered_caves: boolean;
  witnessed_ritual: boolean;
  confronted_cult: boolean;

  // Отношения
  romantic_tanya: boolean;
  betrayed_gromov: boolean;
  trusted_vera: boolean;

  // Улики (флаги)
  clue_missing_list: boolean;
  clue_false_reports: boolean;
  clue_witness_conflict: boolean;
  clue_echo_docs: boolean;
  clue_experiment_records: boolean;
  clue_underground_map: boolean;
  clue_access_pass: boolean;
  clue_cult_symbol: boolean;
  clue_chernov_diary: boolean;
  clue_ritual_photos: boolean;
  clue_insider_testimony: boolean;
  clue_expedition_1890: boolean;
  clue_serafim_legends: boolean;
  clue_church_symbols: boolean;

  // Концовки
  ending_truth_unlocked: boolean;
  ending_hero_unlocked: boolean;
  ending_sacrifice_unlocked: boolean;
  ending_rebirth_unlocked: boolean;
  ending_escape_unlocked: boolean;

  // Полное состояние inkjs (для точного восстановления)
  inkState?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "red_forest_state";
const STORAGE_KEY_EPISODE = "red_forest_episode_";

// Порядок эпизодов
const EPISODE_ORDER = [
  "red-forest-1",
  "red-forest-2",
  "red-forest-3",
  "red-forest-4",
  "red-forest-5",
];

// Начальное состояние для эпизода 1
const INITIAL_STATE: Omit<RedForestState, "storyId" | "episodeId" | "timestamp" | "inkState"> = {
  sanity: 85,
  days_remaining: 7,
  current_day: 1,
  trust_gromov: 25,
  trust_vera: 15,
  trust_serafim: 40,
  trust_tanya: 35,
  trust_astahov: 0,
  evidence_collected: 0,
  cult_awareness: 0,
  chapter: 1,
  met_gromov: false,
  met_vera: false,
  met_serafim: false,
  met_tanya: false,
  met_astahov: false,
  met_klava: false,
  met_chernov: false,
  saw_symbol: false,
  heard_voices: false,
  found_notebook: false,
  found_photos: false,
  entered_caves: false,
  witnessed_ritual: false,
  confronted_cult: false,
  romantic_tanya: false,
  betrayed_gromov: false,
  trusted_vera: false,
  clue_missing_list: false,
  clue_false_reports: false,
  clue_witness_conflict: false,
  clue_echo_docs: false,
  clue_experiment_records: false,
  clue_underground_map: false,
  clue_access_pass: false,
  clue_cult_symbol: false,
  clue_chernov_diary: false,
  clue_ritual_photos: false,
  clue_insider_testimony: false,
  clue_expedition_1890: false,
  clue_serafim_legends: false,
  clue_church_symbols: false,
  ending_truth_unlocked: false,
  ending_hero_unlocked: false,
  ending_sacrifice_unlocked: false,
  ending_rebirth_unlocked: false,
  ending_escape_unlocked: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ОСНОВНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Извлекает состояние из InkRunner
 */
export function extractStateFromRunner(runner: InkRunner, episodeId: string): RedForestState {
  const getVar = <T>(name: string, defaultValue: T): T => {
    const value = runner.getVariable(name);
    return value !== undefined ? (value as T) : defaultValue;
  };

  return {
    storyId: "red-forest",
    episodeId,
    timestamp: Date.now(),

    sanity: getVar("sanity", INITIAL_STATE.sanity),
    days_remaining: getVar("days_remaining", INITIAL_STATE.days_remaining),
    current_day: getVar("current_day", INITIAL_STATE.current_day),

    trust_gromov: getVar("trust_gromov", INITIAL_STATE.trust_gromov),
    trust_vera: getVar("trust_vera", INITIAL_STATE.trust_vera),
    trust_serafim: getVar("trust_serafim", INITIAL_STATE.trust_serafim),
    trust_tanya: getVar("trust_tanya", INITIAL_STATE.trust_tanya),
    trust_astahov: getVar("trust_astahov", INITIAL_STATE.trust_astahov),

    evidence_collected: getVar("evidence_collected", INITIAL_STATE.evidence_collected),
    cult_awareness: getVar("cult_awareness", INITIAL_STATE.cult_awareness),
    chapter: getVar("chapter", INITIAL_STATE.chapter),

    met_gromov: getVar("met_gromov", INITIAL_STATE.met_gromov),
    met_vera: getVar("met_vera", INITIAL_STATE.met_vera),
    met_serafim: getVar("met_serafim", INITIAL_STATE.met_serafim),
    met_tanya: getVar("met_tanya", INITIAL_STATE.met_tanya),
    met_astahov: getVar("met_astahov", INITIAL_STATE.met_astahov),
    met_klava: getVar("met_klava", INITIAL_STATE.met_klava),
    met_chernov: getVar("met_chernov", false),

    saw_symbol: getVar("saw_symbol", INITIAL_STATE.saw_symbol),
    heard_voices: getVar("heard_voices", INITIAL_STATE.heard_voices),
    found_notebook: getVar("found_notebook", INITIAL_STATE.found_notebook),
    found_photos: getVar("found_photos", INITIAL_STATE.found_photos),
    entered_caves: getVar("entered_caves", INITIAL_STATE.entered_caves),
    witnessed_ritual: getVar("witnessed_ritual", INITIAL_STATE.witnessed_ritual),
    confronted_cult: getVar("confronted_cult", INITIAL_STATE.confronted_cult),

    romantic_tanya: getVar("romantic_tanya", INITIAL_STATE.romantic_tanya),
    betrayed_gromov: getVar("betrayed_gromov", INITIAL_STATE.betrayed_gromov),
    trusted_vera: getVar("trusted_vera", INITIAL_STATE.trusted_vera),

    clue_missing_list: getVar("clue_missing_list", false),
    clue_false_reports: getVar("clue_false_reports", INITIAL_STATE.clue_false_reports),
    clue_witness_conflict: getVar("clue_witness_conflict", false),
    clue_echo_docs: getVar("clue_echo_docs", INITIAL_STATE.clue_echo_docs),
    clue_experiment_records: getVar("clue_experiment_records", false),
    clue_underground_map: getVar("clue_underground_map", false),
    clue_access_pass: getVar("clue_access_pass", false),
    clue_cult_symbol: getVar("clue_cult_symbol", false),
    clue_chernov_diary: getVar("clue_chernov_diary", false),
    clue_ritual_photos: getVar("clue_ritual_photos", INITIAL_STATE.clue_ritual_photos),
    clue_insider_testimony: getVar("clue_insider_testimony", false),
    clue_expedition_1890: getVar("clue_expedition_1890", false),
    clue_serafim_legends: getVar("clue_serafim_legends", false),
    clue_church_symbols: getVar("clue_church_symbols", false),

    ending_truth_unlocked: getVar("ending_truth_unlocked", false),
    ending_hero_unlocked: getVar("ending_hero_unlocked", false),
    ending_sacrifice_unlocked: getVar("ending_sacrifice_unlocked", false),
    ending_rebirth_unlocked: getVar("ending_rebirth_unlocked", false),
    ending_escape_unlocked: getVar("ending_escape_unlocked", false),

    inkState: runner.saveState(),
  };
}

/**
 * Применяет состояние к InkRunner
 */
export function applyStateToRunner(runner: InkRunner, state: RedForestState): void {
  // Создаём объект с переменными для массовой установки
  const variables: Record<string, string | number | boolean> = {
    sanity: state.sanity,
    days_remaining: state.days_remaining,
    current_day: state.current_day,
    
    trust_gromov: state.trust_gromov,
    trust_vera: state.trust_vera,
    trust_serafim: state.trust_serafim,
    trust_tanya: state.trust_tanya,
    trust_astahov: state.trust_astahov,
    
    evidence_collected: state.evidence_collected,
    cult_awareness: state.cult_awareness,
    chapter: state.chapter,
    
    met_gromov: state.met_gromov,
    met_vera: state.met_vera,
    met_serafim: state.met_serafim,
    met_tanya: state.met_tanya,
    met_astahov: state.met_astahov,
    met_klava: state.met_klava,
    met_chernov: state.met_chernov,
    
    saw_symbol: state.saw_symbol,
    heard_voices: state.heard_voices,
    found_notebook: state.found_notebook,
    found_photos: state.found_photos,
    entered_caves: state.entered_caves,
    witnessed_ritual: state.witnessed_ritual,
    confronted_cult: state.confronted_cult,
    
    romantic_tanya: state.romantic_tanya,
    betrayed_gromov: state.betrayed_gromov,
    trusted_vera: state.trusted_vera,
    
    clue_missing_list: state.clue_missing_list,
    clue_false_reports: state.clue_false_reports,
    clue_witness_conflict: state.clue_witness_conflict,
    clue_echo_docs: state.clue_echo_docs,
    clue_experiment_records: state.clue_experiment_records,
    clue_underground_map: state.clue_underground_map,
    clue_access_pass: state.clue_access_pass,
    clue_cult_symbol: state.clue_cult_symbol,
    clue_chernov_diary: state.clue_chernov_diary,
    clue_ritual_photos: state.clue_ritual_photos,
    clue_insider_testimony: state.clue_insider_testimony,
    clue_expedition_1890: state.clue_expedition_1890,
    clue_serafim_legends: state.clue_serafim_legends,
    clue_church_symbols: state.clue_church_symbols,
    
    ending_truth_unlocked: state.ending_truth_unlocked,
    ending_hero_unlocked: state.ending_hero_unlocked,
    ending_sacrifice_unlocked: state.ending_sacrifice_unlocked,
    ending_rebirth_unlocked: state.ending_rebirth_unlocked,
    ending_escape_unlocked: state.ending_escape_unlocked,
  };
  
  runner.setVariables(variables);
}

// Backwards compatibility aliases
export const extractStateFromStory = extractStateFromRunner;
export const applyStateToStory = applyStateToRunner;

/**
 * Сохраняет состояние в localStorage
 */
export function saveState(state: RedForestState): void {
  try {
    // Сохраняем текущее состояние
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Сохраняем состояние для конкретного эпизода
    localStorage.setItem(
      STORAGE_KEY_EPISODE + state.episodeId,
      JSON.stringify(state)
    );
  } catch (e) {
    console.error("[InkStateManager] Failed to save state:", e);
  }
}

/**
 * Загружает состояние из localStorage
 */
export function loadState(episodeId?: string): RedForestState | null {
  try {
    const key = episodeId ? STORAGE_KEY_EPISODE + episodeId : STORAGE_KEY;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("[InkStateManager] Failed to load state:", e);
  }
  return null;
}

/**
 * Загружает состояние из предыдущего эпизода
 */
export function loadPreviousEpisodeState(currentEpisodeId: string): RedForestState | null {
  const currentIndex = EPISODE_ORDER.indexOf(currentEpisodeId);
  if (currentIndex <= 0) {
    return null; // Первый эпизод или неизвестный
  }

  const previousEpisodeId = EPISODE_ORDER[currentIndex - 1];
  return loadState(previousEpisodeId);
}

/**
 * Получает начальное состояние для эпизода
 * - Если первый эпизод — возвращает INITIAL_STATE
 * - Если продолжение — загружает из предыдущего эпизода
 */
export function getInitialStateForEpisode(episodeId: string): RedForestState {
  // Пробуем загрузить состояние из предыдущего эпизода
  const previousState = loadPreviousEpisodeState(episodeId);
  if (previousState) {
    return {
      ...previousState,
      episodeId,
      timestamp: Date.now(),
      chapter: previousState.chapter + 1,
    };
  }

  // Пробуем загрузить сохранённое состояние текущего эпизода
  const savedState = loadState(episodeId);
  if (savedState) {
    return savedState;
  }

  // Возвращаем начальное состояние
  return {
    ...INITIAL_STATE,
    storyId: "red-forest",
    episodeId,
    timestamp: Date.now(),
  };
}

/**
 * Сбрасывает всё сохранённое состояние
 */
export function resetAllState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    EPISODE_ORDER.forEach((ep) => {
      localStorage.removeItem(STORAGE_KEY_EPISODE + ep);
    });
  } catch (e) {
    console.error("[InkStateManager] Failed to reset state:", e);
  }
}

/**
 * Проверяет, доступен ли эпизод для игры
 */
export function isEpisodeAvailable(episodeId: string): boolean {
  const index = EPISODE_ORDER.indexOf(episodeId);
  if (index <= 0) return true; // Первый эпизод всегда доступен

  // Проверяем, пройден ли предыдущий эпизод
  const previousEpisodeId = EPISODE_ORDER[index - 1];
  const previousState = loadState(previousEpisodeId);
  return previousState !== null;
}

/**
 * Получает прогресс истории
 */
export function getStoryProgress(): {
  currentEpisode: number;
  totalEpisodes: number;
  completedEpisodes: string[];
} {
  const completedEpisodes: string[] = [];
  EPISODE_ORDER.forEach((ep) => {
    if (loadState(ep)) {
      completedEpisodes.push(ep);
    }
  });

  return {
    currentEpisode: completedEpisodes.length + 1,
    totalEpisodes: EPISODE_ORDER.length,
    completedEpisodes,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ОТЛАДКА
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Выводит текущее состояние в консоль (для отладки)
 */
export function debugState(state: RedForestState): void {
  console.group("🔴 Red Forest State");
  console.log("Episode:", state.episodeId);
  console.log("Sanity:", state.sanity);
  console.log("Days Remaining:", state.days_remaining);
  console.log("Evidence:", state.evidence_collected);
  console.log("Cult Awareness:", state.cult_awareness);
  console.log("Trust:", {
    gromov: state.trust_gromov,
    vera: state.trust_vera,
    serafim: state.trust_serafim,
    tanya: state.trust_tanya,
  });
  console.log("Key Events:", {
    saw_symbol: state.saw_symbol,
    heard_voices: state.heard_voices,
    entered_caves: state.entered_caves,
    witnessed_ritual: state.witnessed_ritual,
  });
  console.groupEnd();
}
