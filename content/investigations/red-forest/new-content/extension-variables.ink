// ═══════════════════════════════════════════════════════════════════════════════
// РАСШИРЕНИЕ: Переменные для дней 6-15
// ═══════════════════════════════════════════════════════════════════════════════
// Дата создания: Январь 2026
// Описание: Новые переменные для расширенного режима игры
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// РЕЖИМ РАСШИРЕНИЯ
// ═══════════════════════════════════════════════════════════════════════════════

VAR extended_mode = false           // true когда игрок выбрал продолжить (дни 6-15)
VAR extended_intro_played = false   // true после вступления дня 5
VAR can_trigger_finale = false      // true только на день 15

// ═══════════════════════════════════════════════════════════════════════════════
// НОВЫЕ ЛОКАЦИИ
// ═══════════════════════════════════════════════════════════════════════════════

LIST ExtendedLocations = ext_market, ext_school, ext_cemetery, ext_old_mine, ext_sawmill, ext_radio_tower
VAR unlocked_extended = ()

// Флаги посещения (для уникального контента при первом визите)
VAR visited_market = false
VAR visited_school = false
VAR visited_cemetery = false
VAR visited_old_mine = false
VAR visited_sawmill = false
VAR visited_radio_tower = false

// ═══════════════════════════════════════════════════════════════════════════════
// НОВЫЕ NPC
// ═══════════════════════════════════════════════════════════════════════════════

// Торговец Семён — рынок
VAR met_semyon = false
VAR trust_semyon = 0
VAR semyon_debt_paid = false        // Помогли ему с долгом

// Учительница Нина Павловна — школа
VAR met_nina = false
VAR trust_nina = 0
VAR nina_showed_archive = false     // Показала школьный архив

// Могильщик Захар — кладбище
VAR met_zakhar = false
VAR trust_zakhar = 0
VAR zakhar_told_secret = false      // Рассказал о странных захоронениях

// Вдова шахтёра Мария — старая шахта
VAR met_maria = false
VAR trust_maria = 0
VAR maria_gave_map = false          // Дала карту подземелий

// ═══════════════════════════════════════════════════════════════════════════════
// РАСШИРЕННЫЕ ПОБОЧНЫЕ КВЕСТЫ
// ═══════════════════════════════════════════════════════════════════════════════

LIST ExtendedSidequests = esq_dogs, esq_ghost, esq_diary, esq_radio, esq_graves
VAR active_extended_sq = ()

// Пропавшие собаки (esq_dogs)
VAR dogs_found = 0                  // Найдено собак (из 5)
VAR dogs_truth_known = false        // Узнали правду о собаках

// Призрак шахтёра (esq_ghost)
VAR ghost_sightings = 0             // Видели призрака раз
VAR ghost_identity_known = false    // Узнали кто это

// Дневник учителя (esq_diary)
VAR diary_pages_found = 0           // Найдено страниц (из 7)
VAR diary_complete = false          // Собран весь дневник

// Голоса по радио (esq_radio)
VAR radio_messages_heard = 0        // Услышано сообщений
VAR radio_source_found = false      // Нашли источник

// Безымянные могилы (esq_graves)
VAR graves_identified = 0           // Опознано могил
VAR mass_grave_found = false        // Нашли массовое захоронение

// ═══════════════════════════════════════════════════════════════════════════════
// ГЛУБИНА РАССЛЕДОВАНИЯ
// ═══════════════════════════════════════════════════════════════════════════════

VAR conspiracy_depth = 0            // Насколько глубоко копнули (0-100)
VAR cult_inner_circle = false       // Узнали о внутреннем круге культа
VAR factory_secret_found = false    // Нашли секрет завода
VAR echo_files_decoded = false      // Расшифровали файлы "Эхо"

// ═══════════════════════════════════════════════════════════════════════════════
// РЕПУТАЦИЯ В ГОРОДЕ (расширенная)
// ═══════════════════════════════════════════════════════════════════════════════

VAR city_fear_level = 0             // Город боится вас (0-100)
VAR city_gratitude = 0              // Благодарность города (0-100)
VAR rumors_about_player = 0         // Количество слухов о вас

// ═══════════════════════════════════════════════════════════════════════════════
// СИСТЕМА ВРЕМЕНИ (расширенная)
// ═══════════════════════════════════════════════════════════════════════════════

VAR actions_this_period = 0         // Действий в текущем периоде времени
VAR max_actions_per_period = 2      // Максимум действий за период

// Случайные события
VAR random_event_today = false      // Было ли случайное событие сегодня
VAR last_random_event = 0           // Номер последнего события

// ═══════════════════════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ ДАТЫ РАСШИРЕНИЯ
// ═══════════════════════════════════════════════════════════════════════════════
// День 6: Начало расширенного режима
// День 8: Можно открыть старую шахту
// День 10: Кульминация — раскрытие заговора
// День 12: Точка невозврата — культ активизируется
// День 15: Финал — следующее полнолуние

VAR milestone_day_8 = false
VAR milestone_day_10 = false
VAR milestone_day_12 = false
VAR cult_awakened = false           // Культ начал подготовку к ритуалу

// ═══════════════════════════════════════════════════════════════════════════════
// ФУНКЦИИ РАСШИРЕНИЯ
// ═══════════════════════════════════════════════════════════════════════════════

=== function unlock_extended_location(loc) ===
{ not (unlocked_extended ? loc):
    ~ unlocked_extended += loc
}
~ return true

=== function start_extended_sidequest(sq) ===
{ not (active_extended_sq ? sq):
    ~ active_extended_sq += sq
}
~ return true

=== function complete_extended_sidequest(sq) ===
~ active_extended_sq -= sq
~ conspiracy_depth += 10
~ return true

=== function add_city_fear(amount) ===
~ city_fear_level += amount
{ city_fear_level > 100:
    ~ city_fear_level = 100
}
~ return city_fear_level

=== function add_city_gratitude(amount) ===
~ city_gratitude += amount
{ city_gratitude > 100:
    ~ city_gratitude = 100
}
~ return city_gratitude

=== function check_can_finale() ===
// Финал доступен только на день 15
~ can_trigger_finale = (current_day >= 15)
~ return can_trigger_finale

=== function get_extended_date() ===
// Возвращает дату для дней 6-15
{ current_day == 6:
    ~ return "20 ноября 1986"
}
{ current_day == 7:
    ~ return "21 ноября 1986"
}
{ current_day == 8:
    ~ return "22 ноября 1986"
}
{ current_day == 9:
    ~ return "23 ноября 1986"
}
{ current_day == 10:
    ~ return "24 ноября 1986"
}
{ current_day == 11:
    ~ return "25 ноября 1986"
}
{ current_day == 12:
    ~ return "26 ноября 1986"
}
{ current_day == 13:
    ~ return "27 ноября 1986"
}
{ current_day == 14:
    ~ return "28 ноября 1986"
}
{ current_day >= 15:
    ~ return "29 ноября 1986"
}
~ return "Ноябрь 1986"
