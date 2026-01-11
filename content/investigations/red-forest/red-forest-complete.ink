// ═══════════════════════════════════════════════════════════════════════════════
// КРАСНЫЙ ЛЕС — Полная история (Эпизоды 1-5)
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Профессиональная архитектура v2.0:
// - Единый файл для корректной передачи состояния
// - LIST для эффективного отслеживания улик
// - Функции для управления рассудком (с автопроверкой на безумие)
// - Исправленная логика концовок с ВЫБОРОМ
// - External functions для UI эффектов (звук, haptic, game over)
// - RANDOM() для настоящей рандомизации horror-событий
// - Tracking посещённых локаций для предотвращения бесконечных циклов
// ═══════════════════════════════════════════════════════════════════════════════

// ГЛОБАЛЬНЫЙ ПЕРЕХОД К НАЧАЛУ ИСТОРИИ (должен быть первой инструкцией)
-> start

// ═══════════════════════════════════════════════════════════════════════════════
// EXTERNAL FUNCTIONS — Объявления для связи с JavaScript
// ═══════════════════════════════════════════════════════════════════════════════
// Эти функции реализуются в ink-runtime.ts через story.BindExternalFunction()

EXTERNAL play_sound(sound_id)
EXTERNAL stop_sound(sound_id)
EXTERNAL trigger_haptic(haptic_type)
EXTERNAL show_notification(message, type)
EXTERNAL save_checkpoint(checkpoint_name)
EXTERNAL trigger_game_over(reason)

// Fallback-реализации (используются если функции не привязаны)
=== function play_sound(sound_id) ===
// Звук: {sound_id}
~ return true

=== function stop_sound(sound_id) ===
~ return true

=== function trigger_haptic(haptic_type) ===
// Haptic: {haptic_type}
~ return true

=== function show_notification(message, type) ===
~ return true

=== function save_checkpoint(checkpoint_name) ===
~ return true

=== function trigger_game_over(reason) ===
~ return true

// ═══════════════════════════════════════════════════════════════════════════════
// ТОЧКА ВХОДА — отдельный knot для старта истории
// ═══════════════════════════════════════════════════════════════════════════════
=== start ===
-> episode1_intro

// ═══════════════════════════════════════════════════════════════════════════════
// СПИСКИ (LIST) — Продвинутая система отслеживания
// ═══════════════════════════════════════════════════════════════════════════════

// Улики — эффективнее чем 14 отдельных VAR
LIST CluesA = missing_list, false_reports, witness_conflict
LIST CluesB = echo_docs, experiment_records, underground_map, access_pass
LIST CluesC = cult_symbol, chernov_diary, ritual_photos, insider_testimony
LIST CluesD = expedition_1890, serafim_legends, church_symbols

// Встречи с персонажами
LIST MetCharacters = gromov, vera, serafim, tanya, astahov, chernov, klava, fyodor

// Ключевые события
LIST KeyEvents = saw_symbol, heard_voices, found_notebook, found_photos, entered_caves, witnessed_ritual, confronted_cult, serafim_kidnapped, vera_captured, zorin_found, tanya_invited, met_klava_restaurant, fyodor_warned, fyodor_ally, found_fyodor_body, tanya_injured, gromov_killed, vera_sacrifice

// Состояние отношений
LIST Relationships = romantic_tanya, betrayed_gromov, trusted_vera, helped_serafim, trusted_fyodor, fyodor_secret

// Дополнительные улики
LIST CluesE = klava_testimony, fyodor_map, gromov_confession, vera_research, old_photos

// ═══════════════════════════════════════════════════════════════════════════════
// ОСНОВНЫЕ ПЕРЕМЕННЫЕ
// ═══════════════════════════════════════════════════════════════════════════════

// Рассудок: 100 = норма, 60 = тревожность, 40 = галлюцинации, 20 = грань безумия
// Начинаем с 75 для более заметных horror-эффектов
VAR sanity = 75

// Время: история длится 5 дней (15-19 ноября)
VAR days_remaining = 5
VAR current_day = 1

// Номер эпизода
VAR chapter = 1

// Время суток: 0=утро, 1=день, 2=вечер, 3=ночь
VAR time_of_day = 0

// Действия за день (ограничение 3)
VAR actions_today = 0

// ═══════════════════════════════════════════════════════════════════════════════
// ДОВЕРИЕ ПЕРСОНАЖЕЙ (0-100)
// ═══════════════════════════════════════════════════════════════════════════════

VAR trust_gromov = 25
VAR trust_vera = 30  // Увеличено для достижимости концовки
VAR trust_serafim = 40
VAR trust_tanya = 40  // Увеличено для достижимости концовки
VAR trust_astahov = 0
VAR trust_fyodor = 20  // Начальное доверие с Фёдором

// ═══════════════════════════════════════════════════════════════════════════════
// ФАЗА 4: ТОЧКИ НЕВОЗВРАТА
// ═══════════════════════════════════════════════════════════════════════════════

// Выбранный союзник для финала — влияет на доступные концовки
// 0=никто, 1=Таня, 2=Фёдор, 3=Серафим
VAR chosen_ally = 0

// Громов — союзник или враг (взаимоисключение)
VAR gromov_is_ally = false
VAR gromov_is_enemy = false

// Флаг ранения Тани — блокирует романтическую концовку
VAR tanya_was_injured = false

// ═══════════════════════════════════════════════════════════════════════════════
// ПРОГРЕСС
// ═══════════════════════════════════════════════════════════════════════════════

VAR evidence_collected = 0
VAR cult_awareness = 0

// Счётчик доступных концовок (используется в финале)
VAR available_endings = 0

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING ПОСЕЩЁННЫХ ЛОКАЦИЙ (предотвращение бесконечных циклов)
// ═══════════════════════════════════════════════════════════════════════════════

// Шахта — три туннеля
VAR mine_left_visited = false
VAR mine_center_visited = false
VAR mine_right_visited = false

// ═══════════════════════════════════════════════════════════════════════════════
// СЧЁТЧИКИ ПОСЕЩЕНИЙ ЛОКАЦИЙ (для stopping описаний)
// ═══════════════════════════════════════════════════════════════════════════════

VAR visits_hotel_room = 0
VAR visits_factory = 0
VAR visits_church = 0
VAR visits_archive = 0
VAR visits_forest = 0
VAR visits_caves = 0
VAR visits_police = 0
VAR visits_hospital = 0

// Счётчики для stopping-механик персонажей и объектов
VAR times_looked_in_mirror = 0
VAR times_seen_cult_symbol = 0
VAR times_talked_to_klava = 0
VAR times_heard_voices = 0
VAR times_met_tanya = 0
VAR times_sensed_door = 0
VAR times_looked_at_moon = 0

// Флаг критического состояния рассудка (для отложенной проверки)
VAR sanity_critical = false

// ═══════════════════════════════════════════════════════════════════════════════
// НОВЫЕ МЕХАНИКИ
// ═══════════════════════════════════════════════════════════════════════════════

// Стиль расследования: влияет на диалоги и доступные опции
// 0 = нейтральный, положительные = агрессивный, отрицательные = дипломатичный
VAR investigation_style = 0

// Репутация в городе: слухи распространяются
VAR city_reputation = 0  // -100 (враг) до +100 (свой)

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА РЕПУТАЦИИ — ОТСЛЕЖИВАНИЕ ЕЖЕДНЕВНЫХ СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════════════════════

// Счётчики действий за день (сбрасываются в advance_day)
VAR daily_aggressive_actions = 0    // Агрессивные допросы, угрозы
VAR daily_helpful_actions = 0       // Помощь жителям, сочувствие
VAR daily_public_breakdowns = 0     // Публичные проявления безумия
VAR daily_cult_exposure = 0         // Публичные упоминания культа

// Флаги репутационных событий (не сбрасываются)
VAR reputation_witnessed_breakdown = false  // Кто-то видел безумие
VAR reputation_helped_tanya = false         // Помог семье Тани
VAR reputation_saved_someone = false        // Спас чью-то жизнь
VAR reputation_exposed_corruption = false   // Разоблачил коррупцию
VAR reputation_attacked_innocent = false    // Напал на невиновного

// Порог для автоматического распространения слухов
CONST AGGRESSIVE_THRESHOLD = 3
CONST HELPFUL_THRESHOLD = 2
CONST BREAKDOWN_THRESHOLD = 2
CONST CULT_EXPOSURE_THRESHOLD = 3

// Воспоминания Афганистана — триггеры для flashback'ов
VAR afghan_flashbacks = 0  // счётчик просмотренных воспоминаний
LIST AfghanMemories = memory_ambush, memory_cave, memory_betrayal, memory_voices

// Тайные локации — открываются при определённых условиях
LIST SecretLocations = old_mine, abandoned_lab, hidden_archive, cult_shrine

// Комбинации улик — соединение улик даёт новую информацию
LIST ClueCombinations = combo_witnesses, combo_project, combo_cult_history, combo_victims

// Состояние NPC — живы, мертвы, союзники, враги
LIST NPCStatus = gromov_alive, vera_alive, serafim_alive, fyodor_alive, tanya_safe
// Инициализируем всех живыми
VAR npc_status = (gromov_alive, vera_alive, serafim_alive, fyodor_alive, tanya_safe)

// Слухи о следователе
LIST Rumors = rumor_dangerous, rumor_honest, rumor_crazy, rumor_cultist, rumor_hero

// Инвентарь — предметы которые можно использовать
LIST Inventory = item_flashlight, item_gun, item_notebook, item_camera, item_lockpick, item_vodka, item_medicine

// Начальный инвентарь
VAR inventory = (item_flashlight, item_gun, item_notebook)

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА РАСКРЫТИЯ ПЕРСОНАЖЕЙ (ГЛУБОКИЙ ЛОР)
// ═══════════════════════════════════════════════════════════════════════════════

// Раскрытые истории персонажей
LIST CharacterSecrets = tanya_mother_story, tanya_childhood, tanya_dreams, vera_past, vera_loss, vera_guilt, klava_husband, klava_son, klava_sacrifice, gromov_daughter, gromov_breakdown, gromov_redemption, chernov_wife, chernov_experiment, chernov_humanity, astahov_family, astahov_orders, astahov_doubt, serafim_geology, serafim_vision, fyodor_original_sin

// История культа — этапы раскрытия лора
LIST CultLore = lore_ancient_tribe, lore_first_contact, lore_expedition_1890, lore_soviet_discovery, lore_project_echo_start, lore_first_sacrifice, lore_chernov_rise, lore_door_nature, lore_entity_truth

// Древние артефакты и записи
LIST AncientArtifacts = artifact_stone_tablet, artifact_shaman_mask, artifact_bone_knife, artifact_ritual_robe, artifact_expedition_journal, artifact_original_map

// Флаги эмоциональных сцен
LIST EmotionalScenes = scene_tanya_tears, scene_vera_confession, scene_klava_breakdown, scene_gromov_drunk, scene_chernov_memory, scene_astahov_humanity

// Уровень понимания каждого персонажа (0-100)
VAR understanding_tanya = 0
VAR understanding_vera = 0
VAR understanding_klava = 0
VAR understanding_gromov = 0
VAR understanding_chernov = 0
VAR understanding_astahov = 0
VAR understanding_serafim = 0
VAR understanding_fyodor = 0

// Общий уровень раскрытия лора
VAR lore_depth = 0

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ВЕРСИЙ РАССЛЕДОВАНИЯ (RED HERRINGS / ЛОЖНЫЕ СЛЕДЫ)
// ═══════════════════════════════════════════════════════════════════════════════

// Версии, которые игрок может развивать (0-100 каждая)
// Истинная версия раскрывается только если остальные отброшены или cult_awareness > 25

VAR theory_chemical = 0      // Химическое отравление с завода
VAR theory_gromov = 0        // Громов — серийный убийца
VAR theory_serafim = 0       // Серафим — безумный сектант
VAR theory_conspiracy = 0    // Государственный заговор (правдоподобная, но неполная)
VAR theory_cult = 0          // Истинная версия — культ

// Какая версия активна в сознании игрока
VAR active_theory = 0  // 0=нет, 1=химия, 2=громов, 3=серафим, 4=заговор, 5=культ

// Сколько версий было опровергнуто
VAR theories_debunked = 0

// Флаги опровержения версий
VAR chemical_debunked = false
VAR gromov_debunked = false
VAR serafim_debunked = false

// ═══════════════════════════════════════════════════════════════════════════════
// ЛИЧНЫЕ СТАВКИ СОРОКИНА
// ═══════════════════════════════════════════════════════════════════════════════

// Связь с прошлым — один из пропавших был сослуживцем Сорокина в Афганистане
VAR knows_vanished_comrade = false
VAR comrade_name_revealed = false
VAR personal_vendetta = 0  // Личная мотивация (0-100)

// Угроза близким
VAR tanya_danger_level = 0   // 0=безопасна, 1=под наблюдением, 2=в опасности, 3=похищена
VAR vera_danger_level = 0
VAR serafim_danger_level = 0

// Заражение Сорокина — он тоже начинает видеть
VAR sorokin_infected = false
VAR infection_level = 0  // 0-100, при 100 — точка невозврата

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ДЕДЛАЙНА — ПОЛНОЛУНИЕ
// ═══════════════════════════════════════════════════════════════════════════════

// Полнолуние — 19 ноября 1986 года (через 4 дня после начала)
VAR moon_phase = 0  // 0=новолуние, 50=полумесяц, 100=полнолуние
VAR ritual_countdown = 4  // Дней до ритуала
VAR knows_deadline = false  // Знает ли игрок про дедлайн

// Почему культ не убил Сорокина — объяснение
VAR cult_needs_sorokin = false  // Культ ХОЧЕТ, чтобы он пришёл
VAR sorokin_is_catalyst = false  // Сорокин — часть ритуала

// ═══════════════════════════════════════════════════════════════════════════════
// МОРАЛЬНЫЕ ДИЛЕММЫ
// ═══════════════════════════════════════════════════════════════════════════════

LIST MoralChoices = saved_tanya_over_ritual, stopped_ritual_lost_tanya, killed_chernov, spared_chernov, revealed_truth, buried_truth, sacrificed_self, escaped_alone

// Счётчик "человечности" — влияет на финал
VAR humanity = 50  // 0=бесчеловечный, 100=гуманист

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ УПРАВЛЕНИЯ РАССУДКОМ (v2.0 — с автопроверкой и haptic)
// ═══════════════════════════════════════════════════════════════════════════════
//
// АРХИТЕКТУРА:
// 1. lose_sanity() — уменьшает рассудок и устанавливает флаг sanity_critical
// 2. after_sanity_change — tunnel для проверки после повествовательного текста
// 3. sanity_collapse — финальная концовка безумия
//
// ИСПОЛЬЗОВАНИЕ:
// ~ temp result = lose_sanity(5)
// ... текст события ...
// -> after_sanity_change ->
// ═══════════════════════════════════════════════════════════════════════════════

=== function lose_sanity(amount) ===
~ sanity = sanity - amount
{ sanity < 0:
    ~ sanity = 0
}
// Устанавливаем флаг критического состояния для отложенной проверки
{ sanity <= 0:
    ~ sanity_critical = true
}
// Haptic feedback при потере рассудка
{ amount >= 10:
    ~ trigger_haptic("heavy_impact")
- else:
    { amount >= 5:
        ~ trigger_haptic("medium_impact")
    }
}
~ return sanity

=== function gain_sanity(amount) ===
~ sanity = sanity + amount
{ sanity > 100:
    ~ sanity = 100
}
// Сбрасываем флаг критического состояния при восстановлении
{ sanity > 0:
    ~ sanity_critical = false
}
~ trigger_haptic("soft_success")
~ return sanity

// ─────────────────────────────────────────────────────────────────────────────
// TUNNEL: Проверка рассудка после события (вызывается после текста)
// Использование: -> after_sanity_change ->
// ─────────────────────────────────────────────────────────────────────────────
=== after_sanity_change ===
{ sanity_critical:
    ~ sanity_critical = false  // Сбрасываем флаг
    -> sanity_collapse
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// БЕЗОПАСНЫЕ TUNNELS ДЛЯ SANITY (v3.0)
// ═══════════════════════════════════════════════════════════════════════════════
//
// ИСПОЛЬЗОВАНИЕ:
//   -> lose_sanity_safe(5) ->    // Вместо: -> lose_sanity_safe(5) ->
//   -> gain_sanity_safe(10) ->   // Вместо: ~ gain_sanity(10)
//
// ГАРАНТИИ:
//   - Автоматическая проверка sanity_critical после изменения
//   - Автоматический divert к sanity_collapse при необходимости
//   - Безопасный возврат через ->-> если всё в порядке
// ═══════════════════════════════════════════════════════════════════════════════

=== lose_sanity_safe(amount) ===
// Безопасная потеря рассудка с автопроверкой collapse
~ temp result = lose_sanity(amount)
{ sanity_critical:
    ~ sanity_critical = false
    -> sanity_collapse
}
->->

=== gain_sanity_safe(amount) ===
// Безопасное восстановление рассудка
~ temp result = gain_sanity(amount)
->->

// ─────────────────────────────────────────────────────────────────────────────
// Мгновенная проверка (для использования в критических точках сюжета)
// ─────────────────────────────────────────────────────────────────────────────
=== check_sanity ===
{ sanity <= 0:
    -> sanity_collapse
}
->->

// ─────────────────────────────────────────────────────────────────────────────
// КОНЦОВКА: Безумие
// ─────────────────────────────────────────────────────────────────────────────
=== sanity_collapse ===

# mood: horror
# ending: madness

~ trigger_haptic("dramatic_collapse")
~ play_sound("madness_ambience")

Темнота. Абсолютная.

Голоса — везде. Они — вы. Вы — они.

«...добро пожаловать...»

Грань стёрта. Навсегда.

Вас находят утром. В лесу. С улыбкой на лице.

Диагноз: острый психоз. Необратимый.

КОНЦОВКА: БЕЗУМИЕ

-> END

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные функции проверки состояния
// ─────────────────────────────────────────────────────────────────────────────
=== function is_sane() ===
~ return sanity >= 60

=== function is_disturbed() ===
~ return sanity >= 30 && sanity < 60

=== function is_mad() ===
~ return sanity < 30

=== function get_sanity_state() ===
// Возвращает: 0=безумие, 1=на грани, 2=тревожность, 3=норма
{ sanity <= 0:
    ~ return 0
}
{ sanity < 30:
    ~ return 1
}
{ sanity < 60:
    ~ return 2
}
~ return 3

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА INFECTION — ЭТАЛОННАЯ РЕАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════════════════════
//
// Best Practice: Infection влияет на:
// 1. Внешний вид Сорокина (NPC замечают)
// 2. Доступные варианты диалогов
// 3. Реакции NPC на него
// 4. Видения и галлюцинации
// ═══════════════════════════════════════════════════════════════════════════════

=== function get_infection_state() ===
// Возвращает: 0=чист, 1=начало, 2=заметно, 3=сильное, 4=критическое, 5=потерян
{ infection_level <= 0:
    ~ return 0
}
{ infection_level < 20:
    ~ return 1
}
{ infection_level < 40:
    ~ return 2
}
{ infection_level < 60:
    ~ return 3
}
{ infection_level < 80:
    ~ return 4
}
~ return 5

=== function is_visibly_infected() ===
// NPC могут заметить заражение при уровне 40+
~ return infection_level >= 40

=== function is_severely_infected() ===
// Критическое заражение — влияет на все взаимодействия
~ return infection_level >= 70

=== function get_physical_symptoms() ===
// Физические симптомы для описания в диалогах
// 0=нет, 1=лёгкие, 2=заметные, 3=пугающие
{ infection_level < 30:
    ~ return 0
}
{ infection_level < 50:
    ~ return 1
}
{ infection_level < 70:
    ~ return 2
}
~ return 3

// ═══════════════════════════════════════════════════════════════════════════════
// NPC РЕАКЦИИ НА СОСТОЯНИЕ СОРОКИНА
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tunnel-функция: вызывается перед диалогами с ключевыми NPC
// NPC реагируют на: sanity + infection + внешний вид
// ═══════════════════════════════════════════════════════════════════════════════

=== npc_notices_sorokin_state ===
// Вызывать перед важными диалогами: -> npc_notices_sorokin_state ->

// Проверка физических симптомов заражения
{ get_physical_symptoms() == 1:
    { shuffle:
    -
        Собеседник на мгновение задерживает взгляд на ваших руках. Они дрожат? # style:thought # intensity:low
    -
        — Вы бледный какой-то сегодня. Плохо спали? # style:atmosphere # intensity:low
    -
        Вы замечаете, как собеседник чуть отодвигается. Незаметно. Инстинктивно. # style:thought # intensity:low
    }
}

{ get_physical_symptoms() == 2:
    { shuffle:
    -
        — Товарищ следователь... Вы себя хорошо чувствуете? У вас глаза... странные. # style:atmosphere # intensity:medium
    -
        Собеседник смотрит на вас с плохо скрываемым беспокойством. Или страхом? # style:thought # intensity:medium
        
        Вы чувствуете: что-то в вашем облике изменилось. Что-то, что видят другие. # style:thought # intensity:high
    -
        — Может, вам к врачу надо? Вера Сергеевна хорошая, она посмотрит... # style:atmosphere # intensity:medium
    }
    ~ trust_vera += 2 // Люди рекомендуют Веру
}

{ get_physical_symptoms() == 3:
    // РЕПУТАЦИЯ: очень заметные симптомы — люди видят и боятся
    ~ track_public_breakdown()
    
    { shuffle:
    -
        Собеседник делает шаг назад. В глазах — неприкрытый страх. # style:horror # intensity:high
        
        — Что... что с вами? # style:atmosphere # intensity:high
        
        Вы не знаете. Вы боитесь узнать. # style:thought # intensity:high
    -
        — Господи... — шёпот. Крёстное знамение. — Они уже в вас, да? Они уже внутри... # style:horror # intensity:high
        
        Вы хотите возразить. Но слова не идут. Потому что, может быть, это правда. # style:thought # intensity:high
    -
        Человек отшатывается. Его лицо — белое как мел. # style:action # intensity:high
        
        — Не подходите! Не подходите ко мне! # style:atmosphere # intensity:high
        
        Он убегает. Вы остаётесь один. # style:dramatic # intensity:high
        
        Один? Или... ОНИ — с вами? # style:horror # intensity:high
    }
    -> lose_sanity_safe(3) ->
}

// Проверка низкого рассудка
{ sanity < 40 && get_physical_symptoms() < 2:
    { shuffle:
    -
        — Вы какой-то... рассеянный. Давно не спали? # style:atmosphere # intensity:low
    -
        Собеседник замечает ваш блуждающий взгляд. Вы смотрели на что-то за его спиной. Там ничего нет. Наверное. # style:thought # intensity:medium
    }
}

{ sanity < 20:
    // РЕПУТАЦИЯ: очень низкий рассудок — люди видят безумие
    ~ track_public_breakdown()
    
    { shuffle:
    -
        Вы понимаете — они видят. Видят, что вы уже не совсем... здесь. # style:thought # intensity:high
        
        — С кем вы разговариваете? — спрашивают они. # style:atmosphere # intensity:high
        
        Вы не заметили, что шептали что-то. Шептали ИМ. # style:horror # intensity:high
    -
        Люди обходят вас стороной. Смотрят, но не приближаются. # style:atmosphere # intensity:high
        
        Вы — уже не один из них. # style:horror # intensity:high
    }
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ОПИСАНИЯ СОСТОЯНИЯ — для внутреннего монолога Сорокина
// ═══════════════════════════════════════════════════════════════════════════════

=== describe_current_state ===
// Внутренний монолог о текущем состоянии — вызывать при переходах между сценами

{ infection_level >= 20 && infection_level < 40:
    Что-то не так. Вы чувствуете это — внутри, глубоко. # style:thought # intensity:medium
    
    Головная боль, которая не проходит. Привкус меди во рту. Тени на периферии зрения. # style:atmosphere # intensity:medium
}

{ infection_level >= 40 && infection_level < 60:
    Ваши руки. Вы смотрите на них. # style:action # intensity:medium
    
    Вены — темнее, чем должны быть. Почти чёрные. Или это свет такой? # style:horror # intensity:high
    
    Нет. Не свет. ОНИ — внутри вас. Уже внутри. # style:horror # intensity:high
}

{ infection_level >= 60 && infection_level < 80:
    Граница размывается. # style:horror # intensity:high
    
    Где кончаетесь вы — и начинаются ОНИ? # style:horror # intensity:high
    
    Вы не уверены. Уже не уверены. # style:thought # intensity:high
    
    Голоса — ваши? Или их? Мысли — ваши? Или... # style:horror # intensity:high
}

{ infection_level >= 80:
    Тело — предательское, чужое — двигается само. # style:horror # intensity:high
    
    Вы — пассажир в собственной голове. # style:horror # intensity:high
    
    ОНИ ведут. ОНИ решают. ОНИ — смотрят вашими глазами. # style:horror # intensity:high
    
    И где-то — глубоко, в последнем свободном уголке сознания — вы кричите. # style:horror # intensity:high
    
    Но никто не слышит. # style:horror # intensity:high
}

// Санирующий эффект от низкого sanity
{ sanity < 30 && infection_level < 40:
    Мир — нереален. Вы — нереальны. # style:horror # intensity:high
    
    Это сон? Кошмар? Или всё это — правда, а ваша прежняя жизнь была иллюзией? # style:thought # intensity:high
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СПЕЦИФИЧЕСКИЕ РЕАКЦИИ КЛЮЧЕВЫХ NPC
// ═══════════════════════════════════════════════════════════════════════════════

=== klava_notices_infection ===
// Клава — первая, кто замечает изменения
{ infection_level >= 30 && infection_level < 50:
    Клава смотрит на вас долго. Слишком долго. # style:atmosphere # intensity:medium
    
    — Товарищ следователь... Вы кушаете плохо. Бледный совсем стали. # speaker:klava
    
    Она крестится. Незаметно, под фартуком. Но вы видите. # style:thought # intensity:medium
}
{ infection_level >= 50 && infection_level < 70:
    Клава отшатывается, когда вы входите. # style:action # intensity:high
    
    — Это... это не вы. — Её голос дрожит. — Это уже не вы, да? # speaker:klava # intensity:high
    
    Вы хотите ответить. Но она права? Вы — это ещё вы? # style:thought # intensity:high
}
{ infection_level >= 70:
    Клавы нет за стойкой. # style:atmosphere # intensity:high
    
    Записка: "Уехала. Не ищите." # style:document # intensity:high
    
    Она сбежала. От вас. От того, чем вы становитесь. # style:thought # intensity:high
}
->->

=== vera_notices_infection ===
// Вера — врач, замечает профессионально
{ infection_level >= 20 && infection_level < 40:
    Вера надевает очки. Смотрит на вас — профессионально, оценивающе. # style:atmosphere # intensity:medium
    
    — Зрачки расширены. Тремор в руках. Когда вы последний раз спали нормально? # speaker:vera
}
{ infection_level >= 40 && infection_level < 60:
    — Снимите рубашку. # speaker:vera
    
    Вы подчиняетесь. Она смотрит. Её лицо бледнеет. # style:action # intensity:high
    
    — Эти... узоры под кожей. Я такое видела только... — Она не заканчивает. # speaker:vera # intensity:high
    
    Вы смотрите вниз. Тёмные линии — как корни дерева — расходятся от груди. # style:horror # intensity:high
    
    ~ understanding_vera += 10
}
{ infection_level >= 60:
    — Поздно. — Вера отступает. В её глазах — не страх. Жалость. — Для вас — уже поздно. # speaker:vera # intensity:high
    
    — Что вы имеете в виду? # speaker:sorokin
    
    — Они в вас. Глубоко. Я не могу это вылечить. Никто не может. # speaker:vera # intensity:high
    
    ~ sorokin_infected = true
}
->->

=== tanya_notices_infection ===
// Таня — реагирует эмоционально
{ infection_level >= 30 && infection_level < 50:
    Таня берёт вашу руку. Её пальцы — тёплые. Ваши — ледяные. # style:atmosphere # intensity:medium
    
    — Виктор... Ты холодный как лёд. Что происходит? # speaker:tanya # intensity:medium
}
{ infection_level >= 50 && infection_level < 70 && Relationships ? romantic_tanya:
    — Я вижу. — Её голос дрожит. — Вижу, что с тобой что-то не так. # speaker:tanya # intensity:high
    
    Она не отпускает вашу руку. Не отступает. # style:action # intensity:high
    
    — Мне всё равно. Слышишь? Мне всё равно, что они с тобой сделали. Ты — это ты. Для меня — всегда ты. # speaker:tanya # intensity:high
    
    ~ gain_sanity(5)
    ~ trust_tanya += 10
}
{ infection_level >= 70 && Relationships ? romantic_tanya:
    Таня плачет. Молча. Слёзы текут по щекам. # style:atmosphere # intensity:high
    
    — Я не отдам тебя им. Слышишь? — Её голос — сталь. — Не отдам. # speaker:tanya # intensity:high
    
    Она целует вас. Её губы — тёплые. Живые. # style:dramatic # intensity:high
    
    И на секунду — одну секунду — голоса замолкают. # style:atmosphere # intensity:high
    
    ~ gain_sanity(10)
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ПОДСЧЁТА УЛИК (v2.0 — синхронизация с LIST)
// ═══════════════════════════════════════════════════════════════════════════════

=== function count_all_clues() ===
~ return LIST_COUNT(CluesA) + LIST_COUNT(CluesB) + LIST_COUNT(CluesC) + LIST_COUNT(CluesD) + LIST_COUNT(CluesE)

=== function has_enough_evidence() ===
~ return count_all_clues() >= 8

=== function sync_evidence_count() ===
// Синхронизирует evidence_collected с реальным количеством улик в LIST
~ evidence_collected = count_all_clues()
~ return evidence_collected

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ДОБАВЛЕНИЯ УЛИК (v2.0 — DEPRECATED, используйте прямое добавление)
// ═══════════════════════════════════════════════════════════════════════════════
//
// ПРАВИЛЬНОЕ ИСПОЛЬЗОВАНИЕ:
// { not (CluesA ? missing_list):
//     ~ CluesA += missing_list
//     ~ sync_evidence_count()
//     УЛИКА: Список пропавших найден.
// }
//
// DEPRECATED — функция оставлена для обратной совместимости
=== function add_clue(clue) ===
// ВНИМАНИЕ: Эта функция НЕ добавляет улику в LIST!
// Используйте прямое добавление: ~ CluesX += имя_улики
// Затем вызовите: ~ sync_evidence_count()
~ sync_evidence_count()
~ trigger_haptic("clue_found")
~ return true

// ═══════════════════════════════════════════════════════════════════════════════
// ПЕРЕХОД МЕЖДУ ДНЯМИ
// ═══════════════════════════════════════════════════════════════════════════════

=== function advance_day() ===
// Переход к следующему дню — вызывается в конце каждого эпизода
~ days_remaining = days_remaining - 1
~ current_day = current_day + 1
~ chapter = chapter + 1

// ИСПРАВЛЕНО v2.0: Используем sync_evidence_count() для синхронизации
~ sync_evidence_count()

// ДЕДЛАЙН: прогресс луны и обратный отсчёт
~ advance_moon()

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА РЕПУТАЦИИ: обновление в конце дня
// ═══════════════════════════════════════════════════════════════════════════════
// Сначала обновляем репутацию на основе дневных действий
~ update_daily_reputation()

// Затем сбрасываем дневные счётчики
~ reset_daily_reputation_counters()

// HORROR: сброс счётчика событий нового дня
~ reset_daily_horror()

// Сбрасываем tracking туннелей шахты для нового дня (если игрок захочет вернуться)
~ mine_left_visited = false
~ mine_center_visited = false
~ mine_right_visited = false

// External: уведомление и автосохранение
~ save_checkpoint("day_" + current_day)
~ trigger_haptic("day_transition")

~ return current_day

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ НОВЫХ МЕХАНИК
// ═══════════════════════════════════════════════════════════════════════════════

=== function change_style(amount) ===
~ investigation_style = investigation_style + amount
{ investigation_style > 50:
    ~ investigation_style = 50
}
{ investigation_style < -50:
    ~ investigation_style = -50
}
~ return investigation_style

=== function is_aggressive() ===
~ return investigation_style >= 15

=== function is_diplomatic() ===
~ return investigation_style <= -15

=== function spread_rumor(rumor) ===
// Добавляем слух в LIST и меняем репутацию
// Слух распространяется только если его ещё нет
{ not (Rumors ? rumor):
    ~ Rumors += rumor
    { rumor == rumor_dangerous:
        ~ city_reputation = city_reputation - 10
    }
    { rumor == rumor_honest:
        ~ city_reputation = city_reputation + 10
    }
    { rumor == rumor_crazy:
        ~ city_reputation = city_reputation - 15
    }
    { rumor == rumor_cultist:
        ~ city_reputation = city_reputation - 20
    }
    { rumor == rumor_hero:
        ~ city_reputation = city_reputation + 15
    }
}
~ return true

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА РЕПУТАЦИИ — ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════════

=== function track_aggressive_action() ===
// Вызывается при агрессивных действиях (допросы с угрозами, давление)
~ daily_aggressive_actions = daily_aggressive_actions + 1
~ change_style(2)
{ daily_aggressive_actions >= AGGRESSIVE_THRESHOLD:
    { not (Rumors ? rumor_dangerous):
        ~ spread_rumor(rumor_dangerous)
    }
}
~ return daily_aggressive_actions

=== function track_helpful_action() ===
// Вызывается при помощи жителям (сочувствие, реальная помощь)
~ daily_helpful_actions = daily_helpful_actions + 1
~ change_style(-2)
{ daily_helpful_actions >= HELPFUL_THRESHOLD:
    { not (Rumors ? rumor_honest):
        ~ spread_rumor(rumor_honest)
    }
}
~ return daily_helpful_actions

=== function track_public_breakdown() ===
// Вызывается при публичном проявлении безумия (галлюцинации при свидетелях)
~ daily_public_breakdowns = daily_public_breakdowns + 1
~ reputation_witnessed_breakdown = true
{ daily_public_breakdowns >= BREAKDOWN_THRESHOLD:
    { not (Rumors ? rumor_crazy):
        ~ spread_rumor(rumor_crazy)
    }
}
~ return daily_public_breakdowns

=== function track_cult_exposure() ===
// Вызывается при публичных расспросах о культе
~ daily_cult_exposure = daily_cult_exposure + 1
{ daily_cult_exposure >= CULT_EXPOSURE_THRESHOLD:
    { not (Rumors ? rumor_cultist):
        ~ spread_rumor(rumor_cultist)
    }
}
~ return daily_cult_exposure

=== function track_heroic_action() ===
// Вызывается при героических действиях (спасение жизни)
~ reputation_saved_someone = true
{ not (Rumors ? rumor_hero):
    ~ spread_rumor(rumor_hero)
}
~ return true

=== function reset_daily_reputation_counters() ===
// Сбрасывает дневные счётчики (вызывается в advance_day)
~ daily_aggressive_actions = 0
~ daily_helpful_actions = 0
~ daily_public_breakdowns = 0
~ daily_cult_exposure = 0
~ return true

=== function update_daily_reputation() ===
// Автоматическое обновление репутации в конце дня на основе стиля расследования
// Вызывается в advance_day() перед сбросом счётчиков

// Агрессивный стиль накапливает плохую репутацию
{ is_aggressive():
    ~ city_reputation = city_reputation - 3
}

// Дипломатичный стиль улучшает репутацию
{ is_diplomatic():
    ~ city_reputation = city_reputation + 3
}

// Бонус за низкий уровень заражения и высокий рассудок (выглядит нормально)
{ sanity >= 80 && infection_level <= 20:
    ~ city_reputation = city_reputation + 2
}

// Штраф за видимые симптомы заражения
{ infection_level >= 50:
    ~ city_reputation = city_reputation - 5
    { not reputation_witnessed_breakdown:
        ~ reputation_witnessed_breakdown = true
    }
}

// Штраф за низкий рассудок (странное поведение)
{ sanity <= 30:
    ~ city_reputation = city_reputation - 3
}

// Clamp репутации в пределах -100...+100
{ city_reputation > 100:
    ~ city_reputation = 100
}
{ city_reputation < -100:
    ~ city_reputation = -100
}

~ return city_reputation

=== function get_reputation_status() ===
// Возвращает числовой статус репутации для проверок
// -2 = враг, -1 = подозрительный, 0 = нейтральный, 1 = знакомый, 2 = свой
{ city_reputation <= -50:
    ~ return -2
}
{ city_reputation < -20:
    ~ return -1
}
{ city_reputation <= 20:
    ~ return 0
}
{ city_reputation < 50:
    ~ return 1
}
~ return 2

=== function is_reputation_enemy() ===
~ return city_reputation <= -50

=== function is_reputation_suspicious() ===
~ return city_reputation < -20 && city_reputation > -50

=== function is_reputation_neutral() ===
~ return city_reputation >= -20 && city_reputation <= 20

=== function is_reputation_friendly() ===
~ return city_reputation > 20 && city_reputation < 50

=== function is_reputation_trusted() ===
~ return city_reputation >= 50

=== function has_item(item) ===
~ return inventory ? item

=== function add_item(item) ===
~ inventory += item
~ return true

=== function remove_item(item) ===
~ inventory -= item
~ return true

=== function unlock_location(loc) ===
~ SecretLocations += loc
~ return true

=== function can_combine_clues(combo) ===
// Проверяем наличие нужных улик для комбинации
{ combo == combo_witnesses:
    ~ return (CluesA ? witness_conflict) && (CluesA ? false_reports)
}
{ combo == combo_project:
    ~ return (CluesB ? echo_docs) && (CluesB ? experiment_records)
}
{ combo == combo_cult_history:
    ~ return (CluesC ? cult_symbol) && (CluesD ? expedition_1890)
}
{ combo == combo_victims:
    ~ return (CluesA ? missing_list) && (CluesC ? ritual_photos)
}
~ return false

=== function combine_clues(combo) ===
~ ClueCombinations += combo
~ cult_awareness = cult_awareness + 3
~ return true

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ СИСТЕМЫ ВЕРСИЙ
// ═══════════════════════════════════════════════════════════════════════════════

=== function boost_theory(theory_type, amount) ===
// theory_type: 1=химия, 2=громов, 3=серафим, 4=заговор, 5=культ
// ВЗАИМОИСКЛЮЧЕНИЕ: усиление одной версии ослабляет другие (кроме "культ")

// Сначала увеличиваем целевую версию
{ theory_type == 1:
    ~ theory_chemical = theory_chemical + amount
    // Конкурирующие версии ослабевают
    { amount > 0:
        ~ theory_gromov = theory_gromov - amount/3
        ~ theory_serafim = theory_serafim - amount/3
    }
}
{ theory_type == 2:
    ~ theory_gromov = theory_gromov + amount
    { amount > 0:
        ~ theory_chemical = theory_chemical - amount/3
        ~ theory_serafim = theory_serafim - amount/3
    }
}
{ theory_type == 3:
    ~ theory_serafim = theory_serafim + amount
    { amount > 0:
        ~ theory_chemical = theory_chemical - amount/3
        ~ theory_gromov = theory_gromov - amount/3
    }
}
{ theory_type == 4:
    // Заговор — переходная версия к культу
    ~ theory_conspiracy = theory_conspiracy + amount
    { amount > 0:
        ~ theory_chemical = theory_chemical - amount/2
        ~ theory_gromov = theory_gromov - amount/2
        ~ theory_serafim = theory_serafim - amount/2
    }
}
{ theory_type == 5:
    // Культ — истинная версия, не ослабляет другие напрямую
    ~ theory_cult = theory_cult + amount
}

// Clamp values (не ниже 0, не выше 100)
{ theory_chemical < 0:
    ~ theory_chemical = 0
}
{ theory_gromov < 0:
    ~ theory_gromov = 0
}
{ theory_serafim < 0:
    ~ theory_serafim = 0
}
{ theory_conspiracy < 0:
    ~ theory_conspiracy = 0
}
{ theory_chemical > 100:
    ~ theory_chemical = 100
}
{ theory_gromov > 100:
    ~ theory_gromov = 100
}
{ theory_serafim > 100:
    ~ theory_serafim = 100
}
{ theory_conspiracy > 100:
    ~ theory_conspiracy = 100
}
{ theory_cult > 100:
    ~ theory_cult = 100
}
~ return true

=== function debunk_theory(theory_type) ===
{ theory_type == 1:
    ~ chemical_debunked = true
    ~ theories_debunked = theories_debunked + 1
    // ФАЗА 2: При опровержении ложной версии — укрепляется истинная
    ~ theory_cult = theory_cult + 10
}
{ theory_type == 2:
    ~ gromov_debunked = true
    ~ theories_debunked = theories_debunked + 1
    ~ theory_cult = theory_cult + 10
}
{ theory_type == 3:
    ~ serafim_debunked = true
    ~ theories_debunked = theories_debunked + 1
    ~ theory_cult = theory_cult + 10
}
~ return true

=== function get_dominant_theory() ===
// Возвращает номер доминирующей версии
{ theory_chemical >= theory_gromov && theory_chemical >= theory_serafim && theory_chemical >= theory_cult:
    ~ return 1
}
{ theory_gromov >= theory_chemical && theory_gromov >= theory_serafim && theory_gromov >= theory_cult:
    ~ return 2
}
{ theory_serafim >= theory_chemical && theory_serafim >= theory_gromov && theory_serafim >= theory_cult:
    ~ return 3
}
~ return 5

=== function update_infection(amount) ===
~ infection_level = infection_level + amount
{ infection_level < 0:
    ~ infection_level = 0
}
{ infection_level >= 30:
    ~ sorokin_infected = true
}
{ infection_level > 100:
    ~ infection_level = 100
}
~ return infection_level

=== function advance_moon() ===
// Вызывается при смене дня
~ moon_phase = moon_phase + 25
~ ritual_countdown = ritual_countdown - 1
{ ritual_countdown <= 0:
    ~ ritual_countdown = 0
}
~ return moon_phase

=== function increase_danger(who, amount) ===
// who: 1=tanya, 2=vera, 3=serafim
{ who == 1:
    ~ tanya_danger_level = tanya_danger_level + amount
}
{ who == 2:
    ~ vera_danger_level = vera_danger_level + amount
}
{ who == 3:
    ~ serafim_danger_level = serafim_danger_level + amount
}
// Clamp values
{ tanya_danger_level > 3:
    ~ tanya_danger_level = 3
}
{ vera_danger_level > 3:
    ~ vera_danger_level = 3
}
{ serafim_danger_level > 3:
    ~ serafim_danger_level = 3
}
~ return true

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА STOPPING ОПИСАНИЙ ЛОКАЦИЙ
// Каждое посещение — новое описание, отражающее изменение восприятия Сорокина
// ═══════════════════════════════════════════════════════════════════════════════

=== describe_hotel_room ===
~ visits_hotel_room = visits_hotel_room + 1
{ stopping:
    - 
        Номер двенадцать. # style:title # intensity:medium
        
        Тесная комната с высоким потолком. Кровать, тумбочка, шкаф. Окно с тяжёлыми шторами. Пахнет нафталином и пылью. # style:atmosphere
        
        Типичный советский номер. Ничего особенного. # style:thought
    -
        Номер двенадцать. Уже знакомый. # style:title # intensity:medium
        
        Странно — вы замечаете то, чего не видели раньше. Царапины на двери. Словно кто-то скрёбся изнутри. # style:atmosphere # intensity:medium
        
        Или это было всегда? # style:thought
    -
        Номер двенадцать. # style:title # intensity:high
        
        Обои... Вы могли поклясться, что они были другого цвета. И эти пятна — от сырости? Или от чего-то другого? # style:atmosphere # intensity:high
        
        Комната словно дышит. Медленно. Терпеливо. # style:horror # intensity:medium
    -
        Номер двенадцать. Ваша клетка. # style:title # intensity:high
        
        Теперь вы видите: символы. Под обоями, в щелях паркета, на изнанке штор. Они всегда были здесь. # style:horror # intensity:high
        
        Вы просто не смотрели. # style:thought # intensity:high
    -
        Номер двенадцать. # style:title # intensity:high
        
        Комната ждёт вас. Как старый друг. Или как паук — муху. # style:horror # intensity:high
        
        Стены знают ваше имя. # style:horror # intensity:high
}
->->

=== describe_factory ===
~ visits_factory = visits_factory + 1
{ stopping:
    -
        Завод «Прометей». # style:title # intensity:medium
        
        Громада из бетона и ржавого металла. Трубы выбрасывают белый дым. Запах серы и машинного масла. # style:atmosphere
        
        Обычный советский завод. Почти. # style:thought
    -
        Завод «Прометей». Снова здесь. # style:title # intensity:medium
        
        Теперь вы замечаете: охранники следят за вами. Все. Одинаковыми глазами. # style:atmosphere # intensity:high
        
        И этот гул из-под земли... Машины так не звучат. # style:horror # intensity:medium
    -
        Завод «Прометей». # style:title # intensity:high
        
        Стены помнят. Каждый эксперимент. Каждый крик. Каждую жертву. # style:horror # intensity:high
        
        Двадцать лет они кормят то, что внизу. # style:horror # intensity:high
    -
        Завод «Прометей». Чрево зверя. # style:title # intensity:high
        
        Трубы — не трубы. Артерии. Дым — не дым. Дыхание. # style:horror # intensity:high
        
        Оно знает, что вы пришли. Оно ждало. # style:horror # intensity:high
}
->->

=== describe_church ===
~ visits_church = visits_church + 1
{ stopping:
    -
        Старая церковь на окраине. # style:title # intensity:medium
        
        Деревянное здание, почерневшее от времени. Покосившийся крест. Заколоченные окна. # style:atmosphere
        
        Официально — закрыта с шестидесятых. Но внутри горит свет. # style:atmosphere # intensity:medium
    -
        Церковь. # style:title # intensity:medium
        
        Вы замечаете то, что пропустили раньше: иконы смотрят не на алтарь. Они смотрят вниз. В пол. # style:atmosphere # intensity:high
        
        Что там, под досками? # style:thought # intensity:high
    -
        Церковь. # style:title # intensity:high
        
        Ладан не может скрыть другой запах. Старый. Медный. Кровь? # style:horror # intensity:high
        
        Свечи мерцают — хотя нет сквозняка. # style:horror # intensity:medium
    -
        Церковь. Маска поверх бездны. # style:title # intensity:high
        
        Теперь вы понимаете. Серафим не молится Богу. Он сторожит. # style:horror # intensity:high
        
        Молитвы — не молитвы. Цепи. Замки. Печати. # style:horror # intensity:high
}
->->

=== describe_archive ===
~ visits_archive = visits_archive + 1
{ stopping:
    -
        Городской архив. # style:title # intensity:medium
        
        Одноэтажное здание — бывшая школа. Пыльные коридоры, стеллажи до потолка. Запах старой бумаги. # style:atmosphere
        
        Мария Фёдоровна хранит больше, чем документы. Она хранит память. # style:thought
    -
        Архив. # style:title # intensity:medium
        
        Странно — некоторые папки переставлены. Кто-то был здесь после вас? # style:atmosphere # intensity:medium
        
        Или до вас? Всегда до вас? # style:thought # intensity:high
    -
        Архив. # style:title # intensity:high
        
        Между строк проступает правда. Имена. Даты. Закономерности. # style:atmosphere # intensity:high
        
        Двести сорок семь пропавших. Все — в полнолуние. Все — слышали голоса. # style:horror # intensity:high
    -
        Архив. Кладбище правды. # style:title # intensity:high
        
        Каждая папка — могила. Каждый список — реквием. # style:horror # intensity:high
        
        Мария Фёдоровна знала. Всегда знала. Но молчала. Как и все. # style:horror # intensity:high
}
->->

=== describe_forest ===
~ visits_forest = visits_forest + 1
{ stopping:
    -
        Красный лес. # style:title # intensity:high
        
        Деревья стоят стеной. Чёрные стволы, голые ветви. Тишина — такая густая, что давит на уши. # style:atmosphere # intensity:high
        
        Даже птицы здесь не поют. # style:atmosphere # intensity:high
    -
        Красный лес. Он ждал. # style:title # intensity:high
        
        Тропинки... Вы могли поклясться — они были другими. Деревья сдвинулись? # style:horror # intensity:high
        
        Нет. Глупости. Деревья не двигаются. # style:thought # intensity:high
        
        Или?.. # style:horror # intensity:high
    -
        Красный лес. # style:title # intensity:high
        
        Голоса. Тихие. На самой грани слышимости. # style:horror # intensity:high
        
        «...идиидиидиидиидиидиди...» # style:vision # intensity:high
        
        Вы не оборачиваетесь. Нельзя оборачиваться. # style:horror # intensity:high
    -
        Красный лес. Дом. # style:title # intensity:high
        
        Нет. Не дом. Почему вы так подумали? # style:horror # intensity:high
        
        Деревья расступаются. Приглашают. Ветви — как руки. Корни — как пальцы. # style:horror # intensity:high
        
        «...добро пожаловать...» # style:vision # intensity:high
}
->->

=== describe_caves ===
~ visits_caves = visits_caves + 1
{ stopping:
    -
        Пещеры. # style:title # intensity:high
        
        Темнота. Влажный камень. Запах земли и чего-то... сладковатого. # style:atmosphere # intensity:high
        
        Фонарик выхватывает из мрака древние стены. Здесь люди были тысячи лет назад. # style:atmosphere # intensity:high
    -
        Пещеры. # style:title # intensity:high
        
        Символы на стенах — они светятся? Нет. Показалось. # style:horror # intensity:high
        
        Хотя... фонарик был выключен. Как вы их видели? # style:horror # intensity:high
    -
        Пещеры. # style:title # intensity:high
        
        Эхо неправильное. Вы говорите «привет» — возвращается «...жди...» # style:horror # intensity:high
        
        Камни помнят каждый ритуал. Каждую жертву. Каждую каплю крови. # style:horror # intensity:high
    -
        Пещеры. Преддверие. # style:title # intensity:high
        
        Дверь близко. Вы чувствуете её. Пульс в камне. Дыхание из глубины. # style:horror # intensity:high
        
        Она знает ваше имя. Она ждёт. # style:horror # intensity:high
        
        Она всегда ждала. # style:vision # intensity:high
}
->->

=== describe_police_station ===
~ visits_police = visits_police + 1
{ stopping:
    -
        Отдел милиции. # style:title # intensity:medium
        
        Серое здание. Облупившаяся краска. Дежурный за стеклом. Всё как везде. # style:atmosphere
        
        Почти. # style:thought
    -
        Отдел милиции. # style:title # intensity:medium
        
        Тишина. Слишком тихо для участка. Где задержанные? Где суета? # style:atmosphere # intensity:medium
        
        Милиционеры смотрят. Молча. Ждут. # style:atmosphere # intensity:high
    -
        Отдел милиции. # style:title # intensity:high
        
        Громов знает. Они все знают. И молчат. Двадцать лет молчат. # style:thought # intensity:high
        
        Сколько дел закрыто? Сколько «несчастных случаев»? Сколько «уехавших»? # style:thought # intensity:high
    -
        Отдел милиции. Логово. # style:title # intensity:high
        
        Не защитники — сторожа. Не закон — ритуал. # style:horror # intensity:high
        
        Каждый рапорт — ложь. Каждое дело — жертва. # style:horror # intensity:high
}
->->

=== describe_hospital ===
~ visits_hospital = visits_hospital + 1
{ stopping:
    -
        Больница №1. # style:title # intensity:medium
        
        Жёлтый кирпич. Пустые коридоры. Запах хлорки и лекарств. # style:atmosphere
        
        Психиатрическое отделение — на третьем этаже. Там работает Вера. # style:atmosphere
    -
        Больница. # style:title # intensity:medium
        
        Пациенты смотрят в стены. Бормочут. Одно и то же. # style:atmosphere # intensity:high
        
        «...красный лес... дверь... они идут...» # style:vision # intensity:high
    -
        Больница. # style:title # intensity:high
        
        Вера показывала записи. Все пациенты — с одинаковыми симптомами. Все — работали на заводе. # style:thought # intensity:high
        
        Не болезнь. Заражение. # style:horror # intensity:high
    -
        Больница. Карантин. # style:title # intensity:high
        
        Здесь не лечат. Здесь прячут. Тех, кто видел слишком много. Знал слишком много. # style:horror # intensity:high
        
        Тех, кого не смогли убить. # style:horror # intensity:high
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// ЗЕРКАЛО — Прогрессирующее искажение отражения
// Отражает изменение Сорокина под влиянием "заражения"
// ═══════════════════════════════════════════════════════════════════════════════

=== look_in_mirror ===
~ times_looked_in_mirror = times_looked_in_mirror + 1
{ stopping:
    -
        Вы смотрите в зеркало. # style:action
        
        Ваше лицо. Усталое — три дня без нормального сна. Щетина. Тени под глазами. # style:atmosphere
        
        Но — ваше. Знакомое. # style:thought
    -
        Зеркало. # style:action
        
        Что-то не так. Вы не можете понять — что именно. Черты те же. Глаза те же. # style:atmosphere # intensity:medium
        
        Но взгляд... Когда вы научились так смотреть? Холодно. Оценивающе. Как хищник. # style:thought # intensity:high
    -
        Вы избегаете зеркала. Но оно — везде. В окнах. В стёклах. В чужих глазах. # style:horror # intensity:high
        
        Отражение двигается... неправильно. На долю секунды позже. Или раньше? # style:horror # intensity:high
        
        Вы моргаете. Отражение — нет. # style:horror # intensity:high
    -
        Зеркало. # style:action
        
        Вы заставляете себя посмотреть. # style:dramatic # intensity:high
        
        Там — вы. Но глаза... Зрачки расширены. Неестественно. Чёрные, как колодцы. # style:horror # intensity:high
        
        И в глубине этой черноты — красный отсвет. Как угли. Как закат над лесом. # style:horror # intensity:high
        
        { sanity < 50:
            Отражение улыбается. # style:horror # intensity:high
            
            Вы — нет. # style:horror # intensity:high
        }
    -
        Вы больше не смотрите в зеркала. # style:thought # intensity:high
        
        Но иногда — краем глаза — вы видите: там кто-то стоит. За вашим плечом. # style:horror # intensity:high
        
        Кто-то с вашим лицом. # style:horror # intensity:high
        
        Кто-то, кто ждёт. # style:vision # intensity:high
        
        «...скоро...» # style:vision # intensity:high
        «...ты станешь нами...» # style:vision # intensity:high
        «...ты уже становишься...» # style:vision # intensity:high
}

{ times_looked_in_mirror >= 3 && sanity >= 50:
    -> lose_sanity_safe(2) ->
}
{ times_looked_in_mirror >= 4 && sanity >= 30:
    -> lose_sanity_safe(3) ->
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИМВОЛ КУЛЬТА — Прогрессирующее воздействие знака
// Три линии к центру круга — древний символ Двери
// ═══════════════════════════════════════════════════════════════════════════════

=== see_cult_symbol ===
~ times_seen_cult_symbol = times_seen_cult_symbol + 1
~ KeyEvents += saw_symbol
{ stopping:
    -
        Символ. # style:dramatic # intensity:medium
        
        Три линии, сходящиеся к центру круга. Грубо нацарапано — или нарисовано кровью? # style:atmosphere # intensity:medium
        
        Странный знак. Вы делаете пометку в блокноте. # style:action
        
        ~ cult_awareness = cult_awareness + 1
    -
        Снова этот символ. # style:dramatic # intensity:high
        
        На стене. На заборе. На обрывке газеты. # style:atmosphere # intensity:medium
        
        Совпадение? В этом городе слишком много совпадений. # style:thought # intensity:high
        
        ~ cult_awareness = cult_awareness + 2
    -
        Символ. Везде символ. # style:horror # intensity:high
        
        На дверях. На окнах. На спинах прохожих — нет, показалось. # style:horror # intensity:high
        
        Или не показалось? # style:thought # intensity:high
        
        Вы закрываете глаза — и видите его на изнанке век. Красным по чёрному. # style:horror # intensity:high
        
        ~ cult_awareness = cult_awareness + 3
        -> lose_sanity_safe(2) ->
    -
        Вы больше не ищете символ. # style:thought # intensity:high
        
        Он находит вас сам. # style:horror # intensity:high
        
        В трещинах на асфальте. В узорах инея на стекле. В расположении звёзд. # style:horror # intensity:high
        
        Три линии. Центр круга. Дверь. # style:horror # intensity:high
        
        «...ты видишь...» # style:vision # intensity:high
        «...теперь ты видишь...» # style:vision # intensity:high
        
        ~ cult_awareness = cult_awareness + 5
        -> lose_sanity_safe(3) ->
    -
        Символ — это не знак. # style:horror # intensity:high
        
        Это карта. # style:horror # intensity:high
        
        Три линии — три пути. К Двери. К тому, что за ней. # style:horror # intensity:high
        
        Вы понимаете это теперь. Не головой — чем-то глубже. Старше. # style:horror # intensity:high
        
        Чем-то, что просыпается внутри вас. # style:horror # intensity:high
        
        «...добро пожаловать домой...» # style:vision # intensity:high
        
        ~ infection_level = infection_level + 5
        -> lose_sanity_safe(5) ->
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// КЛАВА — Эволюция персонажа через повторные встречи
// От радушной хозяйки до сломленного свидетеля
// ═══════════════════════════════════════════════════════════════════════════════

=== greet_klava ===
~ times_talked_to_klava = times_talked_to_klava + 1

// ЭТАЛОН: Клава замечает заражение
-> klava_notices_infection ->

{ stopping:
    -
        Клава за стойкой. Как всегда — бодрая, энергичная. # style:atmosphere

        — А, товарищ следователь! Как спалось? Завтрак готов — борщ, котлеты, компот. Всё свежее! # speaker:klava

        Она улыбается. Искренне. Почти. # style:thought
    -
        Клава поднимает голову от журнала. Улыбка — но глаза настороженные. # style:atmosphere # intensity:medium

        — Вы рано сегодня. Или поздно? Я уже не слежу. # speaker:klava

        Она отводит взгляд. Возвращается к записям. # style:action
        
        — Завтрак на столе. Если что нужно — зовите. # speaker:klava
    -
        Клава вздрагивает, когда вы входите. # style:action # intensity:medium
        
        — А... Это вы. # speaker:klava
        
        Её руки дрожат. Она прячет их под стойку. # style:atmosphere # intensity:high
        
        — Товарищ Сорокин... Может, вам уехать? Пока... пока можно? # speaker:klava # intensity:high
        
        Она не смотрит вам в глаза. Смотрит в окно. На лес. # style:atmosphere # intensity:high
    -
        Клава бледная. Круги под глазами — она тоже не спит. # style:atmosphere # intensity:high
        
        — Они приходили. — Её голос — шёпот. — Ночью. Спрашивали про вас. # speaker:klava # intensity:high
        
        — Кто? # speaker:sorokin
        
        — Не знаю. Не видела лиц. Только... только голоса. Из темноты. # speaker:klava # intensity:high
        
        Она крестится. Руки трясутся. # style:action # intensity:high
        
        — Уезжайте. Богом прошу. Пока они не пришли за вами. Как пришли за моим Колей. За Петенькой. # speaker:klava # intensity:high
        
        ~ understanding_klava += 10
    -
        Клава сидит неподвижно. Смотрит в стену. # style:atmosphere # intensity:high
        
        — Клавдия Петровна? # speaker:sorokin
        
        Молчание. Долгое. # style:dramatic # intensity:high
        
        Потом — медленно — она поворачивает голову. # style:action # intensity:high
        
        Её глаза — пустые. Как у рыбы на прилавке. # style:horror # intensity:high
        
        — Они сказали... передать... # speaker:klava # intensity:high
        
        Голос — не её. Низкий. Многослойный. Как будто говорят несколько человек сразу. # style:horror # intensity:high
        
        — ...мы ждём тебя, Виктор... # speaker:klava # intensity:high
        — ...в красном лесу... # speaker:klava # intensity:high
        — ...дверь открыта... # speaker:klava # intensity:high
        
        Клава моргает. Трясёт головой. # style:action
        
        — Что? Простите, я... Задремала, наверное. Что вы сказали? # speaker:klava
        
        Она не помнит. Но вы — запомните. # style:thought # intensity:high
        
        -> lose_sanity_safe(5) ->
    -
        Клавы нет за стойкой. # style:atmosphere # intensity:high
        
        Записка на столе: "Уехала к сестре в Свердловск. Ключ под ковриком." # style:document
        
        Но вы знаете — у неё нет сестры в Свердловске. # style:thought # intensity:high
        
        Вы знаете, куда она ушла. # style:horror # intensity:high
        
        В лес. Как её муж. Как её сын. # style:horror # intensity:high
        
        Как все они. # style:horror # intensity:high
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// STOPPING: ГОЛОСА В ГОЛОВЕ — прогрессия заражения Сорокина
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Голоса — ключевой симптом влияния Двери. Каждый раз, когда Сорокин слышит их,
// описание усиливается — от едва уловимого шёпота до полноценного контакта
// с тем, что живёт по ту сторону.
//
// Лор: Голоса — это проекции СУЩНОСТИ, просачивающейся через Дверь.
// Они используют знакомые голоса, чтобы завоевать доверие жертвы.
// На поздних стадиях жертва не может отличить свои мысли от их.
// ═══════════════════════════════════════════════════════════════════════════════

=== hear_the_voices ===
~ times_heard_voices = times_heard_voices + 1
{ stopping:
    -
        // СТАДИЯ 1: Первый контакт — едва заметно
        «...» # style:whisper # intensity:low
        
        Что это? Вы останавливаетесь. Прислушиваетесь. # style:action
        
        Тишина. Ветер в ветвях? Скрип половиц? # style:atmosphere
        
        Нет. Что-то другое. На самой грани слуха — как будто кто-то позвал вас. Издалека. # style:thought # intensity:medium
        
        Показалось. Наверняка показалось. # style:thought
        
        ~ infection_level = infection_level + 1
    -
        // СТАДИЯ 2: Голоса становятся отчётливее
        Шёпот. # style:whisper # intensity:medium
        
        Тихий. Неразборчивый. Но — определённо — голоса. Несколько. # style:atmosphere # intensity:medium
        
        Вы оглядываетесь. Никого. # style:action
        
        «...идёт...» # style:whisper # intensity:medium
        «...он идёт...» # style:whisper # intensity:medium
        
        Кто говорит? Откуда? # style:thought # intensity:high
        
        Вы проверяете пульс. Нормальный. Зрение — чёткое. Контузия давно прошла. # style:thought
        
        Тогда почему вы слышите голоса мёртвых товарищей? # style:thought # intensity:high
        
        ~ infection_level = infection_level + 2
        ~ afghan_flashbacks = afghan_flashbacks + 1
        -> lose_sanity_safe(2) ->
    -
        // СТАДИЯ 3: Голоса называют имя
        «Виктор...» # style:whisper # intensity:high
        
        Ваше имя. Отчётливо. # style:horror # intensity:high
        
        Вы замираете. Рука — на кобуре. Инстинкт. # style:action
        
        «...Виктор Михайлович...» # style:whisper # intensity:high
        «...мы знаем тебя...» # style:whisper # intensity:high
        «...давно знаем...» # style:whisper # intensity:high
        
        Голоса — отовсюду. Из стен. Из-под земли. Изнутри вашей головы. # style:horror # intensity:high
        
        Это не галлюцинация. Вы уверены. Это — контакт. # style:thought # intensity:high
        
        ОНИ — видят вас. ОНИ — знают вас. # style:horror # intensity:high
        
        { AfghanMemories ? memory_voices:
            Как тогда, в госпитале. После контузии. Голоса мёртвых. # style:flashback # intensity:high
            Только теперь — это не галлюцинация. Теперь — это ПРАВДА. # style:thought # intensity:high
        }
        
        ~ infection_level = infection_level + 5
        ~ cult_awareness = cult_awareness + 2
        -> lose_sanity_safe(5) ->
    -
        // СТАДИЯ 4: Голоса становятся хором — десятки, сотни
        Хор. # style:horror # intensity:high
        
        Десятки голосов. Сотни. Мужские, женские, детские — все сразу. # style:horror # intensity:high
        
        Все — ваши. # style:horror # intensity:high
        
        «...мы ждали...» # style:vision # intensity:high
        «...так долго ждали...» # style:vision # intensity:high
        «...двести сорок семь...» # style:vision # intensity:high
        «...и ты...» # style:vision # intensity:high
        «...двести сорок восьмой...» # style:vision # intensity:high
        
        Вы понимаете: это голоса пропавших. Всех, кто исчез в Красном лесу за сто лет. # style:thought # intensity:high
        
        Они не мертвы. # style:horror # intensity:high
        Они — ТАМ. # style:horror # intensity:high
        И они зовут вас присоединиться. # style:horror # intensity:high
        
        ~ infection_level = infection_level + 8
        ~ cult_awareness = cult_awareness + 5
        ~ lore_depth = lore_depth + 3
        -> lose_sanity_safe(8) ->
    -
        // СТАДИЯ 5: Голоса говорят ВАШИМ голосом
        «Ты готов.» # style:vision # intensity:high
        
        Это ваш голос. Вы слышите свой голос — изнутри. # style:horror # intensity:high
        
        Но слова — не ваши. Мысли — не ваши. # style:horror # intensity:high
        
        «Ты всегда был одним из нас.» # style:vision # intensity:high
        «С Афганистана. С госпиталя. С того момента, когда ты заглянул за грань.» # style:vision # intensity:high
        «Мы ждали, пока ты вернёшься.» # style:vision # intensity:high
        «Красный лес — это дом.» # style:vision # intensity:high
        «Дверь — это свобода.» # style:vision # intensity:high
        
        Вы хватаетесь за голову. Пытаетесь заглушить. Не можете. # style:action # intensity:high
        
        «Не сопротивляйся. Это бессмысленно.» # style:vision # intensity:high
        «Ты уже почти наш.» # style:vision # intensity:high
        
        { sanity < 30:
            И где-то глубоко внутри... вы понимаете, что они правы. # style:horror # intensity:high
            
            Вы ХОТИТЕ открыть Дверь. # style:horror # intensity:high
            
            ~ sorokin_infected = true
        }
        
        ~ infection_level = infection_level + 12
        ~ cult_awareness = cult_awareness + 8
        -> lose_sanity_safe(12) ->
    -
        // СТАДИЯ 6 (финальная): Голоса и вы — одно целое
        Тишина. # style:dramatic # intensity:high
        
        Впервые за долгое время — абсолютная тишина в голове. # style:atmosphere # intensity:high
        
        Вы понимаете — не потому, что голоса замолчали. # style:thought # intensity:high
        
        А потому, что вы больше не можете отличить их от своих мыслей. # style:horror # intensity:high
        
        Где заканчиваетесь вы — и начинаются они? # style:horror # intensity:high
        
        Граница стёрлась. # style:horror # intensity:high
        
        Вы — Виктор Сорокин. # style:thought # intensity:high
        Вы — тысяча голосов. # style:horror # intensity:high
        Вы — Дверь. # style:horror # intensity:high
        
        «...добро пожаловать домой...» # style:vision # intensity:high
        
        Это не они говорят. Это ВЫ говорите. # style:horror # intensity:high
        
        Теперь — это одно и то же. # style:horror # intensity:high
        
        ~ sorokin_infected = true
        ~ infection_level = 100
        -> lose_sanity_safe(20) ->
}

// Дополнительные эффекты в зависимости от контекста
{ times_heard_voices >= 3:
    { current_location == 1: // В лесу — голоса сильнее
        Здесь, в лесу, они громче. Ближе. Настойчивее. # style:horror # intensity:medium
    }
    { current_location == 2: // В пещерах — эхо умножает их
        В пещерах голоса отражаются от стен. Множатся. Десятки превращаются в тысячи. # style:horror # intensity:high
    }
    { time_of_day == 3: // Ночью — защита слабее
        Ночью сложнее сопротивляться. Усталость. Темнота. Границы размываются. # style:thought # intensity:medium
    }
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// STOPPING: ТАНЯ ЗОРИНА — прогрессия отношений
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Таня — ключевой персонаж, дочь пропавшего инженера Зорина.
// Каждая встреча углубляет связь между ней и Сорокиным.
// От профессиональной дистанции — к глубокой эмоциональной связи.
//
// Лор: Таня — единственный человек, который верит в живого отца.
// Она выросла в тени завода, без матери, с отцом-трудоголиком.
// Её мечта — самолёты, небо, свобода. Но она застряла здесь.
// Сорокин — первый, кто видит в ней не "дочь пропавшего", а человека.
// ═══════════════════════════════════════════════════════════════════════════════

=== see_tanya ===
~ times_met_tanya = times_met_tanya + 1
{ stopping:
    -
        // СТАДИЯ 1: Первая встреча — формальность, настороженность
        Таня Зорина. # style:title # intensity:medium
        
        Двадцать три года — но выглядит старше. Усталость в каждой черте. # style:atmosphere
        
        Рыжие волосы — собраны небрежно, словно ей давно всё равно. Зелёные глаза — яркие, живые, несмотря на тени под ними. # style:atmosphere # intensity:medium
        
        Она смотрит на вас оценивающе. Холодно. # style:thought
        
        Ещё один следователь. Ещё одна пустая формальность. Вы читаете это в её взгляде. # style:thought # intensity:medium
        
        ~ understanding_tanya += 5
    -
        // СТАДИЯ 2: Вторая встреча — проблеск доверия
        Таня. # style:action
        
        Что-то изменилось. В её взгляде — меньше холода. Больше... надежды? # style:thought # intensity:medium
        
        Она собрала волосы аккуратнее. Надела чистую блузку. Мелочи — но вы замечаете. # style:atmosphere
        
        — Вы вернулись. — Удивление в голосе. — Другие не возвращались. # speaker:tanya
        
        Она открывается — чуть-чуть. Как цветок после долгой зимы. # style:thought # intensity:medium
        
        ~ trust_tanya += 3
        ~ understanding_tanya += 5
    -
        // СТАДИЯ 3: Третья встреча — эмоциональная связь
        Таня. # style:dramatic # intensity:medium
        
        Её лицо светлеет, когда она видит вас. Мгновенно. Непроизвольно. # style:atmosphere # intensity:high
        
        Она этого не скрывает. Или не может скрыть. # style:thought
        
        Веснушки на её щеках — вы раньше не замечали. Или замечали, но не думали об этом. # style:thought # intensity:medium
        
        Почему сейчас думаете? # style:thought # intensity:high
        
        — Виктор Андреевич. — Её голос теплее. — Я рада, что вы пришли. # speaker:tanya
        
        Вы ловите себя на мысли: вам тоже приятно её видеть. # style:thought # intensity:high
        
        ~ trust_tanya += 5
        ~ understanding_tanya += 10
        ~ gain_sanity(2)
    -
        // СТАДИЯ 4: Четвёртая встреча — забота, беспокойство
        Таня. # style:dramatic # intensity:high
        
        Она смотрит на вас — и хмурится. # style:action
        
        — Вы не спите. — Не вопрос. Утверждение. — Круги под глазами. Руки дрожат. Сколько часов? # speaker:tanya # intensity:medium
        
        Она касается вашей руки. Мимолётно. Проверяя — живой ли. # style:atmosphere # intensity:high
        
        — Я в порядке. # speaker:sorokin
        
        — Нет. — Её глаза — зелёные, глубокие — не отпускают ваш взгляд. — Но я понимаю. Вы делаете то, что должны. Как папа. # speaker:tanya # intensity:high
        
        Она не убирает руку. Вы не отстраняетесь. # style:action # intensity:high
        
        ~ trust_tanya += 5
        ~ understanding_tanya += 10
        ~ gain_sanity(3)
    -
        // СТАДИЯ 5: Пятая встреча — романтическое напряжение
        Таня. # style:dramatic # intensity:high
        
        Время замедляется. # style:atmosphere # intensity:high
        
        Вы видите её — словно впервые. И одновременно — как будто знали всегда. # style:thought # intensity:high
        
        Рыжие волосы — медные в свете лампы. Веснушки — созвездия на бледной коже. Глаза — зелёные, как весенняя листва. Как надежда. # style:atmosphere # intensity:high
        
        — Виктор. — Она впервые без отчества. Просто — Виктор. # speaker:tanya # intensity:high
        
        Её голос — тихий. Интимный. Только для вас. # style:thought # intensity:high
        
        Вы понимаете: между вами что-то есть. Что-то, чего не было в начале. Что выросло из страха, из надежды, из общих бессонных ночей. # style:thought # intensity:high
        
        Это неправильно? Посреди расследования, посреди ужаса? # style:thought # intensity:high
        
        Или — наоборот — это единственное правильное в этом безумии? # style:thought # intensity:high
        
        { not (Relationships ? romantic_tanya) && trust_tanya >= 60:
            ~ Relationships += romantic_tanya
        }
        
        ~ trust_tanya += 8
        ~ understanding_tanya += 15
        ~ gain_sanity(5)
    -
        // СТАДИЯ 6: Шестая встреча — глубокая связь, любовь
        Таня. # style:dramatic # intensity:high
        
        Одно слово. Одно имя. # style:thought # intensity:high
        
        Но в нём — всё. # style:thought # intensity:high
        
        Она не говорит. Просто подходит. Обнимает. Крепко. Молча. # style:action # intensity:high
        
        Вы чувствуете её дыхание. Её сердцебиение — быстрое, как у испуганной птицы. # style:atmosphere # intensity:high
        
        — Я боюсь за тебя, — шепчет она. — Каждую ночь. Каждый час. # speaker:tanya # intensity:high
        
        — Я вернусь. — Вы не знаете, правда ли это. Но говорите. — Обещаю. # speaker:sorokin # intensity:high
        
        Она поднимает лицо. Её глаза — влажные. Но не от слёз. От чего-то глубже. # style:atmosphere # intensity:high
        
        — Я знаю, — говорит она. — Я верю тебе. Как никому раньше. # speaker:tanya # intensity:high
        
        { Relationships ? romantic_tanya:
            И вы понимаете: что бы ни случилось в пещерах, в лесу, у Двери — вы будете бороться. За неё. За вас обоих. # style:thought # intensity:high
            
            Любовь — странная вещь. Она нашла вас в самом тёмном месте. # style:thought # intensity:high
            
            ~ gain_sanity(8)
        }
        
        ~ trust_tanya += 10
        ~ understanding_tanya += 20
    -
        // СТАДИЯ 7 (финальная): После всего — вы и она
        Таня. # style:dramatic # intensity:high
        
        Вам не нужны слова. # style:thought # intensity:high
        
        Вы прошли через ад вместе. Видели то, что не должен видеть человек. Потеряли — и нашли. # style:thought # intensity:high
        
        Она знает вас. Вы знаете её. Полностью. Без масок. # style:thought # intensity:high
        
        Её рука — в вашей. Тёплая. Живая. Настоящая. # style:atmosphere # intensity:high
        
        Это — якорь. Это — то, что держит вас в реальности, когда голоса зовут, когда Дверь манит. # style:thought # intensity:high
        
        — Что бы ни случилось, — говорит она, — мы вместе. # speaker:tanya # intensity:high
        
        — Вместе, — повторяете вы. # speaker:sorokin # intensity:high
        
        И впервые за долгое время — верите в это. # style:thought # intensity:high
        
        ~ gain_sanity(10)
}

// ЭТАЛОН: Таня замечает заражение — реагирует эмоционально
{ times_met_tanya >= 2:
    -> tanya_notices_infection ->
}

// Дополнительные реакции в зависимости от контекста
{ times_met_tanya >= 3:
    { tanya_danger_level >= 2:
        Но сейчас — страх за неё. Они знают о ней. Следят. # style:thought # intensity:high
        Вы не можете её потерять. Не можете. # style:thought # intensity:high
    }
    { sanity < 40:
        Она — единственное светлое пятно в этом кошмаре. # style:thought # intensity:medium
        Держитесь за неё. Не отпускайте. # style:thought # intensity:high
    }
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// STOPPING: ДВЕРЬ — прогрессия ощущения межпространственного разрыва
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Дверь — центральный артефакт истории. Разрыв между мирами.
// Открыта древним племенем Кра-Сыл тысячи лет назад.
// Советские учёные нашли её в 1950-х. Проект "Эхо" — попытка контакта.
// Сущность ждёт по ту сторону. Жертвы — топливо для открытия.
//
// Лор: Дверь — не физический объект. Это состояние пространства.
// Она существует везде — где достаточно крови, боли, безумия.
// В полнолуние гравитационные силы истончают барьер.
// Тот, кто чувствует Дверь — уже частично по ту сторону.
// ═══════════════════════════════════════════════════════════════════════════════

=== sense_the_door ===
~ times_sensed_door = times_sensed_door + 1
{ stopping:
    -
        // СТАДИЯ 1: Первое ощущение — что-то не так с пространством
        Что-то... # style:thought # intensity:medium
        
        Вы останавливаетесь. Прислушиваетесь — но не к звукам. К чему-то другому. # style:action
        
        Воздух — плотнее. Как будто атмосфера сгустилась. Как перед грозой, но без грозы. # style:atmosphere # intensity:medium
        
        Стены — ближе? Потолок — ниже? Вы точно помните, что комната была больше. # style:thought # intensity:medium
        
        Показалось. Наверняка показалось. # style:thought
        
        ~ cult_awareness += 1
    -
        // СТАДИЯ 2: Ощущение границы — тонкой плёнки между мирами
        Граница. # style:dramatic # intensity:medium
        
        Вы чувствуете её. Здесь. Рядом. # style:thought # intensity:high
        
        Как будто реальность — тонкая ткань, и где-то рядом — прореха. Место, где ткань истончилась до прозрачности. # style:atmosphere # intensity:high
        
        Вы протягиваете руку. Машинально. Касаетесь стены. # style:action
        
        Холод. Неправильный холод. Не температура — что-то глубже. Как будто стена — тоньше, чем должна быть. # style:horror # intensity:high
        
        «...здесь...» — шёпот? Или мысль? # style:whisper # intensity:medium
        
        ~ cult_awareness += 2
        ~ infection_level += 2
        -> lose_sanity_safe(2) ->
    -
        // СТАДИЯ 3: Видение Двери — проблеск
        Вспышка. # style:horror # intensity:high # effect:glitch
        
        На долю секунды — вы ВИДИТЕ. # style:horror # intensity:high
        
        Дверь. # style:horror # intensity:high
        
        Не деревянная. Не металлическая. Дверь из НИЧЕГО. Прямоугольник абсолютной тьмы посреди реальности. # style:horror # intensity:high
        
        По её краям — красное свечение. Как угли. Как закат над лесом. # style:horror # intensity:high
        
        Она пульсирует. Дышит. ЖИВАЯ. # style:horror # intensity:high
        
        Вы моргаете — и Двери нет. Только стена. Только обои. Только нормальность. # style:atmosphere # intensity:medium
        
        Но вы знаете: она была там. И она — везде. # style:thought # intensity:high
        
        { not (CultLore ? lore_door_nature):
            ~ CultLore += lore_door_nature
        }
        ~ cult_awareness += 4
        ~ infection_level += 4
        -> lose_sanity_safe(5) ->
    -
        // СТАДИЯ 4: Зов Двери — она хочет вас
        Зов. # style:dramatic # intensity:high
        
        Вы чувствуете его. В груди. В голове. В костях. # style:horror # intensity:high
        
        Дверь — зовёт. # style:horror # intensity:high
        
        Не словами. Не голосом. Притяжением. Как магнит тянет железо. Как бездна тянет того, кто стоит на краю. # style:atmosphere # intensity:high
        
        «...приди...» # style:vision # intensity:high
        «...открой...» # style:vision # intensity:high
        «...освободи...» # style:vision # intensity:high
        
        Ваши ноги двигаются сами. Шаг. Ещё шаг. К чему? Куда? # style:action # intensity:high
        
        Вы останавливаетесь. Усилием воли. Кулаки сжаты так, что ногти впиваются в ладони. # style:action # intensity:high
        
        Дверь — ждёт. Терпеливо. У неё — вечность. # style:horror # intensity:high
        
        ~ cult_awareness += 5
        ~ infection_level += 6
        -> lose_sanity_safe(7) ->
    -
        // СТАДИЯ 5: Пульс Двери — вы связаны
        Пульс. # style:horror # intensity:high # effect:shake
        
        Вы чувствуете его. Синхронно с вашим сердцем. # style:horror # intensity:high
        
        Дверь дышит — вы дышите. Дверь пульсирует — ваше сердце бьётся в такт. # style:horror # intensity:high
        
        Вы — часть её. Она — часть вас. # style:horror # intensity:high
        
        «...мы одно...» # style:vision # intensity:high
        «...ты — ключ...» # style:vision # intensity:high
        «...ты — замок...» # style:vision # intensity:high
        «...ты — дверь...» # style:vision # intensity:high
        
        Границы размываются. Где заканчивается Сорокин — и начинается Дверь? # style:thought # intensity:high
        
        { sanity < 40:
            Вы больше не уверены. Может, границы никогда не было. # style:horror # intensity:high
            
            Может, вы всегда были здесь. По ту сторону. # style:horror # intensity:high
        }
        
        ~ sorokin_infected = true
        ~ cult_awareness += 7
        ~ infection_level += 10
        -> lose_sanity_safe(10) ->
    -
        // СТАДИЯ 6: Дверь открывается — вы видите ТУ СТОРОНУ
        Открытие. # style:horror # intensity:high # effect:glitch
        
        Дверь — перед вами. Всегда была. Везде была. # style:horror # intensity:high
        
        И она — открывается. # style:horror # intensity:high # effect:shake
        
        Медленно. Скрип — не звук. Ощущение. Реальность ТРЕСКАЕТСЯ. # style:horror # intensity:high
        
        За Дверью — # style:dramatic # intensity:high
        
        Темнота. Но не пустая. НАСЕЛЁННАЯ. # style:horror # intensity:high
        
        Глаза. Тысячи глаз. Миллионы. Все — смотрят на вас. # style:horror # intensity:high
        
        И в центре — ОНО. # style:horror # intensity:high
        
        Форма без формы. Тело без тела. ПРИСУТСТВИЕ. # style:horror # intensity:high
        
        Оно — улыбается. Вы не видите улыбки — ЧУВСТВУЕТЕ. # style:horror # intensity:high
        
        «...наконец...» # style:vision # intensity:high
        «...мы ждали так долго...» # style:vision # intensity:high
        «...добро пожаловать домой, Виктор...» # style:vision # intensity:high
        
        { not (CultLore ? lore_entity_truth):
            ~ CultLore += lore_entity_truth
        }
        ~ infection_level = 100
        ~ cult_awareness += 10
        -> lose_sanity_safe(15) ->
    -
        // СТАДИЯ 7 (финальная): Вы и Дверь — одно
        ... # style:dramatic # intensity:high
        
        Тишина. # style:atmosphere # intensity:high
        
        Вы больше не чувствуете Дверь. # style:thought # intensity:high
        
        Потому что вы — и есть Дверь. # style:horror # intensity:high
        
        Граница между вами и ТЕМ, что по ту сторону — исчезла. Растворилась. Никогда не существовала. # style:horror # intensity:high
        
        Вы — здесь. # style:thought # intensity:high
        Вы — там. # style:horror # intensity:high
        Вы — проход между мирами. # style:horror # intensity:high
        
        «Открой нас», — говорит голос. Ваш голос. ИХ голос. Один голос. # style:vision # intensity:high
        
        «Впусти нас в мир». # style:vision # intensity:high
        
        И где-то — далеко — в остатках того, кто был Виктором Сорокиным — # style:thought # intensity:high
        
        Выбор. # style:dramatic # intensity:high
        
        Последний выбор. # style:dramatic # intensity:high
}

// Контекстные эффекты
{ times_sensed_door >= 3:
    { current_location == 2: // В пещерах — Дверь ближе всего
        Здесь — эпицентр. Здесь Дверь тоньше всего. # style:horror # intensity:high
        Вы чувствуете: ещё шаг — и провалитесь. # style:horror # intensity:high
    }
    { days_remaining <= 1: // Полнолуние близко
        Полнолуние. Барьер истончается. Дверь приоткрывается. # style:horror # intensity:high
        Времени нет. # style:horror # intensity:high
    }
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// STOPPING: ЛУНА — обратный отсчёт до полнолуния
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Луна — визуальный дедлайн истории. Каждую ночь она растёт.
// К полнолунию 19 ноября — Дверь откроется полностью.
// Культ готовится. Время — главный враг Сорокина.
//
// Лор: Древние племена знали — луна связана с Дверью.
// Гравитационное воздействие? Или что-то более древнее?
// В полнолуние барьер между мирами тоньше всего.
// НЕЧТО просачивается. Голоса сильнее. Видения ярче.
// ═══════════════════════════════════════════════════════════════════════════════

=== look_at_moon ===
~ times_looked_at_moon = times_looked_at_moon + 1
{ stopping:
    -
        // НОЧЬ 1: Тонкий серп — начало
        Луна. # style:atmosphere # intensity:low
        
        Тонкий серп над верхушками сосен. Едва заметный в ночном небе. # style:atmosphere
        
        Обычная луна. Ничего особенного. # style:thought
        
        Но что-то... Вы не можете отвести взгляд. Как будто она — смотрит на вас. # style:thought # intensity:medium
        
        Глупости. Луна не может смотреть. # style:thought
        
        Или может? # style:thought # intensity:medium
        
        ~ knows_deadline = true
    -
        // НОЧЬ 2: Растущая луна — предчувствие
        Луна растёт. # style:atmosphere # intensity:medium
        
        Уже почти половина. Желтоватая, с оранжевым оттенком. Как старая кость. # style:atmosphere # intensity:medium
        
        Вы смотрите на неё — и чувствуете... обратный отсчёт. # style:thought # intensity:medium
        
        Как будто где-то тикают невидимые часы. Как будто время — утекает. # style:thought # intensity:high
        
        { ritual_countdown >= 3:
            Три дня. Три дня до полнолуния. # style:thought # intensity:high
            
            Откуда вы это знаете? Вы не астроном. Но — знаете. # style:thought # intensity:high
        }
        
        ~ cult_awareness += 1
    -
        // НОЧЬ 3: Почти полная — тревога нарастает
        Луна — огромная. # style:dramatic # intensity:high
        
        Почти полная. Висит над городом как гигантский глаз. # style:atmosphere # intensity:high
        
        Её свет — неправильный. Слишком яркий. Слишком белый. Пробивает даже сквозь тучи. # style:atmosphere # intensity:high
        
        Тени длиннее. Чернее. В них — движение? # style:horror # intensity:medium
        
        Вы вздрагиваете. Отворачиваетесь от окна. # style:action
        
        Но ощущение — остаётся. Луна смотрит. Даже когда вы не смотрите на неё. # style:horror # intensity:high
        
        { ritual_countdown == 2:
            Два дня. # style:thought # intensity:high
            
            Голоса по ночам — громче. Сны — ярче. Дверь — ближе. # style:thought # intensity:high
        }
        
        ~ cult_awareness += 2
        -> lose_sanity_safe(2) ->
    -
        // НОЧЬ 4: Канун полнолуния — луна кровавая
        Луна... # style:horror # intensity:high # effect:glitch
        
        Она — КРАСНАЯ. # style:horror # intensity:high
        
        Не оранжевая. Не розовая. КРАСНАЯ. Цвета артериальной крови. Цвета закатного леса. # style:horror # intensity:high
        
        Огромная. Ближе, чем должна быть. Заполняет полнеба. # style:horror # intensity:high
        
        Вы видите — или вам кажется? — узоры на её поверхности. Не кратеры. СИМВОЛЫ. Те самые. Три линии к центру. # style:horror # intensity:high # effect:shake
        
        «...завтра...» # style:vision # intensity:high
        «...завтра мы встретимся...» # style:vision # intensity:high
        «...завтра Дверь откроется...» # style:vision # intensity:high
        
        { ritual_countdown == 1:
            Последняя ночь. Завтра — полнолуние. Завтра — всё решится. # style:thought # intensity:high
            
            Вы готовы? # style:thought # intensity:high
            
            Никто не готов. # style:horror # intensity:high
        }
        
        ~ cult_awareness += 4
        ~ infection_level += 3
        -> lose_sanity_safe(5) ->
    -
        // НОЧЬ 5: ПОЛНОЛУНИЕ — апокалипсис
        ПОЛНОЛУНИЕ. # style:horror # intensity:high # effect:shake
        
        Вы не можете не смотреть. # style:action # intensity:high
        
        Луна — не луна. # style:horror # intensity:high
        
        ГЛАЗ. # style:horror # intensity:high # effect:glitch
        
        Огромный. Багровый. С чёрным зрачком посередине — дырой в НИЧТО. # style:horror # intensity:high
        
        Он смотрит на вас. На город. На лес. На пещеры. # style:horror # intensity:high
        
        Он видит ВСЁ. # style:horror # intensity:high
        
        «...ВРЕМЯ ПРИШЛО...» # style:vision # intensity:high # effect:shake
        «...ДВЕРЬ ОТКРЫТА...» # style:vision # intensity:high
        «...МЫ ИДЁМ...» # style:vision # intensity:high
        
        Под луной — город. Красный. Залитый багровым светом, как кровью. # style:horror # intensity:high
        
        Люди на улицах — замерли. Смотрят вверх. Все — разом. Как один организм. # style:horror # intensity:high
        
        { sanity < 40:
            И вы понимаете: они — уже не люди. # style:horror # intensity:high
            
            Они — марионетки. Куклы. ОНО уже здесь. # style:horror # intensity:high
        }
        
        ~ cult_awareness += 8
        ~ infection_level += 8
        -> lose_sanity_safe(10) ->
    -
        // После полнолуния — если выжили
        Луна заходит. # style:atmosphere # intensity:high
        
        Медленно. Неохотно. # style:atmosphere # intensity:medium
        
        Её свет бледнеет. Из багрового — в розовый. Из розового — в белый. # style:atmosphere
        
        Рассвет. Вы выжили. # style:dramatic # intensity:high
        
        { sanity >= 30:
            Город просыпается. Люди — живые. Настоящие. # style:atmosphere # intensity:medium
            
            Кошмар закончился? Или только начинается? # style:thought # intensity:high
        - else:
            Но луна вернётся. Всегда возвращается. # style:horror # intensity:high
            
            Через месяц. Через год. Через вечность. # style:horror # intensity:high
            
            И она — запомнила вас. # style:horror # intensity:high
        }
}

// Контекстные эффекты
{ times_looked_at_moon >= 3:
    { infection_level >= 50:
        Луна тянет. Зовёт. Как будто между вами — нить. # style:horror # intensity:medium
        Вы — часть цикла. Часть её власти. # style:horror # intensity:high
    }
    { sanity < 50:
        Вы боитесь луны. Закрываете шторы. Не выходите ночью. # style:thought # intensity:medium
        Но она находит вас. Всегда находит. # style:horror # intensity:high
    }
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА СЛУЧАЙНЫХ HORROR-СОБЫТИЙ (v2.0 — с настоящим RANDOM)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Интегрированная система атмосферных событий:
// - Зависит от рассудка (sanity)
// - Зависит от времени суток (time_of_day)
// - Зависит от текущей локации
// - Зависит от уровня осведомлённости о культе (cult_awareness)
// - Зависит от уровня заражения (infection_level)
// - ИСПРАВЛЕНО: Использует RANDOM() для настоящей рандомизации
// ═══════════════════════════════════════════════════════════════════════════════

// Типы событий по интенсивности
LIST HorrorEventsLight = evt_footsteps, evt_cold_breath, evt_bird_silence, evt_shadows_move, evt_distant_howl
LIST HorrorEventsMedium = evt_whispers, evt_face_in_window, evt_followed, evt_phone_static, evt_clock_stops
LIST HorrorEventsHeavy = evt_doppelganger, evt_blood_walls, evt_voices_name, evt_dead_speak, evt_door_opens
LIST HorrorEventsCritical = evt_entity_glimpse, evt_time_skip, evt_memory_loss, evt_possession_attempt, evt_they_see_you

// Локационные события
LIST ForestEvents = forest_red_glow, forest_path_moves, forest_trees_watch, forest_clearing_altar, forest_lost_time
LIST CaveEvents = cave_breathing, cave_symbols_glow, cave_echoes_wrong, cave_door_pulse, cave_others_present
LIST TownEvents = town_empty_streets, town_people_stare, town_wrong_reflections, town_radio_voices, town_children_song
LIST NightEvents = night_moon_red, night_stars_wrong, night_something_flies, night_windows_watch, night_silence_complete

// Счётчик событий (предотвращение спама)
VAR horror_events_today = 0
VAR last_horror_event = 0
VAR total_horror_events = 0

// Текущая локация: 0=город, 1=лес, 2=пещеры, 3=завод, 4=церковь
VAR current_location = 0

// ─────────────────────────────────────────────────────────────────────────────
// ГЛАВНАЯ ФУНКЦИЯ ВЫЗОВА СОБЫТИЙ (v2.0 — с RANDOM)
// ─────────────────────────────────────────────────────────────────────────────

=== function should_trigger_horror() ===
// Определяет, должно ли произойти horror-событие
// Вероятность зависит от множества факторов
// ИСПРАВЛЕНО: Используем RANDOM() вместо детерминированного расчёта

// Максимум 3 события в день
{ horror_events_today >= 3:
    ~ return false
}

// Базовый шанс: 20%
~ temp chance = 20

// Низкий рассудок увеличивает шанс (кумулятивно)
{ sanity < 60:
    ~ chance = chance + 15
}
{ sanity < 40:
    ~ chance = chance + 20
}
{ sanity < 20:
    ~ chance = chance + 25
}

// Ночь увеличивает шанс
{ time_of_day == 3:
    ~ chance = chance + 20
}
{ time_of_day == 2:
    ~ chance = chance + 10
}

// Высокая осведомлённость о культе — больше "видишь"
{ cult_awareness >= 10:
    ~ chance = chance + 10
}
{ cult_awareness >= 20:
    ~ chance = chance + 15
}

// Заражение увеличивает шанс
{ sorokin_infected:
    ~ chance = chance + 20
}

// Лес и пещеры — чаще
{ current_location == 1 || current_location == 2:
    ~ chance = chance + 15
}

// Ограничиваем максимальный шанс до 85% (всегда есть шанс НЕ получить событие)
{ chance > 85:
    ~ chance = 85
}

// ИСПРАВЛЕНО: Используем настоящий RANDOM вместо детерминированного seed
~ temp roll = RANDOM(1, 100)
{ roll <= chance:
    ~ return true
}
~ return false

=== function get_horror_intensity() ===
// Возвращает интенсивность: 1=light, 2=medium, 3=heavy, 4=critical
{ sanity >= 60:
    ~ return 1
}
{ sanity >= 40:
    ~ return 2
}
{ sanity >= 20:
    ~ return 3
}
~ return 4

=== function set_location(loc) ===
~ current_location = loc
~ return loc

=== function reset_daily_horror() ===
~ horror_events_today = 0
~ return true

// ─────────────────────────────────────────────────────────────────────────────
// ВЫЗОВ СЛУЧАЙНОГО СОБЫТИЯ (tunnel)
// ─────────────────────────────────────────────────────────────────────────────

=== random_horror_event ===
// Вызывается как tunnel: -> random_horror_event ->
~ horror_events_today = horror_events_today + 1
~ total_horror_events = total_horror_events + 1

// Определяем интенсивность
~ temp intensity = get_horror_intensity()

// ИСПРАВЛЕНО: Используем switch-структуру для взаимоисключения
// Выбираем ОДНУ категорию события на основе локации и времени
{
- current_location == 1:
    // Лес
    -> forest_horror_event(intensity) ->
- current_location == 2:
    // Пещеры
    -> cave_horror_event(intensity) ->
- time_of_day == 3:
    // Ночь в городе
    -> night_horror_event(intensity) ->
- else:
    // По умолчанию — город днём
    -> town_horror_event(intensity) ->
}

->->

// ─────────────────────────────────────────────────────────────────────────────
// ЛЕСНЫЕ СОБЫТИЯ
// ─────────────────────────────────────────────────────────────────────────────

=== forest_horror_event(intensity) ===
# mood: horror
# type: vision
# vision_icon: 👁️

{ intensity == 1:
    { shuffle:
    - 
        ...
        
        Птицы замолкают.
        
        Все. Разом. Как по команде.
        
        Секунда. Две. Десять.
        
        Тишина такая, что слышно собственный пульс.
        
        Потом — крик. Далёкий. Не птичий. Не человеческий.
        
        Птицы не возвращаются.
        
        -> lose_sanity_safe(2) ->
    -
        Тропинка.
        
        Вы точно шли по ней. Точно помните — вот этот изгиб, вот это дерево.
        
        Но сейчас тропинка ведёт... не туда.
        
        Или это вы — не там?
        
        -> lose_sanity_safe(2) ->
    -
        Холод.
        
        Внезапный. Резкий. Как будто прошли через невидимую стену.
        
        Изо рта — пар. Кожа покрывается мурашками.
        
        Три шага назад — тепло. Три шага вперёд — холод.
        
        Граница. Чего?
        
        -> lose_sanity_safe(3) ->
    }
}

{ intensity == 2:
    { shuffle:
    -
        Движение.
        
        Краем глаза. Между деревьями.
        
        Вы поворачиваетесь — ничего. Только стволы. Только тени.
        
        Но тени... не совпадают с деревьями. Направление неправильное.
        
        Солнце — там. Тени должны падать — сюда.
        
        А они падают — на вас.
        
        -> lose_sanity_safe(4) ->
    -
        «...Сорокин...»
        
        Шёпот. Ваше имя. Из-за деревьев.
        
        Вы замираете. Рука — на кобуре.
        
        «...мы ждали...»
        
        Голос — женский? Мужской? Детский? Все сразу.
        
        «...так долго ждали...»
        
        -> lose_sanity_safe(5) ->
        ~ update_infection(3)
    -
        Красное.
        
        Листья на земле — красные. Но сейчас — ноябрь. Листья должны быть бурыми, гнилыми.
        
        А эти — яркие. Алые. Как свежая кровь.
        
        Вы наклоняетесь. Трогаете.
        
        Влажные.
        
        На пальцах — красное. Пахнет железом.
        
        -> lose_sanity_safe(5) ->
        { not (CluesC ? cult_symbol):
            ~ CluesC += cult_symbol
            ~ sync_evidence_count()
        }
    }
}

{ intensity == 3:
    { shuffle:
    -
        Они смотрят.
        
        Деревья. У них есть глаза. В коре. В дуплах. В узлах ветвей.
        
        Глаза — жёлтые. Немигающие. Следят за каждым вашим движением.
        
        Вы знаете, что это безумие. Знаете, что деревья — просто деревья.
        
        Но глаза — не исчезают. И они — злые.
        
        -> lose_sanity_safe(7) ->
        ~ update_infection(5)
    -
        Поляна.
        
        Вы не помните, как сюда пришли. Минуту назад — шли по тропе. И вдруг — поляна.
        
        В центре — камень. Плоский. С узорами. Бурыми пятнами.
        
        Алтарь.
        
        Вы уже видели такой. Во сне? В видении?
        
        Рядом с камнем — ваши следы. Старые. Засохшие.
        
        Вы здесь уже были. Когда?
        
        -> lose_sanity_safe(8) ->
        ~ CultLore += lore_first_contact
        ~ cult_awareness = cult_awareness + 3
        { not (KeyEvents ? saw_symbol):
            ~ KeyEvents += saw_symbol
        }
    -
        Время.
        
        Было три часа дня. Вы помните — смотрели на часы перед тем, как войти в лес.
        
        Сейчас — темнеет. Сумерки.
        
        Часы показывают — 18:47.
        
        Четыре часа. Вы потеряли четыре часа.
        
        Что вы делали? Где вы были?
        
        Вы не помните. Совсем.
        
        -> lose_sanity_safe(10) ->
        ~ update_infection(8)
    }
}

{ intensity == 4:
    { shuffle:
    -
        ОНО здесь.
        
        Не видите. Не слышите. Но ЗНАЕТЕ.
        
        За деревьями. Между деревьями. ВНУТРИ деревьев.
        
        Огромное. Древнее. Голодное.
        
        Оно смотрит на вас. Изучает. Пробует.
        
        «...скоро...» — не голос. Мысль. В вашей голове. — «...очень скоро...»
        
        -> lose_sanity_safe(12) ->
        ~ update_infection(10)
        ~ CultLore += lore_entity_truth
        ~ cult_awareness = cult_awareness + 5
    -
        Вы видите себя.
        
        Там. Между деревьями. Вы. Другой вы.
        
        Он стоит. Смотрит. Улыбается.
        
        Улыбка — неправильная. Слишком широкая. Слишком много зубов.
        
        «Ты готов», — говорит он вашим голосом. — «Мы ждали тебя».
        
        Вы моргаете — его нет. Только деревья. Только тишина.
        
        Только эхо улыбки в вашем сознании.
        
        -> lose_sanity_safe(15) ->
        ~ update_infection(15)
        ~ sorokin_is_catalyst = true
    }
}

->->

// ─────────────────────────────────────────────────────────────────────────────
// ПЕЩЕРНЫЕ СОБЫТИЯ
// ─────────────────────────────────────────────────────────────────────────────

=== cave_horror_event(intensity) ===
# mood: horror
# type: vision
# vision_icon: 👁️

{ intensity == 1:
    { shuffle:
    -
        Дыхание.
        
        Не ваше. Откуда-то из темноты. Глубокое. Медленное.
        
        Вдох — эхо по коридорам. Выдох — тёплый воздух касается затылка.
        
        Вы оборачиваетесь — ничего. Только камень. Только тьма.
        
        Но дыхание — продолжается.
        
        -> lose_sanity_safe(3) ->
    -
        Капли.
        
        Кап. Кап. Кап.
        
        Ритмичные. Постоянные. Как метроном.
        
        Вы ищете источник — нет воды. Потолок сухой. Стены сухие.
        
        Кап. Кап. Кап.
        
        Звук идёт изнутри вашей головы.
        
        -> lose_sanity_safe(3) ->
    }
}

{ intensity == 2:
    { shuffle:
    -
        Символы.
        
        На стене. Вы точно помните — их не было. Минуту назад — чистый камень.
        
        А сейчас — узоры. Спирали. Глаза. Руки, тянущиеся к центру.
        
        И в центре — дверь. Нарисованная. Или...
        
        Вы моргаете. Символы — исчезают. Но ощущение взгляда — остаётся.
        
        -> lose_sanity_safe(5) ->
        ~ CultLore += lore_door_nature
        ~ cult_awareness = cult_awareness + 3
    -
        Эхо.
        
        Вы кашлянули. Тихо. Для проверки.
        
        Эхо возвращается. Но не кашель. Слова.
        
        «...иди...»
        
        Ваш голос. Ваш кашель. Но слова — не ваши.
        
        -> lose_sanity_safe(5) ->
        ~ update_infection(4)
    }
}

{ intensity == 3:
    { shuffle:
    -
        Свет.
        
        Впереди. Далеко в туннеле. Красноватый. Пульсирующий.
        
        Как сердцебиение. Как дыхание.
        
        Вы идёте к нему. Шаг. Другой. Третий.
        
        Свет не приближается. Но становится ярче. Громче.
        
        Громче?
        
        Вы СЛЫШИТЕ свет. Низкий гул. Зов.
        
        -> lose_sanity_safe(8) ->
        ~ update_infection(6)
        ~ CultLore += lore_door_nature
        ~ cult_awareness = cult_awareness + 4
    -
        Голоса.
        
        Много. Хор. Пение.
        
        На языке, которого вы не знаете. Но понимаете.
        
        «Дверь открывается. Ждущий просыпается. Жертва идёт».
        
        Жертва — это вы?
        
        «Да», — отвечает хор. — «Ты. Всегда ты».
        
        -> lose_sanity_safe(10) ->
        ~ update_infection(8)
        ~ knows_deadline = true
    }
}

{ intensity == 4:
    { shuffle:
    -
        Дверь.
        
        Она здесь. Вы её видите. НАСТОЯЩУЮ.
        
        Камень. Древний. С символами, которые светятся изнутри.
        
        За ней — что-то. КТО-ТО. Огромное. Бесконечное.
        
        Оно прижимается к двери. Изнутри. Толкает.
        
        Дверь скрипит. Камень трескается.
        
        «Скоро», — шепчет оно. — «Полнолуние. Скоро».
        
        -> lose_sanity_safe(15) ->
        ~ update_infection(12)
        ~ CultLore += lore_entity_truth
        ~ cult_awareness = cult_awareness + 6
        ~ knows_deadline = true
    -
        Они вокруг вас.
        
        Не видите. Чувствуете. Руки. Десятки рук. Тянутся из стен.
        
        Касаются. Гладят. Тянут.
        
        «Присоединяйся», — шепчут. — «Стань частью. Стань вечным».
        
        Вы кричите. Бежите. Падаете.
        
        Когда поднимаетесь — вы в другом месте. Не помните, как.
        
        На руках — красные следы. От пальцев. От МНОГИХ пальцев.
        
        -> lose_sanity_safe(12) ->
        ~ update_infection(15)
    }
}

->->

// ─────────────────────────────────────────────────────────────────────────────
// НОЧНЫЕ СОБЫТИЯ В ГОРОДЕ
// ─────────────────────────────────────────────────────────────────────────────

=== night_horror_event(intensity) ===
# mood: horror
# type: vision
# vision_icon: 👁️

{ intensity == 1:
    { shuffle:
    -
        Фонарь.
        
        Мигнул. Погас. Снова зажёгся.
        
        Под ним — тень. Секунду назад — не было.
        
        Человеческая? Почти. Слишком длинная. Слишком тонкая.
        
        Фонарь мигнул снова. Тень — исчезла.
        
        -> lose_sanity_safe(2) ->
    -
        Окна.
        
        В домах напротив. Тёмные. Все спят.
        
        Но в одном — силуэт. Неподвижный. Смотрит на вас.
        
        Вы поднимаете руку — помахать? проверить?
        
        Силуэт поднимает руку. Синхронно. Точно.
        
        Зеркало? Нет. Это — другой дом. Другое окно.
        
        -> lose_sanity_safe(3) ->
    }
}

{ intensity == 2:
    { shuffle:
    -
        Шаги.
        
        За спиной. Синхронно с вашими.
        
        Вы останавливаетесь — шаги продолжаются. Ещё два. Три.
        
        Потом — тишина.
        
        Вы не оборачиваетесь. Не хотите знать.
        
        -> lose_sanity_safe(4) ->
        ~ update_infection(2)
    -
        Радио.
        
        В машине. Выключенное. Мёртвое.
        
        Шипит. Хрипит. Говорит.
        
        «...Сорокин... Виктор Сорокин... мы знаем, где ты...»
        
        Вы вырываете провода. Радио замолкает.
        
        Но голос — остаётся. В голове. Эхом.
        
        -> lose_sanity_safe(5) ->
        ~ update_infection(3)
    }
}

{ intensity == 3:
    { shuffle:
    -
        Луна.
        
        Вы смотрите вверх. Луна — красная. Не оранжевая, как при закате. Красная. Как кровь.
        
        И она... пульсирует? Растёт? Приближается?
        
        Вы моргаете. Луна — обычная. Белая. Далёкая.
        
        Но на секунду — на одну секунду — вы видели ПРАВДУ.
        
        -> lose_sanity_safe(7) ->
        ~ update_infection(5)
        { moon_phase >= 75:
            ~ knows_deadline = true
        }
    -
        Дети.
        
        Поют. Где-то. Колыбельную.
        
        Три часа ночи. Дети должны спать.
        
        Вы идёте на звук. Улица. Переулок. Тупик.
        
        Пение — громче. Ближе. Везде.
        
        Но детей — нет. Только стены. Только темнота.
        
        Только голоса. Десятки детских голосов. Поющих о Двери.
        
        -> lose_sanity_safe(8) ->
        ~ CultLore += lore_first_sacrifice
        ~ cult_awareness = cult_awareness + 4
    }
}

{ intensity == 4:
    { shuffle:
    -
        Город пуст.
        
        Вы оглядываетесь. Улица. Дома. Фонари.
        
        Никого. Ни машин. Ни людей. Ни собак. Ни кошек.
        
        Как будто все — исчезли. Разом. Оставив вас одного.
        
        «Ты всегда был один», — шепчет ветер. — «Они — иллюзия. Ты — реальность».
        
        «Приходи. Мы ждём».
        
        Вы моргаете — город возвращается. Машина проезжает. Собака лает.
        
        Но вы знаете — то, что вы видели, было НАСТОЯЩИМ.
        
        -> lose_sanity_safe(12) ->
        ~ update_infection(10)
    -
        Ваше отражение.
        
        В витрине. Вы. Но — другой.
        
        Улыбается. Вы — не улыбаетесь. Двигается. Вы — стоите.
        
        «Ты почти готов», — говорит отражение вашим голосом. — «Ещё немного».
        
        Оно прижимает ладонь к стеклу. Изнутри.
        
        «Впусти меня».
        
        Вы отшатываетесь. Бежите.
        
        За спиной — звон разбитого стекла.
        
        -> lose_sanity_safe(15) ->
        ~ update_infection(12)
        ~ sorokin_is_catalyst = true
    }
}

->->

// ─────────────────────────────────────────────────────────────────────────────
// ГОРОДСКИЕ СОБЫТИЯ (ДЕНЬ)
// ─────────────────────────────────────────────────────────────────────────────

=== town_horror_event(intensity) ===
# mood: mystery
# type: vision
# vision_icon: 👁️

{ intensity == 1:
    { shuffle:
    -
        Взгляды.
        
        Прохожие. Смотрят. Быстро отводят глаза.
        
        Паранойя? Или они правда — ЗНАЮТ что-то о вас?
        
        -> lose_sanity_safe(1) ->
    -
        Часы.
        
        Все часы в городе — показывают разное время.
        
        На вокзале — 14:23. На почте — 15:47. На руке — 13:05.
        
        Какое время — настоящее?
        
        -> lose_sanity_safe(2) ->
    }
}

{ intensity == 2:
    { shuffle:
    -
        Разговор.
        
        Две женщины. У магазина. Шепчутся.
        
        Вы проходите мимо. Замолкают. Смотрят.
        
        «...он тоже видит...» — обрывок фразы.
        
        Вы оборачиваетесь. Женщин нет. Улица — пуста.
        
        -> lose_sanity_safe(4) ->
        ~ update_infection(2)
    -
        Газета.
        
        Старая. На скамейке. Вы поднимаете.
        
        Заголовок: «СЛЕДОВАТЕЛЬ СОРОКИН ПРОПАЛ БЕЗ ВЕСТИ».
        
        Дата — завтрашняя.
        
        Вы перечитываете. Заголовок — другой. Что-то про урожай.
        
        Дата — вчерашняя.
        
        Показалось?
        
        -> lose_sanity_safe(5) ->
        ~ knows_deadline = true
    }
}

{ intensity == 3:
    { shuffle:
    -
        Знакомые лица.
        
        Пропавшие. Те, кого вы ищете. Идут по улице. Живые. Здоровые.
        
        Вы окликаете — не реагируют. Догоняете — не можете.
        
        Они всегда — впереди. Всегда — за углом. Всегда — исчезают.
        
        Галлюцинация? Или они — здесь? Везде? Всегда?
        
        -> lose_sanity_safe(8) ->
        ~ update_infection(6)
    -
        Тишина.
        
        Посреди дня. Посреди улицы.
        
        Всё замирает. Люди. Машины. Птицы. Ветер.
        
        Как фотография. Как остановленное время.
        
        Вы — единственный, кто двигается.
        
        «Мы показываем тебе мир», — говорит голос. Отовсюду. — «Мир без нас. Мёртвый мир».
        
        «Хочешь жить — впусти нас».
        
        Время — возвращается. Никто ничего не заметил.
        
        -> lose_sanity_safe(10) ->
        ~ update_infection(8)
        ~ CultLore += lore_entity_truth
        ~ cult_awareness = cult_awareness + 5
    }
}

{ intensity == 4:
    { shuffle:
    -
        Город исчезает.
        
        Не постепенно. Мгновенно. Один удар сердца — и вы стоите посреди пустоши.
        
        Руины. Обугленные остовы домов. Пепел вместо снега.
        
        Небо — красное. Солнце — чёрное. Воздух пахнет гарью и гнилью.
        
        Это — будущее? Это — прошлое? Это — ПРАВДА?
        
        «Мир без Двери», — шепчет голос. — «Выбирай».
        
        Вы моргаете. Город возвращается. Люди идут. Машины едут.
        
        Но в глазах прохожих — на секунду — вы видите то же самое небо.
        
        -> lose_sanity_safe(15) ->
        ~ update_infection(12)
        ~ CultLore += lore_entity_truth
        ~ cult_awareness = cult_awareness + 7
        ~ knows_deadline = true
    -
        Все смотрят.
        
        Прохожие. Продавцы. Дети. Старики. Все.
        
        Остановились. Повернулись. Смотрят на вас.
        
        Молча. Неподвижно. С одинаковым выражением — пустым, мёртвым.
        
        Их глаза — чёрные. Полностью. Без белков. Без зрачков.
        
        «Мы видим тебя», — говорят все разом, одним голосом. — «Ты — наш».
        
        Вы отступаете. Бежите. Врезаетесь в кого-то.
        
        — Эй! Осторожнее!
        
        Обычный человек. Обычные глаза. Обычный раздражённый взгляд.
        
        Но вы знаете — на секунду — они БЫЛИ там. Внутри.
        
        -> lose_sanity_safe(12) ->
        ~ update_infection(15)
        ~ sorokin_is_catalyst = true
    }
}

->->

// ─────────────────────────────────────────────────────────────────────────────
// ПРОВЕРКА И ВЫЗОВ СОБЫТИЯ (используется в сценах)
// ─────────────────────────────────────────────────────────────────────────────

=== check_for_horror_event ===
// Вызывается между сценами: -> check_for_horror_event ->
{ should_trigger_horror():
    -> random_horror_event ->
}
->->

// ═══════════════════════════════════════════════════════════════════════════════
// СЦЕНЫ РАЗВИТИЯ ВЕРСИЙ — ЛОЖНЫЕ СЛЕДЫ
// ═══════════════════════════════════════════════════════════════════════════════

=== theory_chemical_intro ===
# mood: investigation
# type: red_herring

ВЕРСИЯ 1: ХИМИЧЕСКОЕ ОТРАВЛЕНИЕ

Вы вспоминаете учебники токсикологии. Многие химические вещества могут вызывать галлюцинации, паранойю, потерю памяти.

Завод "Прометей". Химическое производство. Выбросы в атмосферу.

А что, если всё это — просто отравление? Массовый психоз на фоне хронической интоксикации?

Это объяснило бы:
• Странное поведение жителей
• "Голоса" и "видения"
• Даже исчезновения — люди в бреду уходили в лес и гибли

Версия простая. Понятная. Рациональная.

Слишком рациональная?

~ boost_theory(1, 15)

->->

=== theory_gromov_intro ===
# mood: suspicion
# type: red_herring

ВЕРСИЯ 2: ГРОМОВ — УБИЙЦА

Майор Громов. Двадцать лет в органах. Знает каждый угол этого города.

Он нервничает. Скрывает информацию. Исчезает по ночам.

Классический профиль серийного убийцы: должность власти, знание местности, возможность скрывать улики.

А что, если исчезновения — это не мистика? Что, если это просто убийства? И убийца — тот, кому доверено расследование?

Вы видели такое раньше. В Новосибирске — участковый, убивший семь человек за три года. Его раскрыли случайно.

Громов подходит под профиль. Возраст, положение, странности в поведении.

Но доказательств нет. Пока нет.

~ boost_theory(2, 15)

->->

=== theory_serafim_intro ===
# mood: dark
# type: red_herring

ВЕРСИЯ 3: БЕЗУМНЫЙ ПРОПОВЕДНИК

Отец Серафим. Полвека в этих местах. Рассказывает о "Двери" и "тех, кто ждёт".

А что, если он — не свидетель, а виновник?

Религиозные маньяки — не редкость. Люди, убеждённые в своей миссии, способные на всё.

Что, если Серафим сам создал "культ"? Сам похищает людей для своих "ритуалов"? А истории о древних силах — просто прикрытие для безумия?

Он старый. Но крепкий. И у него есть паства. Последователи, готовые исполнить любой приказ.

Церковь — идеальное место для преступлений. Подземелья, тайные комнаты, слепое доверие прихожан.

Серафим знает больше, чем говорит. Но почему он рассказывает ВАМ?

Проверка? Вербовка? Или... отвлечение внимания?

~ boost_theory(3, 15)

->->

=== theory_debunk_chemical ===
# mood: revelation
# type: plot_twist

ВЕРСИЯ ОПРОВЕРГНУТА: ХИМИЧЕСКОЕ ОТРАВЛЕНИЕ

Вы получили результаты анализов из Москвы. Образцы воздуха, воды, почвы.

"Уровень загрязнения — в пределах нормы для промышленного района. Отсутствуют вещества, способные вызывать стойкие галлюцинации или психотические эпизоды."

Химия — ни при чём.

Но тогда... откуда голоса? Откуда видения?

Если не яд — что заставляет людей сходить с ума?

~ debunk_theory(1)
~ theory_chemical = 0

->->

=== theory_debunk_gromov ===
# mood: revelation
# type: plot_twist

ВЕРСИЯ ОПРОВЕРГНУТА: ГРОМОВ — УБИЙЦА

Вы нашли алиби Громова. На каждое исчезновение.

Больше того — вы нашли его секрет. Тот, который он так тщательно скрывал.

Его дочь. Аня Громова. Пропала девятнадцать лет назад. В этом самом лесу.

Громов не убийца. Громов — отец, потерявший ребёнка. Всё это время он искал её. Тайно. По ночам. В местах, куда боятся ходить другие.

Он не преступник. Он — ещё одна жертва.

~ debunk_theory(2)
~ theory_gromov = 0
~ CharacterSecrets += gromov_daughter
~ understanding_gromov += 20

->->

=== theory_debunk_serafim ===
# mood: revelation
# type: plot_twist

ВЕРСИЯ ОПРОВЕРГНУТА: БЕЗУМНЫЙ ПРОПОВЕДНИК

Вы проверили прошлое Серафима. Тщательно.

Сорок лет безупречной службы. Никаких инцидентов. Никаких подозрений.

Но главное — вы нашли старые фотографии. 1954 год. Серафим — молодой священник — стоит среди группы геологов.

Он был СВИДЕТЕЛЕМ. Он видел, как они открыли пещеры. Видел, что случилось потом.

Серафим не создал культ. Серафим пытается его ОСТАНОВИТЬ. Уже тридцать лет.

Вот почему он здесь. Вот почему не уехал.

Он — последняя линия обороны. И он проигрывает.

~ debunk_theory(3)
~ theory_serafim = 0
~ CharacterSecrets += serafim_vision
~ understanding_serafim += 25

->->

// ═══════════════════════════════════════════════════════════════════════════════
// ЛИЧНАЯ СВЯЗЬ СОРОКИНА — АФГАНСКИЙ ТОВАРИЩ
// ═══════════════════════════════════════════════════════════════════════════════

=== reveal_comrade_connection ===
# mood: shock
# type: personal

Вы просматриваете список пропавших. Семь имён. Семь жизней.

И вдруг — как удар под дых.

Пятый в списке. "Коршунов Сергей Александрович, 1946 г.р., инженер завода 'Прометей'."

Серёга Коршунов.

Ваш радист в Афганистане. Два года рядом, плечом к плечу. Вы вытащили его из-под обстрела у Панджшера. Он прикрывал вас при отходе из ущелья.

Последний раз вы виделись в восемьдесят втором. В Москве. Он говорил, что уезжает на Урал. "Хорошая работа, Витя. Закрытый город, но платят прилично."

Теперь вы понимаете, почему вас послали сюда. Почему ИМЕННО вас.

Кто-то знал. Кто-то хотел, чтобы вы приехали.

~ knows_vanished_comrade = true
~ comrade_name_revealed = true
~ personal_vendetta = personal_vendetta + 30

{ AfghanMemories ? memory_ambush:
    Воспоминания нахлынули. Афганистан. Засада. Голос Серёги в рации: "Держись, Сорокин! Я иду!"
}

* [Это меняет всё]
    Теперь это личное.
    
    Серёга не просто "пропавший номер пять". Он — друг. Брат по оружию. Человек, который спасал вам жизнь.
    
    Вы НАЙДЁТЕ его. Живым или мёртвым. И найдёте тех, кто виноват.
    
    ~ personal_vendetta = personal_vendetta + 20
    
    ->->

* [Подавить эмоции — сосредоточиться]
    Нет. Нельзя терять голову.
    
    Эмоции — враг следователя. Серёга — улика. Ниточка. Не больше.
    
    Но... но вы знаете, что лжёте себе.
    
    ~ humanity = humanity + 10
    
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ДЕДЛАЙНА — НАПОМИНАНИЯ О ПОЛНОЛУНИИ
// ═══════════════════════════════════════════════════════════════════════════════

=== deadline_reminder ===
# mood: tension

// Прогрессия ощущения луны — каждую ночь новая стадия
-> look_at_moon ->

{ ritual_countdown == 4:
    Четыре дня до полнолуния. # style:thought # intensity:medium
}
{ ritual_countdown == 3:
    Три дня. # style:thought # intensity:medium
    
    { knows_deadline:
        Три дня до ритуала. Времени всё меньше. # style:thought # intensity:high
    }
}
{ ritual_countdown == 2:
    Два дня. # style:thought # intensity:high
    
    { knows_deadline:
        Два дня. Вы чувствуете — что-то нарастает. Напряжение в воздухе. # style:thought # intensity:high
    }
}
{ ritual_countdown == 1:
    Завтра. # style:dramatic # intensity:high
    
    { knows_deadline:
        Завтра полнолуние. Завтра — ритуал. Если не остановить... # style:thought # intensity:high
    }
}
{ ritual_countdown == 0:
    ВРЕМЯ ВЫШЛО. # style:horror # intensity:high
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// ЗАРАЖЕНИЕ СОРОКИНА — ПРОГРЕССИЯ
// ═══════════════════════════════════════════════════════════════════════════════

=== infection_progress ===
# mood: horror

{ infection_level >= 20 && infection_level < 40:
    Вы замечаете... странности.
    
    Тени, которые движутся не так. Шёпот на грани слуха. Запах — сладковатый, незнакомый — который появляется и исчезает.
    
    Может, просто усталость?
}
{ infection_level >= 40 && infection_level < 60:
    Это уже не "может быть".
    
    Вы ВИДИТЕ их. Краем глаза. Силуэты в темноте. Лица в окнах пустых домов.
    
    Вы СЛЫШИТЕ их. Голоса, называющие ваше имя. На языке, которого не знаете — но понимаете.
    
    Это... это начало. То же, что происходило с другими.
    
    -> lose_sanity_safe(5) ->
}
{ infection_level >= 60 && infection_level < 80:
    Грань между реальностью и... другим — размывается.
    
    Вы больше не уверены, что снится, а что — наяву. Воспоминания путаются. Время течёт странно.
    
    Они говорят с вами. Всё чаще. Всё настойчивее.
    
    «...приди...»
    «...дверь открыта...»
    «...ты наш...»
    
    -> lose_sanity_safe(10) ->
}
{ infection_level >= 80:
    Вы — на грани.
    
    Ваше отражение в зеркале — улыбается, когда вы не улыбаетесь. Тени следуют за вами. Стены пульсируют, как живые.
    
    Голоса — уже не шёпот. Они — КРИК.
    
    Скоро вы станете одним из них. Если не остановите это.
    
    Если сможете остановить.
    
    -> lose_sanity_safe(15) ->
}

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ГЛУБОКОГО ЛОРА — ИСТОРИЯ КУЛЬТА И ДРЕВНИХ ВРЕМЁН
// ═══════════════════════════════════════════════════════════════════════════════

// Эти сцены раскрываются при изучении документов, разговорах, исследовании

=== scene_lore_ancient_tribe ===
# mood: mystery
# type: lore

ДРЕВНЯЯ ИСТОРИЯ: ПЛЕМЯ КРА-СЫЛ

Из записей экспедиции 1890 года:

"...местные манси рассказывают о племени, жившем здесь до прихода русских. Они называли себя Кра-Сыл — 'Дети Красной Тени'.

Это племя поклонялось чему-то в пещерах под горой. Что-то, что говорило с ними во снах. Что-то, что давало силу их шаманам — но требовало жертв взамен.

Когда русские пришли в эти земли в XVI веке, племя Кра-Сыл уже исчезло. Манси говорят — они 'ушли за Дверь'. Что это значит — никто не знает.

Но пещеры остались. И то, что в них живёт — тоже."

~ CultLore += lore_ancient_tribe
~ lore_depth += 5
~ cult_awareness += 2
// ФАЗА 2: Укрепление истинной версии при раскрытии лора культа
~ boost_theory(5, 8)

->->

=== scene_lore_first_contact ===
# mood: horror
# type: lore

ДРЕВНЯЯ ИСТОРИЯ: ПЕРВЫЙ КОНТАКТ

Из дневника геолога Петрова (экспедиция 1890 года):

"12 июля. Нашли вход в пещерную систему. Глубина — неизвестна. Местные отказались идти внутрь.

15 июля. Спустились на двести метров. Обнаружили зал с наскальными рисунками. Возраст — предположительно 5000-7000 лет. Рисунки изображают фигуры в капюшонах вокруг круглого камня. Над камнем — что-то... не могу описать. Многоглазое. Многорукое.

18 июля. Странные звуки из глубины. Низкий гул. Коллеги утверждают — это ветер. Но здесь нет ветра.

20 июля. Прохоров услышал голоса ночью. Говорит — они звали его по имени. Утром нашли его у входа в пещеры. Он пытался войти внутрь. Босиком. В одном белье.

23 июля. Прохоров исчез. Искали три дня. Не нашли.

Сворачиваем экспедицию."

~ CultLore += lore_first_contact
~ lore_depth += 5
~ cult_awareness += 3
~ boost_theory(5, 10)

->->

=== lore_expedition_1890_full ===
# mood: dark
# type: lore

ЭКСПЕДИЦИЯ 1890 ГОДА — ПОЛНАЯ ИСТОРИЯ

Из секретного отчёта Императорского географического общества:

"Экспедиция под руководством профессора Корнилова обнаружила на Среднем Урале систему пещер с признаками древнего культа.

Особый интерес представляет центральный зал, который экспедиция назвала 'Святилищем'. В центре — каменный алтарь диаметром около трёх метров. На стенах — надписи на неизвестном языке и изображения ритуалов.

Пять членов экспедиции из двенадцати погибли или пропали без вести. Выжившие отказались давать показания. Профессор Корнилов скончался через два месяца после возвращения. Причина смерти — остановка сердца. По свидетельствам родственников, перед смертью он 'разговаривал с кем-то, кого не было в комнате'.

РЕКОМЕНДАЦИЯ: Вход в пещеры засыпать. Местоположение засекретить. Дальнейшие исследования прекратить."

Рекомендация была выполнена. На шестьдесят лет.

~ CultLore += lore_expedition_1890
~ AncientArtifacts += artifact_expedition_journal
~ lore_depth += 8
~ cult_awareness += 4
~ boost_theory(5, 12)

->->

=== scene_lore_soviet_discovery ===
# mood: investigation
# type: lore

СОВЕТСКОЕ ОТКРЫТИЕ — 1954 ГОД

Из рассекреченных материалов Министерства геологии СССР:

"При разведке урановых месторождений в районе N (координаты засекречены) геологоразведочная партия обнаружила систему естественных пещер.

Первичное обследование выявило:
- Протяжённость системы — более 15 км
- Глубина — до 400 метров
- Наличие искусственных сооружений древнего происхождения
- Аномальные показатели приборов в центральной части системы

ОСОБОЕ ПРИМЕЧАНИЕ: При нахождении в пещерах более 6 часов 7 из 12 участников партии жаловались на 'голоса' и 'видения'. Двое отказались выходить на поверхность. Эвакуированы принудительно.

РЕКОМЕНДАЦИЯ: Засекретить. Передать объект в ведение спецотдела."

Так родился Проект "Эхо".

~ CultLore += lore_soviet_discovery
~ lore_depth += 6
~ cult_awareness += 3
~ boost_theory(5, 10)

->->

=== lore_project_echo_full ===
# mood: horror
# type: lore

ПРОЕКТ "ЭХО" — ПОЛНАЯ ИСТОРИЯ

Совершенно секретно. Уровень допуска: Особая папка.

"ЦЕЛЬ: Исследование аномальных явлений, зафиксированных в пещерной системе объекта 'Прометей'.

РУКОВОДИТЕЛЬ: Чернов Александр Михайлович, доктор физико-математических наук.

ЭТАПЫ:

1954-1958: Картографирование. Установка аппаратуры. Первые эксперименты с частотным резонансом.

1958-1962: Обнаружен 'эффект контакта'. При определённой частоте звукового воздействия испытуемые сообщают о 'голосах' и 'присутствии'. ЭЭГ показывает аномальную активность.

1962-1966: Эксперименты с добровольцами. Результаты засекречены. Смертность — 34%.

1966: ИНЦИДЕНТ. Дверь открылась. Подробности — см. приложение 7 (уничтожено).

После 1966: Проект официально закрыт. Неофициально — продолжается под руководством Чернова. Финансирование — из неустановленных источников."

~ CultLore += lore_project_echo_start
~ lore_depth += 10
~ cult_awareness += 5
{ not (CluesB ? echo_docs):
    ~ CluesB += echo_docs
    ~ sync_evidence_count()
}

->->

=== scene_lore_door_nature ===
# mood: cosmic_horror
# type: lore

// Ощущение Двери при чтении о ней
-> sense_the_door ->

ПРИРОДА ДВЕРИ — ТЕОРИИ

Из личных записей академика Чернова (изъято при обыске, 1975):

"Двадцать лет я изучаю Дверь. Двадцать лет — и до сих пор не понимаю полностью.

Что мы знаем:

1. Дверь — не физический объект. Это... разрыв. Брешь между мирами. Или измерениями. Или состояниями бытия.

2. ОНО существует по ту сторону. Что это — не знаю. Разум? Сущность? Бог? Или что-то настолько чуждое, что у нас нет слов для описания.

3. ОНО может общаться. Через сны. Через голоса. Через... прикосновения к разуму. Но общение — не его цель.

4. ОНО хочет ВОЙТИ. В наш мир. В нашу реальность. Для этого нужна энергия. Особый вид энергии, который высвобождается при...

[страница оборвана]

5. Дверь открывается в полнолуние. Почему — не знаю. Возможно, гравитационное воздействие. Или что-то более древнее.

6. Когда Дверь откроется полностью — ОНО войдёт. И тогда...

Марина. Я делаю это ради Марины. Они обещали..."

~ CultLore += lore_door_nature
~ lore_depth += 15
~ cult_awareness += 7

->->

=== scene_lore_entity_truth ===
# mood: cosmic_horror
# type: lore

ИСТИНА О СУЩНОСТИ

{ sanity < 40:
    Вы не читаете это. Вы — ЗНАЕТЕ. Знание приходит изнутри, как воспоминание о том, чего никогда не было.
- else:
    Из разрозненных источников — легенды манси, записи экспедиции 1890 года, дневники Чернова, показания пациентов — складывается картина.
}

Страшная картина.

ОНО существовало до человечества. До жизни на Земле. Возможно — до самой Земли.

ОНО ждёт в пространстве между мирами. В темноте, которая старше звёзд.

ОНО не добро и не зло. Эти понятия — человеческие. ОНО просто... ЕСТЬ. И хочет быть ЗДЕСЬ.

Древние племена знали об этом. Поклонялись. Приносили жертвы. Держали Дверь закрытой — ценой крови.

Советские учёные нашли Дверь снова. Попытались использовать. Не поняли, с чем имеют дело.

Теперь — слишком поздно. Дверь приоткрыта. ОНО просачивается. Медленно, но неизбежно.

Голоса — это ОНО.
Видения — это ОНО.
Исчезновения — это ОНО.

И скоро — очень скоро — Дверь откроется полностью.

~ CultLore += lore_entity_truth
~ lore_depth += 20
~ cult_awareness += 10
-> lose_sanity_safe(5) ->

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ВОСПОМИНАНИЙ (FLASHBACKS)
// ═══════════════════════════════════════════════════════════════════════════════

=== flashback_ambush ===
# mood: horror
# effect: flashback

...воспоминание накатывает волной... # style:flashback # intensity:high

АФГАНИСТАН, 1978 ГОД # style:document # intensity:medium

Засада в ущелье Панджшер. Колонна растянулась на два километра. # style:flashback # intensity:medium

Первый взрыв — головная машина. Второй — замыкающая. Ловушка захлопнулась. # style:flashback # intensity:high

Вы помните крики. Помните, как Сашка Воронов — двадцать два года, жена беременная — упал лицом в песок. Помните запах горящего топлива и меди. # style:flashback # intensity:high

Вы выжили. Девятнадцать из сорока трёх не выжили. # style:flashback # intensity:high

Почему вы? Этот вопрос преследует вас каждую ночь. # style:thought # intensity:high

~ AfghanMemories += memory_ambush
~ afghan_flashbacks = afghan_flashbacks + 1
-> lose_sanity_safe(3) ->

...настоящее возвращается... # style:flashback # intensity:medium

->->

=== flashback_cave ===
# mood: horror
# effect: flashback

...границы реальности размываются... # style:flashback # intensity:high

АФГАНИСТАН, 1979 ГОД # style:document # intensity:medium

Пещеры в горах Гиндукуш. Вы искали базу снабжения. # style:flashback # intensity:medium

Нашли что-то другое. # style:dramatic # intensity:high

Глубоко под землёй — зал с колоннами. Не природный. Кто-то вырубил его в скале тысячи лет назад. На стенах — символы, которые вы не понимали. # style:flashback # intensity:high

Красные круги. Расходящиеся линии. Глаза, смотрящие отовсюду. # style:horror # intensity:high # effect:glitch

Проводник — местный старик — увидел это и отказался идти дальше. Сказал одно слово на дари: "Джинны". # style:flashback # intensity:medium

Вы не поверили. Тогда. # style:thought # intensity:high

~ AfghanMemories += memory_cave
~ afghan_flashbacks = afghan_flashbacks + 1
~ cult_awareness = cult_awareness + 2

...реальность восстанавливается... # style:flashback # intensity:medium

->->

=== flashback_betrayal ===
# mood: horror
# effect: flashback

...память прорывается сквозь защиту... # style:flashback # intensity:high

АФГАНИСТАН, 1979 ГОД # style:document # intensity:medium

Информатор. Вы верили ему два месяца. Он сдавал позиции моджахедов, спасал жизни. # style:flashback # intensity:medium

Потом он привёл вашу группу в долину, где ждали триста человек. # style:flashback # intensity:high

Из двенадцати вернулись четверо. # style:flashback # intensity:high

Вы нашли его потом. В Кабуле. Он не сопротивлялся. # style:flashback # intensity:medium

"Я делал, что должен был", — сказал он. — "Они обещали вернуть мою семью". # style:flashback # intensity:high

Вы не выстрелили. Передали афганским властям. Но иногда жалеете, что не выстрелили. # style:flashback # intensity:high

Доверие — роскошь. Вы усвоили этот урок. # style:thought # intensity:high

~ AfghanMemories += memory_betrayal
~ afghan_flashbacks = afghan_flashbacks + 1

...настоящее... # style:flashback # intensity:medium

->->

=== flashback_voices ===
# mood: horror
# effect: flashback

...шёпот из прошлого... # style:flashback # intensity:high

АФГАНИСТАН, 1980 ГОД # style:document # intensity:medium

Госпиталь в Кабуле. Контузия. Две недели без сознания. # style:flashback # intensity:medium

Вы слышали голоса. Мёртвые товарищи разговаривали с вами. Рассказывали, что видят на той стороне. # style:whisper # intensity:high

"Темнота", — говорил Сашка Воронов. — "Но не пустая. Там что-то живёт. Оно ждёт". # style:whisper # intensity:high

Врачи сказали — последствия травмы. Галлюцинации. Пройдёт. # style:flashback # intensity:medium

Голоса прошли. Но иногда — поздно ночью — вы всё ещё слышите шёпот. # style:thought # intensity:high

"Оно ждёт..."

~ AfghanMemories += memory_voices
~ afghan_flashbacks = afghan_flashbacks + 1
-> lose_sanity_safe(5) ->

...тишина...

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СЛУЧАЙНЫЕ СОБЫТИЯ (RANDOM ENCOUNTERS)
// ═══════════════════════════════════════════════════════════════════════════════

=== random_encounter ===
// Выбираем случайное событие на основе времени и дня
// Вызывается как туннель: -> random_encounter ->
~ temp roll = RANDOM(1, 10)

{ time_of_day == 3: // Ночь — более жуткие события
    { roll <= 3:
        -> encounter_shadow ->
    }
    { roll > 3 && roll <= 6:
        -> encounter_whispers ->
    }
    -> encounter_figure ->
}

{ time_of_day == 2: // Вечер
    { roll <= 4:
        -> encounter_stranger ->
    }
    { roll > 4 && roll <= 7:
        -> encounter_warning ->
    }
    -> encounter_clue ->
}

// День или утро — более нейтральные события
{ roll <= 3:
    -> encounter_gossip ->
}
{ roll > 3 && roll <= 6:
    -> encounter_helpful ->
}
-> encounter_suspicious ->

=== encounter_shadow ===
# mood: horror

Краем глаза вы замечаете движение. Тень — слишком быстрая, слишком плавная для человека — скользит между домами.

Вы оборачиваетесь. Ничего.

Но ощущение взгляда в спину не проходит.

-> lose_sanity_safe(2) ->

->->

=== encounter_whispers ===
# mood: horror

Ветер приносит звуки. Не слова — но почти слова. Как будто кто-то говорит на незнакомом языке, слишком тихо, чтобы разобрать.

Вы останавливаетесь. Прислушиваетесь.

Шёпот затихает. Но вы уверены — он был.

{ sanity < 50:
    "...идёт..." — одно слово прорывается сквозь шум. — "...следователь идёт..."
    -> lose_sanity_safe(3) ->
}

->->

=== encounter_figure ===
# mood: horror

В конце улицы — фигура. Стоит неподвижно под единственным фонарём.

Высокая. Худая. Лица не разглядеть — капюшон.

Вы моргаете.

Фигуры нет. Только пустая улица и качающийся на ветру фонарь.

{ not (AfghanMemories ? memory_voices):
    -> flashback_voices ->
}

-> lose_sanity_safe(4) ->

->->

=== encounter_stranger ===
# mood: mystery

Незнакомец в сером пальто. Идёт навстречу, смотрит в землю.

Проходя мимо, он что-то бормочет. Вы различаете только:

"...не задерживайтесь здесь... они уже знают..."

Вы оборачиваетесь, но он уже завернул за угол.

Кто "они"?

->->

=== encounter_warning ===
# mood: tense

Записка. Кто-то сунул вам в карман, пока вы проходили мимо толпы у магазина.

Разворачиваете: "УЕЗЖАЙТЕ. СЕГОДНЯ. ПОКА МОЖЕТЕ."

Почерк — женский. Торопливый.

Вы оглядываетесь. Десятки лиц. Любое из них могло написать это.

->->

=== encounter_clue ===
# mood: investigation

{ CluesA ? witness_conflict:
    На стене дома — свежая надпись мелом: "Громов знает. Громов молчит."
    
    Интересно. Кто-то пытается связаться с вами?
    
    ~ trust_gromov = trust_gromov - 5
- else:
    У мусорного бака — обрывок газеты. Местная многотиражка "Красногорский рабочий".
    
    Статья обведена красным: "Завод 'Прометей' перевыполнил план на 112%". Дата — октябрь 1985.
    
    Рядом с заголовком кто-то написал от руки: "ЛОЖЬ".
}

->->

=== encounter_gossip ===
# mood: neutral

Две женщины у колонки набирают воду. Замолкают, когда вы проходите мимо.

// РАСШИРЕННАЯ СИСТЕМА РЕПУТАЦИИ: разные реакции горожан
{ city_reputation <= -50:
    // ВРАГ — город ненавидит следователя
    "...это он... тот самый... говорят, человека избил на допросе..."
    "...московская сволочь... сам бы пропал, никто бы не искал..."
    
    Одна из женщин демонстративно плюёт в вашу сторону.
    
    -> lose_sanity_safe(1) ->
}
{ city_reputation < -20 && city_reputation > -50:
    // ПОДОЗРИТЕЛЬНЫЙ — боятся и избегают
    "...это он... московский... говорят, людей сажает ни за что..."
    "...Клава говорила — странный... глаза бегают..."
    
    Они ускоряют шаг, не оглядываясь.
}
{ city_reputation >= -20 && city_reputation <= 20:
    // НЕЙТРАЛЬНЫЙ — любопытство и осторожность
    "...следователь... зачем приехал?.. что ему надо?.."
    "...пропавших ищет, говорят... может, хоть правду узнаем..."
}
{ city_reputation > 20 && city_reputation < 50:
    // ДРУЖЕЛЮБНЫЙ — симпатия и готовность помочь
    "...ищет пропавших... может, хоть что-то найдёт..."
    "...Таня с ним говорила... говорит — порядочный человек..."
    
    Одна из женщин кивает вам. Почти приветливо.
}
{ city_reputation >= 50:
    // СВОЙ — полное доверие
    "...это он... тот следователь... говорят, Тане помогает..."
    "...слышала, Зорина ищет... настоящий человек, не то что наши..."
    
    — Товарищ! — окликает одна из женщин. — Если что узнаете — скажите людям, ладно? Мы все... мы все тут боимся. # speaker:stranger
    
    Искренность в её голосе — неожиданная. И ценная.
}

Вы делаете вид, что не слышите. Или — слышите?

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА РЕПУТАЦИИ: СОБЫТИЯ В ГОРОДЕ
// ═══════════════════════════════════════════════════════════════════════════════

=== reputation_event_warning ===
// Вызывается при очень низкой репутации — город враждебен
# mood: tense

{ city_reputation <= -50:
    Вы чувствуете это — как холод на затылке. Как взгляды, которые не видишь, но знаешь.
    
    Город — против вас.
    
    На стене дома — надпись мелом: "МОСКВА, УЕЗЖАЙ".
    
    Кто-то написал это ночью. Для вас.
    
    * [Стереть надпись]
        Вы стираете надпись рукавом. Мел размазывается по кирпичу.
        
        За спиной — смешок. Кто-то видел.
        
        ~ city_reputation = city_reputation - 2
        ->->
    
    * [Игнорировать]
        Пусть. Вы не за этим приехали.
        
        Но что-то в груди — сжимается. Одиночество здесь — другое. Опасное.
        ->->
    
    * { is_diplomatic() } [Заговорить с прохожими]
        — Простите, вы не видели, кто это написал? # speaker:sorokin
        
        Прохожий — пожилой мужчина — останавливается. Смотрит на вас. В глазах — не страх. Жалость?
        
        — Уезжайте, товарищ. Пока можете. Этот город... он не любит чужих. И тех, кто задаёт вопросы. # speaker:stranger
        
        ~ track_helpful_action()
        ~ city_reputation = city_reputation + 3
        ->->
}
->->

=== reputation_event_help ===
// Вызывается при высокой репутации — кто-то хочет помочь
# mood: mystery

{ city_reputation >= 50:
    Старушка в платке догоняет вас у магазина.
    
    — Товарищ следователь! Подождите! # speaker:stranger
    
    Она оглядывается — проверяет, не видит ли кто.
    
    — Я... я знаю кое-что. О пропавших. — Её голос дрожит. — Мой внук... он видел. В лесу. Людей в капюшонах. Они пели что-то. Странное. # speaker:stranger
    
    * [Расспросить подробнее]
        — Когда это было? Где именно? # speaker:sorokin
        
        — Три недели назад. У Чёрного Камня. Он... он больше не ходит в лес. Боится. # speaker:stranger
        
        Чёрный Камень. Ещё одно название. Ещё одна зацепка.
        
        ~ cult_awareness = cult_awareness + 3
        ~ track_cult_exposure()
        ->->
    
    * [Поблагодарить и уйти]
        — Спасибо. Я проверю.
        
        Она кивает. Уходит быстро, не оглядываясь.
        
        ~ track_helpful_action()
        ->->
}
->->

=== reputation_event_threat ===
// Вызывается при низкой репутации и высоком cult_awareness — предупреждение от культа
# mood: horror

{ city_reputation < -20 && cult_awareness >= 15:
    Записка. Под дверью номера. Без конверта.
    
    Красные буквы. Неровный почерк.
    
    "ТЫ СЛИШКОМ МНОГО ЗНАЕШЬ. УЕЗЖАЙ ИЛИ СТАНЕШЬ ОДНИМ ИЗ НИХ."
    
    Внизу — символ. Тот же. Красный.
    
    * [Сохранить записку как улику]
        { not (CluesC ? cult_symbol):
            ~ CluesC += cult_symbol
            ~ sync_evidence_count()
            # clue
            Улика найдена: угрожающая записка с символом культа
        }
        
        Они следят за вами. Они знают, что вы знаете.
        
        Но это — доказательство. Они существуют.
        
        ~ cult_awareness = cult_awareness + 5
        ~ track_cult_exposure()
        ->->
    
    * [Уничтожить записку]
        Вы рвёте бумагу на мелкие куски. Смываете в унитаз.
        
        Паранойя? Или разумная предосторожность?
        
        Они знают, где вы живёте. Это — факт.
        
        -> lose_sanity_safe(2) ->
        ->->
}
->->

=== function reputation_check_information() ===
// Проверка репутации перед получением информации от NPC
// Возвращает модификатор готовности делиться информацией

{ city_reputation >= 50:
    // Высокая репутация — люди охотно делятся
    ~ return 3
}
{ city_reputation > 20:
    // Хорошая репутация — люди готовы говорить
    ~ return 2
}
{ city_reputation >= -20:
    // Нейтральная репутация — стандартно
    ~ return 1
}
{ city_reputation > -50:
    // Плохая репутация — люди неохотно говорят
    ~ return 0
}
// Очень плохая репутация — люди отказываются говорить
~ return -1

=== encounter_helpful ===
# mood: neutral

Старик в телогрейке окликает вас: # style:action

— Товарищ! Из Москвы, да? # speaker:stranger

Не дожидаясь ответа: # style:action

— Библиотека — на площади Ленина. Там подшивки газет есть. Может, пригодятся. Если ищете... ну, вы поняли. # speaker:stranger

Он уходит, не оглядываясь. # style:action

{ not (SecretLocations ? hidden_archive):
    Библиотека. Интересно. Может быть, там есть архивы?
}

->->

=== encounter_suspicious ===
# mood: tense

Чёрная "Волга" медленно проезжает мимо. Тонированные стёкла. Номера — московские.

Вы не первый раз видите эту машину.

Кто-то следит за следователем. Ирония.

~ city_reputation = city_reputation - 2

->->

// ═══════════════════════════════════════════════════════════════════════════════
// ТАЙНЫЕ ЛОКАЦИИ
// ═══════════════════════════════════════════════════════════════════════════════

=== secret_old_mine ===
# mood: horror
# location: old_mine

ЗАБРОШЕННАЯ ШАХТА

{ not (SecretLocations ? old_mine):
    Вы нашли это место случайно — старая тропа за кладбищем, заросшая ельником.
    ~ unlock_location(old_mine)
}

Вход в шахту — чёрный зев в склоне холма. Деревянные крепи сгнили, но проход ещё держится.

Запах — сырость, плесень. И что-то ещё. Сладковатое.

{ has_item(item_flashlight):
    Луч фонаря выхватывает из темноты ржавые рельсы, уходящие вглубь.
    
    * [Войти глубже]
        -> mine_deep
    
    * [Осмотреть вход]
        -> mine_entrance
    
    * [Уйти]
        Не сейчас. Нужно подготовиться.
        -> ep1_night_directions
- else:
    Без фонаря туда не сунуться. Темнота абсолютная.
    -> ep1_night_directions
}

=== mine_entrance ===
На стене у входа — царапины. Нет, не царапины. Символы.

Красный круг. Расходящиеся линии. Знакомо.

{ AfghanMemories ? memory_cave:
    Вы видели это раньше. В Афганистане. В пещерах Гиндукуша.
    
    Как это возможно? Тысячи километров между этими местами.
    
    ~ cult_awareness = cult_awareness + 5
}

{ not (CluesC ? cult_symbol):
    ~ CluesC += cult_symbol
    ~ sync_evidence_count()
    // ФАЗА 2: Артефакт культа укрепляет истинную версию
    ~ boost_theory(5, 5)
    
    УЛИКА: Культовый символ — найден в заброшенной шахте.
}

* [Войти глубже]
    -> mine_deep

* [Вернуться]
    -> ep1_night_directions

=== mine_deep ===
# mood: horror

Вы идёте вглубь. Пятьдесят метров. Сто.

Воздух становится тяжелее. Теплее — странно для подземелья в ноябре.

// Проверяем, все ли туннели исследованы
{ mine_left_visited && mine_center_visited && mine_right_visited:
    Вы уже исследовали все три туннеля. Больше здесь делать нечего.
    
    -> mine_deep_complete
}

Впереди — развилка. Три туннеля.

// ИСПРАВЛЕНО: Добавлен tracking посещённых туннелей для предотвращения бесконечного цикла

* { not mine_left_visited } [Левый туннель]
    ~ mine_left_visited = true
    
    Узкий. Приходится протискиваться боком.

    Через двадцать метров — тупик. Но на полу — старый ящик.

    Внутри — документы. Пожелтевшие, но читаемые.

    "ПРОЕКТ 'ЭХО'. Отчёт №47. Субъект показал устойчивость к воздействию. Рекомендуется увеличить дозировку..."

    { not (CluesB ? experiment_records):
        ~ CluesB += experiment_records
        ~ sync_evidence_count()
        ~ trigger_haptic("clue_found")

        УЛИКА: Записи экспериментов — найдены в шахте.
    }

    -> mine_deep

* { mine_left_visited } [Левый туннель — уже исследован]
    Вы уже осмотрели этот туннель. Там ничего нового.
    -> mine_deep

* { not mine_center_visited } [Центральный туннель]
    ~ mine_center_visited = true
    
    Широкий. Рельсы ведут прямо.

    Через пятьдесят метров — обвал. Дальше не пройти.

    Но сквозь щели в завале... свет? Тусклый, красноватый.

    И звуки. Голоса?

    Нет. Просто эхо. Наверное.

    -> lose_sanity_safe(3) ->

    -> mine_deep

* { mine_center_visited } [Центральный туннель — уже исследован]
    Вы помните тот красноватый свет за обвалом. Не хотите возвращаться туда.
    -> mine_deep

* { not mine_right_visited } [Правый туннель]
    ~ mine_right_visited = true
    
    Влажный. Вода капает с потолка.

    Через тридцать метров — подземное озеро. Чёрная вода, неподвижная как стекло.

    На берегу — кости. Человеческие.

    Сколько им лет? Десятки? Сотни?

    -> lose_sanity_safe(5) ->

    { not (CluesA ? missing_list):
        Это может быть связано с исчезновениями.
    }

    -> mine_deep

* { mine_right_visited } [Правый туннель — уже исследован]
    Вы не хотите снова видеть те кости у подземного озера.
    -> mine_deep

* [Вернуться к выходу]
    Достаточно. Нужно обдумать увиденное.
    -> ep1_night_directions

=== mine_deep_complete ===
// Все туннели исследованы — финальная сцена шахты
# mood: mystery

Вы стоите в развилке, освещая пустые коридоры фонарём.

Все три туннеля исследованы. Документы, кости, странный свет за обвалом...

Здесь больше нечего искать. Но вопросов — больше, чем ответов.

* [Вернуться на поверхность]
    ~ trigger_haptic("scene_transition")
    -> ep1_night_directions

=== city_archive ===
# mood: investigation
# location: archive

ГОРОДСКОЙ АРХИВ # style:title # intensity:medium

Одноэтажное здание на окраине — бывшая школа, переоборудованная под хранилище документов. # style:atmosphere

Архивариус — Мария Фёдоровна, восьмидесятилетняя старушка с острыми глазами и ещё более острой памятью. # style:atmosphere

— Следователь? — Она смотрит на ваше удостоверение. — Давненько к нам никто не заглядывал. # speaker:stranger

— Мне нужны документы по истории города. Довоенные. И раньше, если есть. # speaker:sorokin

Она качает головой. # style:action

— Раньше — мало что осталось. Война, пожар в пятьдесят первом... Но кое-что есть. Пойдёмте. # speaker:stranger

* [Искать записи об экспедиции 1890 года]
    -> archive_expedition

* [Искать записи о пропавших людях]
    -> archive_missing

* [Спросить о местных легендах]
    -> archive_legends

* [Вернуться]
    -> ep1_morning_choice

=== archive_expedition ===

# mood: mystery

~ track_cult_exposure()  // РЕПУТАЦИЯ: расспросы о секретной экспедиции

— Экспедиция? Какая экспедиция? # speaker:stranger

— Восемьсот девяностый год. Географическое общество. # speaker:sorokin

Мария Фёдоровна замирает. Её глаза — расширяются. # style:action

— Откуда вы... # speaker:stranger

— Я читал кое-какие документы. # speaker:sorokin

Долгая пауза. Она оглядывается — словно проверяя, не подслушивает ли кто. # style:action # intensity:medium

— Идёмте. — Её голос — шёпот. — Но это — между нами. # speaker:stranger

Она ведёт вас в дальний угол архива. Старые шкафы, пыльные коробки. Из одной — достаёт папку. Ветхую, с выцветшими чернилами на обложке.

"Дело №127. Экспедиция Корнилова. 1890."

— Это не должно было сохраниться. — Она протягивает папку. — Я спрятала, когда в пятьдесят четвёртом приезжали люди из Москвы. Они забрали всё, что касалось... пещер. Но эту — не нашли. # speaker:stranger

~ AncientArtifacts += artifact_expedition_journal
{ not (CluesD ? expedition_1890):
    ~ CluesD += expedition_1890
    ~ sync_evidence_count()
}

* [Читать]
    Вы открываете папку.
    
    Пожелтевшие страницы. Выцветшие чернила. Но читаемо.
    
    -> lore_expedition_1890_full ->
    
    — Боже мой. # speaker:sorokin
    
    — Теперь понимаете? — Мария Фёдоровна смотрит на вас. — Понимаете, почему люди исчезают? # speaker:stranger
    
    -> archive_continue

* [Спросить, что она знает]
    — Вы читали это? # speaker:sorokin
    
    — Много раз. — Она кивает. — С тех пор, как мой брат... — Она замолкает. # speaker:stranger
    
    — Ваш брат? # speaker:sorokin
    
    — Шестьдесят восьмой год. Работал на заводе. В секретном отделе. Однажды не пришёл домой. # speaker:stranger
    
    ~ understanding_klava += 5
    
    -> archive_continue

=== archive_missing ===

# mood: dark

~ track_cult_exposure()  // РЕПУТАЦИЯ: публичные расспросы о массовых исчезновениях

— Пропавшие? — Мария Фёдоровна вздыхает. — Молодой человек, если бы вы знали, сколько людей пропало в этом городе... # speaker:stranger

Она достаёт толстую тетрадь. Самодельную, в клеёнчатой обложке. # style:action

— Я веду записи. Тридцать лет веду. Неофициально, конечно. Но... кто-то должен помнить. # speaker:stranger

Она открывает тетрадь. Имена. Даты. Краткие пометки.

"Иванов П.С., 1958. Ушёл на рыбалку. Не вернулся."
"Сидорова М.В., 1961. Последний раз видели у леса."
"Козлов А.И., 1965. Работал на заводе. Исчез после ночной смены."

Имена тянутся страница за страницей. Десятки. Сотни.

— Сколько всего? # speaker:sorokin

— За тридцать лет? — Она листает тетрадь. — Двести сорок семь. Официально, конечно, меньше. Многих записали как уехавших, умерших от болезней... # speaker:stranger

{ not (CluesA ? missing_list):
    ~ CluesA += missing_list
    ~ sync_evidence_count()
}
~ cult_awareness += 5

# clue
Улика найдена: неофициальный список пропавших (247 человек)

* [Есть ли закономерность?]
    — Вы не заметили закономерности? # speaker:sorokin
    
    — Заметила. — Она кивает. — Больше всего исчезновений — в ноябре. В полнолуние. И... — Она понижает голос. — Все они слышали голоса. За несколько дней до исчезновения. # speaker:stranger
    
    ~ cult_awareness += 3
    
    -> archive_continue

* [Кто расследовал?]
    — Кто-нибудь расследовал это? # speaker:sorokin
    
    — Было несколько следователей. До вас. — Мария Фёдоровна смотрит в сторону. — Один уехал через три дня. Сказал — дело закрыто. Второй... второй остался дольше. # speaker:stranger
    
    — И? # speaker:sorokin
    
    — Его нашли в лесу. Через неделю. Официально — сердечный приступ. # speaker:stranger
    
    -> lose_sanity_safe(3) ->
    
    -> archive_continue

=== archive_legends ===

# mood: mystery

~ track_cult_exposure()  // РЕПУТАЦИЯ: публичные расспросы о древних легендах

— Легенды? — Мария Фёдоровна усмехается. — Здесь всё — легенда. Весь город. # speaker:stranger

Она садится в кресло. Жестом приглашает вас сесть напротив. # style:action

— Мой дед рассказывал... Он родился здесь, в деревне, которая была до города. Когда-то — давно, ещё при царе — сюда пришли геологи. Искали руду. # speaker:stranger

— Экспедиция Корнилова? # speaker:sorokin

— Раньше. Гораздо раньше. Ещё при Екатерине. Нашли что-то в горах. Что-то... — Она замолкает. — Дед говорил — "нехорошее место". Местные знали. Не ходили туда. # speaker:stranger

~ CultLore += lore_ancient_tribe
~ lore_depth += 3

— А потом? # speaker:sorokin

— Потом — революция. Война. Сталин. Завод построили в пятьдесят втором. А под ним — лаборатории. Секретные. # speaker:stranger

Она наклоняется ближе. # style:action # intensity:medium

— Дед умер в пятьдесят шестом. Но перед смертью сказал мне: "Маша, они открыли Дверь. Нельзя было открывать. Теперь — поздно." # speaker:stranger

~ lore_depth += 5

* [Какую Дверь?]
    — Что за Дверь? # speaker:sorokin
    
    — Не знаю. — Она качает головой. — Но... — Она достаёт из кармана маленький свёрток. Разворачивает. # speaker:stranger
    
    Камень. Чёрный, гладкий. С выцарапанным символом — три линии, сходящиеся к центру круга. # style:action
    
    — Это нашли рядом с дедом. После смерти. В руке зажал. # speaker:stranger
    
    { KeyEvents ? saw_symbol:
        Тот самый символ. Тот, что вы видели на заборе завода. На стенах церкви. В рисунках безумцев.
        
        ~ cult_awareness += 5
    }
    
    ~ AncientArtifacts += artifact_stone_tablet
    
    -> archive_continue

* [Продолжить расспросы]
    -> archive_continue

=== archive_continue ===

Мария Фёдоровна смотрит на вас. Долго. Внимательно.

— Вы не такой, как другие следователи. — Её голос — тихий. — Вы ищете правду. По-настоящему. # speaker:stranger

— Да. # speaker:sorokin

— Тогда будьте осторожны. — Она берёт вас за руку. Её пальцы — холодные, как лёд. — Правда в этом городе... она убивает. Медленно. Или быстро. Но убивает. # speaker:stranger # intensity:high

* [Поблагодарить и уйти]
    — Спасибо, Мария Фёдоровна. Вы очень помогли. # speaker:sorokin
    
    — Помогла... — Она усмехается. — Может быть. А может — погубила. Время покажет. # speaker:stranger
    
    ~ understanding_klava += 10
    ~ trust_vera += 5
    
    -> ep1_morning_choice

* [Спросить, как защититься]
    — Есть ли способ... защититься? # speaker:sorokin
    
    Она молчит. Долго. # style:action
    
    — Не слушайте голоса. Что бы они ни говорили. Что бы ни обещали. Это — ловушка. Всегда ловушка. # speaker:stranger # intensity:high
    
    ~ gain_sanity(5)
    
    -> ep1_morning_choice

=== secret_abandoned_lab ===
# mood: horror
# location: abandoned_lab

ЗАБРОШЕННАЯ ЛАБОРАТОРИЯ # style:title # intensity:high

{ not (SecretLocations ? abandoned_lab):
    Подвал административного здания завода. Официально — бомбоубежище. # style:atmosphere
    ~ unlock_location(abandoned_lab)
}

Но бомбоубежища не оборудуют операционными столами и стеклянными камерами. # style:horror # intensity:medium

{ has_item(item_camera):
    * [Сфотографировать всё]
        Щёлк. Щёлк. Щёлк.
        
        Двенадцать кадров. Если плёнка не засветится — это будет доказательством.
        
        { not (CluesC ? ritual_photos):
            ~ CluesC += ritual_photos
            ~ sync_evidence_count()
            
            УЛИКА: Фотографии лаборатории.
        }
        -> lab_explore
    
    * [Не рисковать — вдруг заметят вспышку]
        -> lab_explore
- else:
    -> lab_explore
}

=== lab_explore ===
На столах — папки. Десятки папок.

"СУБЪЕКТ 1" — "СУБЪЕКТ 34"

Внутри — медицинские карты. Фотографии. Протоколы... чего?

"Воздействие частотой 7.83 Гц. Субъект демонстрирует повышенную внушаемость..."

"Субъект 12 утверждает, что слышит голоса. Рекомендуется изоляция."

"Субъект 23 скончался. Причина — остановка сердца. Вскрытие показало аномалии в структуре мозга."

{ not (CluesB ? echo_docs):
    ~ CluesB += echo_docs
    ~ sync_evidence_count()
    
    УЛИКА: Документы "Проекта Эхо".
}

* [Искать дальше]
    В дальнем углу — сейф. Открыт.
    
    Внутри — одна папка. "СОВЕРШЕННО СЕКРЕТНО. ТОЛЬКО ДЛЯ ОЗНАКОМЛЕНИЯ."
    
    "Проект 'Эхо' закрыт решением Политбюро от 14.09.1983. Все материалы подлежат уничтожению."
    
    Но материалы здесь. Значит, кто-то не выполнил приказ.
    
    Или — проект не был закрыт на самом деле.
    
    ~ cult_awareness = cult_awareness + 5
    -> ep1_night_directions

* [Уйти — здесь слишком опасно]
    Вы слышите шаги наверху. Пора уходить.
    -> ep1_night_directions

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ДОПРОСА (РАЗНЫЕ ПОДХОДЫ)
// ═══════════════════════════════════════════════════════════════════════════════

=== interrogation_choice ===
// Универсальный выбор стиля допроса
// Вызывается как туннель: -> interrogation_choice ->

* [Жёсткий допрос — давить на подозреваемого]
    ~ change_style(5)
    ~ track_aggressive_action()  // РЕПУТАЦИЯ: агрессия замечена
    Вы повышаете голос. Наклоняетесь вперёд. Глаза в глаза.

    "Я знаю, что вы лжёте. И вы знаете, что я знаю. Давайте не будем тратить время."

    ->->

* [Дипломатия — расположить к себе]
    ~ change_style(-5)
    ~ track_helpful_action()  // РЕПУТАЦИЯ: дружелюбие замечено
    Вы улыбаетесь. Предлагаете сигарету.
    
    "Послушайте, я понимаю — вы боитесь. Но я здесь не для того, чтобы кого-то наказывать. Я ищу правду. Помогите мне — и я помогу вам."
    
    ->->

* [Хитрость — притвориться, что знаете больше]
    Вы достаёте блокнот. Делаете вид, что читаете.
    
    "Интересно... Здесь написано, что вас видели в ту ночь у леса. И ещё — что вы разговаривали с Зориным за день до исчезновения. Хотите объяснить?"
    
    (Вы блефуете. Но собеседник этого не знает.)
    
    ->->

* { has_item(item_vodka) } [Подкуп — угостить водкой]
    Вы достаёте бутылку "Столичной".
    
    "Холодно. Может, согреемся? За разговором..."
    
    ~ remove_item(item_vodka)
    ~ city_reputation = city_reputation + 5
    ->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА КОМБИНИРОВАНИЯ УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== combine_evidence ===
# mood: investigation

Вы раскладываете собранные материалы на столе. Пытаетесь найти связи.

{ can_combine_clues(combo_witnesses) && not (ClueCombinations ? combo_witnesses):
    * [Сравнить показания свидетелей]
        Иванов видел Зорина в 18:50 на улице Ленина.
        Кузнецова видела его в то же время у гастронома.
        
        Эти места — в двух километрах друг от друга.
        
        Кто-то лжёт. Или... оба говорят правду?
        
        Два Зорина? Бред. Но...
        
        "Проект Эхо". Эксперименты с сознанием. Что, если они научились чему-то... неестественному?
        
        ~ combine_clues(combo_witnesses)
        
        ОТКРЫТИЕ: Противоречия в показаниях — возможно, связаны с экспериментами.
        
        -> combine_evidence
}

{ can_combine_clues(combo_project) && not (ClueCombinations ? combo_project):
    * [Связать документы "Эха" с записями экспериментов]
        "Проект Эхо" — официально закрыт в 1983.
        
        Но записи экспериментов датированы 1985-1986 годами.
        
        Кто-то продолжал работу. В тайне. После официального закрытия.
        
        Вопрос: кто финансировал? И зачем?
        
        ~ combine_clues(combo_project)
        
        ОТКРЫТИЕ: "Проект Эхо" продолжался нелегально после официального закрытия.
        
        -> combine_evidence
}

{ can_combine_clues(combo_cult_history) && not (ClueCombinations ? combo_cult_history):
    * [Связать культовые символы с историей экспедиции]
        Экспедиция 1890 года нашла древние символы в уральских пещерах.
        
        Те же символы — в шахте. На стенах лаборатории.
        
        Культу — больше ста лет? Или... ещё больше?
        
        Что они нашли в тех пещерах?
        
        ~ combine_clues(combo_cult_history)
        ~ cult_awareness = cult_awareness + 5
        
        ОТКРЫТИЕ: Культ существует как минимум с 1890 года.
        
        -> combine_evidence
}

{ can_combine_clues(combo_victims) && not (ClueCombinations ? combo_victims):
    * [Связать список пропавших с ритуальными фотографиями]
        Семь пропавших за два года. Все — работники завода "Прометей".
        
        На ритуальных фото — семь фигур в капюшонах.
        
        Совпадение? Или пропавшие стали... частью чего-то?
        
        Жертвы? Или участники?
        
        ~ combine_clues(combo_victims)
        
        ОТКРЫТИЕ: Пропавшие могут быть связаны с ритуалами.
        
        -> combine_evidence
}

* [Закончить анализ]
    Пока достаточно. Нужно собрать больше материала.
    -> ep1_night_choice

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ДНЕВНИКА / ЖУРНАЛА СЛЕДОВАТЕЛЯ
// ═══════════════════════════════════════════════════════════════════════════════

=== investigator_journal ===
# mood: investigation
# ui: journal

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 ЖУРНАЛ СЛЕДОВАТЕЛЯ — ГЛАВНЫЙ ЭКРАН
// ═══════════════════════════════════════════════════════════════════════════════

ЖУРНАЛ СЛЕДОВАТЕЛЯ

ДЕНЬ {current_day}/5 • {time_of_day == 0:Утро}{time_of_day == 1:День}{time_of_day == 2:Вечер}{time_of_day == 3:Ночь}

🧠 Рассудок: {sanity}% • ☣️ Заражение: {infection_level}%
🔍 Улик: {count_all_clues()} • 📊 Осведомлённость: {cult_awareness}%

// ═══ РЕПУТАЦИЯ ═══
🏘️ РЕПУТАЦИЯ: {city_reputation <= -50:ВРАГ}{city_reputation < -20 && city_reputation > -50:Подозрительный}{city_reputation >= -20 && city_reputation <= 20:Нейтральная}{city_reputation > 20 && city_reputation < 50:Дружелюбная}{city_reputation >= 50:СВОЙ} ({city_reputation})

// ═══ СЛУХИ ═══
{ LIST_COUNT(Rumors) > 0:
    💬 СЛУХИ О ВАС:
    { Rumors ? rumor_dangerous: • 🔴 "Опасный, может посадить" }
    { Rumors ? rumor_honest: • 🟢 "Честный, ищет правду" }
    { Rumors ? rumor_crazy: • 🟡 "Сумасшедший" }
    { Rumors ? rumor_cultist: • 🟣 "Связан с теми из леса" }
    { Rumors ? rumor_hero: • 🔵 "Герой, спас человека" }
}

// ═══ СТИЛЬ РАССЛЕДОВАНИЯ ═══
🎯 СТИЛЬ: {is_aggressive():Агрессивный}{is_diplomatic():Дипломатичный}{not is_aggressive() && not is_diplomatic():Сбалансированный}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

* [📁 Улики ({count_all_clues()})]
    -> journal_clues

* [👥 Контакты]
    -> journal_contacts

* [💭 Теории]
    -> journal_theories

* [🔗 Связи улик]
    -> journal_clue_combinations

* [✖️ Закрыть]
    -> ep1_night_choice

=== journal_clues ===
# mood: investigation
# ui: journal

📁 СОБРАННЫЕ УЛИКИ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ КАТЕГОРИЯ A: ДОКУМЕНТЫ МИЛИЦИИ ═══
{ CluesA ? missing_list || CluesA ? false_reports || CluesA ? witness_conflict:
    🚔 МАТЕРИАЛЫ МИЛИЦИИ:
    { CluesA ? missing_list: • 📋 Список пропавших — 7 человек за 2 года }
    { CluesA ? false_reports: • 📝 Ложные рапорты — милиция скрывает информацию }
    { CluesA ? witness_conflict: • ❓ Противоречия показаний — свидетели лгут или...? }
}

// ═══ КАТЕГОРИЯ B: СЕКРЕТНЫЙ ПРОЕКТ ═══
{ CluesB ? echo_docs || CluesB ? experiment_records || CluesB ? underground_map || CluesB ? access_pass:
    🔬 ПРОЕКТ "ЭХО":
    { CluesB ? echo_docs: • 📂 Документы проекта — секретные эксперименты }
    { CluesB ? experiment_records: • 🧪 Записи экспериментов — опыты на людях }
    { CluesB ? underground_map: • 🗺️ Карта подземелий — сеть туннелей под городом }
    { CluesB ? access_pass: • 🔑 Пропуск доступа — ключ к секретным зонам }
}

// ═══ КАТЕГОРИЯ C: КУЛЬТ ═══
{ CluesC ? cult_symbol || CluesC ? chernov_diary || CluesC ? ritual_photos:
    🕯️ КУЛЬТ:
    { CluesC ? cult_symbol: • ⭕ Культовые символы — древние знаки }
    { CluesC ? chernov_diary: • 📖 Дневник Чернова — ключ к разгадке }
    { CluesC ? ritual_photos: • 📷 Ритуальные фото — доказательство культа }
}

// ═══ КАТЕГОРИЯ D: ИСТОРИЯ ═══
{ CluesD ? expedition_1890:
    📜 ИСТОРИЯ:
    { CluesD ? expedition_1890: • 🗿 Экспедиция 1890 — история началась давно }
}

// ═══ КАТЕГОРИЯ E: ПОКАЗАНИЯ ═══
{ CluesE ? fyodor_map || CluesE ? vera_research || CluesE ? gromov_confession:
    🗣️ ПОКАЗАНИЯ:
    { CluesE ? fyodor_map: • 🗺️ Карта Фёдора — тайные ходы }
    { CluesE ? vera_research: • 🔬 Исследования Веры — медицинские данные }
    { CluesE ? gromov_confession: • 💔 Признание Громова — его жена пропала }
}

// ═══ ПУСТО ═══
{ count_all_clues() == 0:
    🔍 Пока ничего не найдено. Продолжайте расследование.
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

* [← Назад к журналу]
    -> investigator_journal

=== journal_contacts ===
# mood: investigation
# ui: journal

👥 КОНТАКТЫ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ ГРОМОВ ═══
{ MetCharacters ? gromov:
    👮 СТЕПАН ГРОМОВ — Майор милиции
    { trust_gromov >= 60: • 💚 Отношения: ДОВЕРИЕ }
    { trust_gromov >= 30 && trust_gromov < 60: • 💛 Отношения: Нейтральные }
    { trust_gromov < 30 && trust_gromov >= 0: • 🟠 Отношения: Напряжённые }
    { trust_gromov < 0: • ❤️‍🔥 Отношения: ВРАЖДЕБНОСТЬ }
    { gromov_is_ally: • ⭐ Союзник в расследовании }
}

// ═══ ТАНЯ ═══
{ MetCharacters ? tanya:
    👩 ТАНЯ ЗОРИНА — Дочь пропавшего
    { Relationships ? romantic_tanya: • 💕 Отношения: РОМАНТИЧЕСКИЕ }
    { not (Relationships ? romantic_tanya) && trust_tanya >= 60: • 💚 Отношения: БЛИЗКИЕ }
    { not (Relationships ? romantic_tanya) && trust_tanya >= 30 && trust_tanya < 60: • 💛 Отношения: Дружеские }
    { not (Relationships ? romantic_tanya) && trust_tanya < 30: • 🟠 Отношения: Формальные }
    { reputation_helped_tanya: • ⭐ Вы спасли ей жизнь }
}

// ═══ ВЕРА ═══
{ MetCharacters ? vera:
    👩‍⚕️ ВЕРА ХОЛОДОВА — Психиатр
    { trust_vera >= 60: • 💚 Отношения: ДОВЕРИЕ }
    { trust_vera >= 30 && trust_vera < 60: • 💛 Отношения: Профессиональные }
    { trust_vera < 30: • 🟠 Отношения: Осторожные }
    { CharacterSecrets ? vera_past: • 📖 Знаете её историю }
}

// ═══ СЕРАФИМ ═══
{ MetCharacters ? serafim:
    ⛪ ОТЕЦ СЕРАФИМ — Священник
    { trust_serafim >= 60: • 💚 Отношения: ДРУГ }
    { trust_serafim >= 30 && trust_serafim < 60: • 💛 Отношения: Уважительные }
    { trust_serafim < 30: • 🟠 Отношения: Настороженные }
    { KeyEvents ? serafim_kidnapped: • ❌ ПОХИЩЕН }
}

// ═══ ФЁДОР ═══
{ MetCharacters ? fyodor:
    🧔 ФЁДОР — Отшельник
    { KeyEvents ? found_fyodor_body: • ☠️ МЁРТВ }
    { not (KeyEvents ? found_fyodor_body) && Relationships ? trusted_fyodor: • 💚 Отношения: СОЮЗНИК }
    { not (KeyEvents ? found_fyodor_body) && trust_fyodor >= 30 && not (Relationships ? trusted_fyodor): • 💛 Отношения: Доверительные }
    { not (KeyEvents ? found_fyodor_body) && trust_fyodor < 30: • 🟠 Отношения: Пугливый }
    { reputation_saved_someone: • ⭐ Вы спасли ему жизнь }
}

// ═══ АСТАХОВ ═══
{ MetCharacters ? astahov:
    🕵️ ПОЛКОВНИК АСТАХОВ — КГБ
    { trust_astahov >= 0: • 🟠 Отношения: Напряжённые }
    { trust_astahov < 0: • ❤️‍🔥 Отношения: ВРАЖДЕБНЫЕ }
    { trust_astahov < -10: • ⚠️ Следит за вами }
}

// ═══ ПУСТО ═══
{ not (MetCharacters ? gromov) && not (MetCharacters ? tanya) && not (MetCharacters ? vera):
    👤 Контактов пока нет. Знакомьтесь с жителями города.
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

* [← Назад к журналу]
    -> investigator_journal

// ═══════════════════════════════════════════════════════════════════════════════
// ФАЗА 3: КОМБИНАЦИИ УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== journal_clue_combinations ===
# mood: investigation
# ui: journal

🔗 СВЯЗИ УЛИК

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ ДОСТУПНЫЕ КОМБИНАЦИИ ═══
{ can_combine_clues(combo_witnesses) && not (ClueCombinations ? combo_witnesses):
    ⭐ НОВАЯ СВЯЗЬ: Противоречия + Рапорты → Заговор молчания
    
    * [🔓 Объединить]
        ~ combine_clues(combo_witnesses)
        
        # style:important # intensity:high
        
        Вы сопоставляете показания свидетелей с официальными рапортами.
        
        Картина проясняется: они ВСЕ лгут. Не потому что преступники — потому что боятся.
        
        ~ boost_theory(4, 15)
        ~ personal_vendetta = personal_vendetta + 10
        
        # insight
        💡 СВЯЗЬ ОБНАРУЖЕНА: Заговор молчания охватывает весь город
        
        -> journal_clue_combinations
    
    * [Позже]
        -> journal_clue_combinations
}

{ can_combine_clues(combo_project) && not (ClueCombinations ? combo_project):
    ⭐ НОВАЯ СВЯЗЬ: Документы "Эхо" + Записи → Масштаб проекта
    
    * [🔓 Объединить]
        ~ combine_clues(combo_project)
        
        # style:important # intensity:high
        
        Проект "Эхо" — не просто эксперименты. Это попытка установить контакт с чем-то... нечеловеческим.
        
        ~ boost_theory(5, 15)
        ~ cult_awareness = cult_awareness + 5
        
        # insight
        💡 СВЯЗЬ ОБНАРУЖЕНА: Проект "Эхо" — попытка контакта с потусторонним
        
        -> journal_clue_combinations
    
    * [Позже]
        -> journal_clue_combinations
}

{ can_combine_clues(combo_cult_history) && not (ClueCombinations ? combo_cult_history):
    ⭐ НОВАЯ СВЯЗЬ: Символы + Экспедиция 1890 → Древняя история
    
    * [🔓 Объединить]
        ~ combine_clues(combo_cult_history)
        
        # style:important # intensity:high
        
        Символы — одинаковые. В пещерах, на стенах, в старых записях.
        
        Этому культу — тысячи лет. Советские учёные просто нашли его. И разбудили.
        
        ~ boost_theory(5, 20)
        ~ cult_awareness = cult_awareness + 8
        ~ lore_depth = lore_depth + 5
        
        # insight
        💡 СВЯЗЬ ОБНАРУЖЕНА: Культ существует тысячи лет
        
        -> journal_clue_combinations
    
    * [Позже]
        -> journal_clue_combinations
}

{ can_combine_clues(combo_victims) && not (ClueCombinations ? combo_victims):
    ⭐ НОВАЯ СВЯЗЬ: Список пропавших + Ритуальные фото → Судьба жертв
    
    * [🔓 Объединить]
        ~ combine_clues(combo_victims)
        
        # style:dramatic # intensity:high
        
        Вы сопоставляете имена из списка с лицами на фотографиях.
        
        { knows_vanished_comrade:
            Сергей. Ваш товарищ по Афгану. Он — на одной из фотографий. В белой мантии. Среди жертв.
            ~ personal_vendetta = personal_vendetta + 30
            -> lose_sanity_safe(5) ->
        - else:
            Лица. Имена. Судьбы. Каждый из них был кем-то — мужем, отцом, сыном.
            ~ personal_vendetta = personal_vendetta + 15
        }
        
        # insight
        💡 СВЯЗЬ ОБНАРУЖЕНА: Пропавшие — жертвы ритуалов
        
        -> journal_clue_combinations
    
    * [Позже]
        -> journal_clue_combinations
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ РАСКРЫТЫЕ СВЯЗИ ═══
{ LIST_COUNT(ClueCombinations) > 0:
    ✅ РАСКРЫТЫЕ СВЯЗИ:
    { ClueCombinations ? combo_witnesses: • ✓ Заговор молчания }
    { ClueCombinations ? combo_project: • ✓ Масштаб "Проекта Эхо" }
    { ClueCombinations ? combo_cult_history: • ✓ Древняя история культа }
    { ClueCombinations ? combo_victims: • ✓ Судьба жертв }
}

// ═══ НЕТ КОМБИНАЦИЙ ═══
{ not can_combine_clues(combo_witnesses) && not can_combine_clues(combo_project) && not can_combine_clues(combo_cult_history) && not can_combine_clues(combo_victims):
    { LIST_COUNT(ClueCombinations) == 0:
        🔍 Недостаточно улик. Соберите больше информации.
    - else:
        ✅ Все связи установлены. Отличная работа!
    }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

* [← Назад к журналу]
    -> investigator_journal

=== journal_theories ===
# mood: investigation
# ui: journal

💭 ВЕРСИИ РАССЛЕДОВАНИЯ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ ЛОЖНЫЕ ВЕРСИИ (ОПРОВЕРЖИМЫЕ) ═══
{ theory_chemical > 0:
    { chemical_debunked:
        ❌ ОПРОВЕРГНУТО: Химическое отравление
    - else:
        🧪 Химическое отравление — Уверенность: {theory_chemical}%
    }
}

{ theory_gromov > 0:
    { gromov_debunked:
        ❌ ОПРОВЕРГНУТО: Громов — убийца
    - else:
        👮 Громов — серийный убийца — Уверенность: {theory_gromov}%
    }
}

{ theory_serafim > 0:
    { serafim_debunked:
        ❌ ОПРОВЕРГНУТО: Серафим — сектант
    - else:
        ⛪ Серафим — фанатик — Уверенность: {theory_serafim}%
    }
}

// ═══ ИСТИННЫЕ ВЕРСИИ ═══
{ theory_conspiracy > 0:
    🏛️ Государственный заговор — Уверенность: {theory_conspiracy}%
}

{ theory_cult > 0 || cult_awareness >= 10:
    🕯️ ТАЙНЫЙ КУЛЬТ — Осведомлённость: {cult_awareness}%
    { cult_awareness >= 30: ★ ОСНОВНАЯ ВЕРСИЯ — Исчезновения = жертвоприношения }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ СТАТИСТИКА ═══
{ theories_debunked >= 1:
    📊 Опровергнуто версий: {theories_debunked}
    { theories_debunked >= 3: 💡 Истина где-то рядом... }
}

// ═══ ВАЖНЫЕ СОБЫТИЯ ═══
{ knows_deadline:
    ⏰ ДЕДЛАЙН: Полнолуние через {ritual_countdown} {ritual_countdown == 1: день|дня}
    { ritual_countdown <= 2: ❗ ВРЕМЯ НА ИСХОДЕ! }
}

{ knows_vanished_comrade:
    ⭐ ЛИЧНОЕ: Сергей Коршунов — мой товарищ из Афганистана — среди пропавших
}

{ sorokin_infected:
    ☣️ ЗАРАЖЕНИЕ: Я начинаю видеть ТО ЖЕ, что они. Уровень: {infection_level}%
    { infection_level >= 50: ⚠️ КРИТИЧЕСКИЙ УРОВЕНЬ }
}

// ═══ ПУСТО ═══
{ theories_debunked == 0 && theory_chemical + theory_gromov + theory_serafim == 0 && cult_awareness < 10:
    🔍 Недостаточно данных. Соберите больше информации.
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

* [← Назад к журналу]
    -> investigator_journal

// ═══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 1: ПРИБЫТИЕ
// ═══════════════════════════════════════════════════════════════════════════════

=== episode1_intro ===

# chapter: 1
# mood: mystery
# title: Прибытие

15 НОЯБРЯ 1986 ГОДА # style:title # intensity:high

Красногорск-12, Средний Урал # style:subtitle

... # style:atmosphere # intensity:low

Автобус дёргается в последний раз и замирает. Тормоза визжат — звук, от которого сводит зубы. За грязным стеклом — серая пелена ноябрьского утра, размытые силуэты вышек, ржавые зубья колючей проволоки на бетонном заборе. # style:atmosphere

Закрытый город. Один из сотен безымянных точек на карте СССР. Города, которых официально не существует. # style:important

— Конечная, — хрипит водитель, не оборачиваясь. Его затылок красный, как варёная свёкла. Всю дорогу он молчал, только курил папиросы одну за другой. — Приехали, товарищ. # speaker:driver

Вы единственный пассажир. Уже шесть часов — единственный. # style:thought

На соседнем сиденье — потёртый портфель с документами. На коленях — служебная папка. Внутри — докладная записка, отпечатанная на жёлтой бумаге: # style:atmosphere

"СЕКРЕТНО. Красногорск-12. За период 1984-1986 гг. зафиксировано семь (7) случаев исчезновения граждан. Тела не обнаружены. Местные органы бездействуют. Рекомендуется направить следователя по особо важным делам для проверки." # style:document

Следователь Виктор Андреевич Сорокин. Сорок два года. Разведён. Детей нет. # style:thought

Восемь лет назад — Афганистан. Два года в горах, где люди исчезали каждую ночь. Вернулся с медалью и бессонницей, которая не отпускает до сих пор. # style:flashback

В три часа ночи вы обычно лежите, глядя в потолок. Считаете трещины на штукатурке. Иногда — слышите голоса тех, кого не смогли спасти. # style:thought

Вас послали сюда, потому что вы — упрямый. Потому что не умеете отступать. И потому что никто другой не согласился ехать в эту глушь в разгар зимы. # style:thought

"Простая командировка", — сказал начальник. — "Неделя максимум. Съездишь, напишешь отчёт, вернёшься". # style:flashback

Почему-то вы ему не поверили. # style:dramatic

За окном автобуса — лес. Чёрные сосны стоят плотной стеной, как часовые. Их кроны покачиваются на ветру, хотя внизу — полный штиль. # style:atmosphere # intensity:medium

Странно. # style:dramatic # intensity:high

* [Выйти из автобуса]
    Вы поднимаетесь, забираете портфель. Спина ноет после шести часов на жёсткой скамейке. # style:action
    
    Водитель всё так же смотрит вперёд. Не прощается. Не желает удачи. # style:atmosphere # intensity:low
    
    Дверь открывается со скрипом. # style:atmosphere
    
    -> ep1_checkpoint

=== ep1_checkpoint ===

# mood: tense

Холод обрушивается сразу — жёсткий, колючий, пробирающий до костей. Минус пятнадцать, не меньше. Ветер несёт мелкий снег, который сечёт лицо, как наждачная бумага. # style:atmosphere

Пахнет серой — резкий, химический запах, от которого першит в горле. И хвоей — густой, смолистый аромат тайги. И ещё чем-то... сладковатым? Странным? # style:atmosphere

Вы делаете глубокий вдох. Лёгкие обжигает. # style:action

КПП — бетонная будка с узкими окнами-бойницами. Над дверью — красная звезда, облупившаяся от времени. Рядом — шлагбаум, полосатый, как зебра. За ним — вышка с прожектором, выключенным сейчас, но направленным прямо на дорогу. # style:atmosphere # intensity:medium

Двое солдат в серых тулупах. Молодые — лет по двадцать. У одного — автомат на плече, у другого — планшет с документами. Лица красные от холода, глаза настороженные. # style:atmosphere

Они смотрят на вас так, словно вы — инопланетянин. # style:thought

Первый солдат — тот, что с планшетом — делает шаг навстречу. Протягивает руку: # style:action

— Документы. Цель визита. # speaker:soldier

Вы достаёте удостоверение. Красная корочка с золотым тиснением. "Прокуратура РСФСР. Следователь по особо важным делам." # style:action

— Командировка. Служебное расследование. # speaker:sorokin

Солдат берёт удостоверение. Изучает. Долго — слишком долго. Его напарник отступает к будке, снимает телефонную трубку, говорит что-то тихо, прикрывая рот ладонью. # style:thought

За забором — город. Пятиэтажки, дымящие трубы завода, площадь с памятником. Всё серое, размытое в снежной пелене. # style:atmosphere # intensity:medium

И лес. Везде — лес. Чёрной стеной окружает город со всех сторон. # style:horror # intensity:medium

— Ждите. # speaker:soldier

Солдат возвращает удостоверение. Отступает. # style:action

Вы ждёте. Минута. Две. Три. # style:dramatic # intensity:medium

Снег забивается за воротник. Ноги начинают неметь. Автобус за спиной — уезжает, не дождавшись. Водитель даже не посигналил на прощание. # style:atmosphere # intensity:high

Вы остались одни. # style:dramatic # intensity:high

Наконец — скрип двери КПП. Выходит офицер. Старший лейтенант, судя по погонам. Лицо — серое, усталое. Под глазами — тёмные круги. Он выглядит так, словно не спал неделю. # style:thought # intensity:medium

— Следователь Сорокин? # speaker:officer

— Да. # speaker:sorokin

— Вас ждут. — Он указывает на "УАЗик", припаркованный за шлагбаумом. — Садитесь. Отвезу. # speaker:officer

* [Пройти молча — наблюдать]
    Вы молча идёте к машине. Наблюдаете. # style:action
    
    ~ change_style(-3)
    
    Офицер нервничает. Его руки слегка дрожат, когда он открывает дверь "УАЗика". Под ногтями — чёрная грязь. Или... что-то другое? # style:thought # intensity:medium
    
    На заднем сиденье машины — папка. Красная. "ДСП" — для служебного пользования. Офицер быстро убирает её в бардачок. # style:important
    
    Интересно. Что они скрывают? # style:thought # intensity:high
    
    -> ep1_silent_observation

* [Задать вопросы — кто такой Громов?]
    Вы делаете шаг к машине. Останавливаетесь. # style:action
    
    — Кто ждёт? # speaker:sorokin
    
    — Майор Громов. Степан Петрович. Начальник городского отдела милиции. # speaker:officer
    
    Офицер не смотрит вам в глаза. Его взгляд скользит мимо — куда-то в сторону леса. # style:thought
    
    — Он... в курсе вашего приезда. # speaker:officer
    
    Что-то в его голосе. Предупреждение? Страх? # style:thought # intensity:medium
    
    -> ep1_ask_about_gromov

* [Показать власть — потребовать уважения]
    — Я буду ждать в тепле, — говорите вы холодно. — Проводите меня в здание КПП. # speaker:sorokin

    ~ change_style(5)
    ~ track_aggressive_action()  // РЕПУТАЦИЯ: демонстрация власти
    ~ city_reputation = city_reputation - 5

    Офицер открывает рот, чтобы возразить, но что-то в вашем взгляде останавливает его. # style:thought # intensity:low
    
    — Как скажете, товарищ следователь. # speaker:officer
    
    Внутри КПП — тепло и накурено. На стене — портрет Генсека, календарь с видами Крыма, расписание дежурств. # style:atmosphere # intensity:low
    
    Вы замечаете доску объявлений. "ВНИМАНИЕ! При обнаружении посторонних лиц в районе <<Красного леса>> — НЕМЕДЛЕННО сообщать дежурному!" # style:important # intensity:high
    
    <<Красный лес>>. Интересно. # style:thought # intensity:high
    
    -> ep1_kpp_inside

* [Осмотреться — изучить территорию]
    Вы делаете вид, что идёте к машине, но замедляете шаг. Оглядываетесь. # style:action # intensity:medium
    
    За КПП — ещё одна вышка. На ней — часовой с биноклем. Смотрит не на дорогу — на лес. # style:thought # intensity:medium
    
    У забора — следы. Странные следы. Не человеческие, не звериные. Что-то среднее. # style:important # intensity:high
    
    Вы наклоняетесь, будто завязываете шнурок. Рассматриваете следы ближе. # style:action
    
    Пять пальцев. Но слишком длинные. И когти. # style:horror # intensity:high # effect:glitch
    
    { not (AfghanMemories ? memory_cave):
        Это напоминает вам кое-что из прошлого...
        -> flashback_cave ->
    }
    
    ~ cult_awareness = cult_awareness + 1
    
    Офицер окликает:
    — Товарищ следователь? Машина ждёт. # speaker:officer
    
    -> ep1_city_entrance

=== ep1_silent_observation ===
# mood: mystery

Вы садитесь в машину. Молчите. Наблюдаете. # style:action # intensity:medium

Офицер ведёт "УАЗик" по разбитой дороге. Его глаза — в зеркале заднего вида — несколько раз ловят ваш взгляд. Он нервничает всё больше. # style:thought # intensity:medium

— Вы... надолго к нам? — наконец спрашивает он. # speaker:officer

* [Молчать дальше]
    Вы не отвечаете. Просто смотрите в окно. # style:action
    
    Офицер сглатывает. Его адамово яблоко дёргается. # style:thought # intensity:low
    
    — Понимаю. Секретность. Конечно. # speaker:officer
    
    Молчание продолжается. Вы узнаёте больше из этого молчания, чем из любых слов. # style:thought # intensity:medium
    
    Офицер боится. Не вас — чего-то другого. # style:important # intensity:high
    
    -> ep1_city_entrance

* ["Пока не закончу работу"]
    — Пока не закончу работу. # speaker:sorokin
    
    — А... какая работа? Если не секрет, конечно. # speaker:officer
    
    — Секрет. # speaker:sorokin
    
    Офицер замолкает. Но его руки на руле дрожат сильнее. # style:thought # intensity:medium
    
    -> ep1_city_entrance

* [Спросить про "Красный лес"]
    — Что такое "Красный лес"? # speaker:sorokin
    
    Офицер резко поворачивает голову. Машина вильяет. # style:action
    
    — Что? Где вы... — Он осекается. — Это... просто лес. К востоку от города. Там... старые шахты. Опасно. Мы туда не ходим. # speaker:officer
    
    — Почему "красный"? # speaker:sorokin
    
    — Сосны там... какие-то... красноватые. От почвы, наверное. Или от... не знаю. # speaker:officer
    
    Он явно врёт. Или не говорит всего. # style:thought # intensity:high
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_city_entrance

=== ep1_ask_about_gromov ===
# mood: tense

— Расскажите о Громове, — говорите вы, садясь в машину. # speaker:sorokin

Офицер заводит двигатель. Не сразу отвечает. # style:thought # intensity:low

— Степан Петрович? Хороший человек. Строгий, но справедливый. Двадцать лет в органах. Воевал. Награждён. # speaker:officer

— Но? # speaker:sorokin

Офицер бросает на вас быстрый взгляд. # style:thought # intensity:medium

— Нет никакого "но", товарищ следователь. # speaker:officer

* [Надавить — "Вы что-то скрываете"]
    — Я вижу, когда люди врут, — говорите вы холодно. — Двадцать лет практики. Так что — "но"? # speaker:sorokin

    ~ change_style(5)
    ~ track_aggressive_action()  // РЕПУТАЦИЯ: давление на офицера

    Офицер бледнеет. # style:action
    
    — Я... После этих исчезновений... Степан Петрович изменился. Стал... замкнутым. Нервным. Иногда уезжает ночью. Никому не говорит — куда. # speaker:officer
    
    Он сглатывает. # style:action # intensity:low
    
    — Я ничего не говорил. Вы ничего не слышали. Договорились? # speaker:officer
    
    ~ trust_gromov = trust_gromov - 5
    ~ boost_theory(2, 10)
    
    Интересно. Начальник милиции — нервный, скрытный, уезжает по ночам. Классический профиль человека с секретом. Или... виновного? # style:important # intensity:high
    
    -> ep1_city_entrance

* [Сменить тему — спросить про исчезновения]
    — Ладно. Расскажите про исчезновения. # speaker:sorokin
    
    — Это... не моя компетенция. Громов всё объяснит. # speaker:officer
    
    — Но вы слышали разговоры. Что говорят люди? # speaker:sorokin
    
    Офицер долго молчит. "УАЗик" подпрыгивает на колдобине. # style:atmosphere # intensity:low
    
    — Говорят... что лес забирает. Что это проклятие. Что началось после... — Он осекается. — Глупости. Суеверия. Не обращайте внимания. # speaker:officer
    
    — После чего началось? # speaker:sorokin
    
    — После закрытия старой шахты. В восемьдесят третьем. Но это просто совпадение. # speaker:officer
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_city_entrance

* [Просто наблюдать]
    Вы киваете и смотрите в окно. # style:action
    
    Сиденье — ледяное. Движок работает, но печка, похоже, сломана. # style:atmosphere # intensity:low
    
    "УАЗик" трогается. Шлагбаум поднимается. # style:action
    
    Добро пожаловать в Красногорск-12. # style:dramatic # intensity:medium
    
    -> ep1_city_entrance

=== ep1_kpp_inside ===
# mood: investigation

Вы осматриваете КПП. Тесная комнатушка. Стол, телефон, сейф. # style:atmosphere # intensity:low

На столе — журнал регистрации. Открыт на последней странице. # style:important

* [Заглянуть в журнал]
    Пока офицер отвлёкся, вы быстро просматриваете записи. # style:action
    
    "14.11.86 — Грузовик ЗИЛ-130, гос. номер XXXXXX, груз: оборудование. Назначение: завод 'Прометей'. Разрешение — Астахов А.В." # style:document
    
    Астахов. Это имя ещё всплывёт. # style:thought # intensity:medium
    
    "12.11.86 — Чёрная 'Волга', гос. номер — ЗАСЕКРЕЧЕНО. Три пассажира. Разрешение — ОСОБОЕ." # style:document # intensity:high
    
    Чёрная "Волга" с засекреченными номерами. За три дня до вашего приезда. # style:thought # intensity:high
    
    Кто-то знал, что вы приедете? # style:thought # intensity:high
    
    ~ cult_awareness = cult_awareness + 1
    
    Офицер возвращается. # style:action
    
    — Товарищ следователь? Машина готова. # speaker:officer
    
    -> ep1_city_entrance

* [Спросить про "Красный лес"]
    — Я заметил объявление. "Красный лес". Что это за место? # speaker:sorokin
    
    Офицер, наливавший чай, замирает. # style:action
    
    — Это... закрытая зона. Старые выработки. Там... опасно. Обвалы. # speaker:officer
    
    — А почему "немедленно сообщать"? Из-за обвалов? # speaker:sorokin
    
    Он ставит чайник. Руки дрожат. # style:thought # intensity:medium
    
    — Там иногда... пропадают люди. Которые не слушают предупреждений. Мы должны знать, если кто-то туда пошёл. Для спасательных операций. # speaker:officer
    
    Логично. Но он явно недоговаривает. # style:thought # intensity:high
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_city_entrance

* [Ехать к Громову]
    Хватит. Нужно встретиться с Громовым лично. # style:thought
    
    — Я готов. # speaker:sorokin
    
    -> ep1_city_entrance

=== ep1_city_entrance ===

# mood: mystery

Город открывается постепенно, как рана, с которой сняли бинт. # style:atmosphere # intensity:high

Сначала — промзона. Ржавые трубы, почерневшие от копоти стены, горы шлака у дороги. Завод "Прометей" — огромный, как спящее чудовище. Его трубы выбрасывают столбы белого дыма, который смешивается с низкими облаками. # style:atmosphere # intensity:medium

Запах серы здесь сильнее. К нему примешивается что-то ещё — металлический привкус, оседающий на языке. # style:atmosphere # intensity:medium

Вы вспоминаете учебники криминалистики. Многие промышленные яды могут вызывать галлюцинации, паранойю, потерю памяти. Свинец, ртуть, некоторые органические соединения... # style:thought # intensity:medium

Может, "странности" этого города — просто результат хронического отравления? Это объяснило бы многое. # style:thought # intensity:high

~ boost_theory(1, 5)

"УАЗик" подпрыгивает на выбоинах. Офицер за рулём молчит. Его пальцы — белые от напряжения — сжимают руль. # style:thought # intensity:low

Потом — жилые кварталы. Пятиэтажки-хрущёвки, одинаковые, как коробки. Серые стены, узкие окна, бельё на балконах. Дворы — пустые. Ни детей, ни стариков на лавочках. # style:atmosphere # intensity:medium

Одиннадцать утра буднего дня. Где все? # style:thought # intensity:high

Вы замечаете людей — редких прохожих, спешащих по своим делам. Но они... странные. Идут быстро, опустив головы. Не разговаривают. Не смотрят друг на друга. # style:atmosphere # intensity:high

И не смотрят на вашу машину. Демонстративно отворачиваются. # style:horror # intensity:low

Словно вас не существует. # style:dramatic # intensity:high

— Всегда здесь так тихо? — спрашиваете вы. # speaker:sorokin

Офицер вздрагивает. Словно забыл, что вы в машине. # style:thought # intensity:low

— Что? А... да. Тихий город. Рабочий. # speaker:officer

Он снова замолкает. # style:action

"УАЗик" проезжает мимо Дома культуры "Прометей" — монументального здания с колоннами и мозаикой на фасаде. Рабочий с молотом, женщина с колосьями, звезда. На доске объявлений — афиши. "Лекция о вреде алкоголизма". "Концерт самодеятельности". "Собрание парткома — ОБЯЗАТЕЛЬНО". # style:atmosphere # intensity:low

Последняя афиша — месячной давности. # style:thought # intensity:medium

Больница №1 — трёхэтажное здание жёлтого кирпича. У входа — скорая помощь с выключенными фарами. Никого не видно — ни врачей, ни пациентов. # style:atmosphere # intensity:medium

Площадь с памятником Ленину. Вождь указывает рукой на восток — туда, где за городом чернеет стена леса. У его ног — клумба, засыпанная снегом. Фонари — выключены, хотя небо затянуто тучами и темно, как вечером. # style:atmosphere # intensity:high

Гостиница "Урал" — сталинская постройка, помпезная и обветшалая. Башенки на крыше, лепнина на фасаде, вывеска с перегоревшими буквами. "ГОС ИНИЦ УРАЛ". # style:atmosphere # intensity:medium

Всё как везде. Типичный советский городок. # style:thought # intensity:low

И всё — не так. # style:dramatic # intensity:high

Слишком тихо. Слишком пусто. Слишком много тёмных окон в домах — даже днём. # style:horror # intensity:medium

Вы ловите себя на мысли: этот город — как декорация. Как макет. Всё на месте, но жизни — нет. # style:important # intensity:high

"УАЗик" останавливается у серого трёхэтажного здания. Над входом — табличка: "ГОРОДСКОЙ ОТДЕЛ ВНУТРЕННИХ ДЕЛ". # style:atmosphere # intensity:low

— Приехали. # speaker:officer

Офицер не выходит. Не помогает с вещами. Просто сидит, глядя перед собой. # style:thought # intensity:medium

— Спасибо, — говорите вы. # speaker:sorokin

Он кивает. Не поворачиваясь. # style:action

Вы выходите. Захлопываете дверь. # style:action

"УАЗик" срывается с места так, словно за ним гонятся. # style:thought # intensity:high

Вы остаётесь один. Перед серым зданием. Под серым небом. В сером городе. # style:atmosphere # intensity:high

Ветер несёт снежную крупу. Где-то вдалеке — гудок завода. # style:atmosphere # intensity:medium

И тишина. Давящая, звенящая тишина. # style:horror # intensity:high

* [Войти в отдел милиции]
    Вы поднимаетесь по ступеням. Дверь — тяжёлая, деревянная, с облупившейся краской — открывается со скрипом. # style:action
    
    Внутри — запах канцелярии: чернила, бумага, застоявшийся сигаретный дым. И что-то ещё — еле уловимый запах страха. # style:atmosphere # intensity:medium
    
    За стойкой дежурного — пусто. # style:thought # intensity:medium
    
    — Есть кто? # speaker:sorokin
    
    Тишина. # style:dramatic # intensity:medium

    Потом — шаги. Скрип двери в конце коридора. # style:atmosphere # intensity:low

    — Товарищ Сорокин? Сюда. Майор ждёт. # speaker:stranger

    -> ep1_meet_gromov

=== ep1_meet_gromov ===

~ MetCharacters += gromov

# mood: investigation

Коридор — длинный, тёмный, с облупившимися стенами. Лампы под потолком мигают, как в фильме ужасов. Двери по обе стороны — закрыты. За ними — тишина. # style:atmosphere # intensity:medium

Кабинет начальника — в конце коридора. Табличка на двери: "Майор С.П. Громов. Начальник ГОВД". # style:atmosphere # intensity:low

Буквы — золотые на чёрном фоне. Единственная ухоженная вещь в этом здании. # style:thought # intensity:medium

Вы стучите. # style:action

— Да-да, входите. # speaker:gromov

Кабинет — просторный, но захламлённый. Шкафы с папками вдоль стен. Сейф в углу. Портрет Андропова над столом — пыльный, забытый. # style:atmosphere # intensity:low

За столом — человек. # style:dramatic # intensity:medium

Майор Громов. Лет пятьдесят пять, может — шестьдесят. Грузный, с широкими плечами, которые когда-то были могучими, а теперь обвисли под тяжестью лет и водки. Седые усы — пожелтевшие от табака. Красное лицо — россыпь лопнувших капилляров на щеках. Глаза — мутноватые, с красными прожилками, но... умные. Даже сейчас, за маской алкоголика — умные и настороженные. # style:thought # intensity:high

На столе — стакан. Початая бутылка "Столичной". Пепельница, полная окурков. Папка — тонкая, потрёпанная. # style:atmosphere # intensity:low

— А, следователь из Москвы. # speaker:gromov

Голос — хриплый, прокуренный. Громов не встаёт. Не протягивает руки.

— Из Свердловской областной прокуратуры, — поправляете вы. # speaker:sorokin

— Какая разница. — Громов машет рукой. — Садитесь. # speaker:gromov

Вы садитесь. Стул скрипит под вами. # style:action

Громов смотрит. Оценивает. Вы делаете то же самое. # style:action # intensity:medium

// ЭТАЛОН: Громов замечает состояние Сорокина
{ infection_level >= 40:
    Его глаза сужаются. Он видит что-то в вас — и это ему не нравится. # style:thought # intensity:medium
    
    — Вы уже начали видеть, да? — Тихо, почти шёпотом. — Они и вас нашли. # speaker:gromov # intensity:high
}

Этот человек — не дурак. Это первое, что вы понимаете. Несмотря на всё — на водку, на затхлый кабинет, на провинциальную глушь — он не дурак. # style:thought # intensity:high

И он — боится. Это второе. # style:important # intensity:high

Громов наливает водку в два стакана. Толстые грани стекла. Жидкость — прозрачная, с маслянистым блеском. # style:atmosphere # intensity:low

— С приездом, товарищ Сорокин. — Он двигает стакан к вам. — За знакомство. # speaker:gromov

* [Выпить с ним]
    Вы берёте стакан. Холодное стекло в ладони. # style:action
    
    — За знакомство. # speaker:sorokin
    
    Водка обжигает горло. Крепкая — градусов сорок пять, не меньше. Не магазинная. Самогон? # style:thought # intensity:low
    
    Громов одобрительно кивает. Выпивает свой стакан залпом. # style:action
    
    ~ trust_gromov = trust_gromov + 10
    
    — Вот это по-нашему. А то присылают иногда... интеллигенцию. # speaker:gromov
    
    Он наливает ещё. Себе. Вам не предлагает — уважает меру. # style:thought # intensity:low
    
    — Значит, Виктор Андреевич. Следователь по особо важным делам. Афганистан, две награды, рекомендации... — Он хмыкает. — Серьёзный человек. Зачем вас сюда послали — в нашу глушь? # speaker:gromov
    
    -> ep1_gromov_talk

* [Отказаться]
    — Благодарю, Степан Петрович. На службе не пью. # speaker:sorokin
    
    Громов замирает. Его глаза — сужаются на мгновение. Потом он хмыкает. Выпивает оба стакана — один за другим, без паузы. # style:action
    
    ~ trust_gromov = trust_gromov - 5
    
    — Принципиальный, значит. — В его голосе — ирония. И что-то ещё. Разочарование? — Ну-ну. Здесь это редкость. # speaker:gromov
    
    Он отставляет бутылку. Но не убирает — оставляет на виду. # style:thought # intensity:low
    
    — Значит, товарищ Сорокин. Следователь по особо важным делам. Что вас к нам привело? # speaker:gromov
    
    -> ep1_gromov_talk

=== ep1_gromov_talk ===

Громов откидывается на спинку кресла. Оно скрипит — жалобно, протяжно. # style:atmosphere # intensity:low

— Так вот, товарищ Сорокин. Насчёт вашего дела... # speaker:gromov

Он достаёт папку из ящика стола. Тонкую — подозрительно тонкую. Картон — потёртый, серый. На обложке — штамп: "ДЕЛО №147-86. ЗОРИН А.П. ИСЧЕЗНОВЕНИЕ". # style:important

Громов кладёт папку на стол. Не открывает. # style:action

— Инженер Зорин Алексей Павлович. Сорок семь лет. Работал на заводе "Прометей", отдел спецтехнологий. Женат не был, вдовец. Дочь — Татьяна, двадцать три года, инженер на том же заводе. # speaker:gromov

Он говорит монотонно, как заученный текст. # style:thought # intensity:medium

— Двадцать третьего октября Зорин вышел с работы в восемнадцать часов сорок две минуты. Это зафиксировано. На проходной — подпись в журнале. После этого... — Громов разводит руками. — Всё. Испарился. Домой не пришёл. Никто не видел. Никаких следов. # speaker:gromov

— Тело? # speaker:sorokin

— Не нашли. — Громов смотрит в окно. За стеклом — серое небо, верхушки сосен вдалеке. — Тайга, товарищ Сорокин. Медведи. Волки. Болота. Человек отошёл на сто метров от дороги — и всё. Ищи ветра в поле. # speaker:gromov

Его голос — ровный. Слишком ровный. # style:thought # intensity:medium

— А вы искали? # speaker:sorokin

Пауза. # style:dramatic # intensity:low

Громов наливает себе ещё водки. Не пьёт — просто держит стакан. # style:action

— Искали. Три дня. Прочёсывали лес. С собаками. — Он качает головой. — Ничего. Ни следов, ни... ничего. # speaker:gromov

* [Запросить материалы дела]
    — Мне нужны все материалы. Протоколы осмотров, показания свидетелей, заключения экспертов. # speaker:sorokin
    
    Громов смотрит на вас. Долго. # style:thought # intensity:medium
    
    — Всё здесь. — Он кивает на папку. — Десять страниц. # speaker:gromov
    
    — Десять страниц? — Вы не скрываете удивления. — За три недели расследования — десять страниц? # speaker:sorokin
    
    Громов молчит. Его пальцы — белые — сжимают стакан. # style:thought # intensity:high
    
    — Больше не набралось. # speaker:gromov
    
    Ложь. Вы чувствуете это так же ясно, как запах перегара в комнате. # style:thought # intensity:high
    
    -> ep1_gromov_silence

* [Спросить о других пропавших]
    ~ track_cult_exposure()  // РЕПУТАЦИЯ: публичные расспросы о массовых исчезновениях
    — Зорин — не первый. # speaker:sorokin
    
    Громов замирает. Стакан в его руке дрожит — еле заметно. # style:action
    
    — Что? # speaker:gromov
    
    — Семь человек за два года. — Вы смотрите ему в глаза. Не отводите взгляд. — Поэтому меня и прислали, Степан Петрович. Не из-за одного инженера. # speaker:sorokin
    
    Долгая пауза. За окном — карканье вороны. Резкое, неприятное. # style:atmosphere # intensity:medium
    
    — Откуда... откуда у вас эти сведения? # speaker:gromov
    
    — Из докладной записки. Кто-то написал в прокуратуру. Анонимно. # speaker:sorokin
    
    Громов бледнеет. Его красное лицо становится серым — как стены этого города. # style:thought # intensity:high
    
    ~ cult_awareness = cult_awareness + 1
    ~ CluesA += missing_list
    ~ sync_evidence_count()
    
    # clue
    Улика найдена: список пропавших
    
    // Проверка на личную связь — один из пропавших может быть знакомым Сорокина
    -> ep1_check_comrade_connection ->
    
    -> ep1_gromov_others

=== ep1_check_comrade_connection ===
// Сорокин изучает список и может узнать знакомого

Вы мысленно перебираете имена. Зорин, Петрова, Костров, Савельева...

Коршунов.

Коршунов Сергей Александрович.

Вы замираете.

{ not knows_vanished_comrade:
    Нет. Не может быть. Коршунов — распространённая фамилия. Это не ваш Серёга. Не может быть.
    
    Но год рождения — 1946. Место работы — завод "Прометей". Инженер.
    
    Он говорил — уезжает на Урал. "Хорошая работа, Витя. Закрытый город."
    
    * [Это он. Мой товарищ.]
        ~ knows_vanished_comrade = true
        ~ comrade_name_revealed = true
        ~ personal_vendetta = personal_vendetta + 40
        
        Серёга. Серёга Коршунов. Радист. Два года в Афганистане бок о бок.
        
        Вы вытащили его из-под обстрела. Он прикрывал вас при отходе. Вы делили последнюю воду в пустыне.
        
        И теперь — он в списке пропавших. В этом проклятом городе.
        
        Это уже не просто дело. Это — личное.
        
        ~ boost_theory(2, -15)
        
        ->->
    
    * [Проверить потом]
        Потом. Сначала — работа. Эмоции — после.
        
        Но руки — дрожат.
        
        ->->
- else:
    ->->
}

=== ep1_gromov_silence ===

В кабинете повисает тишина. Густая, вязкая — как болотная жижа. # style:atmosphere # intensity:high

За стеной — шаги. Кто-то ходит по коридору. Туда-сюда, туда-сюда. # style:atmosphere # intensity:medium

Громов наливает водку. Выпивает. Не предлагает вам. # style:action

— Послушайте, Сорокин. — Его голос — тихий, хриплый. Он подаётся вперёд, опираясь локтями о стол. — Вы приехали сюда ненадолго. Неделя, две — и уедете. В Свердловск, в Москву, куда угодно. К нормальной жизни. # speaker:gromov

Пауза. # style:dramatic # intensity:medium

— А нам здесь жить. Понимаете? Нам. Здесь. Жить. # speaker:gromov

Он смотрит вам в глаза. Впервые за весь разговор — прямо, не отводя взгляда. # style:thought # intensity:high

— Что вы хотите этим сказать, Степан Петрович? # speaker:sorokin

— Ничего. — Он откидывается назад. Кресло скрипит. — Просто... дружеский совет. От человека, который здесь тридцать лет. Не копайте слишком глубоко. Напишите отчёт — несчастный случай, тайга, медведи — и уезжайте. # speaker:gromov

Его глаза — усталые, красные — молят вас. О чём? О понимании? О пощаде? # style:thought # intensity:high

За окном — снова карканье. Ближе, чем раньше. # style:atmosphere # intensity:medium

* [Это угроза?]
    — Вы мне угрожаете, товарищ майор? # speaker:sorokin
    
    Вы говорите спокойно, но внутри — напряжение. Рука — ближе к поясу, где под пиджаком — кобура. # style:thought # intensity:high
    
    Громов качает головой. Устало, обречённо. # style:action
    
    — Боже упаси. Угрозы... — Он горько усмехается. — Нет, товарищ следователь. Это не угроза. Это... просто совет. Дружеский. От человека, который знает этот город. Знает, что здесь бывает с теми, кто... копает слишком глубоко. # speaker:gromov
    
    Он замолкает. Не договаривает. # style:action
    
    Но вы понимаете. # style:thought # intensity:high
    
    -> ep1_gromov_end

* [Принять к сведению]
    — Я учту ваши слова, Степан Петрович. # speaker:sorokin
    
    Вы говорите ровно, не показывая эмоций. Но внутри — заметка. Этот человек — не враг. Он сломлен. Запуган. Чем? # style:thought # intensity:high
    
    Громов кивает. В его глазах — благодарность? облегчение? # style:thought # intensity:medium
    
    ~ trust_gromov = trust_gromov + 5
    
    — Хорошо. Хорошо, что вы... разумный человек. # speaker:gromov
    
    Он снова тянется к бутылке. # style:action
    
    -> ep1_gromov_end

=== ep1_gromov_others ===

— Семь человек за два года. — Вы кладёте руки на стол, наклоняетесь вперёд. — Скажите мне, Степан Петрович. Все они — несчастные случаи? Все — заблудились в тайге? Всех съели медведи? # speaker:sorokin

Громов бледнеет. Не отвечает. # style:action

— Зорин — инженер. Местный, родился здесь. Знал лес с детства. Петрова — медсестра из больницы, пятьдесят два года, никогда не выходила за периметр. Костров — студент, приехал на практику, исчез через две недели. Савельева — учительница, жила здесь двадцать лет... # speaker:sorokin

Вы перечисляете имена. Из докладной записки — той, что лежит у вас в портфеле. # style:thought # intensity:medium

— ...и все они, по вашим словам, просто исчезли. Без следа. Без тел. Без улик. # speaker:sorokin

Громов молчит. Его руки — трясутся. Он сцепляет их на столе, пытаясь унять дрожь. # style:thought # intensity:high

— Вы не понимаете. — Его голос — еле слышный шёпот. — Вы не понимаете, с чем имеете дело. # speaker:gromov

* [Так объясните мне]
    -> ep1_gromov_explain

* [Вы что-то скрываете — что-то личное]
    Вы смотрите на него. Внимательно. Глаза следователя — привыкшие читать людей. # style:thought # intensity:high
    
    Красное лицо. Дрожащие руки. Страх в глазах — но не за себя. Не совсем за себя. # style:thought # intensity:high
    
    — Вы не просто боитесь, Степан Петрович. Вы... что-то потеряли. Здесь. Кого-то. # speaker:sorokin
    
    Громов замирает. Его лицо — окаменело. # style:action
    
    — Откуда... # speaker:gromov
    
    — Я следователь. Это моя работа — видеть. # speaker:sorokin
    
    Долгая пауза. Громов смотрит на вас. В его глазах — что-то ломается. Броня, которую он носил годами — трескается. # style:thought # intensity:high
    
    — Девятнадцать лет назад. — Его голос — еле слышный. — Моя дочь. # speaker:gromov
    
    ~ CharacterSecrets += gromov_daughter
    ~ understanding_gromov += 20
    
    -> ep1_gromov_daughter

=== ep1_gromov_daughter ===

# mood: emotional

Громов наливает водку. Выпивает залпом. Наливает ещё. # style:action

— Анечка. Ей было семнадцать. — Его голос дрожит. — Красивая. Умная. Собиралась в Москву поступать. На филолога. # speaker:gromov

Он достаёт из ящика стола фотографию. Девушка в школьной форме. Светлые волосы, улыбка — такая чистая, такая живая. # style:thought # intensity:high

— Июль шестьдесят седьмого. Выпускной. Она пошла гулять с подругами. Вечером. Они хотели — к реке, посидеть, попеть песни. # speaker:gromov

Он замолкает. Его пальцы сжимают фотографию так, что бумага мнётся. # style:thought # intensity:high

— Не дошли. Подруги вернулись — без неё. Сказали — она отстала. Хотела посмотреть на закат. Над лесом. # speaker:gromov

~ CharacterSecrets += gromov_breakdown
~ understanding_gromov += 25

{ sanity < 60:
    «...она слышала нас...»
    «...она пришла...»
    «...она с нами...»
    
    -> lose_sanity_safe(3) ->
}

* [Что случилось?]
    — И? # speaker:sorokin
    
    — Никогда не вернулась. — Громов смотрит в окно. На лес. — Искали неделю. Всем городом. Солдаты с завода помогали. Ничего. Ни следа. Ни... # speaker:gromov
    
    Он не заканчивает. Не может.
    
    -> ep1_gromov_aftermath

* [Вы её нашли?]
    Громов качает головой. Медленно. Тяжело.
    
    — Нет. Никто не нашёл. Как будто... как будто её никогда не было. # speaker:gromov
    
    Он вытирает глаза тыльной стороной ладони. Старый жест. Привычный.
    
    — Жена ушла через год. Не смогла больше. Уехала к сестре в Киев. Развод по почте. Я даже не виню её. # speaker:gromov
    
    -> ep1_gromov_aftermath

=== ep1_gromov_aftermath ===

# mood: dark

— Я знаю, что случилось с моей дочерью, товарищ Сорокин. — Громов смотрит на вас. Его глаза — пустые. Выгоревшие. — Знаю — но не могу доказать. Не могу даже сказать вслух. # speaker:gromov

— Что вы знаете? # speaker:sorokin

Он встаёт. Подходит к окну. Смотрит на лес. # style:action

— Они забрали её. — Шёпот. — Те, кто живёт под землёй. Те, кто служит... чему-то. В пещерах. # speaker:gromov

Пауза. # style:dramatic # intensity:high

— Я был молодым тогда. Сильным. Верил в закон, в справедливость. Пошёл на завод — требовать ответов. Меня выкинули. Пошёл к начальству — меня перевели. Написал в Москву — письмо вернулось. "Не подтверждено. Дело закрыто." # speaker:gromov

Он поворачивается к вам. # style:action

— Тогда я понял. Понял, как это работает. Понял, что нельзя победить. Можно только... выжить. Закрыть глаза. Не задавать вопросов. И молиться, чтобы они не пришли снова. # speaker:gromov

~ EmotionalScenes += scene_gromov_drunk
~ trust_gromov += 15
~ cult_awareness += 3

* [Почему вы всё ещё здесь?]
    — После всего этого — почему не уехали? # speaker:sorokin
    
    — Потому что... — Громов горько усмехается. — Потому что однажды я найду её. Живую или... или то, что от неё осталось. Я должен знать. Понимаете? Должен знать, что с ней случилось. # speaker:gromov
    
    Он возвращается к столу. Садится тяжело, как старик.
    
    — И ещё — потому что кто-то должен быть здесь. Кто-то, кто знает правду. Кто будет предупреждать. Таких, как вы. Приезжих. # speaker:gromov
    
    ~ CharacterSecrets += gromov_redemption
    ~ understanding_gromov += 15
    
    -> ep1_gromov_serafim

* [Кто "они"?]
    — Кто забрал вашу дочь? Кто эти "они"? # speaker:sorokin
    
    Громов молчит. Качает головой.
    
    — Не могу. Если скажу — они узнают. Они всегда узнают. # speaker:gromov
    
    Но потом — оглядывается на дверь. Понижает голос:
    
    -> ep1_gromov_serafim

=== ep1_gromov_serafim ===

— Поговорите со священником. Отец Серафим. Старая церковь — на окраине, за частным сектором. Её официально закрыли в шестидесятых, но он там... живёт. # speaker:gromov

— Что он знает? # speaker:sorokin

— Больше, чем я. — Громов смотрит в окно. На лес. — Больше, чем кто-либо из нас. Он... он был здесь с самого начала. Ещё до завода. Ещё до... # speaker:gromov

Он замолкает. Его лицо — маска страха.

— Ещё до чего? # speaker:sorokin

Громов молчит. Качает головой. Больше ничего не скажет — это ясно.

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesD ? serafim_legends):
    ~ CluesD += serafim_legends
    ~ sync_evidence_count()

    # clue
    Улика найдена: совет Громова — найти отца Серафима
}

* [Поблагодарить]
    — Спасибо, Степан Петрович. Я поговорю с ним. # speaker:sorokin
    
    Громов кивает. Не смотрит на вас.
    
    ~ trust_gromov += 10
    
    — Будьте осторожны. С кем говорите. Что спрашиваете. Этот город... — Он не заканчивает. — Просто будьте осторожны. # speaker:gromov
    
    -> ep1_gromov_end

=== ep1_gromov_explain ===

— Так объясните мне. # speaker:sorokin

Долгая пауза. За окном — ветер. Стёкла дребезжат в рамах.

Громов встаёт. Подходит к двери. Открывает — проверяет коридор. Закрывает. Поворачивает ключ в замке.

Возвращается к столу. Садится. Наливает водку — руки всё ещё трясутся, жидкость плещется через край.

— Не могу. — Он качает головой. — Не могу, товарищ Сорокин. Если я... если я скажу... — Он не заканчивает. # speaker:gromov

Но потом — оглядывается на дверь. Понижает голос до едва различимого шёпота:

— Поговорите со священником. Отец Серафим. Старая церковь — на окраине, за частным сектором. Её официально закрыли в шестидесятых, но он там... живёт. # speaker:gromov

— Что он знает? # speaker:sorokin

— Больше, чем я. — Громов смотрит в окно. На лес. — Больше, чем кто-либо из нас. Он... он был здесь с самого начала. Ещё до завода. Ещё до... # speaker:gromov

Он замолкает. Его лицо — маска страха.

— Ещё до чего? # speaker:sorokin

Громов молчит. Качает головой. Больше ничего не скажет — это ясно.

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesD ? serafim_legends):
    ~ CluesD += serafim_legends
    ~ sync_evidence_count()

    # clue
    Улика найдена: совет Громова — найти отца Серафима
}

* [Поблагодарить]
    — Спасибо, Степан Петрович. Я поговорю с ним. # speaker:sorokin
    
    Громов кивает. Не смотрит на вас.
    
    ~ trust_gromov = trust_gromov + 10
    
    — Будьте осторожны. С кем говорите. Что спрашиваете. Этот город... — Он не заканчивает. — Просто будьте осторожны. # speaker:gromov
    
    -> ep1_gromov_end

=== ep1_gromov_end ===

Громов встаёт. Тяжело, опираясь о стол — как будто ему внезапно добавили двадцать лет. # style:thought # intensity:medium

Он берёт папку со стола. Протягивает вам. # style:action

— Вот. Всё, что есть. — Пауза. — Всё, что я могу вам дать. # speaker:gromov

Вы берёте папку. Десять страниц. Может быть — десять процентов правды. # style:thought # intensity:high

— Гостиница "Урал". Номер двенадцать — забронирован для вас. Завтрак, обед, ужин — в столовой на первом этаже. За счёт горисполкома. # speaker:gromov

Он подходит к окну. Стоит спиной к вам. # style:action

За стеклом — улица. Серые здания, пустой тротуар. И лес — чёрной стеной на горизонте. # style:atmosphere # intensity:medium

Небо темнеет. Три часа дня — а уже сумерки. Ноябрь на Урале. Ночь приходит рано. # style:atmosphere # intensity:medium

— И, Сорокин... # speaker:gromov

Громов не оборачивается. Его голос — глухой, усталый. # style:thought # intensity:low

— Не гуляйте ночью. Особенно — не ходите в лес. # speaker:gromov

* [Почему?]
    — Волки? # speaker:sorokin
    
    Долгая пауза. # style:dramatic # intensity:medium
    
    — Если бы волки... — бормочет Громов. Его плечи — опущены, ссутулены. — Если бы только волки. # speaker:gromov
    
    Он не объясняет. Не оборачивается. # style:thought # intensity:high
    
    Разговор окончен. # style:dramatic # intensity:medium
    
    -> ep1_leave_militia

* [Уйти молча]
    Вы не спрашиваете. Иногда молчание — лучший ответ. # style:thought # intensity:low
    
    — До свидания, Степан Петрович. # speaker:sorokin
    
    Он не отвечает. Стоит у окна, глядя на лес. # style:thought # intensity:medium
    
    Вы выходите. Дверь закрывается за вами. # style:action
    
    В коридоре — холодно. Темно. Лампы мигают. # style:atmosphere # intensity:medium
    
    -> ep1_leave_militia

=== ep1_leave_militia ===

# mood: dark

Вы выходите на улицу. # style:action

Темно. Когда успело стемнеть? Вы пробыли у Громова... час? Полтора? А ощущение — что прошли сутки. # style:thought # intensity:medium

Небо — низкое, давящее. Тучи — чёрные, набухшие снегом. Фонари вдоль улицы — не горят. Окна домов — тёмные, мёртвые. # style:atmosphere # intensity:high

Ни души. Ни звука. # style:atmosphere # intensity:high

Только ветер. Он несёт снежную крупу, которая сечёт лицо. И запах — серный, химический запах завода. И ещё что-то... сладковатое. Гниловатое. # style:atmosphere # intensity:high

Вы идёте по тротуару. Шаги гулко отдаются в тишине. # style:action

Поворачиваете за угол. # style:action

И — # style:dramatic # intensity:high

На мгновение — вам кажется, что из переулка кто-то смотрит. # style:horror # intensity:medium

Тень. Человеческий силуэт. Высокая фигура, неподвижная, стоящая в темноте между домами. # style:horror # intensity:high

Два глаза. Блестят? Или отражают свет? # style:horror # intensity:high # effect:glitch

Вы моргаете. # style:action

Там — никого. Пустой переулок. Мусорные баки. Стена с облупившейся штукатуркой. # style:atmosphere # intensity:low

Показалось? # style:thought # intensity:medium

{ sanity < 80:
    Вы стоите неподвижно. Смотрите в переулок.
    
    Пусто. Темно. Тихо.
    
    Но... было ли там что-то? Кто-то?
    
    Вы не уверены. Уже не уверены.
    
    Этот город... он давит. С самого приезда. Словно стены смыкаются.
    
    -> lose_sanity_safe(2) ->
    
    Вы встряхиваетесь. Усталость. Просто усталость. Шесть часов в автобусе, странный разговор с Громовым... неудивительно, что мерещится.
}

За спиной — звук. # style:dramatic # intensity:medium

Вы резко оборачиваетесь. # style:action

Ворона. Чёрная, с глянцевым оперением. Сидит на фонарном столбе. Смотрит на вас. # style:atmosphere # intensity:medium

Каркает. Один раз. Резко. # style:atmosphere # intensity:medium

И улетает — в сторону леса. # style:atmosphere # intensity:low

* [Идти в гостиницу]
    Хватит. Нужно отдохнуть. Разобраться с мыслями. # style:thought
    
    Вы ускоряете шаг. # style:action
    
    Гостиница "Урал" — в ста метрах. Её силуэт темнеет на фоне неба. Башенки на крыше, лепнина на фасаде. # style:atmosphere # intensity:low
    
    Единственное освещённое здание на улице. В окнах первого этажа — тёплый жёлтый свет. # style:atmosphere # intensity:medium
    
    Почти... уютно. # style:thought # intensity:low
    
    Почти. # style:dramatic # intensity:medium
    
    -> ep1_hotel

=== ep1_hotel ===

~ MetCharacters += klava

Гостиница "Урал". # style:important

Внутри — тепло. Сразу после уличного холода — почти жарко. Паровое отопление работает на полную. Батареи гудят, трубы постукивают. # style:atmosphere # intensity:low

Вестибюль — просторный, с высоким потолком. Паркет — потёртый, скрипучий. На стенах — картины в тяжёлых рамах: горы, леса, заводские панорамы. Люстра под потолком — хрустальная, пыльная, с половиной перегоревших лампочек. # style:atmosphere # intensity:medium

Советская роскошь. Обветшалая, забытая, но всё ещё пытающаяся держать марку. # style:thought # intensity:medium

За стойкой регистрации — женщина. # style:dramatic # intensity:low

Лет шестьдесят. Может — шестьдесят пять. Химическая завивка — серо-рыжая, как ржавчина. Очки — толстые, с роговой оправой. Кофта — вязаная, с оленями. # style:thought # intensity:low

И глаза. Любопытные, живые, цепкие — как у сороки, заметившей блестящую вещицу. # style:thought # intensity:medium

Она смотрит на вас с того момента, как вы вошли. Не скрывая интереса. # style:thought # intensity:medium

— Ой! — Она всплёскивает руками. — А вы тот самый следователь? Из области? # speaker:klava

Вы подходите к стойке. # style:action

— Сорокин, Виктор Андреевич. Номер двенадцать должен быть забронирован. # speaker:sorokin

— Знаю, знаю! — Она уже листает толстый журнал. — Звонили из милиции. Сказали — ждать важного гостя. # speaker:klava

Она поднимает на вас глаза. Хитрые, оценивающие. # style:thought # intensity:medium

— А я — Клавдия Петровна. Клава. Тут все так зовут. — Пауза. — Вы у нас надолго? # speaker:klava

— Как пойдёт расследование. # speaker:sorokin

— Расследование... — Она понижает голос. — Это вы про Зорина, да? Про Алексея Палыча? # speaker:klava

Вы не отвечаете. Просто смотрите. # style:action

Клава вздыхает. # style:action

— Бедный Алексей Палыч. Хороший был человек. Тихий. Книжки читал, дочку растил... И вот — пропал. Как сквозь землю провалился. # speaker:klava

Она достаёт ключ. Большой, латунный, с деревянной биркой. # style:action

— Номер двенадцать. Третий этаж. Там тихо, не беспокоят. # speaker:klava

Потом — наклоняется ближе. Шёпотом: # style:action

— А знаете... дочка его — Таня — она про вас спрашивала. Вчера приходила. # speaker:klava

* [Где её найти?]
    — Адрес знаете? # speaker:sorokin
    
    — Улица Ленина, семь. Квартира двенадцать. Но лучше на завод идите — она там допоздна. В инженерном корпусе работает. Как отец работал. # speaker:klava
    
    Клава вздыхает. # style:action
    
    — Переживает очень. Осунулась, похудела. Всё ищет его... всё надеется. # speaker:klava
    
    ~ sync_evidence_count()
    
    Вы запоминаете адрес. # style:thought
    
    -> ep1_klava_gossip

* [Что она хотела?]
    — Что она спрашивала? # speaker:sorokin
    
    Клава оглядывается — словно проверяя, нет ли кого рядом. # style:action
    
    — Приедет ли следователь. Настоящий, говорит. Не местный. — Она понижает голос ещё сильнее. — Она уверена, что отца убили. Говорит — не верит в несчастный случай. Говорит — милиция что-то скрывает. # speaker:klava
    
    Пауза. # style:dramatic # intensity:low
    
    — А я ей и говорю — Танечка, ты осторожнее. Не надо такое говорить. А она — "Мне всё равно, тётя Клава. Я правду узнаю". # speaker:klava
    
    Клава качает головой. # style:action
    
    — Упрямая девочка. Как отец был. # speaker:klava
    
    -> ep1_klava_gossip

=== ep1_klava_gossip ===

Клава оглядывается. Быстро, нервно — как птица. # style:action

Вестибюль пуст. Тихо. За окнами — темнота. # style:atmosphere # intensity:medium

Она наклоняется ещё ближе. Её голос — едва слышный шёпот: # style:action

— Тут странные дела творятся, товарищ следователь. Очень странные. Люди пропадают. А милиция — ничего. Говорят — несчастные случаи, тайга, медведи... — Она фыркает. — Какие медведи? Тут медведей сто лет не видели. # speaker:klava

— Какие люди? # speaker:sorokin

Клава оглядывается снова. Её пальцы нервно теребят край кофты. # style:thought # intensity:medium

— Ну, Зорин — последний. А до него — Петрова из больницы. Марья Степановна. Пятьдесят два года, медсестра в психиатрическом отделении. Пошла домой после ночной смены — и не дошла. В двух кварталах от дома. # speaker:klava

Пауза. # style:dramatic # intensity:low

— А до неё — студент с завода. Костров Димка. Молодой совсем, двадцать лет. На практику приехал, из политеха. Весёлый был, улыбчивый... — Её голос дрожит. — Две недели тут пробыл — и всё. Испарился. # speaker:klava

Она осекается. Смотрит куда-то мимо вас — в темноту за окном. # style:thought # intensity:medium

— А ещё раньше — учительница. Савельева. И инженер с завода, Климов. И женщина из магазина — как её... Вера? Валя? Не помню уже... # speaker:klava

Клава встряхивается. Словно очнувшись от транса. # style:action

— Ой, что это я разболталась. Вам отдыхать надо, товарищ следователь. С дороги, устали небось... # speaker:klava

Она отступает. Её глаза — испуганные. # style:thought # intensity:medium

* [Настоять]
    — Клавдия Петровна. — Вы говорите мягко, но твёрдо. — Это важно. Очень важно. Всё, что вы знаете. # speaker:sorokin
    
    ~ track_aggressive_action()  // РЕПУТАЦИЯ: давление на свидетеля
    
    Она смотрит на вас. Колеблется. # style:thought # intensity:medium
    
    // РЕПУТАЦИЯ влияет на готовность говорить
    { city_reputation >= -10:
        — Не здесь. — Её голос — еле слышный. — Завтра. В ресторане. В обед. Там... там народу много, безопаснее. # speaker:klava
        
        Безопаснее? От чего? # style:thought # intensity:high
        
        Но вы не спрашиваете. Не сейчас. # style:thought # intensity:low
        
        ~ cult_awareness = cult_awareness + 1
        
        — Хорошо. Завтра в обед. # speaker:sorokin
        
        Клава кивает. Быстро. Нервно. # style:action
        
        — А пока — отдыхайте. И... — Она понижает голос ещё сильнее. — Не гуляйте ночью. Не выходите из гостиницы. До утра. # speaker:klava
    - else:
        // Плохая репутация — Клава боится говорить
        — Я... я ничего больше не знаю, товарищ следователь. — Её голос дрожит. — Устала я. Поздно уже. # speaker:klava
        
        Она врёт. Но страх в её глазах — настоящий. Страх перед вами.
        
        Слухи распространяются быстро в маленьком городе.
        
        — Третий этаж, налево. Спокойной ночи. # speaker:klava
    }
    
    Второй раз за день вам говорят это. "Не гуляйте ночью". # style:thought # intensity:high
    
    Что происходит в этом городе после захода солнца? # style:thought # intensity:high
    
    -> ep1_room

* [Не давить]
    — Спасибо, Клавдия Петровна. Приму к сведению. # speaker:sorokin
    
    ~ track_helpful_action()  // РЕПУТАЦИЯ: дипломатичный подход
    
    Клава кивает. С облегчением. # style:action
    
    — Вот и хорошо. Вот и хорошо. — Она протягивает ключ. — Третий этаж, налево по коридору. Если что нужно — звоните вниз, трубка на тумбочке. # speaker:klava
    
    // РЕПУТАЦИЯ: дружелюбный подход может открыть двери позже
    { city_reputation >= 5:
        Она смотрит вам вслед. И — неожиданно, шёпотом: # style:atmosphere
        
        — Товарищ следователь? Спасибо. Что не давите. Здесь... здесь все давят. # speaker:klava
        
        ~ city_reputation = city_reputation + 3
    }
    
    Она отворачивается. Возвращается к своему журналу. # style:action
    
    Но вы замечаете — её руки дрожат. # style:thought # intensity:medium
    
    -> ep1_room

=== ep1_room ===

# mood: dark

Номер двенадцать. # style:important

Дверь открывается со скрипом — протяжным, как стон. Петли ржавые, не смазывали, наверное, со времён Сталина. # style:atmosphere # intensity:low

Внутри — тесно. Кровать с металлической сеткой. Тумбочка. Стул. Шкаф с покосившейся дверцей. Окно — узкое, с тяжёлыми шторами. # style:atmosphere # intensity:low

Пахнет нафталином и пылью. И чем-то ещё — еле уловимым, сладковатым. # style:atmosphere # intensity:medium

Вы включаете свет. Лампочка под потолком — тусклая, сорок ватт максимум. Жёлтый свет бросает длинные тени по углам. # style:atmosphere # intensity:medium

Вы кладёте портфель на стол. Вешаете пальто в шкаф. Садитесь на кровать. # style:action

Пружины скрипят — жалобно, как живое существо. # style:atmosphere # intensity:low

За окном — темнота. Абсолютная. Ни фонарей, ни освещённых окон. Словно город вымер. # style:atmosphere # intensity:high

Пять часов вечера. А темно — как в полночь. # style:thought # intensity:medium

Вы сидите. Смотрите в темноту за стеклом. # style:action

И тут — слышите. # style:dramatic # intensity:high

Еле уловимо. На грани восприятия. Как будто где-то далеко — очень далеко — поёт хор. # style:whisper # intensity:medium

Мужские голоса. Низкие, глубокие. Без слов — просто мелодия. Странная, протяжная, от которой мурашки бегут по спине. # style:whisper # intensity:high

Пение? Откуда? В такую погоду? # style:thought # intensity:high

* [Прислушаться]
    Вы встаёте. Подходите к окну. # style:action
    
    Открываете форточку. # style:action
    
    Холодный воздух бьёт в лицо. Запах серы — резче, отчётливее. И ещё — хвоя. И что-то... сладковатое. # style:atmosphere # intensity:medium
    
    Вы прислушиваетесь. # style:action
    
    Тишина. # style:atmosphere # intensity:high
    
    Пение — исчезло. Словно его выключили. # style:thought # intensity:medium
    
    Вы стоите у открытой форточки. Вдыхаете холодный воздух. Смотрите в темноту. # style:atmosphere # intensity:medium
    
    Ничего. Тишина. # style:atmosphere # intensity:low
    
    { sanity < 80:
        Но вы же слышали. Точно слышали. Голоса. Пение. # style:thought # intensity:high
        
        Или... не слышали? # style:thought # intensity:high
        
        Вы закрываете форточку. Руки слегка дрожат. # style:action
        
        Усталость. Просто усталость. Шесть часов в автобусе. Странный город. Странные люди. # style:thought # intensity:medium
        
        Неудивительно, что мерещится. # style:thought # intensity:low
        
        Но... # style:dramatic # intensity:medium
        
        ~ KeyEvents += heard_voices
        
        -> hear_the_voices ->
        
        Вы точно слышали. Голоса. Оттуда — со стороны леса. # style:thought # intensity:high
        
        Или вам хочется так думать? # style:thought # intensity:high
    }
    
    -> ep1_night_choice

* [Игнорировать]
    Показалось. Вы устали. # style:thought # intensity:low
    
    Ветер в трубах. Скрип дерева. Что угодно. # style:thought # intensity:low
    
    Вы отворачиваетесь от окна. Снимаете пиджак. Ослабляете галстук. # style:action
    
    Длинный день. Странный день. # style:thought # intensity:medium
    
    Но завтра — работа. Настоящая работа. # style:thought # intensity:low
    
    -> ep1_night_choice

=== ep1_night_choice ===

Часы на тумбочке показывают девять вечера. # style:atmosphere # intensity:low

Рано ещё. Обычно вы засыпаете в час-два ночи. Бессонница — верный спутник последних лет. # style:thought # intensity:medium

На столе — папка с делом. Десять страниц. Всё, что дал Громов. # style:atmosphere # intensity:low

За окном — темнота. И где-то там — город. Завод. Лес. # style:atmosphere # intensity:medium

// Первый взгляд на луну — начало обратного отсчёта
-> look_at_moon ->

И... что-то ещё? # style:thought # intensity:medium

Что вы будете делать? # style:dramatic # intensity:low

* [Изучить материалы дела]
    Работа — лучшее лекарство от мыслей. # style:thought
    
    Вы садитесь за стол. Открываете папку. # style:action
    
    Десять страниц. Посмотрим, что здесь есть. # style:thought
    
    -> ep1_study_files

* [Выйти на ночную прогулку]
    "Не гуляйте ночью", — сказал Громов. "Не выходите из гостиницы", — сказала Клава. # style:thought # intensity:medium
    
    Но вы — следователь. Вы привыкли смотреть туда, куда другие боятся. # style:thought # intensity:high
    
    Вы надеваете пальто. # style:action
    
    -> ep1_night_walk

* [Обыскать номер]
    Что-то в этом номере не так. Странный запах. Ощущение взгляда. # style:thought # intensity:medium
    
    Вы начинаете методичный обыск. # style:action
    
    -> ep1_search_room

* [Позвонить по телефону]
    На тумбочке — телефон. Внутренний, судя по виду. Но вдруг... # style:thought
    
    -> ep1_phone_call

* [Открыть журнал следователя]
    Пора записать первые впечатления. # style:thought
    
    -> investigator_journal

* [Лечь спать]
    Достаточно на сегодня. Завтра — работа. # style:thought
    
    Вы раздеваетесь, ложитесь. Кровать — жёсткая, но терпимая. # style:action
    
    Закрываете глаза. # style:action
    
    // Хороший отдых восстанавливает рассудок
    ~ gain_sanity(5)
    
    Удивительно — вы засыпаете почти сразу. Впервые за месяцы. # style:thought # intensity:low
    
    -> ep1_sleep

=== ep1_search_room ===
# mood: investigation

Вы начинаете с очевидного. # style:action

Шкаф. Пустой, если не считать пары ржавых вешалок и моли. # style:atmosphere # intensity:low

Тумбочка. Библия на церковнославянском — странно для советской гостиницы. И... записная книжка? Забытая кем-то. # style:thought # intensity:medium

Записная книжка — кожаная, потёртая. На обложке — инициалы «А.П.З.» # style:important

А.П.З. <<Алексей Петрович Зорин>>? # style:thought # intensity:high

* [Открыть записную книжку]
    Страницы исписаны мелким почерком. Даты, цифры, схемы. # style:document # intensity:medium
    
    «12.09.86 — Снова шумы в шахте. Частота 7.83 Гц. Резонанс Шумана? Но откуда?» # style:document
    
    «28.09.86 — Чернов нервничает. Говорит, что 'они' недовольны. Кто 'они'?» # style:document # intensity:high
    
    «15.10.86 — Нашёл вход. Старая вентиляционная шахта. За кладбищем. Там... что-то есть. Что-то древнее.» # style:document # intensity:high
    
    Последняя запись: # style:important
    
    «23.10.86 — Сегодня иду туда. Если не вернусь — это не несчастный случай. Это ОНИ. Найдите Серафима. Он знает.» # style:document # intensity:high
    
    { not (CluesC ? chernov_diary):
        ~ CluesC += chernov_diary
        ~ sync_evidence_count()
        
        УЛИКА: Записная книжка Зорина — он знал об опасности. # style:important
    }
    
    ~ cult_awareness = cult_awareness + 3
    
    Серафим. Кто это? # style:thought # intensity:high
    
    -> ep1_search_continue

* [Положить обратно — слишком опасно]
    Если это улика, её могли подбросить. Ловушка? # style:thought # intensity:medium
    
    Вы кладёте книжку на место. Но запоминаете инициалы. # style:action
    
    -> ep1_search_continue

=== ep1_search_continue ===
Вы продолжаете обыск. # style:action

Под кроватью — пыль. И... царапины на полу. Свежие. Как будто кровать двигали. # style:thought # intensity:medium

* [Отодвинуть кровать]
    Вы хватаетесь за металлическую раму. Тяжёлая, но поддаётся. # style:action
    
    Под кроватью — люк? # style:thought # intensity:high
    
    Нет. Просто квадрат паркета, который отличается от остального — темнее, новее. # style:thought # intensity:medium
    
    Вы простукиваете. Под ним — пустота. # style:dramatic # intensity:high
    
    Тайник? # style:thought # intensity:high
    
    { has_item(item_lockpick):
        -> ep1_open_cache
    - else:
        Нужен инструмент. И осторожность. # style:thought # intensity:low
        -> ep1_night_choice
    }

=== ep1_open_cache ===
Отвёрткой вы поддеваете доску. # style:action

Внутри — пусто. Но на стенках — следы. Кто-то хранил здесь что-то. Недавно. # style:thought # intensity:medium

И записка. Клочок бумаги с единственным словом: # style:dramatic # intensity:high

«БЕГИ» # style:horror # intensity:high # effect:glitch

-> lose_sanity_safe(3) ->

-> ep1_night_choice

* [Хватит — это паранойя]
    Вы следователь, а не домушник. Достаточно. # style:thought # intensity:low
    
    -> ep1_night_choice

=== ep1_phone_call ===
# mood: tense

Вы снимаете трубку. Тишина. Потом — щелчок. # style:action

— Внутренняя связь, — женский голос. Клава? — Соединить? # speaker:klava

* [Соединить с милицией]
    — Милиция. Дежурный. # speaker:sorokin
    
    — Это гостиница «Урал». Соединяю. # speaker:klava
    
    Гудки. Долго. Потом: # style:atmosphere # intensity:low
    
    — Дежурный Петров. Слушаю. # speaker:stranger
    
    — Это следователь Сорокин. Я хотел... # speaker:sorokin
    
    Тишина. Линия оборвалась. # style:dramatic # intensity:medium
    
    Вы перезваниваете. # style:action
    
    — Внутренняя связь... # speaker:klava
    
    — Соедините с милицией снова. # speaker:sorokin
    
    — Одну минуту... — Пауза. — Линия занята. Перезвоните позже. # speaker:klava
    
    Странно. Очень странно. # style:thought # intensity:high
    
    -> ep1_night_choice

* [Позвонить в Москву — доложить начальству]
    — Межгород. Москва. # speaker:sorokin
    
    — Межгород недоступен. Только местная связь. # speaker:klava
    
    — Это официальное дело. Я следователь... # speaker:sorokin
    
    — Извините, товарищ. Межгород закрыт. Профилактика на линии. # speaker:klava
    
    Профилактика. В закрытом городе. Как удобно. # style:thought # intensity:high
    
    -> ep1_night_choice

* [Спросить о предыдущем постояльце номера]
    — Клавдия Петровна? Скажите, кто жил в номере двенадцать до меня? # speaker:sorokin
    
    Долгая пауза.
    
    — Почему вы спрашиваете? # speaker:klava
    
    — Любопытство. # speaker:sorokin
    
    Ещё пауза. Потом — тихо: # style:atmosphere # intensity:medium
    
    — Зорин. Алексей Петрович. Он иногда оставался здесь, когда допоздна работал на заводе. # speaker:klava
    
    Она кладёт трубку. Не попрощавшись. # style:action
    
    Зорин жил в этом номере. В этой комнате. Может быть — на этой кровати. # style:thought # intensity:high
    
    И потом — исчез. # style:dramatic # intensity:high
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_night_choice

* [Положить трубку]
    Ничего срочного. # style:thought # intensity:low
    
    -> ep1_night_choice

=== ep1_study_files ===

# mood: investigation

Вы раскладываете содержимое папки на столе. Десять страниц. Десять жалких страниц на исчезновение человека. Лампа на столе — тусклая. Вы придвигаете её ближе. # style:atmosphere # intensity:medium

* [Начать с первой страницы]
    -> ep1_page1

=== ep1_page1 ===
СТРАНИЦА 1: РАПОРТ О ВОЗБУЖДЕНИИ ДЕЛА # style:document # intensity:medium

"24 октября 1986 г. В 09:15 в дежурную часть ГОВД обратилась гр. Зорина Т.А. с заявлением о безвестном исчезновении её отца, Зорина А.П., 1939 г.р., инженера завода 'Прометей'..." # style:document

Сухой канцелярский язык. Без эмоций, без деталей. # style:thought # intensity:low

* [Следующая страница]
    -> ep1_page2

=== ep1_page2 ===
СТРАНИЦЫ 2-3: ПРОТОКОЛ ОСМОТРА # style:document # intensity:medium

Осмотрели квартиру Зорина. Следов борьбы нет. Вещи на месте. Паспорт — в ящике стола. # style:document

Человек вышел из дома — и не вернулся. Без документов. Без денег (зарплату получил накануне, все 240 рублей — в конверте на столе). # style:thought # intensity:medium

Странно. Кто уходит без паспорта и денег? # style:thought # intensity:high

* [Следующая страница]
    -> ep1_page3

=== ep1_page3 ===
СТРАНИЦЫ 4-5: ОПРОС СВИДЕТЕЛЕЙ # style:document # intensity:medium

Двое видели Зорина вечером 23 октября. # style:document

Свидетель Иванов П.К.: "Видел Зорина в 18:50 на улице Ленина. Шёл в сторону дома. Один." # style:document

Свидетель Кузнецова М.И.: "Видела Зорина в 18:50 у гастронома на площади. Разговаривал с каким-то мужчиной. Лица не разглядела." # style:document

Стоп. Оба видели его в одно время? В разных местах? # style:thought # intensity:high

* [Отметить противоречие]
    Вы делаете пометку в блокноте: «Иванов, Кузнецова — проверить. 18:50 — противоречие.» # style:action
    -> ep1_page4

* [Следующая страница]
    -> ep1_page4

=== ep1_page4 ===
СТРАНИЦЫ 6-7: ПОИСКИ # style:document # intensity:medium

Прочёсывали окрестности три дня. С собаками. Ничего не нашли. # style:document

Три дня. Всего три дня на поиски пропавшего человека. В тайге. # style:thought # intensity:high

* [Следующая страница]
    -> ep1_page5

=== ep1_page5 ===
СТРАНИЦЫ 8-9: ПУСТЫЕ # style:document # intensity:low

Просто пустые. Как будто их вложили для объёма. # style:thought # intensity:medium

Или... из дела что-то изъяли? # style:thought # intensity:high

* [Следующая страница]
    -> ep1_page6

=== ep1_page6 ===
СТРАНИЦА 10: ЗАКЛЮЧЕНИЕ # style:document # intensity:medium

"Предположительно — несчастный случай. Рекомендуется прекратить поиски." # style:document # intensity:high

Подпись — Громов С.П. # style:important

Три недели расследования. Десять страниц. Несчастный случай. # style:thought # intensity:high

Вы закрываете папку. Что теперь? # style:thought

* [Искать нестыковки в показаниях]
    Вы возвращаетесь к показаниям свидетелей.
    
    Иванов и Кузнецова. Оба видели Зорина в одно время — 18:50. Но в РАЗНЫХ местах.
    
    Улица Ленина и площадь с гастрономом.
    
    Вы достаёте карту города (она была в папке — единственная полезная вещь). Находите оба места.
    
    Расстояние — минимум пятнадцать минут ходьбы. Даже бегом — пять-семь.
    
    Кто-то врёт.
    
    Или... оба видели кого-то другого? Или один из них — подставной свидетель?
    
    Вы делаете пометку в блокноте: "Иванов, Кузнецова — проверить".
    
    ~ CluesA += witness_conflict
    ~ sync_evidence_count()
    
    # clue
    Улика найдена: противоречие в показаниях свидетелей
    
    Ещё одна странность: Кузнецова упоминает "какого-то мужчину". С кем разговаривал Зорин? Почему это не проверили?
    
    И почему дело закрыли так быстро? Три недели — и "несчастный случай"?
    
    -> ep1_files_end

* [Составить план]
    Вы берёте блокнот. Записываете: # style:action
    
    1. Допросить свидетелей — Иванова и Кузнецову. Уточнить показания. # style:document
    2. Осмотреть маршрут Зорина — от завода до дома. # style:document
    3. Поговорить с дочерью — Таней Зориной. Что она знает об отце? # style:document
    4. Найти отца Серафима — Громов сказал, что он «кое-что знает». # style:document
    5. Проверить другие исчезновения — семь человек за два года. # style:document
    
    Много работы. Мало времени. # style:thought # intensity:medium
    
    -> ep1_files_end

=== ep1_files_end ===

Вы закрываете папку. # style:action

За окном — полная темнота. Часы показывают одиннадцать. # style:atmosphere # intensity:low

Два часа вы изучали десять страниц. Перечитывали каждое слово. Искали между строк. # style:thought # intensity:medium

И нашли — больше вопросов, чем ответов. # style:thought # intensity:high

Почему свидетели врут — или путают? Почему дело закрыли так быстро? Почему Громов боится? Почему весь город словно вымер? # style:thought # intensity:high

И что за пение вы слышали — или не слышали — из леса? # style:thought # intensity:high

Голова тяжёлая. Глаза слипаются. # style:atmosphere # intensity:low

Завтра. Всё — завтра. # style:thought # intensity:low

* [Лечь спать]
    Вы раздеваетесь. Ложитесь на жёсткую кровать. # style:action
    
    Пружины скрипят. # style:atmosphere # intensity:low
    
    За окном — тишина. Абсолютная. # style:atmosphere # intensity:medium
    
    ~ gain_sanity(3)
    
    Вы закрываете глаза. # style:action
    
    -> ep1_sleep

=== ep1_night_walk ===

# mood: horror

Вы выходите из гостиницы. # style:action

Клава за стойкой поднимает голову. Её глаза — испуганные. # style:thought # intensity:medium

— Товарищ следователь? Куда вы... # speaker:klava

— Прогуляюсь. # speaker:sorokin

Она открывает рот, чтобы что-то сказать, но вы уже выходите. # style:action

Холод — обжигающий. Мороз усилился — минус двадцать, не меньше. Снег скрипит под ногами. # style:atmosphere # intensity:medium

Город ночью — другой. # style:dramatic # intensity:high

Не просто пустой. Мёртвый. Фонари — не горят. Окна — тёмные. Ни звука, ни движения. # style:atmosphere # intensity:high

Как будто вы — единственный живой человек в радиусе километра. # style:thought # intensity:high

{ not (AfghanMemories ? memory_ambush):
    Это напоминает вам кое-что... # style:flashback # intensity:medium
    -> flashback_ambush ->
}

Вы идёте по улице. Ваши шаги — единственный звук в ночи. Гулко. Отчётливо. # style:atmosphere # intensity:medium

Эхо отскакивает от стен домов. # style:atmosphere # intensity:low

Небо — затянуто тучами. Ни луны, ни звёзд. Темнота — почти осязаемая. # style:atmosphere # intensity:high

Но где-то там — за городом — слабое красноватое свечение. От завода? От чего-то другого? # style:thought # intensity:medium

-> ep1_night_directions

=== ep1_night_directions ===
# mood: horror

Куда пойти? # style:thought

* [К заводу — на свечение]
    Вы поворачиваете в сторону свечения. К заводу. # style:action
    
    Улицы — пустые. Дома — тёмные. Ни души. # style:atmosphere # intensity:high
    
    Снег похрустывает под ногами. Холодный воздух обжигает лёгкие. # style:atmosphere # intensity:medium
    
    Завод — впереди. Его силуэт — чёрный на фоне красноватого неба. Трубы дымят, даже ночью. # style:atmosphere # intensity:high
    
    Вы подходите к забору. Бетонные плиты, колючая проволока сверху. # style:atmosphere # intensity:low
    
    И — останавливаетесь. # style:dramatic # intensity:high
    
    На заборе — что-то. # style:dramatic # intensity:high
    
    Символ. # style:horror # intensity:high
    
    Красный круг. Три линии к центру — как спицы в колесе. Или как... пальцы? Когти? # style:horror # intensity:high # effect:glitch
    
    Краска — свежая. Ещё блестит в свете вашего фонарика. # style:thought # intensity:medium
    
    Кто-то нарисовал это недавно. Сегодня? Вчера? # style:thought # intensity:medium
    
    Вы подходите ближе. Рассматриваете. # style:action
    
    Символ... знакомый? Где-то вы его видели. Или думаете, что видели. # style:thought # intensity:high
    
    ~ KeyEvents += saw_symbol
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesC ? cult_symbol):
        ~ CluesC += cult_symbol
        ~ sync_evidence_count()
        ~ boost_theory(5, 5)
        
        # clue
        Улика найдена: красный символ на заборе завода
    }
    ~ cult_awareness = cult_awareness + 2
    
    И тут — голос. За спиной. # style:dramatic # intensity:high
    
    — Не стоит здесь гулять ночью, товарищ. # speaker:stranger
    
    Вы резко оборачиваетесь. Рука — к кобуре. # style:action
    
    -> ep1_night_encounter

* [К окраине — к лесу]
    Вы идёте прочь от центра. В сторону, противоположную заводу. # style:action
    
    Улицы — пустые. Дома — тёмные. # style:atmosphere # intensity:medium
    
    Пятиэтажки сменяются трёхэтажками. Потом — двухэтажками. Потом — частный сектор. # style:atmosphere # intensity:low
    
    Маленькие домики за покосившимися заборами. Погасшие окна. Заснеженные дворы. # style:atmosphere # intensity:medium
    
    Ни одной собаки не лает. Ни одна не выбегает к забору. # style:thought # intensity:medium
    
    Странно. В таких посёлках всегда собаки. Много собак. И они всегда лают на чужаков. # style:thought # intensity:medium
    
    Но здесь — тишина. Абсолютная. # style:atmosphere # intensity:high
    
    Вы идёте дальше. # style:action
    
    Дома заканчиваются. Впереди — поле. А за полем — # style:atmosphere # intensity:medium
    
    Лес. # style:dramatic # intensity:high
    
    Чёрная стена деревьев. Сосны — высокие, неподвижные. Как часовые. # style:atmosphere # intensity:high
    
    И... свечение? Красноватое. Еле заметное. Где-то там, в глубине. # style:horror # intensity:medium
    
    Или это просто отблески завода? # style:thought # intensity:medium
    
    -> lose_sanity_safe(3) ->
    
    -> ep1_forest_edge

* [К кладбищу]
    Вы вспоминаете карту города. На востоке — кладбище. Старое, ещё дореволюционное. # style:thought # intensity:low
    
    Кладбища — хранители секретов. Мёртвые не лгут. # style:thought # intensity:medium
    
    Вы идёте узкими переулками. Сворачиваете за угол. # style:action
    
    Впереди — кованая ограда. Чёрные кресты на фоне серого неба. # style:atmosphere # intensity:high
    
    -> ep1_cemetery_night

* [К церкви]
    Вы заметили её днём — старую церковь на холме. Закрытую, с заколоченными окнами. # style:thought # intensity:low
    
    В атеистическом государстве церкви не работают. Но они стоят. И помнят. # style:thought # intensity:medium
    
    Вы поднимаетесь по узкой тропинке. # style:action
    
    -> ep1_church_night

* [Следить за патрулём]
    Вдалеке — свет фар. Машина милиции? # style:thought # intensity:medium
    
    Интересно. Громов сказал, что ночью не патрулируют. Но машина — есть. # style:thought # intensity:high
    
    Вы прячетесь в тени. Наблюдаете. # style:action
    
    -> ep1_follow_patrol

* [Вернуться — слишком опасно]
    Инстинкт выживания берёт верх. # style:thought # intensity:medium
    
    Вы разворачиваетесь. Быстрым шагом возвращаетесь в гостиницу. # style:action
    
    Клава за стойкой смотрит с облегчением: # style:thought # intensity:low
    
    — Слава богу. Я уж думала... # speaker:klava
    
    Она не договаривает. Вы не спрашиваете. # style:thought # intensity:medium
    
    ~ gain_sanity(3)
    
    -> ep1_sleep

=== ep1_cemetery_night ===
# mood: horror

Кладбище. # style:dramatic # intensity:high

Ворота — распахнуты. Ржавые петли скрипят на ветру. # style:atmosphere # intensity:medium

Между могил — снег. Нетронутый, белый. Никто не приходил сюда давно. # style:atmosphere # intensity:medium

Надгробия — старые. Многие покосившиеся. Надписи стёрты временем. # style:atmosphere # intensity:low

Вы включаете фонарик. Луч скользит по крестам, по ангелам с отбитыми крыльями, по плитам. # style:action

И — останавливается. # style:dramatic # intensity:high

Свежая могила. Без креста. Без надгробия. Просто холм земли, едва припорошенный снегом. # style:horror # intensity:high

Земля — рыхлая. Недавно копали. # style:thought # intensity:high

* [Осмотреть могилу ближе]
    Вы подходите. Наклоняетесь. # style:action
    
    На земле — следы. Не человеческие. Что-то с когтями. Много следов — вокруг могилы, как будто танцевали. # style:horror # intensity:high
    
    И — запах. Сладковатый. Тлен. # style:horror # intensity:high
    
    -> lose_sanity_safe(4) ->
    
    На краю ямы — клочок ткани. Красной ткани. # style:important
    
    Вы подбираете. Это — часть капюшона? Мантии? # style:thought # intensity:high
    
    { not (CluesC ? cult_symbol):
        ~ CluesC += cult_symbol
        ~ sync_evidence_count()
        ~ boost_theory(5, 5)
        УЛИКА: Красная ткань с кладбища.
    }
    
    ~ cult_awareness = cult_awareness + 2
    
    -> ep1_cemetery_sound

* [Уйти — здесь небезопасно]
    Что-то не так. Ваш инстинкт кричит — уходи. # style:thought # intensity:high
    
    Вы отступаете. Быстро. # style:action
    
    -> ep1_night_directions

=== ep1_cemetery_sound ===
# mood: horror

Звук. # style:dramatic

Откуда-то из глубины кладбища. Не ветер. Не скрип. # style:atmosphere

Голоса. Много голосов. Поют. # style:whisper # intensity:high

Тот же напев, что вы слышали в гостинице. Только громче. Ближе. # style:horror # intensity:high

Вы оборачиваетесь. # style:action

Между могилами — движение. Фигуры. Тёмные силуэты. # style:horror # effect:shake

Идут к вам? Или просто идут? # style:thought # intensity:high

-> lose_sanity_safe(5) ->
~ KeyEvents += heard_voices

* [Спрятаться и наблюдать]
    Вы приседаете за надгробием. Затаив дыхание. # style:action
    
    Фигуры проходят мимо. Пять... семь... девять человек? В длинных тёмных одеждах. Капюшоны скрывают лица. # style:horror # intensity:high
    
    Они поют. Без слов. Монотонный напев, от которого волосы встают дыбом. # style:whisper # intensity:high
    
    Впереди идущий несёт что-то. Длинное. Завёрнутое в ткань. # style:horror # intensity:high
    
    Тело? # style:thought # intensity:high
    
    Они сворачивают к старой часовне. Исчезают внутри. # style:action
    
    ~ KeyEvents += witnessed_ritual
    ~ cult_awareness = cult_awareness + 5
    
    * * [Следовать за ними]
        Безумие. Но вы должны знать. # style:thought # intensity:high
        
        Вы крадётесь к часовне. Дверь — приоткрыта. # style:action
        
        Свет внутри. Красный. Как от свечей. # style:atmosphere # intensity:high
        
        Вы заглядываете в щель... # style:action
        
        -> ep1_chapel_peek
    
    * * [Уйти — достаточно увидели]
        Нужно уйти. Сейчас. Пока не заметили. # style:thought # intensity:high
        
        Вы отползаете назад. Встаёте. Бежите. # style:action
        
        Сердце колотится. В ушах — пение. # style:atmosphere # intensity:high
        
        -> ep1_escape_cemetery

* [Бежать]
    К чёрту всё. # style:thought # intensity:high
    
    Вы бежите. Между могил. К воротам. # style:action
    
    Не оглядываясь. # style:dramatic # intensity:high
    
    -> ep1_escape_cemetery

=== ep1_chapel_peek ===
# mood: horror

Часовня. # style:dramatic

Внутри — свечи. Десятки свечей. Красные огни в темноте. # style:atmosphere

Фигуры в капюшонах стоят кругом. В центре — алтарь. Каменный. Древний. # style:horror # intensity:high

На алтаре — тело. Человек? Вы не уверены. Он... она... не двигается. # style:horror # intensity:high # effect:glitch

Один из фигур выходит вперёд. Снимает капюшон. # style:action

Вы узнаёте лицо. # style:dramatic

Громов. Майор Громов. # style:important # intensity:high

Он поднимает руки. Говорит что-то на языке, который вы не понимаете. # style:horror # intensity:medium

Остальные отвечают хором. Низкие голоса. Гудение. # style:whisper # intensity:high

И тут — тело на алтаре дёргается. # style:horror # intensity:high # effect:shake

Оно живое. # style:dramatic # intensity:high

-> lose_sanity_safe(10) ->
~ trust_gromov = trust_gromov - 30
~ cult_awareness = cult_awareness + 10

Вы отшатываетесь. Ваша нога задевает камень. # style:action

Звук. # style:dramatic

Пение обрывается. # style:horror # intensity:high

Все головы поворачиваются — к двери. К вам. # style:horror # intensity:high # effect:shake

— БЕГИ! # style:whisper # intensity:high

Голос — в вашей голове? Снаружи? Вы не знаете. # style:thought

Но вы бежите. # style:dramatic

-> ep1_escape_cemetery

=== ep1_escape_cemetery ===
# mood: horror

Вы бежите. # style:dramatic

Между могилами. Спотыкаясь. Падая. Поднимаясь. # style:action

Позади — звуки погони? Или это ваше воображение? # style:horror # intensity:high

Вы не оглядываетесь. # style:thought

Ворота — впереди. Вы вылетаете на улицу. # style:action

Бежите. Бежите. Бежите. # style:dramatic

Гостиница. Дверь. Внутрь. # style:action

Клава вскакивает:

— Господи! Товарищ следователь! На вас лица нет! # speaker:klava

Вы не отвечаете. Поднимаетесь по лестнице. В номер. Запираете дверь. # style:action

Садитесь на кровать. Пытаетесь успокоить дыхание. # style:atmosphere

Что это было? Что вы видели? # style:thought

~ temp recovery = gain_sanity(2)

-> ep1_sleep

=== ep1_church_night ===
# mood: mystery

Церковь на холме. # style:dramatic # intensity:medium

Старая. Деревянная. Купола — почерневшие, без крестов. Окна — заколочены досками. # style:atmosphere # intensity:medium

«Закрыта решением Исполкома. 1937 г.» — табличка на двери. # style:document

Почти пятьдесят лет. Стоит, но не работает. # style:thought # intensity:low

Вы обходите здание. Ищете вход. # style:action

* [Попробовать заднюю дверь]
    За церковью — кладбище. Маленькое. Церковное. # style:atmosphere # intensity:medium
    
    И дверь. Приоткрытая. # style:dramatic # intensity:medium
    
    Кто-то был здесь недавно. # style:thought # intensity:high
    
    Вы входите. # style:action
    
    -> ep1_church_inside

* [Осмотреть кладбище при церкви]
    Надгробия — старые. Дореволюционные. Священники, купцы, дворяне. # style:atmosphere # intensity:low
    
    И одно — новое. Относительно новое. # style:thought # intensity:medium
    
    «Серафим Иванович Волков. 1889-1984. Хранитель». # style:document # intensity:high
    
    Хранитель чего? # style:thought # intensity:high
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_night_directions

* [Вернуться — слишком темно]
    Без нормального освещения здесь делать нечего. # style:thought # intensity:low
    
    -> ep1_night_directions

=== ep1_church_inside ===
# mood: horror

Темнота. Запах плесени и ладана. # style:atmosphere # intensity:medium

Ваш фонарик выхватывает из мрака: # style:action

Иконы — почерневшие, с выцарапанными ликами. # style:horror # intensity:medium

Алтарь — перевёрнутый, сломанный. # style:horror # intensity:medium

На полу — следы. Свежие. Много следов. # style:thought # intensity:high

И — символы. На стенах. Красной краской. # style:horror # intensity:high

Те же символы, что на заборе завода. Круги. Линии. Что-то древнее. # style:horror # intensity:high

{ CluesC ? cult_symbol:
    Вы видели это раньше. Уже дважды. Это не совпадение. # style:thought # intensity:high
}

* [Осмотреть алтарь]
    Под алтарём — люк. Старый, деревянный. # style:important
    
    Вы поднимаете крышку. # style:action
    
    Лестница вниз. В темноту. # style:atmosphere # intensity:high
    
    { has_item(item_flashlight):
        Луч фонарика тонет в черноте. Но вы видите — там что-то есть. Внизу. # style:thought # intensity:high
        
        * * [Спуститься]
            Вы делаете шаг вниз. Ступени скрипят. # style:action
            
            Ещё шаг. Ещё. # style:atmosphere # intensity:medium
            
            Холод. Сырость. Запах земли. # style:atmosphere # intensity:medium
            
            Внизу — туннель. Узкий. Уходит куда-то под город. # style:atmosphere # intensity:high
            
            { not (CluesB ? underground_map):
                ~ CluesB += underground_map
                ~ sync_evidence_count()
                УЛИКА: Подземный ход под церковью. # style:important
            }
            
            ~ unlock_location(old_mine)
            
            Вы слышите звуки. Где-то впереди. Голоса? # style:horror # intensity:medium
            
            Нет. Не сегодня. Нужно подготовиться. # style:thought # intensity:medium
            
            Вы возвращаетесь наверх. # style:action
            
            -> ep1_night_directions
        
        * * [Не рисковать]
            Не сейчас. Один. Ночью. Это безумие. # style:thought # intensity:high
            
            Вы запоминаете место. Вернётесь днём. # style:thought # intensity:low
            
            -> ep1_night_directions
    - else:
        Слишком темно. Нужен фонарик. # style:thought # intensity:low
        
        -> ep1_night_directions
    }

* [Искать документы]
    В углу — шкаф. Покосившийся, с выбитым стеклом. # style:atmosphere # intensity:low
    
    Внутри — книги. Церковные книги. И папка. # style:thought # intensity:medium
    
    «Приходская летопись. 1890-1917.» # style:document # intensity:medium
    
    Вы открываете наугад. # style:action
    
    «Июнь 1890. В окрестностях села обнаружены странные знаки на деревьях. Крестьяне утверждают, что слышат голоса в лесу по ночам. Отец Серафим провёл молебен...» # style:document # intensity:high
    
    Отец Серафим. Как на могиле? # style:thought # intensity:high
    
    { not (CluesD ? expedition_1890):
        ~ CluesD += expedition_1890
        ~ sync_evidence_count()
        УЛИКА: Записи 1890 года — странности начались давно. # style:important
    }
    
    ~ cult_awareness = cult_awareness + 3
    
    -> ep1_night_directions

* [Уйти]
    Достаточно. Нужно обдумать увиденное. # style:thought # intensity:low
    
    -> ep1_night_directions

=== ep1_follow_patrol ===
# mood: tense

Вы следуете за машиной. Держитесь в тени. # style:action

«УАЗик» милиции медленно едет по пустым улицам. Останавливается у перекрёстка. # style:atmosphere # intensity:medium

Выходит человек. В форме. Оглядывается. # style:action

Это не патруль. Он что-то ищет. # style:thought # intensity:medium

Или кого-то ждёт. # style:thought # intensity:high

Из переулка появляется второй человек. В гражданском. Они разговаривают. # style:action

Вы подбираетесь ближе. Прячетесь за мусорным баком. # style:action

Слышите обрывки разговора: # style:thought # intensity:medium

«...следователь... из Москвы...» # style:whisper # intensity:high

«...Громов сказал — не трогать. Пока.» # style:whisper # intensity:high

«...а если он найдёт?...» # style:whisper # intensity:high

«...не найдёт. Всё убрали. Зорин... и другие...» # style:whisper # intensity:high

Зорин. Они говорят о Зорине. # style:thought # intensity:high

~ cult_awareness = cult_awareness + 2

* [Слушать дальше]
    «...шахта?» # style:whisper # intensity:medium
    
    «Закрыта. Охрана. Никто не пройдёт.» # style:whisper # intensity:medium
    
    «...а Фёдор? Он видел...» # style:whisper # intensity:high
    
    «Фёдор — дурак городской. Кто ему поверит?» # style:whisper # intensity:medium
    
    Фёдор. Ещё одно имя. # style:thought # intensity:high
    
    Милиционер садится в машину. Уезжает. # style:action
    
    Второй человек уходит в переулок. # style:action
    
    Вы ждёте. Потом — возвращаетесь в гостиницу. # style:action
    
    ~ trust_gromov = trust_gromov - 10
    
    -> ep1_sleep

* [Проследить за человеком в гражданском]
    Он сворачивает в переулок. Вы — за ним. # style:action
    
    Узкий проход между домами. Тёмный. # style:atmosphere # intensity:medium
    
    Человек идёт быстро. Сворачивает за угол. # style:action
    
    Вы ускоряете шаг. Поворачиваете — # style:action
    
    Пусто. Никого. # style:dramatic # intensity:high
    
    Тупик. Глухая стена. # style:atmosphere # intensity:medium
    
    Куда он делся? # style:thought # intensity:high
    
    -> lose_sanity_safe(3) ->
    
    Вы стоите в тупике. Один. В темноте. # style:atmosphere # intensity:high
    
    И чувствуете — за спиной кто-то есть. # style:horror # intensity:high
    
    Вы резко оборачиваетесь — # style:action
    
    Никого. # style:dramatic # intensity:high
    
    Хватит. На сегодня — хватит. # style:thought # intensity:medium
    
    -> ep1_escape_cemetery

=== ep1_night_encounter ===

~ MetCharacters += fyodor

# mood: horror

Мужчина. # style:dramatic # intensity:high

Невысокий. В старой телогрейке, застиранной до серости. На голове — ушанка с опущенными ушами. Лицо — в тени. Вы видите только силуэт. # style:atmosphere # intensity:medium

Откуда он взялся? Вы не слышали шагов. # style:thought # intensity:high

— Уходите. # speaker:fyodor

Голос — хриплый, надломленный. Как будто он не говорил с людьми очень давно. # style:thought # intensity:medium

— Уходите. Пока можете. Пока... ОНИ не заметили. # speaker:fyodor

Ваша рука — на кобуре. Но вы не достаёте пистолет. # style:action

— Вы кто? # speaker:sorokin

— Фёдор. — Он делает шаг назад. В тень. — Сторож. Бывший. Теперь — никто. # speaker:fyodor

— Сторож чего? # speaker:sorokin

Он не отвечает. Смотрит — не на вас. Куда-то в сторону. В сторону леса. # style:thought # intensity:medium

— Они видят. — Его голос — еле слышный шёпот. — Всегда видят. Красный лес... он зовёт... он всегда зовёт новичков... # speaker:fyodor

— Что? Какой красный лес? # speaker:sorokin

Фёдор отступает ещё на шаг. Его лицо на мгновение попадает в свет вашего фонарика. # style:action

Старое. Измождённое. Глаза — дикие, но ясные. Шрамы на щеке — три параллельные линии, как следы когтей. # style:thought # intensity:high

— Уходите. — Его голос — умоляющий. — Завтра. Первым автобусом. Уезжайте из этого города. Забудьте. Забудьте всё. # speaker:fyodor

И он исчезает. # style:dramatic # intensity:high

Не уходит — исчезает. В темноте. Бесшумно. # style:horror # intensity:high

Вы стоите один. У забора завода. С красным символом перед глазами. # style:atmosphere # intensity:high

Где-то в лесу — то ли вой ветра, то ли... голоса? # style:horror # intensity:medium

-> lose_sanity_safe(5) ->
~ KeyEvents += heard_voices
~ KeyEvents += fyodor_warned

* [Вернуться в гостиницу]
    Хватит. # style:thought # intensity:high
    
    Вы разворачиваетесь. Идёте назад. Быстро. Почти бежите. # style:action
    
    Не оглядываетесь. # style:action
    
    Сердце колотится. В ушах — шум крови. # style:atmosphere # intensity:high
    
    Фёдор. Сторож. «Они видят». «Красный лес зовёт». # style:thought # intensity:high
    
    Что это было? Сумасшедший? Или... # style:thought # intensity:high
    
    Нужно найти его. Расспросить. Но не сейчас. Не ночью. # style:thought # intensity:medium
    
    Гостиница — впереди. Тёплый свет в окнах. # style:atmosphere # intensity:low
    
    Вы ускоряете шаг. # style:action
    
    -> ep1_sleep

=== ep1_forest_edge ===

# mood: horror

Лес начинается резко. Без перехода. Поле — и сразу стена деревьев. # style:atmosphere # intensity:high

Сосны — высокие, чёрные. Их стволы — как колонны огромного собора. Кроны смыкаются далеко наверху, закрывая небо. # style:atmosphere # intensity:high

Вы останавливаетесь на границе. Нога — на последнем клочке заснеженного поля. Перед вами — темнота. # style:atmosphere # intensity:high

Абсолютная. Непроницаемая. # style:horror # intensity:high

Фонарик — бесполезен. Его луч тонет в черноте, как камень в болоте. # style:thought # intensity:high

И — запах. # style:dramatic # intensity:medium

Сладковатый. Тяжёлый. Как... разложение? Гниющие листья? Что-то мёртвое? # style:horror # intensity:medium

Нет. Не совсем. Что-то... древнее. Как запах склепа, который не открывали столетия. # style:horror # intensity:high

Вы стоите. Смотрите в темноту. # style:action

И темнота — смотрит на вас. # style:horror # intensity:high # effect:glitch

Это ощущение — физическое. Как будто тысяча глаз — там, между деревьями — следит за каждым вашим движением. # style:horror # intensity:high

Ветра нет. Ни звука. Даже ваше дыхание — словно поглощается темнотой. # style:atmosphere # intensity:high

И тут — # style:dramatic # intensity:high

Движение. # style:horror # intensity:high # effect:shake

Там. Между стволами. В глубине. # style:horror # intensity:high

* [Подойти ближе]
    Вы делаете шаг. В лес. # style:action
    
    Темнота — обнимает. Холод — другой, не такой, как снаружи. Влажный. Липкий. # style:horror # intensity:high
    
    Ещё шаг. # style:action
    
    Что-то — белое? — мелькает между деревьями. В тридцати метрах. В пятнадцати. # style:horror # intensity:high # effect:shake
    
    Лицо? # style:thought # intensity:high
    
    Бледное пятно в темноте. Глаза? Или... # style:horror # intensity:high # effect:glitch
    
    Вы моргаете. # style:action
    
    Там — ничего. Только стволы сосен. Только темнота. # style:atmosphere # intensity:high
    
    Но ощущение взгляда — не исчезает. Наоборот — усиливается. # style:horror # intensity:high
    
    Где-то — еле слышно — смех? Или плач? # style:whisper # intensity:high
    
    ~ KeyEvents += heard_voices
    -> hear_the_voices ->
    
    -> ep1_forest_retreat

* [Отступить]
    Нет. # style:thought # intensity:high
    
    Что-то внутри вас — древний, первобытный инстинкт — кричит: НЕ ХОДИ. # style:thought # intensity:high
    
    Вы делаете шаг назад. Потом ещё один. # style:action
    
    Не отворачиваетесь. Не отводите взгляда от темноты между деревьями. # style:action
    
    -> ep1_forest_retreat

=== ep1_forest_retreat ===

Вы отступаете. # style:action

Шаг за шагом. Не отворачиваясь от леса. # style:action

Спиной ощущаете... взгляд. Давление. Как будто что-то — огромное, древнее — смотрит вам вслед. # style:horror # intensity:high

Хочет, чтобы вы вернулись. # style:horror # intensity:medium

Зовёт. # style:whisper # intensity:high

{ sanity < 70:
    -> hear_the_voices ->

    Вы не оглядываетесь. Всю дорогу до гостиницы — не оглядываетесь. # style:thought # intensity:high

    Потому что боитесь. Боитесь увидеть то, что идёт за вами. # style:thought # intensity:high

    Или — боитесь убедиться, что там никого нет? Что всё это — в вашей голове? # style:thought # intensity:high

    Что страшнее? # style:thought # intensity:high
}

Поле. Частный сектор. Улицы города. # style:atmosphere # intensity:low

Всё так же пусто. Всё так же тихо. # style:atmosphere # intensity:medium

Но теперь тишина — другая. Не мёртвая. Ожидающая. # style:atmosphere # intensity:high

Гостиница — впереди. Свет в окнах. Тепло. # style:atmosphere # intensity:low

Вы почти бежите последние метры.

Дверь. Вестибюль. Лестница.

Номер двенадцать. # style:title # intensity:low

Вы запираете дверь. Проверяете — дважды. # style:action

Задёргиваете шторы.

Садитесь на кровать.

Руки — дрожат.

Что это было?

-> ep1_sleep

=== ep1_sleep ===

# mood: dark

Кровать — жёсткая. Пружины впиваются в спину. # style:atmosphere # intensity:low

Вы лежите. Смотрите в потолок. Трещины на штукатурке — как паутина. Или как карта рек. # style:atmosphere # intensity:medium

{ KeyEvents ? heard_voices:
    Голоса. Вы слышали голоса. Пение — из леса. Шёпот — у завода. # style:thought # intensity:high
    
    "Красный лес зовёт", — сказал Фёдор. "Он всегда зовёт новичков". # style:whisper # intensity:medium
    
    Что это значит? # style:thought # intensity:high
}

{ KeyEvents ? saw_symbol:
    -> see_cult_symbol ->
}

За окном — тишина. Абсолютная. # style:atmosphere # intensity:high

Город спит. Или делает вид, что спит. # style:thought # intensity:medium

Сон приходит медленно. Как прилив — накатывает волнами, отступает, накатывает снова. # style:atmosphere # intensity:medium

Вы проваливаетесь. # style:dramatic # intensity:high

-> ep1_dream

=== ep1_dream ===

# mood: horror

... # style:vision # intensity:low

Вы стоите в лесу. # style:vision # intensity:medium

Те же сосны. Те же чёрные стволы. Но что-то — другое. # style:vision # intensity:medium

Цвет. # style:dramatic # intensity:high

Сосны — красные. Их кора — тёмно-бордовая, как запёкшаяся кровь. Хвоя — алая, словно облитая вином. # style:vision # intensity:high

Небо — не видно. Кроны смыкаются высоко над головой. Но сквозь них пробивается свечение — багровое, пульсирующее. # style:vision # intensity:high

Вы идёте. # style:action

Не контролируете ноги. Они несут вас сами — по тропе, которой не видите, к месту, которого не знаете. # style:vision # intensity:high

Впереди — поляна. # style:vision # intensity:medium

На поляне — люди. # style:horror # intensity:high

Двенадцать. Или двадцать. Или сто — вы не можете сосчитать. Они стоят кругом. В капюшонах — чёрных, как провалы в реальности. Лиц не видно. Только тени. # style:horror # intensity:high # effect:glitch

Они поют. # style:whisper # intensity:high

Тот самый хор. Те же голоса. Низкие, протяжные. Без слов — только звук. Он вибрирует в костях, резонирует в черепе. # style:whisper # intensity:high

В центре круга — что-то. # style:horror # intensity:high

Алтарь? Камень? Вы не можете разобрать. Только свечение — яркое, белое, ослепительное. # style:vision # intensity:high # effect:glitch

Один из стоящих поворачивается. # style:action

Капюшон — падает. # style:horror # intensity:high

Лицо — ваше собственное. # style:horror # intensity:high # effect:glitch

— Ты уже здесь. — Ваш голос. Из чужого рта. — Ты всегда был здесь. С самого начала. # style:whisper # intensity:high

// Интенсивность сна зависит от состояния рассудка
{ is_disturbed():
    Голоса — громче. Ближе. Они окружают вас. # style:whisper # intensity:high
    
    «...приди к нам...» # style:whisper # intensity:high
    
    «...ты наш...» # style:whisper # intensity:high
    
    «...всегда был наш...» # style:whisper # intensity:high
    
    Руки — тянутся из темноты. Бледные, холодные. Хватают за плечи, за руки. # style:horror # intensity:high # effect:shake
    
    Тянут — к алтарю. # style:horror # intensity:high
}

{ is_mad():
    ОНО. # style:horror # intensity:high # effect:glitch
    
    В центре круга. Над алтарём. # style:horror # intensity:high
    
    У него нет формы. Нет лица. Нет тела. # style:horror # intensity:high
    
    Но ОНО смотрит. На вас. ТОЛЬКО на вас. # style:horror # intensity:high # effect:shake
    
    И голос — громом — в голове: # style:whisper # intensity:high
    
    «...СКОРО...» # style:whisper # intensity:high
    
    «...ТЫ ПРИДЁШЬ...» # style:whisper # intensity:high
    
    «...ТЫ НАШ...» # style:whisper # intensity:high
    
    -> lose_sanity_safe(2) ->
}

Вы пытаетесь кричать. Горло — сжато. Звука нет. # style:horror # intensity:high

Вы пытаетесь бежать. Ноги — не двигаются. # style:horror # intensity:high

Круг сужается. # style:horror # intensity:high # effect:shake

Лица под капюшонами — все ваши. Сотни копий вашего лица. Улыбаются. Одинаково. Страшно. # style:horror # intensity:high # effect:glitch

И — # style:dramatic # intensity:high

... # style:vision # intensity:low

* [Проснуться]
    Вы просыпаетесь. # style:action
    
    Резко. С криком? Без крика? Не помните. # style:thought # intensity:medium
    
    Сердце — колотится. Простыня — мокрая от пота. # style:atmosphere # intensity:medium
    
    За окном — серый свет. Утро. # style:atmosphere # intensity:low
    
    Сон. Просто сон. # style:thought # intensity:medium
    
    Вы повторяете это — как мантру. # style:thought # intensity:medium
    
    Просто сон. # style:thought # intensity:low
    
    -> ep1_morning

=== ep1_morning ===

# chapter: 1
# mood: investigation

15 НОЯБРЯ 1986 ГОДА # style:title # intensity:medium

День первый расследования # style:subtitle

Стук. # style:dramatic # intensity:medium

Громкий, настойчивый. Костяшки пальцев по дереву. # style:atmosphere # intensity:low

— Товарищ Сорокин! Завтрак готов! # speaker:klava

Голос Клавы. Бодрый, несмотря на ранний час. # style:thought # intensity:low

Вы открываете глаза. # style:action

Потолок — незнакомый. Трещины в штукатурке. Жёлтое пятно от протечки. # style:atmosphere # intensity:low

Где... # style:thought # intensity:medium

Красногорск-12. Гостиница "Урал". Номер двенадцать. # style:thought # intensity:low

Вы вспоминаете. # style:thought # intensity:medium

{ sanity < 70:
    Сон.
    
    Красный лес. Фигуры в капюшонах. Лица — ваши собственные, сотни копий, улыбающихся в темноте.
    
    И голос: "Ты уже здесь. Ты всегда был здесь."
    
    Вы садитесь на кровати. Руки — трясутся.
    
    Просто сон. Так вы себе говорите.
    
    Просто сон.
    
    Но сердце — всё ещё колотится. И во рту — привкус меди. Как будто кусали язык.
}

{ sanity >= 70:
    Вы спали крепко. Удивительно крепко для первой ночи в незнакомом месте.
    
    Снилось что-то... странное. Но вы не помните. Только ощущение — тревожное, давящее.
}

За окном — серый свет. Утро.

Часы на тумбочке показывают семь тридцать.

* [Встать]
    Вы откидываете одеяло. Холодный воздух — обжигает кожу.
    
    Ноги — на ледяной пол. Вы морщитесь.
    
    Умывальник в углу. Холодная вода — как пощёчина.
    
    -> look_in_mirror ->
    
    — Товарищ Сорокин? — Снова Клава. — Каша стынет! # speaker:klava
    
    — Иду! # speaker:sorokin
    
    Вы одеваетесь. Проверяете — пистолет на месте, в кобуре. Документы — в кармане.
    
    Готовы.
    
    -> ep1_morning_choice

=== ep1_morning_choice ===

Столовая на первом этаже — маленькая, уютная. Запах каши, кофе, свежего хлеба.

Вы единственный посетитель.

Клава ставит перед вами тарелку. Гречневая каша с маслом. Стакан чая. Хлеб с маслом.

-> greet_klava ->

— Плохо спали? Бледный вы какой-то. # speaker:klava

— Нормально. — Вы берёте ложку. — Спасибо за завтрак. # speaker:sorokin

Каша — горячая, вкусная. Вы едите молча. Думаете. # style:atmosphere

В блокноте — план:
1. Допросить свидетелей — Иванова и Кузнецову.
2. Поговорить с Таней Зориной — дочерью пропавшего.
3. Найти отца Серафима — священника, о котором говорил Громов.
4. Проверить место исчезновения — маршрут от завода до дома Зорина.

День — длинный. Можно успеть многое.

С чего начать?

* [На завод — к Тане]
    Дочь пропавшего. Она — ключ. Она знала отца лучше всех.
    
    И она "уверена, что его убили" — по словам Клавы.
    
    Вы допиваете чай.
    
    — Клавдия Петровна, как добраться до завода "Прометей"? # speaker:sorokin
    
    — Прямо по улице, товарищ следователь. Десять минут пешком. Большое такое здание, не пропустите. # speaker:klava
    
    -> ep1_meet_tanya

* [В милицию — к свидетелям]
    Свидетели. Иванов и Кузнецова. Их показания — противоречат друг другу.
    
    Кто-то врёт. Нужно выяснить — кто.
    
    Вы допиваете чай.
    
    — Спасибо, Клавдия Петровна. Вкусно. # speaker:sorokin
    
    — На здоровье. — Она улыбается. — Осторожнее там. На улицах. # speaker:klava
    
    Странное предупреждение. Но вы уже привыкли к странностям этого города.
    
    -> ep1_witnesses

* { days_remaining >= 4 } [К Серафиму]
    Священник. Отец Серафим. "Он кое-что знает", — сказал Громов.
    
    Что именно? И почему майор милиции — человек, который должен верить в факты — направил вас к священнику?
    
    Вы допиваете чай.
    
    — Клавдия Петровна, как найти старую церковь? На окраине. # speaker:sorokin
    
    Клава замирает. На мгновение — её лицо меняется. Страх? # style:action
    
    — Церковь? Вам туда зачем? # speaker:klava
    
    — По делу. # speaker:sorokin
    
    — А... — Она качает головой. — За частным сектором. Прямо по дороге, потом — направо у большого дуба. Там увидите. # speaker:klava
    
    — Спасибо. # speaker:sorokin
    
    -> ep1_meet_serafim

* [В городской архив — искать документы]
    История. Иногда ответы — в прошлом.
    
    — Клавдия Петровна, в городе есть архив? Где хранятся старые документы? # speaker:sorokin
    
    — Архив? — Она удивлённо поднимает брови. — Есть, конечно. Бывшая школа, на улице Советской. Там Мария Фёдоровна работает. Старая уже, но память — как у слона. # speaker:klava
    
    — Спасибо. # speaker:sorokin
    
    Вы допиваете чай и выходите на улицу.
    
    -> city_archive
    
    -> ep1_meet_serafim

=== ep1_after_first_visit ===

// После первого визита — можно посетить ещё одно место

Ещё не поздно. Куда дальше?

// ИСПРАВЛЕНО: choices вынесены из условий для корректной работы Ink
* { not (MetCharacters ? tanya) } [На завод — к Тане]
    -> ep1_meet_tanya_short

* { not (MetCharacters ? serafim) } [К Серафиму]
    -> ep1_meet_serafim_short

* [Хватит на сегодня]
    -> ep1_day_continue

=== ep1_meet_tanya_short ===

~ MetCharacters += tanya

Завод "Прометей". Таня Зорина. # style:title # intensity:medium

// Прогрессия отношений с Таней — краткая версия
-> see_tanya ->

— Вы следователь? Я знала, что вы придёте. # speaker:tanya

Она коротко рассказывает о странном поведении отца перед исчезновением.

— Приходите вечером. К памятнику. Я покажу кое-что важное. # speaker:tanya

~ trust_tanya = trust_tanya + 10
// Флаг приглашения на встречу (отдельный от found_notebook)
~ KeyEvents += tanya_invited

-> ep1_day_continue

=== ep1_meet_serafim_short ===

~ MetCharacters += serafim

Церковь на окраине. Отец Серафим. # style:title # intensity:medium

— Вы приехали из-за пропавших. — Не вопрос. Утверждение. # speaker:serafim

— Откуда вы знаете? # speaker:sorokin

— Город маленький. Слухи ходят быстро. — Он смотрит на вас оценивающе. — Вы не первый следователь. Но, надеюсь, — последний. # speaker:serafim

— Что вы имеете в виду? # speaker:sorokin

— Приходите ко мне. Вечером. Или завтра. — Он понижает голос. — Есть вещи, которые нельзя говорить при свете дня. # speaker:serafim

Странный старик. Но что-то в его глазах — искреннее. Или очень хорошо сыгранное.

~ trust_serafim = trust_serafim + 5
~ boost_theory(3, 3)

— Будьте осторожны, следователь. В этом городе... не все — те, за кого себя выдают. # speaker:serafim

// Флаг встречи
~ Relationships += helped_serafim

-> ep1_day_continue

=== ep1_meet_tanya ===

~ MetCharacters += tanya

Завод "Прометей". Проходная. # style:title # intensity:medium

— Мне нужна Зорина Татьяна Алексеевна. # speaker:sorokin

Охранник — пожилой мужчина с усталыми глазами — смотрит на ваше удостоверение. Долго. Слишком долго.

— Инженерный корпус, комната 214. — Пауза. — Она... хорошая девочка. Не обижайте её. # speaker:stranger

Странная просьба от охранника. Но вы киваете. # style:thought

Коридоры завода — длинные, серые, пропахшие машинным маслом и чем-то кислым. Химикаты? Трубы под потолком гудят. Где-то вдалеке — ритмичный стук машин. # style:atmosphere # intensity:medium

Комната 214. Дверь приоткрыта. # style:title # intensity:medium

// Прогрессия отношений с Таней — первая встреча
-> see_tanya ->

За столом — молодая женщина. Двадцать три года — написано в деле, но выглядит старше. Рыжие волосы собраны в небрежный пучок. Веснушки на бледном лице. Тёмные круги под глазами — она не спит. Давно не спит. # style:atmosphere # intensity:medium

На столе — чертежи, папки, фотография в рамке. Вы видите её краем глаза: мужчина и женщина, молодые, счастливые. Свадебное фото? # style:atmosphere

Она поднимает голову. Её глаза — зелёные, яркие, несмотря на усталость — встречаются с вашими. # style:atmosphere # intensity:high

— Вы следователь. Клава из гостиницы звонила вчера. — Её голос — ровный, контролируемый. Как у человека, который слишком долго держит себя в руках. — Я ждала вас. # speaker:tanya

Она встаёт. Закрывает дверь. Оборачивается. # style:action # intensity:medium

— Три недели. Три недели я жду кого-то, кто будет искать по-настоящему. А не просто... — Она замолкает. Сжимает кулаки. # speaker:tanya

* [Представиться]
    — Сорокин, Виктор Андреевич. Примите соболезнования. # speaker:sorokin
    
    — Соболезнования? — Её глаза вспыхивают. — Папа не умер. Я уверена. Они все говорят "примите соболезнования", как будто уже похоронили его. Но тела нет. Значит — он жив. # speaker:tanya
    
    Упрямство. Или надежда. Или и то, и другое. # style:thought
    
    — Расскажите о нём. # speaker:sorokin
    
    -> ep1_tanya_talk

* [Сразу к делу]
    — Расскажите об отце. # speaker:sorokin
    
    — Вы не из тех, что приходили раньше. — Она смотрит на вас оценивающе. — Те задавали три вопроса и уходили. "Когда видели последний раз? Были ли враги? Не злоупотреблял ли алкоголем?" — Её голос становится горьким. — Как по бумажке. # speaker:tanya
    
    — Я не по бумажке. # speaker:sorokin
    
    — Посмотрим. # speaker:tanya
    
    -> ep1_tanya_talk

* [Заметить фотографию]
    Вы смотрите на фотографию на столе. # style:action
    
    — Ваши родители? # speaker:sorokin
    
    Таня вздрагивает. Отворачивается. На мгновение — только на мгновение — её маска контроля трескается. # style:action
    
    — Да. Их свадьба. Шестьдесят второй год. # speaker:tanya
    
    — Ваша мать...? # speaker:sorokin
    
    — Умерла. — Короткое слово. Острое, как нож. — Когда мне было восемь. Рак. # speaker:tanya
    
    Она берёт фотографию. Смотрит на неё. # style:action
    
    — Папа... он поседел за один месяц. Ему было тридцать пять, а стал похож на старика. Но не сломался. Ради меня — не сломался. # speaker:tanya # intensity:high
    
    ~ CharacterSecrets += tanya_mother_story
    ~ understanding_tanya += 15
    ~ trust_tanya += 10
    
    -> ep1_tanya_childhood

=== ep1_tanya_childhood ===

# mood: emotional

— Расскажите о нём. Каким он был? # speaker:sorokin

Таня ставит фотографию обратно. Садится. Смотрит в окно — туда, где за заводскими трубами чернеет стена леса.

— После смерти мамы... он посвятил себя мне. И работе. Больше ничего не было. Никаких женщин, никаких друзей. Только я и завод. # speaker:tanya

Она усмехается — грустно, без радости.

— Он научил меня читать чертежи раньше, чем я научилась читать книжки. В пять лет я знала, как работает паровая турбина. В десять — собрала свой первый радиоприёмник. # speaker:tanya

— Вы тоже инженер. Пошли по его стопам. # speaker:sorokin

— А куда ещё? — Она пожимает плечами. — Это всё, что я знаю. Это всё, что он мне дал. Знания. Логику. И... этот город. # speaker:tanya

Её голос становится жёстче.

— Я хотела уехать. После школы. Поступить в Москву. Папа был против. "Здесь твой дом, Танюша. Здесь твоя семья." Но какая семья? — Она смотрит на вас. — Он и я. Больше никого. # speaker:tanya

~ CharacterSecrets += tanya_childhood
~ understanding_tanya += 10

* [Почему не уехали?]
    — Что остановило? # speaker:sorokin
    
    — Он. Его глаза. Когда я сказала про Москву — он посмотрел на меня так... Как будто я сказала, что хочу умереть. Он потерял маму. Не мог потерять и меня. # speaker:tanya
    
    Пауза. # style:action
    
    — Я осталась. Для него. А теперь... # speaker:tanya # intensity:high
    
    Она не заканчивает. Не нужно. # style:action
    
    ~ CharacterSecrets += tanya_dreams
    ~ understanding_tanya += 15
    ~ trust_tanya += 5
    
    -> ep1_tanya_talk

* [О чём вы мечтали?]
    — Кем хотели стать? Если бы уехали? # speaker:sorokin
    
    Таня смотрит удивлённо. Как будто её давно не спрашивали о мечтах. # style:action
    
    — Авиаинженером. — Её голос становится мягче. — Хотела строить самолёты. Не эти... машины для переработки руды. А настоящие самолёты. Которые летают. Которые уносят людей далеко-далеко. # speaker:tanya
    
    — Ещё не поздно. # speaker:sorokin
    
    — Поздно. — Она качает головой. — Мне двадцать три. Здесь — работа, квартира, папа... Был папа. Теперь — ничего. Кроме этого города. И его секретов. # speaker:tanya # intensity:high
    
    ~ CharacterSecrets += tanya_dreams
    ~ understanding_tanya += 20
    ~ trust_tanya += 10
    
    -> ep1_tanya_talk

* [Перейти к делу]
    — Я понимаю. Но мне нужно знать о последних неделях. # speaker:sorokin
    
    -> ep1_tanya_talk

=== ep1_tanya_talk ===

{ not (CharacterSecrets ? tanya_childhood):
    Таня закрывает дверь. Проверяет — дважды.
}

— Можно без протокола? # speaker:tanya

— Пока да. # speaker:sorokin

— Папа не мог просто пропасть. Он что-то знал. # speaker:tanya

— Что именно? # speaker:sorokin

— Не знаю точно. Но в последние недели он изменился. Не спал. Перебирал бумаги. Говорил странное. # speaker:tanya

* [Какие бумаги?]
    — Вы видели эти бумаги? # speaker:sorokin
    
    — После исчезновения я искала. Ничего. Но... — Она достаёт потрёпанную книжку. — Это из его шкафчика здесь. # speaker:tanya
    
    // ИСПРАВЛЕНО: добавлена защита от дублирования улики
    { not (CluesB ? echo_docs):
        ~ CluesB += echo_docs
        ~ sync_evidence_count()
    }
    { not (KeyEvents ? found_notebook):
        ~ KeyEvents += found_notebook
        ~ sync_evidence_count()
    }
    
    # clue
    Улика найдена: записная книжка Зорина
    
    -> ep1_tanya_notebook

* [Что он говорил?]
    — Какие странные вещи? # speaker:sorokin
    
    — Про лес. Про голоса. Говорил, что "они открыли что-то". Что это "не должно было быть найдено". # speaker:tanya
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_tanya_more

=== ep1_tanya_notebook ===

Вы открываете книжку.

Почерк нервный, торопливый. Многие записи зачёркнуты или оборваны.

"...А.Ч. был прав насчёт частоты. Но они не понимают, ЧТО это вызывает..."

"...ночью снова. Тени у окна. Или мне кажется?..."

"...нельзя доверять никому. Даже Г. Особенно Г...."

"...если со мной что-то случится — Тане ничего не говорить. Пусть думает, что это несчастный случай..."

Последняя запись — 22 октября:

"Они знают. Ухожу. К.Л. — там спрячусь."

— К.Л.? # speaker:sorokin

— Не знаю. Папа никогда не объяснял свои сокращения. # speaker:tanya

~ cult_awareness = cult_awareness + 1

* [Может, место?]
    — Какое-то место? Красная... Кривая... Корпус? # speaker:sorokin
    
    Таня качает головой. # style:action
    
    — Не знаю. Он последние недели стал... скрытным. Параноидальным даже. # speaker:tanya
    
    Странно. Инженер, работавший на секретном заводе — и параноидальный.
    
    Совпадение? Или причина?
    
    ~ boost_theory(1, 5)
    
    -> ep1_tanya_end

* [А.Ч. — это человек?]
    — Инициалы. А.Ч. Кто это? # speaker:sorokin
    
    Таня хмурится. # style:action
    
    — Не знаю. Папа никогда не упоминал... — Она замолкает. — Хотя... Однажды он пришёл домой очень взволнованный. Сказал: "Старик был прав. Всё это время — был прав." Я спросила — какой старик? Он не ответил. # speaker:tanya
    
    ~ cult_awareness = cult_awareness + 1
    
    Зацепка. Слабая, но зацепка.
    
    -> ep1_tanya_end

* [Кто такой "Г."?]
    — Здесь написано — "нельзя доверять Г." Кто это? # speaker:sorokin
    
    Таня бледнеет. # style:action
    
    — Громов? Майор Громов? — Она понижает голос. — Папа... Папа говорил, что Громов не тот, за кого себя выдаёт. Что он "из ТЕХ". # speaker:tanya
    
    — Из каких "тех"? # speaker:sorokin
    
    — Не знаю. Папа отказывался объяснять. Говорил — чем меньше я знаю, тем безопаснее. # speaker:tanya
    
    ~ boost_theory(2, 10)
    ~ trust_gromov = trust_gromov - 10
    
    Громов. Снова Громов. Что он скрывает?
    
    -> ep1_tanya_end

=== ep1_tanya_more ===

— Вы что-то скрываете. # speaker:sorokin

— Есть кое-что ещё. Но не здесь. Стены имеют уши. # speaker:tanya

— Где? # speaker:sorokin

— Сегодня вечером. У памятника. В девять. # speaker:tanya

~ trust_tanya = trust_tanya + 15

// Флаг приглашения на встречу (отдельный от found_notebook)
~ KeyEvents += tanya_invited

— И, следователь... Будьте осторожны. # speaker:tanya

-> ep1_after_first_visit

=== ep1_tanya_end ===

— Спасибо, Татьяна Алексеевна. # speaker:sorokin

— Найдите его. Пожалуйста. # speaker:tanya

{ sanity < 70:
    В коридоре — холодно. Слишком холодно.
    
    И шёпот. Из-за стен.
    
    «...он приближается...»
    
    -> lose_sanity_safe(2) ->
}

-> ep1_after_first_visit

=== ep1_witnesses ===

Первый свидетель — Иванов — уехал. Вчера. После вашего приезда.

Подозрительно быстро.

Второй — Кузнецова — пожилая женщина. Нервничает.

— Я... Я видела его. Зорина. # speaker:stranger

— Где именно? # speaker:sorokin

Пауза. Она оглядывается.

— Они сказали — скажи, что видела. А если нет... # speaker:stranger

— Кто — они? # speaker:sorokin

— Мужчина в штатском. Сказал — от милиции. # speaker:stranger

{ not (CluesA ? false_reports):
    ~ CluesA += false_reports
    ~ sync_evidence_count()
}

# clue
Улика найдена: показания сфальсифицированы

— Я никого не видела тем вечером. Клянусь. Простите меня. # speaker:stranger

~ trust_gromov = trust_gromov - 10
// Громов причастен к фальсификации — флаг предательства
~ Relationships += betrayed_gromov

// ТОЧКА НЕВОЗВРАТА: Узнали о предательстве Громова
{ not gromov_is_ally:
    ~ gromov_is_enemy = true
    
    # point_of_no_return
    Вы знаете, что Громов причастен к сокрытию правды. Это изменит ваши отношения.
}

Кто-то фальсифицирует улики. Кто-то в милиции. Громов знал?

-> ep1_after_first_visit

=== ep1_meet_serafim ===

~ MetCharacters += serafim

# mood: mystery

-> describe_church ->

Белые стены, покосившийся купол. Официально — закрыта с шестидесятых. Но кто-то явно поддерживает её в порядке. # style:atmosphere

Рядом — маленький домик. Дым из трубы. На окнах — странные символы. Защита? От чего? # style:thought

Дверь открывается раньше, чем вы успеваете постучать.

Старик. Белая борода до груди. Ясные голубые глаза — слишком ясные для человека его возраста. Как будто внутри горит огонь.

// ЭТАЛОН: Серафим видит духовное состояние
{ infection_level >= 30:
    Его глаза сужаются. Он видит что-то — в вас, сквозь вас. # style:atmosphere # intensity:medium
    
    — На вас уже лежит их тень. — Шёпот. — Но ещё не поздно. Ещё нет. # speaker:serafim # intensity:high
}

— Я ждал вас. # speaker:serafim

Вы замираете. Откуда он знал?

— Меня? # speaker:sorokin

— Следователя. Того, кого пришлют. Заходите. Здесь холодно. И... небезопасно. # speaker:serafim

Он оглядывается на лес за вашей спиной. Быстро, нервно.

Странный старик. Живёт один, в закрытой церкви, рисует символы на окнах, "ждёт следователя"...

Религиозные фанатики бывают разные. Иногда — опасные.

~ boost_theory(3, 8)

* [Войти]
    -> ep1_serafim_talk
    
* [Спросить с порога]
    — Откуда вы знали, что я приду? # speaker:sorokin
    
    Серафим улыбается. Печально. # style:action
    
    — Они сказали. Те, кто слышит. Но не так, как вы думаете. Не я — безумец. Безумцы — те, кто не слышит. # speaker:serafim
    
    Загадками говорит. Либо мудрец, либо... # style:thought
    
    ~ boost_theory(3, 5)
    
    — Заходите. Я всё объясню. # speaker:serafim
    
    -> ep1_serafim_talk

=== ep1_serafim_talk ===

Внутри — иконы, книги, запах ладана.

— Громов послал? # speaker:serafim

— Да. # speaker:sorokin

— Хороший человек Степан. Слабый, но хороший. # speaker:serafim

Серафим садится напротив.

— Вы слышали голоса? # speaker:serafim

{ KeyEvents ? heard_voices:
    * [Да]
        — Откуда вы знаете?
        
        — У вас глаза человека, который слышал. Лес зовёт. Он всегда зовёт новичков.
        
        ~ trust_serafim = trust_serafim + 20
        
        -> ep1_serafim_legend
}

* [Нет]
    -> ep1_serafim_denial

=== ep1_serafim_denial ===

— Я не склонен к мистике. # speaker:sorokin

— Я тоже. Был. Сорок лет назад, когда пришёл сюда геологом. # speaker:serafim

— Геологом? # speaker:sorokin

-> ep1_serafim_legend

=== ep1_serafim_legend ===

# mood: dark

— Это место — старое. — Серафим говорит медленно, взвешивая каждое слово. — Старше города. Старше завода. Старше нас всех. # speaker:serafim

Он молчит. Смотрит в огонь.

— Здесь... случаются вещи. Которые трудно объяснить. # speaker:serafim

— Какие вещи? # speaker:sorokin

— Люди слышат то, чего нет. Видят то, чего быть не должно. — Пауза. — А потом — исчезают. # speaker:serafim

Вы отмечаете про себя: типичный нарратив местного суеверия. Или... попытка предупредить?

Старик явно что-то скрывает. Вопрос — что именно. И зачем он рассказывает это ВАМ.

~ boost_theory(3, 5)

* [Что конкретно они видят?]
    — Зависит от человека. — Серафим качает головой. — Одни — тени. Другие — фигуры. Третьи — слышат голоса. # speaker:serafim
    
    — И вы? # speaker:sorokin
    
    Долгая пауза. # style:action
    
    — Я научился не слушать. # speaker:serafim
    
    Загадками говорит. Либо мудрец, либо шарлатан. Пока не ясно. # style:thought
    
    -> ep1_serafim_modern

* [Вы были здесь давно?]
    — Сорок лет. — Он усмехается. — Пришёл молодым. Ушёл бы, если бы мог. # speaker:serafim
    
    — Почему остались? # speaker:sorokin
    
    — Кто-то должен. — Пауза. — Предупреждать. Таких, как вы. # speaker:serafim
    
    ~ understanding_serafim += 5
    
    -> ep1_serafim_modern

* [Вы знаете что-то о пропавших?]
    Серафим смотрит вам в глаза. Впервые — прямо, без уклонения. # style:action
    
    — Знаю. Но вы не поверите. Пока — не поверите. # speaker:serafim
    
    — Попробуйте. # speaker:sorokin
    
    — Нет. — Он качает головой. — Сначала — увидьте сами. Потом — приходите. Поговорим. # speaker:serafim
    
    Загадками. Одними загадками. # style:thought
    
    ~ boost_theory(3, 3)
    
    -> ep1_serafim_modern

* [Это суеверия]
    — С уважением, отец Серафим, но я следователь. Мне нужны факты, а не истории. # speaker:sorokin
    
    Серафим смотрит на вас. В его глазах — не обида. Что-то другое. Узнавание? # style:action
    
    — Факты. — Он кивает. — Хорошо. Вот факт: за сорок лет я отпел больше пустых гробов, чем полных. Люди пропадают — и не возвращаются. Тела не находят. Никогда. # speaker:serafim
    
    — Это не факт. Это статистика. # speaker:sorokin
    
    — А вот ещё статистика: девять из десяти пропавших — работали на заводе. В определённом отделе. — Он замолкает. — Но это вы сами узнаете. Если захотите. # speaker:serafim
    
    ~ boost_theory(3, -5)
    ~ boost_theory(4, 10)
    ~ understanding_serafim += 10
    
    Интересно. Определённый отдел. Какой?
    
    -> ep1_serafim_modern

=== ep1_serafim_modern ===

— Вы что-нибудь знаете о заводе? # speaker:sorokin

Серафим молчит. Долго.

— Знаю, что он — не просто завод. — Его голос тише. — Официально — химическое производство. Но... — Он качает головой. — Есть вещи, которые лучше не знать. # speaker:serafim

— Мне нужно знать. # speaker:sorokin

— Нужно? — Он смотрит на вас. — Или хотите? # speaker:serafim

Пауза.

— Хорошо. Один совет. Бесплатный. — Он подаётся вперёд. — Если будете копать — начните с архива. Старые газеты. Пятидесятые-шестидесятые годы. Посмотрите, сколько "несчастных случаев на производстве" было тогда. И сравните с другими заводами. # speaker:serafim

— И что я найду? # speaker:sorokin

— Аномалию. — Серафим откидывается назад. — А аномалии, товарищ следователь, требуют объяснения. # speaker:serafim

~ boost_theory(4, 8)

// Добавляем улику только если ещё не получили от короткого визита
{ not (CluesD ? church_symbols):
    ~ CluesD += church_symbols
    ~ sync_evidence_count()

    # clue
    Улика найдена: связь пещер и экспериментов
}

— Они думали, что открыли новое измерение. Но открыли кое-что другое. # speaker:serafim

* [Что?]
    Серафим долго молчит.
    
    — Я называю это — Красный Лес. Они называют — Проект "Эхо". # speaker:serafim
    
    За окном — сумерки. Когда успело стемнеть?
    
    -> ep1_serafim_end

=== ep1_serafim_end ===

— Вам пора. Ночью ходить опасно. # speaker:serafim

На пороге он хватает вас за руку:

— Не верьте тому, что видите. Но и не отвергайте. Истина — посередине. # speaker:serafim

// Разговор с Серафимом восстанавливает рассудок
~ gain_sanity(5)
~ trust_serafim = trust_serafim + 15
// Флаг союзничества с Серафимом
~ Relationships += helped_serafim

-> ep1_after_first_visit

=== ep1_day_continue ===

День клонится к вечеру.

{ MetCharacters ? tanya:
    Таня ждёт у памятника в девять.
}

{ evidence_collected >= 3:
    У вас достаточно зацепок.
}

* [Вернуться в гостиницу]
    -> ep1_end

// Встреча доступна только если Таня ЯВНО пригласила
* { MetCharacters ? tanya && KeyEvents ? tanya_invited } [На встречу с Таней]
    -> ep1_tanya_meeting

=== ep1_tanya_meeting ===

# mood: tense

Площадь. Памятник Ленину. Девять вечера.

Таня уже здесь. В тени. Её дыхание — белым паром в холодном воздухе.

// Прогрессия отношений с Таней — вечерняя встреча
-> see_tanya ->

Когда она видит вас — что-то меняется в её лице. Напряжение? Облегчение?

— Вы пришли. — Она делает шаг навстречу. — Я не была уверена... # speaker:tanya

— Я обещал. # speaker:sorokin

Она смотрит на вас. Долго. В её глазах — благодарность. И что-то ещё — глубже. # style:action

— Папа оставил мне кое-что. Сказал — передать тому, кто будет искать по-настоящему. # speaker:tanya

Из-под пальто — конверт. # style:action

— Фотографии. Я боюсь смотреть. # speaker:tanya

// ДОБАВЛЕНО: укрепление связи при встрече
~ trust_tanya = trust_tanya + 5

~ KeyEvents += found_photos
{ not (CluesC ? ritual_photos):
    ~ CluesC += ritual_photos
    ~ sync_evidence_count()
    # clue
    Улика найдена: фотографии Зорина # style:important
}
~ trust_tanya = trust_tanya + 20

* [Открыть конверт]
    Три фотографии. Чёрно-белые.
    
    На первой — люди в капюшонах. Стоят кругом.
    
    На второй — символ. Красный круг, три линии.
    
    На третьей — человек. Поза жертвы.
    
    ~ cult_awareness = cult_awareness + 5
    
    — Господи... — шепчет Таня. # speaker:tanya
    
    -> ep1_photos_aftermath

* [Убрать конверт]
    — Потом. Здесь небезопасно. # speaker:sorokin
    
    -> ep1_tanya_end_meeting

=== ep1_photos_aftermath ===

Шаги. Вы оба замираете.

Фигура из темноты. В форме милиции.

— Товарищ Сорокин? Вас вызывают в отдел. Срочно. # speaker:soldier

Рядом — ещё двое. В штатском. # style:action

~ MetCharacters += astahov

* [Пойти с ними]
    — Татьяна Алексеевна, мы продолжим позже. # speaker:sorokin
    
    Конверт — в кармане. # style:action
    
    -> ep1_astahov_scene

=== ep1_tanya_end_meeting ===

— Мне пора. — Таня отступает. — Будьте осторожны. Они следят за всеми. # speaker:tanya

Она исчезает. # style:action

В темноте — красные огоньки сигарет. Наблюдатели.

-> ep1_end

=== ep1_astahov_scene ===

# mood: pressure

В отделе — полковник Астахов.

Вы видели его мельком раньше — на КПП, в коридоре. Но вблизи — впечатление другое.

Серый костюм — дорогой, московского пошива. Идеально подогнан. Галстук — ровный, без единой складки. Волосы — седые, коротко стриженные. Лицо — гладкое, без единой эмоции. Как маска.

Но глаза...

Глаза — не пустые. Вы ошиблись раньше. Они — внимательные. Оценивающие. Холодные.

Глаза человека, который видел много. Делал много. И ни о чём не жалеет.

~ MetCharacters += astahov

— Товарищ Сорокин. Мы должны поговорить о границах вашего расследования. # speaker:astahov

— Мои полномочия определены прокуратурой. # speaker:sorokin

— Ваши полномочия определяются интересами государства. # speaker:astahov

Пауза. Он не мигает. Не отводит взгляд. # style:action # intensity:high

— Дело Зорина закрыто. Несчастный случай. Вы уедете завтра утром. # speaker:astahov

* [Отказаться]
    — Боюсь, не могу. # speaker:sorokin
    
    Астахов смотрит долго. Молча. # style:action
    
    — Вы делаете ошибку. Большую ошибку. # speaker:astahov
    
    ~ trust_astahov -= 10
    -> lose_sanity_safe(5) ->
    
    -> ep1_end

* [Согласиться (притворно)]
    — Разумеется, товарищ полковник. # speaker:sorokin
    
    — Правильное решение. # speaker:astahov
    
    Конечно, вы никуда не уедете. # style:thought
    
    -> ep1_end

* [Спросить о его роли]
    — Полковник, — вы говорите спокойно, — какое отношение имеет КГБ к исчезновению рядового инженера? # speaker:sorokin
    
    Астахов замирает. На мгновение — только на мгновение — что-то мелькает в его глазах. Удивление? Уважение? # style:action
    
    — Интересный вопрос, товарищ следователь. # speaker:astahov
    
    Он садится напротив. Закидывает ногу на ногу. Достаёт портсигар. Серебряный, с гравировкой.
    
    — Закурите? # speaker:astahov
    
    -> ep1_astahov_talk

=== ep1_astahov_talk ===

# mood: tension

Вы берёте сигарету. Он щёлкает зажигалкой. Огонёк отражается в его глазах.

— Я здесь двадцать лет, Сорокин. — Он затягивается. — Двадцать лет охраняю... интересы государства. # speaker:astahov

— Какие интересы? # speaker:sorokin

— Секретные. — Тень улыбки. — Но вы уже кое-что поняли, не так ли? "Проект Эхо". Эксперименты. Пещеры. # speaker:astahov

Он наклоняется вперёд. # style:action

— Позвольте дать вам совет. Профессиональный. От человека, который знает, как устроен этот мир. # speaker:astahov

~ CharacterSecrets += astahov_orders
~ understanding_astahov += 15

* [Слушаю]
    -> ep1_astahov_advice

* [Мне не нужны советы]
    — Спасибо, но я сам разберусь. # speaker:sorokin
    
    — Разумеется. — Он встаёт. — Но помните: здесь случаются несчастные случаи. Часто. И не только с инженерами. # speaker:astahov
    
    ~ trust_astahov -= 15
    
    -> ep1_end

=== ep1_astahov_advice ===

— Есть вещи важнее правды, Сорокин. Порядок. Стабильность. Государственная безопасность. # speaker:astahov

Он смотрит в окно. На лес. # style:action

— В пятьдесят четвёртом — когда я был ещё лейтенантом — мне поручили охранять "объект особой важности". Здесь. Под землёй. # speaker:astahov

— Что вы видели? # speaker:sorokin

Долгая пауза. Его лицо — неподвижно. Но что-то... что-то в нём меняется. # style:action # intensity:high

— То, чего не должен был видеть никто. # speaker:astahov

Он тушит сигарету. # style:action

— Я выполняю приказы, Сорокин. Всю жизнь — выполняю приказы. Не потому, что верю в них. Не потому, что считаю их правильными. # speaker:astahov

* [Тогда почему?]
    — Почему? # speaker:sorokin
    
    — Потому что альтернатива — хуже. — Он смотрит вам в глаза. — Если бы вы видели то, что видел я... вы бы тоже выполняли приказы. Любые приказы. Лишь бы ЭТО оставалось закрытым. # speaker:astahov # intensity:high
    
    ~ CharacterSecrets += astahov_doubt
    ~ understanding_astahov += 20
    ~ EmotionalScenes += scene_astahov_humanity
    
    — У меня есть семья, Сорокин. Жена. Двое детей. Внуки. Они живут в Москве. Далеко отсюда. В безопасности. # speaker:astahov
    
    Пауза. # style:action
    
    — И я сделаю всё — слышите? — ВСЁ — чтобы так и оставалось. # speaker:astahov # intensity:high
    
    ~ CharacterSecrets += astahov_family
    
    Он встаёт. # style:action
    
    — Уезжайте, Сорокин. Пока можете. Это не угроза. Это — просьба. # speaker:astahov
    
    -> ep1_end

* [Вы боитесь]
    — Вы боитесь. — Вы говорите это спокойно, без обвинения. — Полковник КГБ — боится. # speaker:sorokin
    
    Астахов молчит. Долго. # style:action
    
    — Да. — Одно слово. Тихое. — Боюсь. Уже двадцать лет — боюсь. # speaker:astahov # intensity:high
    
    ~ CharacterSecrets += astahov_doubt
    ~ understanding_astahov += 25
    
    -> ep1_end

=== ep1_end ===

# mood: dark

Номер 12. Полночь. # style:title # intensity:medium

// Луна в окне — напоминание о дедлайне
-> look_at_moon ->

Вы сидите на кровати. Перед вами — блокнот, записи, улики. # style:atmosphere

{ evidence_collected >= 5:
    Слишком много совпадений. Культ. Эксперименты. Пропавшие. # style:thought # intensity:high
    
    Это не просто исчезновение. # style:thought # intensity:high
}

{ sanity < 65:
    И голоса... Лес... Видения... # style:horror # intensity:high
    
    Или вы сходите с ума, или... что-то действительно есть. # style:thought # intensity:high
}

За окном — красноватый отсвет. # style:atmosphere # intensity:medium

Лес. # style:dramatic # intensity:high

«Я приехал найти пропавшего», — думаете вы. # style:thought # intensity:medium

«Но нашёл кое-что большее». # style:thought # intensity:high

... # style:atmosphere

КОНЕЦ ЭПИЗОДА 1 # style:title # intensity:high

~ advance_day()
~ sync_evidence_count()

Ваш рассудок: {sanity}/100 # style:important
Дней осталось: {days_remaining} # style:important
Собрано улик: {count_all_clues()} # style:important

// СИСТЕМА РЕПУТАЦИИ: итог дня
{ city_reputation <= -20:
    Репутация в городе: ПЛОХАЯ ({city_reputation}) # style:important
    Горожане начинают избегать вас...
}
{ city_reputation > -20 && city_reputation <= 20:
    Репутация в городе: НЕЙТРАЛЬНАЯ ({city_reputation}) # style:important
}
{ city_reputation > 20:
    Репутация в городе: ХОРОШАЯ ({city_reputation}) # style:important
    Некоторые жители готовы помочь.
}

{ LIST_COUNT(Rumors) > 0:
    Слухи о вас: {LIST_COUNT(Rumors)} # style:important
}

* [Продолжить...]
    -> episode2_intro

// ═══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 2: ПЕРВАЯ ЖЕРТВА
// (Полностью расширенная нелинейная версия)
// ═══════════════════════════════════════════════════════════════════════════════

=== episode2_intro ===

# chapter: 2
# mood: investigation
# title: Первая жертва

~ time_of_day = 0
~ actions_today = 0

16 НОЯБРЯ 1986 ГОДА # style:title # intensity:high

День второй # style:subtitle

-> describe_hotel_room ->

// ЭТАЛОН: Описание текущего состояния заражения
-> describe_current_state ->

Три часа ночи.

Вы лежите в темноте. Глаза открыты. Потолок — незнакомый, чужой. Трещины на штукатурке складываются в узоры, которые вы не хотите видеть.

За стеной — тишина. Абсолютная. Ни скрипа половиц, ни кашля соседей, ни далёкого гудка автомобиля. Словно вы — единственный живой человек в этом здании.

В этом городе.

{ KeyEvents ? heard_voices:
    Голоса вернулись.

    Не во сне — наяву. Тихие, на грани слуха. Как будто кто-то стоит за дверью и шепчет сквозь щель.

    -> hear_the_voices ->

    Вы напрягаете слух.

    «...приходи...»
    «...мы ждём...»
    «...красный лес зовёт...»
    
    Вы садитесь на кровати. Сердце колотится.
    
    Тишина.
    
    Показалось?
    
    Вы встаёте. Подходите к двери. Прислушиваетесь.
    
    Ничего. Пустой коридор. Тёмный, холодный.
    
    Возвращаетесь в кровать. Но уснуть уже не можете.
    
    До рассвета — четыре часа. Вы проводите их, глядя в потолок, слушая тишину.
    
    -> lose_sanity_safe(3) ->
}

{ KeyEvents ? saw_symbol:
    Символ.
    
    Каждый раз, когда закрываете глаза — он там. Красный круг, три линии к центру. Пульсирует, как живой. Как сердце.
    
    Откуда он? Почему кажется таким... знакомым?
    
    Вы пытаетесь вспомнить. Афганистан? Нет. Детство? Может быть...
    
    Образы — размытые. Бабушкин дом в деревне. Икона в углу. И... что-то ещё. Рисунок на чердаке? Или во сне?
    
    Вы трёте глаза. Не помогает. Символ — внутри. Под веками.
    
    -> lose_sanity_safe(2) ->
}

...

Семь утра.

Серый свет за окном. Рассвет — если можно назвать это рассветом. Просто темнота становится чуть светлее.

Снег. Опять снег. Крупные хлопья падают медленно, беззвучно. За ночь намело сугробы.

Вы умываетесь ледяной водой.

-> look_in_mirror ->

Прошёл один день. # style:thought # intensity:medium

Стук в дверь.

-> greet_klava ->

Вы одеваетесь. Проверяете пистолет — на месте. Документы — в кармане. # style:action

День второй. Пора работать. # style:dramatic # intensity:medium

-> episode2_morning

=== episode2_morning ===

# mood: investigation

~ time_of_day = 0

УТРО # style:title # intensity:low

{ actions_today == 0:
    У вас есть время на два-три дела сегодня. # style:thought
}

{ days_remaining <= 2:
    Время на исходе. Нужно торопиться. # style:thought # intensity:high
}

Куда направиться? # style:thought

// Утренние действия
* { actions_today < 3 && time_of_day == 0 } [В ресторан — Клава обещала рассказать больше]
    -> episode2_klava_meeting

* { actions_today < 3 } [В больницу — найти доктора Холодову]
    -> episode2_hospital

* { actions_today < 3 && KeyEvents ? fyodor_warned } [Искать Фёдора — сторожа у завода]
    -> episode2_find_fyodor

// Завод лучше посещать днём
* { actions_today < 3 && time_of_day <= 1 } [На завод — искать тайник Зорина]
    -> episode2_factory_search

* { actions_today >= 1 } [Вернуться в гостиницу — день заканчивается]
    -> episode2_evening

=== episode2_klava_meeting ===

~ actions_today = actions_today + 1
~ KeyEvents += met_klava_restaurant

# mood: mystery

Ресторан "Урал". # style:title # intensity:medium

Обеденное время — но зал почти пуст. Три столика заняты: пожилая пара у окна, мужчина в рабочей спецовке у стойки, и Клавдия Петровна — в дальнем углу, спиной к стене. # style:atmosphere

Вы подходите. Она вздрагивает — хотя смотрела прямо на вас. # style:action

— Садитесь, садитесь. Быстрее. # speaker:klava

Голос — еле слышный. Глаза — бегают по залу, словно она ждёт, что кто-то подслушивает. # style:atmosphere # intensity:medium

Вы садитесь. Официантка — молодая девушка с усталым лицом — приносит меню. Клава отмахивается. # style:action

— Мне ничего. Просто воды. # speaker:klava

Вы заказываете борщ. Официантка уходит. # style:action

Клава наклоняется ближе. Её руки — дрожат. Она прячет их под столом. # style:atmosphere # intensity:medium

— Я не должна это рассказывать. — Её голос — шёпот. — Но вчера ночью... я не спала. Думала. О муже. О том, что было. # speaker:klava

Пауза. Она оглядывается снова. Мужчина у стойки встаёт, уходит. Клава расслабляется — едва заметно. # style:atmosphere # intensity:medium

— Я должна кому-то рассказать. Пока могу. Пока... пока меня не забрали. # speaker:klava

* [Подождать]
    Вы молчите. Даёте ей время.
    
    Она нервно теребит салфетку. Рвёт её на мелкие кусочки. Руки — не слушаются.
    
    — Ладно. — Глубокий вдох. — Слушайте. # speaker:klava
    
    -> ep2_klava_story

* [Это важно для расследования]
    — Клавдия Петровна, — вы говорите мягко, но твёрдо, — речь идёт о жизни и смерти. О людях, которые пропали. О тех, кто ещё может пропасть. # speaker:sorokin
    
    Она смотрит на вас. В её глазах — страх. Но и что-то ещё. Решимость?
    
    — Знаю. — Она сглатывает. — Потому и пришла. Потому что больше не могу молчать. # speaker:klava
    
    -> ep2_klava_story

=== ep2_klava_story ===

# mood: emotional

Клава опускает голову. Её плечи — вздрагивают. Она плачет? Нет. Просто... собирается с духом. # style:atmosphere # intensity:high

— Мой муж работал на заводе. Двадцать лет назад. — Её голос — глухой, как из-под воды. — Николай. Коля. Инженер-электрик. # speaker:klava

— Работал? # speaker:sorokin

Пауза. Долгая. # style:dramatic # intensity:medium

— Умер. — Она поднимает глаза. Красные, воспалённые. — Официально — сердце. Внезапная остановка. Тридцать восемь лет, здоров как бык — и вдруг сердце. # speaker:klava

Она достаёт платок. Промокает глаза. # style:action # intensity:medium

— Но я знаю правду. Потому что видела. # speaker:klava

~ CharacterSecrets += klava_husband
~ understanding_klava += 15

* [Расскажите о муже подробнее]
    — Каким он был? До... до всего этого? # speaker:sorokin
    
    Клава улыбается. Первая настоящая улыбка, которую вы у неё видите. # style:atmosphere # intensity:medium
    
    — Добрый. Смешной. Руки золотые — мог починить всё на свете. Любил рыбалку, шахматы, книжки про путешествия. # speaker:klava
    
    Улыбка гаснет. # style:dramatic # intensity:medium
    
    — Мы познакомились на танцах в Доме культуры. Шестьдесят третий год. Мне было девятнадцать. Ему — двадцать один. Красивый, в военной форме — только из армии вернулся. # speaker:klava
    
    Она замолкает. Смотрит в окно. # style:atmosphere # intensity:high
    
    — Тринадцать лет счастья. А потом... этот проклятый завод. Этот проклятый проект. # speaker:klava # intensity:high
    
    ~ understanding_klava += 10
    
    -> ep2_klava_story_continue

* [Что вы видели?]
    -> ep2_klava_story_continue

=== ep2_klava_story_continue ===

— Что вы видели? # speaker:sorokin

Она понижает голос до еле слышного шёпота: # style:atmosphere # intensity:high

— За неделю до смерти он начал... меняться. Не спал. Вообще. Сидел у окна и смотрел на лес. Часами. Днём и ночью. # speaker:klava

Официантка приносит борщ. Клава замолкает. Ждёт, пока она уйдёт. # style:action

— Потом — рисунки. Я пришла домой, а он... он стоит у стены и рисует. Углём. Одно и то же. Снова и снова. # speaker:klava

— Что он рисовал? # speaker:sorokin

— Круг. Три линии к центру. Как... как спицы в колесе. Или как когти. # speaker:klava

{ KeyEvents ? saw_symbol:
    Сердце сжимается. Тот самый символ. Тот, что вы видели на заборе завода. # style:dramatic # intensity:high
    
    Двадцать лет. Этому — двадцать лет. # style:thought # intensity:high
}

~ cult_awareness = cult_awareness + 2

— Он говорил что-нибудь? # speaker:sorokin

— Бормотал. — Клава вздрагивает. — "Красный лес зовёт. Они ждут. Скоро. Скоро откроется." Я думала — перенапрягся. Отвезла его в больницу. Врачи сказали — стресс. Дали таблетки. Не помогло. # speaker:klava

Её голос ломается. # style:dramatic # intensity:high

— А потом — утром — я проснулась, а он... лежит рядом. Холодный. С улыбкой на лице. С такой... счастливой улыбкой. # speaker:klava # intensity:high

Она замолкает. Слёзы текут по щекам. # style:atmosphere # intensity:high

— Официальная причина — сердце. Но я видела его глаза, следователь. Перед смертью. Он смотрел куда-то... куда-то, чего я не видела. И улыбался. # speaker:klava

* [А дети? У вас были дети?]
    Клава замирает. Её лицо — окаменело. На мгновение вы думаете, что переступили черту. # style:dramatic # intensity:high
    
    — Был. — Её голос — еле слышный. — Сын. Петенька. # speaker:klava # intensity:high
    
    Она достаёт из кармана ещё одну фотографию. Мальчик лет десяти. Светлые волосы, веснушки, широкая улыбка. # style:atmosphere # intensity:high
    
    — Это — последняя фотография. Семьдесят пятый год. За три дня до... # speaker:klava
    
    — До чего? # speaker:sorokin
    
    — До того, как он ушёл в лес. — Клава сглатывает. — Сказал — хочет погулять. Никогда не возвращался. # speaker:klava
    
    ~ CharacterSecrets += klava_son
    ~ understanding_klava += 25
    ~ EmotionalScenes += scene_klava_breakdown
    
    { sanity < 60:
        Холод. Внутренний холод, который не имеет ничего общего с температурой. # style:horror # intensity:high
        
        «...он слышал нас...» # style:vision # intensity:high
        «...мы звали его...» # style:vision # intensity:high
        «...он пришёл...» # style:vision # intensity:high
        
        -> lose_sanity_safe(5) ->
    }
    
    — Искали? # speaker:sorokin
    
    — Три недели. Всем городом. Ничего. Ни следа. Ни косточки. # speaker:klava
    
    Клава смотрит на фотографию. Гладит её пальцем.
    
    — Ему было бы сейчас тридцать один год. Может, женился бы. Внуки... # speaker:klava
    
    Она убирает фотографию. Вытирает глаза.
    
    — Вот почему я здесь. Вот почему работаю в этой проклятой гостинице, хотя могла бы уехать. Потому что однажды — однажды — Петенька вернётся. И я должна быть здесь. # speaker:klava
    
    ~ CharacterSecrets += klava_sacrifice
    ~ understanding_klava += 20
    
    -> ep2_klava_photos

* [Где эти рисунки сейчас?]
    -> ep2_klava_photos

* [Кто ещё знает об этом?]
    -> ep2_klava_fyodor

=== ep2_klava_photos ===

— Рисунки. Вы сохранили их? # speaker:sorokin

— Сожгла. — Клава качает головой. — В ту же ночь. Облила керосином и сожгла. Боялась. Боялась, что если оставлю — оно придёт и за мной. # speaker:klava

— Но... # speaker:sorokin

— Но одну фотографию... — Она оглядывается. Достаёт из сумки — медленно, словно боится, что кто-то увидит — потёртую фотографию. — Вот. Смотрите быстро. # speaker:klava

На фото — стена. Серая штукатурка, покрытая чёрными линиями. Символы — десятки, сотни — наползают друг на друга, сплетаются в узор. В центре — силуэт. Человеческая фигура? Или что-то... другое?

Вы не уверены.

И в правом нижнем углу — лицо. Николай. Смотрит в камеру. Улыбается.

Глаза — пустые. Как у куклы. # style:horror # intensity:high

{ not (CluesE ? old_photos):
    ~ CluesE += old_photos
    ~ sync_evidence_count()
}

# clue
Улика найдена: фотография рисунков

— Заберите. — Клава отталкивает фотографию. — Мне она не нужна. Не могу больше смотреть. # speaker:klava

-> ep2_klava_warning

=== ep2_klava_fyodor ===
    — Вы кому-нибудь рассказывали? # speaker:sorokin
    
    — Никому. — Клава качает головой. — Двадцать лет молчала. Боялась. Но... был один человек. Фёдор. Старый сторож. # speaker:klava
    
    — Вы с ним говорили? # speaker:sorokin
    
    — Нет. Но я знаю, что он видел. ТАМ был. В лесу. В пещерах. # speaker:klava
    
    — Откуда знаете? # speaker:sorokin
    
    — Потому что он — единственный, кто ВЫЖИЛ. — Клава наклоняется ближе. — Все остальные — кто туда ходил — исчезли. Или умерли. Или... стали как мой Коля. А Фёдор — вернулся. Один. Двадцать лет назад. # speaker:klava
    
    — Где его найти? # speaker:sorokin
    
    — Сторожка на краю леса. Но... — Она колеблется. — Он странный. Говорят — сумасшедший. Но я думаю — он просто видел слишком много. # speaker:klava
    
    ~ KeyEvents += fyodor_warned
    
    -> ep2_klava_warning

=== ep2_klava_warning ===

Клава хватает вас за руку:

— Уезжайте. Сегодня же. Пока можете. # speaker:klava

— Не могу. # speaker:sorokin

— Тогда... — Она пишет что-то на салфетке. — Найдите Фёдора. Он живёт на краю леса. Старая сторожка. # speaker:klava

{ not (CluesE ? klava_testimony):
    ~ CluesE += klava_testimony
    ~ sync_evidence_count()
}

# clue
Улика найдена: показания Клавдии

— Только... не говорите, что от меня. # speaker:klava

-> episode2_morning

=== episode2_hospital ===

~ actions_today = actions_today + 1

# mood: investigation

Больница №1. # style:title # intensity:medium

Трёхэтажное здание жёлтого кирпича — то самое, что вы видели из окна машины вчера. Вблизи — ещё хуже. Штукатурка облупилась, окна — в потёках, у входа — лужи талого снега вперемешью с грязью. # style:atmosphere

Над дверью — табличка: "ГОРОДСКАЯ БОЛЬНИЦА №1. ПСИХИАТРИЧЕСКОЕ ОТДЕЛЕНИЕ."

Вы толкаете тяжёлую дверь. Внутри — запах хлорки. Резкий, бьющий в нос. И ещё что-то — сладковатое, неприятное. Как в морге.

Коридор — длинный, узкий. Лампы под потолком гудят, мерцают. Стены — выкрашены до середины зелёной краской, выше — побелка, пожелтевшая от времени.

Тишина.

Вы идёте по коридору. Двери по обе стороны — закрыты. За некоторыми — звуки: бормотание, смех, тихий плач. За другими — ничего.

На посту медсестры — пусто. Журнал дежурств — открыт, но записей за сегодня нет.

— Кого-то ищете? # speaker:vera

Голос — за спиной. Вы оборачиваетесь.

{ not (MetCharacters ? vera):
    ~ MetCharacters += vera
    
    Женщина в белом халате. Лет сорока, может — сорока пяти. Тёмные волосы, собранные в строгий пучок. Очки в тонкой оправе. Лицо — усталое, с глубокими морщинами у глаз и рта.
    
    Но глаза — живые. Внимательные. Изучающие.
    
    — Доктор Холодова? # speaker:sorokin
    
    — Вера Николаевна. — Она не протягивает руку. — А вы — следователь Сорокин. Из области. # speaker:vera
    
    — Вас предупредили? # speaker:sorokin
    
    — Здесь все всё знают. — Тень улыбки на губах. — Маленький город. Слухи расходятся быстрее гриппа. # speaker:vera
    
    Она смотрит на вас. Оценивает.
    
    — Пойдёмте в мой кабинет. Здесь — не место для разговоров. # speaker:vera
    
    ~ trust_vera = trust_vera + 5
}

Кабинет Веры — маленький, но аккуратный. # style:title # intensity:low

Стол, шкаф с папками, два стула. На стене — диплом медицинского института, фотография — молодая Вера с группой студентов. # style:atmosphere

Она закрывает дверь. Проверяет — дважды. # style:action

— Итак, следователь. — Она садится за стол. Снимает очки, протирает их. — Что вас интересует? # speaker:vera

— Пациенты с... необычными симптомами. # speaker:sorokin

Пауза. Вера смотрит на вас. Долго.

— Вы про "синдром Красного леса"? # speaker:vera

Её голос — ровный. Но в глазах — что-то мелькает. Страх? Надежда?

* [Да]
    — Именно. # speaker:sorokin
    
    — Наконец-то. — Она вздыхает. — Наконец-то кто-то спросил правильный вопрос. # speaker:vera
    
    -> ep2_vera_syndrome

* [Расскажите подробнее]
    — Я не знаю этого термина. Расскажите. # speaker:sorokin
    
    — Это я его придумала. — Вера усмехается. — Неофициально, конечно. Официально — такого диагноза не существует. Как и не существует ничего, что творится в этом городе. # speaker:vera
    
    -> ep2_vera_syndrome

=== ep2_vera_syndrome ===

// ЭТАЛОН: Вера — врач, замечает симптомы профессионально
-> vera_notices_infection ->

— За последние пять лет — двадцать три случая. Одинаковые галлюцинации. Красный лес. Фигуры в капюшонах. Голоса. # speaker:vera

— Диагноз? # speaker:sorokin

— Официально — острый психоз. Неофициально... # speaker:vera

Она достаёт папку. Её руки — дрожат. Еле заметно, но вы замечаете.

— Смотрите сами. # speaker:vera

Снимки мозга. У всех пациентов — одинаковые изменения в височной доле.

{ not (CharacterSecrets ? vera_past):
    ~ CluesE += vera_research
    ~ sync_evidence_count()
}

* [Изучить снимки]
    Вы берёте снимки. Рассматриваете. Вы не врач, но даже вам видно — это не норма.
    
    — Что это? # speaker:sorokin
    
    — Никто не знает. — Вера снимает очки. Трёт переносицу. — Я отправляла образцы в Москву. Ленинград. Киев. Везде один ответ: "Артефакт. Ошибка оборудования." # speaker:vera
    
    — Но вы не верите? # speaker:sorokin
    
    — Я не верю в совпадения. Двадцать три "ошибки"? Все — одинаковые? # speaker:vera
    
    -> ep2_vera_research

* [Спросить о ней самой]
    — Почему вы этим занимаетесь? # speaker:sorokin
    
    Вера замирает. Снимки в её руках дрожат сильнее.
    
    — Потому что это — моя работа. # speaker:vera
    
    — Это не ответ. # speaker:sorokin
    
    Долгая пауза. Она смотрит на вас. Решает что-то.
    
    — Вы хотите правду? Настоящую? # speaker:vera
    
    — Да. # speaker:sorokin
    
    -> ep2_vera_backstory

* [Кто был первым пациентом?]
    — С чего всё началось? Кто был первым? # speaker:sorokin
    
    Вера бледнеет. Отворачивается.
    
    — Первый... — Её голос срывается. — Первый пациент был мой муж. # speaker:vera
    
    -> ep2_vera_loss

=== ep2_vera_backstory ===

# mood: emotional

Вера встаёт. Подходит к окну. Смотрит на лес — тот самый, что виден отовсюду в этом проклятом городе.

— Я приехала сюда в семьдесят втором году. Молодой специалист. Красный диплом, распределение в провинцию. "Три года отработаете — вернётесь в Москву." # speaker:vera

Она усмехается.

— Четырнадцать лет прошло. Я всё ещё здесь. # speaker:vera

— Почему остались? # speaker:sorokin

— Потому что... — Она оборачивается. В её глазах — боль. Старая, глубокая, затаённая. — Потому что нельзя было уехать. Не могла. Не имела права. # speaker:vera

~ CharacterSecrets += vera_past
~ understanding_vera += 15

* [Расскажите]
    — Что произошло? # speaker:sorokin
    
    — В семьдесят третьем я вышла замуж. Андрей. Инженер на заводе. Красивый, умный, добрый... — Её голос дрожит. — Мы были счастливы. Год. Целый год. # speaker:vera
    
    Пауза.
    
    — А потом — он начал видеть. # speaker:vera
    
    -> ep2_vera_loss

* [Не настаивать]
    ~ track_helpful_action()  // РЕПУТАЦИЯ: уважение к чувствам Веры
    — Если не хотите — не рассказывайте. # speaker:sorokin

    — Нет. — Она качает головой. — Вы должны знать. Если хотите понять этот город — должны знать. # speaker:vera

    -> ep2_vera_loss

=== ep2_vera_loss ===

# mood: dark

{ not (CharacterSecrets ? vera_past):
    — Мой муж. Андрей. — Вера садится. Тяжело, как старуха. — Инженер на заводе. Секретный отдел. # speaker:vera
    
    ~ CharacterSecrets += vera_past
    ~ understanding_vera += 10
}

// Вопрос зависит от того, что игрок уже знает
{ cult_awareness >= 5:
    — Он работал в секретном отделе? С... — Вы пытаетесь вспомнить. — С кем-то из начальства? # speaker:sorokin
    
    — Да. — Она кивает. — С руководителем проекта. Фамилию я не знала тогда. Узнала потом. — Пауза. — Чернов. Академик Чернов. # speaker:vera
    
    ~ cult_awareness = cult_awareness + 3
    // ФАЗА 1: Раннее раскрытие Чернова
    ~ understanding_chernov += 10
    
    — Что это был за человек? # speaker:sorokin
    
    Вера молчит. Долго.
    
    — Странный. Одержимый. — Она качает головой. — Андрей говорил — после смерти жены Чернов... изменился. Стал другим. Начал верить в вещи, в которые учёный верить не должен. # speaker:vera
    
    ~ understanding_chernov += 5
- else:
    — Чем он занимался на заводе? # speaker:sorokin
    
    — Секретный отдел. Что-то связанное с исследованиями. — Она качает головой. — Андрей не рассказывал. Не имел права. # speaker:vera
}

Она закуривает. Руки трясутся.

— В октябре семьдесят четвёртого он пришёл домой... другим. Не могу объяснить. Те же глаза, тот же голос. Но — как будто что-то внутри сломалось. # speaker:vera

— Что он говорил? # speaker:sorokin

{ cult_awareness >= 8:
    — "Они открыли что-то, Верочка. Что-то, что не должно было быть открыто. И теперь — поздно." # speaker:vera
- else:
    — Бессвязное. О работе. О каких-то экспериментах. О том, что "они зашли слишком далеко". # speaker:vera
}

Она затягивается. Дым поднимается к потолку.

— Через неделю — первые галлюцинации. Красный лес. Голоса. Фигуры. Через месяц — он перестал узнавать меня. Через три месяца... # speaker:vera

Её голос ломается.

— Я нашла его в ванной. Вены. Обе руки. # speaker:vera

~ CharacterSecrets += vera_loss
~ understanding_vera += 25
~ trust_vera += 15

{ sanity < 60:
    Вы чувствуете — что-то откликается внутри. Знакомо. Слишком знакомо.
    
    «...она понимает...»
    «...она видела...»
    
    -> lose_sanity_safe(3) ->
}

— Мне жаль. # speaker:sorokin

— Не надо. — Она тушит сигарету. — Жалость ничего не изменит. Но вот что изменит — правда. И я пятнадцать лет собираю её. Кусочек за кусочком. # speaker:vera

* [Что вы нашли?]
    -> ep2_vera_research

* [Почему не уехали?]
    — После всего этого — почему остались? # speaker:sorokin
    
    Вера смотрит на вас. В её глазах — что-то страшное. Решимость. Или безумие.
    
    — Потому что не могу бросить их. Пациентов. Таких же, как Андрей. Они приходят — один за другим — и я вижу в их глазах то же, что видела в его глазах. # speaker:vera
    
    Пауза.
    
    — И ещё — потому что хочу знать. Что убило моего мужа. Что открыли в этих проклятых пещерах. И как это остановить. # speaker:vera
    
    ~ CharacterSecrets += vera_guilt
    ~ understanding_vera += 20
    ~ trust_vera += 10
    
    -> ep2_vera_research

=== ep2_vera_research ===

— За пятнадцать лет я собрала... кое-что. # speaker:vera

Она открывает сейф в углу кабинета. Достаёт толстую папку.

— Истории болезней. Протоколы вскрытий — неофициальные. Показания пациентов. Рисунки. # speaker:vera

Она раскладывает бумаги на столе.

— Смотрите: все видят одно и то же. Красный лес. Алтарь. Дверь. И — ЭТО. # speaker:vera

Рисунок. Детский, примитивный. Но то, что на нём изображено...

Тёмная масса. Щупальца? Лица? Глаза — десятки глаз — смотрят с бумаги.

{ sanity < 50:
    Вы отшатываетесь.
    
    «...узнаёшь...»
    «...ты видел нас...»
    
    -> lose_sanity_safe(5) ->
}

— Все рисуют одно и то же. Независимо друг от друга. Дети, старики, мужчины, женщины. Одно и то же существо. # speaker:vera

~ cult_awareness += 5

# clue
Улика найдена: исследования доктора Холодовой
~ cult_awareness = cult_awareness + 3

# clue
Улика найдена: исследования Веры

— Это не болезнь. Это... воздействие. Как радиация, только для разума. # speaker:vera

* [Откуда оно исходит?]
    — Из-под завода. Там пещеры. Очень древние. # speaker:vera
    
    ~ trust_vera = trust_vera + 15
    
    -> ep2_vera_trust

* [Вы сообщали об этом?]
    — Один раз. После этого меня вызвал Астахов. # speaker:vera
    
    — И? # speaker:sorokin
    
    — Сказал, что если я хочу продолжать работать... и жить... я забуду об этом. # speaker:vera
    
    ~ trust_vera = trust_vera + 10
    
    -> ep2_vera_trust

=== ep2_vera_trust ===

Вера смотрит вам в глаза:

— Вы другой. Вы не отступите, да? # speaker:vera

— Нет. # speaker:sorokin

— Тогда... — Она достаёт ключ. — Архив. Подвал. Там документы проекта "Эхо". Настоящие. # speaker:vera

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesB ? underground_map):
    ~ CluesB += underground_map
    ~ sync_evidence_count()
    
    # clue
    Улика найдена: карта подземелий от Веры
}
~ Relationships += trusted_vera

#
Улика найдена: ключ от архива

— Только не говорите никому. И... будьте осторожны. # speaker:vera

-> episode2_morning

=== episode2_find_fyodor ===

~ actions_today = actions_today + 1

# mood: horror

Окраина города.

Дома редеют — пятиэтажки, потом трёхэтажки, потом частный сектор. Покосившиеся избушки за деревянными заборами, заснеженные огороды, колодцы с обледенелыми срубами.

И тишина. Та же гробовая тишина, что преследует вас с самого приезда.

Ни одной собаки. Ни одного петуха. Ни одного звука жизни.

Последний дом — сторожка лесника. Клава сказала — здесь. Но это... это не дом. Это — руина.

Стены покосились, словно избушка устала стоять. Крыша — провалилась местами, дыры залатаны кусками жести и рубероида. Окна — заколочены досками, крест-накрест.

Но из трубы — дым. Тонкий, белый. Кто-то живёт.

Вокруг — лес. Начинается в двадцати метрах — чёрная стена сосен. Они стоят неподвижно, но вам кажется, что они смотрят. Ждут.

Вы подходите к двери. Стучите.

Тишина.

Стучите снова. Громче.

— Фёдор! Откройте! # speaker:sorokin

Ничего.

Вы прислушиваетесь. Внутри — шорох. Шаги — осторожные, крадущиеся.

Кто-то подходит к двери. Стоит за ней. Вы чувствуете — прямо за досками.

— Кто? — Голос — хриплый, надломленный. Как скрип ржавой петли. # speaker:fyodor

— Следователь Сорокин. Из прокуратуры. # speaker:sorokin

Долгая пауза. Вы слышите дыхание — тяжёлое, прерывистое.

— Прокуратура? — Горький смех за дверью. — Они послали прокуратуру? Двадцать лет молчали, а теперь — прокуратура? # speaker:fyodor

— Мне нужно поговорить. О том, что происходит в этом городе. # speaker:sorokin

Пауза. Шорох.

Дверь приоткрывается — на цепочке. В щели — глаз. Один. Серый, с красными прожилками. Дикий, но... ясный. Острый.

— Вы пришли. — Голос — еле слышный шёпот. — Я знал. ОНИ сказали, что придёте. # speaker:fyodor

— Кто сказал? # speaker:sorokin

Дверь закрывается. Звук — цепочка снимается. Дверь открывается — широко.

Фёдор. Тот самый мужчина, которого вы видели у завода ночью. Но при свете дня он выглядит... хуже.

Старик. Хотя ему, наверное, лет шестьдесят — не больше. Но глаза — стариковские. Видели слишком много. Лицо — изрезано морщинами, серое, как кора дерева. Шрамы на щеке — три параллельные линии — красные, воспалённые.

Он смотрит на вас. Оценивает.

— Вы слышали голоса? # speaker:fyodor

{ KeyEvents ? heard_voices:
    Вы не отвечаете. Но что-то в вашем лице — говорит за вас.
    
    — Слышали. — Фёдор кивает. — Вижу. У вас — глаза. Такие же, как были у меня. Двадцать лет назад. # speaker:fyodor
}

* [Войти]
    — Можно войти? # speaker:sorokin
    
    Фёдор колеблется. Смотрит за вашу спину — на лес.
    
    — Быстро. Пока они не заметили. # speaker:fyodor
    
    -> ep2_fyodor_inside

* [Поговорить на пороге]
    — Я постою здесь. # speaker:sorokin
    
    — Как хотите. — Фёдор пожимает плечами. — Но ОНИ видят. Везде. Особенно — у леса. # speaker:fyodor
    
    Он оглядывается. Нервно.
    
    — Говорите быстро. Что хотите знать? # speaker:fyodor
    
    -> ep2_fyodor_talk

=== ep2_fyodor_inside ===

Внутри — другой мир.

Сначала — темнота. Потом глаза привыкают, и вы видите.

Хаос. Абсолютный, безумный хаос.

Стены — покрыты... всем. Газетные вырезки — пожелтевшие, ветхие. Карты — самодельные, нарисованные углём и карандашом. Фотографии — старые, чёрно-белые. Символы — сотни символов, тот самый красный круг с тремя линиями, повторённый снова и снова.

И верёвки. Красные нитки протянуты между булавками, соединяя вырезки, фотографии, точки на картах. Как паутина. Как нервная система.

В центре комнаты — стол. На нём — свечи (оплывшие, оплавленные), книги (старые, рукописные), ножи (ржавые, зазубренные).

И — икона. Почерневшая от времени. Богоматерь с младенцем. Но лица — стёрты. Соскоблены.

Пахнет — дымом, плесенью, потом. И чем-то ещё — сладковатым, тошнотворным. Как в склепе.

Вы стоите на пороге. Не решаетесь войти.

— Закройте дверь. — Фёдор уже внутри, у стола. — Быстро. Они не любят закрытых дверей, но это... это даёт время. # speaker:fyodor

Вы закрываете. Темнота сгущается.

— Вы... — Вы не знаете, как спросить. — Вы всё это собрали? # speaker:sorokin

— Я ПОМНЮ. — Фёдор поворачивается. В свете свечей его лицо — как маска. — Двадцать лет помню. Каждую ночь. Каждый сон. Каждый голос. # speaker:fyodor

Он подходит к стене. Проводит рукой по вырезкам.

— Вот. — Указывает на фотографию. — Это я. Пятьдесят третий год. Молодой. Счастливый. Не знал ещё. # speaker:fyodor

На фото — группа мужчин в полевой одежде. Геологи? Рядом — горы, палатки, оборудование.

— А вот — Серафим. — Он указывает на другого. — Тоже был геологом. Тоже нашёл. Тоже... изменился. # speaker:fyodor

Пауза.

— Вы хотите знать правду, следователь? # speaker:fyodor

* [Да]
    — Для этого я здесь. # speaker:sorokin
    
    Фёдор кивает. Медленно. Словно решается на что-то страшное.
    
    — Садитесь. — Он указывает на табуретку. — Это — долгая история. # speaker:fyodor
    
    -> ep2_fyodor_truth

* [Сначала — кто вы?]
    — Подождите. Сначала — расскажите о себе. Кто вы? Как попали сюда? # speaker:sorokin
    
    Фёдор усмехается. Горько.
    
    — Я был геологом. Давно. В другой жизни. Молодым, умным, амбициозным. Приехал сюда в пятьдесят третьем — искать руду. Нашёл кое-что другое. # speaker:fyodor
    
    Он подходит к карте на стене. Большой, рукописной.
    
    — Мы с Серафимом — вместе. Он был моим напарником. Другом. — Пауза. — Единственным другом, который остался. # speaker:fyodor
    
    ~ trust_serafim = trust_serafim + 5
    
    — Что вы нашли? # speaker:sorokin
    
    — Пещеры. Древние. Под тем местом, где теперь завод. # speaker:fyodor
    
    -> ep2_fyodor_truth

=== ep2_fyodor_talk ===

— Что вы видели в ту ночь? У завода? # speaker:sorokin

— То же, что видите вы. Тени. Голоса. Красный свет. # speaker:fyodor

— Это реально? # speaker:sorokin

Фёдор смеётся. Горько.

— Реальнее, чем вы думаете. # speaker:fyodor

-> ep2_fyodor_truth

=== ep2_fyodor_truth ===

Фёдор садится на табуретку. Достаёт из кармана — трубку. Старую, деревянную, обкуренную до черноты.

— В пятьдесят третьем... — Он набивает трубку табаком. Руки дрожат. — Мы геологоразведка. Искали железо. Медь. Что-то полезное для страны. # speaker:fyodor

Он зажигает спичку. Затягивается. Дым — густой, сладковатый — заполняет комнату.

— Нашли пещеры. Под горой. Там, где теперь завод. # speaker:fyodor

— Пещеры? # speaker:sorokin

— Огромные. Километры. Уходят вглубь — как лабиринт. — Он качает головой. — Мы думали — открытие века. Карстовые полости, подземные реки... Позвали начальство. Начальство — Москву. # speaker:fyodor

Пауза. Фёдор смотрит в огонь трубки.

— А в пещерах — рисунки. На стенах. Древние. Тысячи лет — может, десять тысяч. Может, больше. # speaker:fyodor

— Что за рисунки? # speaker:sorokin

— Символы. Те самые. — Он указывает на стену, на красные круги. — И фигуры. Люди в капюшонах. И... ОНО. # speaker:fyodor

— Что — "оно"? # speaker:sorokin

Фёдор не отвечает. Встаёт. Подходит к столу. Роется в бумагах.

— Вот. — Он достаёт мятую карту. Самодельную, нарисованную от руки. — Подземелья. Я чертил по памяти. Двадцать лет чертил. Каждую ночь — после снов — добавлял детали. # speaker:fyodor

Вы берёте карту. Смотрите.

Лабиринт. Коридоры, залы, развилки. Некоторые помечены крестиками — "обвал", "опасно", "не ходить". Другие — звёздочками. И в центре — большой зал. Круглый. С точкой посередине.

— Алтарь. — Фёдор указывает на точку. — Они называют это Дверью. # speaker:fyodor

{ not (CluesE ? fyodor_map):
    ~ CluesE += fyodor_map
    ~ sync_evidence_count()
}

# clue
Улика найдена: карта подземелий Фёдора

— Учёные приехали в пятьдесят четвёртом. Из Москвы. Военные. В штатском, но — военные. Я узнаю породу. # speaker:fyodor

— Что они делали? # speaker:sorokin

— Эксперименты. "Проект Эхо" — так называлось. Официально — изучение акустики пещер. Неофициально... # speaker:fyodor

Он замолкает. Затягивается трубкой.

— Неофициально — контакт. С тем, что там живёт. # speaker:fyodor

* [Дверь куда?]
    — Эта дверь... куда она ведёт? # speaker:sorokin
    
    Фёдор качает головой.
    
    — Не "куда". — Его голос — шёпот. — "Откуда". ОНО приходит оттуда. Когда дверь открывается. # speaker:fyodor
    
    — Что за "оно"? # speaker:sorokin
    
    — Не знаю. — Он вздрагивает. — Никто не знает. Те, кто видел целиком — не вернулись. Или... вернулись другими. # speaker:fyodor
    
    Пауза.
    
    — Я видел... часть. Тень. Форму без формы. Голос без звука. — Он трёт шрамы на щеке. — Этого хватило. На всю жизнь хватило. # speaker:fyodor
    
    ~ cult_awareness = cult_awareness + 3
    
    -> ep2_fyodor_offer

* [Кто "они"?]
    — Вы сказали "они". Кто — они? # speaker:sorokin
    
    — Чернов. — Фёдор сплёвывает. — Академик Чернов. Главный. Он приехал с учёными в пятьдесят четвёртом. Тогда — молодой. Умный. Амбициозный. # speaker:fyodor
    
    — Он всё ещё здесь? # speaker:sorokin
    
    — Здесь. — Фёдор кивает. — Постарел — как все мы. Но не отступил. Наоборот. Он создал... культ. Последователей. Тех, кто верит. # speaker:fyodor
    
    — Во что? # speaker:sorokin
    
    — Что ОНО — бог. — Фёдор усмехается. — Что оно даст им силу. Власть. Бессмертие. Что угодно. Чернов обещает — они верят. # speaker:fyodor
    
    ~ cult_awareness = cult_awareness + 2
    
    -> ep2_fyodor_offer

=== ep2_fyodor_offer ===

Фёдор смотрит на вас долго.

— Вы придёте туда. В пещеры. Я знаю. # speaker:fyodor

— Почему вы так уверены? # speaker:sorokin

— Потому что оно уже позвало вас. Вы слышали голоса? # speaker:fyodor

{ KeyEvents ? heard_voices:
    Вы киваете.
    
    — Значит, поздно. Вы уже часть этого. # speaker:fyodor
}

— Я могу помочь. Показать путь. Но... # speaker:fyodor

// ИСПРАВЛЕНО: устанавливаем оба флага при согласии Фёдора помочь
// fyodor_ally — факт союзничества (в KeyEvents)
// trusted_fyodor — уровень доверия (в Relationships)

* [Что взамен?]
    — Обещайте. Если я не вернусь... сожгите сторожку. Всё. # speaker:fyodor
    
    // ИСПРАВЛЕНО: оба флага устанавливаются вместе для консистентности
    { not (KeyEvents ? fyodor_ally):
        ~ KeyEvents += fyodor_ally
    }
    { not (Relationships ? trusted_fyodor):
        ~ Relationships += trusted_fyodor
    }
    
    — Обещаю. # speaker:sorokin
    
    -> ep2_fyodor_end

* [Это опасно]
    — Я знаю. Двадцать лет я прячусь. Хватит. # speaker:fyodor
    
    // ИСПРАВЛЕНО: оба флага устанавливаются вместе для консистентности
    { not (KeyEvents ? fyodor_ally):
        ~ KeyEvents += fyodor_ally
    }
    { not (Relationships ? trusted_fyodor):
        ~ Relationships += trusted_fyodor
    }
    
    -> ep2_fyodor_end

=== ep2_fyodor_end ===

— В ночь полнолуния. Через три дня. Приходите сюда. Я проведу вас. # speaker:fyodor

Он протягивает руку. Его ладонь — в шрамах.

— До встречи, следователь. Если доживём. # speaker:fyodor

-> episode2_morning

=== episode2_factory_search ===

~ actions_today = actions_today + 1

# mood: tense

-> describe_factory ->

Вы идёте к проходной. # style:atmosphere

— Пропуск? # speaker:stranger

— Следователь Сорокин. Прокуратура. # speaker:sorokin

Охранник звонит куда-то. Долго.

— Проходите. Но вас будут сопровождать. # speaker:stranger

К вам приставляют человека в штатском. Молчаливого.

* [Идти в кабинет Зорина]
    -> ep2_zorin_office

* [Искать тайник в другом месте]
    -> ep2_factory_basement

=== ep2_zorin_office ===

Кабинет Зорина — пуст. Всё вывезено. # style:atmosphere # intensity:medium

— Где его вещи? # speaker:sorokin

— Изъяты. — Человек в штатском не моргает. — По распоряжению. # speaker:stranger

Но вы замечаете — плинтус у окна слегка отходит.

* [Проверить позже]
    Вы запоминаете. Нужно вернуться без сопровождения.
    
    -> ep2_factory_end

* [Попробовать отвлечь сопровождающего]
    — У меня закружилась голова. Можно воды? # speaker:sorokin
    
    Человек колеблется. Уходит.
    
    Вы быстро отрываете плинтус.
    
    Внутри — записка и ключ.
    
    "К.Л. — вход через подвал больницы. Код 1953."
    
    ~ CluesB += experiment_records
    ~ sync_evidence_count()
    ~ cult_awareness = cult_awareness + 3
    
    # clue
    Улика найдена: записка Зорина с кодом
    
    -> ep2_factory_end

=== ep2_factory_basement ===

— Мне нужно в подвал. # speaker:sorokin

— Закрыто. # speaker:stranger

— Распоряжение прокуратуры. # speaker:sorokin

Человек колеблется. Достаёт рацию. Говорит что-то тихо.

— Ждите. # speaker:stranger

Через десять минут появляется Астахов. Серый костюм, пустые глаза.

— Товарищ Сорокин. Опять вы. # speaker:astahov

-> lose_sanity_safe(3) ->

— Подвал закрыт по соображениям безопасности. Радиация. # speaker:astahov

— Я готов рискнуть. # speaker:sorokin

— А я — нет. — Астахов улыбается. — Уходите. Пока можете. # speaker:astahov

-> ep2_factory_end

=== ep2_factory_end ===

Вы выходите с завода. За спиной — ощущение взгляда.

{ sanity < 60:
    Тени в окнах. Или кажется?
}

-> episode2_morning

=== episode2_evening ===

# mood: dark

~ time_of_day = 2

ВЕЧЕР

Вы возвращаетесь в гостиницу. Устали.

{ evidence_collected >= 8:
    Улик достаточно. Картина складывается.
    
    Культ. Эксперименты. Пропавшие люди. Древняя сущность под заводом.
}

{ KeyEvents ? fyodor_ally:
    Фёдор — союзник. Он знает путь.
}

{ Relationships ? trusted_vera:
    Вера на вашей стороне. У вас есть ключ от архива.
}

За окном темнеет. Снова снег.

* [Изучить собранные улики]
    Вы раскладываете всё на столе.
    
    { CluesE ? fyodor_map:
        Карта Фёдора. Подземелья. Алтарь в центре.
    }
    
    { CluesE ? vera_research:
        Исследования Веры. Одинаковые изменения в мозге у всех жертв.
    }
    
    ~ gain_sanity(3)
    
    -> episode2_night

* [Лечь спать]
    ~ gain_sanity(5)
    -> episode2_night

=== episode2_night ===

# mood: horror

// HORROR: Устанавливаем время — ночь, локация — город
~ time_of_day = 3
~ set_location(0)

НОЧЬ

// HORROR: Ночные события
-> check_for_horror_event ->

// Используем функции для проверки состояния
{ is_disturbed():
    Сон беспокойный. Обрывки видений.
    
    Красный лес. Символы. Голоса.
    
    -> lose_sanity_safe(2) ->
}

{ is_mad():
    Сон не приходит.
    
    Голоса. Шёпот. Они не прекращаются.
    
    «...ты слышишь нас...»
    «...приди...»
    «...дверь ждёт...»
    
    -> lose_sanity_safe(4) ->
}

{ KeyEvents ? fyodor_ally:
    За окном — далёкий свет. У леса. Сторожка Фёдора.
    
    Он не спит. Как и вы.
}

...

Вы просыпаетесь — или очнулись от забытья — в четыре утра.

За окном — первый свет. # style:atmosphere # intensity:low

КОНЕЦ ЭПИЗОДА 2 # style:title # intensity:medium

~ sync_evidence_count()

Ваш рассудок: {sanity}/100 # style:important
Дней осталось: {days_remaining} # style:important
Собрано улик: {count_all_clues()} # style:important

// СИСТЕМА РЕПУТАЦИИ: итог дня
{ city_reputation <= -30:
    Репутация в городе: ОЧЕНЬ ПЛОХАЯ ({city_reputation}) # style:important
    Двери закрываются перед вами. Свидетели молчат.
}
{ city_reputation > -30 && city_reputation <= -10:
    Репутация в городе: ПЛОХАЯ ({city_reputation}) # style:important
    Слухи ползут по городу...
}
{ city_reputation > -10 && city_reputation <= 20:
    Репутация в городе: НЕЙТРАЛЬНАЯ ({city_reputation}) # style:important
}
{ city_reputation > 20:
    Репутация в городе: ХОРОШАЯ ({city_reputation}) # style:important
    Город начинает вам доверять.
}

* [Продолжить...]
    ~ advance_day()
    -> episode3_intro

// ═══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 3: ЗАВОД (Расширенная версия с последствиями)
// ═══════════════════════════════════════════════════════════════════════════════

=== episode3_intro ===

# chapter: 3
# mood: horror
# title: Завод

~ time_of_day = 0
~ actions_today = 0

17 НОЯБРЯ 1986 ГОДА # style:title # intensity:high

День третий # style:subtitle

-> describe_hotel_room ->

// ЭТАЛОН: Описание текущего состояния заражения
-> describe_current_state ->

Вы просыпаетесь — резко, как от удара. # style:dramatic # intensity:high

Темнота. Потолок. Незнакомый потолок. # style:atmosphere

Сердце колотится. Простыня — мокрая от пота. На губах — привкус меди, словно кусали язык во сне. # style:atmosphere # intensity:high

Который час? Часы на тумбочке показывают пять утра. За окном — ещё темно. Но не совсем — на востоке, над лесом — бледная полоска рассвета. # style:atmosphere

{ sanity < 50:
    -> hear_the_voices ->

    Голоса. # style:horror # intensity:high

    Они были здесь. Всю ночь. Шептали, бормотали, звали. # style:horror # intensity:high

    «...приди к нам...» # style:vision # intensity:high
    «...дверь ждёт...» # style:vision # intensity:high
    «...ты наш... ты всегда был наш...» # style:vision # intensity:high
    
    Вы прижимаете ладони к ушам. Бесполезно. Они — внутри. В голове. # style:horror # intensity:high
    
    Когда началось? Вчера? Позавчера? Вы уже не помните времени, когда их не было. # style:thought # intensity:high
    
    -> lose_sanity_safe(3) ->
}

{ sanity >= 50:
    Сон был... странным. Фрагменты. Образы. Красный свет. Чьи-то руки — холодные, влажные — тянутся из темноты. # style:flashback # intensity:medium
    
    Вы встряхиваете головой. Просто кошмар. Просто нервы. # style:thought
    
    Но руки — дрожат. # style:dramatic # intensity:medium
}

Вы садитесь на кровати. Смотрите в темноту. # style:action

Третий день. Осталось три дня до полнолуния. До ритуала. # style:dramatic # intensity:high

{ days_remaining <= 3:
    Времени почти нет. Нужно действовать. Быстро. # style:thought # intensity:high
}

{ KeyEvents ? fyodor_ally:
    Фёдор. Старый сторож с безумными глазами и картой подземелий. # style:thought
    
    Он обещал провести вас в ночь полнолуния. Показать путь к алтарю. К Двери. # style:thought
    
    Через два дня. # style:thought # intensity:medium
    
    Но сначала — завод. Нужно найти вход. Проверить, правда ли то, что он говорил. # style:thought # intensity:medium
}

{ trust_serafim >= 50 && MetCharacters ? serafim:
    Серафим. Священник, который был геологом. Который видел. Который знает.
    
    Он говорил о древних ходах. Тропах, которые были до завода, до города, до всего.
    
    Может, он поможет?
}

Вы встаёте. Умываетесь ледяной водой.

-> look_in_mirror ->

За окном — город просыпается. Дым из труб. Редкие фигуры на улицах. Всё как обычно.

Но вы знаете — это обман. Декорация. Под этим городом — пещеры. В этих пещерах — алтарь. У этого алтаря — Дверь.

И через два дня она откроется.

Если вы не остановите.

Сегодня — день, когда всё изменится. Вы это чувствуете. В костях. В крови.

Пора действовать.

Как проникнуть на завод?

* [Через главный вход — официально]
    -> episode3_main_entrance

* [Через чёрный ход — скрытно]
    -> episode3_back_entrance

* { MetCharacters ? tanya && trust_tanya >= 40 } [Попросить Таню провести]
    -> episode3_tanya_help

* { KeyEvents ? fyodor_ally } [Идти с Фёдором — он знает тайный путь]
    -> episode3_fyodor_path

// Новый путь через Серафима
* { trust_serafim >= 50 && MetCharacters ? serafim } [Попросить Серафима показать древний ход]
    -> episode3_serafim_path

=== episode3_main_entrance ===

Проходная. Охранник смотрит подозрительно.

— Пропуск? # speaker:stranger

— Следователь Сорокин. Прокуратура. # speaker:sorokin

Долгая пауза. Звонок куда-то.

— Проходите. Но без сопровождения — никуда. # speaker:stranger

К вам приставляют молчаливого человека в штатском. Он следует за вами везде.

-> lose_sanity_safe(2) ->

// Официальный путь — меньше свободы, но безопаснее
{ sanity < 60:
    Его присутствие давит. Как будто стены сужаются.
}

* [Попытаться оторваться от сопровождающего]
    -> ep3_lose_escort

* [Продолжить под надзором]
    -> episode3_caves_escorted

=== ep3_lose_escort ===

В коридоре — развилка. Вы резко сворачиваете.

— Эй! # speaker:stranger

Бежите. Лестница вниз. Дверь.

{ sanity >= 50:
    Вам удаётся скрыться. Сердце колотится.
    
    -> lose_sanity_safe(3) ->
    
    -> episode3_caves
- else:
    Вы бежите. Но коридоры — все одинаковые. Или это галлюцинация?
    
    Стены — красные? Нет. Серые.
    
    Вас находят. Выводят под руки.
    
    -> lose_sanity_safe(5) ->
    
    -> ep3_caught
}

=== ep3_caught ===

Астахов ждёт у выхода. # style:action

— Товарищ Сорокин. Вы испытываете моё терпение. # speaker:astahov

— Я провожу расследование. # speaker:sorokin

— Ваше расследование закончено. — Он достаёт бумагу. — Приказ о вашем отзыве. С завтрашнего дня. # speaker:astahov

* [Это незаконно]
    — Мои полномочия определены прокуратурой. # speaker:sorokin
    
    — Здесь — МОИ полномочия. # speaker:astahov
    
    ~ trust_astahov = trust_astahov - 10
    -> lose_sanity_safe(3) ->
    
    -> ep3_thrown_out

* [Согласиться притворно]
    — Разумеется, товарищ полковник. # speaker:sorokin
    
    Астахов кивает. # style:action
    
    — Правильное решение. # speaker:astahov
    
    Конечно, вы никуда не уедете.
    
    -> ep3_thrown_out

=== ep3_thrown_out ===

Вас выводят с завода.

День потерян. Но вы кое-что узнали: они боятся. Значит, там есть что скрывать.

{ KeyEvents ? fyodor_ally:
    Фёдор. Он знает другой путь.
}

-> episode3_evening_choice

=== episode3_caves_escorted ===

Под надзором вы можете осмотреть только верхние этажи.

Ничего особенного. Станки. Рабочие. Всё как везде.

Но вы замечаете — некоторые коридоры заварены. Новые решётки на окнах подвала.

~ cult_awareness = cult_awareness + 1

— Что там? — Вы указываете на заваренную дверь. # speaker:sorokin

— Радиационная зона. Закрыто. # speaker:astahov

Ложь. Вы чувствуете. # style:thought

-> episode3_evening_choice

=== episode3_back_entrance ===

Вы обходите периметр. Забор. Колючая проволока.

У старого склада — дыра в заборе. Кто-то уже пролезал.

Внутри — темно. Запах машинного масла и чего-то... сладковатого.

-> see_cult_symbol ->

{ not (CluesC ? cult_symbol):
    ~ CluesC += cult_symbol
    ~ sync_evidence_count()
    ~ boost_theory(5, 5)
    
    # clue
    Улика найдена: символ на складе
}

* [Идти дальше]
    -> episode3_caves

* [Осмотреть старый склад — тут могут быть документы]
    -> ep3_chernov_office

// ИСПРАВЛЕНО: вложенные choices вынесены в отдельные пункты с условиями
* { MetCharacters ? tanya } [Позвонить Тане — она знает завод]
    -> ep3_call_tanya

* { KeyEvents ? fyodor_ally } [Вернуться к Фёдору — он знает тайный путь]
    -> episode3_fyodor_path

* [Идти одному дальше]
    -> episode3_caves

// ═══════════════════════════════════════════════════════════════════════════════
// ФАЗА 1: РАННЕЕ РАСКРЫТИЕ ЧЕРНОВА — Кабинет на складе
// ═══════════════════════════════════════════════════════════════════════════════

=== ep3_chernov_office ===

# mood: mystery

Вы углубляетесь в склад. Темно. Фонарик выхватывает ржавые стеллажи, ящики, забытое оборудование.

И — дверь. Металлическая, с табличкой: "Спецотдел. Посторонним вход воспрещён."

Дверь — приоткрыта.

Вы входите.

Маленькая комната. Стол, заваленный бумагами. Шкаф — распахнут, большинство папок вынесено. На полу — осколки стекла.

Но кое-что осталось.

* [Осмотреть стол]
    На столе — фотография в разбитой рамке.
    
    Женщина. Молодая, красивая. Тёмные волосы, светлые глаза. Улыбается.
    
    На обороте — надпись, выцветшие чернила:
    
    "Моей Леночке — навсегда. А.Ч. 1968"
    
    А.Ч. — Академик Чернов?
    
    ~ understanding_chernov += 10
    
    * * [Взять фотографию]
        Вы кладёте фото в карман. Может пригодиться.
        
        ~ inventory += item_camera  // Используем как метку
        
        -> ep3_chernov_papers
    
    * * [Оставить]
        -> ep3_chernov_papers

* [Осмотреть шкаф]
    -> ep3_chernov_papers

=== ep3_chernov_papers ===

В шкафу — остатки документов. Большинство — уничтожено. Но один лист — уцелел.

"ХАРАКТЕРИСТИКА
Субъект: А.Ч.
Статус: Руководитель проекта
Примечание: После инцидента 12.04.1971 (смерть жены) наблюдаются признаки нестабильного психического состояния. Рекомендовано наблюдение.
Обновление 1975: Субъект проявляет нездоровый интерес к результатам Фазы 3. Неоднократно упоминает о 'воссоединении' и 'преодолении границ'."

~ understanding_chernov += 10
~ CharacterSecrets += chernov_wife
~ cult_awareness = cult_awareness + 2

# clue
Обнаружено: характеристика на А.Ч. — руководитель проекта потерял жену

* [Его жена погибла... и он искал способ вернуть её?]
    Мозаика начинает складываться. Учёный, потерявший любимого человека. Проект, обещающий невозможное. Дверь в неизведанное.
    
    Что он нашёл? И во что превратился?
    
    ~ boost_theory(5, 8)
    
    -> ep3_chernov_exit

* [Продолжить поиски]
    -> ep3_chernov_exit

=== ep3_chernov_exit ===

Шум. Шаги снаружи. Охрана?

Вы быстро выходите другим путём.

-> episode3_caves

=== ep3_call_tanya ===

Таня приходит через час. # style:action

// Прогрессия отношений с Таней — она пришла на помощь
-> see_tanya ->

— Вы уверены? # speaker:tanya

— Да. # speaker:sorokin

— Тогда идём. Я знаю, как обойти охрану. # speaker:tanya

~ trust_tanya = trust_tanya + 10

Вдвоём — легче. Её присутствие успокаивает.

~ gain_sanity(3)

// ТОЧКА НЕВОЗВРАТА: Выбор союзника
{ chosen_ally == 0:
    ~ chosen_ally = 1  // Таня
    
    # point_of_no_return
    Вы выбрали идти с Таней. Этот выбор определит доступные пути в финале.
}

-> episode3_caves_with_ally

=== episode3_tanya_help ===

— Я знаю, как пройти. — Таня ведёт вас через технический коридор. # speaker:tanya

— Папа показывал. Когда я была маленькой. # speaker:tanya

Вы оказываетесь в подвальном помещении. Старые трубы, ржавые вентили.

— Дальше я не ходила. Папа говорил — там опасно. # speaker:tanya

~ trust_tanya = trust_tanya + 10
~ gain_sanity(3)

* [Идти вместе]
    — Останься здесь. # speaker:sorokin
    
    — Нет. — Её голос твёрд. — Это мой отец. # speaker:tanya
    
    -> episode3_caves_with_ally

* [Попросить её остаться]
    — Таня, это опасно. # speaker:sorokin
    
    — Я знаю. Но... # speaker:tanya
    
    Она колеблется.
    
    — Ладно. Но если через час не вернётесь — я иду за вами. # speaker:tanya
    
    -> episode3_caves

=== episode3_serafim_path ===

// Новый путь — через Серафима (требует высокое доверие)

Вы идёте к церкви.

Серафим ждёт у двери.

— Вы решились. Хорошо. # speaker:serafim

— Вы знаете другой путь? # speaker:sorokin

— Древний ход. Ещё до завода был. Манси знали его. # speaker:serafim

~ trust_serafim = trust_serafim + 10
~ gain_sanity(5)

// ТОЧКА НЕВОЗВРАТА: Выбор союзника
{ chosen_ally == 0:
    ~ chosen_ally = 3  // Серафим
    
    # point_of_no_return
    Вы выбрали путь Серафима. Этот выбор определит доступные пути в финале.
}

Он ведёт вас через лес. Тропой, которую вы бы никогда не нашли сами.

— Вот. — Серафим указывает на скалу. — Вход. Но дальше я не пойду. Мои кости слишком стары. # speaker:serafim

— Спасибо, отец. # speaker:sorokin

— Храни вас Бог. — Он крестит вас. — И помните: свет сильнее тьмы. Всегда. # speaker:serafim

-> episode3_caves

=== episode3_fyodor_path ===

Фёдор ждёт у своей сторожки.

— Вы решились. # speaker:fyodor

— Да. # speaker:sorokin

— Тогда идём. — Он достаёт карту. — Есть старый ход. Из леса. Ещё до завода был. # speaker:fyodor

Вы идёте через лес. Снег скрипит под ногами.

{ sanity < 60:
    Деревья — красные? Нет. Серые. Просто свет такой.
    
    -> lose_sanity_safe(2) ->
}

Фёдор останавливается у огромного валуна.

— Здесь. # speaker:fyodor

Он отодвигает камни. За ними — вход в пещеру.

— Я двадцать лет не заходил сюда. — Его голос дрожит. — Но для вас — зайду. # speaker:fyodor

~ Relationships += fyodor_secret
~ cult_awareness = cult_awareness + 2

// ТОЧКА НЕВОЗВРАТА: Выбор союзника
{ chosen_ally == 0:
    ~ chosen_ally = 2  // Фёдор
    
    # point_of_no_return
    Вы выбрали путь Фёдора. Его знания о пещерах откроют уникальные пути в финале.
}

-> episode3_caves_with_ally

=== episode3_caves_with_ally ===

// Версия с союзником — безопаснее, но есть риск для союзника

{ KeyEvents ? fyodor_ally:
    Фёдор идёт впереди. Он знает каждый поворот.
    
    — Здесь. Осторожно. # speaker:fyodor
}

{ MetCharacters ? tanya:
    Таня держится рядом. Фонарик дрожит в её руке.
    
    — Это... древнее. # speaker:tanya
}

{ not (KeyEvents ? entered_caves):
    ~ KeyEvents += entered_caves
    
    Пещеры. Древние. Рисунки на стенах.
    
    Те же символы. Тысячи лет.
    
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesD ? expedition_1890):
        ~ CluesD += expedition_1890
        ~ sync_evidence_count()
    }
    ~ cult_awareness = cult_awareness + 3
}

В пещере — следы недавнего присутствия. Свечи. Пепел.

* [Исследовать глубже — вместе]
    -> ep3_deep_with_ally

* [Разделиться]
    -> ep3_split_up

=== ep3_deep_with_ally ===

Вы идёте вглубь. Вдвоём.

{ KeyEvents ? fyodor_ally:
    — Здесь. — Фёдор останавливается. — Алтарь. # speaker:fyodor
}

Фонарик выхватывает... алтарь.

Камень, покрытый чем-то тёмным. Засохшая кровь.

// Добавляем улику только если ещё не нашли
{ not (CluesC ? insider_testimony):
    ~ CluesC += insider_testimony
    ~ sync_evidence_count()

    # clue
    Улика найдена: следы ритуалов
}

{ MetCharacters ? tanya:
    — Боже... — Таня бледнеет. — Это... это кровь? # speaker:tanya
    
    — Да. # speaker:sorokin
    
    Она хватает вас за руку.
}

{ sanity < 50:
    Голоса. Громче.
    
    «...ОН ЗДЕСЬ...»
    
    -> lose_sanity_safe(3) ->
}

Внезапно — шаги. Много.

* [Прятаться]
    -> ep3_hide

* [Бежать]
    -> ep3_run_with_ally

=== ep3_run_with_ally ===

— Бежим! # speaker:sorokin # style:action # intensity:high

{ MetCharacters ? tanya:
    Вы хватаете Таню за руку.
}

{ KeyEvents ? fyodor_ally:
    — За мной! — кричит Фёдор. — Знаю короткий путь! # speaker:fyodor # style:action
}

Вы несётесь по коридорам. Сзади — шаги. Много.

-> lose_sanity_safe(5) ->

{ KeyEvents ? fyodor_ally:
    Фёдор выводит вас к выходу. Он знает каждый поворот.
    
    ~ gain_sanity(2)
}

Наконец — свет. Снег. Свобода.

{ MetCharacters ? tanya:
    Таня тяжело дышит рядом.
    
    — Что... что это было? # speaker:tanya
}

Вы оглядываетесь. За спиной — темнота пещеры.

Никто не преследует. Пока.

-> ep3_escape_together

=== ep3_split_up ===

— Разделимся. Охватим больше. # speaker:sorokin

{ MetCharacters ? tanya:
    — Таня, ты налево. Я — направо. # speaker:sorokin
    
    — Хорошо. — Она не выглядит уверенной. # speaker:tanya
}

{ KeyEvents ? fyodor_ally:
    — Фёдор, проверь тот коридор. # speaker:sorokin
    
    — Как скажете. # speaker:fyodor
}

Вы расходитесь.

Темнота. Тишина.

И вдруг — крик.

{ MetCharacters ? tanya:
    Таня!
    
    * [Бежать на крик]
        -> ep3_tanya_danger
}

{ KeyEvents ? fyodor_ally && not (MetCharacters ? tanya):
    Фёдор!
    
    * [Бежать на крик]
        -> ep3_fyodor_danger
}

// Fallback — если пришли одни
* [Бежать к выходу]
    Вы бежите обратно. Один. В темноте.
    
    -> lose_sanity_safe(5) ->
    
    -> ep3_escape_together

=== ep3_tanya_danger ===

Вы бежите.

Таня — у стены. Перед ней — фигура в капюшоне. # style:action # intensity:high

— СТОЙ! # speaker:sorokin # style:action # intensity:high

Фигура оборачивается. Лица не видно. # style:action

* [Атаковать]
    Вы бросаетесь вперёд.
    
    Удар. Фигура падает. Капюшон — пуст?
    
    Нет. Человек. Обычный человек в маске.
    
    -> lose_sanity_safe(3) ->
    
    -> ep3_tanya_saved

* [Схватить Таню и бежать]
    Вы хватаете Таню за руку.
    
    — Бежим! # speaker:sorokin # style:action # intensity:high
    
    Вы несётесь по коридорам. Сзади — шаги.
    
    -> lose_sanity_safe(5) ->
    
    -> ep3_escape_together

=== ep3_tanya_saved ===

— Ты в порядке? # speaker:sorokin

Таня кивает. Дрожит. # style:action

— Кто это был? # speaker:tanya

Вы снимаете маску с лежащего. # style:action

Лицо — незнакомое. Молодой человек. Рабочий завода? # style:thought

— Они... они везде. # speaker:tanya

// Добавляем улику только если ещё не нашли
{ not (CluesC ? insider_testimony):
    ~ CluesC += insider_testimony
    ~ sync_evidence_count()

    # clue
    Улика найдена: член культа
}

// ДОБАВЛЕНО: укрепление связи с Таней после спасения
Таня смотрит на вас. В её глазах — благодарность. И что-то ещё.

— Вы... спасли мне жизнь. # speaker:tanya

~ trust_tanya = trust_tanya + 10
~ track_heroic_action()  // РЕПУТАЦИЯ: спас жизнь — герой!
~ reputation_helped_tanya = true

-> ep3_escape_together

=== ep3_fyodor_danger ===

Вы бежите.

Фёдор — на полу. Над ним — двое в капюшонах. # style:action # intensity:high

— СТОЙ! # speaker:sorokin

Они оборачиваются. Бегут. # style:action

Вы падаете на колени рядом с Фёдором. # style:action

— Фёдор! # speaker:sorokin

Он дышит. Кровь на лбу. # style:action # intensity:high

— Они... они меня узнали... — Он кашляет. — Двадцать лет прятался... а они... # speaker:fyodor

* [Помочь ему выбраться]
    ~ track_heroic_action()  // РЕПУТАЦИЯ: спасение жизни Фёдора!
    ~ reputation_saved_someone = true
    
    Вы поднимаете его на плечо. # style:action
    
    — Держись. # speaker:sorokin
    
    -> lose_sanity_safe(3) ->
    
    -> ep3_escape_with_fyodor

* [Оставить и бежать]
    ~ track_aggressive_action()  // РЕПУТАЦИЯ: бросил человека умирать
    — Прости. # speaker:sorokin
    
    — Нет... не... — Но вы уже бежите. # speaker:fyodor
    
    ~ KeyEvents += found_fyodor_body
    -> lose_sanity_safe(10) ->
    ~ Relationships -= trusted_fyodor
    
    -> ep3_escape_alone_guilt

=== ep3_escape_with_fyodor ===

Вы тащите Фёдора к выходу.

Он тяжёлый. Старый. Но живой.

— Спасибо... — хрипит он. — Вы... не такой как они... # speaker:fyodor

// Укрепляем связь с Фёдором
~ Relationships += trusted_fyodor
~ gain_sanity(3)

Наконец — свет. Выход.

Вы оба падаете в снег. Дышите.

— Они знают... — Фёдор смотрит на лес. — Теперь они знают, что мы были там. # speaker:fyodor

-> episode3_evening_choice

=== ep3_escape_alone_guilt ===

Вы выбегаете из пещер.

Сердце колотится. Совесть — жжёт.

Фёдор. Вы бросили его.

{ sanity < 40:
    Голоса:
    
    «...предатель...»
    «...такой же как мы...»
}

На следующий день вы узнаете: тело Фёдора нашли в лесу. Официально — несчастный случай.

Вы знаете правду.

-> episode3_evening_choice

=== ep3_escape_together ===

Вы выбираетесь из пещер.

Снаружи — холодный воздух. Свобода.

{ MetCharacters ? tanya:
    Таня смотрит на вас.
    
    — Что это было? # speaker:tanya
    
    — Культ. Они настоящие. # speaker:sorokin
    
    — Папа... он знал. # speaker:tanya # intensity:high
    
    ~ trust_tanya = trust_tanya + 15
}

-> episode3_evening_choice

=== ep3_hide ===

Вы прячетесь за камнями.

Шаги приближаются.

Голоса: # style:whisper # intensity:medium

— ...ритуал в полнолуние... # speaker:cultist # style:whisper
— ...три жертвы готовы... # speaker:cultist # style:whisper
— ...Чернов сказал — скоро Дверь откроется навсегда... # speaker:cultist # style:whisper

~ cult_awareness = cult_awareness + 3

Они проходят мимо. # style:action

{ MetCharacters ? tanya:
    Таня зажимает рот рукой. Молчит.
}

{ KeyEvents ? fyodor_ally:
    Фёдор шепчет:
    
    — Три жертвы. Зорин — один из них. # speaker:sorokin
}

* [Выждать и уйти]
    Вы ждёте. Потом — тихо выбираетесь.
    
    ~ gain_sanity(2)
    
    -> ep3_escape_together

* [Следовать за ними]
    -> ep3_follow_cultists

=== ep3_follow_cultists ===

Вы идёте за ними. Тихо.

Они спускаются глубже. К алтарю.

Там — ещё люди. Много. Двадцать? Тридцать?

И — он. Чернов. Высокий. В белом. # style:dramatic # intensity:high

— Братья и сёстры. Через два дня — час настанет. # speaker:chernov

~ MetCharacters += chernov
~ cult_awareness = cult_awareness + 5

# clue
Улика найдена: Чернов — лидер культа

{ sanity < 50:
    Вы видите... что-то. Над алтарём. Тень? Форма?
    
    «...СКОРО...»
    
    -> lose_sanity_safe(5) ->
}

* [Уходить — срочно]
    Вы отступаете. Тихо.
    
    { chosen_ally == 1:  // С Таней
        Внезапно — камень срывается из-под ноги Тани. Грохот.
        
        — Кто там?!
        
        Вы хватаете Таню за руку и бежите.
        
        -> ep3_chase_tanya
    - else:
        -> ep3_escape_together
    }

* [Запомнить лица]
    Вы смотрите. Запоминаете.
    
    Громов? Нет. Но... Астахов. Он там.
    
    // Добавляем улику только если ещё не нашли
    { not (CluesE ? gromov_confession):
        ~ CluesE += gromov_confession
        ~ sync_evidence_count()
    
        # clue
        Улика найдена: Астахов — член культа
    }
    
    -> lose_sanity_safe(3) ->
    
    -> ep3_escape_together

// ═══════════════════════════════════════════════════════════════════════════════
// ФАЗА 4: ТОЧКА НЕВОЗВРАТА — Погоня с Таней
// ═══════════════════════════════════════════════════════════════════════════════

=== ep3_chase_tanya ===

# mood: action

Вы бежите. Таня рядом.

Позади — крики. Шаги. Много.

Коридор сужается. Развилка!

* [Налево — короче]
    Вы сворачиваете. Таня следом.
    
    Тупик!
    
    Они догоняют.
    
    * * [Драться]
        Вы разворачиваетесь. Их трое.
        
        Удар. Ещё один. Вы отбиваетесь.
        
        Но один из них — за Таней.
        
        — Беги! — кричите вы.
        
        Она не слушает. Пытается помочь.
        
        Удар. Таня падает.
        
        ~ KeyEvents += tanya_injured
        ~ tanya_was_injured = true
        ~ trust_tanya = trust_tanya + 10
        -> lose_sanity_safe(5) ->
        
        # point_of_no_return
        Таня ранена из-за вас. Романтическая концовка больше недоступна.
        
        Вы хватаете её и бежите. Каким-то чудом — вырываетесь.
        
        -> ep3_tanya_aftermath
    
    * * [Прикрыть Таню]
        — Беги! Я задержу!
        
        Она колеблется.
        
        — БЕГИ!
        
        Таня убегает. Вы остаётесь.
        
        Их трое. Вы — один.
        
        -> lose_sanity_safe(8) ->
        
        Бьют. Долго. Больно.
        
        Но Таня ушла. Она в безопасности.
        
        -> ep3_beaten
    
* [Направо — дальше]
    Вы бежите дальше. Коридор петляет.
    
    Таня споткнулась!
    
    * * [Помочь ей]
        ~ track_heroic_action()  // РЕПУТАЦИЯ: рискнул жизнью ради Тани!
        ~ reputation_helped_tanya = true
        
        Вы возвращаетесь. Поднимаете её.
        
        Они догоняют.
        
        — Сюда! — Таня тянет вас в боковой проход.
        
        Узкая щель. Вы протискиваетесь.
        
        Они не могут пролезть.
        
        ~ gain_sanity(3)
        ~ trust_tanya = trust_tanya + 15
        
        -> ep3_escape_together
    
    * * [Продолжать бежать]
        — Вставай! Быстрее!
        
        Она падает снова.
        
        Вы хватаете её, но она кричит от боли.
        
        Нога. Сломана? Вывихнута?
        
        ~ KeyEvents += tanya_injured
        ~ tanya_was_injured = true
        -> lose_sanity_safe(3) ->
        
        # point_of_no_return
        Таня ранена. Это изменит доступные концовки.
        
        Вы несёте её на себе. Кое-как — выбираетесь.
        
        -> ep3_tanya_aftermath

=== ep3_tanya_aftermath ===

Вы выбрались.

Таня — бледная, в крови. Но живая. # style:action # intensity:high

— Простите... — шепчет она. — Из-за меня... # speaker:tanya

— Молчи. — Вы несёте её к машине. — Всё будет хорошо. # speaker:sorokin

Но вы знаете — не будет. Ничего не будет как прежде. # style:thought # intensity:high

~ Relationships -= romantic_tanya

-> episode3_evening_choice

=== ep3_beaten ===

Вы приходите в себя.

Темнота. Боль. Кровь во рту.

Они ушли. Почему не убили?

«...ОН НУЖЕН НАМ ЖИВЫМ...»

Голоса. В голове.

~ sorokin_infected = true
~ infection_level = infection_level + 20
-> lose_sanity_safe(10) ->

Вы выползаете из пещер. Каким-то чудом.

-> episode3_evening_choice

=== episode3_caves ===

// Одиночная версия
// HORROR: Устанавливаем локацию — пещеры
~ set_location(2)

{ not (KeyEvents ? entered_caves):
    ~ KeyEvents += entered_caves
    
    Дверь — ржавая, тяжёлая — открывается со скрипом.
    
    За ней — темнота. Абсолютная. Ваш фонарик — слабый, жёлтый луч — тонет в ней, как камень в болоте.
    
    Лестница. Бетонные ступени, покрытые влагой и плесенью. Уходят вниз — круто, почти вертикально.
    
    Запах — первое, что вы чувствуете. Сырость. Гниль. И что-то ещё — сладковатое, тяжёлое. Как в склепе. Как в морге.
    
    // HORROR: Случайное событие при входе в пещеры
    -> check_for_horror_event ->
    
    Вы начинаете спуск.
    
    Ступени — скользкие. Вы считаете их машинально. Десять. Двадцать. Пятьдесят. Сто.
    
    Холод — нарастает. Не зимний холод — другой. Влажный, липкий. Пробирается под одежду, под кожу.
    
    На стенах — конденсат. Капли стекают вниз, оставляя тёмные полосы на бетоне.
    
    И вдруг — бетон заканчивается.
    
    Вы стоите у входа в пещеру. Настоящую пещеру. Природную.
    
    Свод — высокий, теряется в темноте. Стены — скала, покрытая мхом и лишайником. Под ногами — камни, щебень, лужи стоячей воды.
    
    И рисунки.
    
    Они везде. На стенах, на потолке, на полу. Древние. Выцарапанные на камне, закрашенные чем-то тёмным — кровью? охрой?
    
    Символы. Те же самые. Красные круги с тремя линиями. Фигуры в капюшонах. Руки, тянущиеся к небу. И в центре — что-то. Тень. Форма без формы.
    
    Вы подходите ближе. Проводите пальцем по рисунку.
    
    Тысячи лет. Может — десятки тысяч.
    
    Культ существовал задолго до завода. До города. До всего.
    
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesD ? expedition_1890):
        ~ CluesD += expedition_1890
        ~ sync_evidence_count()
    }
    ~ cult_awareness = cult_awareness + 3
    
    # clue
    Улика найдена: древние рисунки в пещерах
}

Дальше — коридор. Узкий, извилистый.

На полу — следы. Недавние. Ботинки. Много. # style:atmosphere # intensity:medium

Свечи — у стен. Оплывшие, потухшие. Пепел на камнях. # style:atmosphere # intensity:medium

Здесь были люди. Недавно. Может — вчера. Может — сегодня утром. # style:thought # intensity:high

{ sanity < 60:
    Голоса — громче здесь. Яснее. # style:horror # intensity:high
    
    «...ближе...» # style:vision # intensity:high
    «...ты почти дома...» # style:vision # intensity:high
    
    -> lose_sanity_safe(2) ->
}

* [Исследовать глубже]
    Вы делаете шаг вперёд. В темноту.
    
    Что-то тянет вас. Что-то... зовёт.
    
    -> episode3_deep_caves

* [Вернуться и изучить находки]
    Хватит. На сегодня — хватит.
    
    У вас есть доказательства. Рисунки. Следы.
    
    Нужно вернуться. Обдумать. Подготовиться.
    
    -> episode3_study_findings

=== episode3_deep_caves ===

// HORROR: Глубокие пещеры — максимальная интенсивность
~ set_location(2)

Вы идёте вглубь. Один. # style:action # intensity:high

Коридор петляет — влево, вправо, вниз. Карта Фёдора в кармане, но здесь всё выглядит иначе. Темнота скрадывает расстояния, искажает пропорции. # style:atmosphere # intensity:high

// HORROR: События в глубине
-> check_for_horror_event ->

Потолок опускается. Приходится нагибаться. Потом — ползти на четвереньках. # style:action # intensity:high

Камни — острые. Царапают ладони, рвут ткань брюк. # style:action # intensity:medium

И запах. Чем глубже — тем сильнее. Сладковатый, тошнотворный. Как разложение. Как смерть. # style:horror # intensity:high

// HORROR: Ещё одно событие при продвижении
-> check_for_horror_event ->

// Голоса в пещерах — эхо умножает их
-> hear_the_voices ->

Коридор расширяется. Вы встаёте. Отряхиваетесь. # style:action

И — # style:dramatic # intensity:high

Фонарик выхватывает... зал. # style:dramatic # intensity:high

Огромный. Свод теряется в темноте. Стены — покрыты рисунками, символами, надписями. Некоторые — древние, выцарапанные на камне. Другие — свежие, нарисованные краской. # style:atmosphere # intensity:high

// Дверь — здесь. Эпицентр. Точка истончения реальности.
-> sense_the_door ->

В центре зала — алтарь. # style:horror # intensity:high

Камень. Большой, плоский, как стол. Тёмный — почти чёрный. # style:atmosphere # intensity:high

Вы подходите ближе. Проводите пальцем по поверхности. # style:action # intensity:high

Влажно. Липко. # style:horror # intensity:high

Вы смотрите на палец. # style:action # intensity:high

Красное. # style:horror # intensity:high

Кровь. # style:horror # intensity:high

Засохшая? Свежая? Вы не уверены. # style:thought # intensity:high

// Добавляем улику только если ещё не нашли
{ not (CluesC ? insider_testimony):
    ~ CluesC += insider_testimony
    ~ sync_evidence_count()

    # clue
    Улика найдена: следы ритуалов — кровь на алтаре
}

Вокруг алтаря — круги. Нарисованные на полу. Красные. Те же символы — снова и снова.

И свечи. Десятки свечей. Оплывшие, погасшие. Но воск — ещё мягкий.

Здесь были. Недавно. Очень недавно.

-> lose_sanity_safe(5) ->

{ sanity < 50:
    Голоса.
    
    Они — здесь. В этом зале. Эхом отражаются от стен, от потолка, от алтаря.
    
    «...ты пришёл...»
    «...мы ждали...»
    «...скоро... скоро будешь с нами...»
    
    Вы крутитесь. Ищете источник.
    
    Никого. Пустой зал. Тёмный алтарь.
    
    Но голоса — не прекращаются.
    
    -> lose_sanity_safe(3) ->
}

{ sanity < 30:
    И тогда — вы видите.
    
    Тень.
    
    Она отделяется от стены. Медленно. Плавно. Как дым. Как вода.
    
    Форма — человеческая? Нет. Что-то... другое. Больше. Древнее.
    
    Она движется. К вам.
    
    Вы пятитесь. Спиной ощущаете стену. Холодную. Мокрую.
    
    Тень — ближе. Вы видите... лицо? Нет. Провал. Пустота.
    
    И голос — громом — в голове:
    
    «...ТЫ НАШ...»
    
    Вы бежите.
    
    Не оглядываясь. Не думая. Просто — бежите.
    
    Коридор. Камни. Темнота. Вы падаете, встаёте, бежите снова.
    
    -> lose_sanity_safe(5) ->
}

Наконец — свет. Лестница. Выход.

Вы выбираетесь наружу. Задыхаясь. Дрожа.

Что это было?

-> episode3_evening_choice

=== episode3_study_findings ===

В гостинице вы раскладываете находки.

Рисунки на стенах пещер — копии символов культа.

Но им тысячи лет. Культ существовал задолго до...

~ gain_sanity(2)

{ evidence_collected >= 5:
    Картина складывается. Древний культ. Советские эксперименты. Пропавшие люди.
    
    Всё связано.
}

-> episode3_evening_choice

=== episode3_evening_choice ===

# mood: dark

~ time_of_day = 2

ВЕЧЕР

День был тяжёлым.

{ KeyEvents ? found_fyodor_body:
    Фёдор мёртв. Из-за вас.
    
    -> lose_sanity_safe(3) ->
}

{ trust_tanya >= 60:
    Таня приходит вечером. С едой.
    
    — Вы должны поесть. # speaker:klava
    
    Вы молча едите. Её присутствие успокаивает.
    
    ~ gain_sanity(3)
}

{ sanity < 60:
    Голоса не отпускают. # style:horror # intensity:high
    
    «...два дня...» # style:vision # intensity:high
    «...дверь откроется...» # style:vision # intensity:high
    «...ты будешь с нами...» # style:vision # intensity:high
}

КОНЕЦ ЭПИЗОДА 3 # style:title # intensity:medium

~ sync_evidence_count()

Ваш рассудок: {sanity}/100 # style:important
Дней осталось: {days_remaining} # style:important
Собрано улик: {count_all_clues()} # style:important

// СИСТЕМА РЕПУТАЦИИ: итог дня
{ city_reputation <= -40:
    Репутация в городе: ВРАГ ({city_reputation}) # style:important
    Город ненавидит вас. Это опасно.
}
{ city_reputation > -40 && city_reputation <= -10:
    Репутация в городе: ПЛОХАЯ ({city_reputation}) # style:important
}
{ city_reputation > -10 && city_reputation <= 30:
    Репутация в городе: НЕЙТРАЛЬНАЯ ({city_reputation}) # style:important
}
{ city_reputation > 30:
    Репутация в городе: ХОРОШАЯ ({city_reputation}) # style:important
    Союзники найдены. Город на вашей стороне.
}

{ reputation_helped_tanya:
    ★ Таня благодарна вам. Это может спасти жизни.
}
{ reputation_saved_someone:
    ★ Вы спасли чью-то жизнь. Город это помнит.
}

* [Продолжить...]
    ~ advance_day()
    -> episode4_intro

// ═══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 4: ГОЛОСА (Расширенная версия)
// ═══════════════════════════════════════════════════════════════════════════════

=== episode4_intro ===

# chapter: 4
# mood: horror
# title: Голоса

~ time_of_day = 0
~ actions_today = 0

18 НОЯБРЯ 1986 ГОДА # style:title # intensity:high

День четвёртый # style:subtitle

-> describe_hotel_room ->

// ЭТАЛОН: Описание текущего состояния заражения
-> describe_current_state ->

{ sanity < 40:
    -> hear_the_voices ->

    Грань между реальностью и видениями стирается. # style:horror # intensity:high

    Голоса — постоянны. Неразличимы от мыслей. # style:horror # intensity:high

    Вы уже не уверены, что реально. # style:horror # intensity:high
}

// Похищение Серафима — но ТОЛЬКО если низкое доверие или не помогали
// Если высокое доверие — Серафим прячется сам и может помочь в эпизоде 4
{ MetCharacters ? serafim:
    { trust_serafim >= 50 && Relationships ? helped_serafim:
        // Серафим предупреждён и скрылся — доступен для благословения
        Утром — записка под дверью. # style:action
        
        "Следователь. Они придут за мной ночью. Я ухожу в скит. Приходите до заката — у церкви." # style:document # intensity:medium
        
        ~ gain_sanity(2)
    - else:
        ~ KeyEvents += serafim_kidnapped
        
        Утром вас будит стук. Клава. # style:action

        — Товарищ следователь! Отец Серафим... Его дом разгромлен! # speaker:klava
        
        Вы едете на место. Кровь на стене. Мебель перевёрнута. # style:atmosphere # intensity:high
        
        На столе — записка: "ПЕЩЕРЫ. ПОЛНОЛУНИЕ. НЕ ПРИХОДИ ИЛИ УМРЁШЬ." # style:document # intensity:high
        
        { Relationships ? helped_serafim:
            Он доверял вам. А теперь...
            
            -> lose_sanity_safe(7) ->
        - else:
            -> lose_sanity_safe(5) ->
        }
    }
- else:
    Вы слышите новости: старый священник на окраине пропал. Дом разгромлен. # style:atmosphere # intensity:medium
    
    Местные шепчутся: "Красный лес забрал". # style:atmosphere # intensity:high
    
    -> lose_sanity_safe(3) ->
}

// Вера в опасности (если встречали и доверяла)
{ MetCharacters ? vera && Relationships ? trusted_vera:
    ~ KeyEvents += vera_captured
    
    Звонок из больницы. Веры нет на работе. Её квартира — пуста. # style:dramatic # intensity:high
    
    Соседи видели людей в тёмном. Ночью. # style:atmosphere # intensity:high
    
    Она доверилась вам. И теперь — пропала. # style:thought # intensity:high
    
    -> lose_sanity_safe(5) ->
- else:
    { MetCharacters ? vera:
        ~ KeyEvents += vera_captured
        
        Говорят, доктор Холодова не вышла на работу. Её ищут. # style:atmosphere # intensity:medium
        
        -> lose_sanity_safe(2) ->
    - else:
        Из больницы пропала заведующая психиатрией. Вы её не знали. # style:atmosphere
    }
}

// Проверка на Фёдора
{ KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body):
    Фёдор. Он обещал провести вас в пещеры. Сегодня — последний шанс подготовиться. # style:thought # intensity:medium
}

{ KeyEvents ? found_fyodor_body:
    Фёдор мёртв. Из-за вас. # style:dramatic # intensity:high
    
    Теперь вы одни. # style:thought # intensity:high
}

Завтра — полнолуние. Они готовятся к ритуалу.

Последний день для подготовки.

-> episode4_morning

=== episode4_morning ===

# mood: tense

УТРО

{ days_remaining == 1:
    ПОСЛЕДНИЙ ДЕНЬ. Завтра — полнолуние. Ритуал.
    
    Времени почти не осталось.
}

{ time_of_day == 0:
    Утро — лучшее время для подготовки.
}

Что делать?

* { time_of_day <= 1 } [Искать союзников]
    -> episode4_allies

* { time_of_day <= 2 } [Собрать оружие]
    -> episode4_weapons

* [Изучить документы]
    -> episode4_documents

* { KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body) && time_of_day <= 1 } [Пойти к Фёдору — обсудить план]
    -> episode4_fyodor_plan

* { trust_gromov >= 35 && not (Relationships ? betrayed_gromov) && time_of_day == 0 } [Конфронтация с Громовым (только утром)]
    -> episode4_gromov_confrontation

// Серафим может благословить перед финалом
* { trust_serafim >= 40 && MetCharacters ? serafim && not (KeyEvents ? serafim_kidnapped) } [Попросить благословения у Серафима]
    -> episode4_serafim_blessing

=== episode4_serafim_blessing ===

// Новая механика — благословение Серафима

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Церковь на окраине. Серафим ждёт. # style:atmosphere

— Вы пришли. # speaker:serafim

— Завтра — ритуал. Я иду в пещеры. # speaker:sorokin

Он долго молчит. # style:action

— Я знаю. — Серафим встаёт. — Встаньте на колени. # speaker:serafim

Вы опускаетесь.

Он кладёт руки на вашу голову. Шепчет молитву.

Тепло. Странное ощущение. Голоса — тише.

~ gain_sanity(10)
~ trust_serafim = trust_serafim + 15

— Идите. — Серафим улыбается. — Свет с вами. Всегда. # speaker:serafim

{ sanity >= 60:
    Впервые за дни — ясность. Покой.
}

* [Спросить о том, кто ведёт ритуал]
    — Отец, вы знаете, кто стоит за всем этим? # speaker:sorokin
    
    Серафим замирает. Его глаза — тёмные, бездонные. # style:action
    
    — Есть один человек. — Голос — тихий. — Я знал его. Давно, когда ещё был геологом. # speaker:serafim
    
    — Кто он? # speaker:sorokin
    
    — Учёный. Академик. — Серафим отворачивается. — Он потерял жену. Это сломало его. Он начал искать способ... преодолеть границу между живыми и мёртвыми. # speaker:serafim
    
    // ФАЗА 1: Раннее раскрытие Чернова
    ~ understanding_chernov += 15
    
    — И нашёл? # speaker:sorokin
    
    — Нашёл Дверь. — Серафим качает головой. — Бедный человек. Он думает, что Те, Кто Ждёт — вернут ему любимую. Но они лгут. Они всегда лгут. # speaker:serafim # intensity:high
    
    ~ understanding_chernov += 5
    ~ boost_theory(5, 10)
    
    -> episode4_afternoon

* [Уйти в молчании]
    -> episode4_afternoon

=== episode4_fyodor_plan ===

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Сторожка Фёдора. Он ждёт. # style:atmosphere

— Завтра. # speaker:fyodor

— Знаю. # speaker:sorokin

— Вы готовы? # speaker:fyodor

* [Да]
    — Насколько можно быть готовым. # speaker:sorokin
    
    Фёдор кивает.
    
    -> ep4_fyodor_strategy

* [Нет]
    — Честно? Нет. # speaker:sorokin
    
    — Я тоже. Двадцать лет назад — не был готов. И сейчас — не уверен. # speaker:fyodor
    
    -> ep4_fyodor_strategy

=== ep4_fyodor_strategy ===

— Слушайте внимательно. — Фёдор разворачивает свою карту. # speaker:fyodor

— Вход через лес — здесь. — Он указывает точку. — Культисты не знают о нём. Думают, я забыл. # speaker:fyodor

— Дальше? # speaker:sorokin

— Три коридора. Левый — ловушки. Правый — тупик. Центральный — к алтарю. # speaker:fyodor

~ cult_awareness = cult_awareness + 2

— И ещё. — Он понижает голос. — Есть способ закрыть Дверь. Навсегда. # speaker:fyodor

* [Какой?]
    — Добровольная жертва. Тот, кто сам выберет смерть — закроет её. # speaker:fyodor # intensity:high
    
    — Вы... # speaker:sorokin
    
    — Я думал об этом. Двадцать лет думал. # speaker:fyodor # intensity:high
    
    ~ Relationships += fyodor_secret
    
    -> ep4_fyodor_end

* [Не хочу знать]
    — Потом. Сначала — выживем. # speaker:sorokin
    
    -> ep4_fyodor_end

=== ep4_fyodor_end ===

— Завтра. На закате. Здесь. # speaker:fyodor

Он протягивает руку. # style:action

— Удачи нам всем. # speaker:fyodor

~ gain_sanity(3)

-> episode4_afternoon

=== episode4_gromov_confrontation ===

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Вы идёте к Громову. Пора расставить точки над "i".

Кабинет. Он один. Бутылка на столе. # style:atmosphere

— Сорокин? Что... # speaker:gromov

— Я знаю. — Вы закрываете дверь. — Про культ. Про пещеры. Про Астахова. # speaker:sorokin

Громов бледнеет. # style:action # intensity:high

— Вы... откуда... # speaker:gromov

* [Показать улики]
    Вы выкладываете фотографии. Карту. Записи.
    
    — Этого достаточно, чтобы упрятать вас на двадцать лет. # speaker:sorokin
    
    -> ep4_gromov_react

* [Давить]
    ~ track_aggressive_action()  // РЕПУТАЦИЯ: давление на Громова
    — Неважно. Важно — что вы сделаете сейчас. # speaker:sorokin

    -> ep4_gromov_react

=== ep4_gromov_react ===

Громов смотрит на бутылку. Потом — на вас. # style:action

— Вы не понимаете. Они... они везде. Астахов. Завод. Партком. # speaker:gromov

— Мне нужна помощь. # speaker:sorokin

— Я... — Он колеблется. # speaker:gromov

* [Вы тоже жертва]
    ~ track_helpful_action()  // РЕПУТАЦИЯ: сочувствие и понимание
    — Степан Петрович. Вы не убийца. Вы — жертва. Как и все здесь. # speaker:sorokin
    
    Громов опускает голову. # style:action
    
    — Моя жена... она пропала в семьдесят восьмом. Они сказали — если расскажу... # speaker:gromov # intensity:high
    
    ~ trust_gromov = trust_gromov + 20
    
    // Добавляем улику только если ещё не нашли
    { not (CluesE ? gromov_confession):
        ~ CluesE += gromov_confession
        ~ sync_evidence_count()
    
        # clue
        Улика найдена: признание Громова
    }
    
    -> ep4_gromov_ally

* [Или вы с ними, или со мной]
    — Выбирайте. Культ — или закон. # speaker:sorokin
    
    Громов молчит. Долго. # style:action
    
    — Ладно. — Он достаёт ключ. — Оружейная. И... вот это. # speaker:gromov
    
    Папка. "ПРОЕКТ ЭХО — АРХИВ №7".
    
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesB ? access_pass):
        ~ CluesB += access_pass
        ~ sync_evidence_count()
    
        # clue
        Улика найдена: архив Громова
    }
    
    -> ep4_gromov_ally

=== ep4_gromov_ally ===

— Завтра — ритуал. Полнолуние. В пещерах. # speaker:sorokin

— Я знаю. — Громов встаёт. — Я... я пойду с вами. # speaker:gromov

— Вы уверены? # speaker:sorokin

— Двадцать лет я молчал. Хватит. # speaker:gromov # intensity:high

{ Relationships ? betrayed_gromov:
    ~ Relationships -= betrayed_gromov
}

// ТОЧКА НЕВОЗВРАТА: Громов становится союзником
~ gromov_is_ally = true
{ gromov_is_enemy:
    ~ gromov_is_enemy = false
}
~ trust_gromov = trust_gromov + 15

# point_of_no_return
Громов теперь ваш союзник. Он предаст культ ради искупления.

-> episode4_afternoon

=== episode4_allies ===

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Кому можно доверять в этом городе?

{ MetCharacters ? tanya:
    Таня. Она потеряла отца. Она хочет правды.
    
    * [Позвонить Тане]
        -> ep4_call_tanya
}

// Громов — только если не предал и доверие достаточное
{ trust_gromov >= 30 && not (Relationships ? betrayed_gromov):
    Громов. Слабый, но не злой.
    
    * [Пойти к Громову]
        -> ep4_gromov_help
}

// Если Громов предал — альтернатива
{ Relationships ? betrayed_gromov:
    Громов причастен к фальсификациям. Но может, его можно повернуть?
    
    * [Попробовать переубедить Громова]
        -> episode4_gromov_confrontation
}

* [Действовать в одиночку]
    Никому нельзя доверять.
    
    -> lose_sanity_safe(3) ->
    
    -> episode4_afternoon

=== ep4_call_tanya ===

— Таня. Завтра — всё решится. # speaker:sorokin

Пауза. Вы слышите её дыхание в трубке. # style:action # intensity:medium

— Я знаю. — Её голос тихий. — Папа там, да? # speaker:tanya

— Думаю, да. Живой. # speaker:sorokin

— Я иду с вами. # speaker:tanya

— Это опасно. # speaker:sorokin

— Виктор... — Она замолкает. Впервые назвала вас по имени. — Мне всё равно. Я хочу быть рядом. С вами. # speaker:tanya # intensity:high

~ trust_tanya = trust_tanya + 15

* [Согласиться]
    — Хорошо. Но делай, что скажу. # speaker:sorokin
    
    — Обещаю. # speaker:tanya
    
    Пауза. # style:action
    
    — Виктор? # speaker:tanya
    
    — Да? # speaker:sorokin
    
    — Спасибо. За всё. # speaker:tanya # intensity:high
    
    // ДОБАВЛЕНО: возможность романтики через телефонный разговор
    { trust_tanya >= 65:
        Что-то в её голосе... В этих словах.
        
        Вы понимаете — между вами есть связь. Глубже, чем просто расследование.
        
        ~ Relationships += romantic_tanya
    }
    
    -> episode4_afternoon

* [Отговорить]
    — Таня, ты — единственная, кто останется, если... если мы не вернёмся. Кто расскажет правду. # speaker:sorokin
    
    Долгая пауза. # style:action
    
    — Ладно. — Её голос дрожит. — Но вы вернётесь. Обещайте. # speaker:tanya # intensity:high
    
    — Обещаю. # speaker:sorokin
    
    ~ trust_tanya = trust_tanya + 5
    
    -> episode4_afternoon

=== ep4_gromov_help ===

Кабинет Громова. # style:atmosphere

— Сорокин? — Он удивлён. — Что... # speaker:gromov

— Мне нужна помощь. Завтра — ритуал. В пещерах. # speaker:sorokin

Громов бледнеет. # style:action

— Я... я не могу... # speaker:gromov

— Они похитили Серафима. И Веру. Зорин там. Завтра их убьют. # speaker:sorokin

Он долго молчит. # style:action # intensity:medium

— Вот. — Он достаёт ключ. — Оружейная. Возьмите, что нужно. # speaker:gromov

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesB ? access_pass):
    ~ CluesB += access_pass
    ~ sync_evidence_count()

    # clue
    Улика найдена: ключ от оружейной
}

— И, Сорокин... — Он смотрит в пол. — Простите меня. За всё. # speaker:gromov # intensity:high

~ trust_gromov = trust_gromov + 10

-> episode4_afternoon

=== episode4_weapons ===

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Вам нужно оружие.

{ CluesB ? access_pass:
    У вас есть ключ от оружейной.
    
    Ночью вы проникаете в отдел. Забираете пистолет Макарова, две запасные обоймы, нож, фонарик.
    
    ~ gain_sanity(5)
    
    Теперь — не безоружны.
    
    -> episode4_afternoon
}

У вас есть служебный пистолет. Восемь патронов.

* [Поискать что-то ещё]
    В гараже гостиницы — старый топор. Ржавый, но острый.
    
    В подвале — бензин. На всякий случай.
    
    ~ gain_sanity(2)
    
    -> episode4_afternoon

* [Хватит]
    -> episode4_afternoon

=== episode4_documents ===

~ actions_today = actions_today + 1
// Документы можно изучать в любое время
// ~ time_of_day = time_of_day + 1

Вы перечитываете всё, что нашли.

{ CluesB ? experiment_records:
    Проект "Эхо". Эксперименты над разумом.
    
    Они искали контакт с... чем-то. И нашли.
}

{ CluesC ? ritual_photos:
    Фотографии ритуалов. Жертвы.
    
    Каждое полнолуние — новая жертва. Уже двадцать лет.
}

{ CluesE ? fyodor_map:
    Карта Фёдора. Три коридора. Центральный — к алтарю.
}

{ CluesE ? vera_research:
    Исследования Веры. Одинаковые изменения в мозге.
    
    Это не галлюцинации. Это... воздействие.
}

{ CluesE ? gromov_confession:
    Признание Громова. Его жена пропала в семьдесят восьмом.
    
    Они шантажировали его двадцать лет.
}

// ФАЗА 1: Раннее раскрытие Чернова — анализ документов
{ CharacterSecrets ? chernov_wife:
    И ещё — фотография женщины. "Моей Леночке — навсегда. А.Ч."
    
    А.Ч. Академик Чернов. Руководитель проекта "Эхо". Вдовец.
    
    Вы перечитываете характеристику: "нездоровый интерес к результатам Фазы 3... упоминает о 'воссоединении'..."
    
    Он не хочет власти. Не хочет знаний. Он хочет вернуть мёртвую жену.
    
    И ради этого — готов на всё.
    
    ~ understanding_chernov += 10
    ~ boost_theory(5, 5)
}

~ gain_sanity(3)

{ count_all_clues() >= 10:
    Картина полная. Вы знаете всё, что нужно.
    
    Завтра — конец. Так или иначе.
}

-> episode4_afternoon

=== episode4_afternoon ===

# mood: dark

// time_of_day уже увеличивается в каждом действии
// Проверяем сколько времени прошло

ДЕНЬ # style:title # intensity:low

{ time_of_day >= 2:
    Вечереет. Времени на активные действия почти не осталось. # style:thought # intensity:medium
}

{ actions_today < 2:
    Ещё есть время на одно действие. # style:thought
    
    * { actions_today < 2 } [Продолжить подготовку]
        -> episode4_morning
}

* [Вернуться в гостиницу — завершить день]
    -> episode4_evening

=== episode4_evening ===

# mood: dark

~ time_of_day = 2

ВЕЧЕР # style:title # intensity:medium

Последний вечер перед полнолунием. # style:dramatic # intensity:high

{ trust_tanya >= 50:
    Таня приходит. # style:action

    // Прогрессия отношений с Таней — последний вечер
    -> see_tanya ->

    — Я не могу усидеть дома. # speaker:tanya
    
    Вы сидите вместе. Молча. # style:atmosphere # intensity:medium
    
    * [Взять её за руку]
        Она не отстраняется. Её ладонь — тёплая. # style:atmosphere # intensity:high
        
        — Мы найдём его. # speaker:sorokin
        
        — Я знаю. # speaker:tanya
        
        Она придвигается ближе. Её плечо касается вашего. # style:atmosphere # intensity:high
        
        — Виктор... — Её голос — шёпот. — Что бы ни случилось завтра... # speaker:tanya # intensity:high
        
        Она не заканчивает. Но вы понимаете. # style:dramatic # intensity:high
        
        // ИСПРАВЛЕНО: защита от дублирования флага романтики
        { not (Relationships ? romantic_tanya):
            ~ Relationships += romantic_tanya
        }
        ~ gain_sanity(5)
        
        -> ep4_night

    * [Оставаться профессионалом]
        — Вам лучше поспать. Завтра — тяжёлый день. # speaker:sorokin
        
        — Вы тоже. # speaker:tanya
        
        Она уходит. # style:action
        
        -> ep4_night
- else:
    Вы одни. Как обычно. # style:thought
    
    -> ep4_night
}

=== ep4_night ===

# mood: horror

НОЧЬ

Последняя ночь.

Вы лежите в темноте. Смотрите в потолок. Считаете трещины на штукатурке — старая привычка, оставшаяся с Афганистана.

Завтра — всё решится. Так или иначе.

// Ночь перед финалом — зависит от состояния рассудка
{ is_sane():
    Странно — но вы спокойны.
    
    Страх ушёл. Сомнения — тоже. Осталась только... ясность. Холодная, кристальная ясность.
    
    Вы знаете, что нужно делать. Знаете, чем рискуете. Знаете, что можете не вернуться.
    
    И это — нормально.
    
    Вы закрываете глаза. Дыхание — ровное, спокойное.
    
    Сон приходит быстро. Без снов. Без кошмаров.
    
    Просто темнота. Тишина. Покой.
    
    Завтра — конец. Вы готовы.
    
    ~ gain_sanity(3)
}

{ is_disturbed():
    Сон — прерывистый. Кошмары накатывают волнами.
    
    Красный лес. Алтарь, залитый кровью. Фигуры в капюшонах — их лица под тканью — ваши. Все — ваши.
    
    Вы просыпаетесь в поту. Два часа ночи.
    
    Снова засыпаете. Снова — кошмар.
    
    Зорин — на алтаре. Нож опускается. Кровь — чёрная, густая — течёт по камню.
    
    { Relationships ? romantic_tanya:
        Таня кричит. Вы бежите к ней. Но ноги — как в болоте. Медленно. Слишком медленно.
        
        Нож поднимается снова. Над ней.
    }
    
    Вы просыпаетесь с криком. Четыре утра.
    
    Больше не спите. Сидите на кровати. Смотрите в темноту.
    
    Ждёте рассвета.
    
    -> lose_sanity_safe(2) ->
}

{ is_mad():
    Ночь — бесконечная.
    
    Голоса — не прекращаются. Ни на секунду. Они здесь — в комнате, в голове, в воздухе.
    
    «...мы ждём тебя...»
    «...ты один из нас...»
    «...всегда был одним из нас...»
    
    Вы зажимаете уши. Бесполезно. Они — внутри.
    
    «...дверь открывается...»
    «...приди...»
    «...приди...»
    «...ПРИДИ...»
    
    Вы встаёте. Ходите по комнате. Из угла в угол. Как зверь в клетке.
    
    За окном — темнота. И где-то там — лес. Красный лес. Зовёт.
    
    Вы смотрите на окно. На ручку. # style:atmosphere # intensity:high
    
    Как легко было бы... просто открыть. Выйти. Пойти на голоса. # style:horror # intensity:high
    
    Нет. # style:dramatic # intensity:high
    
    Вы отворачиваетесь. Сжимаете кулаки. # style:action # intensity:high
    
    Не сегодня. Не так. # style:thought # intensity:high
    
    Грань между сном и явью — стёрта. Вы уже не знаете, спите или бодрствуете. Реально ли то, что видите, или это галлюцинация. # style:horror # intensity:high
    
    Единственное, что вы знаете точно: завтра — конец. # style:thought # intensity:high
    
    Так или иначе. # style:dramatic # intensity:high
    
    -> lose_sanity_safe(5) ->
}

... # style:atmosphere # intensity:low

За окном — первый свет. # style:atmosphere

Серый. Холодный. Рассвет. # style:atmosphere # intensity:medium

19 ноября 1986 года. # style:title # intensity:high

День полнолуния. # style:title # intensity:high

Последний день. # style:dramatic # intensity:high

Вы встаёте. Умываетесь. Одеваетесь. # style:action

Проверяете оружие. Патроны. Документы. # style:action # intensity:medium

В зеркале — лицо. Чужое. Знакомое. # style:atmosphere # intensity:high

Лицо человека, готового умереть. # style:dramatic # intensity:high

Или убить. # style:dramatic # intensity:high

КОНЕЦ ЭПИЗОДА 4 # style:title # intensity:medium

~ sync_evidence_count()

Ваш рассудок: {sanity}/100 # style:important
Дней осталось: {days_remaining} # style:important
Собрано улик: {count_all_clues()} # style:important

// СИСТЕМА РЕПУТАЦИИ: финальный итог перед развязкой
{ city_reputation <= -50:
    Репутация в городе: ВРАГ НАРОДА ({city_reputation}) # style:important
    Город против вас. Завтра вы будете один против всех.
}
{ city_reputation > -50 && city_reputation <= 0:
    Репутация в городе: ПОДОЗРИТЕЛЬНЫЙ ({city_reputation}) # style:important
    Мало кто готов помочь.
}
{ city_reputation > 0 && city_reputation <= 40:
    Репутация в городе: НЕЙТРАЛЬНАЯ ({city_reputation}) # style:important
    У вас есть шанс.
}
{ city_reputation > 40:
    Репутация в городе: СВОЙ ({city_reputation}) # style:important
    Город — на вашей стороне. Это может всё изменить.
}

// Итоговые слухи
{ Rumors ? rumor_hero:
    ★ О вас говорят как о герое. Люди готовы помочь.
}
{ Rumors ? rumor_crazy:
    ⚠ Вас считают сумасшедшим. Это усложнит финал.
}
{ Rumors ? rumor_cultist:
    ⚠ Вас подозревают в связях с культом. Опасно.
}

ЗАВТРА — ПОЛНОЛУНИЕ. # style:title # intensity:high

* [Продолжить...]
    ~ advance_day()
    -> episode5_intro

// ═══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 5: КРАСНЫЙ ЛЕС (ФИНАЛ)
// ═══════════════════════════════════════════════════════════════════════════════

=== episode5_intro ===

# chapter: 5
# mood: horror
# title: Красный лес

19 НОЯБРЯ 1986 ГОДА # style:title # intensity:high

Полнолуние # style:subtitle # intensity:high

~ advance_moon()
~ ritual_countdown = 0
~ knows_deadline = true

// ПОЛНОЛУНИЕ — кульминация лунного цикла
-> look_at_moon ->

... # style:atmosphere # intensity:low

Весь день — ожидание. # style:dramatic # intensity:high

// ОБЪЯСНЕНИЕ: почему культ не убил Сорокина раньше
{ infection_level >= 30:
    Вы понимаете теперь. Почему они не остановили вас. Почему не убили — хотя могли десять раз. # style:thought # intensity:high
    
    Вы — заражены. Вы — слышите голоса. Вы — ВИДИТЕ. # style:horror # intensity:high
    
    Они не охотились на вас. Они — ЖДАЛИ вас. Ждали, пока созреете.
    
    ~ sorokin_is_catalyst = true
}

{ not sorokin_is_catalyst:
    Почему они позволили вам дойти до конца? Почему не остановили раньше — когда было легко?
    
    Ответ приходит ночью. Во сне, который не совсем сон.
    
    Голос — древний, как камни под землёй:
    
    «...свидетель нужен... тот, кто увидит и расскажет... или тот, кто увидит и останется навсегда...»
    
    Ритуал требует не только жертв. Он требует — наблюдателя. Того, кто свяжет два мира своим взглядом.
    
    Вы — этот наблюдатель.
    
    ~ cult_needs_sorokin = true
}

Вы сидите в номере. Смотрите в окно. Город живёт своей жизнью — люди идут на работу, дети бегут в школу, дым поднимается из труб.

Никто не знает. Никто не подозревает.

А может — все знают. Все — часть этого. И только вы — чужой.

{ sanity < 30:
    Голоса молчат.
    
    Впервые за дни. Полная, абсолютная тишина в голове.
    
    Это должно успокаивать. Но — не успокаивает.
    
    Тишина перед бурей. Затишье перед грозой.
    
    Они ждут. Они знают, что вы придёте.
}

{ KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body):
    Фёдор прислал записку. Под дверью — клочок бумаги, написанный дрожащей рукой:
    
    "Закат. Сторожка. Не опаздывай."
}

{ Relationships ? romantic_tanya:
    Таня звонит в обед. # style:action

    — Я иду с вами. # speaker:tanya

    — Таня... # speaker:sorokin

    — Это мой отец. Моя семья. Моё право. # speaker:tanya

    Вы не спорите. У неё есть право. Больше, чем у вас. # style:thought
}

Часы тянутся. Медленно. Мучительно.

Три часа дня. Четыре. Пять.

За окном — солнце садится. Красное, огромное. Опускается за верхушки сосен.

Небо — алое. Как кровь. Как огонь.

Шесть часов вечера.

Пора.

Вы встаёте. Надеваете пальто. Проверяете оружие — пистолет, нож, фонарик.

Выходите.

Ночью — ритуал. Ночью — всё решится.

* [Идти в пещеры]
    -> episode5_caves

=== episode5_caves ===

# mood: horror

// HORROR: Финальная ночь — лес
~ time_of_day = 3
~ set_location(1)

Лес.

Тот самый. Красный лес.

Закат окрашивает сосны в багровый цвет — их кора, их хвоя, даже снег под ногами — всё красное.

Кровь леса.

// HORROR: Интенсивные события в финале
-> check_for_horror_event ->

{ KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body):
    Фёдор ждёт у своей сторожки. Старый, сгорбленный, но в глазах — решимость.
    
    — Вы пришли. — Он кивает. — Хорошо. Идём. Знаю короткий путь. # speaker:fyodor
}

{ Relationships ? romantic_tanya:
    // Прогрессия отношений с Таней — финальная миссия
    -> see_tanya ->

    Таня — рядом. Бледная, но решительная. В руке — фонарик. Под пальто — что-то угловатое. Оружие?

    — Я готова, — говорит она. Голос не дрожит. # speaker:tanya

    — Держись рядом. Не отставай. # speaker:sorokin

    — Обещаю. # speaker:tanya
}

Вы входите в лес.

Темнота смыкается мгновенно. Закат — за спиной, за стеной деревьев. Здесь — только тени.

Фонарик — слабый. Луч выхватывает стволы сосен, ветки, корни. Снег под ногами скрипит.

И — тишина. Абсолютная. Ни ветра, ни птиц, ни зверей.

Только ваши шаги. И где-то вдалеке — еле слышно — голоса. Пение.

Вход в пещеры — впереди. Тёмный провал в склоне холма.

И — красный свет. Изнутри. Пульсирующий. Как сердцебиение.

{ sanity < 40:
    Голоса — здесь. Снова. Яснее, чем когда-либо.
    
    «...добро пожаловать домой...»
    
    -> lose_sanity_safe(2) ->
}

* [Спуститься]
    Вы делаете глубокий вдох. Последний вдох перед...
    
    Неважно.
    
    — Идём. # speaker:sorokin
    
    -> episode5_ritual

=== episode5_ritual ===

~ KeyEvents += witnessed_ritual
~ MetCharacters += chernov

# mood: horror

// Дверь — на грани открытия. Полнолуние. Ритуал.
-> sense_the_door ->

Пещера.

Огромная. Больше, чем вы помнили. Больше, чем показалось в первый раз.

Свод — теряется во тьме, так высоко, что свет факелов не достигает его. Стены — покрыты символами, древними и новыми, красными и чёрными.

И люди.

Десятки людей. Может — сотня. Стоят кругом, вокруг алтаря. В капюшонах — чёрных, тяжёлых. Лиц не видно. Только тени под тканью.

Они поют.

Низкий, протяжный гул. Без слов — только звук. Он вибрирует в костях, резонирует в черепе.

Вы узнаёте его. Это — те самые голоса. Которые преследовали вас с первого дня.

В центре круга — алтарь. Огромный камень, чёрный как ночь. На нём — свечи. Десятки свечей. Их пламя — красное, неестественное.

И над алтарём — что-то.

Тень. Форма. Или просто... сгущение темноты. Вы не уверены.

Но оно — там. Ждёт.

// Астахов здесь — и если вы его разозлили, он настороже
{ trust_astahov < -5:
    Вы замечаете — у входа, в тени — знакомый силуэт.
    
    Астахов. Серый костюм, пустые глаза.
    
    Он смотрит прямо на вас. Улыбается.
    
    Он знал. Он ждал.
    
    Это ловушка?
    
    -> lose_sanity_safe(3) ->
}

На алтаре — связанные фигуры. Три человека. Жертвы.

// Описание жертв зависит от того, кого игрок встретил
{ MetCharacters ? serafim && MetCharacters ? vera:
    Первый — Серафим. Старик в рясе, связанный, с кляпом во рту. Его глаза — открыты, смотрят в потолок. Губы шевелятся — молитва?
    
    Вторая — Вера. Белый халат изодран, лицо — в синяках. Но она в сознании. Её глаза — находят вас. Узнают.
    
    Третий — мужчина. Средних лет, осунувшийся, с бородой. Вы не видели его раньше, но знаете — это Зорин. Алексей Павлович Зорин. Три недели в плену.
- else:
    { MetCharacters ? serafim:
        Серафим — на алтаре. И рядом — женщина в белом халате (врач?), и мужчина — Зорин?
    - else:
        { MetCharacters ? vera:
            Вера — на алтаре. И старик в рясе (священник?), и мужчина — Зорин?
        - else:
            Три фигуры на алтаре. Старик в рясе. Женщина в белом халате. И мужчина — Зорин?
        }
    }
}

Три жертвы. Для трёх жертв.

{ Relationships ? romantic_tanya:
    Таня — рядом с вами — видит.
    
    — Папа! — Её голос — крик, вскрик, вырывающийся прежде, чем она успевает подумать. # speaker:tanya # intensity:high
    
    Фигуры в капюшонах — поворачиваются. Все одновременно. Как один организм.
    
    Вас заметили.
}

// Объяснение: Зорин был пленником культа 3 недели
~ KeyEvents += zorin_found

Зорин жив. Его держали для ритуала.

Голос у алтаря: # style:dramatic # intensity:high

— Братья и сёстры. Час настал. # speaker:chernov # style:dramatic # intensity:high

Чернов. Высокий, в белом. Но теперь — в свете факелов — вы видите его по-настоящему. # style:action

Старик. Очень старый. Волосы — седые, почти белые. Лицо — изрезанное морщинами, как кора старого дерева. Но глаза...

Глаза — молодые. Горящие. Безумные.

Или — наоборот — слишком разумные. Слишком понимающие.

— Дверь откроется. Те, Кто Ждёт — примут нас. # speaker:chernov # style:dramatic

{ understanding_chernov >= 20:
    Вы замечаете — на его шее, под воротом белой мантии — медальон. Маленький, серебряный. С женским портретом?
    
    Он прячет что-то. Что-то человеческое — под всей этой мантией безумия.
}

* [Вмешаться]
    -> episode5_final_fight

* [Ждать момента]
    -> episode5_watch_ritual

* { understanding_chernov >= 10 || lore_depth >= 5 } [Заговорить с Черновым]
    Вы выходите из тени. Медленно. Руки — подняты.
    
    — Чернов! # speaker:sorokin # style:action
    
    Пение обрывается. Сотня голов — поворачивается к вам. Сотня пар глаз — в тени капюшонов — смотрят.
    
    Чернов — единственный, кто не удивлён.
    
    — А, следователь Сорокин. — Его голос — спокойный, почти дружелюбный. — Я ждал вас. Они сказали — вы придёте. # speaker:chernov
    
    — Кто сказал? # speaker:sorokin
    
    — Те, Кто Ждёт. — Он улыбается. — Они знают всё. Видят всё. И они хотят... поговорить с вами. # speaker:chernov
    
    -> episode5_chernov_talk

=== episode5_chernov_talk ===

# mood: revelation

Чернов спускается с алтаря. Медленно. Его белая мантия шуршит по камням.

Культисты расступаются. Освобождают проход.

Он останавливается в трёх шагах от вас. Смотрит.

— Вы задаёте вопросы уже пять дней. — Его голос — мягкий, почти отеческий. — Но главный вопрос — так и не задали. # speaker:chernov

— Какой? # speaker:sorokin

— "Почему?" # speaker:chernov

Он разводит руками.

— Почему я — академик, учёный, лауреат Государственной премии — посвятил жизнь... этому? — Он оглядывает пещеру. Алтарь. Жертвы. — Почему не уехал, когда мог? Не закрыл проект? Не похоронил всё под бетоном? # speaker:chernov

* [Почему?]
    — Хорошо. Почему? # speaker:sorokin
    
    Чернов улыбается. Грустно.
    
    — Потому что они обещали мне кое-что. Кое-что, чего не может дать никакая наука. # speaker:chernov
    
    -> episode5_chernov_wife

* [Вы безумны]
    — Потому что вы сумасшедший. # speaker:sorokin
    
    — Возможно. — Он кивает. — Но позвольте рассказать историю. Потом — решайте сами. # speaker:chernov
    
    -> episode5_chernov_wife

* [Мне плевать. Освободите заложников]
    — Меня не интересуют ваши мотивы. Освободите этих людей. # speaker:sorokin
    
    — Нет. — Чернов качает головой. — Но я хочу, чтобы вы поняли. Перед концом. Чтобы знали — за что умираете. # speaker:chernov
    
    -> episode5_chernov_wife

=== episode5_chernov_wife ===

# mood: emotional

Чернов достаёт медальон из-под мантии. Открывает. Показывает вам.

Фотография. Молодая женщина. Тёмные волосы, большие глаза, улыбка.

— Марина. Моя жена. # speaker:chernov

~ CharacterSecrets += chernov_wife
~ understanding_chernov += 25

Его голос — меняется. Теплеет. Человечность — проступает сквозь маску жреца.

— Мы познакомились в Москве. Пятьдесят второй год. Я — молодой физик, она — студентка консерватории. Пианистка. Талантливая. Красивая. Живая. # speaker:chernov

Он замолкает. Смотрит на фотографию.

— Мы поженились через год. Были счастливы. По-настоящему счастливы. Два года. # speaker:chernov

— Что случилось? # speaker:sorokin

— Рак. — Короткое слово. Как приговор. — Лейкемия. Ей было двадцать шесть. Врачи сказали — полгода. Максимум. # speaker:chernov

* [Мне жаль]
    — Мне жаль. # speaker:sorokin
    
    — Не надо. — Он качает головой. — Это было тридцать два года назад. Я... научился жить с этим. # speaker:chernov
    
    -> episode5_chernov_experiment

* [Какое это имеет отношение к культу?]
    -> episode5_chernov_experiment

=== episode5_chernov_experiment ===

# mood: dark

— В пятьдесят четвёртом меня направили сюда. "Проект Эхо". Исследование аномалии под Уралом. # speaker:chernov

Чернов оглядывает пещеру.

— Мы нашли... это. Пещеры. Символы. И — Дверь. Мы не понимали, что это. Думали — природное явление. Или... или что-то древнее. Доисторическое. # speaker:chernov

Он усмехается.

— Мы ошибались. # speaker:chernov

~ CharacterSecrets += chernov_experiment
~ understanding_chernov += 20
~ CultLore += lore_project_echo_start
~ lore_depth += 3

— Когда мы впервые активировали резонатор... — Он замолкает. — Я услышал голос. Не снаружи — внутри. В голове. # speaker:chernov

— Что он сказал? # speaker:sorokin

— "Мы можем вернуть её." # speaker:chernov

Пауза.

— Её. Марину. Голос знал. Знал о моей боли. О моей потере. И обещал... обещал вернуть. # speaker:chernov

{ sanity < 50:
    «...мы не лжём...»
    «...мы даём...»
    «...за цену...»
    
    -> lose_sanity_safe(3) ->
}

* [И вы поверили?]
    — И вы поверили? # speaker:sorokin
    
    — Нет. Сначала — нет. Я был учёным. Скептиком. Я думал — галлюцинация. Стресс. Переутомление. # speaker:chernov
    
    -> episode5_chernov_truth

* [Какова цена?]
    — Какую цену они потребовали? # speaker:sorokin
    
    Чернов смотрит на алтарь. На связанные фигуры.
    
    — Вы уже знаете ответ. # speaker:chernov
    
    -> episode5_chernov_truth

=== episode5_chernov_truth ===

# mood: horror

— Они показали мне. — Чернов подходит ближе. Его глаза — горят. — В шестьдесят шестом. Когда Дверь открылась в первый раз. # speaker:chernov

Он указывает на Дверь — тёмный провал в стене пещеры, пульсирующий красным светом.

— Я видел ЕЁ. Марину. Там. За Дверью. Она ждала меня. Звала. Протягивала руки. # speaker:chernov

~ CharacterSecrets += chernov_humanity
~ EmotionalScenes += scene_chernov_memory

— Она была... такой же. Молодой. Красивой. Живой. Как будто никогда не умирала. # speaker:chernov

{ sanity < 40:
    Вы видите — за спиной Чернова — тень. Женский силуэт. Протянутые руки.
    
    Галлюцинация?
    
    Или...
    
    -> lose_sanity_safe(5) ->
}

— Они сказали — она вернётся. Когда Дверь откроется полностью. Когда будет достаточно... энергии. # speaker:chernov

— Жертв. # speaker:sorokin

— Да. — Он кивает. Без раскаяния. — Жертв. Сначала — добровольцев. Потом... не совсем добровольцев. # speaker:chernov

— Вы убили десятки людей. # speaker:sorokin

— Я спасу её. — Его голос — как сталь. — Я верну её. После тридцати двух лет ожидания. Сегодня. Этой ночью. # speaker:chernov

Он поворачивается к алтарю.

— И никто — слышите? — НИКТО — мне не помешает. # speaker:chernov

* [Вы ошибаетесь — она не вернётся]
    — Чернов. — Вы говорите спокойно. — То, что вы видели — не ваша жена. Это приманка. Иллюзия. ОНО использует вас. # speaker:sorokin
    
    Чернов замирает. На мгновение — только на мгновение — в его глазах мелькает сомнение.
    
    — Нет. # speaker:chernov
    
    — Тридцать два года. Сотни жертв. И она всё ещё там. Почему? Если они могут вернуть её — почему не вернули? # speaker:sorokin
    
    Молчание. Чернов стоит неподвижно.
    
    — Потому что им не нужна она. Им нужны ВЫ. Ваша вера. Ваша боль. Ваши жертвы. # speaker:sorokin
    
    ~ trust_vera += 5
    
    -> episode5_final_fight

* [Она бы не хотела этого]
    — Марина. — Вы произносите имя мягко. — Ваша жена. Пианистка. Она бы хотела, чтобы вы убивали невинных людей ради неё? # speaker:sorokin
    
    Чернов вздрагивает. Как от удара.
    
    — Замолчите. # speaker:chernov
    
    — Она любила музыку. Красоту. Жизнь. А вы превратили её память в... в ЭТО. # speaker:sorokin # intensity:high
    
    Его рука — дрожит. Медальон выскальзывает. Падает на камни. Раскрывается.
    
    Фотография — смотрит вверх. Улыбается.
    
    — Замолчите! — Его голос — крик. — Вы не понимаете! Вы ничего не понимаете! # speaker:chernov # intensity:high
    
    ~ CharacterSecrets += chernov_humanity
    
    -> episode5_final_fight

* [Атаковать, пока отвлечён]
    -> episode5_final_fight

=== episode5_watch_ritual ===

// Описание жертвы зависит от знакомства
{ MetCharacters ? serafim:
    Нож поднимается над Серафимом.
- else:
    Нож поднимается над стариком в рясе.
}

Вы не двигаетесь.

Удар.

{ MetCharacters ? serafim:
    ~ trust_serafim = 0
}
-> lose_sanity_safe(10) ->

{ MetCharacters ? serafim:
    Серафим мёртв.
- else:
    Старик мёртв. Первая жертва.
}

{ sanity < 30:
    И — НЕЧТО. Появляется.
    
    Над алтарём. Тёмное. Без формы.
    
    «...ДА... БОЛЬШЕ...»
}

— Вторая жертва! # speaker:chernov # style:dramatic # intensity:high

{ MetCharacters ? vera:
    Чернов поворачивается к Вере.
- else:
    Чернов поворачивается к женщине в белом халате.
}

* [СЕЙЧАС!]
    -> episode5_final_fight

=== episode5_final_fight ===

~ KeyEvents += confronted_cult

— СТОЙ! # speaker:sorokin # style:action # intensity:high

Вы бросаетесь вперёд. # style:action

// Астахов — дополнительный противник если вы его разозлили
{ trust_astahov < -5:
    Астахов перехватывает вас!
    
    — Я знал, что вы придёте, Сорокин. # speaker:chernov
    
    Борьба. Короткая, жестокая.
    
    { sanity >= 50:
        Вы сильнее. Астахов падает.
    - else:
        Он сильнее. Удар в голову. Всё плывёт.
        
        -> lose_sanity_safe(10) ->
    }
}

Хаос. Крики.

{ Relationships ? romantic_tanya:
    Таня — к отцу. Режет верёвки.
}

Чернов стоит у алтаря. Спокойный. # style:action # intensity:high

— Следователь Сорокин. Я ждал вас. # speaker:chernov

{ sanity < 30:
    НЕЧТО смотрит на вас.
    
    «...ЖЕРТВА... ТЫ...»
}

* [Атаковать Чернова]
    -> episode5_kill_chernov

* [Освободить пленников]
    -> episode5_free_prisoners

* [Закрыть Дверь]
    -> episode5_close_door

=== episode5_kill_chernov ===

Вы хватаете нож.

Чернов улыбается. # style:action

— Это ничего не изменит. # speaker:chernov

Удар. # style:action # intensity:high

Он падает.

{ sanity < 40:
    Но НЕЧТО — не исчезает.
    
    «...СМЕРТЬ ОТКРЫВАЕТ...»
}

-> episode5_endings

=== episode5_free_prisoners ===

Вы бросаетесь к алтарю. Режете верёвки.

{ trust_vera >= 30:
    Вера — свободна.
    ~ Relationships += trusted_vera
}

{ Relationships ? romantic_tanya:
    Таня освобождает отца. Зорин жив.
}

-> episode5_endings

=== episode5_close_door ===

{ trust_vera >= 40:
    — Как закрыть Дверь?! # speaker:sorokin # style:action # intensity:high
    
    Вера: — Алтарь! Уничтожь алтарь!
}

{ sanity < 30:
    НЕЧТО говорит:
    
    «...ЖЕРТВА ЗАКРЫВАЕТ... ДОБРОВОЛЬНАЯ ЖЕРТВА...»
    
    Вы понимаете.
}

-> episode5_endings

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА КОНЦОВОК — ИСПРАВЛЕННАЯ ЛОГИКА С ВЫБОРОМ
// ═══════════════════════════════════════════════════════════════════════════════

=== episode5_endings ===

# mood: crossroads

// Сброс и подсчёт доступных концовок
~ available_endings = 0

// Правда: достаточно улик (снижено до 6 для реалистичности) И рассудок в норме
{ count_all_clues() >= 6 && sanity >= 40:
    ~ available_endings = available_endings + 1
}

{ sanity >= 40:
    ~ available_endings = available_endings + 1
}

// Жертва: низкий рассудок ИЛИ (высокая осведомлённость И средний рассудок)
// ИСПРАВЛЕНО: добавлено условие на рассудок при высокой осведомлённости
{ sanity < 40 || (cult_awareness >= 15 && sanity < 60):
    ~ available_endings = available_endings + 1
}

// Перерождение: высокая осведомлённость о культе И низкий рассудок
{ cult_awareness >= 10 && sanity < 50:
    ~ available_endings = available_endings + 1
}

{ trust_tanya >= 60:
    ~ available_endings = available_endings + 1
}

// ГЛАВНОЕ ИСПРАВЛЕНИЕ: Даём игроку ВЫБОР между доступными концовками

Всё замирает.

Момент истины.

// ═══════════════════════════════════════════════════════════════════════════════
// МОРАЛЬНЫЕ ДИЛЕММЫ — ФИНАЛЬНЫЙ ВЫБОР
// ═══════════════════════════════════════════════════════════════════════════════

// Дилемма 1: Правда vs Молчание
{ count_all_clues() >= 6 && sanity >= 40:
    У вас — доказательства. Достаточно, чтобы разрушить культ. Раскрыть правду.
    
    Но правда... Кто поверит? И если поверят — что это изменит?
    
    Люди узнают, что под землёй — НЕЧТО. Что оно реально. Что оно ждёт.
    
    Это — знание, которое может сломать мир.
}

// Дилемма 2: Спасти Таню vs Остановить ритуал
{ Relationships ? romantic_tanya && tanya_danger_level >= 2:
    Таня.
    
    Она в опасности. Если вы пойдёте закрывать Дверь — она может погибнуть. Если спасёте её — Дверь может открыться навсегда.
    
    Выбор.
}

// Дилемма 3: Чернов — убить или спасти?
{ understanding_chernov >= 30:
    Чернов.
    
    Вы знаете теперь его историю. Жена. Болезнь. Отчаяние. Он не монстр — он сломленный человек, который зашёл слишком далеко.
    
    Может ли он быть спасён? Заслуживает ли прощения?
    
    Или некоторые грехи — непростительны?
}

// Дилемма 4: Самопожертвование
{ sanity < 40 && cult_awareness >= 15:
    Голоса говорят правду. Вы знаете.
    
    Дверь можно закрыть. Навсегда. Но цена — добровольная жертва. Тот, кто ЗНАЕТ и ПРИНИМАЕТ.
    
    Вы — единственный, кто подходит. Единственный, кто понимает.
    
    Это — выход. Спасение для всех.
    
    Кроме вас.
}

Что вы выбираете?

// Условные выборы — МОРАЛЬНЫЕ ДИЛЕММЫ

// ═══════════════════════════════════════════════════════════════════════════════
// УСЛОВНЫЕ ВЫБОРЫ — ИСПРАВЛЕННАЯ ЛОГИКА (v2.0)
// ═══════════════════════════════════════════════════════════════════════════════
// Каждый выбор имеет уникальное условие. Fallback имеет условие-исключение.

* { count_all_clues() >= 6 && sanity >= 40 } [Раскрыть правду миру — пусть все узнают]
    ~ MoralChoices += revealed_truth
    ~ humanity = humanity + 10
    ~ trigger_haptic("dramatic_choice")
    -> ending_truth

* { sanity >= 40 && count_all_clues() < 6 } [Уничтожить культ и молчать — улик недостаточно для правды]
    ~ MoralChoices += buried_truth
    ~ humanity = humanity - 5
    ~ trigger_haptic("dramatic_choice")
    -> ending_hero

* { sanity < 40 || cult_awareness >= 15 } [Пожертвовать собой — закрыть Дверь навсегда]
    ~ MoralChoices += sacrificed_self
    ~ humanity = humanity + 25
    ~ trigger_haptic("sacrifice_moment")
    -> ending_sacrifice

* { cult_awareness >= 10 && sanity < 50 } [Принять предложение Чернова — возможно, он прав]
    ~ trigger_haptic("dark_choice")
    -> ending_rebirth

// Романтическая концовка с Таней — недоступна если она была ранена
* { trust_tanya >= 60 && Relationships ? romantic_tanya && not tanya_was_injured } [Спасти Таню — она важнее мира]
    ~ MoralChoices += saved_tanya_over_ritual
    ~ humanity = humanity - 10
    ~ trigger_haptic("romantic_escape")
    -> ending_escape

// Нейтральный побег — если Таня ранена или нет романтики, но есть доверие
* { trust_tanya >= 60 && (not (Relationships ? romantic_tanya) || tanya_was_injured) } [Бежать — вы сделали достаточно]
    ~ MoralChoices += escaped_alone
    ~ humanity = humanity - 15
    ~ trigger_haptic("escape_moment")
    -> ending_escape

* { understanding_chernov >= 40 } [Попытаться спасти Чернова — он тоже жертва]
    ~ MoralChoices += spared_chernov
    ~ humanity = humanity + 20
    ~ trigger_haptic("redemption_moment")
    -> ending_chernov_redemption

// СЕКРЕТНАЯ КОНЦОВКА: Фёдор закрывает Дверь
* { Relationships ? fyodor_secret && KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body) } [Позволить Фёдору закончить это — его грех, его искупление]
    ~ trigger_haptic("secret_ending")
    -> ending_fyodor_sacrifice

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK — Показывается ТОЛЬКО если ни одно условие выше не выполнено
// ═══════════════════════════════════════════════════════════════════════════════
// Условие: НЕ достаточно улик, НЕ низкий рассудок, НЕ высокое доверие Тани,
// НЕ высокое понимание Чернова, НЕТ секрета Фёдора
* { count_all_clues() < 6 && sanity >= 40 && sanity >= 50 && trust_tanya < 60 && understanding_chernov < 40 && cult_awareness < 10 } [Сражаться до конца — другого пути нет]
    // Герой по умолчанию — когда игрок не собрал ни улик, ни союзников
    ~ MoralChoices += buried_truth
    ~ humanity = humanity + 5
    ~ trigger_haptic("hero_stance")
    -> ending_hero

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 1: ПРАВДА НАРУЖУ
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_truth ===

# mood: hope
# ending: truth

КОНЦОВКА: ПРАВДА НАРУЖУ

...

Вы выживаете.

Как — не помните. Обрывки: бег по коридорам, крики, кровь на руках (чужая? своя?), свет в конце туннеля (буквально — рассвет над лесом).

Вы выползаете из пещер на рассвете. Один? С кем-то? Не уверены.

В карманах — доказательства. Фотографии, документы, записи. Всё, что собрали за эти пять дней.

Достаточно, чтобы похоронить культ. Навсегда.

...

Следующие недели — как в тумане.

Вы пишете отчёт. Полный. Честный. Всё, что видели, всё, что слышали, всё, что пережили.

Культ. Эксперименты. Жертвоприношения. Дверь.

Правда — чёрным по белому — на двухстах страницах машинописного текста.

Отчёт уходит в Москву. В прокуратуру. В КГБ. Везде.

Культ разгромлен. Арестованы двадцать три человека. Пещеры засыпаны бетоном. Завод "Прометей" — закрыт на "реконструкцию".

Вы думаете — победа.

...

Через неделю — психиатрическая комиссия.

"Товарищ Сорокин демонстрирует признаки острого переутомления... Галлюцинации... Бред преследования..."

Вас отстраняют. От работы. От дела. От правды.

Ваш отчёт — засекречен. "Для служебного пользования". Что означает — никто никогда не прочитает.

Официальная версия: секта убийц, ликвидирована органами правопорядка. Никакой мистики. Никаких древних сущностей.

Культ уничтожен. Но правда — похоронена вместе с ним.

...

Вы возвращаетесь в Свердловск. В пустую квартиру. К пустой жизни.

Иногда ночью — просыпаетесь от собственного крика. Сны всё те же: красный лес, алтарь, голоса.

«...мы ждём...»
«...Дверь закрыта, но не заперта...»
«...ты вернёшься... они все возвращаются...»

Вы знаете правду. Это — и проклятие, и благословение.

Дверь закрыта. Но не навсегда. Не навсегда.

Где-то в пещерах — под тоннами бетона — что-то ждёт. Терпеливо. Вечно.

И однажды — кто-то откопает.

КОНЕЦ

-> END

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 2: ТИХИЙ ГЕРОЙ
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_hero ===

# mood: mystery
# ending: hero

КОНЦОВКА: ТИХИЙ ГЕРОЙ

Вы выживаете.

Культ уничтожен. Чернов мёртв. Пещеры запечатаны.

Но вы молчите. О том, что видели.

В отчёте — "секта убийц, ликвидирована". Ничего сверхъестественного.

Вас награждают. Тихо.

{ Relationships ? romantic_tanya:
    Таня — с вами. Единственный человек, который знает правду.
    
    Вы не говорите об этом. Никогда.
}

Но ночью... ночью вы помните.

Красный лес. Голоса. Дверь.

Она закрыта. Но не навсегда.

КОНЕЦ

-> END

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 3: ЖЕРТВА
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_sacrifice ===

# mood: dark
# ending: sacrifice

КОНЦОВКА: ЖЕРТВА

...

Вы понимаете.

Внезапно. Ясно. Как вспышка молнии в ночи.

Дверь не закроется сама. Её нельзя запечатать бетоном или взрывчаткой. Нельзя забыть или проигнорировать.

Дверь закрывается только одним способом.

Добровольная жертва.

Тот, кто сам выберет смерть — закроет её. Навсегда.

Вы делаете шаг к алтарю. Медленно. Уверенно.

{ Relationships ? romantic_tanya:
    — Нет! — Таня хватает вас за руку. Её пальцы — как железо. — Виктор, нет! Не надо! # speaker:tanya # intensity:high
    
    Вы поворачиваетесь. Смотрите ей в глаза.
    
    — Таня. Забери отца. Уходи. # speaker:sorokin
    
    — Я не... # speaker:tanya
    
    — УХОДИ! # speaker:sorokin # intensity:high
    
    Она отступает. В её глазах — слёзы. Понимание. Ужас.
    
    — Обещай мне. — Ваш голос — мягкий, как тогда, когда вы держали её за руку. — Живи. Будь счастлива. Забудь. # speaker:sorokin # intensity:high
    
    Она качает головой. Не может говорить.
    
    — Обещай. # speaker:sorokin
    
    — О-обещаю... # speaker:tanya # intensity:high
}

Вы подходите к алтарю. На камне — засохшая кровь. Сотни жертв. Тысячи лет.

Последняя жертва.

Вы берёте нож. Лезвие — холодное, тяжёлое.

{ sanity < 20:
    НЕЧТО над алтарём — вздрагивает. Сжимается.
    
    «...НЕТ!...»
    
    Голос — уже не шёпот. Крик. Вопль.
    
    «...ОСТАНОВИСЬ!... ТЫ НЕ МОЖЕШЬ!...»
    
    Оно боится.
    
    Впервые за тысячи лет — оно боится.
    
    И вы — улыбаетесь.
}

Один удар.

Боль — короткая, острая. Потом — тепло. Потом — ничего.

Вы падаете. На алтарь. На камень, который пил кровь тысячи лет.

Но эта кровь — последняя.

Добровольная жертва.

Дверь — закрывается. Вы чувствуете это. Слышите. Грохот — как обвал. Как конец мира.

НЕЧТО — кричит. Визжит. Исчезает.

С последним вздохом — вы улыбаетесь.

Всё закончилось. Навсегда.

{ Relationships ? romantic_tanya:
    ...
    
    Таня держит вас. Вы чувствуете её слёзы — тёплые, падающие на лицо.
    
    — Держись... — Её голос — далёкий, как эхо. — Виктор, держись... # speaker:tanya # intensity:high
    
    — Всё хорошо. — Вы не уверены, говорите ли вслух. — Всё закончилось. # speaker:sorokin
    
    Темнота.
    
    Тишина.
    
    И где-то — очень далеко — свет.
}

...

ЭПИЛОГ

{ Relationships ? romantic_tanya:
    Таня выносит вас из пещер.
    
    Вы ещё дышите. Еле-еле. На грани.
    
    Скорая. Больница. Операция.
    
    Три недели в коме.
    
    Вы выживаете.
    
    Чудо? Или...
    
    Неважно.
    
    Дверь закрыта. Навсегда. Вы это знаете — потому что голоса молчат. Впервые в жизни — полная, абсолютная тишина.
    
    Таня ждёт. Каждый день — у вашей кровати.
    
    Когда вы открываете глаза — она плачет. И смеётся.
    
    — Ты обещал вернуться, — говорит она. # speaker:tanya
    
    — Обещал. # speaker:sorokin
    
    КОНЕЦ
- else:
    Вас находят утром. На алтаре. С улыбкой на лице.
    
    Мёртвого.
    
    Но пещеры — засыпаны. Культ — уничтожен. Дверь — закрыта.
    
    Навсегда.
    
    Вы спасли их всех. Город. Страну. Мир.
    
    Никто не узнает. Никто не вспомнит.
    
    Но это — неважно.
    
    Покой.
    
    Наконец-то — покой.
    
    КОНЕЦ
}

-> END

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 4: ПЕРЕРОЖДЕНИЕ
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_rebirth ===

# mood: horror
# ending: rebirth

КОНЦОВКА: ПЕРЕРОЖДЕНИЕ

Вы принимаете.

НЕЧТО входит. В вас. Через вас.

Знание. Бесконечное. Века. Тысячелетия.

Они были здесь всегда. Ждали.

И теперь — вы часть этого.

Дверь — открыта. Навсегда.

{ Relationships ? romantic_tanya:
    Таня бежит. С отцом.
    
    Вы смотрите им вслед. Без эмоций.
}

Вы — и НЕЧТО — едины.

Красный лес зовёт.

И вы — отвечаете.

КОНЕЦ

-> END

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 5: ПОБЕГ
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_escape ===

# mood: hope
# ending: escape

КОНЦОВКА: ПОБЕГ

...

Хаос.

Культисты — в панике. Кто-то бежит, кто-то падает, кто-то кричит.

Чернов — мёртв? ранен? — лежит у алтаря. НЕЧТО над ним — вьётся, пульсирует, визжит на частоте, от которой болят зубы.

Пещеры рушатся. Камни падают с потолка. Пыль. Грохот. # style:action # intensity:high

— БЕЖИМ! # speaker:sorokin # style:action # intensity:high

Вы хватаете кого-то за руку. Бежите. # style:action

{ Relationships ? romantic_tanya:
    Таня — рядом. В одной руке — фонарик, другой — тащит отца. Зорин едва держится на ногах, но живой. Живой.
    
    — Не останавливайся! — кричите вы. # speaker:sorokin # style:action
    
    — Не собиралась! # speaker:tanya # style:action
}

Коридоры. Повороты. Темнота. Вы не знаете дороги, просто бежите — куда-то, прочь, подальше.

За спиной — вой НЕЧТО. Оно не преследует. Оно — привязано к алтарю, к Двери. Но голос — догоняет.

«...ВЕРНИТЕСЬ!...»
«...ВЫ НЕ УЙДЁТЕ!...»
«...Я НАЙДУ ВАС!...»

Вы не оборачиваетесь. Бежите.

Свет. Впереди — свет. Выход.

Вы выбираетесь. Падаете в снег. Дышите.

За спиной — грохот. Пещеры обрушиваются. Вход — засыпан. Погребён под тоннами камня.

{ Relationships ? romantic_tanya:
    Таня — рядом. Зорин — между вами. Живые. Все живые.
    
    Она смотрит на вас. Грязная, растрёпанная, с порезом на щеке.
    
    Красивая.
    
    — Мы выбрались, — говорит она. Голос — недоверчивый. # speaker:tanya
    
    — Выбрались. # speaker:sorokin
}

...

Машина. "УАЗик", брошенный у опушки. Ключи — в замке.

Вы садитесь. Заводите двигатель. Он кашляет, чихает, но заводится.

Дорога. Ночь. Фары вырывают из темноты деревья, снег, бесконечную ленту асфальта.

Прочь. Подальше от Красногорска-12. От пещер. От красного леса.

{ Relationships ? romantic_tanya:
    Таня — на пассажирском сиденье. Зорин — сзади, спит. Или в забытьи.
    
    Она берёт вас за руку. Её пальцы — холодные.
    
    — Куда теперь? # speaker:tanya
    
    — Куда угодно. Подальше отсюда. # speaker:sorokin
    
    — А потом? # speaker:tanya
    
    — Потом... — Вы смотрите на дорогу. На тёмный горизонт. — Потом — разберёмся. # speaker:sorokin
    
    Она кладёт голову вам на плечо. # style:action # intensity:high
    
    — Хорошо. # speaker:tanya
}

...

ЭПИЛОГ

Вы уезжаете. Далеко. На другой конец страны. Меняете имена, документы, жизни.

Культ — остаётся. Пещеры — засыпаны, но Дверь... Дверь — приоткрыта. Где-то в темноте, под камнями, что-то ждёт.

Но это — не ваша забота. Не больше.

Вы свободны.

{ Relationships ? romantic_tanya:
    Вы и Таня. И её отец — который постепенно приходит в себя, хотя многого не помнит (и это — к лучшему).
    
    Новая жизнь. Маленький городок у моря. Далеко от лесов, от гор, от пещер.
    
    Иногда ночью — вы просыпаетесь от криков. Сны всё те же: красный свет, голоса, алтарь.
    
    Но Таня — рядом. Её рука — на вашей руке.
    
    — Всё хорошо, — шепчет она. — Ты в безопасности. Мы в безопасности. # speaker:tanya # intensity:high
    
    И постепенно — вы начинаете верить.
- else:
    Вы один. Как всегда.
    
    Но живой.
    
    Иногда ночью — красный лес снится до сих пор. Голоса — шепчут из темноты.
    
    «...мы ждём...»
    «...ты вернёшься...»
    
    Вы знаете — однажды кто-то откопает. Кто-то откроет Дверь снова.
    
    Но это будет не ваша история.
}

КОНЕЦ

-> END

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 6: ИСКУПЛЕНИЕ ЧЕРНОВА
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_chernov_redemption ===

# mood: bittersweet
# ending: redemption

КОНЦОВКА: ИСКУПЛЕНИЕ

Вы подходите к Чернову. # style:action

Не с оружием. С пустыми руками. # style:action # intensity:medium

— Александр Михайлович. # speaker:sorokin

Он смотрит на вас. В его глазах — удивление. # style:action

— Вы... не боитесь? # speaker:chernov

— Боюсь. Но понимаю. # speaker:sorokin

Вы знаете его историю. Жена — Марина. Умерла от рака. Он верил, что НЕЧТО может вернуть её. Двадцать лет — одержим этой надеждой. # style:thought

— Марина не хотела бы этого. # speaker:sorokin # intensity:high

Он вздрагивает. Как от удара. # style:action

— Откуда вы... # speaker:chernov

— Я видел медальон. На вашей шее. Её фотография. # speaker:sorokin

Чернов касается груди. Машинально. Защитный жест. # style:action

— Вы не знаете, каково это. Потерять всё. # speaker:chernov # intensity:high

— Знаю. Афганистан. Товарищи. Друзья. Я их всех помню. # speaker:sorokin

Пауза. # style:action # intensity:high

— Но они не хотели бы, чтобы я убивал других ради их возвращения. Они хотели бы, чтобы я — ЖИЛ. Делал мир лучше. Не хуже. # speaker:sorokin # intensity:high

Чернов смотрит на алтарь. На связанных людей. На НЕЧТО, которое ждёт. # style:action

— Поздно. Слишком поздно. Я зашёл слишком далеко. # speaker:chernov

— Никогда не поздно остановиться. Пока жив — можно выбрать. # speaker:sorokin

{ humanity >= 60:
    Что-то меняется в его глазах. Огонь безумия — гаснет. Остаётся — усталость. И боль. Человеческая боль.
    
    — Марина... — Шёпот. — Прости меня. # speaker:chernov # intensity:high
    
    Он поворачивается к алтарю.
    
    — Я знаю, как это закрыть. По-настоящему. Навсегда. # speaker:chernov
    
    — Как? # speaker:sorokin
    
    — Добровольная жертва. Того, кто открыл. — Он улыбается. Впервые — не безумно. Печально. — Меня. # speaker:chernov # intensity:high
    
    ~ MoralChoices += spared_chernov
    
    Прежде чем вы успеваете остановить его — он берёт ритуальный нож с алтаря.
    
    — Позаботьтесь о них. — Кивок на пленников. — Они невинны. # speaker:chernov
    
    Удар. Кровь.
    
    НЕЧТО — КРИЧИТ.
    
    Дверь — ЗАКРЫВАЕТСЯ.
    
    Свет — гаснет.
    
    ...
    
    Вы выползаете из пещеры на рассвете. С освобождёнными пленниками. Зорин жив — три недели в плену, но жив.
    
    { Relationships ? romantic_tanya:
        Таня обнимает отца. Плачет.
        
        Потом — обнимает вас.
        
        — Спасибо. Спасибо.
    }
    
    Чернов — мёртв. Но в конце — он выбрал правильно.
    
    Это что-то значит. Должно значить.
    
    КОНЕЦ
    
    -> END
- else:
    Чернов смотрит на вас. Долго.
    
    А потом — смеётся.
    
    — Красивые слова, следователь. Но — слишком поздно. # speaker:chernov
    
    Он поднимает руку.
    
    Культисты набрасываются на вас.
    
    -> ending_sacrifice
}

// ═══════════════════════════════════════════════════════════════════════════════
// КОНЦОВКА 7: ЖЕРТВА ФЁДОРА (СЕКРЕТНАЯ)
// ═══════════════════════════════════════════════════════════════════════════════

=== ending_fyodor_sacrifice ===

# mood: bittersweet
# ending: fyodor
# secret: true

СЕКРЕТНАЯ КОНЦОВКА: ИСКУПЛЕНИЕ

Вы смотрите на Фёдора. # style:action

Он стоит у алтаря. Спокойный. Впервые за двадцать лет — спокойный. # style:action # intensity:high

— Двадцать лет я ждал этого момента. # speaker:fyodor # intensity:high

— Фёдор... # speaker:sorokin

— Я был одним из них. Давно. Помогал открыть Дверь. — Он улыбается. — Теперь — закрою. # speaker:fyodor # intensity:high

— Есть другой способ. # speaker:sorokin

— Нет. Только добровольная жертва. Я — виновен. Вы — нет. # speaker:fyodor # intensity:high

НЕЧТО над алтарём ревёт. # style:horror # intensity:high

«...НЕТ!... ОН НАШ!...» # style:horror # intensity:high

— Прощайте, следователь. # speaker:fyodor # intensity:high

Фёдор берёт нож. # style:action # intensity:high

{ Relationships ? romantic_tanya:
    Таня хватает вас за руку:
    
    — Не смотрите. # speaker:tanya
}

Один удар.

Добровольная жертва. Искупление.

Дверь — закрывается. НАВСЕГДА.

НЕЧТО исчезает. С воем. С криком. Как будто миллионы голосов гаснут одновременно.

Пещера рушится.

Вы бежите.

{ Relationships ? romantic_tanya:
    С Таней. С Зориным.
}

Наружу.

...

ЭПИЛОГ

Культ уничтожен. Пещеры засыпаны. Дверь — закрыта навсегда.

Фёдора находят через неделю. Тело — у алтаря. Улыбка на лице.

Официальная версия: несчастный случай.

Вы знаете правду.

{ Relationships ? romantic_tanya:
    Вы и Таня уезжаете из Красногорска-12. Вместе.
    
    Зорин — жив. Помнит мало. Это к лучшему.
}

Иногда ночью вы слышите тишину.

Не голоса. Не шёпот.

Тишину.

И улыбаетесь.

Фёдор нашёл покой. Дверь закрыта.

Мир — в безопасности.

КОНЕЦ

-> END
