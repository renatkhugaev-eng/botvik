// ═══════════════════════════════════════════════════════════════════════════════
// КРАСНЫЙ ЛЕС — Конфигурация истории
// ═══════════════════════════════════════════════════════════════════════════════

export const RED_FOREST_CONFIG = {
  id: "red-forest",
  title: "Красный лес",
  subtitle: "Хоррор-детектив",
  description: "Закрытый город. Пропавшие люди. Древний культ. И дверь, которую лучше не открывать.",
  
  setting: {
    location: "Красногорск-12, Средний Урал",
    year: "1986",
    era: "Поздний СССР",
  },
  
  protagonist: {
    name: "Виктор Сорокин",
    role: "Следователь прокуратуры РСФСР",
    age: 42,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // АКТУАЛЬНАЯ АРХИТЕКТУРА: Единый файл red-forest-complete.ink
  // Старые episode-X.ink файлы DEPRECATED
  // ═══════════════════════════════════════════════════════════════════════════
  storyFile: "red-forest-complete.ink.json",
  totalDuration: "2-3 часа",
  
  // Справочная информация по эпизодам (для UI)
  episodes: [
    { id: 1, title: "Прибытие", description: "15 ноября — прибытие в Красногорск-12" },
    { id: 2, title: "Первая жертва", description: "16 ноября — расследование начинается" },
    { id: 3, title: "Завод", description: "17 ноября — тайны проекта 'Эхо'" },
    { id: 4, title: "Голоса", description: "18 ноября — похищения и предательства" },
    { id: 5, title: "Красный лес", description: "19 ноября — полнолуние, финал" },
  ],
  
  characters: {
    protagonist: "ssorokin",
    npcs: ["gromov", "vera", "serafim", "tanya", "astahov", "klava", "chernov", "cultist"],
  },
  
  themes: {
    primary: "red",
    mood: "horror",
    atmosphere: "soviet-noir",
  },
  
  mechanics: {
    sanity: true,
    trust: true,
    evidence: true,
    multipleEndings: true,
    endings: [
      { id: "truth", name: "Правда наружу", type: "good" },
      { id: "hero", name: "Тихий герой", type: "neutral" },
      { id: "sacrifice", name: "Жертва", type: "bittersweet" },
      { id: "rebirth", name: "Перерождение", type: "dark" },
      { id: "escape", name: "Побег", type: "neutral" },
      { id: "chernov_redemption", name: "Искупление Чернова", type: "secret" },
      { id: "fyodor_sacrifice", name: "Жертва Фёдора", type: "secret" },
      { id: "madness", name: "Безумие", type: "bad" },
    ],
  },
};

export const RED_FOREST_MOODS = {
  normal: {
    bg: "from-slate-900 to-slate-950",
    accent: "slate",
    overlay: null,
  },
  dark: {
    bg: "from-red-950 via-black to-red-950",
    accent: "red",
    overlay: "vignette",
  },
  horror: {
    bg: "from-black via-red-950 to-black",
    accent: "red",
    overlay: "grain",
  },
  mystery: {
    bg: "from-violet-950 via-slate-950 to-violet-950",
    accent: "violet",
    overlay: "scanlines",
  },
  tense: {
    bg: "from-amber-950 via-slate-950 to-amber-950",
    accent: "amber",
    overlay: "vignette",
  },
};
