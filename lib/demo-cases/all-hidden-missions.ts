/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALL HIDDEN CLUE MISSIONS
 * 6 уникальных локаций по всему миру с отличным покрытием Street View
 * Все миссии с возможностью перемещения и скрытыми уликами
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HiddenClue, HiddenClueMission } from "@/types/hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// 1. ТОКИО, СИБУЯ — Якудза и пропавший журналист
// СГЕНЕРИРОВАНО АВТОМАТИЧЕСКИ v2.0.0 — 7 улик с реальными panoId
// ═══════════════════════════════════════════════════════════════════════════

const TOKYO_CLUES: HiddenClue[] = [
  {
    id: "yakuza_clue_0_WuFobbns",
    panoId: "WuFobbnsRI-2cedm-2SQ4Q", // 6 шагов от старта
    revealHeading: 345.13466,
    coneDegrees: 26,
    dwellTime: 2.4,
    name: "Визитка пачинко-зала",
    icon: "🃏",
    storyContext: "'Golden Dragon' — прикрытие для отмывания денег.",
    xpReward: 40,
    hintText: "Яркая карточка на земле...",
    scannerHint: "Обнаружен объект типа \"Визитка\".",
  },
  {
    id: "yakuza_clue_1_qqhUEgzv",
    panoId: "qqhUEgzv-6sqCJkD0igTSQ", // 16 шагов от старта
    revealHeading: 274.6988,
    coneDegrees: 18,
    dwellTime: 3.2,
    name: "Разбитый смартфон",
    icon: "📱",
    storyContext: "SMS: 'Он слишком много знает. Убрать.' Отправлено час назад.",
    xpReward: 63,
    hintText: "Разбитый дисплей светится...",
    scannerHint: "Обнаружен объект типа \"Телефон\".",
  },
  {
    id: "yakuza_clue_2_9exqkmRR",
    panoId: "9exqkmRRREmpcpKkkJCb8Q", // 20 шагов от старта
    revealHeading: 92.4921,
    coneDegrees: 14,
    dwellTime: 3.6,
    name: "Разбитые часы Rolex",
    icon: "⌚",
    storyContext: "Стекло разбито. Кровь на ремешке. Борьба была жестокой.",
    xpReward: 88,
    hintText: "Что-то блестит в водостоке...",
    scannerHint: "Обнаружен объект типа \"Часы\".",
  },
  {
    id: "yakuza_clue_3_JJ3zvGsw",
    panoId: "JJ3zvGswEbCHtKUB7svAuw", // 35 шагов от старта
    revealHeading: 258.55219999999997,
    coneDegrees: 12,
    dwellTime: 4,
    name: "Биологические следы",
    icon: "🩸",
    storyContext: "Группа крови AB-. Редкая. Совпадает с досье пропавшего.",
    xpReward: 126,
    hintText: "Подозрительные следы...",
    scannerHint: "Обнаружен объект типа \"Кровь\".",
  },
  {
    id: "yakuza_clue_4_BT-Me6jx",
    panoId: "BT-Me6jxUabFCyD0oR9mYQ", // 44 шага от старта
    revealHeading: 260.00115,
    coneDegrees: 12,
    dwellTime: 4,
    name: "Записка",
    icon: "📰",
    storyContext: "Список имён. Три уже вычеркнуты. Журналист — четвёртый.",
    xpReward: 63,
    hintText: "Газета прибита к столбу...",
    scannerHint: "Обнаружен объект типа \"Документ\".",
  },
  {
    id: "yakuza_clue_5_X0Tj7jad",
    panoId: "X0Tj7jadzU0bTxrrsDwK8g", // 52 шага от старта
    revealHeading: 263.38443,
    coneDegrees: 12,
    dwellTime: 4,
    name: "Микро-накопитель",
    icon: "💾",
    storyContext: "Зашифрованные файлы. Заголовки: 'Сенатор_платежи.xlsx', 'Видео_встреча.mp4'. Компромат.",
    xpReward: 144,
    hintText: "Что-то пластиковое в щели...",
    scannerHint: "Обнаружен объект типа \"Флешка\".",
  },
  {
    id: "yakuza_clue_6_fLneOxIv",
    panoId: "fLneOxIvvNSe2nRor1wKsA", // 60 шагов от старта
    revealHeading: 34.840453588034435,
    coneDegrees: 12,
    dwellTime: 4,
    name: "Бейдж репортёра",
    icon: "🪪",
    storyContext: "Карта сломана пополам. Следы борьбы. Её бросили специально — как предупреждение.",
    xpReward: 90,
    hintText: "Что-то с надписями...",
    scannerHint: "Обнаружен объект типа \"Пресс-карта\".",
  },
];

