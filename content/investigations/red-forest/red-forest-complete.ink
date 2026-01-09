// ═══════════════════════════════════════════════════════════════════════════════
// КРАСНЫЙ ЛЕС — Полная история (Эпизоды 1-5)
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Профессиональная архитектура:
// - Единый файл для корректной передачи состояния
// - LIST для эффективного отслеживания улик
// - Функции для управления рассудком (с восстановлением)
// - Исправленная логика концовок с ВЫБОРОМ
// - External functions для UI эффектов
// ═══════════════════════════════════════════════════════════════════════════════

// ВАЖНО: Переход к началу истории — должен быть первым исполняемым кодом!
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
// НОВЫЕ МЕХАНИКИ
// ═══════════════════════════════════════════════════════════════════════════════

// Стиль расследования: влияет на диалоги и доступные опции
// 0 = нейтральный, положительные = агрессивный, отрицательные = дипломатичный
VAR investigation_style = 0

// Репутация в городе: слухи распространяются
VAR city_reputation = 0  // -100 (враг) до +100 (свой)

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
// ФУНКЦИИ УПРАВЛЕНИЯ РАССУДКОМ
// ═══════════════════════════════════════════════════════════════════════════════

=== function lose_sanity(amount) ===
~ sanity = sanity - amount
{ sanity < 0:
    ~ sanity = 0
}
// Возвращаем текущий рассудок для проверки в вызывающем коде
~ return sanity

// Проверка на безумие — вызывается ПОСЛЕ функции, не внутри
=== check_sanity ===
{ sanity <= 0:
    -> sanity_collapse
}
->->

=== sanity_collapse ===

# mood: horror
# ending: madness

Темнота. Абсолютная.

Голоса — везде. Они — вы. Вы — они.

«...добро пожаловать...»

Грань стёрта. Навсегда.

Вас находят утром. В лесу. С улыбкой на лице.

Диагноз: острый психоз. Необратимый.

КОНЦОВКА: БЕЗУМИЕ

-> END

=== function gain_sanity(amount) ===
~ sanity = sanity + amount
{ sanity > 100:
    ~ sanity = 100
}
~ return sanity

=== function is_sane() ===
~ return sanity >= 60

=== function is_disturbed() ===
~ return sanity >= 30 && sanity < 60

=== function is_mad() ===
~ return sanity < 30

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ПОДСЧЁТА УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== function count_all_clues() ===
~ return LIST_COUNT(CluesA) + LIST_COUNT(CluesB) + LIST_COUNT(CluesC) + LIST_COUNT(CluesD) + LIST_COUNT(CluesE)

=== function has_enough_evidence() ===
~ return count_all_clues() >= 8

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ ДОБАВЛЕНИЯ УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== function add_clue(clue) ===
// Автоматически увеличиваем счётчик
~ evidence_collected = evidence_collected + 1
~ return true

// ═══════════════════════════════════════════════════════════════════════════════
// ПЕРЕХОД МЕЖДУ ДНЯМИ
// ═══════════════════════════════════════════════════════════════════════════════

=== function advance_day() ===
~ days_remaining = days_remaining - 1
~ current_day = current_day + 1
~ chapter = chapter + 1
// ДОБАВЛЕНО: синхронизация evidence_collected с реальным количеством улик
~ evidence_collected = count_all_clues()
// ДЕДЛАЙН: прогресс луны и обратный отсчёт
~ advance_moon()
// HORROR: сброс счётчика событий нового дня
~ reset_daily_horror()
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
// Добавляем слух и меняем репутацию
{ rumor == rumor_dangerous:
    ~ city_reputation = city_reputation - 10
}
{ rumor == rumor_honest:
    ~ city_reputation = city_reputation + 10
}
{ rumor == rumor_crazy:
    ~ city_reputation = city_reputation - 15
}
{ rumor == rumor_hero:
    ~ city_reputation = city_reputation + 15
}
~ return true

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
// СИСТЕМА СЛУЧАЙНЫХ HORROR-СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════════════════════
//
// Интегрированная система атмосферных событий:
// - Зависит от рассудка (sanity)
// - Зависит от времени суток (time_of_day)
// - Зависит от текущей локации
// - Зависит от уровня осведомлённости о культе (cult_awareness)
// - Зависит от уровня заражения (infection_level)
// - Использует LIST_RANDOM для непредсказуемости
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
// ГЛАВНАЯ ФУНКЦИЯ ВЫЗОВА СОБЫТИЙ
// ─────────────────────────────────────────────────────────────────────────────

=== function should_trigger_horror() ===
// Определяет, должно ли произойти horror-событие
// Вероятность зависит от множества факторов

// Максимум 3 события в день
{ horror_events_today >= 3:
    ~ return false
}

// Базовый шанс: 20%
~ temp chance = 20

// Низкий рассудок увеличивает шанс
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

