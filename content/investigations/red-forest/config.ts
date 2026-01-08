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
  
  episodes: [
    {
      id: 1,
      title: "Прибытие",
      file: "episode-1.ink.json",
      duration: "30-40 мин",
    },
    {
      id: 2,
      title: "Первая жертва",
      file: "episode-2.ink.json",
      duration: "35-45 мин",
    },
    {
      id: 3,
      title: "Завод",
      file: "episode-3.ink.json",
      duration: "40-50 мин",
    },
    {
      id: 4,
      title: "Голоса",
      file: "episode-4.ink.json",
      duration: "35-45 мин",
    },
    {
      id: 5,
      title: "Красный лес",
      file: "episode-5.ink.json",
      duration: "50-60 мин",
    },
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
      { id: "truth", name: "Правда наружу" },
      { id: "hero", name: "Тихий герой" },
      { id: "sacrifice", name: "Жертва" },
      { id: "rebirth", name: "Перерождение" },
      { id: "escape", name: "Побег" },
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
