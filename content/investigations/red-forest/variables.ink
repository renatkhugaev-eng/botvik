// ═══════════════════════════════════════════════════════════════════════════════
// КРАСНЫЙ ЛЕС — Общие переменные и функции
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ОСНОВНЫЕ ПЕРЕМЕННЫЕ
// ═══════════════════════════════════════════════════════════════════════════════

// Рассудок (0-100)
// 100-75: Нормальное состояние
// 74-50: Лёгкие галлюцинации, бессонница
// 49-25: Серьёзные видения, паранойя  
// 24-0: Грань безумия (открывается "истинное" видение)
VAR sanity = 75

// Оставшиеся дни (обратный отсчёт)
VAR days_remaining = 7

// ═══════════════════════════════════════════════════════════════════════════════
// ДОВЕРИЕ ПЕРСОНАЖЕЙ (0-100)
// ═══════════════════════════════════════════════════════════════════════════════

VAR trust_gromov = 30    // Майор Громов — начальник милиции
VAR trust_vera = 20      // Вера Холодова — психиатр
VAR trust_serafim = 50   // Отец Серафим — священник
VAR trust_tanya = 40     // Таня Зорина — дочь пропавшего
VAR trust_astahov = 0    // Полковник Астахов — КГБ

// ═══════════════════════════════════════════════════════════════════════════════
// ПРОГРЕСС РАССЛЕДОВАНИЯ
// ═══════════════════════════════════════════════════════════════════════════════

// Собранные улики (счётчик)
VAR evidence_collected = 0

// Осведомлённость о культе (0-10)
VAR cult_awareness = 0

// Текущая глава
VAR chapter = 1

// ═══════════════════════════════════════════════════════════════════════════════
// ФЛАГИ СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════════════════════

// Встречи с персонажами
VAR met_gromov = false
VAR met_vera = false
VAR met_serafim = false
VAR met_tanya = false
VAR met_astahov = false
VAR met_chernov = false
VAR met_klava = false

// Ключевые события
VAR saw_symbol = false           // Видел символ культа
VAR heard_voices = false         // Слышал голоса
VAR found_notebook = false       // Нашёл записную книжку Зорина
VAR found_photos = false         // Нашёл фотографии ритуалов
VAR entered_caves = false        // Входил в пещеры
VAR witnessed_ritual = false     // Видел ритуал
VAR confronted_cult = false      // Противостоял культу

// Отношения
VAR romantic_tanya = false       // Романтическая линия с Таней
VAR betrayed_gromov = false      // Предал Громова
VAR trusted_vera = false         // Доверился Вере

// ═══════════════════════════════════════════════════════════════════════════════
// УЛИКИ (битовые флаги)
// ═══════════════════════════════════════════════════════════════════════════════

// Категория A — Исчезновения
VAR clue_missing_list = false        // Список пропавших
VAR clue_false_reports = false       // Фальшивые отчёты
VAR clue_witness_conflict = false    // Противоречие в показаниях

// Категория B — Завод
VAR clue_echo_docs = false           // Документы проекта "Эхо"
VAR clue_experiment_records = false  // Записи экспериментов
VAR clue_underground_map = false     // Планы подземелий
VAR clue_access_pass = false         // Пропуск в закрытую зону

// Категория C — Культ
VAR clue_cult_symbol = false         // Символ культа
VAR clue_chernov_diary = false       // Дневник Чернова
VAR clue_ritual_photos = false       // Фотографии ритуалов
VAR clue_insider_testimony = false   // Показания участника

// Категория D — История
VAR clue_expedition_1890 = false     // Записи экспедиции 1890
VAR clue_serafim_legends = false     // Легенды от Серафима
VAR clue_church_symbols = false      // Древние символы в церкви

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКИ (разблокировка)
// ═══════════════════════════════════════════════════════════════════════════════

VAR ending_truth_unlocked = false      // Правда наружу
VAR ending_hero_unlocked = false       // Тихий герой
VAR ending_sacrifice_unlocked = false  // Жертва
VAR ending_rebirth_unlocked = false    // Перерождение
VAR ending_escape_unlocked = false     // Побег

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ПРОВЕРКИ
// ═══════════════════════════════════════════════════════════════════════════════

// Подсчёт собранных улик категории
=== function count_clues_a() ===
~ return (clue_missing_list + clue_false_reports + clue_witness_conflict)

=== function count_clues_b() ===
~ return (clue_echo_docs + clue_experiment_records + clue_underground_map + clue_access_pass)

=== function count_clues_c() ===
~ return (clue_cult_symbol + clue_chernov_diary + clue_ritual_photos + clue_insider_testimony)

=== function count_clues_d() ===
~ return (clue_expedition_1890 + clue_serafim_legends + clue_church_symbols)

=== function total_clues() ===
~ return count_clues_a() + count_clues_b() + count_clues_c() + count_clues_d()

// Проверка состояния рассудка
=== function is_sane() ===
~ return sanity >= 50

=== function is_disturbed() ===
~ return sanity >= 25 && sanity < 50

=== function is_mad() ===
~ return sanity < 25

// Проверка доверия
=== function gromov_trusts() ===
~ return trust_gromov >= 60

=== function vera_trusts() ===
~ return trust_vera >= 60

=== function serafim_trusts() ===
~ return trust_serafim >= 70

=== function tanya_trusts() ===
~ return trust_tanya >= 70

// ═══════════════════════════════════════════════════════════════════════════════
// ПРОВЕРКА КОНЦОВОК
// ═══════════════════════════════════════════════════════════════════════════════

=== function check_endings() ===
// Правда наружу: >= 10 улик
~ ending_truth_unlocked = (total_clues() >= 10)

// Тихий герой: cult_awareness >= 8 и sanity >= 40
~ ending_hero_unlocked = (cult_awareness >= 8 && sanity >= 40)

// Жертва: sanity < 25
~ ending_sacrifice_unlocked = (sanity < 25)

// Перерождение: trust_vera > 80
~ ending_rebirth_unlocked = (trust_vera > 80)

// Побег: trust_tanya > 70
~ ending_escape_unlocked = (trust_tanya > 70)

~ return true