// Проверка (используем простой "random" через подсчёт улик как seed)
~ temp seed = (evidence_collected + current_day + sanity) % 100
{ seed < chance:
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
        
        ~ lose_sanity(2)
    -
        Тропинка.
        
        Вы точно шли по ней. Точно помните — вот этот изгиб, вот это дерево.
        
        Но сейчас тропинка ведёт... не туда.
        
        Или это вы — не там?
        
        ~ lose_sanity(2)
    -
        Холод.
        
        Внезапный. Резкий. Как будто прошли через невидимую стену.
        
        Изо рта — пар. Кожа покрывается мурашками.
        
        Три шага назад — тепло. Три шага вперёд — холод.
        
        Граница. Чего?
        
        ~ lose_sanity(3)
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
        
        ~ lose_sanity(4)
    -
        «...Сорокин...»
        
        Шёпот. Ваше имя. Из-за деревьев.
        
        Вы замираете. Рука — на кобуре.
        
        «...мы ждали...»
        
        Голос — женский? Мужской? Детский? Все сразу.
        
        «...так долго ждали...»
        
        ~ lose_sanity(5)
        ~ update_infection(3)
    -
        Красное.
        
        Листья на земле — красные. Но сейчас — ноябрь. Листья должны быть бурыми, гнилыми.
        
        А эти — яркие. Алые. Как свежая кровь.
        
        Вы наклоняетесь. Трогаете.
        
        Влажные.
        
        На пальцах — красное. Пахнет железом.
        
        ~ lose_sanity(5)
        ~ CluesC += cult_symbol
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
        
        ~ lose_sanity(7)
        ~ update_infection(5)
    -
        Поляна.
        
        Вы не помните, как сюда пришли. Минуту назад — шли по тропе. И вдруг — поляна.
        
        В центре — камень. Плоский. С узорами. Бурыми пятнами.
        
        Алтарь.
        
        Вы уже видели такой. Во сне? В видении?
        
        Рядом с камнем — ваши следы. Старые. Засохшие.
        
        Вы здесь уже были. Когда?
        
        ~ lose_sanity(8)
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
        
        ~ lose_sanity(10)
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
        
        ~ lose_sanity(12)
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
        
        ~ lose_sanity(15)
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
        
        ~ lose_sanity(3)
    -
        Капли.
        
        Кап. Кап. Кап.
        
        Ритмичные. Постоянные. Как метроном.
        
        Вы ищете источник — нет воды. Потолок сухой. Стены сухие.
        
        Кап. Кап. Кап.
        
        Звук идёт изнутри вашей головы.
        
        ~ lose_sanity(3)
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
        
        ~ lose_sanity(5)
        ~ CultLore += lore_door_nature
        ~ cult_awareness = cult_awareness + 3
    -
        Эхо.
        
        Вы кашлянули. Тихо. Для проверки.
        
        Эхо возвращается. Но не кашель. Слова.
        
        «...иди...»
        
        Ваш голос. Ваш кашель. Но слова — не ваши.
        
        ~ lose_sanity(5)
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
        
        ~ lose_sanity(8)
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
        
        ~ lose_sanity(10)
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
        
        ~ lose_sanity(15)
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
        
        ~ lose_sanity(12)
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
        
        ~ lose_sanity(2)
    -
        Окна.
        
        В домах напротив. Тёмные. Все спят.
        
        Но в одном — силуэт. Неподвижный. Смотрит на вас.
        
        Вы поднимаете руку — помахать? проверить?
        
        Силуэт поднимает руку. Синхронно. Точно.
        
        Зеркало? Нет. Это — другой дом. Другое окно.
        
        ~ lose_sanity(3)
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
        
        ~ lose_sanity(4)
        ~ update_infection(2)
    -
        Радио.
        
        В машине. Выключенное. Мёртвое.
        
        Шипит. Хрипит. Говорит.
        
        «...Сорокин... Виктор Сорокин... мы знаем, где ты...»
        
        Вы вырываете провода. Радио замолкает.
        
        Но голос — остаётся. В голове. Эхом.
        
        ~ lose_sanity(5)
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
        
        ~ lose_sanity(7)
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
        
        ~ lose_sanity(8)
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
        
        ~ lose_sanity(12)
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
        
        ~ lose_sanity(15)
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
        
        ~ lose_sanity(1)
    -
        Часы.
        
        Все часы в городе — показывают разное время.
        
        На вокзале — 14:23. На почте — 15:47. На руке — 13:05.
        
        Какое время — настоящее?
        
        ~ lose_sanity(2)
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
        
        ~ lose_sanity(4)
        ~ update_infection(2)
    -
        Газета.
        
        Старая. На скамейке. Вы поднимаете.
        
        Заголовок: «СЛЕДОВАТЕЛЬ СОРОКИН ПРОПАЛ БЕЗ ВЕСТИ».
        
        Дата — завтрашняя.
        
        Вы перечитываете. Заголовок — другой. Что-то про урожай.
        
        Дата — вчерашняя.
        
        Показалось?
        
        ~ lose_sanity(5)
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
        
        ~ lose_sanity(8)
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
        
        ~ lose_sanity(10)
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
        
        ~ lose_sanity(15)
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
        
        ~ lose_sanity(12)
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

{ ritual_countdown == 4:
    Луна за окном — тонкий серп. Едва видна за облаками.
    
    Четыре дня до полнолуния.
}
{ ritual_countdown == 3:
    Луна — уже половина. Желтоватая, нездоровая на вид.
    
    Три дня.
    
    { knows_deadline:
        Три дня до ритуала. Времени всё меньше.
    }
}
{ ritual_countdown == 2:
    Луна — почти полная. Её свет пробивается даже сквозь тучи.
    
    Два дня.
    
    { knows_deadline:
        Два дня. Вы чувствуете — что-то нарастает. Напряжение в воздухе. Тревога жителей.
    }
}
{ ritual_countdown == 1:
    Луна — огромная, красноватая. Словно налитая кровью.
    
    Завтра.
    
    { knows_deadline:
        Завтра полнолуние. Завтра — ритуал. Если не остановить...
        
        ~ lose_sanity(5)
    }
}
{ ritual_countdown == 0:
    ПОЛНОЛУНИЕ.
    
    Луна висит над городом — огромная, багровая, неправильная.
    
    Время вышло.
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
    
    ~ lose_sanity(5)
}
{ infection_level >= 60 && infection_level < 80:
    Грань между реальностью и... другим — размывается.
    
    Вы больше не уверены, что снится, а что — наяву. Воспоминания путаются. Время течёт странно.
    
    Они говорят с вами. Всё чаще. Всё настойчивее.
    
    «...приди...»
    «...дверь открыта...»
    «...ты наш...»
    
    ~ lose_sanity(10)
}
{ infection_level >= 80:
    Вы — на грани.
    
    Ваше отражение в зеркале — улыбается, когда вы не улыбаетесь. Тени следуют за вами. Стены пульсируют, как живые.
    
    Голоса — уже не шёпот. Они — КРИК.
    
    Скоро вы станете одним из них. Если не остановите это.
    
    Если сможете остановить.
    
    ~ lose_sanity(15)
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
~ evidence_collected += 3

->->

=== scene_lore_door_nature ===
# mood: cosmic_horror
# type: lore

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
~ lose_sanity(5)

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ВОСПОМИНАНИЙ (FLASHBACKS)
// ═══════════════════════════════════════════════════════════════════════════════

=== flashback_ambush ===
# mood: horror
# effect: flashback

...воспоминание накатывает волной...

АФГАНИСТАН, 1978 ГОД

Засада в ущелье Панджшер. Колонна растянулась на два километра.

Первый взрыв — головная машина. Второй — замыкающая. Ловушка захлопнулась.

Вы помните крики. Помните, как Сашка Воронов — двадцать два года, жена беременная — упал лицом в песок. Помните запах горящего топлива и меди.

Вы выжили. Девятнадцать из сорока трёх не выжили.

Почему вы? Этот вопрос преследует вас каждую ночь.

~ AfghanMemories += memory_ambush
~ afghan_flashbacks = afghan_flashbacks + 1
~ temp sanity_cost = lose_sanity(3)

...настоящее возвращается...

->->

=== flashback_cave ===
# mood: horror
# effect: flashback

...границы реальности размываются...

АФГАНИСТАН, 1979 ГОД

Пещеры в горах Гиндукуш. Вы искали базу снабжения.

Нашли что-то другое.

Глубоко под землёй — зал с колоннами. Не природный. Кто-то вырубил его в скале тысячи лет назад. На стенах — символы, которые вы не понимали.

Красные круги. Расходящиеся линии. Глаза, смотрящие отовсюду.

Проводник — местный старик — увидел это и отказался идти дальше. Сказал одно слово на дари: "Джинны".

Вы не поверили. Тогда.

~ AfghanMemories += memory_cave
~ afghan_flashbacks = afghan_flashbacks + 1
~ cult_awareness = cult_awareness + 2

...реальность восстанавливается...

->->

=== flashback_betrayal ===
# mood: horror
# effect: flashback

...память прорывается сквозь защиту...

АФГАНИСТАН, 1979 ГОД

Информатор. Вы верили ему два месяца. Он сдавал позиции моджахедов, спасал жизни.

Потом он привёл вашу группу в долину, где ждали триста человек.

Из двенадцати вернулись четверо.

Вы нашли его потом. В Кабуле. Он не сопротивлялся.

"Я делал, что должен был", — сказал он. — "Они обещали вернуть мою семью".

Вы не выстрелили. Передали афганским властям. Но иногда жалеете, что не выстрелили.

Доверие — роскошь. Вы усвоили этот урок.

~ AfghanMemories += memory_betrayal
~ afghan_flashbacks = afghan_flashbacks + 1

...настоящее...

->->

=== flashback_voices ===
# mood: horror
# effect: flashback

...шёпот из прошлого...

АФГАНИСТАН, 1980 ГОД

Госпиталь в Кабуле. Контузия. Две недели без сознания.

Вы слышали голоса. Мёртвые товарищи разговаривали с вами. Рассказывали, что видят на той стороне.

"Темнота", — говорил Сашка Воронов. — "Но не пустая. Там что-то живёт. Оно ждёт".

Врачи сказали — последствия травмы. Галлюцинации. Пройдёт.

Голоса прошли. Но иногда — поздно ночью — вы всё ещё слышите шёпот.

"Оно ждёт..."

~ AfghanMemories += memory_voices
~ afghan_flashbacks = afghan_flashbacks + 1
~ temp sanity_cost = lose_sanity(5)

...тишина...

->->

// ═══════════════════════════════════════════════════════════════════════════════
// СЛУЧАЙНЫЕ СОБЫТИЯ (RANDOM ENCOUNTERS)
// ═══════════════════════════════════════════════════════════════════════════════

=== random_encounter(-> return_to) ===
// Выбираем случайное событие на основе времени и дня
// Вызывается как: -> random_encounter(-> ep1_night_directions)
~ temp roll = RANDOM(1, 10)

{ time_of_day == 3: // Ночь — более жуткие события
    { roll <= 3:
        -> encounter_shadow(return_to)
    }
    { roll > 3 && roll <= 6:
        -> encounter_whispers(return_to)
    }
    -> encounter_figure(return_to)
}

{ time_of_day == 2: // Вечер
    { roll <= 4:
        -> encounter_stranger(return_to)
    }
    { roll > 4 && roll <= 7:
        -> encounter_warning(return_to)
    }
    -> encounter_clue(return_to)
}

// День или утро — более нейтральные события
{ roll <= 3:
    -> encounter_gossip(return_to)
}
{ roll > 3 && roll <= 6:
    -> encounter_helpful(return_to)
}
-> encounter_suspicious(return_to)

=== encounter_shadow(-> return_to) ===
# mood: horror

Краем глаза вы замечаете движение. Тень — слишком быстрая, слишком плавная для человека — скользит между домами.

Вы оборачиваетесь. Ничего.

Но ощущение взгляда в спину не проходит.

~ lose_sanity(2)

-> return_to

=== encounter_whispers(-> return_to) ===
# mood: horror

Ветер приносит звуки. Не слова — но почти слова. Как будто кто-то говорит на незнакомом языке, слишком тихо, чтобы разобрать.

Вы останавливаетесь. Прислушиваетесь.

Шёпот затихает. Но вы уверены — он был.

{ sanity < 50:
    "...идёт..." — одно слово прорывается сквозь шум. — "...следователь идёт..."
    ~ lose_sanity(3)
}

-> return_to

=== encounter_figure(-> return_to) ===
# mood: horror

В конце улицы — фигура. Стоит неподвижно под единственным фонарём.

Высокая. Худая. Лица не разглядеть — капюшон.

Вы моргаете.

Фигуры нет. Только пустая улица и качающийся на ветру фонарь.

{ not (AfghanMemories ? memory_voices):
    -> flashback_voices ->
}

~ lose_sanity(4)

-> return_to

=== encounter_stranger(-> return_to) ===
# mood: mystery

Незнакомец в сером пальто. Идёт навстречу, смотрит в землю.

Проходя мимо, он что-то бормочет. Вы различаете только:

"...не задерживайтесь здесь... они уже знают..."

Вы оборачиваетесь, но он уже завернул за угол.

Кто "они"?

-> return_to

=== encounter_warning(-> return_to) ===
# mood: tense

Записка. Кто-то сунул вам в карман, пока вы проходили мимо толпы у магазина.

Разворачиваете: "УЕЗЖАЙТЕ. СЕГОДНЯ. ПОКА МОЖЕТЕ."

Почерк — женский. Торопливый.

Вы оглядываетесь. Десятки лиц. Любое из них могло написать это.

-> return_to

=== encounter_clue(-> return_to) ===
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

-> return_to

=== encounter_gossip(-> return_to) ===
# mood: neutral

Две женщины у колонки набирают воду. Замолкают, когда вы проходите мимо.

{ city_reputation < -20:
    "...это он... московский... говорят, людей сажает ни за что..."
}
{ city_reputation >= -20 && city_reputation <= 20:
    "...следователь... зачем приехал?.. что ему надо?.."
}
{ city_reputation > 20:
    "...ищет пропавших... может, хоть что-то найдёт..."
}

Вы делаете вид, что не слышите.

-> return_to

=== encounter_helpful(-> return_to) ===
# mood: neutral

Старик в телогрейке окликает вас:

— Товарищ! Из Москвы, да?

Не дожидаясь ответа:

— Библиотека — на площади Ленина. Там подшивки газет есть. Может, пригодятся. Если ищете... ну, вы поняли.

Он уходит, не оглядываясь.

{ not (SecretLocations ? hidden_archive):
    Библиотека. Интересно. Может быть, там есть архивы?
}

-> return_to

=== encounter_suspicious(-> return_to) ===
# mood: tense

Чёрная "Волга" медленно проезжает мимо. Тонированные стёкла. Номера — московские.

Вы не первый раз видите эту машину.

Кто-то следит за следователем. Ирония.

~ city_reputation = city_reputation - 2

-> return_to

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
    ~ evidence_collected = evidence_collected + 1
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

Впереди — развилка. Три туннеля.

* [Левый туннель]
    Узкий. Приходится протискиваться боком.
    
    Через двадцать метров — тупик. Но на полу — старый ящик.
    
    Внутри — документы. Пожелтевшие, но читаемые.
    
    "ПРОЕКТ 'ЭХО'. Отчёт №47. Субъект показал устойчивость к воздействию. Рекомендуется увеличить дозировку..."
    
    { not (CluesB ? experiment_records):
        ~ CluesB += experiment_records
        ~ evidence_collected = evidence_collected + 1
        
        УЛИКА: Записи экспериментов — найдены в шахте.
    }
    
    -> mine_deep

* [Центральный туннель]
    Широкий. Рельсы ведут прямо.
    
    Через пятьдесят метров — обвал. Дальше не пройти.
    
    Но сквозь щели в завале... свет? Тусклый, красноватый.
    
    И звуки. Голоса?
    
    Нет. Просто эхо. Наверное.
    
    ~ lose_sanity(3)
    
    -> mine_deep

* [Правый туннель]
    Влажный. Вода капает с потолка.
    
    Через тридцать метров — подземное озеро. Чёрная вода, неподвижная как стекло.
    
    На берегу — кости. Человеческие.
    
    Сколько им лет? Десятки? Сотни?
    
    ~ lose_sanity(5)
    
    { not (CluesA ? missing_list):
        Это может быть связано с исчезновениями.
    }
    
    -> mine_deep

* [Вернуться к выходу]
    Достаточно. Нужно обдумать увиденное.
    -> ep1_night_directions

=== city_archive ===
# mood: investigation
# location: archive

ГОРОДСКОЙ АРХИВ

Одноэтажное здание на окраине — бывшая школа, переоборудованная под хранилище документов.

Архивариус — Мария Фёдоровна, восьмидесятилетняя старушка с острыми глазами и ещё более острой памятью.

— Следователь? — Она смотрит на ваше удостоверение. — Давненько к нам никто не заглядывал.

— Мне нужны документы по истории города. Довоенные. И раньше, если есть.

Она качает головой.

— Раньше — мало что осталось. Война, пожар в пятьдесят первом... Но кое-что есть. Пойдёмте.

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

— Экспедиция? Какая экспедиция?

— Восемьсот девяностый год. Географическое общество.

Мария Фёдоровна замирает. Её глаза — расширяются.

— Откуда вы...

— Я читал кое-какие документы.

Долгая пауза. Она оглядывается — словно проверяя, не подслушивает ли кто.

— Идёмте. — Её голос — шёпот. — Но это — между нами.

Она ведёт вас в дальний угол архива. Старые шкафы, пыльные коробки. Из одной — достаёт папку. Ветхую, с выцветшими чернилами на обложке.

"Дело №127. Экспедиция Корнилова. 1890."

— Это не должно было сохраниться. — Она протягивает папку. — Я спрятала, когда в пятьдесят четвёртом приезжали люди из Москвы. Они забрали всё, что касалось... пещер. Но эту — не нашли.

~ AncientArtifacts += artifact_expedition_journal
~ evidence_collected += 2

* [Читать]
    Вы открываете папку.
    
    Пожелтевшие страницы. Выцветшие чернила. Но читаемо.
    
    -> lore_expedition_1890_full ->
    
    — Боже мой.
    
    — Теперь понимаете? — Мария Фёдоровна смотрит на вас. — Понимаете, почему люди исчезают?
    
    -> archive_continue

* [Спросить, что она знает]
    — Вы читали это?
    
    — Много раз. — Она кивает. — С тех пор, как мой брат... — Она замолкает.
    
    — Ваш брат?
    
    — Шестьдесят восьмой год. Работал на заводе. В секретном отделе. Однажды не пришёл домой.
    
    ~ understanding_klava += 5
    
    -> archive_continue

=== archive_missing ===

# mood: dark

— Пропавшие? — Мария Фёдоровна вздыхает. — Молодой человек, если бы вы знали, сколько людей пропало в этом городе...

Она достаёт толстую тетрадь. Самодельную, в клеёнчатой обложке.

— Я веду записи. Тридцать лет веду. Неофициально, конечно. Но... кто-то должен помнить.

Она открывает тетрадь. Имена. Даты. Краткие пометки.

"Иванов П.С., 1958. Ушёл на рыбалку. Не вернулся."
"Сидорова М.В., 1961. Последний раз видели у леса."
"Козлов А.И., 1965. Работал на заводе. Исчез после ночной смены."

Имена тянутся страница за страницей. Десятки. Сотни.

— Сколько всего?

— За тридцать лет? — Она листает тетрадь. — Двести сорок семь. Официально, конечно, меньше. Многих записали как уехавших, умерших от болезней...

~ evidence_collected += 3
~ cult_awareness += 5

# clue
Улика найдена: неофициальный список пропавших (247 человек)

* [Есть ли закономерность?]
    — Вы не заметили закономерности?
    
    — Заметила. — Она кивает. — Больше всего исчезновений — в ноябре. В полнолуние. И... — Она понижает голос. — Все они слышали голоса. За несколько дней до исчезновения.
    
    ~ cult_awareness += 3
    
    -> archive_continue

* [Кто расследовал?]
    — Кто-нибудь расследовал это?
    
    — Было несколько следователей. До вас. — Мария Фёдоровна смотрит в сторону. — Один уехал через три дня. Сказал — дело закрыто. Второй... второй остался дольше.
    
    — И?
    
    — Его нашли в лесу. Через неделю. Официально — сердечный приступ.
    
    ~ lose_sanity(3)
    
    -> archive_continue

=== archive_legends ===

# mood: mystery

— Легенды? — Мария Фёдоровна усмехается. — Здесь всё — легенда. Весь город.

Она садится в кресло. Жестом приглашает вас сесть напротив.

— Мой дед рассказывал... Он родился здесь, в деревне, которая была до города. Когда-то — давно, ещё при царе — сюда пришли геологи. Искали руду.

— Экспедиция Корнилова?

— Раньше. Гораздо раньше. Ещё при Екатерине. Нашли что-то в горах. Что-то... — Она замолкает. — Дед говорил — "нехорошее место". Местные знали. Не ходили туда.

~ CultLore += lore_ancient_tribe
~ lore_depth += 3

— А потом?

— Потом — революция. Война. Сталин. Завод построили в пятьдесят втором. А под ним — лаборатории. Секретные.

Она наклоняется ближе.

— Дед умер в пятьдесят шестом. Но перед смертью сказал мне: "Маша, они открыли Дверь. Нельзя было открывать. Теперь — поздно."

~ lore_depth += 5

* [Какую Дверь?]
    — Что за Дверь?
    
    — Не знаю. — Она качает головой. — Но... — Она достаёт из кармана маленький свёрток. Разворачивает.
    
    Камень. Чёрный, гладкий. С выцарапанным символом — три линии, сходящиеся к центру круга.
    
    — Это нашли рядом с дедом. После смерти. В руке зажал.
    
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

— Вы не такой, как другие следователи. — Её голос — тихий. — Вы ищете правду. По-настоящему.

— Да.

— Тогда будьте осторожны. — Она берёт вас за руку. Её пальцы — холодные, как лёд. — Правда в этом городе... она убивает. Медленно. Или быстро. Но убивает.

* [Поблагодарить и уйти]
    — Спасибо, Мария Фёдоровна. Вы очень помогли.
    
    — Помогла... — Она усмехается. — Может быть. А может — погубила. Время покажет.
    
    ~ understanding_klava += 10
    ~ trust_vera += 5
    
    -> ep1_morning_choice

* [Спросить, как защититься]
    — Есть ли способ... защититься?
    
    Она молчит. Долго.
    
    — Не слушайте голоса. Что бы они ни говорили. Что бы ни обещали. Это — ловушка. Всегда ловушка.
    
    ~ gain_sanity(5)
    
    -> ep1_morning_choice

=== secret_abandoned_lab ===
# mood: horror
# location: abandoned_lab

ЗАБРОШЕННАЯ ЛАБОРАТОРИЯ

{ not (SecretLocations ? abandoned_lab):
    Подвал административного здания завода. Официально — бомбоубежище.
    ~ unlock_location(abandoned_lab)
}

Но бомбоубежища не оборудуют операционными столами и стеклянными камерами.

{ has_item(item_camera):
    * [Сфотографировать всё]
        Щёлк. Щёлк. Щёлк.
        
        Двенадцать кадров. Если плёнка не засветится — это будет доказательством.
        
        { not (CluesC ? ritual_photos):
            ~ CluesC += ritual_photos
            ~ evidence_collected = evidence_collected + 1
            
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
    ~ evidence_collected = evidence_collected + 1
    
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

=== interrogation_choice(-> target_knot) ===
// Универсальный выбор стиля допроса

* [Жёсткий допрос — давить на подозреваемого]
    ~ change_style(5)
    Вы повышаете голос. Наклоняетесь вперёд. Глаза в глаза.
    
    "Я знаю, что вы лжёте. И вы знаете, что я знаю. Давайте не будем тратить время."
    
    -> target_knot

* [Дипломатия — расположить к себе]
    ~ change_style(-5)
    Вы улыбаетесь. Предлагаете сигарету.
    
    "Послушайте, я понимаю — вы боитесь. Но я здесь не для того, чтобы кого-то наказывать. Я ищу правду. Помогите мне — и я помогу вам."
    
    -> target_knot

* [Хитрость — притвориться, что знаете больше]
    Вы достаёте блокнот. Делаете вид, что читаете.
    
    "Интересно... Здесь написано, что вас видели в ту ночь у леса. И ещё — что вы разговаривали с Зориным за день до исчезновения. Хотите объяснить?"
    
    (Вы блефуете. Но собеседник этого не знает.)
    
    -> target_knot

* { has_item(item_vodka) } [Подкуп — угостить водкой]
    Вы достаёте бутылку "Столичной".
    
    "Холодно. Может, согреемся? За разговором..."
    
    ~ remove_item(item_vodka)
    ~ city_reputation = city_reputation + 5
    -> target_knot

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

ЖУРНАЛ СЛЕДОВАТЕЛЯ

День {current_day} из 5. {time_of_day == 0:Утро}{time_of_day == 1:День}{time_of_day == 2:Вечер}{time_of_day == 3:Ночь}.

Собрано улик: {count_all_clues()}
Рассудок: {sanity}%
Репутация в городе: {city_reputation}

* [Просмотреть улики]
    -> journal_clues

* [Просмотреть контакты]
    -> journal_contacts

* [Мои теории]
    -> journal_theories

* [Связи между уликами]
    -> journal_clue_combinations

* [Закрыть журнал]
    -> ep1_night_choice

=== journal_clues ===
СОБРАННЫЕ УЛИКИ:

{ CluesA ? missing_list:
    ◆ Список пропавших — 7 человек за 2 года
}
{ CluesA ? false_reports:
    ◆ Ложные рапорты — милиция скрывает информацию
}
{ CluesA ? witness_conflict:
    ◆ Противоречия в показаниях — свидетели лгут или?..
}
{ CluesB ? echo_docs:
    ◆ Документы "Проекта Эхо" — секретные эксперименты
}
{ CluesB ? experiment_records:
    ◆ Записи экспериментов — опыты на людях
}
{ CluesB ? underground_map:
    ◆ Карта подземелий — под городом сеть туннелей
}
{ CluesC ? cult_symbol:
    ◆ Культовые символы — древние знаки
}
{ CluesC ? chernov_diary:
    ◆ Дневник Чернова — ключ к разгадке
}
{ CluesC ? ritual_photos:
    ◆ Ритуальные фотографии — доказательство культа
}
{ CluesD ? expedition_1890:
    ◆ Записи экспедиции 1890 — история началась давно
}

{ count_all_clues() == 0:
    Пока ничего не найдено. Нужно искать.
}

-> investigator_journal

=== journal_contacts ===
КОНТАКТЫ:

{ MetCharacters ? gromov:
    ◆ Майор Громов — начальник милиции
    { trust_gromov >= 60: [Доверяет вам] }
    { trust_gromov < 30: [Враждебен] }
}
{ MetCharacters ? tanya:
    ◆ Таня Зорина — дочь пропавшего
    { trust_tanya >= 60: [Близкие отношения] }
}
{ MetCharacters ? vera:
    ◆ Вера — загадочная женщина
    { trust_vera >= 60: [Доверяет вам] }
}
{ MetCharacters ? serafim:
    ◆ Серафим — местный "юродивый"
    { trust_serafim >= 60: [Считает вас другом] }
}
{ MetCharacters ? fyodor:
    ◆ Фёдор — информатор
    { KeyEvents ? found_fyodor_body: [МЁРТВ] }
    { trust_fyodor >= 60: [Союзник] }
}

-> investigator_journal

// ═══════════════════════════════════════════════════════════════════════════════
// ФАЗА 3: КОМБИНАЦИИ УЛИК
// ═══════════════════════════════════════════════════════════════════════════════

=== journal_clue_combinations ===
СВЯЗИ МЕЖДУ УЛИКАМИ:

// Проверяем возможные комбинации
{ can_combine_clues(combo_witnesses) && not (ClueCombinations ? combo_witnesses):
    ★ МОЖНО ОБЪЕДИНИТЬ: Противоречия свидетелей + Ложные рапорты
    → Раскрыть заговор молчания
    
    * [Объединить улики]
        ~ combine_clues(combo_witnesses)
        
        Вы сопоставляете показания свидетелей с официальными рапортами.
        
        Картина проясняется: они ВСЕ лгут. Не потому что преступники — потому что боятся. Кто-то заставляет весь город молчать.
        
        Но кто имеет такую власть?
        
        ~ boost_theory(4, 15)  // Заговор
        ~ personal_vendetta = personal_vendetta + 10
        
        # insight
        СВЯЗЬ ОБНАРУЖЕНА: Заговор молчания охватывает весь город
        
        -> journal_clue_combinations
    
    * [Не сейчас]
        -> journal_clue_combinations
}

{ can_combine_clues(combo_project) && not (ClueCombinations ? combo_project):
    ★ МОЖНО ОБЪЕДИНИТЬ: Документы "Эхо" + Записи экспериментов
    → Понять масштаб проекта
    
    * [Объединить улики]
        ~ combine_clues(combo_project)
        
        Вы раскладываете документы на столе. Сопоставляете даты, имена, результаты.
        
        Проект "Эхо" — не просто эксперименты. Это попытка установить контакт с чем-то... нечеловеческим. И они преуспели.
        
        Двадцать лет. Сотни жертв. Всё ради одной цели — открыть Дверь.
        
        ~ boost_theory(5, 15)  // Культ
        ~ cult_awareness = cult_awareness + 5
        
        # insight
        СВЯЗЬ ОБНАРУЖЕНА: Проект "Эхо" — попытка контакта с потусторонним
        
        -> journal_clue_combinations
    
    * [Не сейчас]
        -> journal_clue_combinations
}

{ can_combine_clues(combo_cult_history) && not (ClueCombinations ? combo_cult_history):
    ★ МОЖНО ОБЪЕДИНИТЬ: Символы культа + Записи экспедиции 1890
    → Раскрыть древнюю историю культа
    
    * [Объединить улики]
        ~ combine_clues(combo_cult_history)
        
        Символы — одинаковые. В пещерах, на стенах, в старых записях.
        
        Этому культу — тысячи лет. Он был здесь задолго до города, до завода, до всего. Советские учёные не создали его — они просто нашли.
        
        И разбудили.
        
        ~ boost_theory(5, 20)  // Культ — сильный буст!
        ~ cult_awareness = cult_awareness + 8
        ~ lore_depth = lore_depth + 5
        
        # insight
        СВЯЗЬ ОБНАРУЖЕНА: Культ существует тысячи лет
        
        -> journal_clue_combinations
    
    * [Не сейчас]
        -> journal_clue_combinations
}

{ can_combine_clues(combo_victims) && not (ClueCombinations ? combo_victims):
    ★ МОЖНО ОБЪЕДИНИТЬ: Список пропавших + Ритуальные фотографии
    → Установить личную связь
    
    * [Объединить улики]
        ~ combine_clues(combo_victims)
        
        Вы сопоставляете имена из списка с лицами на фотографиях.
        
        { knows_vanished_comrade:
            Сергей. Ваш товарищ по Афгану. Он — на одной из фотографий. В белой мантии. Среди жертв.
            
            Они забрали его. Превратили в часть ритуала.
            
            ~ personal_vendetta = personal_vendetta + 30
            ~ lose_sanity(5)
        - else:
            Лица. Имена. Судьбы. Каждый из них был кем-то — мужем, отцом, сыном.
            
            Теперь — просто жертвы.
            
            ~ personal_vendetta = personal_vendetta + 15
        }
        
        Это должно закончиться. Сегодня.
        
        # insight
        СВЯЗЬ ОБНАРУЖЕНА: Пропавшие — жертвы ритуалов
        
        -> journal_clue_combinations
    
    * [Не сейчас]
        -> journal_clue_combinations
}

// Показываем уже найденные комбинации
{ ClueCombinations ? combo_witnesses:
    ✓ Заговор молчания — раскрыт
}
{ ClueCombinations ? combo_project:
    ✓ Масштаб проекта "Эхо" — раскрыт
}
{ ClueCombinations ? combo_cult_history:
    ✓ Древняя история культа — раскрыта
}
{ ClueCombinations ? combo_victims:
    ✓ Судьба жертв — установлена
}

// Если нет доступных комбинаций
{ not can_combine_clues(combo_witnesses) && not can_combine_clues(combo_project) && not can_combine_clues(combo_cult_history) && not can_combine_clues(combo_victims):
    { LIST_COUNT(ClueCombinations) == 0:
        Пока недостаточно улик для установления связей.
        Нужно собрать больше информации.
    - else:
        Все возможные связи уже установлены.
    }
}

* [Вернуться]
    -> investigator_journal

=== journal_theories ===
МОИ ВЕРСИИ РАССЛЕДОВАНИЯ:

// Показываем активные версии с процентом уверенности
{ theory_chemical > 0:
    { chemical_debunked:
        ✗ Химическое отравление — ОПРОВЕРГНУТО
    - else:
        ◆ Химическое отравление (уверенность: {theory_chemical}%)
        { theory_chemical >= 50:
            → Завод выбрасывает токсины, вызывающие галлюцинации
        }
    }
}

{ theory_gromov > 0:
    { gromov_debunked:
        ✗ Громов — убийца — ОПРОВЕРГНУТО (он ищет дочь)
    - else:
        ◆ Громов — серийный убийца (уверенность: {theory_gromov}%)
        { theory_gromov >= 50:
            → Он знает местность, имеет власть, странно себя ведёт
        }
    }
}

{ theory_serafim > 0:
    { serafim_debunked:
        ✗ Серафим — сектант — ОПРОВЕРГНУТО (он борется с культом)
    - else:
        ◆ Серафим — безумный проповедник (уверенность: {theory_serafim}%)
        { theory_serafim >= 50:
            → Религиозный фанатик, манипулирует паствой
        }
    }
}

{ theory_conspiracy > 0:
    ◆ Государственный заговор (уверенность: {theory_conspiracy}%)
    { theory_conspiracy >= 50:
        → Секретные эксперименты, которые скрывают любой ценой
    }
}

{ theory_cult > 0 || cult_awareness >= 10:
    ◆ Тайный культ (уверенность: {theory_cult > cult_awareness: {theory_cult}|{cult_awareness * 2}}%)
    { cult_awareness >= 15:
        → Исчезновения — жертвоприношения для древнего ритуала
    }
}

// Подсказка о прогрессе
{ theories_debunked == 0 && theory_chemical + theory_gromov + theory_serafim == 0:
    Пока недостаточно данных для версий. Нужно собрать больше информации.
}

{ theories_debunked >= 2:
    
    Опровергнуто версий: {theories_debunked}
    Истина где-то рядом...
}

// Дедлайн
{ knows_deadline:
    
    ⚠ ПОЛНОЛУНИЕ ЧЕРЕЗ {ritual_countdown} {ritual_countdown == 1: ДЕНЬ|ДНЯ/ДНЕЙ}
}

// Личная связь
{ knows_vanished_comrade:
    
    ★ ЛИЧНОЕ: Сергей Коршунов — мой товарищ из Афганистана — среди пропавших.
}

// Заражение
{ sorokin_infected:
    
    ⚠ Я начинаю видеть... то же, что они. Уровень заражения: {infection_level}%
}

-> investigator_journal

// ═══════════════════════════════════════════════════════════════════════════════
// ЭПИЗОД 1: ПРИБЫТИЕ
// ═══════════════════════════════════════════════════════════════════════════════

=== episode1_intro ===

# chapter: 1
# mood: mystery
# title: Прибытие

15 НОЯБРЯ 1986 ГОДА

Красногорск-12, Средний Урал

...

Автобус дёргается в последний раз и замирает. Тормоза визжат — звук, от которого сводит зубы. За грязным стеклом — серая пелена ноябрьского утра, размытые силуэты вышек, ржавые зубья колючей проволоки на бетонном заборе.

Закрытый город. Один из сотен безымянных точек на карте СССР. Города, которых официально не существует.

— Конечная, — хрипит водитель, не оборачиваясь. Его затылок красный, как варёная свёкла. Всю дорогу он молчал, только курил папиросы одну за другой. — Приехали, товарищ.

Вы единственный пассажир. Уже шесть часов — единственный.

На соседнем сиденье — потёртый портфель с документами. На коленях — служебная папка. Внутри — докладная записка, отпечатанная на жёлтой бумаге:

"СЕКРЕТНО. Красногорск-12. За период 1984-1986 гг. зафиксировано семь (7) случаев исчезновения граждан. Тела не обнаружены. Местные органы бездействуют. Рекомендуется направить следователя по особо важным делам для проверки."

Следователь Виктор Андреевич Сорокин. Сорок два года. Разведён. Детей нет.

Восемь лет назад — Афганистан. Два года в горах, где люди исчезали каждую ночь. Вернулся с медалью и бессонницей, которая не отпускает до сих пор.

В три часа ночи вы обычно лежите, глядя в потолок. Считаете трещины на штукатурке. Иногда — слышите голоса тех, кого не смогли спасти.

Вас послали сюда, потому что вы — упрямый. Потому что не умеете отступать. И потому что никто другой не согласился ехать в эту глушь в разгар зимы.

"Простая командировка", — сказал начальник. — "Неделя максимум. Съездишь, напишешь отчёт, вернёшься".

Почему-то вы ему не поверили.

За окном автобуса — лес. Чёрные сосны стоят плотной стеной, как часовые. Их кроны покачиваются на ветру, хотя внизу — полный штиль.

Странно.

* [Выйти из автобуса]
    Вы поднимаетесь, забираете портфель. Спина ноет после шести часов на жёсткой скамейке.
    
    Водитель всё так же смотрит вперёд. Не прощается. Не желает удачи.
    
    Дверь открывается со скрипом.
    
    -> ep1_checkpoint

=== ep1_checkpoint ===

# mood: tense

Холод обрушивается сразу — жёсткий, колючий, пробирающий до костей. Минус пятнадцать, не меньше. Ветер несёт мелкий снег, который сечёт лицо, как наждачная бумага.

Пахнет серой — резкий, химический запах, от которого першит в горле. И хвоей — густой, смолистый аромат тайги. И ещё чем-то... сладковатым? Странным?

Вы делаете глубокий вдох. Лёгкие обжигает.

КПП — бетонная будка с узкими окнами-бойницами. Над дверью — красная звезда, облупившаяся от времени. Рядом — шлагбаум, полосатый, как зебра. За ним — вышка с прожектором, выключенным сейчас, но направленным прямо на дорогу.

Двое солдат в серых тулупах. Молодые — лет по двадцать. У одного — автомат на плече, у другого — планшет с документами. Лица красные от холода, глаза настороженные.

Они смотрят на вас так, словно вы — инопланетянин.

Первый солдат — тот, что с планшетом — делает шаг навстречу. Протягивает руку:

— Документы. Цель визита.

Вы достаёте удостоверение. Красная корочка с золотым тиснением. "Прокуратура РСФСР. Следователь по особо важным делам."

— Командировка. Служебное расследование.

Солдат берёт удостоверение. Изучает. Долго — слишком долго. Его напарник отступает к будке, снимает телефонную трубку, говорит что-то тихо, прикрывая рот ладонью.

За забором — город. Пятиэтажки, дымящие трубы завода, площадь с памятником. Всё серое, размытое в снежной пелене.

И лес. Везде — лес. Чёрной стеной окружает город со всех сторон.

— Ждите.

Солдат возвращает удостоверение. Отступает.

Вы ждёте. Минута. Две. Три.

Снег забивается за воротник. Ноги начинают неметь. Автобус за спиной — уезжает, не дождавшись. Водитель даже не посигналил на прощание.

Вы остались одни.

Наконец — скрип двери КПП. Выходит офицер. Старший лейтенант, судя по погонам. Лицо — серое, усталое. Под глазами — тёмные круги. Он выглядит так, словно не спал неделю.

— Следователь Сорокин?

— Да.

— Вас ждут. — Он указывает на "УАЗик", припаркованный за шлагбаумом. — Садитесь. Отвезу.

* [Пройти молча — наблюдать]
    Вы молча идёте к машине. Наблюдаете.
    
    ~ change_style(-3)
    
    Офицер нервничает. Его руки слегка дрожат, когда он открывает дверь "УАЗика". Под ногтями — чёрная грязь. Или... что-то другое?
    
    На заднем сиденье машины — папка. Красная. "ДСП" — для служебного пользования. Офицер быстро убирает её в бардачок.
    
    Интересно. Что они скрывают?
    
    -> ep1_silent_observation

* [Задать вопросы — кто такой Громов?]
    Вы делаете шаг к машине. Останавливаетесь.
    
    — Кто ждёт?
    
    — Майор Громов. Степан Петрович. Начальник городского отдела милиции.
    
    Офицер не смотрит вам в глаза. Его взгляд скользит мимо — куда-то в сторону леса.
    
    — Он... в курсе вашего приезда.
    
    Что-то в его голосе. Предупреждение? Страх?
    
    -> ep1_ask_about_gromov

* [Показать власть — потребовать уважения]
    — Я буду ждать в тепле, — говорите вы холодно. — Проводите меня в здание КПП.
    
    ~ change_style(5)
    ~ city_reputation = city_reputation - 5
    
    Офицер открывает рот, чтобы возразить, но что-то в вашем взгляде останавливает его.
    
    — Как скажете, товарищ следователь.
    
    Внутри КПП — тепло и накурено. На стене — портрет Генсека, календарь с видами Крыма, расписание дежурств.
    
    Вы замечаете доску объявлений. "ВНИМАНИЕ! При обнаружении посторонних лиц в районе Красного леса — НЕМЕДЛЕННО сообщать дежурному!"
    
    Красный лес. Интересно.
    
    -> ep1_kpp_inside

* [Осмотреться — изучить территорию]
    Вы делаете вид, что идёте к машине, но замедляете шаг. Оглядываетесь.
    
    За КПП — ещё одна вышка. На ней — часовой с биноклем. Смотрит не на дорогу — на лес.
    
    У забора — следы. Странные следы. Не человеческие, не звериные. Что-то среднее.
    
    Вы наклоняетесь, будто завязываете шнурок. Рассматриваете следы ближе.
    
    Пять пальцев. Но слишком длинные. И когти.
    
    { not (AfghanMemories ? memory_cave):
        Это напоминает вам кое-что из прошлого...
        -> flashback_cave ->
    }
    
    ~ cult_awareness = cult_awareness + 1
    
    Офицер окликает:
    — Товарищ следователь? Машина ждёт.
    
    -> ep1_city_entrance

=== ep1_silent_observation ===
# mood: mystery

Вы садитесь в машину. Молчите. Наблюдаете.

Офицер ведёт "УАЗик" по разбитой дороге. Его глаза — в зеркале заднего вида — несколько раз ловят ваш взгляд. Он нервничает всё больше.

— Вы... надолго к нам? — наконец спрашивает он.

* [Молчать дальше]
    Вы не отвечаете. Просто смотрите в окно.
    
    Офицер сглатывает. Его адамово яблоко дёргается.
    
    — Понимаю. Секретность. Конечно.
    
    Молчание продолжается. Вы узнаёте больше из этого молчания, чем из любых слов.
    
    Офицер боится. Не вас — чего-то другого.
    
    -> ep1_city_entrance

* ["Пока не закончу работу"]
    — Пока не закончу работу.
    
    — А... какая работа? Если не секрет, конечно.
    
    — Секрет.
    
    Офицер замолкает. Но его руки на руле дрожат сильнее.
    
    -> ep1_city_entrance

* [Спросить про "Красный лес"]
    — Что такое "Красный лес"?
    
    Офицер резко поворачивает голову. Машина вильяет.
    
    — Что? Где вы... — Он осекается. — Это... просто лес. К востоку от города. Там... старые шахты. Опасно. Мы туда не ходим.
    
    — Почему "красный"?
    
    — Сосны там... какие-то... красноватые. От почвы, наверное. Или от... не знаю.
    
    Он явно врёт. Или не говорит всего.
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_city_entrance

=== ep1_ask_about_gromov ===
# mood: tense

— Расскажите о Громове, — говорите вы, садясь в машину.

Офицер заводит двигатель. Не сразу отвечает.

— Степан Петрович? Хороший человек. Строгий, но справедливый. Двадцать лет в органах. Воевал. Награждён.

— Но?

Офицер бросает на вас быстрый взгляд.

— Нет никакого "но", товарищ следователь.

* [Надавить — "Вы что-то скрываете"]
    — Я вижу, когда люди врут, — говорите вы холодно. — Двадцать лет практики. Так что — "но"?
    
    ~ change_style(5)
    
    Офицер бледнеет.
    
    — Я... После этих исчезновений... Степан Петрович изменился. Стал... замкнутым. Нервным. Иногда уезжает ночью. Никому не говорит — куда.
    
    Он сглатывает.
    
    — Я ничего не говорил. Вы ничего не слышали. Договорились?
    
    ~ trust_gromov = trust_gromov - 5
    ~ boost_theory(2, 10)
    
    Интересно. Начальник милиции — нервный, скрытный, уезжает по ночам. Классический профиль человека с секретом. Или... виновного?
    
    -> ep1_city_entrance

* [Сменить тему — спросить про исчезновения]
    — Ладно. Расскажите про исчезновения.
    
    — Это... не моя компетенция. Громов всё объяснит.
    
    — Но вы слышали разговоры. Что говорят люди?
    
    Офицер долго молчит. "УАЗик" подпрыгивает на колдобине.
    
    — Говорят... что лес забирает. Что это проклятие. Что началось после... — Он осекается. — Глупости. Суеверия. Не обращайте внимания.
    
    — После чего началось?
    
    — После закрытия старой шахты. В восемьдесят третьем. Но это просто совпадение.
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_city_entrance

* [Просто наблюдать]
    Вы киваете и смотрите в окно.
    
    Сиденье — ледяное. Движок работает, но печка, похоже, сломана.
    
    "УАЗик" трогается. Шлагбаум поднимается.
    
    Добро пожаловать в Красногорск-12.
    
    -> ep1_city_entrance

=== ep1_kpp_inside ===
# mood: investigation

Вы осматриваете КПП. Тесная комнатушка. Стол, телефон, сейф.

На столе — журнал регистрации. Открыт на последней странице.

* [Заглянуть в журнал]
    Пока офицер отвлёкся, вы быстро просматриваете записи.
    
    "14.11.86 — Грузовик ЗИЛ-130, гос. номер XXXXXX, груз: оборудование. Назначение: завод 'Прометей'. Разрешение — Астахов А.В."
    
    Астахов. Это имя ещё всплывёт.
    
    "12.11.86 — Чёрная 'Волга', гос. номер — ЗАСЕКРЕЧЕНО. Три пассажира. Разрешение — ОСОБОЕ."
    
    Чёрная "Волга" с засекреченными номерами. За три дня до вашего приезда.
    
    Кто-то знал, что вы приедете?
    
    ~ cult_awareness = cult_awareness + 1
    
    Офицер возвращается.
    
    — Товарищ следователь? Машина готова.
    
    -> ep1_city_entrance

* [Спросить про "Красный лес"]
    — Я заметил объявление. "Красный лес". Что это за место?
    
    Офицер, наливавший чай, замирает.
    
    — Это... закрытая зона. Старые выработки. Там... опасно. Обвалы.
    
    — А почему "немедленно сообщать"? Из-за обвалов?
    
    Он ставит чайник. Руки дрожат.
    
    — Там иногда... пропадают люди. Которые не слушают предупреждений. Мы должны знать, если кто-то туда пошёл. Для спасательных операций.
    
    Логично. Но он явно недоговаривает.
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_city_entrance

* [Ехать к Громову]
    Хватит. Нужно встретиться с Громовым лично.
    
    — Я готов.
    
    -> ep1_city_entrance

=== ep1_city_entrance ===

# mood: mystery

Город открывается постепенно, как рана, с которой сняли бинт.

Сначала — промзона. Ржавые трубы, почерневшие от копоти стены, горы шлака у дороги. Завод "Прометей" — огромный, как спящее чудовище. Его трубы выбрасывают столбы белого дыма, который смешивается с низкими облаками.

Запах серы здесь сильнее. К нему примешивается что-то ещё — металлический привкус, оседающий на языке.

Вы вспоминаете учебники криминалистики. Многие промышленные яды могут вызывать галлюцинации, паранойю, потерю памяти. Свинец, ртуть, некоторые органические соединения...

Может, "странности" этого города — просто результат хронического отравления? Это объяснило бы многое.

~ boost_theory(1, 5)

"УАЗик" подпрыгивает на выбоинах. Офицер за рулём молчит. Его пальцы — белые от напряжения — сжимают руль.

Потом — жилые кварталы. Пятиэтажки-хрущёвки, одинаковые, как коробки. Серые стены, узкие окна, бельё на балконах. Дворы — пустые. Ни детей, ни стариков на лавочках.

Одиннадцать утра буднего дня. Где все?

Вы замечаете людей — редких прохожих, спешащих по своим делам. Но они... странные. Идут быстро, опустив головы. Не разговаривают. Не смотрят друг на друга.

И не смотрят на вашу машину. Демонстративно отворачиваются.

Словно вас не существует.

— Всегда здесь так тихо? — спрашиваете вы.

Офицер вздрагивает. Словно забыл, что вы в машине.

— Что? А... да. Тихий город. Рабочий.

Он снова замолкает.

"УАЗик" проезжает мимо Дома культуры "Прометей" — монументального здания с колоннами и мозаикой на фасаде. Рабочий с молотом, женщина с колосьями, звезда. На доске объявлений — афиши. "Лекция о вреде алкоголизма". "Концерт самодеятельности". "Собрание парткома — ОБЯЗАТЕЛЬНО".

Последняя афиша — месячной давности.

Больница №1 — трёхэтажное здание жёлтого кирпича. У входа — скорая помощь с выключенными фарами. Никого не видно — ни врачей, ни пациентов.

Площадь с памятником Ленину. Вождь указывает рукой на восток — туда, где за городом чернеет стена леса. У его ног — клумба, засыпанная снегом. Фонари — выключены, хотя небо затянуто тучами и темно, как вечером.

Гостиница "Урал" — сталинская постройка, помпезная и обветшалая. Башенки на крыше, лепнина на фасаде, вывеска с перегоревшими буквами. "ГОС ИНИЦ УРАЛ".

Всё как везде. Типичный советский городок.

И всё — не так.

Слишком тихо. Слишком пусто. Слишком много тёмных окон в домах — даже днём.

Вы ловите себя на мысли: этот город — как декорация. Как макет. Всё на месте, но жизни — нет.

"УАЗик" останавливается у серого трёхэтажного здания. Над входом — табличка: "ГОРОДСКОЙ ОТДЕЛ ВНУТРЕННИХ ДЕЛ".

— Приехали.

Офицер не выходит. Не помогает с вещами. Просто сидит, глядя перед собой.

— Спасибо, — говорите вы.

Он кивает. Не поворачиваясь.

Вы выходите. Захлопываете дверь.

"УАЗик" срывается с места так, словно за ним гонятся.

Вы остаётесь один. Перед серым зданием. Под серым небом. В сером городе.

Ветер несёт снежную крупу. Где-то вдалеке — гудок завода.

И тишина. Давящая, звенящая тишина.

* [Войти в отдел милиции]
    Вы поднимаетесь по ступеням. Дверь — тяжёлая, деревянная, с облупившейся краской — открывается со скрипом.
    
    Внутри — запах канцелярии: чернила, бумага, застоявшийся сигаретный дым. И что-то ещё — еле уловимый запах страха.
    
    За стойкой дежурного — пусто.
    
    — Есть кто?
    
    Тишина.
    
    Потом — шаги. Скрип двери в конце коридора.
    
    — Товарищ Сорокин? Сюда. Майор ждёт.
    
    -> ep1_meet_gromov

=== ep1_meet_gromov ===

~ MetCharacters += gromov

# mood: investigation

Коридор — длинный, тёмный, с облупившимися стенами. Лампы под потолком мигают, как в фильме ужасов. Двери по обе стороны — закрыты. За ними — тишина.

Кабинет начальника — в конце коридора. Табличка на двери: "Майор С.П. Громов. Начальник ГОВД".

Буквы — золотые на чёрном фоне. Единственная ухоженная вещь в этом здании.

Вы стучите.

— Да-да, входите.

Кабинет — просторный, но захламлённый. Шкафы с папками вдоль стен. Сейф в углу. Портрет Андропова над столом — пыльный, забытый.

За столом — человек.

Майор Громов. Лет пятьдесят пять, может — шестьдесят. Грузный, с широкими плечами, которые когда-то были могучими, а теперь обвисли под тяжестью лет и водки. Седые усы — пожелтевшие от табака. Красное лицо — россыпь лопнувших капилляров на щеках. Глаза — мутноватые, с красными прожилками, но... умные. Даже сейчас, за маской алкоголика — умные и настороженные.

На столе — стакан. Початая бутылка "Столичной". Пепельница, полная окурков. Папка — тонкая, потрёпанная.

— А, следователь из Москвы.

Голос — хриплый, прокуренный. Громов не встаёт. Не протягивает руки.

— Из Свердловской областной прокуратуры, — поправляете вы.

— Какая разница. — Громов машет рукой. — Садитесь.

Вы садитесь. Стул скрипит под вами.

Громов смотрит. Оценивает. Вы делаете то же самое.

Этот человек — не дурак. Это первое, что вы понимаете. Несмотря на всё — на водку, на затхлый кабинет, на провинциальную глушь — он не дурак.

И он — боится. Это второе.

Громов наливает водку в два стакана. Толстые грани стекла. Жидкость — прозрачная, с маслянистым блеском.

— С приездом, товарищ Сорокин. — Он двигает стакан к вам. — За знакомство.

* [Выпить с ним]
    Вы берёте стакан. Холодное стекло в ладони.
    
    — За знакомство.
    
    Водка обжигает горло. Крепкая — градусов сорок пять, не меньше. Не магазинная. Самогон?
    
    Громов одобрительно кивает. Выпивает свой стакан залпом.
    
    ~ trust_gromov = trust_gromov + 10
    
    — Вот это по-нашему. А то присылают иногда... интеллигенцию.
    
    Он наливает ещё. Себе. Вам не предлагает — уважает меру.
    
    — Значит, Виктор Андреевич. Следователь по особо важным делам. Афганистан, две награды, рекомендации... — Он хмыкает. — Серьёзный человек. Зачем вас сюда послали — в нашу глушь?
    
    -> ep1_gromov_talk

* [Отказаться]
    — Благодарю, Степан Петрович. На службе не пью.
    
    Громов замирает. Его глаза — сужаются на мгновение. Потом он хмыкает. Выпивает оба стакана — один за другим, без паузы.
    
    ~ trust_gromov = trust_gromov - 5
    
    — Принципиальный, значит. — В его голосе — ирония. И что-то ещё. Разочарование? — Ну-ну. Здесь это редкость.
    
    Он отставляет бутылку. Но не убирает — оставляет на виду.
    
    — Значит, товарищ Сорокин. Следователь по особо важным делам. Что вас к нам привело?
    
    -> ep1_gromov_talk

=== ep1_gromov_talk ===

Громов откидывается на спинку кресла. Оно скрипит — жалобно, протяжно.

— Так вот, товарищ Сорокин. Насчёт вашего дела...

Он достаёт папку из ящика стола. Тонкую — подозрительно тонкую. Картон — потёртый, серый. На обложке — штамп: "ДЕЛО №147-86. ЗОРИН А.П. ИСЧЕЗНОВЕНИЕ".

Громов кладёт папку на стол. Не открывает.

— Инженер Зорин Алексей Павлович. Сорок семь лет. Работал на заводе "Прометей", отдел спецтехнологий. Женат не был, вдовец. Дочь — Татьяна, двадцать три года, инженер на том же заводе.

Он говорит монотонно, как заученный текст.

— Двадцать третьего октября Зорин вышел с работы в восемнадцать часов сорок две минуты. Это зафиксировано. На проходной — подпись в журнале. После этого... — Громов разводит руками. — Всё. Испарился. Домой не пришёл. Никто не видел. Никаких следов.

— Тело?

— Не нашли. — Громов смотрит в окно. За стеклом — серое небо, верхушки сосен вдалеке. — Тайга, товарищ Сорокин. Медведи. Волки. Болота. Человек отошёл на сто метров от дороги — и всё. Ищи ветра в поле.

Его голос — ровный. Слишком ровный.

— А вы искали?

Пауза.

Громов наливает себе ещё водки. Не пьёт — просто держит стакан.

— Искали. Три дня. Прочёсывали лес. С собаками. — Он качает головой. — Ничего. Ни следов, ни... ничего.

* [Запросить материалы дела]
    — Мне нужны все материалы. Протоколы осмотров, показания свидетелей, заключения экспертов.
    
    Громов смотрит на вас. Долго.
    
    — Всё здесь. — Он кивает на папку. — Десять страниц.
    
    — Десять страниц? — Вы не скрываете удивления. — За три недели расследования — десять страниц?
    
    Громов молчит. Его пальцы — белые — сжимают стакан.
    
    — Больше не набралось.
    
    Ложь. Вы чувствуете это так же ясно, как запах перегара в комнате.
    
    -> ep1_gromov_silence

* [Спросить о других пропавших]
    — Зорин — не первый.
    
    Громов замирает. Стакан в его руке дрожит — еле заметно.
    
    — Что?
    
    — Семь человек за два года. — Вы смотрите ему в глаза. Не отводите взгляд. — Поэтому меня и прислали, Степан Петрович. Не из-за одного инженера.
    
    Долгая пауза. За окном — карканье вороны. Резкое, неприятное.
    
    — Откуда... откуда у вас эти сведения?
    
    — Из докладной записки. Кто-то написал в прокуратуру. Анонимно.
    
    Громов бледнеет. Его красное лицо становится серым — как стены этого города.
    
    ~ cult_awareness = cult_awareness + 1
    ~ CluesA += missing_list
    ~ evidence_collected = evidence_collected + 1
    
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

В кабинете повисает тишина. Густая, вязкая — как болотная жижа.

За стеной — шаги. Кто-то ходит по коридору. Туда-сюда, туда-сюда.

Громов наливает водку. Выпивает. Не предлагает вам.

— Послушайте, Сорокин. — Его голос — тихий, хриплый. Он подаётся вперёд, опираясь локтями о стол. — Вы приехали сюда ненадолго. Неделя, две — и уедете. В Свердловск, в Москву, куда угодно. К нормальной жизни.

Пауза.

— А нам здесь жить. Понимаете? Нам. Здесь. Жить.

Он смотрит вам в глаза. Впервые за весь разговор — прямо, не отводя взгляда.

— Что вы хотите этим сказать, Степан Петрович?

— Ничего. — Он откидывается назад. Кресло скрипит. — Просто... дружеский совет. От человека, который здесь тридцать лет. Не копайте слишком глубоко. Напишите отчёт — несчастный случай, тайга, медведи — и уезжайте.

Его глаза — усталые, красные — молят вас. О чём? О понимании? О пощаде?

За окном — снова карканье. Ближе, чем раньше.

* [Это угроза?]
    — Вы мне угрожаете, товарищ майор?
    
    Вы говорите спокойно, но внутри — напряжение. Рука — ближе к поясу, где под пиджаком — кобура.
    
    Громов качает головой. Устало, обречённо.
    
    — Боже упаси. Угрозы... — Он горько усмехается. — Нет, товарищ следователь. Это не угроза. Это... просто совет. Дружеский. От человека, который знает этот город. Знает, что здесь бывает с теми, кто... копает слишком глубоко.
    
    Он замолкает. Не договаривает.
    
    Но вы понимаете.
    
    -> ep1_gromov_end

* [Принять к сведению]
    — Я учту ваши слова, Степан Петрович.
    
    Вы говорите ровно, не показывая эмоций. Но внутри — заметка. Этот человек — не враг. Он сломлен. Запуган. Чем?
    
    Громов кивает. В его глазах — благодарность? облегчение?
    
    ~ trust_gromov = trust_gromov + 5
    
    — Хорошо. Хорошо, что вы... разумный человек.
    
    Он снова тянется к бутылке.
    
    -> ep1_gromov_end

=== ep1_gromov_others ===

— Семь человек за два года. — Вы кладёте руки на стол, наклоняетесь вперёд. — Скажите мне, Степан Петрович. Все они — несчастные случаи? Все — заблудились в тайге? Всех съели медведи?

Громов бледнеет. Не отвечает.

— Зорин — инженер. Местный, родился здесь. Знал лес с детства. Петрова — медсестра из больницы, пятьдесят два года, никогда не выходила за периметр. Костров — студент, приехал на практику, исчез через две недели. Савельева — учительница, жила здесь двадцать лет...

Вы перечисляете имена. Из докладной записки — той, что лежит у вас в портфеле.

— ...и все они, по вашим словам, просто исчезли. Без следа. Без тел. Без улик.

Громов молчит. Его руки — трясутся. Он сцепляет их на столе, пытаясь унять дрожь.

— Вы не понимаете. — Его голос — еле слышный шёпот. — Вы не понимаете, с чем имеете дело.

* [Так объясните мне]
    -> ep1_gromov_explain

* [Вы что-то скрываете — что-то личное]
    Вы смотрите на него. Внимательно. Глаза следователя — привыкшие читать людей.
    
    Красное лицо. Дрожащие руки. Страх в глазах — но не за себя. Не совсем за себя.
    
    — Вы не просто боитесь, Степан Петрович. Вы... что-то потеряли. Здесь. Кого-то.
    
    Громов замирает. Его лицо — окаменело.
    
    — Откуда...
    
    — Я следователь. Это моя работа — видеть.
    
    Долгая пауза. Громов смотрит на вас. В его глазах — что-то ломается. Броня, которую он носил годами — трескается.
    
    — Девятнадцать лет назад. — Его голос — еле слышный. — Моя дочь.
    
    ~ CharacterSecrets += gromov_daughter
    ~ understanding_gromov += 20
    
    -> ep1_gromov_daughter

=== ep1_gromov_daughter ===

# mood: emotional

Громов наливает водку. Выпивает залпом. Наливает ещё.

— Анечка. Ей было семнадцать. — Его голос дрожит. — Красивая. Умная. Собиралась в Москву поступать. На филолога.

Он достаёт из ящика стола фотографию. Девушка в школьной форме. Светлые волосы, улыбка — такая чистая, такая живая.

— Июль шестьдесят седьмого. Выпускной. Она пошла гулять с подругами. Вечером. Они хотели — к реке, посидеть, попеть песни.

Он замолкает. Его пальцы сжимают фотографию так, что бумага мнётся.

— Не дошли. Подруги вернулись — без неё. Сказали — она отстала. Хотела посмотреть на закат. Над лесом.

~ CharacterSecrets += gromov_breakdown
~ understanding_gromov += 25

{ sanity < 60:
    «...она слышала нас...»
    «...она пришла...»
    «...она с нами...»
    
    ~ lose_sanity(3)
}

* [Что случилось?]
    — И?
    
    — Никогда не вернулась. — Громов смотрит в окно. На лес. — Искали неделю. Всем городом. Солдаты с завода помогали. Ничего. Ни следа. Ни...
    
    Он не заканчивает. Не может.
    
    -> ep1_gromov_aftermath

* [Вы её нашли?]
    Громов качает головой. Медленно. Тяжело.
    
    — Нет. Никто не нашёл. Как будто... как будто её никогда не было.
    
    Он вытирает глаза тыльной стороной ладони. Старый жест. Привычный.
    
    — Жена ушла через год. Не смогла больше. Уехала к сестре в Киев. Развод по почте. Я даже не виню её.
    
    -> ep1_gromov_aftermath

=== ep1_gromov_aftermath ===

# mood: dark

— Я знаю, что случилось с моей дочерью, товарищ Сорокин. — Громов смотрит на вас. Его глаза — пустые. Выгоревшие. — Знаю — но не могу доказать. Не могу даже сказать вслух.

— Что вы знаете?

Он встаёт. Подходит к окну. Смотрит на лес.

— Они забрали её. — Шёпот. — Те, кто живёт под землёй. Те, кто служит... чему-то. В пещерах.

Пауза.

— Я был молодым тогда. Сильным. Верил в закон, в справедливость. Пошёл на завод — требовать ответов. Меня выкинули. Пошёл к начальству — меня перевели. Написал в Москву — письмо вернулось. "Не подтверждено. Дело закрыто."

Он поворачивается к вам.

— Тогда я понял. Понял, как это работает. Понял, что нельзя победить. Можно только... выжить. Закрыть глаза. Не задавать вопросов. И молиться, чтобы они не пришли снова.

~ EmotionalScenes += scene_gromov_drunk
~ trust_gromov += 15
~ cult_awareness += 3

* [Почему вы всё ещё здесь?]
    — После всего этого — почему не уехали?
    
    — Потому что... — Громов горько усмехается. — Потому что однажды я найду её. Живую или... или то, что от неё осталось. Я должен знать. Понимаете? Должен знать, что с ней случилось.
    
    Он возвращается к столу. Садится тяжело, как старик.
    
    — И ещё — потому что кто-то должен быть здесь. Кто-то, кто знает правду. Кто будет предупреждать. Таких, как вы. Приезжих.
    
    ~ CharacterSecrets += gromov_redemption
    ~ understanding_gromov += 15
    
    -> ep1_gromov_serafim

* [Кто "они"?]
    — Кто забрал вашу дочь? Кто эти "они"?
    
    Громов молчит. Качает головой.
    
    — Не могу. Если скажу — они узнают. Они всегда узнают.
    
    Но потом — оглядывается на дверь. Понижает голос:
    
    -> ep1_gromov_serafim

=== ep1_gromov_serafim ===

— Поговорите со священником. Отец Серафим. Старая церковь — на окраине, за частным сектором. Её официально закрыли в шестидесятых, но он там... живёт.

— Что он знает?

— Больше, чем я. — Громов смотрит в окно. На лес. — Больше, чем кто-либо из нас. Он... он был здесь с самого начала. Ещё до завода. Ещё до...

Он замолкает. Его лицо — маска страха.

— Ещё до чего?

Громов молчит. Качает головой. Больше ничего не скажет — это ясно.

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesD ? serafim_legends):
    ~ CluesD += serafim_legends
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: совет Громова — найти отца Серафима
}

* [Поблагодарить]
    — Спасибо, Степан Петрович. Я поговорю с ним.
    
    Громов кивает. Не смотрит на вас.
    
    ~ trust_gromov += 10
    
    — Будьте осторожны. С кем говорите. Что спрашиваете. Этот город... — Он не заканчивает. — Просто будьте осторожны.
    
    -> ep1_gromov_end

=== ep1_gromov_explain ===

— Так объясните мне.

Долгая пауза. За окном — ветер. Стёкла дребезжат в рамах.

Громов встаёт. Подходит к двери. Открывает — проверяет коридор. Закрывает. Поворачивает ключ в замке.

Возвращается к столу. Садится. Наливает водку — руки всё ещё трясутся, жидкость плещется через край.

— Не могу. — Он качает головой. — Не могу, товарищ Сорокин. Если я... если я скажу... — Он не заканчивает.

Но потом — оглядывается на дверь. Понижает голос до едва различимого шёпота:

— Поговорите со священником. Отец Серафим. Старая церковь — на окраине, за частным сектором. Её официально закрыли в шестидесятых, но он там... живёт.

— Что он знает?

— Больше, чем я. — Громов смотрит в окно. На лес. — Больше, чем кто-либо из нас. Он... он был здесь с самого начала. Ещё до завода. Ещё до...

Он замолкает. Его лицо — маска страха.

— Ещё до чего?

Громов молчит. Качает головой. Больше ничего не скажет — это ясно.

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesD ? serafim_legends):
    ~ CluesD += serafim_legends
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: совет Громова — найти отца Серафима
}