export const TOKYO_MISSION: HiddenClueMission = {
  id: "gen_1767653533809_ei5s7tbbh",
  title: "Неоновые тени",
  description: "Журналист-расследователь исчез после статьи о якудза.",
  briefing: `📋 ДЕЛО "ДРАКОН"

Журналист, 15 лет расследовавший связи якудза с политиками, пропал.
Его последнее сообщение: "Они знают. Уходите из квартиры."
Полиция "не нашла следов преступления."

ВАША ЗАДАЧА:
• Найдите улики, которые "не заметила" полиция
• Восстановите последние часы жизни журналиста

⚠️ ОСТОРОЖНО: Якудза следит за местом.`,
  startCoordinates: [35.6594, 139.7006],
  startPanoId: "5DbydaNVaYEKOP1i2OWVrw",
  startHeading: 0,
  allowNavigation: true,
  clues: TOKYO_CLUES,
  requiredClues: 5, // 5 из 7 обязательны
  timeLimit: 900, // 15 минут
  xpReward: 307, // Сумма всех улик: 40+63+88+126+63+144+90 = 614, половина = 307
  speedBonusPerSecond: 0.5,
  location: "Токио, Сибуя",
  difficulty: "easy",
  icon: "🇯🇵",
  color: "#dc2626",
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. ЛОНДОН, СОХО — Двойной агент MI6
// Исторический криминальный район с отличным покрытием
// ═══════════════════════════════════════════════════════════════════════════

const LONDON_CLUES: HiddenClue[] = [
  {
    id: "ln_newspaper",
    panoId: "START",
    revealHeading: 320,
    coneDegrees: 28,   // Было 45 → 28
    dwellTime: 2.3,    // Было 1.3 → 2.3
    name: "Газета с шифром",
    icon: "📰",
    storyContext: "The Times, вчерашний номер. В объявлениях подчёркнуты буквы: 'R-E-D-F-O-X-C-O-M-P-R-O-M-I-S-E-D.'",
    xpReward: 35,
    hintText: "Газета на скамейке...",
    scannerHint: "Печатный материал с аномалией.",
  },
  {
    id: "ln_umbrella",
    panoId: "STEP_5-8",
    revealHeading: 90,
    coneDegrees: 24,   // Было 40 → 24
    dwellTime: 2.6,    // Было 1.6 → 2.6
    name: "Зонт с меткой",
    icon: "☂️",
    storyContext: "Классический английский зонт. На ручке выгравировано: 'Vauxhall Cross' — адрес штаб-квартиры MI6.",
    xpReward: 40,
    hintText: "Чёрный зонт у стены...",
    scannerHint: "Предмет с гравировкой.",
  },
  {
    id: "ln_coin",
    panoId: "STEP_10-14",
    revealHeading: 220,
    coneDegrees: 18,   // Было 30 → 18
    dwellTime: 3.0,    // Было 2.0 → 3.0
    name: "Монета-контейнер",
    icon: "🪙",
    storyContext: "Полый пенни! Внутри — микроплёнка с фото. На снимке: двое мужчин у российского посольства. Один — замминистра.",
    xpReward: 55,
    hintText: "Монета лежит странно...",
    scannerHint: "Полый металлический объект!",
  },
  {
    id: "ln_note",
    panoId: "STEP_18-22",
    revealHeading: 45,
    coneDegrees: 20,   // Было 35 → 20
    dwellTime: 3.2,    // Было 1.8 → 3.2
    name: "Записка в урне",
    icon: "🗑️",
    storyContext: "'Pub. 21:00. Booth 3. Come alone.' Классика шпионских встреч. Но кто-то пришёл не один.",
    xpReward: 45,
    hintText: "В урне что-то белеет...",
    scannerHint: "Бумажный объект.",
  },
  {
    id: "ln_cufflink",
    panoId: "STEP_28+",
    revealHeading: 160,
    coneDegrees: 14,   // Было 22 → 14 (очень узкий!)
    dwellTime: 3.8,    // Было 2.5 → 3.8
    name: "Запонка с гербом",
    icon: "🔘",
    storyContext: "Герб Итонского колледжа. Такие носят только выпускники. Агент 'Red Fox' учился там в 1987-1992.",
    xpReward: 65,
    hintText: "Что-то золотое в щели...",
    scannerHint: "Ювелирное изделие высокой пробы!",
  },
];

export const LONDON_MISSION: HiddenClueMission = {
  id: "london_soho",
  title: "Тени Сохо",
  description: "Двойной агент MI6 назначил встречу и не явился.",
  briefing: `📋 ОПЕРАЦИЯ "RED FOX"

Дата: Сегодня, 21:30
Место: Сохо, Лондон

Агент под кодовым именем "Red Fox" 20 лет работал на MI6. Вчера он запросил экстренную эвакуацию: "Меня раскрыли. Русские знают."

Встреча была назначена в пабе "The Crown" в 21:00. Наш человек ждал час. Red Fox не появился.

Его последнее сообщение: "Booth 3. У меня доказательства. Это уходит на самый верх."

ВАША ЗАДАЧА:
• Пройдите его маршрут от метро до паба
• Ищите "мёртвые почтовые ящики" — классика шпионских игр
• Найдите то, что он хотел нам передать

🇬🇧 Туманный Альбион хранит секреты.`,
  startCoordinates: [51.5137, -0.1318], // Сохо
  startPanoId: "START",
  startHeading: 270,
  allowNavigation: true,
  clues: LONDON_CLUES,
  requiredClues: 4,
  timeLimit: 540,
  xpReward: 350,
  speedBonusPerSecond: 0.4,
  location: "Лондон, Сохо",
  difficulty: "hard",
  icon: "🇬🇧",
  color: "#1d4ed8",
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. ЛАС-ВЕГАС — Ограбление казино
// Невада Стрип с неоновыми огнями
// ═══════════════════════════════════════════════════════════════════════════

const VEGAS_CLUES: HiddenClue[] = [
  {
    id: "lv_chip",
    panoId: "START",
    revealHeading: 60,
    coneDegrees: 26,   // Было 45 → 26
    dwellTime: 2.2,    // Было 1.2 → 2.2
    name: "Фишка казино Bellagio",
    icon: "🎰",
    storyContext: "$10,000 фишка. Серийный номер: B-7749-X. В базе казино: 'Выдана VIP-клиенту. Имя засекречено.'",
    xpReward: 35,
    hintText: "Что-то круглое на тротуаре...",
    scannerHint: "Казино-фишка обнаружена.",
  },
  {
    id: "lv_glasses",
    panoId: "STEP_6-9",
    revealHeading: 180,
    coneDegrees: 22,   // Было 40 → 22
    dwellTime: 2.8,    // Было 1.5 → 2.8
    name: "Солнцезащитные очки",
    icon: "🕶️",
    storyContext: "Ray-Ban Aviator. На дужке — микрокамера! Кто-то снимал вход в хранилище изнутри.",
    xpReward: 45,
    hintText: "Очки лежат у бордюра...",
    scannerHint: "Оптический прибор с электроникой!",
  },
  {
    id: "lv_receipt",
    panoId: "STEP_12-16",
    revealHeading: 300,
    coneDegrees: 20,   // Было 35 → 20
    dwellTime: 3.0,    // Было 1.8 → 3.0
    name: "Чек из оружейного магазина",
    icon: "🧾",
    storyContext: "'Desert Eagle Arms. 3 × глушитель. 500 патронов.' Оплачено наличными. Камера 'не работала.'",
    xpReward: 50,
    hintText: "Бумажка у мусорки...",
    scannerHint: "Документ с важной информацией.",
  },
  {
    id: "lv_keycard",
    panoId: "STEP_20-25",
    revealHeading: 120,
    coneDegrees: 18,   // Было 30 → 18
    dwellTime: 3.3,    // Было 2.0 → 3.3
    name: "Карта доступа персонала",
    icon: "💳",
    storyContext: "Bellagio, уровень доступа: VAULT. Имя: Martinez, Security. Martinez уволен 2 года назад. Карта активна.",
    xpReward: 55,
    hintText: "Карточка в траве...",
    scannerHint: "Электронный пропуск!",
  },
  {
    id: "lv_note",
    panoId: "STEP_30+",
    revealHeading: 240,
    coneDegrees: 14,   // Было 22 → 14
    dwellTime: 4.0,    // Было 2.5 → 4.0
    name: "План хранилища",
    icon: "📋",
    storyContext: "Схема от руки. Время смены охраны. Слепые зоны камер. Пометка: 'Суббота, 3:00 AM. $47M.'",
    xpReward: 70,
    hintText: "Сложенная бумага у стены...",
    scannerHint: "КРИТИЧНО: Документ планирования!",
  },
];

export const VEGAS_MISSION: HiddenClueMission = {
  id: "vegas_strip",
  title: "Блеск и тени Вегаса",
  description: "Кто-то планирует ограбление века. У вас есть 10 минут.",
  briefing: `📋 ОПЕРАЦИЯ "JACKPOT"

Дата: Суббота, 02:15 AM
Место: Las Vegas Strip

Анонимный звонок: "Сегодня ночью ограбят Bellagio. Хранилище. $47 миллионов."

ФБР получило наводку 20 минут назад. Местная полиция "случайно" задерживается.

Кто-то внутри работает на грабителей.

ВАША ЗАДАЧА:
• Найдите следы подготовки на улицах
• Грабители уже здесь — они оставили улики
• У вас меньше часа до начала операции

💰 Vegas baby. Ставки высоки как никогда.`,
  startCoordinates: [36.1147, -115.1728], // Vegas - Las Vegas Blvd (Strip с навигацией)
  startPanoId: "START",
  startHeading: 180,
  allowNavigation: true,
  clues: VEGAS_CLUES,
  requiredClues: 4,
  timeLimit: 600,
  xpReward: 400,
  speedBonusPerSecond: 0.5,
  location: "Лас-Вегас, Невада",
  difficulty: "hard",
  icon: "🎰",
  color: "#eab308",
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. РИМ, ВАТИКАН — Украденная реликвия
// Исторический центр с великолепным покрытием
// ═══════════════════════════════════════════════════════════════════════════

const ROME_CLUES: HiddenClue[] = [
  {
    id: "rm_rosary",
    panoId: "START",
    revealHeading: 30,
    coneDegrees: 28,   // Было 45 → 28
    dwellTime: 2.3,    // Было 1.3 → 2.3
    name: "Оброненные чётки",
    icon: "📿",
    storyContext: "Антикварные чётки XVI века. Такие носят только кардиналы. На распятии — герб семьи Борджиа.",
    xpReward: 40,
    hintText: "Что-то блестит у колонны...",
    scannerHint: "Религиозный артефакт.",
  },
  {
    id: "rm_letter",
    panoId: "STEP_4-7",
    revealHeading: 270,
    coneDegrees: 24,   // Было 40 → 24
    dwellTime: 2.6,    // Было 1.6 → 2.6
    name: "Письмо с печатью",
    icon: "✉️",
    storyContext: "Латынь: 'Opus Dei требует молчания. Реликвия должна исчезнуть.' Подпись нечитаема.",
    xpReward: 45,
    hintText: "Конверт у основания статуи...",
    scannerHint: "Документ на латыни.",
  },
  {
    id: "rm_glove",
    panoId: "STEP_10-15",
    revealHeading: 150,
    coneDegrees: 20,   // Было 35 → 20
    dwellTime: 3.0,    // Было 1.8 → 3.0
    name: "Белая перчатка",
    icon: "🧤",
    storyContext: "Шёлковая перчатка для работы с реликвиями. Внутри — пылинки золота. Кто-то держал ковчег.",
    xpReward: 50,
    hintText: "Белая ткань в тени...",
    scannerHint: "Ткань со следами металла.",
  },
  {
    id: "rm_map",
    panoId: "STEP_18-23",
    revealHeading: 330,
    coneDegrees: 18,   // Было 30 → 18
    dwellTime: 3.4,    // Было 2.2 → 3.4
    name: "Карта катакомб",
    icon: "🗺️",
    storyContext: "Секретные туннели под Ватиканом! Маршрут отмечен красным. Конечная точка: 'Archivio Segreto.'",
    xpReward: 55,
    hintText: "Старая карта у решётки...",
    scannerHint: "Картографический документ!",
  },
  {
    id: "rm_ring",
    panoId: "STEP_28+",
    revealHeading: 60,
    coneDegrees: 12,   // Было 20 → 12 (очень сложно!)
    dwellTime: 4.0,    // Было 2.8 → 4.0
    name: "Перстень кардинала",
    icon: "💍",
    storyContext: "Аметист в золоте. Гравировка: 'Silentium est aurum.' Принадлежит кардиналу Риенци — главе комиссии по реликвиям.",
    xpReward: 75,
    hintText: "Золотой блеск в щели мостовой...",
    scannerHint: "КРИТИЧНО: Идентификация владельца!",
  },
];

export const ROME_MISSION: HiddenClueMission = {
  id: "rome_vatican",
  title: "Тени Ватикана",
  description: "Древняя реликвия исчезла из секретного хранилища.",
  briefing: `📋 ОПЕРАЦИЯ "СВЯТОЙ ГРААЛЬ"

Дата: Сегодня, рассвет
Место: Площадь Святого Петра, Ватикан

Ковчег с мощами Святого Петра — самая ценная реликвия христианства — исчез из Секретного Архива.

Охрана ничего не видела. Камеры "случайно" отключились на 7 минут.

Ватикан не хочет огласки. Но кто-то изнутри связался с нами: "Ищите следы. Вор ещё в городе."

ВАША ЗАДАЧА:
• Осмотрите площадь — вор выходил через главные ворота
• Ищите упавшие предметы — он торопился
• Найдите связь с Opus Dei

✝️ Вера и предательство идут рука об руку.`,
  startCoordinates: [41.9029, 12.4534], // Рим - Via della Conciliazione (улица к Ватикану)
  startPanoId: "START",
  startHeading: 90,
  allowNavigation: true,
  clues: ROME_CLUES,
  requiredClues: 4,
  timeLimit: 540,
  xpReward: 380,
  speedBonusPerSecond: 0.4,
  location: "Рим, Ватикан",
  difficulty: "hard",
  icon: "🇮🇹",
  color: "#7c3aed",
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. СИДНЕЙ — Контрабанда в порту
// Гавань с отличным покрытием
// ═══════════════════════════════════════════════════════════════════════════

const SYDNEY_CLUES: HiddenClue[] = [
  {
    id: "sy_manifest",
    panoId: "START",
    revealHeading: 120,
    coneDegrees: 26,   // Было 45 → 26
    dwellTime: 2.4,    // Было 1.4 → 2.4
    name: "Судовой манифест",
    icon: "📋",
    storyContext: "Контейнер #7749: 'Текстиль.' Но вес не сходится — на 200 кг больше. Что внутри?",
    xpReward: 35,
    hintText: "Документы на ветру...",
    scannerHint: "Грузовая документация.",
  },
  {
    id: "sy_radio",
    panoId: "STEP_5-9",
    revealHeading: 200,
    coneDegrees: 22,   // Было 40 → 22
    dwellTime: 2.7,    // Было 1.7 → 2.7
    name: "Рация докеров",
    icon: "📻",
    storyContext: "Последнее сообщение: 'Груз на месте. Ждём Кобру.' Частота нестандартная — военный диапазон.",
    xpReward: 45,
    hintText: "Рация у причала...",
    scannerHint: "Радиоустройство активно!",
  },
  {
    id: "sy_gloves",
    panoId: "STEP_12-17",
    revealHeading: 330,
    coneDegrees: 19,   // Было 35 → 19
    dwellTime: 3.1,    // Было 1.9 → 3.1
    name: "Перчатки со следами",
    icon: "🧤",
    storyContext: "Белый порошок! Лабораторный тест: героин, чистота 94%. Партия на $50 миллионов.",
    xpReward: 55,
    hintText: "Перчатки у контейнера...",
    scannerHint: "ВНИМАНИЕ: Следы наркотиков!",
  },
  {
    id: "sy_photo",
    panoId: "STEP_22-28",
    revealHeading: 60,
    coneDegrees: 17,   // Было 30 → 17
    dwellTime: 3.4,    // Было 2.0 → 3.4
    name: "Фото с камеры",
    icon: "📸",
    storyContext: "Размытое лицо, но татуировка чёткая: китайский дракон. Триада. 'Кобра' — их связной в порту.",
    xpReward: 50,
    hintText: "Фотография у мусорки...",
    scannerHint: "Изображение с идентификацией.",
  },
  {
    id: "sy_key",
    panoId: "STEP_35+",
    revealHeading: 180,
    coneDegrees: 13,   // Было 22 → 13
    dwellTime: 4.2,    // Было 2.6 → 4.2
    name: "Ключ от контейнера",
    icon: "🔑",
    storyContext: "Номер 7749. Ключ с гравировкой: 'Sun Yee On' — одна из крупнейших триад мира. Доставка сегодня ночью.",
    xpReward: 70,
    hintText: "Ключ в расщелине...",
    scannerHint: "КРИТИЧНО: Ключ от контейнера!",
  },
];

export const SYDNEY_MISSION: HiddenClueMission = {
  id: "sydney_harbour",
  title: "Тени над гаванью",
  description: "Контрабанда наркотиков в порту Сиднея. Партия уже здесь.",
  briefing: `📋 ОПЕРАЦИЯ "КОБРА"

Дата: Сегодня, 04:30
Место: Порт Сиднея

Австралийская федеральная полиция получила наводку: сегодня ночью в порт прибудет крупнейшая партия героина за 10 лет.

$50 миллионов. 200 кг чистоты 94%.

Контейнер уже здесь. Но какой из тысяч?

Наш информатор: "Ищите следы. Они торопились. 'Кобра' работает на причале 7."

ВАША ЗАДАЧА:
• Найдите улики на причалах
• Идентифицируйте контейнер
• Время до рассвета — когда придут за грузом

🐍 Кобра не ждёт.`,
  startCoordinates: [-33.8599, 151.2090], // Sydney - George Street (главная улица)
  startPanoId: "START",
  startHeading: 0,
  allowNavigation: true,
  clues: SYDNEY_CLUES,
  requiredClues: 4,
  timeLimit: 600,
  xpReward: 400,
  speedBonusPerSecond: 0.5,
  location: "Сидней, Гавань",
  difficulty: "hard",
  icon: "🇦🇺",
  color: "#0ea5e9",
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. АМСТЕРДАМ — Кража из музея
// Каналы и мосты, отличное покрытие
// ═══════════════════════════════════════════════════════════════════════════

const AMSTERDAM_CLUES: HiddenClue[] = [
  {
    id: "am_frame",
    panoId: "START",
    revealHeading: 45,
    coneDegrees: 27,   // Было 45 → 27
    dwellTime: 2.3,    // Было 1.3 → 2.3
    name: "Осколок рамы",
    icon: "🖼️",
    storyContext: "Золочёное дерево XVII века. Совпадает с рамой украденного Вермеера. Картина стоит €300 миллионов.",
    xpReward: 40,
    hintText: "Золотистая щепка у моста...",
    scannerHint: "Антикварный материал.",
  },
  {
    id: "am_ticket",
    panoId: "STEP_6-10",
    revealHeading: 270,
    coneDegrees: 23,   // Было 40 → 23
    dwellTime: 2.6,    // Было 1.6 → 2.6
    name: "Билет в музей",
    icon: "🎫",
    storyContext: "Рейксмузеум, вчера, 16:47. За 13 минут до закрытия. Имя: J. van der Berg. Подставное.",
    xpReward: 35,
    hintText: "Билет на набережной...",
    scannerHint: "Входной документ.",
  },
  {
    id: "am_glove",
    panoId: "STEP_14-19",
    revealHeading: 150,
    coneDegrees: 19,   // Было 35 → 19
    dwellTime: 3.0,    // Было 1.8 → 3.0
    name: "Хирургическая перчатка",
    icon: "🧤",
    storyContext: "Латекс, без пудры. Профессионал. Внутри — волос. ДНК в базе: Марко Визер, арт-дилер из Вены.",
    xpReward: 50,
    hintText: "Белая перчатка у перил...",
    scannerHint: "Биологический образец!",
  },
  {
    id: "am_phone",
    panoId: "STEP_24-30",
    revealHeading: 330,
    coneDegrees: 16,   // Было 30 → 16
    dwellTime: 3.5,    // Было 2.0 → 3.5
    name: "Выброшенный телефон",
    icon: "📱",
    storyContext: "Burner phone. Один номер в истории: Москва, +7 495... Связь с российским олигархом?",
    xpReward: 55,
    hintText: "Телефон в канале...",
    scannerHint: "Электроника в воде!",
  },
  {
    id: "am_map",
    panoId: "STEP_38+",
    revealHeading: 90,
    coneDegrees: 12,   // Было 22 → 12 (очень сложно!)
    dwellTime: 4.5,    // Было 2.5 → 4.5
    name: "Карта маршрута побега",
    icon: "🗺️",
    storyContext: "Маршрут к частному аэродрому. Время вылета: 06:00. Направление: Москва. Осталось 2 часа!",
    xpReward: 70,
    hintText: "Карта у стены дома...",
    scannerHint: "КРИТИЧНО: План эвакуации!",
  },
];

export const AMSTERDAM_MISSION: HiddenClueMission = {
  id: "amsterdam_canals",
  title: "Ночь над каналами",
  description: "Шедевр Вермеера украден. След ведёт к русскому олигарху.",
  briefing: `📋 ОПЕРАЦИЯ "ВЕРМЕЕР"

Дата: Сегодня, 04:00
Место: Каналы Амстердама

"Девушка с жемчужной серёжкой" — шедевр Вермеера — исчез из Рейксмузеума.

Сигнализация не сработала. Охранник "ничего не видел."

Страховая стоимость: €300 миллионов. Но для коллекционера — бесценна.

Наш источник в Интерполе: "Заказчик — русский олигарх. Картина уже в пути."

ВАША ЗАДАЧА:
• Пройдите маршрут побега от музея
• Найдите следы — вор убегал к каналам
• Успейте до рассвета — или картина исчезнет навсегда

🎨 Искусство не знает границ. И преступники тоже.`,
  startCoordinates: [52.3676, 4.9041], // Amsterdam - Damrak (главная улица)
  startPanoId: "START",
  startHeading: 180,
  allowNavigation: true,
  clues: AMSTERDAM_CLUES,
  requiredClues: 4,
  timeLimit: 540,
  xpReward: 380,
  speedBonusPerSecond: 0.4,
  location: "Амстердам, Каналы",
  difficulty: "medium",
  icon: "🇳🇱",
  color: "#f97316",
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ALL MISSIONS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_HIDDEN_MISSIONS: HiddenClueMission[] = [
  TOKYO_MISSION,
  LONDON_MISSION,
  VEGAS_MISSION,
  ROME_MISSION,
  SYDNEY_MISSION,
  AMSTERDAM_MISSION,
];

export default ALL_HIDDEN_MISSIONS;
