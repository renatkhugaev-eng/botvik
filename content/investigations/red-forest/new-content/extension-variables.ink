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
VAR day5_narrative_shown = false    // true после показа расширенного повествования дня 5
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
// СИСТЕМА ДИНАМИЧЕСКИХ ВСТРЕЧ С ПЕРСОНАЖАМИ
// ═══════════════════════════════════════════════════════════════════════════════
// Каждый персонаж может появиться в разных локациях в разные дни
// Встречи развивают их личные истории последовательно

// Счётчики встреч (для развития историй)
VAR encounters_tanya = 0        // Сколько раз встречали Таню вне дома
VAR encounters_klava = 0        // Сколько раз встречали Клавдию вне ресторана
VAR encounters_gromov = 0       // Сколько раз встречали Громова вне участка
VAR encounters_vera = 0         // Сколько раз встречали Веру вне больницы
VAR encounters_serafim = 0      // Сколько раз встречали Серафима вне церкви
VAR encounters_fyodor = 0       // Сколько раз встречали Фёдора

// Текущее местоположение персонажей (вычисляется в начале каждого периода)
// 0=нигде, 1=церковь, 2=больница, 3=рынок, 4=ресторан, 5=лес
VAR location_tanya = 0
VAR location_klava = 0
VAR location_gromov = 0
VAR location_vera = 0
VAR location_fyodor = 0

// Состояние персонажей (для особых сцен)
VAR gromov_wounded = false      // Громов ранен (с дня 8)
VAR tanya_desperate = false     // Таня в отчаянии (с дня 10)
VAR klava_knows_truth = false   // Клавдия раскрыла правду
VAR fyodor_lucid = false        // Фёдор в "ясном" состоянии

// Флаги важных разговоров
VAR tanya_told_about_mother = false     // Таня рассказала о матери
VAR klava_told_about_cult = false       // Клавдия рассказала о культе
VAR gromov_offered_alliance = false     // Громов предложил союз
VAR fyodor_revealed_echo = false        // Фёдор раскрыл "Проект Эхо"

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

=== function update_character_locations() ===
// Обновляет местоположение персонажей на основе дня и времени суток
// Вызывать при смене времени или входе в локацию

// Таня: дом → церковь (вечер) → рынок (день) → больница (редко)
{ time_of_day == 2:  // вечер
    { current_day % 3 == 0:
        ~ location_tanya = 1  // церковь
    - else:
        { current_day % 3 == 1:
            ~ location_tanya = 3  // рынок
        - else:
            ~ location_tanya = 0  // дома
        }
    }
- else:
    { time_of_day == 1 && current_day % 4 == 0:
        ~ location_tanya = 3  // рынок днём
    - else:
        ~ location_tanya = 0
    }
}

// Клавдия: ресторан → церковь (утро/вечер) → больница (день) → рынок (день)
{ time_of_day == 0:  // утро
    { current_day % 2 == 0:
        ~ location_klava = 1  // церковь
    - else:
        ~ location_klava = 4  // ресторан
    }
}
{ time_of_day == 1:  // день
    { current_day % 3 == 0:
        ~ location_klava = 2  // больница
    - else:
        { current_day % 3 == 1:
            ~ location_klava = 3  // рынок
        - else:
            ~ location_klava = 4  // ресторан
        }
    }
}
{ time_of_day == 2:  // вечер
    { current_day % 2 == 1:
        ~ location_klava = 1  // церковь
    - else:
        ~ location_klava = 4  // ресторан
    }
}
{ time_of_day == 3:  // ночь
    ~ location_klava = 0  // дома
}

// Громов: участок → больница (если ранен) → рынок (по делу) → лес (патруль)
{ gromov_wounded:
    ~ location_gromov = 2  // больница
- else:
    { time_of_day == 1:  // день
        { current_day % 3 == 1:
            ~ location_gromov = 3  // рынок
        - else:
            { current_day % 3 == 2:
                ~ location_gromov = 5  // лес
            - else:
                ~ location_gromov = 0  // участок
            }
        }
    - else:
        { time_of_day == 0:
            ~ location_gromov = 2  // больница утром (проверка раненых)
        - else:
            ~ location_gromov = 0  // участок
        }
    }
}

// Вера: больница → рынок (редко, за продуктами) → церковь (редко)
{ time_of_day == 3:
    ~ location_vera = 0  // не на смене ночью
- else:
    { time_of_day == 1 && current_day % 5 == 0:
        ~ location_vera = 3  // рынок за продуктами
    - else:
        { time_of_day == 2 && current_day % 7 == 0:
            ~ location_vera = 1  // церковь вечером (редко)
        - else:
            ~ location_vera = 2  // больница
        }
    }
}

// Фёдор: везде (бродит, нестабилен)
{ current_day >= 8:
    { time_of_day == 0:
        ~ location_fyodor = 3  // рынок утром
    }
    { time_of_day == 1:
        { current_day % 2 == 0:
            ~ location_fyodor = 2  // больница
        - else:
            ~ location_fyodor = 1  // церковь
        }
    }
    { time_of_day == 2:
        ~ location_fyodor = 3  // рынок вечером
    }
    { time_of_day == 3:
        ~ location_fyodor = 5  // бродит у леса ночью
    }
- else:
    ~ location_fyodor = 0  // ещё не появляется
}

// Обновляем состояния
{ current_day >= 8 && not gromov_wounded:
    ~ gromov_wounded = true
}
{ current_day >= 10 && not tanya_desperate:
    ~ tanya_desperate = true
}
// Фёдор становится "ясным" если он уже раскрыл Эхо и день >= 12
{ current_day >= 12 && fyodor_revealed_echo && not fyodor_lucid:
    ~ fyodor_lucid = true
}
~ return true

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