* [Поблагодарить]
    — Спасибо, Степан Петрович. Я поговорю с ним.
    
    Громов кивает. Не смотрит на вас.
    
    ~ trust_gromov = trust_gromov + 10
    
    — Будьте осторожны. С кем говорите. Что спрашиваете. Этот город... — Он не заканчивает. — Просто будьте осторожны.
    
    -> ep1_gromov_end

=== ep1_gromov_end ===

Громов встаёт. Тяжело, опираясь о стол — как будто ему внезапно добавили двадцать лет.

Он берёт папку со стола. Протягивает вам.

— Вот. Всё, что есть. — Пауза. — Всё, что я могу вам дать.

Вы берёте папку. Десять страниц. Может быть — десять процентов правды.

— Гостиница "Урал". Номер двенадцать — забронирован для вас. Завтрак, обед, ужин — в столовой на первом этаже. За счёт горисполкома.

Он подходит к окну. Стоит спиной к вам.

За стеклом — улица. Серые здания, пустой тротуар. И лес — чёрной стеной на горизонте.

Небо темнеет. Три часа дня — а уже сумерки. Ноябрь на Урале. Ночь приходит рано.

— И, Сорокин...

Громов не оборачивается. Его голос — глухой, усталый.

— Не гуляйте ночью. Особенно — не ходите в лес.

* [Почему?]
    — Волки?
    
    Долгая пауза.
    
    — Если бы волки... — бормочет Громов. Его плечи — опущены, ссутулены. — Если бы только волки.
    
    Он не объясняет. Не оборачивается.
    
    Разговор окончен.
    
    -> ep1_leave_militia

* [Уйти молча]
    Вы не спрашиваете. Иногда молчание — лучший ответ.
    
    — До свидания, Степан Петрович.
    
    Он не отвечает. Стоит у окна, глядя на лес.
    
    Вы выходите. Дверь закрывается за вами.
    
    В коридоре — холодно. Темно. Лампы мигают.
    
    -> ep1_leave_militia

=== ep1_leave_militia ===

# mood: dark

Вы выходите на улицу.

Темно. Когда успело стемнеть? Вы пробыли у Громова... час? Полтора? А ощущение — что прошли сутки.

Небо — низкое, давящее. Тучи — чёрные, набухшие снегом. Фонари вдоль улицы — не горят. Окна домов — тёмные, мёртвые.

Ни души. Ни звука.

Только ветер. Он несёт снежную крупу, которая сечёт лицо. И запах — серный, химический запах завода. И ещё что-то... сладковатое. Гниловатое.

Вы идёте по тротуару. Шаги гулко отдаются в тишине.

Поворачиваете за угол.

И —

На мгновение — вам кажется, что из переулка кто-то смотрит.

Тень. Человеческий силуэт. Высокая фигура, неподвижная, стоящая в темноте между домами.

Два глаза. Блестят? Или отражают свет?

Вы моргаете.

Там — никого. Пустой переулок. Мусорные баки. Стена с облупившейся штукатуркой.

Показалось?

{ sanity < 80:
    Вы стоите неподвижно. Смотрите в переулок.
    
    Пусто. Темно. Тихо.
    
    Но... было ли там что-то? Кто-то?
    
    Вы не уверены. Уже не уверены.
    
    Этот город... он давит. С самого приезда. Словно стены смыкаются.
    
    ~ lose_sanity(2)
    
    Вы встряхиваетесь. Усталость. Просто усталость. Шесть часов в автобусе, странный разговор с Громовым... неудивительно, что мерещится.
}

За спиной — звук.

Вы резко оборачиваетесь.

Ворона. Чёрная, с глянцевым оперением. Сидит на фонарном столбе. Смотрит на вас.

Каркает. Один раз. Резко.

И улетает — в сторону леса.

* [Идти в гостиницу]
    Хватит. Нужно отдохнуть. Разобраться с мыслями.
    
    Вы ускоряете шаг.
    
    Гостиница "Урал" — в ста метрах. Её силуэт темнеет на фоне неба. Башенки на крыше, лепнина на фасаде.
    
    Единственное освещённое здание на улице. В окнах первого этажа — тёплый жёлтый свет.
    
    Почти... уютно.
    
    Почти.
    
    -> ep1_hotel

=== ep1_hotel ===

~ MetCharacters += klava

Гостиница "Урал".

Внутри — тепло. Сразу после уличного холода — почти жарко. Паровое отопление работает на полную. Батареи гудят, трубы постукивают.

Вестибюль — просторный, с высоким потолком. Паркет — потёртый, скрипучий. На стенах — картины в тяжёлых рамах: горы, леса, заводские панорамы. Люстра под потолком — хрустальная, пыльная, с половиной перегоревших лампочек.

Советская роскошь. Обветшалая, забытая, но всё ещё пытающаяся держать марку.

За стойкой регистрации — женщина.

Лет шестьдесят. Может — шестьдесят пять. Химическая завивка — серо-рыжая, как ржавчина. Очки — толстые, с роговой оправой. Кофта — вязаная, с оленями.

И глаза. Любопытные, живые, цепкие — как у сороки, заметившей блестящую вещицу.

Она смотрит на вас с того момента, как вы вошли. Не скрывая интереса.

— Ой! — Она всплёскивает руками. — А вы тот самый следователь? Из области?

Вы подходите к стойке.

— Сорокин, Виктор Андреевич. Номер двенадцать должен быть забронирован.

— Знаю, знаю! — Она уже листает толстый журнал. — Звонили из милиции. Сказали — ждать важного гостя.

Она поднимает на вас глаза. Хитрые, оценивающие.

— А я — Клавдия Петровна. Клава. Тут все так зовут. — Пауза. — Вы у нас надолго?

— Как пойдёт расследование.

— Расследование... — Она понижает голос. — Это вы про Зорина, да? Про Алексея Палыча?

Вы не отвечаете. Просто смотрите.

Клава вздыхает.

— Бедный Алексей Палыч. Хороший был человек. Тихий. Книжки читал, дочку растил... И вот — пропал. Как сквозь землю провалился.

Она достаёт ключ. Большой, латунный, с деревянной биркой.

— Номер двенадцать. Третий этаж. Там тихо, не беспокоят.

Потом — наклоняется ближе. Шёпотом:

— А знаете... дочка его — Таня — она про вас спрашивала. Вчера приходила.

* [Где её найти?]
    — Адрес знаете?
    
    — Улица Ленина, семь. Квартира двенадцать. Но лучше на завод идите — она там допоздна. В инженерном корпусе работает. Как отец работал.
    
    Клава вздыхает.
    
    — Переживает очень. Осунулась, похудела. Всё ищет его... всё надеется.
    
    ~ evidence_collected = evidence_collected + 1
    
    Вы запоминаете адрес.
    
    -> ep1_klava_gossip

* [Что она хотела?]
    — Что она спрашивала?
    
    Клава оглядывается — словно проверяя, нет ли кого рядом.
    
    — Приедет ли следователь. Настоящий, говорит. Не местный. — Она понижает голос ещё сильнее. — Она уверена, что отца убили. Говорит — не верит в несчастный случай. Говорит — милиция что-то скрывает.
    
    Пауза.
    
    — А я ей и говорю — Танечка, ты осторожнее. Не надо такое говорить. А она — "Мне всё равно, тётя Клава. Я правду узнаю".
    
    Клава качает головой.
    
    — Упрямая девочка. Как отец был.
    
    -> ep1_klava_gossip

=== ep1_klava_gossip ===

Клава оглядывается. Быстро, нервно — как птица.

Вестибюль пуст. Тихо. За окнами — темнота.

Она наклоняется ещё ближе. Её голос — едва слышный шёпот:

— Тут странные дела творятся, товарищ следователь. Очень странные. Люди пропадают. А милиция — ничего. Говорят — несчастные случаи, тайга, медведи... — Она фыркает. — Какие медведи? Тут медведей сто лет не видели.

— Какие люди?

Клава оглядывается снова. Её пальцы — нервно теребят край кофты.

— Ну, Зорин — последний. А до него — Петрова из больницы. Марья Степановна. Пятьдесят два года, медсестра в психиатрическом отделении. Пошла домой после ночной смены — и не дошла. В двух кварталах от дома.

Пауза.

— А до неё — студент с завода. Костров Димка. Молодой совсем, двадцать лет. На практику приехал, из политеха. Весёлый был, улыбчивый... — Её голос дрожит. — Две недели тут пробыл — и всё. Испарился.

Она осекается. Смотрит куда-то мимо вас — в темноту за окном.

— А ещё раньше — учительница. Савельева. И инженер с завода, Климов. И женщина из магазина — как её... Вера? Валя? Не помню уже...

Клава встряхивается. Словно очнувшись от транса.

— Ой, что это я разболталась. Вам отдыхать надо, товарищ следователь. С дороги, устали небось...

Она отступает. Её глаза — испуганные.

* [Настоять]
    — Клавдия Петровна. — Вы говорите мягко, но твёрдо. — Это важно. Очень важно. Всё, что вы знаете.
    
    Она смотрит на вас. Колеблется.
    
    — Не здесь. — Её голос — еле слышный. — Завтра. В ресторане. В обед. Там... там народу много, безопаснее.
    
    Безопаснее? От чего?
    
    Но вы не спрашиваете. Не сейчас.
    
    ~ cult_awareness = cult_awareness + 1
    
    — Хорошо. Завтра в обед.
    
    Клава кивает. Быстро. Нервно.
    
    — А пока — отдыхайте. И... — Она понижает голос ещё сильнее. — Не гуляйте ночью. Не выходите из гостиницы. До утра.
    
    Второй раз за день вам говорят это. "Не гуляйте ночью".
    
    Что происходит в этом городе после захода солнца?
    
    -> ep1_room

* [Не давить]
    — Спасибо, Клавдия Петровна. Приму к сведению.
    
    Клава кивает. С облегчением.
    
    — Вот и хорошо. Вот и хорошо. — Она протягивает ключ. — Третий этаж, налево по коридору. Если что нужно — звоните вниз, трубка на тумбочке.
    
    Она отворачивается. Возвращается к своему журналу.
    
    Но вы замечаете — её руки дрожат.
    
    -> ep1_room

=== ep1_room ===

# mood: dark

Номер двенадцать.

Дверь открывается со скрипом — протяжным, как стон. Петли ржавые, не смазывали, наверное, со времён Сталина.

Внутри — тесно. Кровать с металлической сеткой. Тумбочка. Стул. Шкаф с покосившейся дверцей. Окно — узкое, с тяжёлыми шторами.

Пахнет нафталином и пылью. И чем-то ещё — еле уловимым, сладковатым.

Вы включаете свет. Лампочка под потолком — тусклая, сорок ватт максимум. Жёлтый свет бросает длинные тени по углам.

Вы кладёте портфель на стол. Вешаете пальто в шкаф. Садитесь на кровать.

Пружины скрипят — жалобно, как живое существо.

За окном — темнота. Абсолютная. Ни фонарей, ни освещённых окон. Словно город вымер.

Пять часов вечера. А темно — как в полночь.

Вы сидите. Смотрите в темноту за стеклом.

И тут — слышите.

Еле уловимо. На грани восприятия. Как будто где-то далеко — очень далеко — поёт хор.

Мужские голоса. Низкие, глубокие. Без слов — просто мелодия. Странная, протяжная, от которой мурашки бегут по спине.

Пение? Откуда? В такую погоду?

* [Прислушаться]
    Вы встаёте. Подходите к окну.
    
    Открываете форточку.
    
    Холодный воздух бьёт в лицо. Запах серы — резче, отчётливее. И ещё — хвоя. И что-то... сладковатое.
    
    Вы прислушиваетесь.
    
    Тишина.
    
    Пение — исчезло. Словно его выключили.
    
    Вы стоите у открытой форточки. Вдыхаете холодный воздух. Смотрите в темноту.
    
    Ничего. Тишина.
    
    { sanity < 80:
        Но вы же слышали. Точно слышали. Голоса. Пение.
        
        Или... не слышали?
        
        Вы закрываете форточку. Руки — слегка дрожат.
        
        Усталость. Просто усталость. Шесть часов в автобусе. Странный город. Странные люди.
        
        Неудивительно, что мерещится.
        
        Но...
        
        ~ KeyEvents += heard_voices
        ~ lose_sanity(3)
        
        Вы точно слышали. Голоса. Оттуда — со стороны леса.
        
        Или вам хочется так думать?
    }
    
    -> ep1_night_choice

* [Игнорировать]
    Показалось. Вы устали.
    
    Ветер в трубах. Скрип дерева. Что угодно.
    
    Вы отворачиваетесь от окна. Снимаете пиджак. Ослабляете галстук.
    
    Длинный день. Странный день.
    
    Но завтра — работа. Настоящая работа.
    
    -> ep1_night_choice

=== ep1_night_choice ===

Часы на тумбочке показывают девять вечера.

Рано ещё. Обычно вы засыпаете в час-два ночи. Бессонница — верный спутник последних лет.

На столе — папка с делом. Десять страниц. Всё, что дал Громов.

За окном — темнота. И где-то там — город. Завод. Лес.

И... что-то ещё?

Что вы будете делать?

* [Изучить материалы дела]
    Работа — лучшее лекарство от мыслей.
    
    Вы садитесь за стол. Открываете папку.
    
    Десять страниц. Посмотрим, что здесь есть.
    
    -> ep1_study_files

* [Выйти на ночную прогулку]
    "Не гуляйте ночью", — сказал Громов. "Не выходите из гостиницы", — сказала Клава.
    
    Но вы — следователь. Вы привыкли смотреть туда, куда другие боятся.
    
    Вы надеваете пальто.
    
    -> ep1_night_walk

* [Обыскать номер]
    Что-то в этом номере не так. Странный запах. Ощущение взгляда.
    
    Вы начинаете методичный обыск.
    
    -> ep1_search_room

* [Позвонить по телефону]
    На тумбочке — телефон. Внутренний, судя по виду. Но вдруг...
    
    -> ep1_phone_call

* [Открыть журнал следователя]
    Пора записать первые впечатления.
    
    -> investigator_journal

* [Лечь спать]
    Достаточно на сегодня. Завтра — работа.
    
    Вы раздеваетесь, ложитесь. Кровать — жёсткая, но терпимая.
    
    Закрываете глаза.
    
    // Хороший отдых восстанавливает рассудок
    ~ gain_sanity(5)
    
    Удивительно — вы засыпаете почти сразу. Впервые за месяцы.
    
    -> ep1_sleep

=== ep1_search_room ===
# mood: investigation

Вы начинаете с очевидного.

Шкаф. Пустой, если не считать пары ржавых вешалок и моли.

Тумбочка. Библия на церковнославянском — странно для советской гостиницы. И... записная книжка? Забытая кем-то.

Записная книжка — кожаная, потёртая. На обложке — инициалы "А.П.З."

А.П.З. Алексей Петрович Зорин?

* [Открыть записную книжку]
    Страницы — исписаны мелким почерком. Даты, цифры, схемы.
    
    "12.09.86 — Снова шумы в шахте. Частота 7.83 Гц. Резонанс Шумана? Но откуда?"
    
    "28.09.86 — Чернов нервничает. Говорит, что 'они' недовольны. Кто 'они'?"
    
    "15.10.86 — Нашёл вход. Старая вентиляционная шахта. За кладбищем. Там... что-то есть. Что-то древнее."
    
    Последняя запись:
    
    "23.10.86 — Сегодня иду туда. Если не вернусь — это не несчастный случай. Это ОНИ. Найдите Серафима. Он знает."
    
    { not (CluesC ? chernov_diary):
        ~ CluesC += chernov_diary
        ~ evidence_collected = evidence_collected + 1
        
        УЛИКА: Записная книжка Зорина — он знал об опасности.
    }
    
    ~ cult_awareness = cult_awareness + 3
    
    Серафим. Кто это?
    
    -> ep1_search_continue

* [Положить обратно — слишком опасно]
    Если это улика, её могли подбросить. Ловушка?
    
    Вы кладёте книжку на место. Но запоминаете инициалы.
    
    -> ep1_search_continue

=== ep1_search_continue ===
Вы продолжаете обыск.

Под кроватью — пыль. И... царапины на полу. Свежие. Как будто кровать двигали.

* [Отодвинуть кровать]
    Вы хватаетесь за металлическую раму. Тяжёлая, но поддаётся.
    
    Под кроватью — люк?
    
    Нет. Просто квадрат паркета, который отличается от остального — темнее, новее.
    
    Вы простукиваете. Под ним — пустота.
    
    Тайник?
    
    { has_item(item_lockpick):
        * [Вскрыть тайник]
            Отвёрткой вы поддеваете доску.
            
            Внутри — пусто. Но на стенках — следы. Кто-то хранил здесь что-то. Недавно.
            
            И записка. Клочок бумаги с единственным словом:
            
            "БЕГИ"
            
            ~ lose_sanity(3)
            
            -> ep1_night_choice
    }
    
    * [Оставить на потом]
        Нужен инструмент. И — осторожность.
        -> ep1_night_choice

* [Хватит — это паранойя]
    Вы следователь, а не домушник. Достаточно.
    
    -> ep1_night_choice

=== ep1_phone_call ===
# mood: tense

Вы снимаете трубку. Тишина. Потом — щелчок.

— Внутренняя связь, — женский голос. Клава? — Соединить?

* [Соединить с милицией]
    — Милиция. Дежурный.
    
    — Это гостиница "Урал". Соединяю.
    
    Гудки. Долго. Потом:
    
    — Дежурный Петров. Слушаю.
    
    — Это следователь Сорокин. Я хотел...
    
    Тишина. Линия оборвалась.
    
    Вы перезваниваете.
    
    — Внутренняя связь...
    
    — Соедините с милицией снова.
    
    — Одну минуту... — Пауза. — Линия занята. Перезвоните позже.
    
    Странно. Очень странно.
    
    -> ep1_night_choice

* [Позвонить в Москву — доложить начальству]
    — Межгород. Москва.
    
    — Межгород недоступен. Только местная связь.
    
    — Это официальное дело. Я следователь...
    
    — Извините, товарищ. Межгород закрыт. Профилактика на линии.
    
    Профилактика. В закрытом городе. Как удобно.
    
    -> ep1_night_choice

* [Спросить о предыдущем постояльце номера]
    — Клавдия Петровна? Скажите, кто жил в номере двенадцать до меня?
    
    Долгая пауза.
    
    — Почему вы спрашиваете?
    
    — Любопытство.
    
    Ещё пауза. Потом — тихо:
    
    — Зорин. Алексей Петрович. Он иногда оставался здесь, когда допоздна работал на заводе.
    
    Она кладёт трубку. Не попрощавшись.
    
    Зорин жил в этом номере. В этой комнате. Может быть — на этой кровати.
    
    И потом — исчез.
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_night_choice

* [Положить трубку]
    Ничего срочного.
    
    -> ep1_night_choice

=== ep1_study_files ===

# mood: investigation

Вы раскладываете содержимое папки на столе. Десять страниц. Десять жалких страниц на исчезновение человека. Лампа на столе — тусклая. Вы придвигаете её ближе.

* [Начать с первой страницы]
    -> ep1_page1

=== ep1_page1 ===
СТРАНИЦА 1: РАПОРТ О ВОЗБУЖДЕНИИ ДЕЛА

"24 октября 1986 г. В 09:15 в дежурную часть ГОВД обратилась гр. Зорина Т.А. с заявлением о безвестном исчезновении её отца, Зорина А.П., 1939 г.р., инженера завода 'Прометей'..."

Сухой канцелярский язык. Без эмоций, без деталей.

* [Следующая страница]
    -> ep1_page2

=== ep1_page2 ===
СТРАНИЦЫ 2-3: ПРОТОКОЛ ОСМОТРА

Осмотрели квартиру Зорина. Следов борьбы нет. Вещи на месте. Паспорт — в ящике стола.

Человек вышел из дома — и не вернулся. Без документов. Без денег (зарплату получил накануне, все 240 рублей — в конверте на столе).

Странно. Кто уходит без паспорта и денег?

* [Следующая страница]
    -> ep1_page3

=== ep1_page3 ===
СТРАНИЦЫ 4-5: ОПРОС СВИДЕТЕЛЕЙ

Двое видели Зорина вечером 23 октября.

Свидетель Иванов П.К.: "Видел Зорина в 18:50 на улице Ленина. Шёл в сторону дома. Один."

Свидетель Кузнецова М.И.: "Видела Зорина в 18:50 у гастронома на площади. Разговаривал с каким-то мужчиной. Лица не разглядела."

Стоп. Оба видели его в одно время? В разных местах?

* [Отметить противоречие]
    Вы делаете пометку в блокноте: "Иванов, Кузнецова — проверить. 18:50 — противоречие."
    -> ep1_page4

* [Следующая страница]
    -> ep1_page4

=== ep1_page4 ===
СТРАНИЦЫ 6-7: ПОИСКИ

Прочёсывали окрестности три дня. С собаками. Ничего не нашли.

Три дня. Всего три дня на поиски пропавшего человека. В тайге.

* [Следующая страница]
    -> ep1_page5

=== ep1_page5 ===
СТРАНИЦЫ 8-9: ПУСТЫЕ

Просто пустые. Как будто их вложили для объёма.

Или... из дела что-то изъяли?

* [Следующая страница]
    -> ep1_page6

=== ep1_page6 ===
СТРАНИЦА 10: ЗАКЛЮЧЕНИЕ

"Предположительно — несчастный случай. Рекомендуется прекратить поиски."

Подпись — Громов С.П.

Три недели расследования. Десять страниц. Несчастный случай.

Вы закрываете папку. Что теперь?

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
    ~ evidence_collected = evidence_collected + 1
    
    # clue
    Улика найдена: противоречие в показаниях свидетелей
    
    Ещё одна странность: Кузнецова упоминает "какого-то мужчину". С кем разговаривал Зорин? Почему это не проверили?
    
    И почему дело закрыли так быстро? Три недели — и "несчастный случай"?
    
    -> ep1_files_end

* [Составить план]
    Вы берёте блокнот. Записываете:
    
    1. Допросить свидетелей — Иванова и Кузнецову. Уточнить показания.
    2. Осмотреть маршрут Зорина — от завода до дома.
    3. Поговорить с дочерью — Таней Зориной. Что она знает об отце?
    4. Найти отца Серафима — Громов сказал, что он "кое-что знает".
    5. Проверить другие исчезновения — семь человек за два года.
    
    Много работы. Мало времени.
    
    -> ep1_files_end

=== ep1_files_end ===

Вы закрываете папку.

За окном — полная темнота. Часы показывают одиннадцать.

Два часа вы изучали десять страниц. Перечитывали каждое слово. Искали между строк.

И нашли — больше вопросов, чем ответов.

Почему свидетели врут — или путают? Почему дело закрыли так быстро? Почему Громов боится? Почему весь город словно вымер?

И что за пение вы слышали — или не слышали — из леса?

Голова тяжёлая. Глаза слипаются.

Завтра. Всё — завтра.

* [Лечь спать]
    Вы раздеваетесь. Ложитесь на жёсткую кровать.
    
    Пружины скрипят.
    
    За окном — тишина. Абсолютная.
    
    ~ gain_sanity(3)
    
    Вы закрываете глаза.
    
    -> ep1_sleep

=== ep1_night_walk ===

# mood: horror

Вы выходите из гостиницы.

Клава за стойкой поднимает голову. Её глаза — испуганные.

— Товарищ следователь? Куда вы...

— Прогуляюсь.

Она открывает рот, чтобы что-то сказать, но вы уже выходите.

Холод — обжигающий. Мороз усилился — минус двадцать, не меньше. Снег скрипит под ногами.

Город ночью — другой.

Не просто пустой. Мёртвый. Фонари — не горят. Окна — тёмные. Ни звука, ни движения.

Как будто вы — единственный живой человек в радиусе километра.

{ not (AfghanMemories ? memory_ambush):
    Это напоминает вам кое-что...
    -> flashback_ambush ->
}

Вы идёте по улице. Ваши шаги — единственный звук в ночи. Гулко. Отчётливо.

Эхо отскакивает от стен домов.

Небо — затянуто тучами. Ни луны, ни звёзд. Темнота — почти осязаемая.

Но где-то там — за городом — слабое красноватое свечение. От завода? От чего-то другого?

-> ep1_night_directions

=== ep1_night_directions ===
# mood: horror

Куда пойти?

* [К заводу — на свечение]
    Вы поворачиваете в сторону свечения. К заводу.
    
    Улицы — пустые. Дома — тёмные. Ни души.
    
    Снег похрустывает под ногами. Холодный воздух обжигает лёгкие.
    
    Завод — впереди. Его силуэт — чёрный на фоне красноватого неба. Трубы — дымят, даже ночью.
    
    Вы подходите к забору. Бетонные плиты, колючая проволока сверху.
    
    И — останавливаетесь.
    
    На заборе — что-то.
    
    Символ.
    
    Красный круг. Три линии к центру — как спицы в колесе. Или как... пальцы? Когти?
    
    Краска — свежая. Ещё блестит в свете вашего фонарика.
    
    Кто-то нарисовал это недавно. Сегодня? Вчера?
    
    Вы подходите ближе. Рассматриваете.
    
    Символ... знакомый? Где-то вы его видели. Или думаете, что видели.
    
    ~ KeyEvents += saw_symbol
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesC ? cult_symbol):
        ~ CluesC += cult_symbol
        ~ evidence_collected = evidence_collected + 1
        ~ boost_theory(5, 5)
        
        # clue
        Улика найдена: красный символ на заборе завода
    }
    ~ cult_awareness = cult_awareness + 2
    
    И тут — голос. За спиной.
    
    — Не стоит здесь гулять ночью, товарищ.
    
    Вы резко оборачиваетесь. Рука — к кобуре.
    
    -> ep1_night_encounter

* [К окраине — к лесу]
    Вы идёте прочь от центра. В сторону, противоположную заводу.
    
    Улицы — пустые. Дома — тёмные.
    
    Пятиэтажки сменяются трёхэтажками. Потом — двухэтажками. Потом — частный сектор.
    
    Маленькие домики за покосившимися заборами. Погасшие окна. Заснеженные дворы.
    
    Ни одной собаки не лает. Ни одна не выбегает к забору.
    
    Странно. В таких посёлках всегда собаки. Много собак. И они всегда лают на чужаков.
    
    Но здесь — тишина. Абсолютная.
    
    Вы идёте дальше.
    
    Дома заканчиваются. Впереди — поле. А за полем —
    
    Лес.
    
    Чёрная стена деревьев. Сосны — высокие, неподвижные. Как часовые.
    
    И... свечение? Красноватое. Еле заметное. Где-то там, в глубине.
    
    Или это просто отблески завода?
    
    ~ lose_sanity(3)
    
    -> ep1_forest_edge

* [К кладбищу]
    Вы вспоминаете карту города. На востоке — кладбище. Старое, ещё дореволюционное.
    
    Кладбища — хранители секретов. Мёртвые не лгут.
    
    Вы идёте узкими переулками. Сворачиваете за угол.
    
    Впереди — кованая ограда. Чёрные кресты на фоне серого неба.
    
    -> ep1_cemetery_night

* [К церкви]
    Вы заметили её днём — старую церковь на холме. Закрытую, с заколоченными окнами.
    
    В атеистическом государстве церкви не работают. Но они стоят. И помнят.
    
    Вы поднимаетесь по узкой тропинке.
    
    -> ep1_church_night

* [Следить за патрулём]
    Вдалеке — свет фар. Машина милиции?
    
    Интересно. Громов сказал, что ночью не патрулируют. Но машина — есть.
    
    Вы прячетесь в тени. Наблюдаете.
    
    -> ep1_follow_patrol

* [Вернуться — слишком опасно]
    Инстинкт выживания берёт верх.
    
    Вы разворачиваетесь. Быстрым шагом возвращаетесь в гостиницу.
    
    Клава за стойкой смотрит с облегчением:
    
    — Слава богу. Я уж думала...
    
    Она не договаривает. Вы не спрашиваете.
    
    ~ gain_sanity(3)
    
    -> ep1_sleep

=== ep1_cemetery_night ===
# mood: horror

Кладбище.

Ворота — распахнуты. Ржавые петли скрипят на ветру.

Между могил — снег. Нетронутый, белый. Никто не приходил сюда давно.

Надгробия — старые. Многие — покосившиеся. Надписи стёрты временем.

Вы включаете фонарик. Луч скользит по крестам, по ангелам с отбитыми крыльями, по плитам.

И — останавливается.

Свежая могила. Без креста. Без надгробия. Просто холм земли, едва припорошенный снегом.

Земля — рыхлая. Недавно копали.

* [Осмотреть могилу ближе]
    Вы подходите. Наклоняетесь.
    
    На земле — следы. Не человеческие. Что-то с когтями. Много следов — вокруг могилы, как будто танцевали.
    
    И — запах. Сладковатый. Тлен.
    
    ~ lose_sanity(4)
    
    На краю ямы — клочок ткани. Красной ткани.
    
    Вы подбираете. Это — часть капюшона? Мантии?
    
    { not (CluesC ? cult_symbol):
        ~ CluesC += cult_symbol
        ~ evidence_collected = evidence_collected + 1
        ~ boost_theory(5, 5)
        УЛИКА: Красная ткань с кладбища.
    }
    
    ~ cult_awareness = cult_awareness + 2
    
    -> ep1_cemetery_sound

* [Уйти — здесь небезопасно]
    Что-то не так. Ваш инстинкт кричит — уходи.
    
    Вы отступаете. Быстро.
    
    -> ep1_night_directions

=== ep1_cemetery_sound ===
# mood: horror

Звук.

Откуда-то из глубины кладбища. Не ветер. Не скрип.

Голоса. Много голосов. Поют.

Тот же напев, что вы слышали в гостинице. Только громче. Ближе.

Вы оборачиваетесь.

Между могилами — движение. Фигуры. Тёмные силуэты.

Идут к вам? Или просто идут?

~ lose_sanity(5)
~ KeyEvents += heard_voices

* [Спрятаться и наблюдать]
    Вы приседаете за надгробием. Затаив дыхание.
    
    Фигуры проходят мимо. Пять... семь... девять человек? В длинных тёмных одеждах. Капюшоны скрывают лица.
    
    Они поют. Без слов. Монотонный напев, от которого волосы встают дыбом.
    
    Впереди идущий несёт что-то. Длинное. Завёрнутое в ткань.
    
    Тело?
    
    Они сворачивают к старой часовне. Исчезают внутри.
    
    ~ KeyEvents += witnessed_ritual
    ~ cult_awareness = cult_awareness + 5
    
    * * [Следовать за ними]
        Безумие. Но вы должны знать.
        
        Вы крадётесь к часовне. Дверь — приоткрыта.
        
        Свет внутри. Красный. Как от свечей.
        
        Вы заглядываете в щель...
        
        -> ep1_chapel_peek
    
    * * [Уйти — достаточно увидели]
        Нужно уйти. Сейчас. Пока не заметили.
        
        Вы отползаете назад. Встаёте. Бежите.
        
        Сердце колотится. В ушах — пение.
        
        -> ep1_escape_cemetery

* [Бежать]
    К чёрту всё.
    
    Вы бежите. Между могил. К воротам.
    
    Не оглядываясь.
    
    -> ep1_escape_cemetery

=== ep1_chapel_peek ===
# mood: horror

Часовня.

Внутри — свечи. Десятки свечей. Красные огни в темноте.

Фигуры в капюшонах стоят кругом. В центре — алтарь. Каменный. Древний.

На алтаре — тело. Человек? Вы не уверены. Он... она... не двигается.

Один из фигур выходит вперёд. Снимает капюшон.

Вы узнаёте лицо.

Громов. Майор Громов.

Он поднимает руки. Говорит что-то на языке, который вы не понимаете.

Остальные отвечают хором. Низкие голоса. Гудение.

И тут — тело на алтаре дёргается.

Оно живое.

~ lose_sanity(10)
~ trust_gromov = trust_gromov - 30
~ cult_awareness = cult_awareness + 10

Вы отшатываетесь. Ваша нога задевает камень.

Звук.

Пение обрывается.

Все головы поворачиваются — к двери. К вам.

— БЕГИ!

Голос — в вашей голове? Снаружи? Вы не знаете.

Но вы бежите.

-> ep1_escape_cemetery

=== ep1_escape_cemetery ===
# mood: horror

Вы бежите.

Между могилами. Спотыкаясь. Падая. Поднимаясь.

Позади — звуки погони? Или это ваше воображение?

Вы не оглядываетесь.

Ворота — впереди. Вы вылетаете на улицу.

Бежите. Бежите. Бежите.

Гостиница. Дверь. Внутрь.

Клава вскакивает:

— Господи! Товарищ следователь! На вас лица нет!

Вы не отвечаете. Поднимаетесь по лестнице. В номер. Запираете дверь.

Садитесь на кровать. Пытаетесь успокоить дыхание.

Что это было? Что вы видели?

~ temp recovery = gain_sanity(2)

-> ep1_sleep

=== ep1_church_night ===
# mood: mystery

Церковь на холме.

Старая. Деревянная. Купола — почерневшие, без крестов. Окна — заколочены досками.

"Закрыта решением Исполкома. 1937 г." — табличка на двери.

Почти пятьдесят лет. Стоит, но не работает.

Вы обходите здание. Ищете вход.

* [Попробовать заднюю дверь]
    За церковью — кладбище. Маленькое. Церковное.
    
    И дверь. Приоткрытая.
    
    Кто-то был здесь недавно.
    
    Вы входите.
    
    -> ep1_church_inside

* [Осмотреть кладбище при церкви]
    Надгробия — старые. Дореволюционные. Священники, купцы, дворяне.
    
    И одно — новое. Относительно новое. 
    
    "Серафим Иванович Волков. 1889-1984. Хранитель".
    
    Хранитель чего?
    
    ~ cult_awareness = cult_awareness + 1
    
    -> ep1_night_directions

* [Вернуться — слишком темно]
    Без нормального освещения здесь делать нечего.
    
    -> ep1_night_directions

=== ep1_church_inside ===
# mood: horror

Темнота. Запах плесени и ладана.

Ваш фонарик выхватывает из мрака:

Иконы — почерневшие, с выцарапанными ликами.

Алтарь — перевёрнутый, сломанный.

На полу — следы. Свежие. Много следов.

И — символы. На стенах. Красной краской.

Те же символы, что на заборе завода. Круги. Линии. Что-то древнее.

{ CluesC ? cult_symbol:
    Вы видели это раньше. Уже дважды. Это не совпадение.
}

* [Осмотреть алтарь]
    Под алтарём — люк. Старый, деревянный.
    
    Вы поднимаете крышку.
    
    Лестница вниз. В темноту.
    
    { has_item(item_flashlight):
        Луч фонарика тонет в черноте. Но вы видите — там что-то есть. Внизу.
        
        * * [Спуститься]
            Вы делаете шаг вниз. Ступени скрипят.
            
            Ещё шаг. Ещё.
            
            Холод. Сырость. Запах земли.
            
            Внизу — туннель. Узкий. Уходит куда-то под город.
            
            { not (CluesB ? underground_map):
                ~ CluesB += underground_map
                ~ evidence_collected = evidence_collected + 1
                УЛИКА: Подземный ход под церковью.
            }
            
            ~ unlock_location(old_mine)
            
            Вы слышите звуки. Где-то впереди. Голоса?
            
            Нет. Не сегодня. Нужно подготовиться.
            
            Вы возвращаетесь наверх.
            
            -> ep1_night_directions
        
        * * [Не рисковать]
            Не сейчас. Один. Ночью. Это безумие.
            
            Вы запоминаете место. Вернётесь днём.
            
            -> ep1_night_directions
    - else:
        Слишком темно. Нужен фонарик.
        
        -> ep1_night_directions
    }

* [Искать документы]
    В углу — шкаф. Покосившийся, с выбитым стеклом.
    
    Внутри — книги. Церковные книги. И папка.
    
    "Приходская летопись. 1890-1917."
    
    Вы открываете наугад.
    
    "Июнь 1890. В окрестностях села обнаружены странные знаки на деревьях. Крестьяне утверждают, что слышат голоса в лесу по ночам. Отец Серафим провёл молебен..."
    
    Отец Серафим. Как на могиле?
    
    { not (CluesD ? expedition_1890):
        ~ CluesD += expedition_1890
        ~ evidence_collected = evidence_collected + 1
        УЛИКА: Записи 1890 года — странности начались давно.
    }
    
    ~ cult_awareness = cult_awareness + 3
    
    -> ep1_night_directions

* [Уйти]
    Достаточно. Нужно обдумать увиденное.
    
    -> ep1_night_directions

=== ep1_follow_patrol ===
# mood: tense

Вы следуете за машиной. Держитесь в тени.

"УАЗик" милиции медленно едет по пустым улицам. Останавливается у перекрёстка.

Выходит человек. В форме. Оглядывается.

Это не патруль. Он что-то ищет.

Или кого-то ждёт.

Из переулка появляется второй человек. В гражданском. Они разговаривают.

Вы подбираетесь ближе. Прячетесь за мусорным баком.

Слышите обрывки разговора:

"...следователь... из Москвы..."

"...Громов сказал — не трогать. Пока."

"...а если он найдёт?..."

"...не найдёт. Всё убрали. Зорин... и другие..."

Зорин. Они говорят о Зорине.

~ cult_awareness = cult_awareness + 2

* [Слушать дальше]
    "...шахта?"
    
    "Закрыта. Охрана. Никто не пройдёт."
    
    "...а Фёдор? Он видел..."
    
    "Фёдор — дурак городской. Кто ему поверит?"
    
    Фёдор. Ещё одно имя.
    
    Милиционер садится в машину. Уезжает.
    
    Второй человек уходит в переулок.
    
    Вы ждёте. Потом — возвращаетесь в гостиницу.
    
    ~ trust_gromov = trust_gromov - 10
    
    -> ep1_sleep

* [Проследить за человеком в гражданском]
    Он сворачивает в переулок. Вы — за ним.
    
    Узкий проход между домами. Тёмный.
    
    Человек идёт быстро. Сворачивает за угол.
    
    Вы ускоряете шаг. Поворачиваете —
    
    Пусто. Никого.
    
    Тупик. Глухая стена.
    
    Куда он делся?
    
    ~ lose_sanity(3)
    
    Вы стоите в тупике. Один. В темноте.
    
    И чувствуете — за спиной кто-то есть.
    
    Вы резко оборачиваетесь —
    
    Никого.
    
    Хватит. На сегодня — хватит.
    
    -> ep1_escape_cemetery

=== ep1_night_encounter ===

~ MetCharacters += fyodor

# mood: horror

Мужчина.

Невысокий. В старой телогрейке, застиранной до серости. На голове — ушанка с опущенными ушами. Лицо — в тени. Вы видите только силуэт.

Откуда он взялся? Вы не слышали шагов.

— Уходите.

Голос — хриплый, надломленный. Как будто он не говорил с людьми очень давно.

— Уходите. Пока можете. Пока... ОНИ не заметили.

Ваша рука — на кобуре. Но вы не достаёте пистолет.

— Вы кто?

— Фёдор. — Он делает шаг назад. В тень. — Сторож. Бывший. Теперь — никто.

— Сторож чего?

Он не отвечает. Смотрит — не на вас. Куда-то в сторону. В сторону леса.

— Они видят. — Его голос — еле слышный шёпот. — Всегда видят. Красный лес... он зовёт... он всегда зовёт новичков...

— Что? Какой красный лес?

Фёдор отступает ещё на шаг. Его лицо на мгновение попадает в свет вашего фонарика.

Старое. Измождённое. Глаза — дикие, но ясные. Шрамы на щеке — три параллельные линии, как следы когтей.

— Уходите. — Его голос — умоляющий. — Завтра. Первым автобусом. Уезжайте из этого города. Забудьте. Забудьте всё.

И он исчезает.

Не уходит — исчезает. В темноте. Бесшумно.

Вы стоите один. У забора завода. С красным символом перед глазами.

Где-то в лесу — то ли вой ветра, то ли... голоса?

~ lose_sanity(5)
~ KeyEvents += heard_voices
~ KeyEvents += fyodor_warned

* [Вернуться в гостиницу]
    Хватит.
    
    Вы разворачиваетесь. Идёте назад. Быстро. Почти бежите.
    
    Не оглядываетесь.
    
    Сердце колотится. В ушах — шум крови.
    
    Фёдор. Сторож. "Они видят". "Красный лес зовёт".
    
    Что это было? Сумасшедший? Или...
    
    Нужно найти его. Расспросить. Но не сейчас. Не ночью.
    
    Гостиница — впереди. Тёплый свет в окнах.
    
    Вы ускоряете шаг.
    
    -> ep1_sleep

=== ep1_forest_edge ===

# mood: horror

Лес начинается резко. Без перехода. Поле — и сразу стена деревьев.

Сосны — высокие, чёрные. Их стволы — как колонны огромного собора. Кроны — смыкаются далеко наверху, закрывая небо.

Вы останавливаетесь на границе. Нога — на последнем клочке заснеженного поля. Перед вами — темнота.

Абсолютная. Непроницаемая.

Фонарик — бесполезен. Его луч тонет в черноте, как камень в болоте.

И — запах.

Сладковатый. Тяжёлый. Как... разложение? Гниющие листья? Что-то мёртвое?

Нет. Не совсем. Что-то... древнее. Как запах склепа, который не открывали столетия.

Вы стоите. Смотрите в темноту.

И темнота — смотрит на вас.

Это ощущение — физическое. Как будто тысяча глаз — там, между деревьями — следит за каждым вашим движением.

Ветра нет. Ни звука. Даже ваше дыхание — словно поглощается темнотой.

И тут —

Движение.

Там. Между стволами. В глубине.

* [Подойти ближе]
    Вы делаете шаг. В лес.
    
    Темнота — обнимает. Холод — другой, не такой как снаружи. Влажный. Липкий.
    
    Ещё шаг.
    
    Что-то — белое? — мелькает между деревьями. В тридцати метрах. В пятнадцати.
    
    Лицо?
    
    Бледное пятно в темноте. Глаза? Или...
    
    Вы моргаете.
    
    Там — ничего. Только стволы сосен. Только темнота.
    
    Но ощущение взгляда — не исчезает. Наоборот — усиливается.
    
    Где-то — еле слышно — смех? Или плач?
    
    ~ lose_sanity(5)
    ~ KeyEvents += heard_voices
    
    -> ep1_forest_retreat

* [Отступить]
    Нет.
    
    Что-то внутри вас — древний, первобытный инстинкт — кричит: НЕ ХОДИ.
    
    Вы делаете шаг назад. Потом ещё один.
    
    Не отворачиваетесь. Не отводите взгляда от темноты между деревьями.
    
    -> ep1_forest_retreat

=== ep1_forest_retreat ===

Вы отступаете.

Шаг за шагом. Не отворачиваясь от леса.

Спиной ощущаете... взгляд. Давление. Как будто что-то — огромное, древнее — смотрит вам вслед.

Хочет, чтобы вы вернулись.

Зовёт.

{ sanity < 70:
    Вы не оглядываетесь. Всю дорогу до гостиницы — не оглядываетесь.
    
    Потому что боитесь. Боитесь увидеть то, что идёт за вами.
    
    Или — боитесь убедиться, что там никого нет? Что всё это — в вашей голове?
    
    Что страшнее?
}

Поле. Частный сектор. Улицы города.

Всё так же пусто. Всё так же тихо.

Но теперь тишина — другая. Не мёртвая. Ожидающая.

Гостиница — впереди. Свет в окнах. Тепло.

Вы почти бежите последние метры.

Дверь. Вестибюль. Лестница.

Номер двенадцать.

Вы запираете дверь. Проверяете — дважды.

Задёргиваете шторы.

Садитесь на кровать.

Руки — дрожат.

Что это было?

-> ep1_sleep

=== ep1_sleep ===

# mood: dark

Кровать — жёсткая. Пружины впиваются в спину.

Вы лежите. Смотрите в потолок. Трещины на штукатурке — как паутина. Или как карта рек.

{ KeyEvents ? heard_voices:
    Голоса. Вы слышали голоса. Пение — из леса. Шёпот — у завода.
    
    "Красный лес зовёт", — сказал Фёдор. "Он всегда зовёт новичков".
    
    Что это значит?
}

{ KeyEvents ? saw_symbol:
    Красный символ. Круг. Три линии к центру.
    
    Он — перед глазами. Даже когда закрываете веки.
    
    Вы где-то его видели. Раньше. Давно. Но где?
    
    Афганистан? Нет. До этого. В детстве?
    
    Не помните.
}

За окном — тишина. Абсолютная.

Город спит. Или делает вид, что спит.

Сон приходит медленно. Как прилив — накатывает волнами, отступает, накатывает снова.

Вы проваливаетесь.

-> ep1_dream

=== ep1_dream ===

# mood: horror

...

Вы стоите в лесу.

Те же сосны. Те же чёрные стволы. Но что-то — другое.

Цвет.

Сосны — красные. Их кора — тёмно-бордовая, как запёкшаяся кровь. Хвоя — алая, словно облитая вином.

Небо — не видно. Кроны смыкаются высоко над головой. Но сквозь них пробивается свечение — багровое, пульсирующее.

Вы идёте.

Не контролируете ноги. Они несут вас сами — по тропе, которой не видите, к месту, которого не знаете.

Впереди — поляна.

На поляне — люди.

Двенадцать. Или двадцать. Или сто — вы не можете сосчитать. Они стоят кругом. В капюшонах — чёрных, как провалы в реальности. Лиц не видно. Только тени.

Они поют.

Тот самый хор. Те же голоса. Низкие, протяжные. Без слов — только звук. Он вибрирует в костях, резонирует в черепе.

В центре круга — что-то.

Алтарь? Камень? Вы не можете разобрать. Только свечение — яркое, белое, ослепительное.

Один из стоящих поворачивается.

Капюшон — падает.

Лицо — ваше собственное.

— Ты уже здесь. — Ваш голос. Из чужого рта. — Ты всегда был здесь. С самого начала.

// Интенсивность сна зависит от состояния рассудка
{ is_disturbed():
    Голоса — громче. Ближе. Они окружают вас.
    
    «...приди к нам...»
    
    «...ты наш...»
    
    «...всегда был наш...»
    
    Руки — тянутся из темноты. Бледные, холодные. Хватают за плечи, за руки.
    
    Тянут — к алтарю.
}

{ is_mad():
    ОНО.
    
    В центре круга. Над алтарём.
    
    У него нет формы. Нет лица. Нет тела.
    
    Но ОНО смотрит. На вас. ТОЛЬКО на вас.
    
    И голос — громом — в голове:
    
    «...СКОРО...»
    
    «...ТЫ ПРИДЁШЬ...»
    
    «...ТЫ НАШ...»
    
    ~ lose_sanity(2)
}

Вы пытаетесь кричать. Горло — сжато. Звука нет.

Вы пытаетесь бежать. Ноги — не двигаются.

Круг сужается.

Лица под капюшонами — все ваши. Сотни копий вашего лица. Улыбаются. Одинаково. Страшно.

И —

...

* [Проснуться]
    Вы просыпаетесь.
    
    Резко. С криком? Без крика? Не помните.
    
    Сердце — колотится. Простыня — мокрая от пота.
    
    За окном — серый свет. Утро.
    
    Сон. Просто сон.
    
    Вы повторяете это — как мантру.
    
    Просто сон.
    
    -> ep1_morning

=== ep1_morning ===

# chapter: 1
# mood: investigation

15 НОЯБРЯ 1986 ГОДА

День первый расследования

Стук.

Громкий, настойчивый. Костяшки пальцев по дереву.

— Товарищ Сорокин! Завтрак готов!

Голос Клавы. Бодрый, несмотря на ранний час.

Вы открываете глаза.

Потолок — незнакомый. Трещины в штукатурке. Жёлтое пятно от протечки.

Где...

Красногорск-12. Гостиница "Урал". Номер двенадцать.

Вы вспоминаете.

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
    
    Умывальник в углу. Холодная вода — как пощёчина. Вы смотрите в зеркало.
    
    Лицо — осунувшееся. Под глазами — тёмные круги. Трёхдневная щетина — седеет у висков.
    
    Сорок два года. Выглядите на все пятьдесят.
    
    — Товарищ Сорокин? — Снова Клава. — Каша стынет!
    
    — Иду!
    
    Вы одеваетесь. Проверяете — пистолет на месте, в кобуре. Документы — в кармане.
    
    Готовы.
    
    -> ep1_morning_choice

=== ep1_morning_choice ===

Столовая на первом этаже — маленькая, уютная. Запах каши, кофе, свежего хлеба.

Вы единственный посетитель.

Клава ставит перед вами тарелку. Гречневая каша с маслом. Стакан чая. Хлеб с маслом.

— Кушайте, товарищ следователь. Силы нужны.

Она смотрит — изучающе. Оценивает.

— Плохо спали? Бледный вы какой-то.

— Нормально. — Вы берёте ложку. — Спасибо за завтрак.

Каша — горячая, вкусная. Вы едите молча. Думаете.

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
    
    — Клавдия Петровна, как добраться до завода "Прометей"?
    
    — Прямо по улице, товарищ следователь. Десять минут пешком. Большое такое здание, не пропустите.
    
    -> ep1_meet_tanya

* [В милицию — к свидетелям]
    Свидетели. Иванов и Кузнецова. Их показания — противоречат друг другу.
    
    Кто-то врёт. Нужно выяснить — кто.
    
    Вы допиваете чай.
    
    — Спасибо, Клавдия Петровна. Вкусно.
    
    — На здоровье. — Она улыбается. — Осторожнее там. На улицах.
    
    Странное предупреждение. Но вы уже привыкли к странностям этого города.
    
    -> ep1_witnesses

* { days_remaining >= 4 } [К Серафиму]
    Священник. Отец Серафим. "Он кое-что знает", — сказал Громов.
    
    Что именно? И почему майор милиции — человек, который должен верить в факты — направил вас к священнику?
    
    Вы допиваете чай.
    
    — Клавдия Петровна, как найти старую церковь? На окраине.
    
    Клава замирает. На мгновение — её лицо меняется. Страх?
    
    — Церковь? Вам туда зачем?
    
    — По делу.
    
    — А... — Она качает головой. — За частным сектором. Прямо по дороге, потом — направо у большого дуба. Там увидите.
    
    — Спасибо.
    
    -> ep1_meet_serafim

* [В городской архив — искать документы]
    История. Иногда ответы — в прошлом.
    
    — Клавдия Петровна, в городе есть архив? Где хранятся старые документы?
    
    — Архив? — Она удивлённо поднимает брови. — Есть, конечно. Бывшая школа, на улице Советской. Там Мария Фёдоровна работает. Старая уже, но память — как у слона.
    
    — Спасибо.
    
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

Завод "Прометей". Таня Зорина.

— Вы следователь? Я знала, что вы придёте.

Она коротко рассказывает о странном поведении отца перед исчезновением.

— Приходите вечером. К памятнику. Я покажу кое-что важное.

~ trust_tanya = trust_tanya + 10
// Флаг приглашения на встречу (отдельный от found_notebook)
~ KeyEvents += tanya_invited

-> ep1_day_continue

=== ep1_meet_serafim_short ===

~ MetCharacters += serafim

Церковь на окраине. Отец Серафим.

— Вы приехали из-за пропавших. — Не вопрос. Утверждение.

— Откуда вы знаете?

— Город маленький. Слухи ходят быстро. — Он смотрит на вас оценивающе. — Вы не первый следователь. Но, надеюсь, — последний.

— Что вы имеете в виду?

— Приходите ко мне. Вечером. Или завтра. — Он понижает голос. — Есть вещи, которые нельзя говорить при свете дня.

Странный старик. Но что-то в его глазах — искреннее. Или очень хорошо сыгранное.

~ trust_serafim = trust_serafim + 5
~ boost_theory(3, 3)

— Будьте осторожны, следователь. В этом городе... не все — те, за кого себя выдают.

// Флаг встречи
~ Relationships += helped_serafim

-> ep1_day_continue

=== ep1_meet_tanya ===

~ MetCharacters += tanya

Завод "Прометей". Проходная.

— Мне нужна Зорина Татьяна Алексеевна.

Охранник — пожилой мужчина с усталыми глазами — смотрит на ваше удостоверение. Долго. Слишком долго.

— Инженерный корпус, комната 214. — Пауза. — Она... хорошая девочка. Не обижайте её.

Странная просьба от охранника. Но вы киваете.

Коридоры завода — длинные, серые, пропахшие машинным маслом и чем-то кислым. Химикаты? Трубы под потолком гудят. Где-то вдалеке — ритмичный стук машин.

Комната 214. Дверь приоткрыта.

За столом — молодая женщина. Двадцать три года — написано в деле, но выглядит старше. Рыжие волосы собраны в небрежный пучок. Веснушки на бледном лице. Тёмные круги под глазами — она не спит. Давно не спит.

На столе — чертежи, папки, фотография в рамке. Вы видите её краем глаза: мужчина и женщина, молодые, счастливые. Свадебное фото?

Она поднимает голову. Её глаза — зелёные, яркие, несмотря на усталость — встречаются с вашими.

— Вы следователь. Клава из гостиницы звонила вчера. — Её голос — ровный, контролируемый. Как у человека, который слишком долго держит себя в руках. — Я ждала вас.

Она встаёт. Закрывает дверь. Оборачивается.

— Три недели. Три недели я жду кого-то, кто будет искать по-настоящему. А не просто... — Она замолкает. Сжимает кулаки.

* [Представиться]
    — Сорокин, Виктор Андреевич. Примите соболезнования.
    
    — Соболезнования? — Её глаза вспыхивают. — Папа не умер. Я уверена. Они все говорят "примите соболезнования", как будто уже похоронили его. Но тела нет. Значит — он жив.
    
    Упрямство. Или надежда. Или и то, и другое.
    
    — Расскажите о нём.
    
    -> ep1_tanya_talk

* [Сразу к делу]
    — Расскажите об отце.
    
    — Вы не из тех, что приходили раньше. — Она смотрит на вас оценивающе. — Те задавали три вопроса и уходили. "Когда видели последний раз? Были ли враги? Не злоупотреблял ли алкоголем?" — Её голос становится горьким. — Как по бумажке.
    
    — Я не по бумажке.
    
    — Посмотрим.
    
    -> ep1_tanya_talk

* [Заметить фотографию]
    Вы смотрите на фотографию на столе.
    
    — Ваши родители?
    
    Таня вздрагивает. Отворачивается. На мгновение — только на мгновение — её маска контроля трескается.
    
    — Да. Их свадьба. Шестьдесят второй год.
    
    — Ваша мать...?
    
    — Умерла. — Короткое слово. Острое, как нож. — Когда мне было восемь. Рак.
    
    Она берёт фотографию. Смотрит на неё.
    
    — Папа... он поседел за один месяц. Ему было тридцать пять, а стал похож на старика. Но не сломался. Ради меня — не сломался.
    
    ~ CharacterSecrets += tanya_mother_story
    ~ understanding_tanya += 15
    ~ trust_tanya += 10
    
    -> ep1_tanya_childhood

=== ep1_tanya_childhood ===

# mood: emotional

— Расскажите о нём. Каким он был?

Таня ставит фотографию обратно. Садится. Смотрит в окно — туда, где за заводскими трубами чернеет стена леса.

— После смерти мамы... он посвятил себя мне. И работе. Больше ничего не было. Никаких женщин, никаких друзей. Только я и завод.

Она усмехается — грустно, без радости.

— Он научил меня читать чертежи раньше, чем я научилась читать книжки. В пять лет я знала, как работает паровая турбина. В десять — собрала свой первый радиоприёмник.

— Вы тоже инженер. Пошли по его стопам.

— А куда ещё? — Она пожимает плечами. — Это всё, что я знаю. Это всё, что он мне дал. Знания. Логику. И... этот город.

Её голос становится жёстче.

— Я хотела уехать. После школы. Поступить в Москву. Папа был против. "Здесь твой дом, Танюша. Здесь твоя семья." Но какая семья? — Она смотрит на вас. — Он и я. Больше никого.

~ CharacterSecrets += tanya_childhood
~ understanding_tanya += 10

* [Почему не уехали?]
    — Что остановило?
    
    — Он. Его глаза. Когда я сказала про Москву — он посмотрел на меня так... Как будто я сказала, что хочу умереть. Он потерял маму. Не мог потерять и меня.
    
    Пауза.
    
    — Я осталась. Для него. А теперь...
    
    Она не заканчивает. Не нужно.
    
    ~ CharacterSecrets += tanya_dreams
    ~ understanding_tanya += 15
    ~ trust_tanya += 5
    
    -> ep1_tanya_talk

* [О чём вы мечтали?]
    — Кем хотели стать? Если бы уехали?
    
    Таня смотрит удивлённо. Как будто её давно не спрашивали о мечтах.
    
    — Авиаинженером. — Её голос становится мягче. — Хотела строить самолёты. Не эти... машины для переработки руды. А настоящие самолёты. Которые летают. Которые уносят людей далеко-далеко.
    
    — Ещё не поздно.
    
    — Поздно. — Она качает головой. — Мне двадцать три. Здесь — работа, квартира, папа... Был папа. Теперь — ничего. Кроме этого города. И его секретов.
    
    ~ CharacterSecrets += tanya_dreams
    ~ understanding_tanya += 20
    ~ trust_tanya += 10
    
    -> ep1_tanya_talk

* [Перейти к делу]
    — Я понимаю. Но мне нужно знать о последних неделях.
    
    -> ep1_tanya_talk

=== ep1_tanya_talk ===

{ not (CharacterSecrets ? tanya_childhood):
    Таня закрывает дверь. Проверяет — дважды.
}

— Можно без протокола?

— Пока да.

— Папа не мог просто пропасть. Он что-то знал.

— Что именно?

— Не знаю точно. Но в последние недели он изменился. Не спал. Перебирал бумаги. Говорил странное.

* [Какие бумаги?]
    — Вы видели эти бумаги?
    
    — После исчезновения я искала. Ничего. Но... — Она достаёт потрёпанную книжку. — Это из его шкафчика здесь.
    
    // ИСПРАВЛЕНО: добавлена защита от дублирования улики
    { not (CluesB ? echo_docs):
        ~ CluesB += echo_docs
        ~ evidence_collected = evidence_collected + 1
    }
    { not (KeyEvents ? found_notebook):
        ~ KeyEvents += found_notebook
        ~ evidence_collected = evidence_collected + 1
    }
    
    # clue
    Улика найдена: записная книжка Зорина
    
    -> ep1_tanya_notebook

* [Что он говорил?]
    — Какие странные вещи?
    
    — Про лес. Про голоса. Говорил, что "они открыли что-то". Что это "не должно было быть найдено".
    
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

— К.Л.?

— Не знаю. Папа никогда не объяснял свои сокращения.

~ cult_awareness = cult_awareness + 1

* [Может, место?]
    — Какое-то место? Красная... Кривая... Корпус?
    
    Таня качает головой.
    
    — Не знаю. Он последние недели стал... скрытным. Параноидальным даже.
    
    Странно. Инженер, работавший на секретном заводе — и параноидальный.
    
    Совпадение? Или причина?
    
    ~ boost_theory(1, 5)
    
    -> ep1_tanya_end

* [А.Ч. — это человек?]
    — Инициалы. А.Ч. Кто это?
    
    Таня хмурится.
    
    — Не знаю. Папа никогда не упоминал... — Она замолкает. — Хотя... Однажды он пришёл домой очень взволнованный. Сказал: "Старик был прав. Всё это время — был прав." Я спросила — какой старик? Он не ответил.
    
    ~ cult_awareness = cult_awareness + 1
    
    Зацепка. Слабая, но зацепка.
    
    -> ep1_tanya_end

* [Кто такой "Г."?]
    — Здесь написано — "нельзя доверять Г." Кто это?
    
    Таня бледнеет.
    
    — Громов? Майор Громов? — Она понижает голос. — Папа... Папа говорил, что Громов не тот, за кого себя выдаёт. Что он "из ТЕХ".
    
    — Из каких "тех"?
    
    — Не знаю. Папа отказывался объяснять. Говорил — чем меньше я знаю, тем безопаснее.
    
    ~ boost_theory(2, 10)
    ~ trust_gromov = trust_gromov - 10
    
    Громов. Снова Громов. Что он скрывает?
    
    -> ep1_tanya_end

=== ep1_tanya_more ===

— Вы что-то скрываете.

— Есть кое-что ещё. Но не здесь. Стены имеют уши.

— Где?

— Сегодня вечером. У памятника. В девять.

~ trust_tanya = trust_tanya + 15

// Флаг приглашения на встречу (отдельный от found_notebook)
~ KeyEvents += tanya_invited

— И, следователь... Будьте осторожны.

-> ep1_after_first_visit

=== ep1_tanya_end ===

— Спасибо, Татьяна Алексеевна.

— Найдите его. Пожалуйста.

{ sanity < 70:
    В коридоре — холодно. Слишком холодно.
    
    И шёпот. Из-за стен.
    
    «...он приближается...»
    
    ~ lose_sanity(2)
}

-> ep1_after_first_visit

=== ep1_witnesses ===

Первый свидетель — Иванов — уехал. Вчера. После вашего приезда.

Подозрительно быстро.

Второй — Кузнецова — пожилая женщина. Нервничает.

— Я... Я видела его. Зорина.

— Где именно?

Пауза. Она оглядывается.

— Они сказали — скажи, что видела. А если нет...

— Кто — они?

— Мужчина в штатском. Сказал — от милиции.

~ CluesA += false_reports
~ evidence_collected = evidence_collected + 2

# clue
Улика найдена: показания сфальсифицированы

— Я никого не видела тем вечером. Клянусь. Простите меня.

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

Церковь на окраине. Белые стены, покосившийся купол. Официально — закрыта с шестидесятых. Но кто-то явно поддерживает её в порядке.

Рядом — маленький домик. Дым из трубы. На окнах — странные символы. Защита? От чего?

Дверь открывается раньше, чем вы успеваете постучать.

Старик. Белая борода до груди. Ясные голубые глаза — слишком ясные для человека его возраста. Как будто внутри горит огонь.

— Я ждал вас.

Вы замираете. Откуда он знал?

— Меня?

— Следователя. Того, кого пришлют. Заходите. Здесь холодно. И... небезопасно.

Он оглядывается на лес за вашей спиной. Быстро, нервно.

Странный старик. Живёт один, в закрытой церкви, рисует символы на окнах, "ждёт следователя"...

Религиозные фанатики бывают разные. Иногда — опасные.

~ boost_theory(3, 8)

* [Войти]
    -> ep1_serafim_talk
    
* [Спросить с порога]
    — Откуда вы знали, что я приду?
    
    Серафим улыбается. Печально.
    
    — Они сказали. Те, кто слышит. Но не так, как вы думаете. Не я — безумец. Безумцы — те, кто не слышит.
    
    Загадками говорит. Либо мудрец, либо...
    
    ~ boost_theory(3, 5)
    
    — Заходите. Я всё объясню.
    
    -> ep1_serafim_talk

=== ep1_serafim_talk ===

Внутри — иконы, книги, запах ладана.

— Громов послал?

— Да.

— Хороший человек Степан. Слабый, но хороший.

Серафим садится напротив.

— Вы слышали голоса?

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

— Я не склонен к мистике.

— Я тоже. Был. Сорок лет назад, когда пришёл сюда геологом.

— Геологом?

-> ep1_serafim_legend

=== ep1_serafim_legend ===

# mood: dark

— Это место — старое. — Серафим говорит медленно, взвешивая каждое слово. — Старше города. Старше завода. Старше нас всех.

Он молчит. Смотрит в огонь.

— Здесь... случаются вещи. Которые трудно объяснить.

— Какие вещи?

— Люди слышат то, чего нет. Видят то, чего быть не должно. — Пауза. — А потом — исчезают.

Вы отмечаете про себя: типичный нарратив местного суеверия. Или... попытка предупредить?

Старик явно что-то скрывает. Вопрос — что именно. И зачем он рассказывает это ВАМ.

~ boost_theory(3, 5)

* [Что конкретно они видят?]
    — Зависит от человека. — Серафим качает головой. — Одни — тени. Другие — фигуры. Третьи — слышат голоса.
    
    — И вы?
    
    Долгая пауза.
    
    — Я научился не слушать.
    
    Загадками говорит. Либо мудрец, либо шарлатан. Пока не ясно.
    
    -> ep1_serafim_modern

* [Вы были здесь давно?]
    — Сорок лет. — Он усмехается. — Пришёл молодым. Ушёл бы, если бы мог.
    
    — Почему остались?
    
    — Кто-то должен. — Пауза. — Предупреждать. Таких, как вы.
    
    ~ understanding_serafim += 5
    
    -> ep1_serafim_modern

* [Вы знаете что-то о пропавших?]
    Серафим смотрит вам в глаза. Впервые — прямо, без уклонения.
    
    — Знаю. Но вы не поверите. Пока — не поверите.
    
    — Попробуйте.
    
    — Нет. — Он качает головой. — Сначала — увидьте сами. Потом — приходите. Поговорим.
    
    Загадками. Одними загадками.
    
    ~ boost_theory(3, 3)
    
    -> ep1_serafim_modern

* [Это суеверия]
    — С уважением, отец Серафим, но я следователь. Мне нужны факты, а не истории.
    
    Серафим смотрит на вас. В его глазах — не обида. Что-то другое. Узнавание?
    
    — Факты. — Он кивает. — Хорошо. Вот факт: за сорок лет я отпел больше пустых гробов, чем полных. Люди пропадают — и не возвращаются. Тела не находят. Никогда.
    
    — Это не факт. Это статистика.
    
    — А вот ещё статистика: девять из десяти пропавших — работали на заводе. В определённом отделе. — Он замолкает. — Но это вы сами узнаете. Если захотите.
    
    ~ boost_theory(3, -5)
    ~ boost_theory(4, 10)
    ~ understanding_serafim += 10
    
    Интересно. Определённый отдел. Какой?
    
    -> ep1_serafim_modern

=== ep1_serafim_modern ===

— Вы что-нибудь знаете о заводе? — спрашиваете вы.

Серафим молчит. Долго.

— Знаю, что он — не просто завод. — Его голос тише. — Официально — химическое производство. Но... — Он качает головой. — Есть вещи, которые лучше не знать.

— Мне нужно знать.

— Нужно? — Он смотрит на вас. — Или хотите?

Пауза.

— Хорошо. Один совет. Бесплатный. — Он подаётся вперёд. — Если будете копать — начните с архива. Старые газеты. Пятидесятые-шестидесятые годы. Посмотрите, сколько "несчастных случаев на производстве" было тогда. И сравните с другими заводами.

— И что я найду?

— Аномалию. — Серафим откидывается назад. — А аномалии, товарищ следователь, требуют объяснения.

~ boost_theory(4, 8)

// Добавляем улику только если ещё не получили от короткого визита
{ not (CluesD ? church_symbols):
    ~ CluesD += church_symbols
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: связь пещер и экспериментов
}

— Они думали, что открыли новое измерение. Но открыли кое-что другое.

* [Что?]
    Серафим долго молчит.
    
    — Я называю это — Красный Лес. Они называют — Проект "Эхо".
    
    За окном — сумерки. Когда успело стемнеть?
    
    -> ep1_serafim_end

=== ep1_serafim_end ===

— Вам пора. Ночью ходить опасно.

На пороге он хватает вас за руку:

— Не верьте тому, что видите. Но и не отвергайте. Истина — посередине.

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

Когда она видит вас — что-то меняется в её лице. Напряжение? Облегчение?

— Вы пришли. — Она делает шаг навстречу. — Я не была уверена...

— Я обещал.

Она смотрит на вас. Долго. В её глазах — благодарность. И что-то ещё — глубже.

— Папа оставил мне кое-что. Сказал — передать тому, кто будет искать по-настоящему.

Из-под пальто — конверт.

— Фотографии. Я боюсь смотреть.

// ДОБАВЛЕНО: укрепление связи при встрече
~ trust_tanya = trust_tanya + 5

~ KeyEvents += found_photos
~ CluesC += ritual_photos
~ evidence_collected = evidence_collected + 3
~ trust_tanya = trust_tanya + 20

# clue
Улика найдена: фотографии Зорина

* [Открыть конверт]
    Три фотографии. Чёрно-белые.
    
    На первой — люди в капюшонах. Стоят кругом.
    
    На второй — символ. Красный круг, три линии.
    
    На третьей — человек. Поза жертвы.
    
    ~ cult_awareness = cult_awareness + 5
    
    — Господи... — шепчет Таня.
    
    -> ep1_photos_aftermath

* [Убрать конверт]
    — Потом. Здесь небезопасно.
    
    -> ep1_tanya_end_meeting

=== ep1_photos_aftermath ===

Шаги. Вы оба замираете.

Фигура из темноты. В форме милиции.

— Товарищ Сорокин? Вас вызывают в отдел. Срочно.

Рядом — ещё двое. В штатском.

~ MetCharacters += astahov

* [Пойти с ними]
    — Татьяна Алексеевна, мы продолжим позже.
    
    Конверт — в кармане.
    
    -> ep1_astahov_scene

=== ep1_tanya_end_meeting ===

— Мне пора. — Таня отступает. — Будьте осторожны. Они следят за всеми.

Она исчезает.

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

— Товарищ Сорокин. Мы должны поговорить о границах вашего расследования.

— Мои полномочия определены прокуратурой.

— Ваши полномочия определяются интересами государства.

Пауза. Он не мигает. Не отводит взгляд.

— Дело Зорина закрыто. Несчастный случай. Вы уедете завтра утром.

* [Отказаться]
    — Боюсь, не могу.
    
    Астахов смотрит долго. Молча.
    
    — Вы делаете ошибку. Большую ошибку.
    
    ~ trust_astahov -= 10
    ~ lose_sanity(5)
    
    -> ep1_end

* [Согласиться (притворно)]
    — Разумеется, товарищ полковник.
    
    — Правильное решение.
    
    Конечно, вы никуда не уедете.
    
    -> ep1_end

* [Спросить о его роли]
    — Полковник, — вы говорите спокойно, — какое отношение имеет КГБ к исчезновению рядового инженера?
    
    Астахов замирает. На мгновение — только на мгновение — что-то мелькает в его глазах. Удивление? Уважение?
    
    — Интересный вопрос, товарищ следователь.
    
    Он садится напротив. Закидывает ногу на ногу. Достаёт портсигар. Серебряный, с гравировкой.
    
    — Закурите?
    
    -> ep1_astahov_talk

=== ep1_astahov_talk ===

# mood: tension

Вы берёте сигарету. Он щёлкает зажигалкой. Огонёк отражается в его глазах.

— Я здесь двадцать лет, Сорокин. — Он затягивается. — Двадцать лет охраняю... интересы государства.

— Какие интересы?

— Секретные. — Тень улыбки. — Но вы уже кое-что поняли, не так ли? "Проект Эхо". Эксперименты. Пещеры.

Он наклоняется вперёд.

— Позвольте дать вам совет. Профессиональный. От человека, который знает, как устроен этот мир.

~ CharacterSecrets += astahov_orders
~ understanding_astahov += 15

* [Слушаю]
    -> ep1_astahov_advice

* [Мне не нужны советы]
    — Спасибо, но я сам разберусь.
    
    — Разумеется. — Он встаёт. — Но помните: здесь случаются несчастные случаи. Часто. И не только с инженерами.
    
    ~ trust_astahov -= 15
    
    -> ep1_end

=== ep1_astahov_advice ===

— Есть вещи важнее правды, Сорокин. Порядок. Стабильность. Государственная безопасность.

Он смотрит в окно. На лес.

— В пятьдесят четвёртом — когда я был ещё лейтенантом — мне поручили охранять "объект особой важности". Здесь. Под землёй.

— Что вы видели?

Долгая пауза. Его лицо — неподвижно. Но что-то... что-то в нём меняется.

— То, чего не должен был видеть никто.

Он тушит сигарету.

— Я выполняю приказы, Сорокин. Всю жизнь — выполняю приказы. Не потому, что верю в них. Не потому, что считаю их правильными.

* [Тогда почему?]
    — Почему?
    
    — Потому что альтернатива — хуже. — Он смотрит вам в глаза. — Если бы вы видели то, что видел я... вы бы тоже выполняли приказы. Любые приказы. Лишь бы ЭТО оставалось закрытым.
    
    ~ CharacterSecrets += astahov_doubt
    ~ understanding_astahov += 20
    ~ EmotionalScenes += scene_astahov_humanity
    
    — У меня есть семья, Сорокин. Жена. Двое детей. Внуки. Они живут в Москве. Далеко отсюда. В безопасности.
    
    Пауза.
    
    — И я сделаю всё — слышите? — ВСЁ — чтобы так и оставалось.
    
    ~ CharacterSecrets += astahov_family
    
    Он встаёт.
    
    — Уезжайте, Сорокин. Пока можете. Это не угроза. Это — просьба.
    
    -> ep1_end

* [Вы боитесь]
    — Вы боитесь. — Вы говорите это спокойно, без обвинения. — Полковник КГБ — боится.
    
    Астахов молчит. Долго.
    
    — Да. — Одно слово. Тихое. — Боюсь. Уже двадцать лет — боюсь.
    
    ~ CharacterSecrets += astahov_doubt
    ~ understanding_astahov += 25
    
    -> ep1_end

=== ep1_end ===

# mood: dark

Номер 12. Полночь.

Вы сидите на кровати. Перед вами — блокнот, записи, улики.

{ evidence_collected >= 5:
    Слишком много совпадений. Культ. Эксперименты. Пропавшие.
    
    Это не просто исчезновение.
}

{ sanity < 65:
    И голоса... Лес... Видения...
    
    Или вы сходите с ума, или... что-то действительно есть.
}

За окном — красноватый отсвет.

Лес.

«Я приехал найти пропавшего», — думаете вы.

«Но нашёл кое-что большее».

...

КОНЕЦ ЭПИЗОДА 1

~ advance_day()

Ваш рассудок: {sanity}/100
Дней осталось: {days_remaining}
Собрано улик: {evidence_collected}

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

16 НОЯБРЯ 1986 ГОДА

День второй

...

Три часа ночи.

Вы лежите в темноте. Глаза открыты. Потолок — незнакомый, чужой. Трещины на штукатурке складываются в узоры, которые вы не хотите видеть.

За стеной — тишина. Абсолютная. Ни скрипа половиц, ни кашля соседей, ни далёкого гудка автомобиля. Словно вы — единственный живой человек в этом здании.

В этом городе.

{ KeyEvents ? heard_voices:
    Голоса вернулись.
    
    Не во сне — наяву. Тихие, на грани слуха. Как будто кто-то стоит за дверью и шепчет сквозь щель.
    
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
    
    ~ lose_sanity(3)
}

{ KeyEvents ? saw_symbol:
    Символ.
    
    Каждый раз, когда закрываете глаза — он там. Красный круг, три линии к центру. Пульсирует, как живой. Как сердце.
    
    Откуда он? Почему кажется таким... знакомым?
    
    Вы пытаетесь вспомнить. Афганистан? Нет. Детство? Может быть...
    
    Образы — размытые. Бабушкин дом в деревне. Икона в углу. И... что-то ещё. Рисунок на чердаке? Или во сне?
    
    Вы трёте глаза. Не помогает. Символ — внутри. Под веками.
    
    ~ lose_sanity(2)
}

...

Семь утра.

Серый свет за окном. Рассвет — если можно назвать это рассветом. Просто темнота становится чуть светлее.

Снег. Опять снег. Крупные хлопья падают медленно, беззвучно. За ночь намело сугробы.

Вы умываетесь ледяной водой. Смотрите в зеркало.

Лицо — незнакомое. Серое, осунувшееся. Под глазами — круги, как синяки. Щетина отросла, колется под пальцами.

Вы выглядите как человек, который не спал неделю.

Прошёл один день.

Стук в дверь.

— Товарищ следователь! Завтрак готов!

Клава. Бодрая, как всегда. Как будто в этом городе можно быть бодрым.

Вы одеваетесь. Проверяете пистолет — на месте. Документы — в кармане.

День второй. Пора работать.

-> episode2_morning

=== episode2_morning ===

# mood: investigation

~ time_of_day = 0

УТРО

{ actions_today == 0:
    У вас есть время на два-три дела сегодня.
}

{ days_remaining <= 2:
    Время на исходе. Нужно торопиться.
}

Куда направиться?

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

Ресторан "Урал".

Обеденное время — но зал почти пуст. Три столика заняты: пожилая пара у окна, мужчина в рабочей спецовке у стойки, и Клавдия Петровна — в дальнем углу, спиной к стене.

Вы подходите. Она вздрагивает — хотя смотрела прямо на вас.

— Садитесь, садитесь. Быстрее.

Голос — еле слышный. Глаза — бегают по залу, словно она ждёт, что кто-то подслушивает.

Вы садитесь. Официантка — молодая девушка с усталым лицом — приносит меню. Клава отмахивается.

— Мне ничего. Просто воды.

Вы заказываете борщ. Официантка уходит.

Клава наклоняется ближе. Её руки — дрожат. Она прячет их под столом.

— Я не должна это рассказывать. — Её голос — шёпот. — Но вчера ночью... я не спала. Думала. О муже. О том, что было.

Пауза. Она оглядывается снова. Мужчина у стойки встаёт, уходит. Клава расслабляется — едва заметно.

— Я должна кому-то рассказать. Пока могу. Пока... пока меня не забрали.

* [Подождать]
    Вы молчите. Даёте ей время.
    
    Она нервно теребит салфетку. Рвёт её на мелкие кусочки. Руки — не слушаются.
    
    — Ладно. — Глубокий вдох. — Слушайте.
    
    -> ep2_klava_story

* [Это важно для расследования]
    — Клавдия Петровна, — вы говорите мягко, но твёрдо, — речь идёт о жизни и смерти. О людях, которые пропали. О тех, кто ещё может пропасть.
    
    Она смотрит на вас. В её глазах — страх. Но и что-то ещё. Решимость?
    
    — Знаю. — Она сглатывает. — Потому и пришла. Потому что больше не могу молчать.
    
    -> ep2_klava_story

=== ep2_klava_story ===

# mood: emotional

Клава опускает голову. Её плечи — вздрагивают. Она плачет? Нет. Просто... собирается с духом.

— Мой муж работал на заводе. Двадцать лет назад. — Её голос — глухой, как из-под воды. — Николай. Коля. Инженер-электрик.

— Работал?

Пауза. Долгая.

— Умер. — Она поднимает глаза. Красные, воспалённые. — Официально — сердце. Внезапная остановка. Тридцать восемь лет, здоров как бык — и вдруг сердце.

Она достаёт платок. Промокает глаза.

— Но я знаю правду. Потому что видела.

~ CharacterSecrets += klava_husband
~ understanding_klava += 15

* [Расскажите о муже подробнее]
    — Каким он был? До... до всего этого?
    
    Клава улыбается. Первая настоящая улыбка, которую вы у неё видите.
    
    — Добрый. Смешной. Руки золотые — мог починить всё на свете. Любил рыбалку, шахматы, книжки про путешествия.
    
    Улыбка гаснет.
    
    — Мы познакомились на танцах в Доме культуры. Шестьдесят третий год. Мне было девятнадцать. Ему — двадцать один. Красивый, в военной форме — только из армии вернулся.
    
    Она замолкает. Смотрит в окно.
    
    — Тринадцать лет счастья. А потом... этот проклятый завод. Этот проклятый проект.
    
    ~ understanding_klava += 10
    
    -> ep2_klava_story_continue

* [Что вы видели?]
    -> ep2_klava_story_continue

=== ep2_klava_story_continue ===

— Что вы видели?

Она понижает голос до еле слышного шёпота:

— За неделю до смерти он начал... меняться. Не спал. Вообще. Сидел у окна и смотрел на лес. Часами. Днём и ночью.

Официантка приносит борщ. Клава замолкает. Ждёт, пока она уйдёт.

— Потом — рисунки. Я пришла домой, а он... он стоит у стены и рисует. Углём. Одно и то же. Снова и снова.

— Что он рисовал?

— Круг. Три линии к центру. Как... как спицы в колесе. Или как когти.

{ KeyEvents ? saw_symbol:
    Сердце сжимается. Тот самый символ. Тот, что вы видели на заборе завода.
    
    Двадцать лет. Этому — двадцать лет.
}

~ cult_awareness = cult_awareness + 2

— Он говорил что-нибудь?

— Бормотал. — Клава вздрагивает. — "Красный лес зовёт. Они ждут. Скоро. Скоро откроется." Я думала — перенапрягся. Отвезла его в больницу. Врачи сказали — стресс. Дали таблетки. Не помогло.

Её голос ломается.

— А потом — утром — я проснулась, а он... лежит рядом. Холодный. С улыбкой на лице. С такой... счастливой улыбкой.

Она замолкает. Слёзы текут по щекам.

— Официальная причина — сердце. Но я видела его глаза, следователь. Перед смертью. Он смотрел куда-то... куда-то, чего я не видела. И улыбался.

* [А дети? У вас были дети?]
    Клава замирает. Её лицо — окаменело. На мгновение вы думаете, что переступили черту.
    
    — Был. — Её голос — еле слышный. — Сын. Петенька.
    
    Она достаёт из кармана ещё одну фотографию. Мальчик лет десяти. Светлые волосы, веснушки, широкая улыбка.
    
    — Это — последняя фотография. Семьдесят пятый год. За три дня до...
    
    — До чего?
    
    — До того, как он ушёл в лес. — Клава сглатывает. — Сказал — хочет погулять. Никогда не возвращался.
    
    ~ CharacterSecrets += klava_son
    ~ understanding_klava += 25
    ~ EmotionalScenes += scene_klava_breakdown
    
    { sanity < 60:
        Холод. Внутренний холод, который не имеет ничего общего с температурой.
        
        «...он слышал нас...»
        «...мы звали его...»
        «...он пришёл...»
        
        ~ lose_sanity(5)
    }
    
    — Искали?
    
    — Три недели. Всем городом. Ничего. Ни следа. Ни косточки.
    
    Клава смотрит на фотографию. Гладит её пальцем.
    
    — Ему было бы сейчас тридцать один год. Может, женился бы. Внуки...
    
    Она убирает фотографию. Вытирает глаза.
    
    — Вот почему я здесь. Вот почему работаю в этой проклятой гостинице, хотя могла бы уехать. Потому что однажды — однажды — Петенька вернётся. И я должна быть здесь.
    
    ~ CharacterSecrets += klava_sacrifice
    ~ understanding_klava += 20
    
    -> ep2_klava_photos

* [Где эти рисунки сейчас?]
    -> ep2_klava_photos

* [Кто ещё знает об этом?]
    -> ep2_klava_fyodor

=== ep2_klava_photos ===

— Рисунки. Вы сохранили их?

— Сожгла. — Клава качает головой. — В ту же ночь. Облила керосином и сожгла. Боялась. Боялась, что если оставлю — оно придёт и за мной.

— Но...

— Но одну фотографию... — Она оглядывается. Достаёт из сумки — медленно, словно боится, что кто-то увидит — потёртую фотографию. — Вот. Смотрите быстро.

На фото — стена. Серая штукатурка, покрытая чёрными линиями. Символы — десятки, сотни — наползают друг на друга, сплетаются в узор. В центре — силуэт. Человеческая фигура? Или что-то... другое?

Вы не уверены.

И в правом нижнем углу — лицо. Николай. Смотрит в камеру. Улыбается.

Глаза — пустые. Как у куклы.

~ CluesE += old_photos
~ evidence_collected = evidence_collected + 2

# clue
Улика найдена: фотография рисунков

— Заберите. — Клава отталкивает фотографию. — Мне она не нужна. Не могу больше смотреть.

-> ep2_klava_warning

=== ep2_klava_fyodor ===
    — Вы кому-нибудь рассказывали?
    
    — Никому. — Клава качает головой. — Двадцать лет молчала. Боялась. Но... был один человек. Фёдор. Старый сторож.
    
    — Вы с ним говорили?
    
    — Нет. Но я знаю, что он видел. ТАМ был. В лесу. В пещерах.
    
    — Откуда знаете?
    
    — Потому что он — единственный, кто ВЫЖИЛ. — Клава наклоняется ближе. — Все остальные — кто туда ходил — исчезли. Или умерли. Или... стали как мой Коля. А Фёдор — вернулся. Один. Двадцать лет назад.
    
    — Где его найти?
    
    — Сторожка на краю леса. Но... — Она колеблется. — Он странный. Говорят — сумасшедший. Но я думаю — он просто видел слишком много.
    
    ~ KeyEvents += fyodor_warned
    
    -> ep2_klava_warning

=== ep2_klava_warning ===

Клава хватает вас за руку:

— Уезжайте. Сегодня же. Пока можете.

— Не могу.

— Тогда... — Она пишет что-то на салфетке. — Найдите Фёдора. Он живёт на краю леса. Старая сторожка.

~ CluesE += klava_testimony
~ evidence_collected = evidence_collected + 1

# clue
Улика найдена: показания Клавдии

— Только... не говорите, что от меня.

-> episode2_morning

=== episode2_hospital ===

~ actions_today = actions_today + 1

# mood: investigation

Больница №1.

Трёхэтажное здание жёлтого кирпича — то самое, что вы видели из окна машины вчера. Вблизи — ещё хуже. Штукатурка облупилась, окна — в потёках, у входа — лужи талого снега вперемешку с грязью.

Над дверью — табличка: "ГОРОДСКАЯ БОЛЬНИЦА №1. ПСИХИАТРИЧЕСКОЕ ОТДЕЛЕНИЕ."

Вы толкаете тяжёлую дверь. Внутри — запах хлорки. Резкий, бьющий в нос. И ещё что-то — сладковатое, неприятное. Как в морге.

Коридор — длинный, узкий. Лампы под потолком гудят, мерцают. Стены — выкрашены до середины зелёной краской, выше — побелка, пожелтевшая от времени.

Тишина.

Вы идёте по коридору. Двери по обе стороны — закрыты. За некоторыми — звуки: бормотание, смех, тихий плач. За другими — ничего.

На посту медсестры — пусто. Журнал дежурств — открыт, но записей за сегодня нет.

— Кого-то ищете?

Голос — за спиной. Вы оборачиваетесь.

{ not (MetCharacters ? vera):
    ~ MetCharacters += vera
    
    Женщина в белом халате. Лет сорока, может — сорока пяти. Тёмные волосы, собранные в строгий пучок. Очки в тонкой оправе. Лицо — усталое, с глубокими морщинами у глаз и рта.
    
    Но глаза — живые. Внимательные. Изучающие.
    
    — Доктор Холодова?
    
    — Вера Николаевна. — Она не протягивает руку. — А вы — следователь Сорокин. Из области.
    
    — Вас предупредили?
    
    — Здесь все всё знают. — Тень улыбки на губах. — Маленький город. Слухи расходятся быстрее гриппа.
    
    Она смотрит на вас. Оценивает.
    
    — Пойдёмте в мой кабинет. Здесь — не место для разговоров.
    
    ~ trust_vera = trust_vera + 5
}

Кабинет Веры — маленький, но аккуратный. Стол, шкаф с папками, два стула. На стене — диплом медицинского института, фотография — молодая Вера с группой студентов.

Она закрывает дверь. Проверяет — дважды.

— Итак, следователь. — Она садится за стол. Снимает очки, протирает их. — Что вас интересует?

— Пациенты с... необычными симптомами.

Пауза. Вера смотрит на вас. Долго.

— Вы про "синдром Красного леса"?

Её голос — ровный. Но в глазах — что-то мелькает. Страх? Надежда?

* [Да]
    — Именно.
    
    — Наконец-то. — Она вздыхает. — Наконец-то кто-то спросил правильный вопрос.
    
    -> ep2_vera_syndrome

* [Расскажите подробнее]
    — Я не знаю этого термина. Расскажите.
    
    — Это я его придумала. — Вера усмехается. — Неофициально, конечно. Официально — такого диагноза не существует. Как и не существует ничего, что творится в этом городе.
    
    -> ep2_vera_syndrome

=== ep2_vera_syndrome ===

— За последние пять лет — двадцать три случая. Одинаковые галлюцинации. Красный лес. Фигуры в капюшонах. Голоса.

— Диагноз?

— Официально — острый психоз. Неофициально...

Она достаёт папку. Её руки — дрожат. Еле заметно, но вы замечаете.

— Смотрите сами.

Снимки мозга. У всех пациентов — одинаковые изменения в височной доле.

{ not (CharacterSecrets ? vera_past):
    ~ CluesE += vera_research
    ~ evidence_collected = evidence_collected + 2
}

* [Изучить снимки]
    Вы берёте снимки. Рассматриваете. Вы не врач, но даже вам видно — это не норма.
    
    — Что это?
    
    — Никто не знает. — Вера снимает очки. Трёт переносицу. — Я отправляла образцы в Москву. Ленинград. Киев. Везде один ответ: "Артефакт. Ошибка оборудования."
    
    — Но вы не верите?
    
    — Я не верю в совпадения. Двадцать три "ошибки"? Все — одинаковые?
    
    -> ep2_vera_research

* [Спросить о ней самой]
    — Почему вы этим занимаетесь?
    
    Вера замирает. Снимки в её руках дрожат сильнее.
    
    — Потому что это — моя работа.
    
    — Это не ответ.
    
    Долгая пауза. Она смотрит на вас. Решает что-то.
    
    — Вы хотите правду? Настоящую?
    
    — Да.
    
    -> ep2_vera_backstory

* [Кто был первым пациентом?]
    — С чего всё началось? Кто был первым?
    
    Вера бледнеет. Отворачивается.
    
    — Первый... — Её голос срывается. — Первый пациент был мой муж.
    
    -> ep2_vera_loss

=== ep2_vera_backstory ===

# mood: emotional

Вера встаёт. Подходит к окну. Смотрит на лес — тот самый, что виден отовсюду в этом проклятом городе.

— Я приехала сюда в семьдесят втором году. Молодой специалист. Красный диплом, распределение в провинцию. "Три года отработаете — вернётесь в Москву."

Она усмехается.

— Четырнадцать лет прошло. Я всё ещё здесь.

— Почему остались?

— Потому что... — Она оборачивается. В её глазах — боль. Старая, глубокая, затаённая. — Потому что нельзя было уехать. Не могла. Не имела права.

~ CharacterSecrets += vera_past
~ understanding_vera += 15

* [Расскажите]
    — Что произошло?
    
    — В семьдесят третьем я вышла замуж. Андрей. Инженер на заводе. Красивый, умный, добрый... — Её голос дрожит. — Мы были счастливы. Год. Целый год.
    
    Пауза.
    
    — А потом — он начал видеть.
    
    -> ep2_vera_loss

* [Не настаивать]
    — Если не хотите — не рассказывайте.
    
    — Нет. — Она качает головой. — Вы должны знать. Если хотите понять этот город — должны знать.
    
    -> ep2_vera_loss

=== ep2_vera_loss ===

# mood: dark

{ not (CharacterSecrets ? vera_past):
    — Мой муж. Андрей. — Вера садится. Тяжело, как старуха. — Инженер на заводе. Секретный отдел.
    
    ~ CharacterSecrets += vera_past
    ~ understanding_vera += 10
}

// Вопрос зависит от того, что игрок уже знает
{ cult_awareness >= 5:
    — Он работал в секретном отделе? С... — Вы пытаетесь вспомнить. — С кем-то из начальства?
    
    — Да. — Она кивает. — С руководителем проекта. Фамилию я не знала тогда. Узнала потом. — Пауза. — Чернов. Академик Чернов.
    
    ~ cult_awareness = cult_awareness + 3
    // ФАЗА 1: Раннее раскрытие Чернова
    ~ understanding_chernov += 10
    
    — Что это был за человек?
    
    Вера молчит. Долго.
    
    — Странный. Одержимый. — Она качает головой. — Андрей говорил — после смерти жены Чернов... изменился. Стал другим. Начал верить в вещи, в которые учёный верить не должен.
    
    ~ understanding_chernov += 5
- else:
    — Чем он занимался на заводе?
    
    — Секретный отдел. Что-то связанное с исследованиями. — Она качает головой. — Андрей не рассказывал. Не имел права.
}

Она закуривает. Руки трясутся.

— В октябре семьдесят четвёртого он пришёл домой... другим. Не могу объяснить. Те же глаза, тот же голос. Но — как будто что-то внутри сломалось.

— Что он говорил?

{ cult_awareness >= 8:
    — "Они открыли что-то, Верочка. Что-то, что не должно было быть открыто. И теперь — поздно."
- else:
    — Бессвязное. О работе. О каких-то экспериментах. О том, что "они зашли слишком далеко".
}

Она затягивается. Дым поднимается к потолку.

— Через неделю — первые галлюцинации. Красный лес. Голоса. Фигуры. Через месяц — он перестал узнавать меня. Через три месяца...

Её голос ломается.

— Я нашла его в ванной. Вены. Обе руки.

~ CharacterSecrets += vera_loss
~ understanding_vera += 25
~ trust_vera += 15

{ sanity < 60:
    Вы чувствуете — что-то откликается внутри. Знакомо. Слишком знакомо.
    
    «...она понимает...»
    «...она видела...»
    
    ~ lose_sanity(3)
}

— Мне жаль.

— Не надо. — Она тушит сигарету. — Жалость ничего не изменит. Но вот что изменит — правда. И я пятнадцать лет собираю её. Кусочек за кусочком.

* [Что вы нашли?]
    -> ep2_vera_research

* [Почему не уехали?]
    — После всего этого — почему остались?
    
    Вера смотрит на вас. В её глазах — что-то страшное. Решимость. Или безумие.
    
    — Потому что не могу бросить их. Пациентов. Таких же, как Андрей. Они приходят — один за другим — и я вижу в их глазах то же, что видела в его глазах.
    
    Пауза.
    
    — И ещё — потому что хочу знать. Что убило моего мужа. Что открыли в этих проклятых пещерах. И как это остановить.
    
    ~ CharacterSecrets += vera_guilt
    ~ understanding_vera += 20
    ~ trust_vera += 10
    
    -> ep2_vera_research

=== ep2_vera_research ===

— За пятнадцать лет я собрала... кое-что.

Она открывает сейф в углу кабинета. Достаёт толстую папку.

— Истории болезней. Протоколы вскрытий — неофициальные. Показания пациентов. Рисунки.

Она раскладывает бумаги на столе.

— Смотрите: все видят одно и то же. Красный лес. Алтарь. Дверь. И — ЭТО.

Рисунок. Детский, примитивный. Но то, что на нём изображено...

Тёмная масса. Щупальца? Лица? Глаза — десятки глаз — смотрят с бумаги.

{ sanity < 50:
    Вы отшатываетесь.
    
    «...узнаёшь...»
    «...ты видел нас...»
    
    ~ lose_sanity(5)
}

— Все рисуют одно и то же. Независимо друг от друга. Дети, старики, мужчины, женщины. Одно и то же существо.

~ cult_awareness += 5

# clue
Улика найдена: исследования доктора Холодовой
~ cult_awareness = cult_awareness + 3

# clue
Улика найдена: исследования Веры

— Это не болезнь. Это... воздействие. Как радиация, только для разума.

* [Откуда оно исходит?]
    — Из-под завода. Там пещеры. Очень древние.
    
    ~ trust_vera = trust_vera + 15
    
    -> ep2_vera_trust

* [Вы сообщали об этом?]
    — Один раз. После этого меня вызвал Астахов.
    
    — И?
    
    — Сказал, что если я хочу продолжать работать... и жить... я забуду об этом.
    
    ~ trust_vera = trust_vera + 10
    
    -> ep2_vera_trust

=== ep2_vera_trust ===

Вера смотрит вам в глаза:

— Вы другой. Вы не отступите, да?

— Нет.

— Тогда... — Она достаёт ключ. — Архив. Подвал. Там документы проекта "Эхо". Настоящие.

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesB ? underground_map):
    ~ CluesB += underground_map
    ~ evidence_collected = evidence_collected + 1
    
    # clue
    Улика найдена: карта подземелий от Веры
}
~ Relationships += trusted_vera

#
Улика найдена: ключ от архива

— Только не говорите никому. И... будьте осторожны.

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

— Фёдор! Откройте!

Ничего.

Вы прислушиваетесь. Внутри — шорох. Шаги — осторожные, крадущиеся.

Кто-то подходит к двери. Стоит за ней. Вы чувствуете — прямо за досками.

— Кто? — Голос — хриплый, надломленный. Как скрип ржавой петли.

— Следователь Сорокин. Из прокуратуры.

Долгая пауза. Вы слышите дыхание — тяжёлое, прерывистое.

— Прокуратура? — Горький смех за дверью. — Они послали прокуратуру? Двадцать лет молчали, а теперь — прокуратура?

— Мне нужно поговорить. О том, что происходит в этом городе.

Пауза. Шорох.

Дверь приоткрывается — на цепочке. В щели — глаз. Один. Серый, с красными прожилками. Дикий, но... ясный. Острый.

— Вы пришли. — Голос — еле слышный шёпот. — Я знал. ОНИ сказали, что придёте.

— Кто сказал?

Дверь закрывается. Звук — цепочка снимается. Дверь открывается — широко.

Фёдор. Тот самый мужчина, которого вы видели у завода ночью. Но при свете дня он выглядит... хуже.

Старик. Хотя ему, наверное, лет шестьдесят — не больше. Но глаза — стариковские. Видели слишком много. Лицо — изрезано морщинами, серое, как кора дерева. Шрамы на щеке — три параллельные линии — красные, воспалённые.

Он смотрит на вас. Оценивает.

— Вы слышали голоса?

{ KeyEvents ? heard_voices:
    Вы не отвечаете. Но что-то в вашем лице — говорит за вас.
    
    — Слышали. — Фёдор кивает. — Вижу. У вас — глаза. Такие же, как были у меня. Двадцать лет назад.
}

* [Войти]
    — Можно войти?
    
    Фёдор колеблется. Смотрит за вашу спину — на лес.
    
    — Быстро. Пока они не заметили.
    
    -> ep2_fyodor_inside

* [Поговорить на пороге]
    — Я постою здесь.
    
    — Как хотите. — Фёдор пожимает плечами. — Но ОНИ видят. Везде. Особенно — у леса.
    
    Он оглядывается. Нервно.
    
    — Говорите быстро. Что хотите знать?
    
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

— Закройте дверь. — Фёдор уже внутри, у стола. — Быстро. Они не любят закрытых дверей, но это... это даёт время.

Вы закрываете. Темнота сгущается.

— Вы... — Вы не знаете, как спросить. — Вы всё это собрали?

— Я ПОМНЮ. — Фёдор поворачивается. В свете свечей его лицо — как маска. — Двадцать лет помню. Каждую ночь. Каждый сон. Каждый голос.

Он подходит к стене. Проводит рукой по вырезкам.

— Вот. — Указывает на фотографию. — Это я. Пятьдесят третий год. Молодой. Счастливый. Не знал ещё.

На фото — группа мужчин в полевой одежде. Геологи? Рядом — горы, палатки, оборудование.

— А вот — Серафим. — Он указывает на другого. — Тоже был геологом. Тоже нашёл. Тоже... изменился.

Пауза.

— Вы хотите знать правду, следователь?

* [Да]
    — Для этого я здесь.
    
    Фёдор кивает. Медленно. Словно решается на что-то страшное.
    
    — Садитесь. — Он указывает на табуретку. — Это — долгая история.
    
    -> ep2_fyodor_truth

* [Сначала — кто вы?]
    — Подождите. Сначала — расскажите о себе. Кто вы? Как попали сюда?
    
    Фёдор усмехается. Горько.
    
    — Я был геологом. Давно. В другой жизни. Молодым, умным, амбициозным. Приехал сюда в пятьдесят третьем — искать руду. Нашёл кое-что другое.
    
    Он подходит к карте на стене. Большой, рукописной.
    
    — Мы с Серафимом — вместе. Он был моим напарником. Другом. — Пауза. — Единственным другом, который остался.
    
    ~ trust_serafim = trust_serafim + 5
    
    — Что вы нашли?
    
    — Пещеры. Древние. Под тем местом, где теперь завод.
    
    -> ep2_fyodor_truth

=== ep2_fyodor_talk ===

— Что вы видели в ту ночь? У завода?

— То же, что видите вы. Тени. Голоса. Красный свет.

— Это реально?

Фёдор смеётся. Горько.

— Реальнее, чем вы думаете.

-> ep2_fyodor_truth

=== ep2_fyodor_truth ===

Фёдор садится на табуретку. Достаёт из кармана — трубку. Старую, деревянную, обкуренную до черноты.

— В пятьдесят третьем... — Он набивает трубку табаком. Руки дрожат. — Мы геологоразведка. Искали железо. Медь. Что-то полезное для страны.

Он зажигает спичку. Затягивается. Дым — густой, сладковатый — заполняет комнату.

— Нашли пещеры. Под горой. Там, где теперь завод.

— Пещеры?

— Огромные. Километры. Уходят вглубь — как лабиринт. — Он качает головой. — Мы думали — открытие века. Карстовые полости, подземные реки... Позвали начальство. Начальство — Москву.

Пауза. Фёдор смотрит в огонь трубки.

— А в пещерах — рисунки. На стенах. Древние. Тысячи лет — может, десять тысяч. Может, больше.

— Что за рисунки?

— Символы. Те самые. — Он указывает на стену, на красные круги. — И фигуры. Люди в капюшонах. И... ОНО.

— Что — "оно"?

Фёдор не отвечает. Встаёт. Подходит к столу. Роется в бумагах.

— Вот. — Он достаёт мятую карту. Самодельную, нарисованную от руки. — Подземелья. Я чертил по памяти. Двадцать лет чертил. Каждую ночь — после снов — добавлял детали.

Вы берёте карту. Смотрите.

Лабиринт. Коридоры, залы, развилки. Некоторые помечены крестиками — "обвал", "опасно", "не ходить". Другие — звёздочками. И в центре — большой зал. Круглый. С точкой посередине.

— Алтарь. — Фёдор указывает на точку. — Они называют это Дверью.

~ CluesE += fyodor_map
~ evidence_collected = evidence_collected + 3

# clue
Улика найдена: карта подземелий Фёдора

— Учёные приехали в пятьдесят четвёртом. Из Москвы. Военные. В штатском, но — военные. Я узнаю породу.

— Что они делали?

— Эксперименты. "Проект Эхо" — так называлось. Официально — изучение акустики пещер. Неофициально...

Он замолкает. Затягивается трубкой.

— Неофициально — контакт. С тем, что там живёт.

* [Дверь куда?]
    — Эта дверь... куда она ведёт?
    
    Фёдор качает головой.
    
    — Не "куда". — Его голос — шёпот. — "Откуда". ОНО приходит оттуда. Когда дверь открывается.
    
    — Что за "оно"?
    
    — Не знаю. — Он вздрагивает. — Никто не знает. Те, кто видел целиком — не вернулись. Или... вернулись другими.
    
    Пауза.
    
    — Я видел... часть. Тень. Форму без формы. Голос без звука. — Он трёт шрамы на щеке. — Этого хватило. На всю жизнь хватило.
    
    ~ cult_awareness = cult_awareness + 3
    
    -> ep2_fyodor_offer

* [Кто "они"?]
    — Вы сказали "они". Кто — они?
    
    — Чернов. — Фёдор сплёвывает. — Академик Чернов. Главный. Он приехал с учёными в пятьдесят четвёртом. Тогда — молодой. Умный. Амбициозный.
    
    — Он всё ещё здесь?
    
    — Здесь. — Фёдор кивает. — Постарел — как все мы. Но не отступил. Наоборот. Он создал... культ. Последователей. Тех, кто верит.
    
    — Во что?
    
    — Что ОНО — бог. — Фёдор усмехается. — Что оно даст им силу. Власть. Бессмертие. Что угодно. Чернов обещает — они верят.
    
    ~ cult_awareness = cult_awareness + 2
    
    -> ep2_fyodor_offer

=== ep2_fyodor_offer ===

Фёдор смотрит на вас долго.

— Вы придёте туда. В пещеры. Я знаю.

— Почему вы так уверены?

— Потому что оно уже позвало вас. Вы слышали голоса?

{ KeyEvents ? heard_voices:
    Вы киваете.
    
    — Значит, поздно. Вы уже часть этого.
}

— Я могу помочь. Показать путь. Но...

// ИСПРАВЛЕНО: устанавливаем оба флага при согласии Фёдора помочь
// fyodor_ally — факт союзничества (в KeyEvents)
// trusted_fyodor — уровень доверия (в Relationships)

* [Что взамен?]
    — Обещайте. Если я не вернусь... сожгите сторожку. Всё.
    
    // ИСПРАВЛЕНО: оба флага устанавливаются вместе для консистентности
    { not (KeyEvents ? fyodor_ally):
        ~ KeyEvents += fyodor_ally
    }
    { not (Relationships ? trusted_fyodor):
        ~ Relationships += trusted_fyodor
    }
    
    — Обещаю.
    
    -> ep2_fyodor_end

* [Это опасно]
    — Я знаю. Двадцать лет я прячусь. Хватит.
    
    // ИСПРАВЛЕНО: оба флага устанавливаются вместе для консистентности
    { not (KeyEvents ? fyodor_ally):
        ~ KeyEvents += fyodor_ally
    }
    { not (Relationships ? trusted_fyodor):
        ~ Relationships += trusted_fyodor
    }
    
    -> ep2_fyodor_end

=== ep2_fyodor_end ===

— В ночь полнолуния. Через три дня. Приходите сюда. Я проведу вас.

Он протягивает руку. Его ладонь — в шрамах.

— До встречи, следователь. Если доживём.

-> episode2_morning

=== episode2_factory_search ===

~ actions_today = actions_today + 1

# mood: tense

Завод "Прометей". Вы идёте к проходной.

— Пропуск?

— Следователь Сорокин. Прокуратура.

Охранник звонит куда-то. Долго.

— Проходите. Но вас будут сопровождать.

К вам приставляют человека в штатском. Молчаливого.

* [Идти в кабинет Зорина]
    -> ep2_zorin_office

* [Искать тайник в другом месте]
    -> ep2_factory_basement

=== ep2_zorin_office ===

Кабинет Зорина — пуст. Всё вывезено.

— Где его вещи?

— Изъяты. — Человек в штатском не моргает. — По распоряжению.

Но вы замечаете — плинтус у окна слегка отходит.

* [Проверить позже]
    Вы запоминаете. Нужно вернуться без сопровождения.
    
    -> ep2_factory_end

* [Попробовать отвлечь сопровождающего]
    — У меня закружилась голова. Можно воды?
    
    Человек колеблется. Уходит.
    
    Вы быстро отрываете плинтус.
    
    Внутри — записка и ключ.
    
    "К.Л. — вход через подвал больницы. Код 1953."
    
    ~ CluesB += experiment_records
    ~ evidence_collected = evidence_collected + 2
    ~ cult_awareness = cult_awareness + 3
    
    # clue
    Улика найдена: записка Зорина с кодом
    
    -> ep2_factory_end

=== ep2_factory_basement ===

— Мне нужно в подвал.

— Закрыто.

— Распоряжение прокуратуры.

Человек колеблется. Достаёт рацию. Говорит что-то тихо.

— Ждите.

Через десять минут появляется Астахов. Серый костюм, пустые глаза.

— Товарищ Сорокин. Опять вы.

~ lose_sanity(3)

— Подвал закрыт по соображениям безопасности. Радиация.

— Я готов рискнуть.

— А я — нет. — Астахов улыбается. — Уходите. Пока можете.

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
    
    ~ lose_sanity(2)
}

{ is_mad():
    Сон не приходит.
    
    Голоса. Шёпот. Они не прекращаются.
    
    «...ты слышишь нас...»
    «...приди...»
    «...дверь ждёт...»
    
    ~ lose_sanity(4)
    
    // ПРОВЕРКА НА БЕЗУМИЕ
    { sanity <= 0:
        -> sanity_collapse
    }
}

{ KeyEvents ? fyodor_ally:
    За окном — далёкий свет. У леса. Сторожка Фёдора.
    
    Он не спит. Как и вы.
}

...

Вы просыпаетесь — или очнулись от забытья — в четыре утра.

За окном — первый свет.

КОНЕЦ ЭПИЗОДА 2

Ваш рассудок: {sanity}/100
Дней осталось: {days_remaining}
Собрано улик: {count_all_clues()}

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

17 НОЯБРЯ 1986 ГОДА

День третий

...

Вы просыпаетесь — резко, как от удара.

Темнота. Потолок. Незнакомый потолок.

Сердце колотится. Простыня — мокрая от пота. На губах — привкус меди, словно кусали язык во сне.

Который час? Часы на тумбочке показывают пять утра. За окном — ещё темно. Но не совсем — на востоке, над лесом — бледная полоска рассвета.

{ sanity < 50:
    Голоса.
    
    Они были здесь. Всю ночь. Шептали, бормотали, звали.
    
    «...приди к нам...»
    «...дверь ждёт...»
    «...ты наш... ты всегда был наш...»
    
    Вы прижимаете ладони к ушам. Бесполезно. Они — внутри. В голове.
    
    Когда началось? Вчера? Позавчера? Вы уже не помните времени, когда их не было.
    
    ~ lose_sanity(3)
}

{ sanity >= 50:
    Сон был... странным. Фрагменты. Образы. Красный свет. Чьи-то руки — холодные, влажные — тянутся из темноты.
    
    Вы встряхиваете головой. Просто кошмар. Просто нервы.
    
    Но руки — дрожат.
}

Вы садитесь на кровати. Смотрите в темноту.

Третий день. Осталось три дня до полнолуния. До ритуала.

{ days_remaining <= 3:
    Времени почти нет. Нужно действовать. Быстро.
}

{ KeyEvents ? fyodor_ally:
    Фёдор. Старый сторож с безумными глазами и картой подземелий.
    
    Он обещал провести вас в ночь полнолуния. Показать путь к алтарю. К Двери.
    
    Через два дня.
    
    Но сначала — завод. Нужно найти вход. Проверить, правда ли то, что он говорил.
}

{ trust_serafim >= 50 && MetCharacters ? serafim:
    Серафим. Священник, который был геологом. Который видел. Который знает.
    
    Он говорил о древних ходах. Тропах, которые были до завода, до города, до всего.
    
    Может, он поможет?
}

Вы встаёте. Умываетесь ледяной водой. Смотрите в зеркало.

Лицо — чужое. Осунувшееся, серое. Глаза — красные, воспалённые. Под ними — тёмные полукружья, как синяки.

Вы выглядите... больным. Или сумасшедшим.

А может — и тем, и другим.

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

— Пропуск?

— Следователь Сорокин. Прокуратура.

Долгая пауза. Звонок куда-то.

— Проходите. Но без сопровождения — никуда.

К вам приставляют молчаливого человека в штатском. Он следует за вами везде.

~ lose_sanity(2)

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

— Эй!

Бежите. Лестница вниз. Дверь.

{ sanity >= 50:
    Вам удаётся скрыться. Сердце колотится.
    
    ~ lose_sanity(3)
    
    -> episode3_caves
- else:
    Вы бежите. Но коридоры — все одинаковые. Или это галлюцинация?
    
    Стены — красные? Нет. Серые.
    
    Вас находят. Выводят под руки.
    
    ~ lose_sanity(5)
    
    -> ep3_caught
}

=== ep3_caught ===

Астахов ждёт у выхода.

— Товарищ Сорокин. Вы испытываете моё терпение.

— Я провожу расследование.

— Ваше расследование закончено. — Он достаёт бумагу. — Приказ о вашем отзыве. С завтрашнего дня.

* [Это незаконно]
    — Мои полномочия определены прокуратурой.
    
    — Здесь — МОИ полномочия.
    
    ~ trust_astahov = trust_astahov - 10
    ~ lose_sanity(3)
    
    -> ep3_thrown_out

* [Согласиться притворно]
    — Разумеется, товарищ полковник.
    
    Астахов кивает.
    
    — Правильное решение.
    
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

— Что там? — Вы указываете на заваренную дверь.

— Радиационная зона. Закрыто.

Ложь. Вы чувствуете.

-> episode3_evening_choice

=== episode3_back_entrance ===

Вы обходите периметр. Забор. Колючая проволока.

У старого склада — дыра в заборе. Кто-то уже пролезал.

Внутри — темно. Запах машинного масла и чего-то... сладковатого.

На стене — тот самый символ. Красный круг, три линии.

{ not (CluesC ? cult_symbol):
    ~ CluesC += cult_symbol
    ~ evidence_collected = evidence_collected + 1
    ~ boost_theory(5, 5)
    
    # clue
    Улика найдена: символ на складе
}

~ cult_awareness = cult_awareness + 2

{ not (KeyEvents ? saw_symbol):
    ~ KeyEvents += saw_symbol
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

Таня приходит через час.

— Вы уверены?

— Да.

— Тогда идём. Я знаю, как обойти охрану.

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

— Я знаю, как пройти. — Таня ведёт вас через технический коридор.

— Папа показывал. Когда я была маленькой.

Вы оказываетесь в подвальном помещении. Старые трубы, ржавые вентили.

— Дальше я не ходила. Папа говорил — там опасно.

~ trust_tanya = trust_tanya + 10
~ gain_sanity(3)

* [Идти вместе]
    — Останься здесь.
    
    — Нет. — Её голос твёрд. — Это мой отец.
    
    -> episode3_caves_with_ally

* [Попросить её остаться]
    — Таня, это опасно.
    
    — Я знаю. Но...
    
    Она колеблется.
    
    — Ладно. Но если через час не вернётесь — я иду за вами.
    
    -> episode3_caves

=== episode3_serafim_path ===

// Новый путь — через Серафима (требует высокое доверие)

Вы идёте к церкви.

Серафим ждёт у двери.

— Вы решились. Хорошо.

— Вы знаете другой путь?

— Древний ход. Ещё до завода был. Манси знали его.

~ trust_serafim = trust_serafim + 10
~ gain_sanity(5)

// ТОЧКА НЕВОЗВРАТА: Выбор союзника
{ chosen_ally == 0:
    ~ chosen_ally = 3  // Серафим
    
    # point_of_no_return
    Вы выбрали путь Серафима. Этот выбор определит доступные пути в финале.
}

Он ведёт вас через лес. Тропой, которую вы бы никогда не нашли сами.

— Вот. — Серафим указывает на скалу. — Вход. Но дальше я не пойду. Мои кости слишком стары.

— Спасибо, отец.

— Храни вас Бог. — Он крестит вас. — И помните: свет сильнее тьмы. Всегда.

-> episode3_caves

=== episode3_fyodor_path ===

Фёдор ждёт у своей сторожки.

— Вы решились.

— Да.

— Тогда идём. — Он достаёт карту. — Есть старый ход. Из леса. Ещё до завода был.

Вы идёте через лес. Снег скрипит под ногами.

{ sanity < 60:
    Деревья — красные? Нет. Серые. Просто свет такой.
    
    ~ lose_sanity(2)
}

Фёдор останавливается у огромного валуна.

— Здесь.

Он отодвигает камни. За ними — вход в пещеру.

— Я двадцать лет не заходил сюда. — Его голос дрожит. — Но для вас — зайду.

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
    
    — Здесь. Осторожно.
}

{ MetCharacters ? tanya:
    Таня держится рядом. Фонарик дрожит в её руке.
    
    — Это... древнее.
}

{ not (KeyEvents ? entered_caves):
    ~ KeyEvents += entered_caves
    
    Пещеры. Древние. Рисунки на стенах.
    
    Те же символы. Тысячи лет.
    
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesD ? expedition_1890):
        ~ CluesD += expedition_1890
        ~ evidence_collected = evidence_collected + 1
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
    — Здесь. — Фёдор останавливается. — Алтарь.
}

Фонарик выхватывает... алтарь.

Камень, покрытый чем-то тёмным. Засохшая кровь.

// Добавляем улику только если ещё не нашли
{ not (CluesC ? insider_testimony):
    ~ CluesC += insider_testimony
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: следы ритуалов
}

{ MetCharacters ? tanya:
    — Боже... — Таня бледнеет. — Это... это кровь?
    
    — Да.
    
    Она хватает вас за руку.
}

{ sanity < 50:
    Голоса. Громче.
    
    «...ОН ЗДЕСЬ...»
    
    ~ lose_sanity(3)
}

Внезапно — шаги. Много.

* [Прятаться]
    -> ep3_hide

* [Бежать]
    -> ep3_run_with_ally

=== ep3_run_with_ally ===

— Бежим!

{ MetCharacters ? tanya:
    Вы хватаете Таню за руку.
}

{ KeyEvents ? fyodor_ally:
    — За мной! — кричит Фёдор. — Знаю короткий путь!
}

Вы несётесь по коридорам. Сзади — шаги. Много.

~ lose_sanity(5)

{ KeyEvents ? fyodor_ally:
    Фёдор выводит вас к выходу. Он знает каждый поворот.
    
    ~ gain_sanity(2)
}

Наконец — свет. Снег. Свобода.

{ MetCharacters ? tanya:
    Таня тяжело дышит рядом.
    
    — Что... что это было?
}

Вы оглядываетесь. За спиной — темнота пещеры.

Никто не преследует. Пока.

-> ep3_escape_together

=== ep3_split_up ===

— Разделимся. Охватим больше.

{ MetCharacters ? tanya:
    — Таня, ты налево. Я — направо.
    
    — Хорошо. — Она не выглядит уверенной.
}

{ KeyEvents ? fyodor_ally:
    — Фёдор, проверь тот коридор.
    
    — Как скажете.
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
    
    ~ lose_sanity(5)
    
    -> ep3_escape_together

=== ep3_tanya_danger ===

Вы бежите.

Таня — у стены. Перед ней — фигура в капюшоне.

— СТОЙ!

Фигура оборачивается. Лица не видно.

* [Атаковать]
    Вы бросаетесь вперёд.
    
    Удар. Фигура падает. Капюшон — пуст?
    
    Нет. Человек. Обычный человек в маске.
    
    ~ lose_sanity(3)
    
    -> ep3_tanya_saved

* [Схватить Таню и бежать]
    Вы хватаете Таню за руку.
    
    — Бежим!
    
    Вы несётесь по коридорам. Сзади — шаги.
    
    ~ lose_sanity(5)
    
    -> ep3_escape_together

=== ep3_tanya_saved ===

— Ты в порядке?

Таня кивает. Дрожит.

— Кто это был?

Вы снимаете маску с лежащего.

Лицо — незнакомое. Молодой человек. Рабочий завода?

— Они... они везде.

// Добавляем улику только если ещё не нашли
{ not (CluesC ? insider_testimony):
    ~ CluesC += insider_testimony
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: член культа
}

// ДОБАВЛЕНО: укрепление связи с Таней после спасения
Таня смотрит на вас. В её глазах — благодарность. И что-то ещё.

— Вы... спасли мне жизнь.

~ trust_tanya = trust_tanya + 10

-> ep3_escape_together

=== ep3_fyodor_danger ===

Вы бежите.

Фёдор — на полу. Над ним — двое в капюшонах.

— СТОЙ!

Они оборачиваются. Бегут.

Вы падаете на колени рядом с Фёдором.

— Фёдор!

Он дышит. Кровь на лбу.

— Они... они меня узнали... — Он кашляет. — Двадцать лет прятался... а они...

* [Помочь ему выбраться]
    Вы поднимаете его на плечо.
    
    — Держись.
    
    ~ lose_sanity(3)
    
    -> ep3_escape_with_fyodor

* [Оставить и бежать]
    — Прости.
    
    — Нет... не... — Но вы уже бежите.
    
    ~ KeyEvents += found_fyodor_body
    ~ lose_sanity(10)
    ~ Relationships -= trusted_fyodor
    
    // ПРОВЕРКА НА БЕЗУМИЕ — предательство союзника
    { sanity <= 0:
        -> sanity_collapse
    }
    
    -> ep3_escape_alone_guilt

=== ep3_escape_with_fyodor ===

Вы тащите Фёдора к выходу.

Он тяжёлый. Старый. Но живой.

— Спасибо... — хрипит он. — Вы... не такой как они...

// Укрепляем связь с Фёдором
~ Relationships += trusted_fyodor
~ gain_sanity(3)

Наконец — свет. Выход.

Вы оба падаете в снег. Дышите.

— Они знают... — Фёдор смотрит на лес. — Теперь они знают, что мы были там.

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
    
    — Что это было?
    
    — Культ. Они настоящие.
    
    — Папа... он знал.
    
    ~ trust_tanya = trust_tanya + 15
}

-> episode3_evening_choice

=== ep3_hide ===

Вы прячетесь за камнями.

Шаги приближаются.

Голоса:

— ...ритуал в полнолуние...
— ...три жертвы готовы...
— ...Чернов сказал — скоро Дверь откроется навсегда...

~ cult_awareness = cult_awareness + 3

Они проходят мимо.

{ MetCharacters ? tanya:
    Таня зажимает рот рукой. Молчит.
}

{ KeyEvents ? fyodor_ally:
    Фёдор шепчет:
    
    — Три жертвы. Зорин — один из них.
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

И — он. Чернов. Высокий. В белом.

— Братья и сёстры. Через два дня — час настанет.

~ MetCharacters += chernov
~ cult_awareness = cult_awareness + 5

# clue
Улика найдена: Чернов — лидер культа

{ sanity < 50:
    Вы видите... что-то. Над алтарём. Тень? Форма?
    
    «...СКОРО...»
    
    ~ lose_sanity(5)
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
        ~ evidence_collected = evidence_collected + 2
    
        # clue
        Улика найдена: Астахов — член культа
    }
    
    ~ lose_sanity(3)
    
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
        ~ lose_sanity(5)
        
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
        
        ~ lose_sanity(8)
        
        Бьют. Долго. Больно.
        
        Но Таня ушла. Она в безопасности.
        
        -> ep3_beaten
    
* [Направо — дальше]
    Вы бежите дальше. Коридор петляет.
    
    Таня споткнулась!
    
    * * [Помочь ей]
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
        ~ lose_sanity(3)
        
        # point_of_no_return
        Таня ранена. Это изменит доступные концовки.
        
        Вы несёте её на себе. Кое-как — выбираетесь.
        
        -> ep3_tanya_aftermath

=== ep3_tanya_aftermath ===

Вы выбрались.

Таня — бледная, в крови. Но живая.

— Простите... — шепчет она. — Из-за меня...

— Молчи. — Вы несёте её к машине. — Всё будет хорошо.

Но вы знаете — не будет. Ничего не будет как прежде.

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
~ lose_sanity(10)

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
        ~ evidence_collected = evidence_collected + 1
    }
    ~ cult_awareness = cult_awareness + 3
    
    # clue
    Улика найдена: древние рисунки в пещерах
}

Дальше — коридор. Узкий, извилистый.

На полу — следы. Недавние. Ботинки. Много.

Свечи — у стен. Оплывшие, потухшие. Пепел на камнях.

Здесь были люди. Недавно. Может — вчера. Может — сегодня утром.

{ sanity < 60:
    Голоса — громче здесь. Яснее.
    
    «...ближе...»
    «...ты почти дома...»
    
    ~ lose_sanity(2)
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

Вы идёте вглубь. Один.

Коридор петляет — влево, вправо, вниз. Карта Фёдора в кармане, но здесь всё выглядит иначе. Темнота скрадывает расстояния, искажает пропорции.

// HORROR: События в глубине
-> check_for_horror_event ->

Потолок опускается. Приходится нагибаться. Потом — ползти на четвереньках.

Камни — острые. Царапают ладони, рвут ткань брюк.

И запах. Чем глубже — тем сильнее. Сладковатый, тошнотворный. Как разложение. Как смерть.

// HORROR: Ещё одно событие при продвижении
-> check_for_horror_event ->

Коридор расширяется. Вы встаёте. Отряхиваетесь.

И —

Фонарик выхватывает... зал.

Огромный. Свод теряется в темноте. Стены — покрыты рисунками, символами, надписями. Некоторые — древние, выцарапанные на камне. Другие — свежие, нарисованные краской.

В центре зала — алтарь.

Камень. Большой, плоский, как стол. Тёмный — почти чёрный.

Вы подходите ближе. Проводите пальцем по поверхности.

Влажно. Липко.

Вы смотрите на палец.

Красное.

Кровь.

Засохшая? Свежая? Вы не уверены.

// Добавляем улику только если ещё не нашли
{ not (CluesC ? insider_testimony):
    ~ CluesC += insider_testimony
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: следы ритуалов — кровь на алтаре
}

Вокруг алтаря — круги. Нарисованные на полу. Красные. Те же символы — снова и снова.

И свечи. Десятки свечей. Оплывшие, погасшие. Но воск — ещё мягкий.

Здесь были. Недавно. Очень недавно.

~ lose_sanity(5)

// ПРОВЕРКА НА БЕЗУМИЕ
{ sanity <= 0:
    -> sanity_collapse
}

{ sanity < 50:
    Голоса.
    
    Они — здесь. В этом зале. Эхом отражаются от стен, от потолка, от алтаря.
    
    «...ты пришёл...»
    «...мы ждали...»
    «...скоро... скоро будешь с нами...»
    
    Вы крутитесь. Ищете источник.
    
    Никого. Пустой зал. Тёмный алтарь.
    
    Но голоса — не прекращаются.
    
    ~ lose_sanity(3)
    
    // ПРОВЕРКА НА БЕЗУМИЕ
    { sanity <= 0:
        -> sanity_collapse
    }
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
    
    ~ lose_sanity(5)
    
    // ПРОВЕРКА НА БЕЗУМИЕ
    { sanity <= 0:
        -> sanity_collapse
    }
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
    
    ~ lose_sanity(3)
}

{ trust_tanya >= 60:
    Таня приходит вечером. С едой.
    
    — Вы должны поесть.
    
    Вы молча едите. Её присутствие успокаивает.
    
    ~ gain_sanity(3)
}

{ sanity < 60:
    Голоса не отпускают.
    
    «...два дня...»
    «...дверь откроется...»
    «...ты будешь с нами...»
}

Ваш рассудок: {sanity}/100
Собрано улик: {count_all_clues()}

* [Конец дня третьего]
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

18 НОЯБРЯ 1986 ГОДА

День четвёртый

{ sanity < 40:
    Грань между реальностью и видениями стирается.
    
    Голоса — постоянны. Неразличимы от мыслей.
    
    Вы уже не уверены, что реально.
}

// Похищение Серафима — но ТОЛЬКО если низкое доверие или не помогали
// Если высокое доверие — Серафим прячется сам и может помочь в эпизоде 4
{ MetCharacters ? serafim:
    { trust_serafim >= 50 && Relationships ? helped_serafim:
        // Серафим предупреждён и скрылся — доступен для благословения
        Утром — записка под дверью.
        
        "Следователь. Они придут за мной ночью. Я ухожу в скит. Приходите до заката — у церкви."
        
        ~ gain_sanity(2)
    - else:
        ~ KeyEvents += serafim_kidnapped
        
        Утром вас будит стук. Клава.
        
        — Товарищ следователь! Отец Серафим... Его дом разгромлен!
        
        Вы едете на место. Кровь на стене. Мебель перевёрнута.
        
        На столе — записка: "ПЕЩЕРЫ. ПОЛНОЛУНИЕ. НЕ ПРИХОДИ ИЛИ УМРЁШЬ."
        
        { Relationships ? helped_serafim:
            Он доверял вам. А теперь...
            
            ~ lose_sanity(7)
            
            // ПРОВЕРКА НА БЕЗУМИЕ
            { sanity <= 0:
                -> sanity_collapse
            }
        - else:
            ~ lose_sanity(5)
        }
    }
- else:
    Вы слышите новости: старый священник на окраине пропал. Дом разгромлен.
    
    Местные шепчутся: "Красный лес забрал".
    
    ~ lose_sanity(3)
}

// Вера в опасности (если встречали и доверяла)
{ MetCharacters ? vera && Relationships ? trusted_vera:
    ~ KeyEvents += vera_captured
    
    Звонок из больницы. Веры нет на работе. Её квартира — пуста.
    
    Соседи видели людей в тёмном. Ночью.
    
    Она доверилась вам. И теперь — пропала.
    
    ~ lose_sanity(5)
- else:
    { MetCharacters ? vera:
        ~ KeyEvents += vera_captured
        
        Говорят, доктор Холодова не вышла на работу. Её ищут.
        
        ~ lose_sanity(2)
    - else:
        Из больницы пропала заведующая психиатрией. Вы её не знали.
    }
}

// Проверка на Фёдора
{ KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body):
    Фёдор. Он обещал провести вас в пещеры. Сегодня — последний шанс подготовиться.
}

{ KeyEvents ? found_fyodor_body:
    Фёдор мёртв. Из-за вас.
    
    Теперь вы одни.
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

Церковь на окраине. Серафим ждёт.

— Вы пришли.

— Завтра — ритуал. Я иду в пещеры.

Он долго молчит.

— Я знаю. — Серафим встаёт. — Встаньте на колени.

Вы опускаетесь.

Он кладёт руки на вашу голову. Шепчет молитву.

Тепло. Странное ощущение. Голоса — тише.

~ gain_sanity(10)
~ trust_serafim = trust_serafim + 15

— Идите. — Серафим улыбается. — Свет с вами. Всегда.

{ sanity >= 60:
    Впервые за дни — ясность. Покой.
}

* [Спросить о том, кто ведёт ритуал]
    — Отец, вы знаете, кто стоит за всем этим?
    
    Серафим замирает. Его глаза — тёмные, бездонные.
    
    — Есть один человек. — Голос — тихий. — Я знал его. Давно, когда ещё был геологом.
    
    — Кто он?
    
    — Учёный. Академик. — Серафим отворачивается. — Он потерял жену. Это сломало его. Он начал искать способ... преодолеть границу между живыми и мёртвыми.
    
    // ФАЗА 1: Раннее раскрытие Чернова
    ~ understanding_chernov += 15
    
    — И нашёл?
    
    — Нашёл Дверь. — Серафим качает головой. — Бедный человек. Он думает, что Те, Кто Ждёт — вернут ему любимую. Но они лгут. Они всегда лгут.
    
    ~ understanding_chernov += 5
    ~ boost_theory(5, 10)
    
    -> episode4_afternoon

* [Уйти в молчании]
    -> episode4_afternoon

=== episode4_fyodor_plan ===

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Сторожка Фёдора. Он ждёт.

— Завтра.

— Знаю.

— Вы готовы?

* [Да]
    — Насколько можно быть готовым.
    
    Фёдор кивает.
    
    -> ep4_fyodor_strategy

* [Нет]
    — Честно? Нет.
    
    — Я тоже. Двадцать лет назад — не был готов. И сейчас — не уверен.
    
    -> ep4_fyodor_strategy

=== ep4_fyodor_strategy ===

— Слушайте внимательно. — Фёдор разворачивает свою карту.

— Вход через лес — здесь. — Он указывает точку. — Культисты не знают о нём. Думают, я забыл.

— Дальше?

— Три коридора. Левый — ловушки. Правый — тупик. Центральный — к алтарю.

~ cult_awareness = cult_awareness + 2

— И ещё. — Он понижает голос. — Есть способ закрыть Дверь. Навсегда.

* [Какой?]
    — Добровольная жертва. Тот, кто сам выберет смерть — закроет её.
    
    — Вы...
    
    — Я думал об этом. Двадцать лет думал.
    
    ~ Relationships += fyodor_secret
    
    -> ep4_fyodor_end

* [Не хочу знать]
    — Потом. Сначала — выживем.
    
    -> ep4_fyodor_end

=== ep4_fyodor_end ===

— Завтра. На закате. Здесь.

Он протягивает руку.

— Удачи нам всем.

~ gain_sanity(3)

-> episode4_afternoon

=== episode4_gromov_confrontation ===

~ actions_today = actions_today + 1
~ time_of_day = time_of_day + 1

Вы идёте к Громову. Пора расставить точки над "i".

Кабинет. Он один. Бутылка на столе.

— Сорокин? Что...

— Я знаю. — Вы закрываете дверь. — Про культ. Про пещеры. Про Астахова.

Громов бледнеет.

— Вы... откуда...

* [Показать улики]
    Вы выкладываете фотографии. Карту. Записи.
    
    — Этого достаточно, чтобы упрятать вас на двадцать лет.
    
    -> ep4_gromov_react

* [Давить]
    — Неважно. Важно — что вы сделаете сейчас.
    
    -> ep4_gromov_react

=== ep4_gromov_react ===

Громов смотрит на бутылку. Потом — на вас.

— Вы не понимаете. Они... они везде. Астахов. Завод. Партком.

— Мне нужна помощь.

— Я... — Он колеблется.

* [Вы тоже жертва]
    — Степан Петрович. Вы не убийца. Вы — жертва. Как и все здесь.
    
    Громов опускает голову.
    
    — Моя жена... она пропала в семьдесят восьмом. Они сказали — если расскажу...
    
    ~ trust_gromov = trust_gromov + 20
    
    // Добавляем улику только если ещё не нашли
    { not (CluesE ? gromov_confession):
        ~ CluesE += gromov_confession
        ~ evidence_collected = evidence_collected + 2
    
        # clue
        Улика найдена: признание Громова
    }
    
    -> ep4_gromov_ally

* [Или вы с ними, или со мной]
    — Выбирайте. Культ — или закон.
    
    Громов молчит. Долго.
    
    — Ладно. — Он достаёт ключ. — Оружейная. И... вот это.
    
    Папка. "ПРОЕКТ ЭХО — АРХИВ №7".
    
    // ИСПРАВЛЕНО: защита от дублирования улики
    { not (CluesB ? access_pass):
        ~ CluesB += access_pass
        ~ evidence_collected = evidence_collected + 1
    
        # clue
        Улика найдена: архив Громова
    }
    
    -> ep4_gromov_ally

=== ep4_gromov_ally ===

— Завтра — ритуал. Полнолуние. В пещерах.

— Я знаю. — Громов встаёт. — Я... я пойду с вами.

— Вы уверены?

— Двадцать лет я молчал. Хватит.

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
    
    ~ lose_sanity(3)
    
    -> episode4_afternoon

=== ep4_call_tanya ===

— Таня. Завтра — всё решится.

Пауза. Вы слышите её дыхание в трубке.

— Я знаю. — Её голос тихий. — Папа там, да?

— Думаю, да. Живой.

— Я иду с вами.

— Это опасно.

— Виктор... — Она замолкает. Впервые назвала вас по имени. — Мне всё равно. Я хочу быть рядом. С вами.

~ trust_tanya = trust_tanya + 15

* [Согласиться]
    — Хорошо. Но делай, что скажу.
    
    — Обещаю.
    
    Пауза.
    
    — Виктор?
    
    — Да?
    
    — Спасибо. За всё.
    
    // ДОБАВЛЕНО: возможность романтики через телефонный разговор
    { trust_tanya >= 65:
        Что-то в её голосе... В этих словах.
        
        Вы понимаете — между вами есть связь. Глубже, чем просто расследование.
        
        ~ Relationships += romantic_tanya
    }
    
    -> episode4_afternoon

* [Отговорить]
    — Таня, ты — единственная, кто останется, если... если мы не вернёмся. Кто расскажет правду.
    
    Долгая пауза.
    
    — Ладно. — Её голос дрожит. — Но вы вернётесь. Обещайте.
    
    — Обещаю.
    
    ~ trust_tanya = trust_tanya + 5
    
    -> episode4_afternoon

=== ep4_gromov_help ===

Кабинет Громова.

— Сорокин? — Он удивлён. — Что...

— Мне нужна помощь. Завтра — ритуал. В пещерах.

Громов бледнеет.

— Я... я не могу...

— Они похитили Серафима. И Веру. Зорин там. Завтра их убьют.

Он долго молчит.

— Вот. — Он достаёт ключ. — Оружейная. Возьмите, что нужно.

// ИСПРАВЛЕНО: защита от дублирования улики
{ not (CluesB ? access_pass):
    ~ CluesB += access_pass
    ~ evidence_collected = evidence_collected + 1

    # clue
    Улика найдена: ключ от оружейной
}

— И, Сорокин... — Он смотрит в пол. — Простите меня. За всё.

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

ДЕНЬ

{ time_of_day >= 2:
    Вечереет. Времени на активные действия почти не осталось.
}

{ actions_today < 2:
    Ещё есть время на одно действие.
    
    * { actions_today < 2 } [Продолжить подготовку]
        -> episode4_morning
}

* [Вернуться в гостиницу — завершить день]
    -> episode4_evening

=== episode4_evening ===

# mood: dark

~ time_of_day = 2

ВЕЧЕР

Последний вечер перед полнолунием.

{ trust_tanya >= 50:
    Таня приходит.
    
    — Я не могу усидеть дома.
    
    Вы сидите вместе. Молча.
    
    * [Взять её за руку]
        Она не отстраняется. Её ладонь — тёплая.
        
        — Мы найдём его.
        
        — Я знаю.
        
        Она придвигается ближе. Её плечо касается вашего.
        
        — Виктор... — Её голос — шёпот. — Что бы ни случилось завтра...
        
        Она не заканчивает. Но вы понимаете.
        
        // ИСПРАВЛЕНО: защита от дублирования флага романтики
        { not (Relationships ? romantic_tanya):
            ~ Relationships += romantic_tanya
        }
        ~ gain_sanity(5)
        
        -> ep4_night

    * [Оставаться профессионалом]
        — Вам лучше поспать. Завтра — тяжёлый день.
        
        — Вы тоже.
        
        Она уходит.
        
        -> ep4_night
- else:
    Вы одни. Как обычно.
    
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
    
    ~ lose_sanity(2)
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
    
    Вы смотрите на окно. На ручку.
    
    Как легко было бы... просто открыть. Выйти. Пойти на голоса.
    
    Нет.
    
    Вы отворачиваетесь. Сжимаете кулаки.
    
    Не сегодня. Не так.
    
    Грань между сном и явью — стёрта. Вы уже не знаете, спите или бодрствуете. Реально ли то, что видите, или это галлюцинация.
    
    Единственное, что вы знаете точно: завтра — конец.
    
    Так или иначе.
    
    ~ lose_sanity(5)
    
    // ПРОВЕРКА НА БЕЗУМИЕ — последняя ночь
    { sanity <= 0:
        -> sanity_collapse
    }
}

...

За окном — первый свет.

Серый. Холодный. Рассвет.

19 ноября 1986 года.

День полнолуния.

Последний день.

Вы встаёте. Умываетесь. Одеваетесь.

Проверяете оружие. Патроны. Документы.

В зеркале — лицо. Чужое. Знакомое.

Лицо человека, готового умереть.

Или убить.

КОНЕЦ ЭПИЗОДА 4

Ваш рассудок: {sanity}/100
Дней осталось: {days_remaining}
Собрано улик: {count_all_clues()}

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

19 НОЯБРЯ 1986 ГОДА

Полнолуние

~ advance_moon()
~ ritual_countdown = 0
~ knows_deadline = true

...

Весь день — ожидание.

// ОБЪЯСНЕНИЕ: почему культ не убил Сорокина раньше
{ infection_level >= 30:
    Вы понимаете теперь. Почему они не остановили вас. Почему не убили — хотя могли десять раз.
    
    Вы — заражены. Вы — слышите голоса. Вы — ВИДИТЕ.
    
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
    Таня звонит в обед.
    
    — Я иду с вами.
    
    — Таня...
    
    — Это мой отец. Моя семья. Моё право.
    
    Вы не спорите. У неё есть право. Больше, чем у вас.
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
    
    — Вы пришли. — Он кивает. — Хорошо. Идём. Знаю короткий путь.
}

{ Relationships ? romantic_tanya:
    Таня — рядом. Бледная, но решительная. В руке — фонарик. Под пальто — что-то угловатое. Оружие?
    
    — Я готова, — говорит она. Голос не дрожит.
    
    — Держись рядом. Не отставай.
    
    — Обещаю.
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
    
    ~ lose_sanity(2)
}

* [Спуститься]
    Вы делаете глубокий вдох. Последний вдох перед...
    
    Неважно.
    
    — Идём.
    
    -> episode5_ritual

=== episode5_ritual ===

~ KeyEvents += witnessed_ritual
~ MetCharacters += chernov

# mood: horror

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
    
    ~ lose_sanity(3)
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
    
    — Папа! — Её голос — крик, вскрик, вырывающийся прежде, чем она успевает подумать.
    
    Фигуры в капюшонах — поворачиваются. Все одновременно. Как один организм.
    
    Вас заметили.
}

// Объяснение: Зорин был пленником культа 3 недели
~ KeyEvents += zorin_found

Зорин жив. Его держали для ритуала.

Голос у алтаря:

— Братья и сёстры. Час настал.

Чернов. Высокий, в белом. Но теперь — в свете факелов — вы видите его по-настоящему.

Старик. Очень старый. Волосы — седые, почти белые. Лицо — изрезанное морщинами, как кора старого дерева. Но глаза...

Глаза — молодые. Горящие. Безумные.

Или — наоборот — слишком разумные. Слишком понимающие.

— Дверь откроется. Те, Кто Ждёт — примут нас.

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
    
    — Чернов!
    
    Пение обрывается. Сотня голов — поворачивается к вам. Сотня пар глаз — в тени капюшонов — смотрят.
    
    Чернов — единственный, кто не удивлён.
    
    — А, следователь Сорокин. — Его голос — спокойный, почти дружелюбный. — Я ждал вас. Они сказали — вы придёте.
    
    — Кто сказал?
    
    — Те, Кто Ждёт. — Он улыбается. — Они знают всё. Видят всё. И они хотят... поговорить с вами.
    
    -> episode5_chernov_talk

=== episode5_chernov_talk ===

# mood: revelation

Чернов спускается с алтаря. Медленно. Его белая мантия шуршит по камням.

Культисты расступаются. Освобождают проход.

Он останавливается в трёх шагах от вас. Смотрит.

— Вы задаёте вопросы уже пять дней. — Его голос — мягкий, почти отеческий. — Но главный вопрос — так и не задали.

— Какой?

— "Почему?"

Он разводит руками.

— Почему я — академик, учёный, лауреат Государственной премии — посвятил жизнь... этому? — Он оглядывает пещеру. Алтарь. Жертвы. — Почему не уехал, когда мог? Не закрыл проект? Не похоронил всё под бетоном?

* [Почему?]
    — Хорошо. Почему?
    
    Чернов улыбается. Грустно.
    
    — Потому что они обещали мне кое-что. Кое-что, чего не может дать никакая наука.
    
    -> episode5_chernov_wife

* [Вы безумны]
    — Потому что вы сумасшедший.
    
    — Возможно. — Он кивает. — Но позвольте рассказать историю. Потом — решайте сами.
    
    -> episode5_chernov_wife

* [Мне плевать. Освободите заложников]
    — Меня не интересуют ваши мотивы. Освободите этих людей.
    
    — Нет. — Чернов качает головой. — Но я хочу, чтобы вы поняли. Перед концом. Чтобы знали — за что умираете.
    
    -> episode5_chernov_wife

=== episode5_chernov_wife ===

# mood: emotional

Чернов достаёт медальон из-под мантии. Открывает. Показывает вам.

Фотография. Молодая женщина. Тёмные волосы, большие глаза, улыбка.

— Марина. Моя жена.

~ CharacterSecrets += chernov_wife
~ understanding_chernov += 25

Его голос — меняется. Теплеет. Человечность — проступает сквозь маску жреца.

— Мы познакомились в Москве. Пятьдесят второй год. Я — молодой физик, она — студентка консерватории. Пианистка. Талантливая. Красивая. Живая.

Он замолкает. Смотрит на фотографию.

— Мы поженились через год. Были счастливы. По-настоящему счастливы. Два года.

— Что случилось?

— Рак. — Короткое слово. Как приговор. — Лейкемия. Ей было двадцать шесть. Врачи сказали — полгода. Максимум.

* [Мне жаль]
    — Мне жаль.
    
    — Не надо. — Он качает головой. — Это было тридцать два года назад. Я... научился жить с этим.
    
    -> episode5_chernov_experiment

* [Какое это имеет отношение к культу?]
    -> episode5_chernov_experiment

=== episode5_chernov_experiment ===

# mood: dark

— В пятьдесят четвёртом меня направили сюда. "Проект Эхо". Исследование аномалии под Уралом.

Чернов оглядывает пещеру.

— Мы нашли... это. Пещеры. Символы. И — Дверь. Мы не понимали, что это. Думали — природное явление. Или... или что-то древнее. Доисторическое.

Он усмехается.

— Мы ошибались.

~ CharacterSecrets += chernov_experiment
~ understanding_chernov += 20
~ CultLore += lore_project_echo_start
~ lore_depth += 3

— Когда мы впервые активировали резонатор... — Он замолкает. — Я услышал голос. Не снаружи — внутри. В голове.

— Что он сказал?

— "Мы можем вернуть её."

Пауза.

— Её. Марину. Голос знал. Знал о моей боли. О моей потере. И обещал... обещал вернуть.

{ sanity < 50:
    «...мы не лжём...»
    «...мы даём...»
    «...за цену...»
    
    ~ lose_sanity(3)
}

* [И вы поверили?]
    — И вы поверили?
    
    — Нет. Сначала — нет. Я был учёным. Скептиком. Я думал — галлюцинация. Стресс. Переутомление.
    
    -> episode5_chernov_truth

* [Какова цена?]
    — Какую цену они потребовали?
    
    Чернов смотрит на алтарь. На связанные фигуры.
    
    — Вы уже знаете ответ.
    
    -> episode5_chernov_truth

=== episode5_chernov_truth ===

# mood: horror

— Они показали мне. — Чернов подходит ближе. Его глаза — горят. — В шестьдесят шестом. Когда Дверь открылась в первый раз.

Он указывает на Дверь — тёмный провал в стене пещеры, пульсирующий красным светом.

— Я видел ЕЁ. Марину. Там. За Дверью. Она ждала меня. Звала. Протягивала руки.

~ CharacterSecrets += chernov_humanity
~ EmotionalScenes += scene_chernov_memory

— Она была... такой же. Молодой. Красивой. Живой. Как будто никогда не умирала.

{ sanity < 40:
    Вы видите — за спиной Чернова — тень. Женский силуэт. Протянутые руки.
    
    Галлюцинация?
    
    Или...
    
    ~ lose_sanity(5)
}

— Они сказали — она вернётся. Когда Дверь откроется полностью. Когда будет достаточно... энергии.

— Жертв.

— Да. — Он кивает. Без раскаяния. — Жертв. Сначала — добровольцев. Потом... не совсем добровольцев.

— Вы убили десятки людей.

— Я спасу её. — Его голос — как сталь. — Я верну её. После тридцати двух лет ожидания. Сегодня. Этой ночью.

Он поворачивается к алтарю.

— И никто — слышите? — НИКТО — мне не помешает.

* [Вы ошибаетесь — она не вернётся]
    — Чернов. — Вы говорите спокойно. — То, что вы видели — не ваша жена. Это приманка. Иллюзия. ОНО использует вас.
    
    Чернов замирает. На мгновение — только на мгновение — в его глазах мелькает сомнение.
    
    — Нет.
    
    — Тридцать два года. Сотни жертв. И она всё ещё там. Почему? Если они могут вернуть её — почему не вернули?
    
    Молчание. Чернов стоит неподвижно.
    
    — Потому что им не нужна она. Им нужны ВЫ. Ваша вера. Ваша боль. Ваши жертвы.
    
    ~ trust_vera += 5
    
    -> episode5_final_fight

* [Она бы не хотела этого]
    — Марина. — Вы произносите имя мягко. — Ваша жена. Пианистка. Она бы хотела, чтобы вы убивали невинных людей ради неё?
    
    Чернов вздрагивает. Как от удара.
    
    — Замолчите.
    
    — Она любила музыку. Красоту. Жизнь. А вы превратили её память в... в ЭТО.
    
    Его рука — дрожит. Медальон выскальзывает. Падает на камни. Раскрывается.
    
    Фотография — смотрит вверх. Улыбается.
    
    — Замолчите! — Его голос — крик. — Вы не понимаете! Вы ничего не понимаете!
    
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
~ lose_sanity(10)

// ПРОВЕРКА НА БЕЗУМИЕ — наблюдение убийства
{ sanity <= 0:
    -> sanity_collapse
}

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

— Вторая жертва!

{ MetCharacters ? vera:
    Чернов поворачивается к Вере.
- else:
    Чернов поворачивается к женщине в белом халате.
}

* [СЕЙЧАС!]
    -> episode5_final_fight

=== episode5_final_fight ===

~ KeyEvents += confronted_cult

— СТОЙ!

Вы бросаетесь вперёд.

// Астахов — дополнительный противник если вы его разозлили
{ trust_astahov < -5:
    Астахов перехватывает вас!
    
    — Я знал, что вы придёте, Сорокин.
    
    Борьба. Короткая, жестокая.
    
    { sanity >= 50:
        Вы сильнее. Астахов падает.
    - else:
        Он сильнее. Удар в голову. Всё плывёт.
        
        ~ lose_sanity(10)
        
        // ПРОВЕРКА НА БЕЗУМИЕ — критический момент
        { sanity <= 0:
            -> sanity_collapse
        }
    }
}

Хаос. Крики.

{ Relationships ? romantic_tanya:
    Таня — к отцу. Режет верёвки.
}

Чернов стоит у алтаря. Спокойный.

— Следователь Сорокин. Я ждал вас.

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

Чернов улыбается.

— Это ничего не изменит.

Удар.

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
    — Как закрыть Дверь?!
    
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

* { count_all_clues() >= 6 && sanity >= 40 } [Раскрыть правду миру — пусть все узнают]
    ~ MoralChoices += revealed_truth
    ~ humanity = humanity + 10
    -> ending_truth

* { sanity >= 40 } [Уничтожить культ и молчать — некоторые тайны лучше похоронить]
    ~ MoralChoices += buried_truth
    ~ humanity = humanity - 5
    -> ending_hero

* { sanity < 40 || cult_awareness >= 15 } [Пожертвовать собой — закрыть Дверь навсегда]
    ~ MoralChoices += sacrificed_self
    ~ humanity = humanity + 25
    -> ending_sacrifice

* { cult_awareness >= 10 && sanity < 50 } [Принять предложение Чернова — возможно, он прав]
    -> ending_rebirth

// Романтическая концовка с Таней — недоступна если она была ранена
* { trust_tanya >= 60 && Relationships ? romantic_tanya && not tanya_was_injured } [Спасти Таню — она важнее мира]
    ~ MoralChoices += saved_tanya_over_ritual
    ~ humanity = humanity - 10
    -> ending_escape

// Нейтральный побег — если Таня ранена, романтика невозможна
* { trust_tanya >= 60 && (not (Relationships ? romantic_tanya) || tanya_was_injured) } [Бежать — вы сделали достаточно]
    ~ MoralChoices += escaped_alone
    ~ humanity = humanity - 15
    -> ending_escape

* { understanding_chernov >= 40 } [Попытаться спасти Чернова — он тоже жертва]
    ~ MoralChoices += spared_chernov
    ~ humanity = humanity + 20
    -> ending_chernov_redemption

// СЕКРЕТНАЯ КОНЦОВКА: Фёдор закрывает Дверь
* { Relationships ? fyodor_secret && KeyEvents ? fyodor_ally && not (KeyEvents ? found_fyodor_body) } [Позволить Фёдору закончить это — его грех, его искупление]
    -> ending_fyodor_sacrifice

// Fallback если ни одно условие не выполнено
* -> ending_hero

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
    — Нет! — Таня хватает вас за руку. Её пальцы — как железо. — Виктор, нет! Не надо!
    
    Вы поворачиваетесь. Смотрите ей в глаза.
    
    — Таня. Забери отца. Уходи.
    
    — Я не...
    
    — УХОДИ!
    
    Она отступает. В её глазах — слёзы. Понимание. Ужас.
    
    — Обещай мне. — Ваш голос — мягкий, как тогда, когда вы держали её за руку. — Живи. Будь счастлива. Забудь.
    
    Она качает головой. Не может говорить.
    
    — Обещай.
    
    — О-обещаю...
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
    
    — Держись... — Её голос — далёкий, как эхо. — Виктор, держись...
    
    — Всё хорошо. — Вы не уверены, говорите ли вслух. — Всё закончилось.
    
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
    
    — Ты обещал вернуться, — говорит она.
    
    — Обещал.
    
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

Пещеры рушатся. Камни падают с потолка. Пыль. Грохот.

— БЕЖИМ!

Вы хватаете кого-то за руку. Бежите.

{ Relationships ? romantic_tanya:
    Таня — рядом. В одной руке — фонарик, другой — тащит отца. Зорин едва держится на ногах, но живой. Живой.
    
    — Не останавливайся! — кричите вы.
    
    — Не собиралась!
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
    
    — Мы выбрались, — говорит она. Голос — недоверчивый.
    
    — Выбрались.
}

...

Машина. "УАЗик", брошенный у опушки. Ключи — в замке.

Вы садитесь. Заводите двигатель. Он кашляет, чихает, но заводится.

Дорога. Ночь. Фары вырывают из темноты деревья, снег, бесконечную ленту асфальта.

Прочь. Подальше от Красногорска-12. От пещер. От красного леса.

{ Relationships ? romantic_tanya:
    Таня — на пассажирском сиденье. Зорин — сзади, спит. Или в забытьи.
    
    Она берёт вас за руку. Её пальцы — холодные.
    
    — Куда теперь?
    
    — Куда угодно. Подальше отсюда.
    
    — А потом?
    
    — Потом... — Вы смотрите на дорогу. На тёмный горизонт. — Потом — разберёмся.
    
    Она кладёт голову вам на плечо.
    
    — Хорошо.
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
    
    — Всё хорошо, — шепчет она. — Ты в безопасности. Мы в безопасности.
    
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

Вы подходите к Чернову.

Не с оружием. С пустыми руками.

— Александр Михайлович.

Он смотрит на вас. В его глазах — удивление.

— Вы... не боитесь?

— Боюсь. Но понимаю.

Вы знаете его историю. Жена — Марина. Умерла от рака. Он верил, что НЕЧТО может вернуть её. Двадцать лет — одержим этой надеждой.

— Марина не хотела бы этого.

Он вздрагивает. Как от удара.

— Откуда вы...

— Я видел медальон. На вашей шее. Её фотография.

Чернов касается груди. Машинально. Защитный жест.

— Вы не знаете, каково это. Потерять всё.

— Знаю. Афганистан. Товарищи. Друзья. Я их всех помню.

Пауза.

— Но они не хотели бы, чтобы я убивал других ради их возвращения. Они хотели бы, чтобы я — ЖИЛ. Делал мир лучше. Не хуже.

Чернов смотрит на алтарь. На связанных людей. На НЕЧТО, которое ждёт.

— Поздно. Слишком поздно. Я зашёл слишком далеко.

— Никогда не поздно остановиться. Пока жив — можно выбрать.

{ humanity >= 60:
    Что-то меняется в его глазах. Огонь безумия — гаснет. Остаётся — усталость. И боль. Человеческая боль.
    
    — Марина... — Шёпот. — Прости меня.
    
    Он поворачивается к алтарю.
    
    — Я знаю, как это закрыть. По-настоящему. Навсегда.
    
    — Как?
    
    — Добровольная жертва. Того, кто открыл. — Он улыбается. Впервые — не безумно. Печально. — Меня.
    
    ~ MoralChoices += spared_chernov
    
    Прежде чем вы успеваете остановить его — он берёт ритуальный нож с алтаря.
    
    — Позаботьтесь о них. — Кивок на пленников. — Они невинны.
    
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
    
    — Красивые слова, следователь. Но — слишком поздно.
    
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

Вы смотрите на Фёдора.

Он стоит у алтаря. Спокойный. Впервые за двадцать лет — спокойный.

— Двадцать лет я ждал этого момента.

— Фёдор...

— Я был одним из них. Давно. Помогал открыть Дверь. — Он улыбается. — Теперь — закрою.

— Есть другой способ.

— Нет. Только добровольная жертва. Я — виновен. Вы — нет.

НЕЧТО над алтарём ревёт.

«...НЕТ!... ОН НАШ!...»

— Прощайте, следователь.

Фёдор берёт нож.

{ Relationships ? romantic_tanya:
    Таня хватает вас за руку:
    
    — Не смотрите.
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
